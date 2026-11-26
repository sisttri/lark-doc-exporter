import assert from 'node:assert/strict';
import test from 'node:test';
import { strFromU8, strToU8, unzipSync } from 'fflate';
import * as importer from '../src/importer.js';
import { renderBundle, renderFile } from '../src/formats.js';

const png = Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGN4oKDwHwAFJAIgPqioaAAAAABJRU5ErkJggg==', 'base64'));
const parts = (html, assets = []) => importer.readDocumentParts({html, assets, name:'input'});

test('内存采集保留净化正文、素材、提示并能导出HTML、Markdown和附件', async () => {
  const html = '<!doctype html><meta name="feishu-local-exporter-warnings" content=\'[{"code":"code_tail_unconfirmed","label":"代码末行未确认"}]\'>' +
    '<h1 onclick="alert(1)">内存转换</h1><script>alert(1)</script><p>正文 <s>旧内容</s></p>' +
    '<table><tr><td rowspan="2">合并</td><td>第一行</td></tr><tr><td>第二行</td></tr></table>' +
    '<img src="images/色%20卡.png"><img src="images/bad.png"><a href="attachments/说明.txt">附件</a>' +
    '<a href="javascript:alert(1)">危险链接</a><iframe src="https://example.org/"></iframe>';
  const assets = [{path:'images/色 卡.png',bytes:png}, {path:'images/bad.png',bytes:new Uint8Array([0])},
    {path:'attachments/说明.txt',bytes:strToU8('附件正文')}];
  const memory = await parts(html, assets);
  assert.equal(memory.title, '内存转换');
  assert.deepEqual(memory.blocks[0], {tag:'h1',children:['内存转换']});
  assert.deepEqual(memory.blocks[1], {tag:'p',children:['正文 ',{tag:'s',children:['旧内容']}]});
  assert.equal(memory.blocks[2].children[0].children[0].children[0].rowspan, 2);
  assert.deepEqual(memory.blocks[3], {tag:'img',path:'images/色 卡.png',alt:''});
  assert.deepEqual(memory.warnings.map(item => item.code), ['code_tail_unconfirmed','invalid_image','unsupported_link','unsupported_block']);
  const htmlFile = await renderFile('html', memory);
  assert.equal(htmlFile.filename, '内存转换.html');
  const exportedHtml = await htmlFile.blob.text();
  assert.match(exportedHtml, /<s>旧内容<\/s>/);
  assert.match(exportedHtml, /data:image\/png;base64,/);
  assert.doesNotMatch(exportedHtml, /onclick|<script|javascript:|<iframe|alert\(1\)/);
  const markdownFile = await renderFile('markdown', memory);
  const markdownFiles = unzipSync(new Uint8Array(await markdownFile.blob.arrayBuffer()));
  assert.match(strFromU8(markdownFiles['内存转换.md']), /~~旧内容~~/);
  assert.deepEqual(markdownFiles['images/色 卡.png'], png);
  assert.equal(strFromU8(markdownFiles['attachments/说明.txt']), '附件正文');
  const attachmentFile = await renderFile('attachments', memory);
  const attachments = unzipSync(new Uint8Array(await attachmentFile.blob.arrayBuffer()));
  assert.equal(strFromU8(attachments['attachments/说明.txt']), '附件正文');
  const bundle = renderBundle(['markdown','html','attachments'], memory);
  assert.ok(bundle.entries.some(entry => entry.name === 'attachments/说明.txt'));
});

test('内存素材保留路径规范、大小写和Unicode冲突检查，不能覆盖正文', async () => {
  const empty = new Uint8Array();
  for (const assets of [
    [{path:'../outside.txt',bytes:empty}], [{path:'images/../outside.txt',bytes:empty}],
    [{path:'/images/a.png',bytes:empty}], [{path:'files/a.txt',bytes:empty}],
    [{path:'images/con.png',bytes:empty}], [{path:'document.html',bytes:empty}],
    [{path:'images/A.png',bytes:empty},{path:'images/a.png',bytes:empty}],
    [{path:'attachments/e\u0301.txt',bytes:empty},{path:'attachments/é.txt',bytes:empty}],
    [{path:'images/a',bytes:empty},{path:'images/a/b.png',bytes:empty}],
  ]) await assert.rejects(parts('<p>正文</p>',assets), {code:'invalid_input',message:/采集内容|素材路径/});
});

