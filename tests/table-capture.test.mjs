import test from 'node:test';
import assert from 'node:assert/strict';
import { parseFragment, serializeOuter } from 'parse5';
import { createTableStyleCapture } from '../src/userscript/table.js';
import { convertCapture } from '../src/feishu.js';

// The renderer boundary supplies computed values and rectangles; HTML parsing,
// ancestry, cell selection, and the captured HTML remain real parse5 trees.
function fixture(html, computed = {}) {
  const root = parseFragment(html), nodes = [], reads = new Map(), rectangles = new Map();
  const doc = {defaultView:{getComputedStyle(node) {
    reads.set(node,(reads.get(node) || 0)+1);
    return {backgroundColor:'rgba(0, 0, 0, 0)',color:'rgb(0, 0, 0)',textAlign:'start',verticalAlign:'middle',direction:'ltr',...computed[node.getAttribute('id')]};
  }}};
  const descendants = node => (node.childNodes || []).flatMap(child => child.tagName ? [child,...descendants(child)] : []);
  const matches = (node, selector) => selector === '.ace-line' ? (node.getAttribute('class') || '').split(/\s+/u).includes('ace-line')
    : selector.split(',').includes(node.localName);
  for (const node of descendants(root)) {
    nodes.push(node);
    Object.assign(node,{nodeType:1,localName:node.tagName,ownerDocument:doc,
      getAttribute(name) {return this.attrs.find(attr => attr.name === name)?.value ?? null;},
      closest(selector) {for(let current=this;current;current=current.parentElement) if(matches(current,selector)) return current;return null;},
      querySelectorAll(selector) {return descendants(this).filter(child => matches(child,selector));},
      getBoundingClientRect() {rectangles.set(this,(rectangles.get(this)||0)+1);return {width:Number(this.getAttribute('data-width')),height:20,top:0,bottom:20};},
    });
    Object.defineProperties(node,{
      parentElement:{get() {return this.parentNode?.tagName ? this.parentNode : null;}},
      children:{get() {return this.childNodes.filter(child => child.tagName);}},
      rows:{get() {return descendants(this).filter(child => child.localName === 'tr' && child.closest('table') === this);}},
      cells:{get() {return this.children.filter(child => child.localName === 'td' || child.localName === 'th');}},
      outerHTML:{get() {return serializeOuter(this);}},
    });
  }
  return {node:id => nodes.find(node => node.getAttribute('id') === id),reads,rectangles,computed};
}

