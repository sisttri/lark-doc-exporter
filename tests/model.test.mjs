import assert from 'node:assert/strict';
import test from 'node:test';
import {readBlockContext,readPageModel} from '../src/userscript/model.js';
import {diagramFixture} from './helpers/diagram.mjs';
import {convertCapture} from '../src/feishu.js';

test('block context validates page, model and DOM ownership and detects stale contexts',()=>{
  const f=diagramFixture(),context=readBlockContext(f.document,'diagram',{pageView:f.pageView,type:'diagram'});
  assert.equal(context.model,f.model);assert.equal(context.view,f.view);assert.equal(context.current(),true);
  f.attributes['data-record-id']='different';assert.equal(context.current(),false);
});

test('block context supports missing view getters and bounded cyclic model trees',()=>{
  const f=diagramFixture();delete f.model.blockManager;
  f.root.children=[{children:[f.root],innerBlockManager:{rootBlockModel:{children:[f.model]}}}];
  const context=readBlockContext(f.document,'diagram',{pageView:f.pageView,type:'diagram'});
  assert.equal(context.model,f.model);assert.equal(context.view,null);assert.equal(context.current(),true);
});

test('block context rejects identity/type mismatches and missing model roots',()=>{
  for(const change of [f=>{f.pageAttributes['data-record-id']='other';},f=>{f.attributes['data-block-type']='image';},
    f=>{f.model.record.id='other';},f=>{delete f.pageView.PageMain;}]){
    const f=diagramFixture();change(f);assert.equal(readBlockContext(f.document,'diagram',{pageView:f.pageView,type:'diagram'}),null);
  }
  const f=diagramFixture();assert.equal(readBlockContext(f.document,'bad"]',{pageView:f.pageView}),null);
});

test('model contexts reject a reused root and DOM page whose document record changes together',()=>{
  const f=diagramFixture(),context=readBlockContext(f.document,'diagram',{pageView:f.pageView,type:'diagram'});
  f.root.record.id='other-page';f.pageAttributes['data-record-id']='other-page';
  assert.equal(context.current(),false);
  const g=diagramFixture();
  Object.defineProperty(g.model,'snapshot',{get(){g.root.record.id='other-page';g.pageAttributes['data-record-id']='other-page';return {};}});
  assert.equal(readPageModel({document:g.document,pageView:g.pageView}),null);
});

test('page model snapshot preserves tree order and only documented semantic source fields',()=>{
  const f=diagramFixture();
  const equation={id:'9',type:'text',record:{id:'r9'},snapshot:{},zoneState:{allText:'公式',content:{ops:[
    {insert:'求值 ',attributes:{bold:true,unrelated:{private:'discard'}}},
    {insert:'\ufffc',attributes:{equation:'x^2 < y'}},
    {insert:'\ufffc',attributes:{'inline-component':JSON.stringify({type:'mention_doc',data:{title:'文档',raw_url:'https://example.test/docx/public'}})}}]}}};
  const image={id:'3',type:'image',record:{id:'r3'},snapshot:{image:{caption:{text:{initialAttributedTexts:{text:['说明']}}}}}};
  const mermaid={id:'7',type:'isv',snapshot:{block_type_id:'blk_631fefbbae02400430b8f9f4',data:{data:'graph TD\n A-->B'}}};
  f.root.children=[equation,image,mermaid];
  const snapshot=readPageModel({document:f.document,pageView:f.pageView});
  assert.deepEqual(snapshot.roots,['9','3','7']);assert.equal(snapshot.recordId,'page-record');
  const text=snapshot.blocks.find(block=>block.id==='9');
  assert.equal(text.parentId,'page');assert.equal(text.ops[0].attributes.unrelated,undefined);
  assert.equal(text.ops[1].attributes.equation,'x^2 < y');
  assert.deepEqual(text.ops[2].attributes.mention,{title:'文档',url:'https://example.test/docx/public'});
  assert.equal(snapshot.blocks.find(block=>block.id==='3').caption,'说明');
  assert.deepEqual(snapshot.blocks.find(block=>block.id==='7').source,{language:'mermaid',text:'graph TD\n A-->B'});
  equation.zoneState.content.ops[0].insert='changed';assert.equal(text.ops[0].insert,'求值 ');
  assert.doesNotThrow(()=>JSON.stringify(snapshot));assert.deepEqual(snapshot.warnings,[]);
});

test('page model uses synchronized children once and marks pending/incomplete nodes',()=>{
  const f=diagramFixture();
  f.root.children=[{id:'reference',type:'synced_reference',record:{id:'ref'},isAllDataReady:false,children:[{id:'stale',type:'text'}],
    innerBlockManager:{rootBlockModel:{children:[{id:'live',type:'text',snapshot:{type:'pending'}}]}}}];
  const snapshot=readPageModel({document:f.document,pageView:f.pageView});
  assert.deepEqual(snapshot.blocks.find(block=>block.id==='reference').children,['live']);
  assert.equal(snapshot.blocks.some(block=>block.id==='stale'),false);
  assert.equal(snapshot.blocks.find(block=>block.id==='live').ready,false);
  assert.ok(snapshot.warnings.some(w=>w.code==='missing_block'));
});

test('page model snapshots attachment identity even when its DOM is unmounted',()=>{
  const f=diagramFixture(),file={token:'original-token',name:'same-name.txt'};
  f.root.children=[{id:'unmounted-file',type:'file',record:{id:'file-record'},snapshot:{file}}];
  const before=readPageModel({document:f.document,pageView:f.pageView});
  file.token='replacement-token';
  const after=readPageModel({document:f.document,pageView:f.pageView});
  assert.deepEqual(before.blocks[0].file,{token:'original-token',name:'same-name.txt'});
  assert.deepEqual(after.blocks[0].file,{token:'replacement-token',name:'same-name.txt'});
  assert.deepEqual(after.warnings,[]);
});

