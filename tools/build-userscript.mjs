// 自有代码保留可读形式；PDF 引擎和字体由油猴安装时校验、缓存。
import {build} from 'esbuild';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {gzipSync} from 'node:zlib';
import {zipSync} from 'fflate';
import {encodeZ85} from '../src/userscript/pdf-fonts.js';
import {VERSION} from '../src/shared.js';
import {assertUserscriptLint} from './userscript-lint.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const assetFiles = {engine:'release-assets/pdf-engine-0.3.15.js', fonts:'release-assets/pdf-fonts-v1.json'};
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const fontSpecs = [
  {name:'Regular.woff2',file:'NotoSansCJKsc-Regular.woff2',hash:'689db17ebf1a1dc29b075c42d27a3101f4f91e888ded96dfe54af3d5df9faefa'},
  {name:'Bold.woff2',file:'NotoSansCJKsc-Bold.woff2',hash:'cd441dc10e7d450eb292b73a03a060a50ab88893fc9d69b9b143cd616b9c2ca5'},
  {name:'Emoji.ttf',file:'NotoEmoji-Regular.ttf',hash:'de6c18832938afc99caf132b39d6a30a19bac7f2e812e28db2535b4608d27551',coverage:true},
  {name:'Symbols.ttf',file:'NotoSansSymbols2-Regular.ttf',hash:'7d5fb73b7ca67a6798101741f5d280a3d016a56a197afcd4199dbb57b4b82a21',coverage:true},
];

// Both pinned fallback fonts contain a Unicode format-12 cmap. Store its actual
// non-.notdef ranges with the cached font, instead of a hand-maintained table.
function trueTypeCoverage(bytes) {
  const view = new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
  let cmap;
  const tables = view.getUint16(4);
  for (let index=0;index<tables;index++) {
    const offset=12+index*16;
    if (bytes.subarray(offset,offset+4).toString() === 'cmap') cmap=view.getUint32(offset+8);
  }
  if (cmap === undefined) throw new Error('回退字体缺少 cmap。');
  const subtables=view.getUint16(cmap+2);
  for (let index=0;index<subtables;index++) {
    const record=cmap+4+index*8,platform=view.getUint16(record),encoding=view.getUint16(record+2);
    const offset=cmap+view.getUint32(record+4);
    if (platform !== 0 && !(platform === 3 && encoding === 10) || view.getUint16(offset) !== 12) continue;
    const length=view.getUint32(offset+4),count=view.getUint32(offset+12);
    if (count>10000 || length<16+count*12 || offset+length>bytes.length) throw new Error('回退字体 cmap 无效。');
    const ranges=[];
    for (let group=0;group<count;group++) {
      const at=offset+16+group*12;
      const start=view.getUint32(at)+(view.getUint32(at+8) === 0 ? 1 : 0),end=view.getUint32(at+4);
      if (start>end) continue;
      if (end>0x10ffff) throw new Error('回退字体 Unicode 范围无效。');
      const previous=ranges.at(-1);
      if (previous && start<=previous[1]) throw new Error('回退字体 Unicode 范围重叠。');
      if (previous && start === previous[1]+1) previous[1]=end;
      else ranges.push([start,end]);
    }
    if (!ranges.length) throw new Error('回退字体没有可用 Unicode 字形。');
    return ranges;
  }
  throw new Error('回退字体缺少 Unicode format-12 cmap。');
}

