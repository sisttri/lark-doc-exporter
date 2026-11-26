import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import {spawnSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pdfDefinition,generatePdfBuffer} from '../src/pdf.js';
import {preparePdfActualText} from '../src/pdf-actual-text.js';
import {readEmbeddedFont} from '../src/userscript/pdf-fonts.js';

const rows=['👍 👍🏽','👍🏽 👍','❤ ❤️','❤️ ❤','☑ ☑️','☑️ ☑','1⃣ 1️⃣','1️⃣ 1⃣','👩🏾‍💻 👨‍👩‍👧 🏳️‍🌈'];
const snapshot={title:'Copy fidelity',assets:[],warnings:[],blocks:rows.map(text=>({tag:'p',children:[text]}))};
const hasPoppler=spawnSync('pdftotext',['-v']).status===0;

async function cachedPdfMake() {
  const context={console,setTimeout,clearTimeout,setInterval,clearInterval,queueMicrotask,TextEncoder,TextDecoder,atob,btoa};
  context.self=context;
  vm.runInNewContext(await fs.readFile(new URL('../release-assets/pdf-engine-0.3.15.js',import.meta.url),'utf8'),context);
  const pdfMake=context.pdfMake;
  const archive=JSON.parse(await fs.readFile(new URL('../release-assets/pdf-fonts-v1.json',import.meta.url),'utf8'));
  const fonts={};
  for (const font of archive.filter(font=>font.name!=='Bold.woff2')) fonts[font.name]={data:await readEmbeddedFont(font)};
  pdfMake.addVirtualFileSystem(fonts);
  const face=name=>({normal:name,bold:name,italics:name,bolditalics:name});
  pdfMake.addFonts({Noto:face('Regular.woff2'),NotoEmoji:face('Emoji.ttf'),NotoSymbols:face('Symbols.ttf')});
  return pdfMake;
}

function command(name,args) {
  const result=spawnSync(name,args,{encoding:'utf8'});
  assert.equal(result.status,0,result.stderr||result.error?.message);
  return result.stdout;
}

test('cached PDF engine preserves modifiers and selectors in extracted text without changing rendered pixels',{
  skip:!hasPoppler&&'pdftotext is required for the real PDF extraction regression',
},async()=>{
  const pdfMake=await cachedPdfMake();
  const baseline=await pdfMake.createPdf(pdfDefinition(snapshot).doc).getBuffer();
  const {bytes}=await generatePdfBuffer(pdfMake,snapshot,{images:{},names:new Map()});
  const directory=await fs.mkdtemp(join(tmpdir(),'lark-pdf-copy-'));
  try {
    const before=join(directory,'before.pdf'),after=join(directory,'after.pdf');
    await fs.writeFile(before,baseline);await fs.writeFile(after,bytes);
    for (const mode of ['-raw','-layout']) {
      const original=command('pdftotext',[mode,before,'-']);
      const actual=command('pdftotext',[mode,after,'-']);
      assert.ok(!original.includes('👍 👍🏽'),'the unchanged engine must reproduce the first-glyph mapping collision');
      for (const row of rows) assert.ok(actual.includes(row),mode+' must preserve '+JSON.stringify(row)+'; got '+JSON.stringify(actual));
    }
    assert.equal(Buffer.from(bytes).subarray(0,8).toString(),'%PDF-1.5');
    const wordBounds=file=>[...command('pdftotext',['-bbox',file,'-']).matchAll(/<word ([^>]+)>/g)].map(match=>match[1]);
    assert.deepEqual(wordBounds(after),wordBounds(before),'replacement text must retain the original word coordinates');
    if (spawnSync('pdftoppm',['-v']).status===0) {
      command('pdftoppm',['-r','72','-singlefile','-png',before,join(directory,'before')]);
      command('pdftoppm',['-r','72','-singlefile','-png',after,join(directory,'after')]);
      assert.deepEqual(await fs.readFile(join(directory,'after.png')),await fs.readFile(join(directory,'before.png')));
    }
    const header=Array.from({length:100},(_,index)=>'HEADER_'+index+' 👍🏽').join('\n');
    const tallHeader={...snapshot,blocks:[{tag:'table',children:[
      {tag:'thead',children:[{tag:'tr',children:[{tag:'th',children:[header]}]}]},
      {tag:'tbody',children:[{tag:'tr',children:[{tag:'td',children:['BODY_END 👍']}]}]},
    ]}]};
    const createPdf=pdfMake.createPdf,attempts=[];
    pdfMake.createPdf=function(doc,...args){attempts.push(doc);return createPdf.call(this,doc,...args);};
    let recovered;
    try { recovered=await generatePdfBuffer(pdfMake,tallHeader,{images:{},names:new Map()}); }
    finally { pdfMake.createPdf=createPdf; }
    assert.equal(attempts.length,2,'header recovery must create two independent definitions');
    assert.notEqual(attempts[0],attempts[1]);
    await fs.writeFile(after,recovered.bytes);
    const recoveredText=command('pdftotext',['-raw',after,'-']);
    for (let index=0;index<100;index++) assert.ok(recoveredText.includes('HEADER_'+index+' 👍🏽'));
    assert.ok(recoveredText.includes('BODY_END 👍'));
  } finally { await fs.rm(directory,{recursive:true,force:true}); }
});