test('page model bounds oversized inventories without claiming a complete tree',()=>{
  const f=diagramFixture();f.root.children=Array.from({length:20_001},(_,id)=>({id:String(id),type:'text'}));
  const snapshot=readPageModel({document:f.document,pageView:f.pageView});
  assert.ok(snapshot.roots.length<=20_000);assert.ok(snapshot.blocks.length<=20_000);
  assert.ok(snapshot.warnings.some(w=>w.code==='missing_block'&&w.label.includes('限制')));
});

test('malformed document-mention shapes warn without overriding usable DOM text',()=>{
  const f=diagramFixture();
  f.model.zoneState={content:{ops:[{insert:'\ufffc',attributes:{'inline-component':'{"type":"mention_doc","data":null}'}}]}};
  const snapshot=readPageModel({document:f.document,pageView:f.pageView});
  assert.equal(snapshot.blocks[0].ops[0].attributes.mention,undefined);
  assert.ok(snapshot.warnings.some(w=>w.code==='unsupported_block'));
});

test('mixed supported and unknown inline components preserve the original DOM instead of dropping names',()=>{
  const f=diagramFixture();f.model.type='text';
  f.model.zoneState={allText:'用户：\ufffc 和 \ufffc',content:{ops:[{insert:'用户：',attributes:{}},
    {insert:'\ufffc',attributes:{'inline-component':'{"type":"user","data":{"uid":"public-example"}}'}},
    {insert:' 和 ',attributes:{}},{insert:'\ufffc',attributes:{equation:'x^2'}}]}};
  const semantic=readPageModel({document:f.document,pageView:f.pageView});
  const output=convertCapture({source:{title:'公开样本',docToken:'page-record'},semantic,blocks:[{id:'diagram',type:'text',
    html:'<div data-block-id="diagram" data-record-id="diagram-record" data-block-type="text"><div class="ace-line">用户：@示例用户 和 x²</div></div>'}]});
  assert.ok(output.html.includes('@示例用户'));assert.ok(output.html.includes('x²'));
  assert.ok(output.warnings.some(w=>w.code==='unsupported_block'&&w.label.includes('内联')));
});

test('a model text-budget boundary never permits partial ops to overwrite complete DOM content',()=>{
  const f=diagramFixture(),body='a'.repeat(2_100_000);f.model.type='text';
  f.model.zoneState={allText:body,content:{ops:[{insert:'\ufffc',attributes:{equation:'x'}},{insert:body,attributes:{}}]}};
  const semantic=readPageModel({document:f.document,pageView:f.pageView});
  assert.equal(semantic.blocks[0].ready,false);
  const output=convertCapture({source:{title:'公开样本',docToken:'page-record'},semantic,blocks:[{id:'diagram',type:'text',
    html:'<div data-block-id="diagram" data-block-type="text"><div class="ace-line">'+body+'</div></div>'}]});
  assert.ok(output.html.includes(body));assert.ok(output.warnings.some(w=>w.code==='missing_block'));
});

test('snapshot runtime identifiers are safe for quoted attribute selectors and synthesized block shells',()=>{
  const f=diagramFixture(),unsafe=['bad"] div','bad/path','x'.repeat(161)];
  f.root.children=[{id:'safe-id',type:'callout',children:unsafe.map(id=>({id,type:'text'}))},
    ...unsafe.map(id=>({id,type:'text'})),{id:'x'.repeat(160),type:'text'}];
  const snapshot=readPageModel({document:f.document,pageView:f.pageView});
  for(const id of [snapshot.rootId,...snapshot.roots,...snapshot.blocks.flatMap(block=>[block.id,block.parentId,...block.children])]) {
    assert.match(id,/^[\w-]{1,160}$/u);
  }
  assert.deepEqual(snapshot.blocks.find(block=>block.id==='safe-id').children,[]);
  assert.ok(snapshot.warnings.some(w=>w.code==='missing_block'));
  f.root.id='unsafe"';assert.equal(readPageModel({document:f.document,pageView:f.pageView}),null);
});

test('captions preserve all ordered string chunks and existing line breaks for images and boards',()=>{
  const f=diagramFixture(),caption={text:{initialAttributedTexts:{text:['第一段','\n第二段',' & <尾段>']}}};
  f.root.children=[{id:'image',type:'image',snapshot:{image:{caption}}},{id:'board',type:'whiteboard',snapshot:{caption}}];
  const snapshot=readPageModel({document:f.document,pageView:f.pageView});
  assert.deepEqual(snapshot.blocks.map(block=>block.caption),['第一段\n第二段 & <尾段>','第一段\n第二段 & <尾段>']);
  assert.deepEqual(snapshot.warnings,[]);
});

test('caption budget and unknown chunk shapes do not expose truncated captions as complete',()=>{
  const f=diagramFixture();f.root.children=[{id:'image',type:'image',snapshot:{image:{caption:{text:{initialAttributedTexts:{text:['safe',{}]}}}}}}];
  let snapshot=readPageModel({document:f.document,pageView:f.pageView});
  assert.equal(snapshot.blocks[0].caption,'');assert.ok(snapshot.warnings.some(w=>w.code==='unsupported_block'));
  f.root.children[0].snapshot.image.caption.text.initialAttributedTexts.text=['x'.repeat(4*1024*1024),'tail'];
  snapshot=readPageModel({document:f.document,pageView:f.pageView});
  assert.equal(snapshot.blocks[0].ready,false);assert.equal(snapshot.blocks[0].caption,'');
  assert.ok(snapshot.warnings.some(w=>w.code==='missing_block'));
});
