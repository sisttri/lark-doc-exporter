import assert from 'node:assert/strict';
import test from 'node:test';
import {splitEmojiRuns,validFontCoverage,missingEmojiGlyphs} from '../src/pdf-emoji.js';
import {pdfDefinition} from '../src/pdf.js';

const joined = runs => runs.map(run => run.text).join('');

test('PDF plain text retains its inherited font and original bytes', () => {
  for(const text of ['中文 English 123 # * © ® ™','const value = 1;\n下一行','a\u0301 漢\ufe00']) {
    assert.deepEqual(splitEmojiRuns(text),[{text}]);
  }
  assert.deepEqual(splitEmojiRuns(''),[]);
});

test('PDF emoji runs keep ZWJ, modifiers, flags, variation selectors and keycaps intact', () => {
  const examples=['✨','😀','❤️','👩‍💻','👨‍👩‍👧‍👦','👍🏽','🇨🇳','1️⃣','©️'];
  for(const emoji of examples) {
    const text='前 '+emoji+' 后';
    assert.deepEqual(splitEmojiRuns(text),[{text:'前 '},{text:emoji,font:'NotoEmoji'},{text:' 后'}]);
    assert.equal(joined(splitEmojiRuns(text)),text);
  }
});

test('PDF checkbox characters use the symbols font without substituting Unicode', () => {
  assert.deepEqual(splitEmojiRuns('☐ 未完成 ☑ 完成 ☒ 取消'),[
    {text:'☐',font:'NotoSymbols'},{text:' 未完成 '},{text:'☑',font:'NotoSymbols'},
    {text:' 完成 '},{text:'☒',font:'NotoSymbols'},{text:' 取消'},
  ]);
});

test('PDF adjacent graphemes merge only when their font agrees', () => {
  const text='😀✨中文☐☑✅';
  const runs=splitEmojiRuns(text);
  assert.deepEqual(runs,[{text:'😀✨',font:'NotoEmoji'},{text:'中文'},
    {text:'☐☑',font:'NotoSymbols'},{text:'✅',font:'NotoEmoji'}]);
  assert.equal(joined(runs),text);
});

test('PDF text presentation symbols and isolated selectors do not change unrelated fonts', () => {
  for(const text of ['©︎ ®︎ ™︎','汉️ A‍ B','# 1 *']) assert.deepEqual(splitEmojiRuns(text),[{text}]);
  const malformed='A\ud800☐\udc00😀';
  assert.equal(joined(splitEmojiRuns(malformed)),malformed);
});

const coverage={NotoEmoji:[[0x23,0x23],[0x2a,0x2a],[0x30,0x39],[0x20e3,0x20e3],[0x2600,0x27ff],
  [0x1f1e6,0x1f1ff],[0x1f3fb,0x1f3ff],[0x1f466,0x1f4ff],[0x1f600,0x1f64f]],
  NotoSymbols:[[0x2610,0x2612]]};

test('PDF fallback coverage accepts only ordered finite Unicode ranges',()=>{
  assert.equal(validFontCoverage(coverage.NotoEmoji),true);
  assert.equal(validFontCoverage(coverage.NotoSymbols),true);
  for(const bad of [null,[],{},[[1]],[[2,1]],[[0,Infinity]],[[-1,1]],[[0,0x110000]],
    [[1,3],[3,4]],[[5,6],[1,2]],[[1.5,2]],[[0,1,2]],[[,2]]])assert.equal(validFontCoverage(bad),false);
});

test('PDF missing emoji audit preserves clusters, ignores selectors and deduplicates gaps',()=>{
  assert.deepEqual(missingEmojiGlyphs('正常中文 ✨ ☐ ☑ 👩‍💻 🇨🇳 1️⃣',coverage),[]);
  assert.deepEqual(missingEmojiGlyphs('🫩 🫩 👩‍🫩 ✨',coverage),['🫩','👩‍🫩']);
  assert.deepEqual(missingEmojiGlyphs('© ® ™ a汉',coverage),[]);
});

test('PDF missing emoji audit rejects invalid coverage instead of claiming glyphs exist',()=>{
  for(const value of [undefined,{}, {...coverage,NotoEmoji:[]},{...coverage,NotoSymbols:[[2,1]]}]) {
    assert.throws(()=>missingEmojiGlyphs('😀☐',value),{code:'PDF_FONT_INVALID'});
  }
});

test('PDF fallback fonts render real emoji, checkbox and styled mixed text without notdef glyphs',async()=>{
  const {default:fs}=await import('node:fs/promises');
  const {createRequire}=await import('node:module');
  const require=createRequire(import.meta.url),pdfmake=require('pdfmake/build/pdfmake.js');
  const files={'Regular.woff2':'NotoSansCJKsc-Regular.woff2','Bold.woff2':'NotoSansCJKsc-Bold.woff2',
    'Emoji.ttf':'NotoEmoji-Regular.ttf','Symbols.ttf':'NotoSansSymbols2-Regular.ttf'};
  const vfs={};
  for(const [name,file] of Object.entries(files))vfs[name]={data:await fs.readFile(new URL('../fonts/'+file,import.meta.url))};
  pdfmake.addVirtualFileSystem(vfs);
  const face=name=>({normal:name,bold:name,italics:name,bolditalics:name});
  pdfmake.addFonts({Noto:{normal:'Regular.woff2',bold:'Bold.woff2',italics:'Regular.woff2',bolditalics:'Bold.woff2'},
    NotoEmoji:face('Emoji.ttf'),NotoSymbols:face('Symbols.ttf')});
  pdfmake.addFontContainer(require('pdfmake/build/standard-fonts/Courier.js'));
  const emoji='✨ 😀 ❤️ 👩‍💻 👨‍👩‍👧‍👦 👍🏽 🇨🇳 1️⃣ ☐ ☑ ☒ ✅';
  const n=(tag,children,...other)=>Object.assign({tag,children},...other);
  const {doc}=pdfDefinition({title:'字形回退验证',warnings:[],assets:[],blocks:[
    n('p',['正文 '+emoji+' 结束']),
    n('p',[n('strong',[n('em',['粗斜体 '+emoji])])]),
    n('table',[n('tr',[n('td',['表格 '+emoji])])]),
    n('pre',['const answer = "代码✨☐";']),
  ]});
  const instance=pdfmake.createPdf(doc);
  const stream=await instance.getStream();
  const inlines=stream._pdfMakePages.flatMap(page=>page.items.filter(item=>item.type==='line').flatMap(({item})=>item.inlines));
  const actualText=inlines.map(run=>run.text).join('');
  assert.ok(actualText.includes('正文 '+emoji+' 结束'));
  assert.ok(actualText.includes('const answer = "代码✨☐";'));
  const fallback=inlines.filter(run=>['NotoEmoji-Regular','NotoSansSymbols2-Regular'].includes(run.font.name));
  assert.ok(fallback.some(run=>run.font.name==='NotoEmoji-Regular'));
  assert.ok(fallback.some(run=>run.font.name==='NotoSansSymbols2-Regular'));
  for(const run of fallback)assert.ok(run.font.font.layout(run.text).glyphs.every(glyph=>glyph.id!==0),run.text);
  const bytes=await instance.getBuffer();assert.equal(Buffer.from(bytes).subarray(0,5).toString(),'%PDF-');
});
