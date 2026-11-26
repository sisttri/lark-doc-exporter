import assert from 'node:assert/strict';
import test from 'node:test';
import {parse} from 'parse5';
import {unzipSync} from 'fflate';
import * as converter from '../src/feishu.js';
import {readDocumentParts} from '../src/importer.js';
import {renderFile} from '../src/formats.js';

const block=(id,type,inner='')=>({id,type,html:'<div data-block-id="'+id+'" data-record-id="record-'+id+'" data-block-type="'+type+'">'+inner+'</div>'});
const line=text=>'<div class="ace-line">'+text+'</div>';
const capture=(blocks,semantic=[],extra={})=>({source:{title:'公开语义样本',docToken:'page-record'},blocks,images:[],code:{},warnings:[],
  semantic:{version:1,recordId:'page-record',blocks:semantic.map(item=>({ready:true,recordId:'record-'+item.id,...item}))},...extra});
const attrs=(html,tag)=>{
  const output=[];function visit(node){if(node.tagName===tag)output.push(Object.fromEntries(node.attrs.map(({name,value})=>[name,value])));for(const child of node.childNodes||[])visit(child);}
  visit(parse(html));return output;
};

test('captured captions become visible figures and SVG assets retain the SVG extension',()=>{
  const result=converter.convertCapture(capture([block('image','image','<img>')],[{id:'image',type:'image',caption:'示例 <图> & 说明'}],
    {images:[{blockId:'image',mime:'image/svg+xml',alt:'示意'}]}));
  assert.equal(converter.imageHtmlPath({blockId:'image',mime:'image/svg+xml'}),'images/image.svg');
  assert.match(result.html,/<figure><img[^>]+><figcaption>示例 &lt;图&gt; &amp; 说明<\/figcaption><\/figure>/u);
  assert.deepEqual(result.warnings,[]);
});

test('source equations and document mentions retain safe semantics without duplicate titles',()=>{
  const semantic={id:'text',type:'text',ops:[{insert:'定义 ',attributes:{bold:true}},
    {insert:'\ufffc',attributes:{equation:'x^2 < y & z'}},
    {insert:'关联文档',attributes:{mention:{title:'关联文档',url:'https://example.test/docx/public'}}}]};
  const result=converter.convertCapture(capture([block('text','text',line('<span>旧文本</span><svg></svg>'))],[semantic]));
  assert.deepEqual(attrs(result.html,'span'),[{'data-export-equation':'x^2 < y & z','data-export-display':'inline'}]);
  assert.match(result.html,/<strong>定义 <\/strong>/u);assert.equal(result.html.split('关联文档').length-1,1);
  assert.deepEqual(attrs(result.html,'a').map(a=>a.href),['https://example.test/docx/public']);
  assert.deepEqual(result.warnings,[]);
  semantic.ops[2].attributes.mention.url='javascript:alert(1)';
  const unsafe=converter.convertCapture(capture([block('text','text',line('旧文本'))],[semantic]));
  assert.equal(attrs(unsafe.html,'a').length,0);assert.ok(unsafe.html.includes('关联文档'));
});

test('ordinary model text does not replace DOM styling and nested semantic blocks keep their structure',()=>{
  const parent=block('parent','callout',line('提示')+block('text','text',line('旧引用')).html);
  const result=converter.convertCapture(capture([block('ordinary','text',line('<span style="text-decoration:line-through">DOM正文</span>')),parent],
    [{id:'ordinary',type:'text',ops:[{insert:'模型正文',attributes:{}}]},
      {id:'text',type:'text',ops:[{insert:'\ufffc',attributes:{mention:{title:'引用标题',url:'https://example.test/docx/public'}}}]}]));
  assert.match(result.html,/<s>DOM正文<\/s>/u);assert.ok(!result.html.includes('模型正文'));
  assert.match(result.html,/<blockquote><p>提示<\/p><p><a[^>]+>引用标题<\/a><\/p><\/blockquote>/u);
});

