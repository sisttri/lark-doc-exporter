import assert from 'node:assert/strict';
import test from 'node:test';
import { parse } from 'parse5';
import { convertCapture, imageHtmlPath } from '../src/feishu.js';
import { visibleTags } from '../src/importer.js';

const ALLOWED_TAGS = new Set([...visibleTags, 'html', 'head', 'body', 'title', 'meta']);

// ---------- 合成 fixture 辅助 ----------

const aceLine = (inner) => '<div class="ace-line" data-node="true" dir="auto">' + inner + '</div>';

const textBlock = (id, lines) => ({
  id,
  type: 'text',
  html: '<div class="block docx-text-block" data-block-type="text" data-block-id="' + id + '">' +
    '<div class="text-block"><div class="zone-container">' +
    lines.map(aceLine).join('') + '</div></div></div>',
});

const headingBlock = (id, level, inner, order) => ({
  id,
  type: 'heading' + level,
  html: '<div class="block docx-heading' + level + '-block" data-block-type="heading' + level +
    '" data-block-id="' + id + '"><div class="heading-block"><div class="heading heading-h' + level + '">' +
    (order ? '<div class="heading-order orderUnedit" contenteditable="false">' + order + '</div>' : '') +
    '<div class="heading-content"><div class="zone-container">' + aceLine(inner) +
    '</div></div></div></div></div>',
});

const listBlock = (id, type, inner, order) => ({
  id,
  type,
  html: '<div class="block docx-' + type + '-block" data-block-type="' + type + '" data-block-id="' +
    id + '"><div class="list-wrapper ' + type + '-list"><div class="list">' +
    (type === 'ordered'
      ? '<div class="order orderUnedit" contenteditable="false">' + (order ?? '1.') + '</div>'
      : '<div class="bullet bulletUnedit"><div class="bullet-dot-style">•</div></div>') +
    '<div class="list-content"><div class="zone-container">' + aceLine(inner) +
    '</div></div></div></div></div>',
});

const codeBlock = (id, language) => ({
  id,
  type: 'code',
  html: '<div class="block docx-code-block" data-block-type="code" data-block-id="' + id + '">' +
    '<div class="docx-code-block-container"><div class="code-block"><div class="code-block-header">' +
    '<div class="code-block-header-toolbar"><span class="code-block-header-btn-con">' +
    (language === undefined
      ? ''
      : '<button class="code-block-header-btn code-block-header-btn-disable" type="button"><span>' +
        language + '</span></button>') +
    '</span></div><div class="code-block-content"><div class="zone-container">' +
    aceLine('<span>DOM 里的代码文本不应被采用</span>') +
    '</div></div></div></div></div>',
});

const imageBlock = (id, alt) => ({
  id,
  type: 'image',
  html: '<div class="block docx-image-block" data-block-type="image" data-block-id="' + id + '">' +
    '<div class="image-block"><div class="img"><img alt="' + alt +
    '" src="https://example.invalid/assets/' + id + '.png"></div></div></div>',
});

const cellTextBlock = (id, inner) => ({
  id,
  type: 'text',
  html: '<div class="block docx-text-block" data-block-type="text" data-block-id="' + id + '">' +
    '<div class="text-block"><div class="zone-container">' + aceLine(inner) +
    '</div></div></div>',
});

const cellHtml = (tag, attributes, inner) => '<' + tag + attributes + '>' + inner + '</' + tag + '>';

const tableBlock = (id, rowsHtml) => ({
  id,
  type: 'table',
  html: '<div class="block docx-table-block" data-block-type="table" data-block-id="' + id + '">' +
    '<div><table class="table"><tbody>' + rowsHtml + '</tbody></table></div></div>',
});

const quoteBlock = (id, type, lines) => ({
  id,
  type,
  html: '<div class="block docx-' + type + '-block" data-block-type="' + type + '" data-block-id="' +
    id + '"><div class="' + type + '"><div class="zone-container">' +
    lines.map(aceLine).join('') + '</div></div></div>',
});

const todoBlock = (id, inner, stateClass) => ({
  id,
  type: 'todo',
  html: '<div class="block docx-todo-block" data-block-type="todo" data-block-id="' + id + '">' +
    '<div class="todo-block"><div class="todo-checkbox ' + (stateClass ?? '') + '"></div>' +
    '<div class="zone-container">' + aceLine(inner) + '</div></div></div>',
});

const dividerBlock = (id) => ({
  id,
  type: 'divider',
  html: '<div class="block docx-divider-block" data-block-type="divider" data-block-id="' + id +
    '"><div class="divider"></div></div>',
});

function captureOf(blocks, extra = {}) {
  return {
    version: 1,
    generator: 'test',
    source: { href: 'https://example.invalid/doc', title: '测试文档' },
    pageBlockId: '1',
    blocks,
    code: {},
    images: [],
    warnings: [],
    ...extra,
  };
}

// ---------- 解析 / 断言辅助 ----------

function walkElements(node, visit) {
  if (typeof node.tagName === 'string') visit(node);
  for (const child of node.childNodes ?? []) walkElements(child, visit);
}

function parsed(html) {
  return parse(html);
}

function elements(htmlOrNode, tag) {
  const node = typeof htmlOrNode === 'string' ? parsed(htmlOrNode) : htmlOrNode;
  const result = [];
  walkElements(node, (element) => {
    if (element.tagName === tag) result.push(element);
  });
  return result;
}

function attrOf(node, name) {
  return node.attrs?.find((item) => item.name === name)?.value ?? '';
}

function textOf(node) {
  if (node.nodeName === '#text') return node.value ?? '';
  return (node.childNodes ?? []).map(textOf).join('');
}

function tagsOf(html) {
  const result = [];
  walkElements(parsed(html), (element) => result.push(element.tagName));
  return result;
}

function assertAllowedTags(html) {
  for (const tag of tagsOf(html)) {
    assert.ok(ALLOWED_TAGS.has(tag), '输出了不被允许的标签：' + tag);
  }
  walkElements(parsed(html), node => {
    for (const { name } of node.attrs) assert.doesNotMatch(name, /^on/iu);
  });
}

function bodyOf(html) {
  const root = parsed(html).childNodes.find((node) => node.tagName === 'html');
  return root.childNodes.find((node) => node.tagName === 'body');
}

function firstHeading(html) {
  return elements(html, 'h1')[0];
}

// ---------- 文档外壳 ----------

