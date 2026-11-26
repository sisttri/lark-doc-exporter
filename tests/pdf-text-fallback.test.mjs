import test from 'node:test';
import assert from 'node:assert/strict';
import {pdfDefinition} from '../src/pdf.js';

const n=(tag,children,...other)=>Object.assign({tag,children},...other);
const snapshot=blocks=>({title:'字体回退验证',blocks,assets:[],warnings:[]});
const coverage={NotoEmoji:[[0x20,0x7f],[0x2728,0x2728]],NotoSymbols:[[0x2610,0x2612]]};

function textRuns(value, inherited={}) {
  if (Array.isArray(value)) return value.flatMap(item=>textRuns(item,inherited));
  if (!value || typeof value!=='object') return [];
  const style={...inherited};
  for (const key of ['font','bold','italics','decoration','link','color','alignment','background']) {
    if (value[key]!==undefined) style[key]=value[key];
  }
  const runs=typeof value.text==='string'?[{...style,text:value.text}]:textRuns(value.text,style);
  for (const [key,child] of Object.entries(value)) {
    if (key!=='text') runs.push(...textRuns(child,style));
  }
  return runs;
}

test('PDF fallback runs inherit emphasis, links and table styles while retaining the original text',()=>{
  const href='https://example.org/document';
  const {doc}=pdfDefinition(snapshot([
    n('p',[n('strong',[n('em',[n('a',['左 ✨ 右'],{href})])])]),
    n('table',[n('tr',[n('th',['☐ 标题'],{color:'#123456',align:'right'})])]),
  ]));
  const runs=textRuns(doc.content,doc.defaultStyle);
  const emoji=runs.find(run=>run.text==='✨');
  assert.ok(emoji,'emoji text is isolated for its real glyph font');
  assert.equal(emoji.font,'NotoEmoji');
  assert.equal(emoji.bold,true);assert.equal(emoji.italics,true);assert.equal(emoji.link,href);
  assert.deepEqual(emoji.decoration,['underline']);
  assert.equal(runs.find(run=>run.text==='左 ').font,'Noto');
  const symbol=runs.find(run=>run.text==='☐');
  assert.equal(symbol.font,'NotoSymbols');assert.equal(symbol.bold,true);
  assert.equal(symbol.color,'#123456');assert.equal(symbol.alignment,'right');
  assert.ok(runs.map(run=>run.text).join('').includes('左 ✨ 右☐ 标题'));
});

test('PDF code retains Courier spacing and Unicode fonts without splitting emoji graphemes',()=>{
  const joined='👩‍💻'.repeat(80);
  const code='const ok = true; // ✅\n中文 ☒ '+joined;
  const {doc}=pdfDefinition(snapshot([n('pre',[n('code',[code])])]));
  const pre=doc.content.find(item=>item.preserveLeadingSpaces);
  const runs=textRuns(pre,doc.defaultStyle);
  assert.equal(runs.map(run=>run.text).join(''),code);
  assert.equal(runs.find(run=>run.text.includes('const ok')).font,'Courier');
  assert.equal(runs.find(run=>run.text.includes('中文')).font,'Noto');
  assert.equal(runs.find(run=>run.text==='☒').font,'NotoSymbols');
  assert.equal(runs.find(run=>run.text===joined).font,'NotoEmoji');
  assert.ok(runs.some(run=>run.font==='NotoEmoji' && run.text==='✅'));
});

test('PDF code keeps keycaps and combining characters together when choosing fonts',()=>{
  const code='const keys = "0️⃣ 1️⃣ #️⃣ *️⃣"; // a\u0301 中文';
  const {doc}=pdfDefinition(snapshot([n('pre',[code])]));
  const runs=textRuns(doc.content.find(item=>item.preserveLeadingSpaces),doc.defaultStyle);
  assert.equal(runs.map(run=>run.text).join(''),code);
  for (const keycap of ['0️⃣','1️⃣','#️⃣','*️⃣']) {
    assert.ok(runs.some(run=>run.font==='NotoEmoji' && run.text.includes(keycap)),keycap);
  }
  assert.ok(runs.some(run=>run.font==='Noto' && run.text.includes('a\u0301')));
  assert.ok(runs.some(run=>run.font==='Courier' && run.text.includes('const keys = "')));
});

test('PDF reports unsupported fallback glyph codepoints once while preserving their source text',()=>{
  const input={...snapshot([n('p',['✨ 🫩 🫩'])]),warnings:[{code:'missing_image',label:'附件 🫩'}]};
  const original=structuredClone(input);
  const {doc,notes}=pdfDefinition(input,{images:{},names:new Map(),fontCoverage:coverage});
  assert.equal(notes.length,1);
  assert.match(notes[0],/U\+1FAE9/u);
  assert.doesNotMatch(notes[0],/U\+2728/u);
  assert.equal(notes[0].match(/U\+1FAE9/gu).length,1);
  const runs=textRuns(doc.content,doc.defaultStyle);
  assert.ok(runs.some(run=>run.text.includes('🫩')));
  assert.ok(runs.some(run=>run.text==='🫩' && run.font==='NotoEmoji'));
  assert.deepEqual(input,original);
  assert.deepEqual(pdfDefinition(snapshot([n('p',['✨ ☐'])]),{images:{},names:new Map(),fontCoverage:coverage}).notes,[]);
});

test('PDF exposes equation metadata as readable inline and block source with one layout notice',()=>{
  const inline='x^2 + \\frac{1}{2}',block='\\sum_{n=1}^{4} n = 10';
  const {doc,notes}=pdfDefinition(snapshot([
    n('p',['前 ',n('span',[inline],{equation:inline,display:'inline'}),' 后']),
    n('span',[block],{equation:block,display:'block'}),
  ]));
  const runs=textRuns(doc.content,doc.defaultStyle);
  assert.equal(runs.find(run=>run.text===inline).font,'Courier');
  assert.equal(runs.find(run=>run.text===block).font,'Courier');
  assert.ok(runs.map(run=>run.text).join('').includes('前 '+inline+' 后'));
  assert.equal(notes.length,1);assert.match(notes[0],/2.*公式.*源码/u);
  assert.ok(JSON.stringify(doc.content).includes('preserveLeadingSpaces'));
});