test('identified plugin sources retain literal Mermaid and every timeline field without executing markup',()=>{
  const result=converter.convertCapture(capture([block('mermaid','isv'),block('timeline','isv')],
    [{id:'mermaid',type:'isv',source:{language:'mermaid',text:'graph TD\n A[<script>]-->B'}},
      {id:'timeline',type:'isv',timeline:[{time:'2026: Q1',title:'标题:完整',text:'第一行\n第二行 <b>'},{time:'Q2',title:'第二项',text:''}]}]));
  assert.match(result.html,/<pre><code class="language-mermaid">graph TD\n A\[&lt;script&gt;\]--&gt;B<\/code><\/pre>/u);
  assert.ok(result.html.includes('2026: Q1'));assert.ok(result.html.includes('标题:完整'));assert.ok(result.html.includes('第一行<br>第二行 &lt;b&gt;'));
  assert.equal(attrs(result.html,'li').length,2);assert.deepEqual(result.warnings,[]);
  const unknown=converter.convertCapture(capture([block('unknown','isv')],[{id:'unknown',type:'isv',source:{language:'javascript',text:'bad'}}]));
  assert.ok(unknown.warnings.some(w=>w.code==='unsupported_block'&&w.label.includes('源码')));
});

test('table cells retain Mermaid and timeline source beside ordinary text through HTML and Markdown export',async()=>{
  const mermaid='graph TD\n A[Public]-->B';
  const inner=block('text','text',line('Cell introduction')).html+
    block('mermaid','isv','<span>Mermaid preview</span>').html+
    '<div>'+block('timeline','isv','<span>Timeline preview</span>').html+'</div>';
  const result=converter.convertCapture(capture([block('table','table','<table><tr><td>'+inner+'</td></tr></table>')],
    [{id:'mermaid',type:'isv',source:{language:'mermaid',text:mermaid}},
      {id:'timeline',type:'isv',timeline:[{time:'Q1',title:'Public event',text:'Public details'}]}]));
  const snapshot=await readDocumentParts({html:result.html});
  assert.deepEqual(snapshot.warnings,[]);
  assert.equal(attrs(result.html,'code')[0]?.class,'language-mermaid');
  const html=await (await renderFile('html',snapshot)).blob.text();
  const files=unzipSync(new Uint8Array(await (await renderFile('markdown',snapshot)).blob.arrayBuffer()));
  const markdown=new TextDecoder().decode(files['公开语义样本.md']);
  for(const output of [html,markdown]) {
    assert.match(output,/<td>Cell introduction<pre><code class="language-mermaid">graph TD/u);
    assert.match(output,/<ol><li><p>Q1 · Public event<\/p><p>Public details<\/p><\/li><\/ol><\/td>/u);
    assert.doesNotMatch(output,/Mermaid preview|Timeline preview/u);
  }
  assert.ok(html.includes('graph TD\n A[Public]--&gt;B'));
  assert.ok(markdown.includes('graph TD&#10; A&#91;Public&#93;--&gt;B'));
});

test('explicit model compensation recovers missing own text but mismatched document metadata is ignored',()=>{
  const missing={id:'missing',type:'text',html:'',semanticOnly:true};
  const semantic=[{id:'missing',type:'text',text:'补偿正文\n完整后行'}];
  assert.match(converter.convertCapture(capture([missing],semantic)).html,/<p>补偿正文<br>完整后行<\/p>/u);
  const input=capture([block('ordinary','text',line('DOM正文'))],[{id:'ordinary',type:'text',ops:[{insert:'模型',attributes:{equation:'x'}}]}]);
  input.semantic.recordId='different-page';
  const result=converter.convertCapture(input);assert.ok(result.html.includes('DOM正文'));assert.equal(attrs(result.html,'span').length,0);
  assert.ok(result.warnings.some(w=>w.code==='missing_block'));
});

