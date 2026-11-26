import test, {before, after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {createHash} from 'node:crypto';
import {resolveObjectURL} from 'node:buffer';
import vm from 'node:vm';
import {unzipSync} from 'fflate';
import {readEmbeddedFont} from '../src/userscript/pdf-fonts.js';
import {validFontCoverage,missingEmojiGlyphs} from '../src/pdf-emoji.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const run = promisify(execFile);
let fixture, assets;
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const build = (...args) => run(process.execPath, ['tools/build-userscript.mjs', ...args], {cwd:fixture});

before(async () => {
  fixture = await fs.mkdtemp(path.join(os.tmpdir(), 'feishu-userscript-build-'));
  await fs.mkdir(path.join(fixture, 'tools'));
  await fs.copyFile(path.join(root, 'tools/build-userscript.mjs'), path.join(fixture, 'tools/build-userscript.mjs'));
  await fs.copyFile(path.join(root, 'tools/userscript-lint.mjs'), path.join(fixture, 'tools/userscript-lint.mjs'));
  await fs.cp(path.join(root, 'src'), path.join(fixture, 'src'), {recursive:true});
  await fs.cp(path.join(root, 'licenses'), path.join(fixture, 'licenses'), {recursive:true});
  await fs.copyFile(path.join(root, 'LICENSE'), path.join(fixture, 'LICENSE'));
  await fs.writeFile(path.join(fixture, 'package.json'), '{"type":"module"}');
  for (const name of ['node_modules', 'fonts']) await fs.symlink(path.join(root, name), path.join(fixture, name));
});
after(async () => { if (fixture) await fs.rm(fixture, {recursive:true, force:true}); });

test('assets-only emits the original PDF engine and exact font bytes without a userscript', async () => {
  await build('--assets-only');
  assets = JSON.parse(await fs.readFile(path.join(fixture, 'release-assets/manifest.json'), 'utf8'));
  assert.equal(assets.schemaVersion, 1);
  for (const asset of [assets.engine, assets.fonts]) {
    const bytes = await fs.readFile(path.join(fixture, asset.file));
    assert.equal(bytes.length, asset.bytes);
    assert.equal(digest(bytes), asset.sha256);
  }
  const engine = await fs.readFile(path.join(fixture, assets.engine.file), 'utf8');
  for (const file of ['pdfmake.min.js', 'standard-fonts/Courier.js']) {
    assert.ok(engine.includes(await fs.readFile(path.join(root, 'node_modules/pdfmake/build', file), 'utf8')));
  }
  const archive = JSON.parse(await fs.readFile(path.join(fixture, assets.fonts.file), 'utf8'));
  const expectedFonts = [['Regular.woff2','NotoSansCJKsc-Regular.woff2'],['Bold.woff2','NotoSansCJKsc-Bold.woff2'],
    ['Emoji.ttf','NotoEmoji-Regular.ttf'],['Symbols.ttf','NotoSansSymbols2-Regular.ttf']];
  assert.deepEqual(archive.map(font => font.name), expectedFonts.map(([name]) => name));
  for (const [name,file] of expectedFonts) {
    const font = archive.find(font => font.name === name);
    assert.deepEqual(Buffer.from(await readEmbeddedFont(font)), await fs.readFile(path.join(root, 'fonts', file)));
    if (name.endsWith('.ttf')) assert.equal(validFontCoverage(font.coverage),true,name);
    else assert.equal(font.coverage,undefined);
  }
  const coverage = {NotoEmoji:archive.find(font => font.name === 'Emoji.ttf').coverage,
    NotoSymbols:archive.find(font => font.name === 'Symbols.ttf').coverage};
  assert.deepEqual(missingEmojiGlyphs('✨ ☐ ☑ ☒ 😀 ❤️ 👩‍💻 🇨🇳 1️⃣',coverage),[]);
  assert.deepEqual(missingEmojiGlyphs('🫩',coverage),['🫩']);
  await assert.rejects(fs.access(path.join(fixture, 'lark-doc-exporter.user.js')), {code:'ENOENT'});
});

test('production build requires immutable URLs and matching hashes, then emits a readable script below 2 MB', async () => {
  await assert.rejects(build(), error => /pdf-resource-manifest\.json/.test(error.stderr));
  const manifest = {schemaVersion:1};
  for (const kind of ['engine', 'fonts']) {
    manifest[kind] = {url:'https://raw.githubusercontent.com/sisttri/lark-doc-exporter/' + 'a'.repeat(40) + '/' + assets[kind].file, sha256:assets[kind].sha256};
  }
  const manifestFile = path.join(fixture, 'pdf-resource-manifest.json');
  await fs.writeFile(manifestFile, JSON.stringify({...manifest, engine:{...manifest.engine, url:manifest.engine.url.replace('a'.repeat(40), 'main')}}));
  await assert.rejects(build(), error => /固定.*commit|40.*commit|immutable/.test(error.stderr));
  await fs.writeFile(manifestFile, JSON.stringify({...manifest, fonts:{...manifest.fonts, sha256:'0'.repeat(64)}}));
  await assert.rejects(build(), error => /hash|SHA-256|哈希/.test(error.stderr));
  await fs.writeFile(manifestFile, JSON.stringify(manifest));
  await build();
  const source = await fs.readFile(path.join(fixture, 'lark-doc-exporter.user.js'), 'utf8');
  assert.ok(Buffer.byteLength(source) < 2_000_000);
  assert.match(source, /@name\s+飞书文档导出工具/);
  assert.match(source, /@version\s+0\.0\.1/);
  assert.match(source, /@license\s+MIT/);
  assert.match(source, /@grant\s+GM_getResourceText/);
  assert.match(source, /@grant\s+unsafeWindow/);
  for (const kind of ['engine', 'fonts']) assert.ok(source.includes(manifest[kind].url + '#sha256=' + manifest[kind].sha256));
  assert.ok(source.includes('function pdfDefinition('));
  assert.ok(source.includes('function prepareImages('));
  assert.ok(source.includes('function readEmbeddedFont('));
  assert.ok(!source.includes('data:font/'));
  assert.ok(!source.includes('webpackUniversalModuleDefinition'));
  assert.ok(source.includes('Copyright (c) 2026 sisttri'));
  assert.ok(source.includes('Permission is hereby granted, free of charge'));
  assert.ok(source.includes('Copyright (c) Felix Böhm'));
  assert.ok(source.includes('Redistribution and use in source and binary forms'));
  assert.ok(source.includes('SIL OPEN FONT LICENSE Version 1.1'));
  assert.ok(source.includes('must be distributed entirely under this license'));
  for (const file of ['LICENSE', 'licenses/JavaScript-notices.txt', 'licenses/Noto-OFL.txt', 'licenses/Noto-Emoji-OFL.txt', 'licenses/Noto-Symbols-OFL.txt']) {
    assert.ok(source.includes((await fs.readFile(path.join(fixture, file), 'utf8')).replace(/[\t ]+$/gm,'')), file + ' must be readable in the standalone script');
  }
  const installer = unzipSync(await fs.readFile(path.join(fixture, '飞书文档导出工具-0.0.1.zip')));
  assert.equal(Buffer.from(installer['飞书文档导出工具.user.js']).toString(), source);
  assert.ok(Object.keys(installer).some(name => name.startsWith('licenses/')));
  assert.deepEqual(Buffer.from(installer.LICENSE), await fs.readFile(path.join(fixture, 'LICENSE')));

  // 执行真实产物与缓存资源；Worker 沙箱不暴露 fetch、XMLHttpRequest 或 importScripts。
  const cached = {
    pdfEngine:await fs.readFile(path.join(fixture, assets.engine.file), 'utf8'),
    pdfFonts:await fs.readFile(path.join(fixture, assets.fonts.file), 'utf8'),
  };
  const stages = [], workers = [];
  const globals = {Blob, URL, crypto, TextEncoder, TextDecoder, DOMException, setTimeout, clearTimeout, setInterval, clearInterval, queueMicrotask, atob, btoa};
  class RuntimeWorker {
    constructor(url) {
      workers.push(this);
      const scope = {...globals, postMessage:data => queueMicrotask(() => { if (!this.terminated) this.onmessage?.({data}); })};
      scope.self = scope;
      this.scope = scope;
      this.ready = resolveObjectURL(url).text().then(workerSource => {
        vm.runInNewContext(workerSource, scope);
        const createPdf = scope.pdfMake.createPdf;
        scope.pdfMake.createPdf = definition => { this.definition=definition; return createPdf.call(scope.pdfMake,definition); };
      });
    }
    postMessage(message) {
      this.ready.then(() => this.scope.onmessage({data:message})).catch(error => this.onerror?.({error, preventDefault(){}}));
    }
    terminate() { this.terminated=true; }
  }
  const sandbox = {...globals, Worker:RuntimeWorker, GM_getResourceText:name => cached[name]};
  const executable = source.replace(/\}\)\(\);\s*$/, '\nglobalThis.__renderPdf = renderPdf;\n})();');
  vm.runInNewContext(executable, sandbox);
  const pdf = await sandbox.__renderPdf({title:'中文导出验证', blocks:[
    {tag:'h1', children:['中文标题']},
    {tag:'p', children:['常规中文 ✨ ☐ ', {tag:'strong', children:['粗体中文 👩‍💻 ☑']}]},
    {tag:'p', children:[{tag:'em',children:[{tag:'a',href:'https://example.org/document',children:['链接 ❤️']}]}]},
    {tag:'table',children:[{tag:'tr',children:[{tag:'th',children:['☒ 表头']}]}]},
    {tag:'pre', children:['const answer = 42;\n中文代码注释 ✅']},
    {tag:'p',children:['未来表情 🫩 ',{tag:'span',equation:'x^2 + 1',display:'inline',children:['x^2 + 1']}]},
  ], assets:[], warnings:[]}, {onProgress:stage => stages.push(stage)});
  assert.equal(pdf.filename, '中文导出验证.pdf');
  assert.equal(pdf.blob.type, 'application/pdf');
  const pdfBytes = Buffer.from(await pdf.blob.arrayBuffer());
  assert.match(pdfBytes.subarray(0, 8).toString(), /^%PDF-/);
  assert.ok(pdfBytes.length > 2000);
  const fontRuns = [];
  function visit(node) {
    if (!node || typeof node !== 'object') return;
    if (node.font && node.text !== undefined) fontRuns.push(node);
    Object.values(node).forEach(visit);
  }
  visit(workers[0].definition);
  assert.ok(fontRuns.some(run => run.font === 'NotoEmoji' && JSON.stringify(run.text).includes('✨')));
  assert.ok(fontRuns.some(run => run.font === 'NotoSymbols' && JSON.stringify(run.text).includes('☐')));
  assert.ok(fontRuns.some(run => run.font === 'NotoEmoji' && JSON.stringify(run.text).includes('✅')));
  assert.equal(pdf.notes.length,2);
  assert.ok(pdf.notes.some(note => /1.*公式.*源码/u.test(note)));
  assert.ok(pdf.notes.some(note => /U\+1FAE9/u.test(note)));
  assert.deepEqual(stages, ['准备 PDF 字体', '排版图片与正文', '生成 PDF']);
  assert.equal(workers[0].terminated, true);
});

test('license comment terminators fail the build instead of injecting executable text', async () => {
  await fs.appendFile(path.join(fixture, 'LICENSE'), '\n*/ globalThis.badLicense = true; /*\n');
  await assert.rejects(build(), error => /LICENSE.*注释终止符/.test(error.stderr));
});