function documentFixture(fragment) {
  const prototype={addContent(content){this.commands.push(content);return this;},_fragment:fragment};
  const document=Object.assign(Object.create(prototype),{commands:[]});
  const doc={content:[{table:{body:[[{text:[{text:'👍🏽',font:'NotoEmoji'}]}]]}}]};
  const finish=preparePdfActualText(doc);
  doc.content[0].table.body[0][0]._inlines=[{font:{document}}];
  return {doc,document,prototype,finish};
}

test('ActualText marks only replacement fragments and restores instance methods without changing prototypes',()=>{
  const fragment=function(text){this.addContent('BT');this.addContent(text);this.addContent('ET');return 'rendered';};
  const {doc,document,prototype,finish}=documentFixture(fragment);
  assert.equal(doc.version,'1.5');
  assert.equal(document._fragment('👍🏽'),'rendered');
  assert.deepEqual(document.commands,['BT','/Span << /ActualText <feffd83ddc4dd83cdffd> >> BDC','👍🏽','ET','EMC']);
  assert.equal(Object.hasOwn(document,'addContent'),false);
  document.commands=[];
  assert.equal(document._fragment('normal text'),'rendered');
  assert.deepEqual(document.commands,['BT','normal text','ET']);
  assert.equal(prototype._fragment,fragment);
  finish(true);
  assert.equal(document._fragment,fragment);
  assert.equal(Object.hasOwn(document,'_fragment'),false);
});

test('ActualText closes its marker and restores methods when the underlying fragment throws',()=>{
  const failure=new Error('font encoding failed');
  const fragment=function(){this.addContent('BT');throw failure;};
  const {document,prototype,finish}=documentFixture(fragment);
  assert.throws(()=>document._fragment('👍🏽'),error=>error===failure);
  assert.equal(document.commands.at(-1),'EMC');
  assert.equal(document.commands.filter(command=>command==='EMC').length,1);
  assert.equal(Object.hasOwn(document,'addContent'),false);
  assert.equal(prototype._fragment,fragment);
  finish(false);
  assert.equal(Object.hasOwn(document,'_fragment'),false);
});

test('ActualText reports an incompatible pinned-engine hook instead of silently returning lossy text',async()=>{
  const {document,finish}=documentFixture(function(){this.addContent('changed fragment format');});
  assert.throws(()=>document._fragment('👍🏽'),{code:'PDF_RESOURCE_INVALID'});
  assert.equal(Object.hasOwn(document,'addContent'),false);
  finish(false);
  const engine={createPdf(){return {async getBuffer(){return new Uint8Array([1]);}};}};
  await assert.rejects(generatePdfBuffer(engine,snapshot),{code:'PDF_RESOURCE_INVALID'});
});

test('ordinary PDF text leaves the document version and layout properties untouched',()=>{
  const doc={content:[{text:'中文 text 123'}]};
  const original=structuredClone(doc);
  preparePdfActualText(doc)(true);
  assert.deepEqual(doc,original);
});