test('计算后的类/变量色和行底色进入副本，保留原始style与th语义', () => {
  const f = fixture('<table id="table"><tr id="row"><th id="cell" class="theme" style="--fill:var(--brand);padding:3px">title</th></tr></table>', {
    row:{backgroundColor:'rgb(238, 204, 170)'},cell:{color:'rgb(16, 32, 48)',verticalAlign:'bottom'},
  });
  const cell = f.node('cell'), before = cell.outerHTML;
  const html = createTableStyleCapture().cellHtml(cell);
  assert.match(html, /^<th\b/);
  assert.match(html, /--fill:var\(--brand\);padding:3px;background-color:#eeccaa;color:#102030;text-align:left;vertical-align:bottom/);
  assert.equal(cell.outerHTML,before);
});

test('半透明底色逐层合成到真实祖先，前景色合成到相同底色', () => {
  const f = fixture('<div id="body"><table id="table"><tr id="row"><td id="cell">alpha</td></tr></table></div>', {
    body:{backgroundColor:'rgb(32, 32, 32)'},table:{backgroundColor:'rgba(0, 0, 255, 0.5)'},
    row:{backgroundColor:'rgba(255, 0, 0, 0.5)'},cell:{backgroundColor:'rgba(0, 255, 0, 0.5)',color:'rgba(255, 255, 255, 0.5)'},
  });
  assert.match(createTableStyleCapture().cellHtml(f.node('cell')), /background-color:#448424;color:#a1c191/);
});

test('透明无底色不复制文字色，半透明无不透明祖先时合成到白纸', () => {
  const f = fixture('<table><tr><td id="clear">clear</td><td id="alpha">alpha</td></tr></table>', {
    clear:{color:'rgb(255, 0, 0)'},alpha:{backgroundColor:'rgb(0 0 0 / 50%)'},
  });
  const capture = createTableStyleCapture();
  assert.doesNotMatch(capture.cellHtml(f.node('clear')), /(?:background-color|(?:;|")color):/);
  assert.match(capture.cellHtml(f.node('alpha')), /background-color:#808080;color:#000000/);
});

test('同格直属段落一致时保留实际对齐与字色，排除嵌套表格的段落', () => {
  const f = fixture('<table><tr><td id="cell"><div id="a" class="ace-line">a</div><div id="b" class="ace-line">b</div><table><tr><td><div id="nested" class="ace-line">n</div></td></tr></table></td></tr></table>', {
    cell:{backgroundColor:'rgb(16, 16, 16)',textAlign:'left',color:'rgb(0, 0, 0)'},
    a:{textAlign:'right',color:'rgb(255, 255, 255)'},b:{textAlign:'right',color:'rgb(255, 255, 255)'},nested:{textAlign:'center'},
  });
  const html = createTableStyleCapture().cellHtml(f.node('cell'));
  assert.match(html, /background-color:#101010;color:#ffffff;text-align:right/);
  assert.equal(f.reads.has(f.node('nested')),false);
});

test('多个直属段落对齐不一致时保留cell默认，不能任选首段', () => {
  const f = fixture('<table><tr><td id="cell"><p id="a" class="ace-line">a</p><p id="b" class="ace-line">b</p></td></tr></table>', {
    cell:{textAlign:'center'},a:{textAlign:'left'},b:{textAlign:'right'},
  });
  assert.match(createTableStyleCapture().cellHtml(f.node('cell')), /text-align:center/);
});

for (const [textAlign,direction,want] of [['start','rtl','right'],['end','rtl','left'],['start','ltr','left'],['end','ltr','right']]) {
  test('逻辑对齐 ' + textAlign + '/' + direction + ' 按真实方向保存', () => {
    const f = fixture('<table><tr><td id="cell">direction</td></tr></table>', {cell:{textAlign,direction}});
    assert.match(createTableStyleCapture().cellHtml(f.node('cell')),new RegExp('text-align:'+want));
  });
}

test('同节点未改HTML复用样式副本与公共祖先，最终复核刷新迟到CSS一次', () => {
  const f = fixture('<table id="table"><tr id="row"><td id="a">a</td><td id="b">b</td></tr></table>', {table:{backgroundColor:'rgb(1, 2, 3)'}});
  const capture = createTableStyleCapture();
  for(let round=0;round<8;round++) for(const id of ['a','b']) assert.match(capture.cellHtml(f.node(id)), /background-color:#010203/);
  for(const id of ['a','b','row','table']) assert.equal(f.reads.get(f.node(id)),1);
  f.computed.table.backgroundColor = 'rgb(4, 5, 6)';
  capture.beginFinalReview();
  for(const id of ['a','b']) assert.match(capture.cellHtml(f.node(id)), /background-color:#040506/);
  for(const id of ['a','b','row','table']) assert.equal(f.reads.get(f.node(id)),2);
});

test('虚拟表格替换同HTML节点时重新读取实际样式', () => {
  const html = '<table><tr><td id="cell">same html</td></tr></table>';
  const first = fixture(html,{cell:{backgroundColor:'rgb(255, 0, 0)'}});
  const replacement = fixture(html,{cell:{backgroundColor:'rgb(0, 0, 255)'}});
  const capture = createTableStyleCapture();
  assert.match(capture.cellHtml(first.node('cell')), /background-color:#ff0000/);
  assert.match(capture.cellHtml(replacement.node('cell')), /background-color:#0000ff/);
});

test('没有真实DOM计算样式接口时沿用原HTML及原有列定义', () => {
  const cell = {outerHTML:'<td style="color:red">old mock</td>'};
  const capture = createTableStyleCapture();
  assert.equal(capture.cellHtml(cell),cell.outerHTML);
  assert.equal(capture.columnWidths({rows:[]}),undefined);
});

test('优先原生col的实际宽度并展开span，合并格不影响列轨道', () => {
  const f = fixture('<table id="table"><colgroup><col span="2" data-width="200"><col data-width="300"></colgroup><tr><td colspan="2" data-width="400">a</td><td data-width="100">b</td></tr></table>');
  assert.deepEqual(createTableStyleCapture().columnWidths(f.node('table')),[2000,2000,6000]);
});

test('无col子元素的colgroup按实际总宽及span展开', () => {
  const f = fixture('<table id="table"><colgroup span="3" data-width="300"></colgroup><colgroup><col data-width="100"></colgroup><tr><td colspan="4">all</td></tr></table>');
  assert.deepEqual(createTableStyleCapture().columnWidths(f.node('table')),[2500,2500,2500,2500]);
});

test('没有原生列宽时使用无合并完整行，不能均分上一行合并格', () => {
  const f = fixture('<table id="table"><tr><td colspan="2" data-width="400">merged</td></tr><tr><td data-width="120">a</td><td data-width="280">b</td></tr></table>');
  assert.deepEqual(createTableStyleCapture().columnWidths(f.node('table')),[3000,7000]);
});

test('只有跨列格或有前序跨行占位时不猜测列宽', () => {
  for(const rows of ['<tr><td colspan="2" data-width="400">merged</td></tr>',
    '<tr><td rowspan="2" data-width="100">rowspan</td><td colspan="2" data-width="300">merged</td></tr><tr><td data-width="100">a</td><td data-width="200">b</td></tr>']) {
    const f = fixture('<table id="table">' + rows + '</table>');
    assert.equal(createTableStyleCapture().columnWidths(f.node('table')),undefined);
    assert.equal(f.rectangles.size,0);
  }
});

test('原生列宽不应被合法大rowspan或延伸至组末的rowspan=0丢弃', () => {
  for(const rowspan of [0,100]) {
    const f = fixture('<table id="table"><colgroup><col data-width="100"><col data-width="300"></colgroup><tr><td rowspan="'+rowspan+'">a</td><td>b</td></tr></table>');
    assert.deepEqual(createTableStyleCapture().columnWidths(f.node('table')),[2500,7500]);
  }
});

test('无效宽度不写hint，超过64列不做测量', () => {
  for(const cells of ['<td data-width="0">zero</td><td data-width="200">other</td>',Array(65).fill('<td data-width="20">wide</td>').join('')]) {
    const f = fixture('<table id="table"><tr>' + cells + '</tr></table>');
    assert.equal(createTableStyleCapture().columnWidths(f.node('table')),undefined);
  }
});

test('列宽在HTML不变时复用矩形，最终复核仅再测一次', () => {
  const f = fixture('<table id="table"><colgroup><col id="a" data-width="100"><col id="b" data-width="300"></colgroup><tr><td>a</td><td>b</td></tr></table>');
  const capture = createTableStyleCapture();
  for(let index=0;index<8;index++) assert.deepEqual(capture.columnWidths(f.node('table')),[2500,7500]);
  for(const id of ['a','b']) assert.equal(f.rectangles.get(f.node(id)),1);
  capture.beginFinalReview();
  assert.deepEqual(capture.columnWidths(f.node('table')),[2500,7500]);
  for(const id of ['a','b']) assert.equal(f.rectangles.get(f.node(id)),2);
});

test('五列跨三行保留display:none占位td时仍读取五个实际列轨道', () => {
  const cols = Array(5).fill('<col data-width="146">').join('');
  const rows = Array.from({length:3},(_,row) => '<tr>' + Array.from({length:5},(_,col) =>
    '<td id="r'+row+'c'+col+'"' + (col === 0 ? row === 0 ? ' rowspan="3"' : ' style="display:none"' : '') +
    ' data-width="'+(row > 0 && col === 0 ? 0 : 146)+'">synthetic</td>').join('') + '</tr>').join('');
  const f = fixture('<table id="table"><colgroup>'+cols+'</colgroup>'+rows+'</table>', {
    r1c0:{display:'none'},r2c0:{display:'none'},
  });
  const capture = createTableStyleCapture();
  assert.deepEqual(capture.columnWidths(f.node('table')),[2000,2000,2000,2000,2000]);
  for(let index=0;index<5;index++) capture.cellHtml(f.node('r0c'+index));
  assert.equal(f.reads.get(f.node('r0c0')),1,'结构检查与样式副本共用一次计算样式读取');
});

test('fallback完整行忽略显式hidden/aria-hidden格，不把零宽离屏格当隐藏', () => {
  const f = fixture('<table id="table"><tr><td data-width="120">a</td><td hidden data-width="0">ghost-a</td><td aria-hidden="true" data-width="0">ghost-b</td><td data-width="280">b</td></tr></table>');
  assert.deepEqual(createTableStyleCapture().columnWidths(f.node('table')),[3000,7000]);
  const offscreen = fixture('<table id="table"><tr><td id="visible" data-width="0">offscreen</td><td data-width="200">other</td></tr></table>');
  assert.equal(createTableStyleCapture().columnWidths(offscreen.node('table')),undefined);
});

test('外部CSS恢复内联display:none格的可见性后，离线转换仍保留文字且复用计算样式', () => {
  const f = fixture('<table><tr><td id="cell" class="force-visible" style="display:none">VISIBLE_OVERRIDE_SOURCE</td></tr></table>', {cell:{display:'table-cell'}});
  const cell = f.node('cell'), before = cell.outerHTML;
  cell.style = {display:'none'};
  const capture = createTableStyleCapture();
  for(let round=0;round<3;round++) {
    assert.equal(capture.isHiddenCell(cell),false);
    const html = capture.cellHtml(cell);
    const converted = convertCapture({title:'synthetic',blocks:[{id:'table',type:'table',html:'<div><table><tr>'+html+'</tr></table></div>'}],code:{},images:[]});
    assert.match(converted.html,/VISIBLE_OVERRIDE_SOURCE/);
    assert.match(html,/;display:table-cell!important"/);
    assert.equal(cell.outerHTML,before);
  }
  assert.equal(f.reads.get(cell),1);
  capture.beginFinalReview();
  assert.equal(capture.isHiddenCell(cell),false);
  assert.match(capture.cellHtml(cell),/;display:table-cell!important"/);
  assert.equal(f.reads.get(cell),2);
});

test('可见性覆盖只处理内联none冲突，保留hidden与aria-hidden语义', () => {
  const f = fixture('<table><tr><td id="normal" style="display:table-cell">normal</td><td id="hidden" hidden style="display:none">hidden</td><td id="aria" aria-hidden="true" style="display:none">aria</td></tr></table>', {
    normal:{display:'table-cell'},hidden:{display:'table-cell'},aria:{display:'table-cell'},
  });
  const capture = createTableStyleCapture();
  f.node('normal').style = {display:'table-cell'};
  assert.doesNotMatch(capture.cellHtml(f.node('normal')),/display:table-cell!important/);
  for(const id of ['hidden','aria']) {
    f.node(id).style = {display:'none'};
    assert.equal(capture.isHiddenCell(f.node(id)),true);
  }
});