// Keep upstream library semantics; only their existing style conventions are exempt.
// The paired, preserved comments stop at each module, including the PDF Worker.
const upstreamRules = {
  fflate:'curly, no-redeclare, no-return-assign, no-sequences',
  parse5:'curly, dot-notation',
  entities:'dot-notation',
};
const upstreamEditor = {
  name:'upstream-editor-boundaries',
  setup(builder) {
    builder.onLoad({filter:/node_modules\/(fflate|parse5|entities)\/.*\.js$/}, async ({path:file}) => {
      const name = file.match(/node_modules\/(fflate|parse5|entities)\//)[1];
      // Plugin-specific lint comments belong to the upstream development setup.
      const source = (await fs.readFile(file, 'utf8')).replace(/^\s*\/\/ eslint-(?:disable|enable)[^\n]*$/gm, '');
      const rules = upstreamRules[name];
      return {contents:`/* eslint-disable ${rules} -- @preserve Upstream ${name} conventions only. */\n${source}\n/* eslint-enable ${rules} -- @preserve End upstream ${name}. */`};
    });
  },
};

function readableBundlerHelpers(source) {
  // These are esbuild's lazy-module helpers. Parentheses and braces preserve
  // their behavior while satisfying the editor's comma/control-flow rules.
  return source
    .replace('return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;',
      'return (fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res);')
    .replace(/for \(var name in all\)\n(\s*)(__defProp\(target, name, \{ get: all\[name\], enumerable: true \}\);)/,
      'for (var name in all) {\n$1$2\n$1}')
    .replace(/=> \((init_[\w$]+\(\), [\w$]+_exports)\)/g, '=> (($1))');
}

if (process.argv.includes('--assets-only')) {
  const fontArchive = [];
  for (const spec of fontSpecs) {
    const bytes = await fs.readFile(path.join(root, 'fonts', spec.file));
    if (hash(bytes) !== spec.hash) throw new Error('字体校验失败 ' + spec.name);
    const compressed = gzipSync(bytes, {level:9});
    fontArchive.push({name:spec.name, hash:spec.hash, size:bytes.length, compressedSize:compressed.length, compressed:encodeZ85(compressed),
      ...(spec.coverage ? {coverage:trueTypeCoverage(bytes)} : {})});
  }
  const engine = await fs.readFile(path.join(root, 'node_modules/pdfmake/build/pdfmake.min.js'), 'utf8');
  const courier = await fs.readFile(path.join(root, 'node_modules/pdfmake/build/standard-fonts/Courier.js'), 'utf8');
  const contents = {
    engine:'// pdfmake 0.3.15 and Courier: MIT, https://github.com/bpampuch/pdfmake/tree/0.3.15\n' + engine + '\n;\n' + courier + '\n',
    fonts:JSON.stringify(fontArchive) + '\n',
  };
  await fs.mkdir(path.join(root, 'release-assets'), {recursive:true});
  const manifest = {schemaVersion:1};
  for (const [kind, content] of Object.entries(contents)) {
    const bytes = Buffer.from(content);
    await fs.writeFile(path.join(root, assetFiles[kind]), bytes);
    manifest[kind] = {file:assetFiles[kind], sha256:hash(bytes), bytes:bytes.length};
  }
  await fs.writeFile(path.join(root, 'release-assets/manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  console.log('已生成 PDF 发布资源 release-assets/manifest.json；尚未构建安装脚本。');
  process.exit(0);
}

let manifest;
try {
  manifest = JSON.parse(await fs.readFile(path.join(root, 'pdf-resource-manifest.json'), 'utf8'));
} catch {
  throw new Error('缺少或无法读取 pdf-resource-manifest.json；请先发布 --assets-only 生成的资源，再配置固定 commit URL 与 SHA-256。');
}
if (manifest.schemaVersion !== 1) throw new Error('pdf-resource-manifest.json schemaVersion 必须为 1。');
const resourceNames = {engine:'pdfEngine', fonts:'pdfFonts'};
const resourceHashes = {};
const resourceMetadata = [];
for (const kind of ['engine', 'fonts']) {
  const resource = manifest[kind];
  const immutable = /^https:\/\/raw\.githubusercontent\.com\/sisttri\/lark-doc-exporter\/[a-f0-9]{40}\//;
  if (!resource || typeof resource.url !== 'string' || !immutable.test(resource.url) || !resource.url.endsWith('/' + assetFiles[kind])) {
    throw new Error('PDF ' + kind + ' 资源必须使用 sisttri/lark-doc-exporter 的固定 40 位 commit URL：' + assetFiles[kind]);
  }
  if (!/^[a-f0-9]{64}$/.test(resource.sha256)) throw new Error('PDF ' + kind + ' SHA-256 格式无效。');
  const bytes = await fs.readFile(path.join(root, assetFiles[kind]));
  if (hash(bytes) !== resource.sha256) throw new Error('PDF ' + kind + ' SHA-256 与本地发布资源不匹配。');
  resourceHashes[resourceNames[kind]] = resource.sha256;
  resourceMetadata.push('// @resource     ' + resourceNames[kind] + ' ' + resource.url + '#sha256=' + resource.sha256);
}

const pdfWorker = await build({
  absWorkingDir:root,
  stdin:{
    resolveDir:root,
    sourcefile:'pdf-worker.js',
    contents:`
import {pdfDefinition, prepareImages} from './src/pdf.js';
import {safeStem} from './src/shared.js';
import {readEmbeddedFont} from './src/userscript/pdf-fonts.js';

self.onmessage = async ({data}) => {
  try {
    const pdfMake = self.pdfMake;
    if (!pdfMake || typeof pdfMake.createPdf !== 'function') throw Object.assign(new Error(), {code:'PDF_RESOURCE_INVALID'});
    postMessage({stage:'准备 PDF 字体'});
    const fonts = {};
    for (const font of data.fontArchive) fonts[font.name] = {data:await readEmbeddedFont(font)};
    pdfMake.addVirtualFileSystem(fonts);
    pdfMake.addFonts({
      Noto:{normal:'Regular.woff2',bold:'Bold.woff2',italics:'Regular.woff2',bolditalics:'Bold.woff2'},
      NotoEmoji:{normal:'Emoji.ttf',bold:'Emoji.ttf',italics:'Emoji.ttf',bolditalics:'Emoji.ttf'},
      NotoSymbols:{normal:'Symbols.ttf',bold:'Symbols.ttf',italics:'Symbols.ttf',bolditalics:'Symbols.ttf'},
    });
    postMessage({stage:'排版图片与正文'});
    const prepared = await prepareImages(data.snapshot);
    prepared.fontCoverage = {
      NotoEmoji:data.fontArchive.find(font => font.name === 'Emoji.ttf').coverage,
      NotoSymbols:data.fontArchive.find(font => font.name === 'Symbols.ttf').coverage,
    };
    const {doc, notes} = pdfDefinition(data.snapshot, prepared);
    postMessage({stage:'生成 PDF'});
    const bytes = await pdfMake.createPdf(doc).getBuffer();
    if (bytes.length > 64 * 1024 * 1024) throw Object.assign(new Error(), {code:'PDF_LIMIT'});
    postMessage({result:{filename:safeStem(data.snapshot.title)+'.pdf',blob:new Blob([bytes],{type:'application/pdf'}),notes}});
  } catch (error) {
    postMessage({error:['PDF_LIMIT','PDF_FONT_INVALID','PDF_RESOURCE_INVALID'].includes(error.code) ? error.code : 'PDF_FAILED'});
  }
};`,
  },
  bundle:true, format:'iife', target:'chrome115', minify:false, charset:'utf8', write:false, legalComments:'inline',
  plugins:[upstreamEditor],
});
// 用函数本身保存 Worker 源码，产物中的排版逻辑仍可直接阅读。
const pdfAssets = 'export const resourceHashes = ' + JSON.stringify(resourceHashes) + ';\n' +
  'export const workerSource = "(" + function pdfWorkerBootstrap() {\n' + pdfWorker.outputFiles[0].text + '\n}.toString() + ")();";';
const licenseComments = [];
for (const file of ['LICENSE', ...(await fs.readdir(path.join(root, 'licenses'))).sort().map(name => 'licenses/' + name)]) {
  const text = await fs.readFile(path.join(root, file), 'utf8');
  if (text.includes('*/')) throw new Error(file + ' 包含注释终止符，无法安全写入独立脚本。');
  licenseComments.push('/*\n' + file + '\n\n' + text.replace(/[\t ]+$/gm,'') + '\n*/');
}
const banner = [
  '// ==UserScript==',
  '// @name         飞书文档导出工具',
  '// @namespace    urn:feishu-local-exporter',
  '// @version      ' + VERSION,
  '// @description  将飞书文档保存为 Markdown、HTML、PDF 和已采集素材；PDF 依赖在安装时预缓存，导出时在本机生成。',
  '// @author       sisttri',
  '// @license      MIT',
  '// @homepageURL  https://github.com/sisttri/lark-doc-exporter',
  '// @supportURL   https://github.com/sisttri/lark-doc-exporter/issues',
  '// @match        https://*.feishu.cn/docx/*',
  '// @match        https://*.feishu.cn/docs/*',
  '// @match        https://*.feishu.cn/wiki/*',
  '// @run-at       document-idle',
  '// @noframes',
  '// @grant        GM_registerMenuCommand',
  '// @grant        GM_getResourceText',
  '// @grant        unsafeWindow',
  '// @updateURL    https://raw.githubusercontent.com/sisttri/lark-doc-exporter/main/lark-doc-exporter.user.js',
  '// @downloadURL  https://raw.githubusercontent.com/sisttri/lark-doc-exporter/main/lark-doc-exporter.user.js',
  ...resourceMetadata,
  '// ==/UserScript==',
  '/* global globalThis:readonly */',
  '// Readable bundled libraries for local HTML parsing, ZIP output and isolated Worker decompression:',
  '// fflate 0.8.2 (MIT): https://github.com/101arrowz/fflate/tree/v0.8.2',
  '// parse5 7.3.0 (MIT): https://github.com/inikulin/parse5/tree/v7.3.0',
  '// entities 6.0.1 (BSD-2-Clause): https://github.com/fb55/entities/tree/v6.0.1',
  ...licenseComments,
  '',
].join('\n');
const result = await build({
  absWorkingDir:root, entryPoints:['src/userscript/entry.js'], bundle:true, format:'iife', target:'chrome115',
  charset:'utf8', minify:false, legalComments:'inline', banner:{js:banner}, write:false,
  plugins:[upstreamEditor, {
    name:'cached-pdf',
    setup(builder) {
      builder.onResolve({filter:/^pdf-worker-assets$/}, () => ({path:'assets', namespace:'cached-pdf'}));
      builder.onLoad({filter:/.*/, namespace:'cached-pdf'}, () => ({contents:pdfAssets, loader:'js'}));
    },
  }],
});
const text = readableBundlerHelpers(result.outputFiles[0].text);
assertUserscriptLint(text);
const source = Buffer.from(text);
if (source.length >= 2_000_000) throw new Error('用户脚本超过 Greasy Fork 2 MB 上限；禁止压缩自有代码规避。');
await fs.writeFile(path.join(root, 'lark-doc-exporter.user.js'), source);
const installerFiles = {'飞书文档导出工具.user.js':source, LICENSE:await fs.readFile(path.join(root, 'LICENSE'))};
for (const name of await fs.readdir(path.join(root, 'licenses'))) {
  installerFiles['licenses/' + name] = await fs.readFile(path.join(root, 'licenses', name));
}
const installer = zipSync(installerFiles, {level:6, mtime:new Date(2000,0,1)});
const installerName = '飞书文档导出工具-' + VERSION + '.zip';
await fs.writeFile(path.join(root, installerName), installer);
console.log('已构建 lark-doc-exporter.user.js（' + source.length + ' 字节）与 ' + installerName + '（' + installer.length + ' 字节）。');