test('real attachment bytes yield isolated local download links and safe Unicode paths',()=>{
  assert.equal(typeof converter.attachmentHtmlPath,'function');
  const name='公开报告.xlsx',attachment={blockId:'file',name,mime:'application/octet-stream',bytes:new Uint8Array([1,2,3])};
  assert.equal(converter.attachmentHtmlPath(attachment),'attachments/file-公开报告.xlsx');
  const result=converter.convertCapture(capture([block('file','file',line(name))],[],{attachments:[attachment]}));
  assert.deepEqual(attrs(result.html,'a').map(a=>decodeURIComponent(a.href)),['attachments/file-公开报告.xlsx']);
  assert.ok('download' in attrs(result.html,'a')[0]);assert.deepEqual(result.warnings,[]);
  const unsafe=converter.attachmentHtmlPath({blockId:'../../bad',name:'../CON:秘密?.txt'});
  assert.ok(!/[<>:"\\|?*\u0000-\u001f]/u.test(unsafe));assert.equal(unsafe.split('/').length,2);
  assert.notEqual(unsafe,converter.attachmentHtmlPath({blockId:'bad',name:'../CON:秘密?.txt'}));
  const long=converter.attachmentHtmlPath({blockId:'x'.repeat(200),name:'文'.repeat(300)+'.xlsx'});
  assert.ok(long.endsWith('.xlsx'));assert.ok(long.split('/')[1].length<=160);
});

for(const [name,href] of [
  ['report#v2.pdf','attachments/file-report%23v2.pdf'],
  ['100%.txt','attachments/file-100%25.txt'],
  ['budget%20draft.txt','attachments/file-budget%2520draft.txt'],
  ['公开 报告.txt','attachments/file-%E5%85%AC%E5%BC%80%20%E6%8A%A5%E5%91%8A.txt'],
]) test('attachment filename '+name+' resolves to original bytes in every export format',async()=>{
  const bytes=Uint8Array.of(0,255,1,128,13,10);
  const attachment={blockId:'file',name,bytes};
  const path=converter.attachmentHtmlPath(attachment);
  assert.equal(path,'attachments/file-'+name);
  const result=converter.convertCapture(capture([block('file','file')],[],{attachments:[attachment]}));
  const snapshot=await readDocumentParts({html:result.html,assets:[{path,bytes}]});
  assert.deepEqual(snapshot.warnings,[]);
  assert.equal(attrs(result.html,'a')[0].href,href);
  assert.deepEqual(snapshot.assets,[{path,type:'application/octet-stream',bytes,role:'attachment'}]);
  const html=await (await renderFile('html',snapshot)).blob.text();
  const link=attrs(html,'a')[0];
  assert.equal(link.download,'file-'+name);
  assert.match(link.href,/^data:application\/octet-stream;base64,/u);
  assert.deepEqual(new Uint8Array(Buffer.from(link.href.split(',')[1],'base64')),bytes);
  for(const kind of ['markdown','attachments']) {
    const files=unzipSync(new Uint8Array(await (await renderFile(kind,snapshot)).blob.arrayBuffer()));
    assert.deepEqual(files[path],bytes);
    if(kind==='markdown') assert.ok(new TextDecoder().decode(files['公开语义样本.md']).includes(']('+href+')'));
  }
});

test('file blocks without actual byte arrays retain their missing-original warning',()=>{
  const result=converter.convertCapture(capture([block('file','file',line('公开附件'))],[],{attachments:[{blockId:'file',name:'file.txt',bytes:[]}]}));
  assert.ok(result.warnings.some(w=>w.code==='missing_attachment'));assert.ok(result.html.includes('原件未采集'));
});

test('semantic source fills a ready text placeholder and nested explicit compensation keeps code and list metadata',()=>{
  const nested=block('list','ordered','<div class="ace-line"></div>').html.replace('<div ','<div data-export-semantic-only="1" ')+
    block('code','code').html.replace('<div ','<div data-export-semantic-only="1" ');
  const result=converter.convertCapture(capture([block('placeholder','text'),block('parent','callout',nested)],
    [{id:'placeholder',type:'text',ops:[{insert:'\ufffc',attributes:{equation:'a+b'}}]},
      {id:'list',type:'ordered',text:'补偿步骤',seq:'7'},{id:'code',type:'code',text:'line 1\nline 2'}]));
  assert.equal(attrs(result.html,'span')[0]['data-export-equation'],'a+b');
  assert.equal(attrs(result.html,'ol')[0].start,'7');assert.ok(result.html.includes('<code>line 1\nline 2</code>'));
  assert.deepEqual(result.warnings,[]);
});

test('attachment name truncation never creates an invalid trailing dot or space',()=>{
  for(const separator of [' ','.']) {
    const path=converter.attachmentHtmlPath({blockId:'x',name:'a'.repeat(157)+separator+'b'.repeat(100)});
    assert.ok(!/[. ]$/u.test(path),path);
  }
});

test('matching semantic warnings remain visible in converted output',()=>{
  const input=capture([block('text','text',line('正文'))]);
  input.semantic.warnings=[{code:'missing_block',label:'正文模型尚未完整'}];
  assert.deepEqual(converter.convertCapture(input).warnings,input.semantic.warnings);
});

test('unknown inline element names cannot become semantic wrapper names',()=>{
  const result=converter.convertCapture(capture([block('text','text',line('<constructor>正文</constructor>'))]));
  assert.match(result.html,/<p>正文<\/p>/u);
});
