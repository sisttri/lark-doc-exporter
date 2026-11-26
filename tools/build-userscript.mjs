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

const root = fileURLToPath(new URL('../', import.meta.url));
const assetFiles = {engine:'release-assets/pdf-engine-0.3.15.js', fonts:'release-assets/pdf-fonts-v1.json'};
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const fontHashes = {
  Regular:'689db17ebf1a1dc29b075c42d27a3101f4f91e888ded96dfe54af3d5df9faefa',
  Bold:'cd441dc10e7d450eb292b73a03a060a50ab88893fc9d69b9b143cd616b9c2ca5',
};

if (process.argv.includes('--assets-only')) {
  const fontArchive = [];
  for (const [weight, expected] of Object.entries(fontHashes)) {
    const bytes = await fs.readFile(path.join(root, 'fonts', 'NotoSansCJKsc-' + weight + '.woff2'));
    if (hash(bytes) !== expected) throw new Error('字体校验失败 ' + weight);
    const compressed = gzipSync(bytes, {level:9});
    fontArchive.push({name:weight + '.woff2', hash:expected, size:bytes.length, compressedSize:compressed.length, compressed:encodeZ85(compressed)});
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
    pdfMake.addFonts({Noto:{normal:'Regular.woff2',bold:'Bold.woff2',italics:'Regular.woff2',bolditalics:'Bold.woff2'}});
    postMessage({stage:'排版图片与正文'});
    const prepared = await prepareImages(data.snapshot);
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
});
// 用函数本身保存 Worker 源码，产物中的排版逻辑仍可直接阅读。
const pdfAssets = 'export const resourceHashes = ' + JSON.stringify(resourceHashes) + ';\n' +
  'export const workerSource = "(" + function pdfWorkerBootstrap() {\n' + pdfWorker.outputFiles[0].text + '\n}.toString() + ")();";';
const licenseComments = [];
for (const file of ['LICENSE', 'licenses/JavaScript-notices.txt', 'licenses/Noto-OFL.txt']) {
  const text = await fs.readFile(path.join(root, file), 'utf8');
  if (text.includes('*/')) throw new Error(file + ' 包含注释终止符，无法安全写入独立脚本。');
  licenseComments.push('/*\n' + file + '\n\n' + text + '\n*/');
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
  '// @updateURL    https://raw.githubusercontent.com/sisttri/lark-doc-exporter/main/lark-doc-exporter.user.js',
  '// @downloadURL  https://raw.githubusercontent.com/sisttri/lark-doc-exporter/main/lark-doc-exporter.user.js',
  ...resourceMetadata,
  '// ==/UserScript==',
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
  plugins:[{
    name:'cached-pdf',
    setup(builder) {
      builder.onResolve({filter:/^pdf-worker-assets$/}, () => ({path:'assets', namespace:'cached-pdf'}));
      builder.onLoad({filter:/.*/, namespace:'cached-pdf'}, () => ({contents:pdfAssets, loader:'js'}));
    },
  }],
});
const source = result.outputFiles[0].contents;
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