test('输出完整 HTML 文档外壳，标题来自 source.title 且按需转义', () => {
  const result = convertCapture(captureOf([textBlock('2', ['正文'])], {
    source: { href: 'https://example.invalid/doc', title: '测试 & <标题> "引号"' },
  }));
  assert.equal(result.title, '测试 & <标题> "引号"');
  assert.match(result.html, /^<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8"><title>/u);
  const document = parsed(result.html);
  assert.equal(document.childNodes[0].nodeName, '#documentType');
  assert.equal(document.childNodes[0].name, 'html');
  const root = document.childNodes.find((node) => node.tagName === 'html');
  assert.equal(attrOf(root, 'lang'), 'zh-CN');
  const head = root.childNodes.find((node) => node.tagName === 'head');
  const meta = head.childNodes.find((node) => node.tagName === 'meta');
  assert.equal(attrOf(meta, 'charset'), 'utf-8');
  const title = head.childNodes.find((node) => node.tagName === 'title');
  assert.equal(textOf(title), '测试 & <标题> "引号"');
  const body = bodyOf(result.html);
  assert.equal(body.childNodes.find((node) => node.tagName === 'h1')?.tagName, 'h1');
  assert.equal(textOf(firstHeading(result.html)), '测试 & <标题> "引号"');
  assert.match(result.html, /<title>测试 &amp; &lt;标题&gt; &quot;引号&quot;<\/title>/u);
  assert.equal(body.childNodes.filter((node) => node.tagName === 'p').length, 1);
  assertAllowedTags(result.html);
});

test('source.title 为空或缺失时回退为「文档」，空 capture 也能生成合法外壳', () => {
  assert.equal(convertCapture(captureOf([], { source: { title: '' } })).title, '文档');
  const result = convertCapture({ blocks: [] });
  assert.equal(result.title, '文档');
  assert.deepEqual(result.warnings, []);
  assert.match(result.html, /<h1>文档<\/h1>/u);
  assertAllowedTags(result.html);
});

test('非法 capture 输入抛出 TypeError', () => {
  assert.throws(() => convertCapture(null), TypeError);
  assert.throws(() => convertCapture({}), TypeError);
});

// ---------- 标题 ----------

test('heading1..6 映射为 hN，heading-order 编号前缀、标题内粗体去重', () => {
  const result = convertCapture(captureOf([
    headingBlock('2', 1, '<span style="font-weight:bold;">一级标题</span>'),
    headingBlock('3', 2, '<span style="font-weight:bold;">二级标题</span>', '1.'),
    headingBlock('4', 3, '<span style="font-weight:bold;">三级标题</span>', '2.1'),
    headingBlock('5', 4, '<span style="font-weight:bold;">四级标题</span>'),
    headingBlock('6', 5, '<span style="font-weight:bold;">五级标题</span>'),
    headingBlock('7', 6, '<span style="font-weight:bold;">六级标题</span>'),
  ]));
  for (const level of [1, 2, 3, 4, 5, 6]) {
    assert.equal(elements(result.html, 'h' + level).length, level === 1 ? 2 : 1);
  }
  assert.match(result.html, /<h2>1\. 二级标题<\/h2>/u);
  assert.match(result.html, /<h3>2\.1 三级标题<\/h3>/u);
  // 飞书标题默认加粗：标题内不应再出现 <strong>。
  for (const heading of elements(result.html, 'h2')) assert.equal(elements(heading, 'strong').length, 0);
  assertAllowedTags(result.html);
});

test('标题内其余行内样式仍然保留', () => {
  const result = convertCapture(captureOf([
    headingBlock('2', 2, '<span style="font-style: italic;">斜体</span>' +
      '<span style="text-decoration: underline;">下划线</span>', '3.'),
  ]));
  const heading = elements(result.html, 'h2')[0];
  assert.equal(heading.tagName, 'h2');
  assert.match(result.html, /<h2>3\. <em>斜体<\/em><u>下划线<\/u><\/h2>/u);
  assertAllowedTags(result.html);
});

// ---------- 文本与内联 ----------

test('text 多行用 br、空行与纯零宽段落丢弃、字符全部转义', () => {
  const result = convertCapture(captureOf([
    textBlock('2', [
      'A &amp; B &lt;tag&gt; &quot;quote&quot; &#39;apostrophe&#39;',
      '<span>\u200b</span>',
      '第二行',
    ]),
    textBlock('3', ['<span>\u200b</span>']),
  ]));
  const paragraphs = elements(result.html, 'p');
  assert.equal(paragraphs.length, 1);
  assert.equal(textOf(paragraphs[0]),
    'A & B <tag> "quote" \'apostrophe\'第二行');
  assert.match(result.html,
    /A &amp; B &lt;tag&gt; &quot;quote&quot; &#39;apostrophe&#39;<br>第二行/u);
  assert.doesNotMatch(result.html, /\u200b/u);
  assertAllowedTags(result.html);
});

test('内联样式、链接与行内表情递归转换', () => {
  const result = convertCapture(captureOf([
    textBlock('2', [
      '<span style="font-weight:bold;">粗体</span>' +
      '<span style="font-style: italic;">斜体</span>' +
      '<span style="text-decoration: underline;">下划线</span>' +
      '<span style="text-decoration: line-through;">删除线</span>' +
      '<span style="font-weight: bold; text-decoration: line-through;">双样式</span>' +
      '<a href="https://example.org/path?q=one&amp;x=2">网页</a>' +
      '<a href="mailto:dev@example.org">邮件</a>' +
      '<a href="javascript:alert(1)">脚本链接</a>' +
      '<a href="/relative">相对链接</a>' +
      '<img alt="表情" src="https://example.invalid/emoji.png">',
    ]),
  ]));
  assert.match(result.html, /<strong>粗体<\/strong>/u);
  assert.match(result.html, /<em>斜体<\/em>/u);
  assert.match(result.html, /<u>下划线<\/u>/u);
  assert.match(result.html, /<s>删除线<\/s>/u);
  assert.match(result.html, /<strong><s>双样式<\/s><\/strong>/u);
  const links = elements(result.html, 'a');
  assert.equal(links.length, 2);
  assert.deepEqual(links.map((link) => attrOf(link, 'href')), [
    'https://example.org/path?q=one&x=2',
    'mailto:dev@example.org',
  ]);
  assert.doesNotMatch(result.html, /javascript:|relative/iu);
  assert.match(result.html, /脚本链接相对链接表情/u);
  assertAllowedTags(result.html);
});

// ---------- 列表 ----------

test('连续 bullet/ordered 分组为 ul/ol，中断即分组，首个编号非 1 时输出 start', () => {
  const result = convertCapture(captureOf([
    listBlock('10', 'bullet', '一'),
    listBlock('11', 'bullet', '二'),
    textBlock('12', ['分隔']),
    listBlock('13', 'bullet', '三'),
    listBlock('20', 'ordered', '甲', '1.'),
    listBlock('21', 'ordered', '乙', '2.'),
    textBlock('22', ['再分隔']),
    listBlock('30', 'ordered', '丙', '2.'),
    listBlock('31', 'ordered', '丁', '3.'),
    listBlock('32', 'bullet', '四'),
  ]));
  const lists = elements(result.html, 'ul');
  assert.equal(lists.length, 3);
  assert.equal(elements(result.html, 'ol').length, 2);
  const texts = (tag) => elements(result.html, tag).map((list) =>
    elements(list, 'li').map((item) => textOf(item)));
  assert.deepEqual(texts('ul'), [['一', '二'], ['三'], ['四']]);
  const ordered = elements(result.html, 'ol');
  assert.deepEqual(elements(ordered[0], 'li').map((item) => textOf(item)), ['甲', '乙']);
  assert.equal(attrOf(ordered[0], 'start'), '');
  assert.deepEqual(elements(ordered[1], 'li').map((item) => textOf(item)), ['丙', '丁']);
  assert.equal(attrOf(ordered[1], 'start'), '2');
  assertAllowedTags(result.html);
});

// ---------- 代码块 ----------

test('code 块取 capture.code 行并按 num 排序，语言规范化，DOM 文本忽略', () => {
  const result = convertCapture(captureOf([
    codeBlock('40', 'YAML'),
    codeBlock('41', 'Plain Text'),
    codeBlock('42', 'C++'),
    codeBlock('43', 'ProtoBuf'),
  ], {
    code: {
      40: { lines: [{ num: 2, text: 'b: "<2>"' }, { num: 1, text: 'a: & 1' }] },
      41: { lines: [{ num: 1, text: 'plain' }] },
      42: { lines: [{ num: 1, text: 'int main() {}' }] },
      43: { lines: [{ num: 1, text: 'message A {}' }] },
    },
  }));
  const codes = elements(result.html, 'code');
  assert.equal(codes.length, 4);
  assert.equal(attrOf(codes[0], 'class'), 'language-yaml');
  assert.equal(textOf(codes[0]), 'a: & 1\nb: "<2>"');
  assert.equal(attrOf(codes[1], 'class'), 'language-text');
  assert.equal(attrOf(codes[2], 'class'), 'language-cpp');
  assert.equal(attrOf(codes[3], 'class'), 'language-protobuf');
  assert.doesNotMatch(result.html, /DOM 里的代码文本不应被采用/u);
  assert.equal(elements(result.html, 'pre').length, 4);
  assertAllowedTags(result.html);
});

test('代码块缺失行、缺失语言、缺失 capture.code 时的行为与 warning', () => {
  const result = convertCapture(captureOf([
    codeBlock('50', 'Bash'),
    codeBlock('51'),
    codeBlock('52', 'JSON'),
  ], {
    code: {
      50: { lines: [{ num: 1, text: 'echo ok' }] },
      51: { lines: [{ num: 1, text: 'no language header' }] },
    },
  }));
  const codes = elements(result.html, 'code');
  assert.equal(codes.length, 2);
  assert.equal(attrOf(codes[1], 'class'), '');
  assert.deepEqual(result.warnings, [{ code: 'missing_code', label: '代码块 52 缺少内容' }]);
  assertAllowedTags(result.html);
});

test('缺失的首行与中间行在源位置写出范围，已采集的代码片段保持原文', () => {
  const result = convertCapture(captureOf([codeBlock('51', 'YAML')], {
    code: { 51: { lines: [
      { num: 7, text: '  second' }, { num: 3, text: 'first' }, { num: 4, text: '' },
    ] } },
  }));
  assert.deepEqual(result.warnings, [
    { code: 'code_lines_missing', label: '代码块 51 缺少第 1–2 行' },
    { code: 'code_lines_missing', label: '代码块 51 缺少第 5–6 行' },
  ]);
  assert.deepEqual(elements(result.html, 'code').map(textOf), ['first\n', '  second']);
  assert.deepEqual(bodyOf(result.html).childNodes.map(node => node.tagName), ['h1','p','pre','p','pre']);
});

test('明确的总行数可判定尾部缺行，旧采集器的缺行摘要由逐段定位结果替代', () => {
  const result = convertCapture(captureOf([codeBlock('52')], {
    code: { 52: { totalLines: 4, lines: [{ num: 2, text: 'only line' }] } },
    warnings: [{ code: 'code_lines_missing', label: '代码块 52 缺少行 1' }],
  }));
  assert.deepEqual(result.warnings.map(item => item.label), ['代码块 52 缺少第 1 行', '代码块 52 缺少第 3–4 行']);
  assert.deepEqual(elements(result.html, 'code').map(textOf), ['only line']);
});

// ---------- 表格 ----------

test('table 保持行/单元格文档顺序，合并单元格属性、单元格内多块内容', () => {
  const rows =
    '<tr>' +
    cellHtml('td', ' rowspan="1" colspan="2"',
      cellTextBlock('501', '第一行 甲 &amp; 乙').html) +
    '</tr>' +
    '<tr>' +
    cellHtml('td', ' rowspan="2" colspan="1"',
      cellTextBlock('502', '第二行左').html + cellTextBlock('503', '第二行左续').html) +
    cellHtml('td', '',
      '<div class="block docx-code-block" data-block-type="code" data-block-id="504">' +
      '<button class="code-block-header-btn" type="button"><span>YAML</span></button></div>') +
    '</tr>';
  const result = convertCapture(captureOf([
    tableBlock('60', rows),
  ], { code: { 504: { lines: [{ num: 1, text: 'x = 1' }] } } }));
  const tables = elements(result.html, 'table');
  assert.equal(tables.length, 1);
  const table = tables[0];
  const tableRows = elements(table, 'tr');
  assert.equal(tableRows.length, 2);
  // 行顺序必须与 HTML 源一致（不能反转）。
  assert.deepEqual(tableRows.map((row) => textOf(row)), [
    '第一行 甲 & 乙',
    '第二行左第二行左续x = 1',
  ]);
  const firstRowCells = tableRows[0].childNodes.filter((node) => node.tagName === 'td' || node.tagName === 'th');
  assert.equal(firstRowCells.length, 1);
  assert.equal(attrOf(firstRowCells[0], 'colspan'), '2');
  assert.equal(attrOf(firstRowCells[0], 'rowspan'), '');
  const secondRowCells = tableRows[1].childNodes.filter((node) => node.tagName === 'td');
  assert.equal(secondRowCells.length, 2);
  assert.equal(attrOf(secondRowCells[0], 'rowspan'), '2');
  assert.equal(attrOf(secondRowCells[0], 'colspan'), '');
  assert.equal(textOf(secondRowCells[0]), '第二行左第二行左续');
  assert.match(result.html, /<td rowspan="2">第二行左<br>第二行左续<\/td>/u);
  assert.equal(elements(secondRowCells[1], 'pre').length, 1);
  assert.match(result.html, /<td><pre><code class="language-yaml">x = 1<\/code><\/pre><\/td>/u);
  assert.doesNotMatch(result.html, /<td[^>]*><p>/u);
  assert.doesNotMatch(result.html, /colspan="1"|rowspan="1"/u);
  assertAllowedTags(result.html);
});

test('table 单元格按顺序输出多行多列，且无表头时全部是 td', () => {
  const rows = [
    ['r1c1', 'r1c2'],
    ['r2c1', 'r2c2'],
  ].map((cells) => '<tr>' + cells.map((text) => cellHtml('td', '', text)).join('') + '</tr>').join('');
  const result = convertCapture(captureOf([tableBlock('61', rows)]));
  const tableRows = elements(result.html, 'tr');
  assert.deepEqual(tableRows.map((row) => textOf(row)), ['r1c1r1c2', 'r2c1r2c2']);
  assert.deepEqual(elements(result.html, 'td').map((cell) => textOf(cell)),
    ['r1c1', 'r1c2', 'r2c1', 'r2c2']);
  assert.equal(elements(result.html, 'th').length, 0);
  assertAllowedTags(result.html);
});

test('table 合并单元格跳过显式隐藏占位，保留合法空格及 display:table-cell', () => {
  const result = convertCapture(captureOf([tableBlock('ghost-cells',
    '<tr><td rowspan="2" colspan="2">合并</td><td>甲</td></tr>' +
    '<tr><td style="display:none;">隐藏占位一</td><td hidden>隐藏占位二</td><td>乙</td></tr>' +
    '<tr><th aria-hidden="true">隐藏占位三</th><td style="DISPLAY: none !important">隐藏占位四</td>' +
    '<td style="display:table-cell">丙</td><td> </td><td aria-hidden="false">丁</td></tr>',
  )]));
  const rows = elements(result.html, 'tr');
  const cells = rows.map(row => row.childNodes.filter(node => node.tagName === 'td' || node.tagName === 'th'));
  assert.deepEqual(cells.map(row => row.map(textOf)), [['合并','甲'],['乙'],['丙',' ','丁']]);
  assert.equal(attrOf(cells[0][0], 'rowspan'), '2');
  assert.equal(attrOf(cells[0][0], 'colspan'), '2');
  assert.doesNotMatch(result.html, /隐藏占位|display:none/u);
  assertAllowedTags(result.html);
});

test('table 隐藏占位遵循最终 display 声明与 important 优先级，未知值保守保留', () => {
  const source = [
    ['display:none;display:table-cell', 'VISIBLE_OVERRIDE'],
    ['display:table-cell;display:none', 'HIDDEN_LAST'],
    ['display:none!important;display:table-cell', 'HIDDEN_IMPORTANT'],
    ['display:none;display:table-cell ! important', 'VISIBLE_IMPORTANT'],
    ['display:none!important;display:table-cell!important', 'VISIBLE_IMPORTANT_LAST'],
    ['display:table-cell!important;display:none', 'VISIBLE_IMPORTANT_FIRST'],
    ['display:none;display:var(--cell-display)', 'UNKNOWN_DISPLAY'],
    ['background-color:#123;color:#fff', 'UNRELATED_CSS'],
    ['display:table-cell;--note:&quot;;display:none;&quot;', 'UNRELATED_QUOTED_CSS'],
    ['background-color:rgb(1,2,3);display:none', 'HIDDEN_WITH_FUNCTION'],
    ['display:table-cell', ' '],
  ];
  const row = source.map(([style, label]) => '<td style="' + style + '">' + label + '</td>').join('');
  const result = convertCapture(captureOf([tableBlock('display-cascade', '<tr>' + row + '</tr>')]));
  assert.deepEqual(elements(result.html, 'td').map(textOf), [
    'VISIBLE_OVERRIDE','VISIBLE_IMPORTANT','VISIBLE_IMPORTANT_LAST','VISIBLE_IMPORTANT_FIRST',
    'UNKNOWN_DISPLAY','UNRELATED_CSS','UNRELATED_QUOTED_CSS',' ',
  ]);
  assert.doesNotMatch(result.html, /HIDDEN_LAST|HIDDEN_IMPORTANT|HIDDEN_WITH_FUNCTION/u);
});

test('table 保留列宽比例和单元格底色、文字对比及对齐，丢弃其他 CSS', () => {
  const result = convertCapture(captureOf([{
    id:'styled-table',type:'table',html:'<div><table>' +
      '<colgroup><col style="width:80px"><col span="2" width="120"></colgroup>' +
      '<tr><td colspan="2" style="background-color:rgb(12,34,56);color:#fff;text-align:right;vertical-align:middle;position:fixed;background-image:url(https://bad.invalid/x)">深色</td>' +
      '<td align="center" valign="bottom" bgcolor="#abc">末格</td></tr></table></div>',
  }]));
  assert.match(result.html, /<table style="table-layout:fixed;width:100%;overflow-wrap:anywhere"><colgroup><col style="width:25%"><col style="width:37.5%"><col style="width:37.5%"><\/colgroup>/u);
  assert.match(result.html, /<td colspan="2" style="background-color:#0c2238;color:#ffffff;text-align:right;vertical-align:middle">深色<\/td>/u);
  assert.match(result.html, /<td style="background-color:#aabbcc;text-align:center;vertical-align:bottom">末格<\/td>/u);
  assert.doesNotMatch(result.html, /position:|background-image:|bad\.invalid/u);
});

test('table 跳过固定表头副本，在根级、引用和单元格引用中保留正文表格完整行与样式', () => {
  const table = {id:'main-with-sticky',type:'table',html:'<div data-block-type="table" data-block-id="main-with-sticky">' +
    '<table class="table sticky-row-wrapper"><tr><td data-block-id="header-a">正文标题一<table><tr><td>STICKY_NESTED</td></tr></table></td><td data-block-id="header-b">正文标题二</td></tr></table>' +
    '<table class="table header-row"><colgroup><col width="1"><col width="3"></colgroup>' +
    '<tr><th data-block-id="header-a">正文标题一</th><th data-block-id="header-b">正文标题二</th></tr>' +
    '<tr><td style="background-color:#123;color:#fff;text-align:center;vertical-align:middle">正文甲</td><td>正文乙</td></tr>' +
    '<tr><td>正文丙</td><td>正文丁</td></tr></table></div>'};
  const reference = {id:'sticky-reference',type:'synced_reference',html:
    '<div data-block-type="synced_reference" data-block-id="sticky-reference">' + table.html + '</div>'};
  const outer = tableBlock('sticky-cell', '<tr><td>' + reference.html + '</td></tr>');
  for (const [block, count] of [[table,1], [reference,1], [outer,2]]) {
    const result = convertCapture(captureOf([block]));
    const tables = elements(result.html, 'table');
    assert.equal(tables.length, count);
    const main = tables.at(-1);
    assert.deepEqual(elements(main, 'tr').map(textOf), ['正文标题一正文标题二','正文甲正文乙','正文丙正文丁']);
    assert.deepEqual(elements(main, 'col').map(col => attrOf(col, 'style')), ['width:25%','width:75%']);
    assert.match(result.html, /<td style="background-color:#112233;color:#ffffff;text-align:center;vertical-align:middle">正文甲<\/td>/u);
    assert.doesNotMatch(result.html, /STICKY_COPY|STICKY_NESTED/u);
  }
});

test('table 独立固定表头按 cell ID 或文本去重，保留 caption、多 tbody 和表头样式', () => {
  const header = '<tr><td data-block-id="header-os" style="background-color:#123;color:#fff;text-align:center;vertical-align:middle">系统</td>' +
    '<td data-block-id="header-count">数量</td></tr>';
  const body = '<tbody><tr><td data-block-id="rocky-os">Rocky</td><td data-block-id="rocky-count">2</td></tr>' +
    '<tr><td data-block-id="ubuntu-os">Ubuntu</td><td data-block-id="ubuntu-count">3</td></tr></tbody>' +
    '<tbody><tr><td data-block-id="total-os">合计</td><td data-block-id="total-count">5</td></tr></tbody>';
  const wrap = main => ({id:'detached-header',type:'table',html:'<div data-block-type="table" data-block-id="detached-header">' +
    '<table class="sticky-row-wrapper"><tbody>' + header + '</tbody></table>' +
    '<table class="table header-row"><caption>系统统计</caption><colgroup><col width="1"><col width="3"></colgroup>' +
    main + '</table></div>'});
  for (const table of [wrap(body), wrap('<tbody>' + header + '</tbody>' + body)]) {
    const result = convertCapture(captureOf([table]));
    const main = elements(result.html, 'table')[0];
    assert.deepEqual(elements(main, 'tr').map(textOf), ['系统数量','Rocky2','Ubuntu3','合计5']);
    assert.equal(elements(main, 'thead').length, 1);
    assert.equal(elements(main, 'tbody').length, 2);
    assert.equal(textOf(elements(main, 'caption')[0]), '系统统计');
    assert.deepEqual(elements(main, 'col').map(col => attrOf(col, 'style')), ['width:25%','width:75%']);
    assert.match(result.html, /<thead><tr><td style="background-color:#112233;color:#ffffff;text-align:center;vertical-align:middle">系统<\/td><td>数量<\/td><\/tr><\/thead>/u);
  }
  const noIds = wrap('<tbody>' + header.replace(/ data-block-id="[^"]+"/gu, '') + '</tbody>' + body);
  assert.deepEqual(elements(convertCapture(captureOf([noIds])).html, 'tr').map(textOf), ['系统数量','Rocky2','Ubuntu3','合计5']);
  const explicit = wrap('<thead><tr><th>主表头一</th><th>主表头二</th></tr></thead>' + body);
  assert.deepEqual(elements(convertCapture(captureOf([explicit])).html, 'tr').map(textOf), ['主表头一主表头二','Rocky2','Ubuntu3','合计5']);
  const detached = wrap(body);
  const reference = {id:'detached-reference',type:'synced_reference',html:
    '<div data-block-type="synced_reference" data-block-id="detached-reference">' + detached.html + '</div>'};
  for (const block of [reference, tableBlock('detached-cell', '<tr><td>' + reference.html + '</td></tr>')]) {
    const main = elements(convertCapture(captureOf([block])).html, 'table').at(-1);
    assert.deepEqual(elements(main, 'tr').map(textOf), ['系统数量','Rocky2','Ubuntu3','合计5']);
    assert.equal(elements(main, 'thead').length, 1);
  }
});

test('table 保留 caption 和 thead/tbody/tfoot，表头内的 td 仍属于 thead', () => {
  const result = convertCapture(captureOf([{
    id: 'sectioned-table',
    type: 'table',
    html: '<div data-block-type="table"><table>' +
      '<caption><span style="font-style:italic">合成摘要 &amp; 数量</span><button>隐藏控件</button></caption>' +
      '<thead><tr><td colspan="2">合成列标题</td></tr></thead>' +
      '<tbody><tr><td rowspan="2">甲</td><td><span style="text-decoration:line-through">旧值</span></td></tr>' +
      '<tr><td>乙</td></tr></tbody>' +
      '<tbody><tr><td>丙</td><td>丁</td></tr></tbody>' +
      '<tfoot><tr><th>合计</th><td>4</td></tr></tfoot>' +
      '</table></div>',
  }]));
  const table = elements(result.html, 'table')[0];
  assert.deepEqual(table.childNodes.filter(node => node.tagName).map(node => node.tagName),
    ['caption', 'thead', 'tbody', 'tbody', 'tfoot']);
  assert.equal(textOf(elements(table, 'caption')[0]), '合成摘要 & 数量');
  assert.match(result.html, /<caption><em>合成摘要 &amp; 数量<\/em><\/caption>/u);
  assert.match(result.html, /<thead><tr><td colspan="2">合成列标题<\/td><\/tr><\/thead>/u);
  assert.match(result.html, /<td rowspan="2">甲<\/td><td><s>旧值<\/s><\/td>/u);
  assert.deepEqual(elements(table, 'tr').map(textOf), ['合成列标题', '甲旧值', '乙', '丙丁', '合计4']);
  assert.deepEqual(result.warnings, []);
  assertAllowedTags(result.html);
});

test('table 只转换所属行组的直接行，不将嵌套表格行提升为外层行', () => {
  const result = convertCapture(captureOf([{
    id: 'nested-table',
    type: 'table',
    html: '<div data-block-type="table"><table>' +
      '<thead><tr><td>外层表头</td></tr></thead>' +
      '<tbody><tr><td>外层单元格<table><thead><tr><td>内层表头</td></tr></thead>' +
      '<tbody><tr><td>内层正文</td></tr></tbody></table></td></tr></tbody>' +
      '<tfoot><tr><td>外层表尾</td></tr></tfoot>' +
      '</table></div>',
  }]));
  const table = elements(result.html, 'table')[0];
  assert.deepEqual(table.childNodes.filter(node => node.tagName).map(node => node.tagName),
    ['thead', 'tbody', 'tfoot']);
  assert.equal(elements(table, 'tr').length, 3);
  assert.equal(elements(table, 'thead').length, 1);
  assert.equal(elements(table, 'tbody').length, 1);
  assert.equal(textOf(elements(table, 'tbody')[0]), '外层单元格内层表头内层正文');
  assertAllowedTags(result.html);
});

// ---------- 图片 ----------

test('image 块按 blockId 关联 capture.images 生成 images/<id>.<ext>', () => {
  const result = convertCapture(captureOf([
    imageBlock('7', '兜底 alt'),
    imageBlock('9', '缺图'),
    imageBlock('10', '不支持类型'),
  ], {
    images: [
      { blockId: '7', alt: '示例 图', file: 'assets/7.png', mime: 'image/png', width: 10, height: 5 },
      { blockId: 10, alt: '', file: 'assets/10.tiff', mime: 'image/tiff', width: 10, height: 5 },
    ],
  }));
  const images = elements(result.html, 'img');
  assert.equal(images.length, 2);
  assert.equal(attrOf(images[0], 'src'), 'images/7.png');
  assert.equal(attrOf(images[0], 'alt'), '示例 图');
  assert.equal(attrOf(images[1], 'src'), 'images/10.png');
  assert.equal(attrOf(images[1], 'alt'), '不支持类型');
  assert.deepEqual(result.warnings.map(({ code }) => code), ['missing_image', 'invalid_image']);
  assert.match(result.warnings.find(({ code }) => code === 'missing_image').label, /9/u);
  assertAllowedTags(result.html);
});

test('imageHtmlPath 按 MIME 映射扩展名，未知 MIME 依次回退 file 后缀与 png', () => {
  assert.equal(imageHtmlPath({ blockId: '7', mime: 'image/png', file: 'assets/7.png' }), 'images/7.png');
  assert.equal(imageHtmlPath({ blockId: '8', mime: 'image/jpeg', file: 'assets/8.jpeg' }), 'images/8.jpg');
  assert.equal(imageHtmlPath({ blockId: '9', mime: 'image/gif', file: 'assets/9.gif' }), 'images/9.gif');
  assert.equal(imageHtmlPath({ blockId: '10', mime: 'image/webp', file: 'assets/10.webp' }), 'images/10.webp');
  assert.equal(imageHtmlPath({ blockId: '11', mime: 'image/jpg' }), 'images/11.jpg');
  assert.equal(imageHtmlPath({ blockId: 12, mime: 'image/tiff', file: 'assets/12.WEBP' }), 'images/12.webp');
  assert.equal(imageHtmlPath({ blockId: 13, mime: 'application/octet-stream' }), 'images/13.png');
  assert.equal(imageHtmlPath({ blockId: '14', mime: 'image/png; charset=binary' }), 'images/14.png');
});

test('whiteboard 已采静态预览在根级、表格与引用中复用图片素材', () => {
  const board = (id) => ({id, type:'whiteboard', html:'<div data-block-type="whiteboard" data-block-id="' + id + '"><svg aria-label="预览控件"><path d="M0 0h1"></path></svg><canvas></canvas></div>'});
  const root = board('7'), cell = board('17'), nested = board('27');
  const result = convertCapture(captureOf([
    root,
    tableBlock('10', '<tr><td>' + cell.html + '</td></tr>'),
    {id:'20', type:'synced_reference', html:'<div data-block-type="synced_reference" data-block-id="20"><div data-block-type="page" data-block-id="21">' + nested.html + '</div></div>'},
  ], {images:['7','17','27'].map(blockId => ({blockId, mime:'image/png', width:20, height:30}))}));
  const images = elements(result.html, 'img');
  assert.deepEqual(images.map(image => attrOf(image, 'src')), ['images/7.png','images/17.png','images/27.png']);
  assert.ok(images.every(image => attrOf(image, 'alt') === '白板静态预览（当前画面）'));
  assert.equal(elements(result.html, 'td')[0].childNodes.filter(node => node.tagName === 'img').length, 1);
  assert.deepEqual(result.warnings, []);
});

test('whiteboard 未采到静态预览时明确提示缺少素材', () => {
  const result = convertCapture(captureOf([{id:'7',type:'whiteboard',html:'<div data-block-type="whiteboard" data-block-id="7"><canvas></canvas></div>'}]));
  assert.equal(elements(result.html, 'img').length, 0);
  assert.deepEqual(result.warnings.map(({code}) => code), ['missing_image']);
  assert.match(result.warnings[0].label, /白板块 7/u);
});

test('diagram 根级、表格与引用复用完整 PNG，不将内部 SVG 误报为行内图形', () => {
  const diagram = id => ({id, type:'diagram', html:'<div data-block-type="diagram" data-block-id="' + id + '"><svg><path d="M0 0h1"></path></svg><svg><text>图形控件</text></svg></div>'});
  const root = diagram('7'), cell = diagram('17'), nested = diagram('27');
  const result = convertCapture(captureOf([
    root,
    tableBlock('10', '<tr><td>' + cell.html + '</td></tr>'),
    {id:'20', type:'synced_reference', html:'<div data-block-type="synced_reference" data-block-id="20"><div data-block-type="page" data-block-id="21">' + nested.html + '</div></div>'},
  ], {images:['7','17','27'].map(blockId => ({blockId, mime:'image/png', width:1200, height:800}))}));
  const images = elements(result.html, 'img');
  assert.deepEqual(images.map(image => attrOf(image, 'src')), ['images/7.png','images/17.png','images/27.png']);
  assert.ok(images.every(image => attrOf(image, 'alt') === '图表'));
  assert.equal(elements(result.html, 'td')[0].childNodes.filter(node => node.tagName === 'img').length, 1);
  assert.doesNotMatch(result.html, /未转换的行内图形|图形控件/u);
  assert.deepEqual(result.warnings, []);
});

test('diagram 无完整 PNG 时保留明确缺图提示，不重复报内部 SVG 或未知块', () => {
  const result = convertCapture(captureOf([{id:'7',type:'diagram',html:'<div data-block-type="diagram" data-block-id="7"><svg><path d="M0 0h1"></path></svg><svg><path d="M1 1h2"></path></svg></div>'}]));
  assert.equal(elements(result.html, 'img').length, 0);
  assert.deepEqual(result.warnings.map(({code}) => code), ['missing_image']);
  assert.match(result.warnings[0].label, /图表块 7.*缺少素材/u);
});

// ---------- 引用 / 分割线 / 待办 ----------

test('quote、callout、divider、todo 映射为 blockquote/hr/待办段落', () => {
  const result = convertCapture(captureOf([
    quoteBlock('70', 'quote', ['引用内容']),
    quoteBlock('71', 'callout', ['提示内容']),
    dividerBlock('72'),
    todoBlock('73', '待办一'),
    todoBlock('74', '待办二', 'todo-checkbox-checked'),
    todoBlock('75', '待办三', 'is-done'),
    todoBlock('76', '待办四', 'unchecked'),
  ]));
  const quotes = elements(result.html, 'blockquote');
  assert.equal(quotes.length, 2);
  assert.equal(textOf(quotes[0]), '引用内容');
  assert.equal(textOf(quotes[1]), '提示内容');
  assert.equal(elements(result.html, 'hr').length, 1);
  const paragraphs = bodyOf(result.html).childNodes
    .filter((node) => node.tagName === 'p').map((item) => textOf(item));
  assert.deepEqual(paragraphs, ['☐ 待办一', '☑ 待办二', '☑ 待办三', '☐ 待办四']);
  assertAllowedTags(result.html);
});

// ---------- 未知块 / warning / 确定性 ----------

test('未支持的块按位置记录，多个同类块可以分别定位', () => {
  const result = convertCapture(captureOf([
    { id: '80', type: 'databaseview', html: '<div class="block docx-databaseview-block"></div>' },
    { id: '81', type: 'databaseview', html: '<div class="block docx-databaseview-block"></div>' },
    { id: '82', type: 'file', html: '<div class="block docx-file-block"></div>' },
    { id: '83', type: 'text', html: '' },
    textBlock('84', ['正常内容']),
  ]));
  // 解析阶段（无法解析的块）先于渲染阶段的 warning。
  assert.deepEqual(result.warnings, [
    { code: 'unsupported_block', label: '块 83 无法解析' },
    { code: 'unsupported_block', label: '块 80 未转换（databaseview）' },
    { code: 'unsupported_block', label: '块 81 未转换（databaseview）' },
    { code: 'missing_attachment', label: '附件块 82 原件未采集，仅保留文件名和可用链接' },
  ]);
  assert.match(result.html, /正常内容/u);
  assertAllowedTags(result.html);
});

test('capture.warnings 被规范化后前置保留，整体输出确定且无时间戳', () => {
  const capture = captureOf([textBlock('2', ['正文'])], {
    warnings: [
      { code: 'code_lines_missing', label: '代码块 40 缺少行 2' },
      { code: 'image_download_failed', label: '图片块 9：超时' },
      { code: '', label: '空 code 丢弃' },
      null,
      'bad',
    ],
  });
  const first = convertCapture(capture);
  const second = convertCapture(capture);
  assert.deepEqual(first, second);
  assert.deepEqual(first.warnings, [
    { code: 'code_lines_missing', label: '代码块 40 缺少行 2' },
    { code: 'image_download_failed', label: '图片块 9：超时' },
  ]);
  assert.equal(JSON.stringify(first), JSON.stringify(second));
  assert.doesNotMatch(first.html, /\d{4}-\d{2}-\d{2}T/u);
  assert.doesNotMatch(JSON.stringify(first.warnings), /\d{4}-\d{2}-\d{2}T/u);
  assertAllowedTags(first.html);
});

// ---------- 综合白名单与结构 ----------

test('综合所有块类型的输出标签全部在白名单内，body 以 h1 开头', () => {
  const capture = captureOf([
    headingBlock('2', 1, '<span style="font-weight:bold;">总标题</span>'),
    headingBlock('3', 2, '<strong>加粗子标题</strong>', '1.'),
    textBlock('4', [
      '<span style="font-weight:bold;">粗</span><span style="font-style:italic;">斜</span>' +
      '<span style="text-decoration: underline;">线</span><s>删</s>' +
      '<a href="https://example.org/?a=1&amp;b=2">链接</a><img alt="图" src="https://example.invalid/i.png">',
      '第二行',
    ]),
    listBlock('5', 'bullet', '项目一'),
    listBlock('6', 'bullet', '项目二'),
    listBlock('7', 'ordered', '步骤一', '1.'),
    listBlock('8', 'ordered', '步骤二', '2.'),
    codeBlock('9', 'Python'),
    imageBlock('10', '配图'),
    tableBlock('11', '<tr>' + cellHtml('td', ' colspan="2"', '合并单元格') + '</tr>'),
    quoteBlock('12', 'quote', ['引用']),
    quoteBlock('13', 'callout', ['提示']),
    dividerBlock('14'),
    todoBlock('15', '待办'),
    { id: '16', type: 'unknown-widget', html: '<div class="block"></div>' },
  ], {
    code: { 9: { lines: [{ num: 1, text: 'print("hi")' }] } },
    images: [{ blockId: '10', alt: '配图', file: 'assets/10.png', mime: 'image/png', width: 2, height: 2 }],
    warnings: [{ code: 'code_lines_missing', label: '历史提示' }],
  });
  const result = convertCapture(capture);
  assertAllowedTags(result.html);
  const body = bodyOf(result.html);
  const first = body.childNodes.find((node) => typeof node.tagName === 'string');
  assert.equal(first.tagName, 'h1');
  assert.equal(textOf(first), '测试文档');
  assert.deepEqual(body.childNodes.filter((node) => node.nodeName === '#text').map((node) => node.value).join(''), '');
  assert.deepEqual(result.warnings.map(({ code }) => code), ['code_lines_missing', 'unsupported_block']);
});

test('飞书样板图片 alt 不进入导出正文，有意义的 alt 保留', () => {
  const imageBlock = (id, alt) => ({
    id,
    type: 'image',
    html: '<div class="block docx-image-block" data-block-type="image" data-block-id="' + id + '"><img src="x" alt="' + alt + '"></div>',
  });
  const capture = {
    source: { title: '标题' },
    blocks: [imageBlock('1', 'Feishu Docs - Image'), imageBlock('2', '架构图')],
    code: {},
    images: [
      { blockId: '1', alt: 'Feishu Docs - Image', mime: 'image/png' },
      { blockId: '2', alt: '架构图', mime: 'image/png' },
    ],
    warnings: [],
  };
  const { html } = convertCapture(capture);
  assert.match(html, /<img src="images\/1\.png" alt="">/);
  assert.match(html, /<img src="images\/2\.png" alt="架构图">/);
});

test('引用容器与同步块按已渲染子块保留标题、列表、代码、表格、图片和链接', () => {
  const container = (id, type, inner) => ({
    id, type,
    html: '<div data-block-id="' + id + '" data-block-type="' + type + '">' + inner + '</div>',
  });
  const quote = container('q', 'quote_container',
    headingBlock('qh', 3, '引用标题').html +
    textBlock('qt', ['引用正文']).html +
    listBlock('ql1', 'bullet', '第一项').html +
    listBlock('ql2', 'bullet', '第二项').html);
  const sync = container('s', 'synced_reference',
    '<div class="doc-cover-toolbar">' + aceLine('打开来源工具栏') + '</div>' +
    '<div aria-hidden="true">' + textBlock('hidden', ['作者悬浮卡']).html + '</div>' +
    '<div data-block-type="page" data-block-id="source-page">' +
      headingBlock('sh', 2, '同步章节').html +
      listBlock('sl1', 'ordered', '<a href="https://sample.feishu.cn/docx/Source">教程</a>', '3.').html +
      listBlock('sl2', 'ordered', '下一步', '4.').html +
      quote.html + '<div data-block-type="code" data-block-id="sc">' +
      '<button class="code-block-header-btn">Python</button></div>' +
      tableBlock('st', '<tr><td>同步表格</td></tr>').html +
      imageBlock('si', '同步配图').html +
    '</div>');
  const result = convertCapture(captureOf([sync], {
    code: {sc: {lines: [{num:1, text:'print("同步代码")'}]}},
    images: [{blockId:'si', mime:'image/png', alt:'同步配图'}],
    warnings: [
      {code:'unsupported_block', label:'未适配的块类型：synced_reference'},
      {code:'unsupported_block', label:'未适配的块类型：quote_container'},
    ],
  }));
  assert.match(result.html, /<h2>同步章节<\/h2><ol start="3"><li><a href="https:\/\/sample\.feishu\.cn\/docx\/Source">教程<\/a><\/li><li>下一步<\/li><\/ol>/);
  assert.match(result.html, /<blockquote><h3>引用标题<\/h3><p>引用正文<\/p><ul><li>第一项<\/li><li>第二项<\/li><\/ul><\/blockquote>/);
  assert.match(result.html, /<pre><code class="language-python">print\(&quot;同步代码&quot;\)<\/code><\/pre>/);
  assert.match(result.html, /<table><tbody><tr><td>同步表格<\/td><\/tr><\/tbody><\/table>/);
  assert.match(result.html, /<img src="images\/si\.png" alt="同步配图">/);
  assert.doesNotMatch(result.html, /打开来源工具栏|作者悬浮卡/);
  assert.deepEqual(result.warnings, []);
  assertAllowedTags(result.html);
});

test('同步块尚未加载或包含未知子块时保留具体提示，引用容器直接文本可读取', () => {
  const result = convertCapture(captureOf([
    {id:'empty', type:'synced_reference', html:'<div data-block-type="synced_reference">加载中<button>刷新</button></div>'},
    {id:'mixed', type:'synced_reference', html:'<div data-block-type="synced_reference">' +
      textBlock('ok', ['已读取正文']).html +
      '<div data-block-id="unknown" data-block-type="databaseview">' + aceLine('未知组件正文') + '</div></div>'},
    {id:'pending-quote', type:'quote_container', html:'<div data-block-type="quote_container">加载中</div>'},
    quoteBlock('plain', 'quote_container', ['直接引用文本']),
  ]));
  assert.match(result.html, /<p>已读取正文<\/p>/);
  assert.match(result.html, /<blockquote><p>直接引用文本<\/p><\/blockquote>/);
  assert.doesNotMatch(result.html, /加载中|刷新|未知组件正文/);
  assert.deepEqual(result.warnings, [
    {code:'unsupported_block', label:'同步块 empty 尚未读取到已渲染正文'},
    {code:'unsupported_block', label:'块 unknown 未转换（databaseview）'},
    {code:'unsupported_block', label:'引用容器 pending-quote 尚未读取到已渲染正文'},
  ]);
});

test('view 附件卡保留文件名与安全链接，装饰 SVG 只产生准确的原件未采集提示', () => {
  const result = convertCapture(captureOf([{
    id:'attachment-view',type:'view',html:'<div data-block-id="attachment-view" data-block-type="view">' +
      '<div data-block-id="attachment-file" data-block-type="file"><div class="file-icon">' +
      '<svg width="48" height="48"><path d="M0 0h48v48z"/></svg></div>' +
      '<a href="https://example.org/guide.pdf">使用说明.pdf</a><button>下载</button></div></div>',
  }], {warnings:[{code:'unsupported_block',label:'未适配的块类型：view'}]}));
  assert.match(result.html, /<a href="https:\/\/example\.org\/guide\.pdf">使用说明\.pdf<\/a> \[原件未采集\]/);
  assert.deepEqual(result.warnings, [{code:'missing_attachment',label:'附件块 attachment-file 原件未采集，仅保留文件名和可用链接'}]);
  assert.doesNotMatch(result.html, /<svg|未转换的行内图形|下载/);
  assertAllowedTags(result.html);
});

test('file 根块中的装饰 SVG 不被当作正文行内图形', () => {
  const result = convertCapture(captureOf([{
    id:'attachment',type:'file',html:'<div><svg width="48" height="48"><path/></svg><span>记录.csv</span></div>',
  }]));
  assert.match(result.html, /记录\.csv \[原件未采集\]/);
  assert.deepEqual(result.warnings, [{code:'missing_attachment',label:'附件块 attachment 原件未采集，仅保留文件名和可用链接'}]);
});

test('view 容器按已渲染子块保留正文，嵌套 view 与表格单元格复用同一规则', () => {
  const view = (id,inner) => ({id,type:'view',html:'<div data-block-id="' + id + '" data-block-type="view">' + inner + '</div>'});
  const nested = view('nested', textBlock('nested-text',['嵌套正文']).html);
  const main = view('main', headingBlock('heading',2,'章节').html + listBlock('item','bullet','列表项').html +
    nested.html + imageBlock('picture','示意图').html);
  const cell = view('cell-view', textBlock('cell-text',['格内正文']).html +
    '<div data-block-id="unknown-cell" data-block-type="unknown-view-content">未知内容</div>');
  const result = convertCapture(captureOf([main,tableBlock('table','<tr><td>' + cell.html + '</td></tr>')], {
    images:[{blockId:'picture',mime:'image/png',alt:'示意图'}],
  }));
  assert.match(result.html, /<h2>章节<\/h2><ul><li>列表项<\/li><\/ul><p>嵌套正文<\/p><img src="images\/picture\.png" alt="示意图">/);
  assert.match(result.html, /<td><p>格内正文<\/p><\/td>/);
  assert.deepEqual(result.warnings, [{code:'unsupported_block',label:'块 unknown-cell 未转换（unknown-view-content）'}]);
  assertAllowedTags(result.html);
});

test('空 view 与未知 view 子块继续明确告警，不按图片放行', () => {
  const result = convertCapture(captureOf([
    {id:'empty-view',type:'view',html:'<div data-block-type="view">加载中</div>'},
    {id:'unknown-view',type:'view',html:'<div data-block-type="view"><div data-block-id="unknown" data-block-type="unknown-view-content">未知正文</div></div>'},
  ]));
  assert.deepEqual(result.warnings, [
    {code:'unsupported_block',label:'视图容器 empty-view 尚未读取到已渲染正文'},
    {code:'unsupported_block',label:'块 unknown 未转换（unknown-view-content）'},
  ]);
  assert.doesNotMatch(result.html, /加载中|未知正文|<img/);
});
