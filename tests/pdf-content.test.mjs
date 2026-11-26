import {test} from 'node:test';
import assert from 'node:assert/strict';
import pdfmake from 'pdfmake';
import {pdfDefinition} from '../src/pdf.js';
import {safeStem} from '../src/shared.js';
const n=(tag,children,...other)=>Object.assign({tag,children},...other);
const base={title:'SECRET-测试',blocks:[n('h1',['SECRET-测试'])],warnings:[],assets:[]};
const imageNode=n('img',[],{path:'images/a.png'});
const preparedImage={
  images:{pixel:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aWZsAAAAASUVORK5CYII='},
  names:new Map([['images/a.png','pixel']])
};
test('PDF maps real emphasis, numbered lists, local images and merged table cells',()=>{
  const s={...base,blocks:[...base.blocks,n('p',[n('strong',['粗体']),n('a',['外链'],{href:'https://example.org/a'}),n('img',[],{path:'images/a.png',alt:'色块'})]),
    n('ol',[n('li',['条目'])],{start:7}),n('table',[n('thead',[n('tr',[n('th',['列1']),n('th',['列2'])])]),n('tbody',[n('tr',[n('td',['合并'],{colspan:2})])])])]};
  const {doc}=pdfDefinition(s,{images:{img:'data:image/png;base64,AQ=='},names:new Map([['images/a.png','img']])});
  assert.equal(doc.pageSize,'A4'); const encoded=JSON.stringify(doc.content);
  for(const fragment of ['"bold":true','"start":7','"headerRows":1','"colSpan":2','"image":"img"','https://example.org/a']) assert.ok(encoded.includes(fragment));
  assert.equal(encoded.match(/SECRET-测试/g).length,1);
});
test('PDF preserves overlapping strikethrough and underline on a table link', () => {
  const href = 'https://example.org/same';
  const link = (children) => n('a', children, {href});
  const cell = n('td', [
    'plain', n('s', ['removed']), link(['active link']), n('s', [link(['removed link'])]),
    link([n('del', ['reversed nesting'])]), n('u', [n('strike', [n('u', ['both'])])]),
  ]);
  const {doc} = pdfDefinition({...base, blocks:[n('table', [n('tr', [cell])])]});
  const {text} = doc.content.find(block => block.table).table.body[0][0].stack[0];
  const decorations = text.map(run => [].concat(run.decoration || []).sort());
  assert.deepEqual(decorations, [
    [], ['lineThrough'], ['underline'], ['lineThrough', 'underline'],
    ['lineThrough', 'underline'], ['lineThrough', 'underline'],
  ]);
  assert.deepEqual(text.map(run => run.link ?? null), [null, null, href, href, href, null]);
});
test('PDF preserves validated table cell styles and the default header fill', () => {
  const snapshot = {...base, blocks:[n('table', [
    n('tr', [n('th', ['Styled'], {background:'#123456',color:'#abcdef',align:'center',valign:'middle'}), n('th', ['Default'])]),
    n('tr', [n('td', ['Plain']), n('td', ['Invalid'], {background:'url(https://example.org/color)',color:'var(--color)',align:'sideways',valign:'center'})]),
  ])]};
  const original = structuredClone(snapshot);
  const {doc} = pdfDefinition(snapshot);
  const {body} = doc.content.find(item => item.table).table;
  assert.equal(body[0][0].fillColor, '#123456');
  assert.equal(body[0][0].color, '#abcdef');
  assert.equal(body[0][0].alignment, 'center');
  assert.equal(body[0][0].verticalAlignment, 'middle');
  assert.equal(body[0][0].bold, true);
  assert.equal(body[0][1].fillColor, '#e5eee8');
  for (const cell of body[1]) for (const key of ['fillColor','color','alignment','verticalAlignment']) assert.equal(cell[key], undefined);
  assert.deepEqual(snapshot, original);
});
test('PDF code preserves source spacing and uses Courier with Unicode fallback', () => {
  const code = 'root\n├── main.go    中文注释\n│   └── config.yml\n  iiiWWW 123\n' + 'x'.repeat(190);
  const {doc} = pdfDefinition({...base, blocks:[n('pre', [n('code', [code])])]});
  const block = doc.content.find(item => item.preserveLeadingSpaces);
  assert.ok(Array.isArray(block.text));
  assert.equal(block.text.map(run => run.text).join('').replaceAll('\u200b',''), code);
  for (const run of block.text) {
    assert.equal(run.font, /^[\x00-\x7f\u200b]*$/u.test(run.text) ? 'Courier' : 'Noto');
  }
  assert.ok(block.text.some(run => run.font === 'Noto' && run.text.includes('中文注释')));
  assert.ok(block.text.some(run => run.font === 'Courier' && run.text.includes('    ')));
  assert.ok(block.text.some(run => run.text.includes('\u200b')));
});
test('PDF appends source and layout notices once without changing the source snapshot', () => {
  const warning={code:'code_tail_unconfirmed',label:'代码块 94 的末尾尚未确认。'};
  const snapshot={...base,blocks:[n('p',['正文'])],warnings:[warning]};
  const original=structuredClone(snapshot);
  const {doc,notes}=pdfDefinition(snapshot);
  assert.match(JSON.stringify(doc.content),/保存提示/u);
  assert.match(JSON.stringify(doc.content),/代码块 94 的末尾尚未确认/u);
  assert.deepEqual(notes,[]);
  assert.deepEqual(snapshot,original);
  const wide={...snapshot,blocks:[n('table',[n('tr',[n('td',['宽表'],{colspan:13})])])],
    warnings:[...snapshot.warnings,{code:'missing_image',label:'2 幅图片已用文字说明'}]};
  const result=pdfDefinition(wide,{images:{},names:new Map(),skipped:2,staticImages:1});
  assert.deepEqual(result.notes,['2 幅图片已用文字说明','1 幅图片以静态画面排版','1 个宽表已按行展开']);
  const text=JSON.stringify(result.doc.content);
  assert.equal(text.match(/2 幅图片已用文字说明/gu).length,1);
  assert.match(text,/1 幅图片以静态画面排版/u);
  assert.match(text,/1 个宽表已按行展开/u);
  const normal=pdfDefinition({...base,blocks:[n('p',['正常正文'])]});
  assert.doesNotMatch(JSON.stringify(normal.doc.content),/保存提示/u);
});
test('large PDF is rejected before layout, wider grids preserve their text and images',()=>{
  assert.throws(()=>pdfDefinition({...base,blocks:['x'.repeat(300001)]}),e=>e.code==='PDF_LIMIT');
  const {denseTables,doc}=pdfDefinition({...base,blocks:[n('table',[n('tr',[n('td',['宽表末列',imageNode],{colspan:13})])])]},preparedImage);
  assert.equal(denseTables,1);assert.match(JSON.stringify(doc.content),/宽表末列/);
  assert.match(JSON.stringify(doc.content),/"image":"pixel"/);
});
test('PDF fits an image and unbroken text inside four rendered table columns',async()=>{
  pdfmake.setUrlAccessPolicy(()=>false);
  pdfmake.setLocalAccessPolicy(path=>/^Helvetica(?:-Bold|-Oblique|-BoldOblique)?$/.test(path));
  pdfmake.addFonts({Noto:{normal:'Helvetica',bold:'Helvetica-Bold',italics:'Helvetica-Oblique',bolditalics:'Helvetica-BoldOblique'}});
  const token='W'.repeat(90);
  const table=n('table',[n('tr',[
    n('td',[n('blockquote',[n('ol',[n('li',[imageNode])],{start:42})])]),
    n('td',[token]),
    n('td',[n('table',[n('tr',[n('td',['Inner']),n('td',[imageNode])])])]),
    n('td',['Fourth column'])
  ])]);
  const {doc}=pdfDefinition({title:'Four columns',blocks:[table]},preparedImage);
  assert.equal(doc.content[1].table.widths.length,4);
  const widths=doc.content[1].table.widths;
  assert.ok(widths.every(width=>Number.isFinite(width) && width>=24));
  const starts=widths.map((_,index)=>42+widths.slice(0,index).reduce((sum,width)=>sum+width,0)+16*index);
  const ends=starts.map((start,index)=>start+widths[index]);
  assert.ok(Math.abs(ends.at(-1)-(595.28-42))<.001);
  const pdf=pdfmake.createPdf(doc), stream=await pdf.getStream();
  const items=stream._pdfMakePages.flatMap(page=>page.items);
  const lines=items.filter(({type})=>type==='line').map(({item})=>({
    x:item.x, width:item.getWidth(), text:item.inlines.map(inline=>inline.text).join('')
  }));
  const fourth=lines.find(line=>line.text==='Fourth column');
  assert.ok(fourth?.x >= starts[3] && fourth.x+fourth.width <= ends[3]+.01,JSON.stringify(fourth));
  const wrapped=lines.filter(line=>/^W+$/.test(line.text));
  assert.ok(wrapped.length > 1);
  assert.equal(wrapped.map(line=>line.text).join(''),token);
  assert.ok(wrapped.every(line=>line.x>=starts[1] && line.x+line.width<=ends[1]+.01));
  const images=items.filter(({type})=>type==='image').map(({item})=>item);
  assert.equal(images.length,2);
  assert.ok(images[0]._width>0 && images[0].x>=starts[0] && images[0].x+images[0]._width<=ends[0]+.01);
  assert.ok(images[1]._width>0 && images[1].x>=starts[2] && images[1].x+images[1]._width<=ends[2]+.01);
  assert.ok((await pdf.getBuffer()).subarray(0,5).equals(Buffer.from('%PDF-')));
});
test('export file stems remove reserved path punctuation',()=>{
  assert.doesNotMatch(safeStem('../a:b?c/'),/[/:?]/);
});