test('内存入口按UTF8字节限制正文并沿用素材数量与容量限制', async () => {
  const {limits} = importer;
  await assert.rejects(parts('中'.repeat(Math.floor(limits.html / 3) + 1)), {code:'input_limit',message:/采集内容/});
  await assert.rejects(parts(new Uint8Array(limits.html + 1)), {code:'input_limit'});
  await assert.rejects(parts('<p>正文</p>', [{path:'attachments/large.bin',bytes:new Uint8Array(limits.entry + 1)}]), {code:'input_limit'});
  const large = new Uint8Array(17 * 1024 * 1024);
  await assert.rejects(parts('<p>正文</p>', [0,1,2].map(i => ({path:'attachments/'+i+'.bin',bytes:large}))), {code:'input_limit'});
  await assert.rejects(parts('<p>正文</p>', Array.from({length:limits.entries}, (_, i) => ({path:'attachments/'+i+'.txt',bytes:new Uint8Array()}))), {code:'input_limit'});
});

test('内存入口保持UTF8、BOM与HTML结构限制', async () => {
  await assert.rejects(parts(new Uint8Array([0xff])), {code:'invalid_encoding'});
  await assert.rejects(parts('<div>'.repeat(110) + '正文' + '</div>'.repeat(110)), {code:'html_limit'});
  const withBom = await parts(strToU8('\ufeff<h1>标题</h1><p>正文</p>'));
  assert.deepEqual(withBom, await parts('<h1>标题</h1><p>正文</p>'));
});

test('内存图片仍校验PNG数据块CRC，尺寸合法也不能放过损坏图片', async () => {
  const damaged = png.slice();
  damaged[41] ^= 1;
  const snapshot = await parts('<img src="images/damaged.png">', [{path:'images/damaged.png',bytes:damaged}]);
  assert.deepEqual(snapshot.warnings, [{code:'invalid_image',label:'images/damaged.png'}]);
  assert.deepEqual(snapshot.blocks, [{tag:'span',children:['[无效图片]']}]);
  assert.equal(snapshot.assets[0].type, 'application/octet-stream');
});

test('内存入口在异步图片验证前取得独立素材快照', async () => {
  const backing = Buffer.concat([Buffer.from([0]), Buffer.from(png), Buffer.from([0])]);
  const bytes = backing.subarray(1, -1);
  const html = strToU8('<h1>快照</h1><img src="images/a.png"><a href="attachments/a.txt">说明</a>');
  const note = strToU8('original');
  const assets = [{path:'images/a.png',bytes}, {path:'attachments/a.txt',bytes:note}];
  const pending = parts(html, assets);
  backing.fill(0); note.fill(0); html.fill(0); assets[0].path = 'images/changed.png'; assets.push({path:'attachments/new.txt',bytes:note});
  const snapshot = await pending;
  assert.deepEqual(snapshot.assets.find(asset => asset.path === 'images/a.png').bytes, png);
  assert.equal(new TextDecoder().decode(snapshot.assets.find(asset => asset.path === 'attachments/a.txt').bytes), 'original');
  assert.equal(snapshot.assets.length, 2);
  assert.equal(snapshot.title, '快照');
});

test('重新导入只跳过导出器的导航，普通nav正文仍保留', async () => {
  const html = '<h1>导航往返</h1><nav data-feishu-export-navigation="1"><p>生成目录</p></nav>' +
    '<nav><p>普通导航</p></nav><nav data-feishu-export-navigation="0"><p>保留标记</p></nav>';
  const memory = await parts(html);
  const content = JSON.stringify(memory.blocks);
  assert.doesNotMatch(content, /生成目录/);
  assert.match(content, /普通导航/);
  assert.match(content, /保留标记/);
});

test('内存表格以有限字段保留列宽和单元格样式，HTML 往返比例不漂移', async () => {
  const html = '<h1>样式表格</h1><table><colgroup><col width="1"><col width="2"><col width="3"></colgroup>' +
    '<tr><td style="background-color:#123;color:rgb(255,255,255);text-align:center;vertical-align:bottom;position:fixed">甲</td>' +
    '<td>乙</td><td>丙</td></tr></table>';
  const memory = await parts(html);
  const table = memory.blocks[1];
  assert.deepEqual(table.columnWidths, [1667,3333,5000]);
  assert.deepEqual(table.children[0].children[0].children[0], {
    tag:'td',children:['甲'],background:'#112233',color:'#ffffff',align:'center',valign:'bottom',
  });
  const output = await (await renderFile('html', memory)).blob.text();
  const reimported = await parts(output);
  function findTable(nodes) {
    for (const node of nodes) if (typeof node === 'object') {
      if (node.tag === 'table') return node;
      const found = findTable(node.children ?? []);
      if (found) return found;
    }
  }
  assert.deepEqual(findTable(reimported.blocks), table);
  assert.doesNotMatch(output, /position:fixed/u);
});
