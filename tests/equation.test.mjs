import assert from 'node:assert/strict';
import test from 'node:test';
import {parse} from 'parse5';
import {unzipSync} from 'fflate';
import {readDocumentParts} from '../src/importer.js';
import {renderFile} from '../src/formats.js';
import {convertCapture} from '../src/feishu.js';

const escaped=source=>source.replace(/[&<>"']/gu,character=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]));
const marker=(source,display='inline',body=escaped(source))=>'<span data-export-equation="'+escaped(source)+'" data-export-display="'+display+'">'+body+'</span>';
const descendants=(nodes,predicate)=>nodes.flatMap(node=>typeof node==='object'?[...(predicate(node)?[node]:[]),...descendants(node.children||[],predicate)]:[]);
const equations=snapshot=>descendants(snapshot.blocks,node=>typeof node.equation==='string');
async function markdown(snapshot) {
  const file=await renderFile('markdown',snapshot);
  const files=unzipSync(new Uint8Array(await file.blob.arrayBuffer()));
  return new TextDecoder().decode(Object.entries(files).find(([path])=>path.endsWith('.md'))[1]);
}

test('公式导入保存有界源码和独立公式枚举，并以源码修复不一致的回退文本',async()=>{
  const source='\\frac{x_1}{2} < y & "z"';
  const snapshot=await readDocumentParts({html:'<p>'+marker(source,'block','旧回退')+marker('a+b','unexpected')+'</p>'});
  assert.deepEqual(equations(snapshot).map(({equation,display,children})=>({equation,display,children})),[
    {equation:source,display:'block',children:[source]},
    {equation:'a+b',display:'inline',children:['a+b']},
  ]);
  const rejected=await readDocumentParts({html:'<p>'+marker('x'.repeat(16385),'block','过长公式正文')+
    marker('x\u0001y','block','控制字符公式正文')+marker('   ','block','空公式正文')+
    '<div data-export-equation="x">非公式</div></p>'});
  assert.equal(equations(rejected).length,0);
  const output=await (await renderFile('html',rejected)).blob.text();
  assert.ok(output.includes('过长公式正文'));assert.ok(output.includes('控制字符公式正文'));assert.ok(output.includes('空公式正文'));
  assert.deepEqual(snapshot.warnings,[]);
});

test('Markdown 为普通行内和独立公式保留 LaTeX 数学定界符及原始反斜杠',async()=>{
  const inline='x_1 + \\frac{a}{b}';
  const block='\\begin{aligned}\na &= b + c \\\\\n-d &= e\n\\end{aligned}';
  const snapshot=await readDocumentParts({html:'<h1>公式</h1><p>前 '+marker(inline)+' 后</p><p>上文'+marker(block,'block')+'下文</p>'});
  assert.equal(await markdown(snapshot),'# 公式\n\n前 $x_1 + \\frac{a}{b}$ 后\n\n上文\n\n$$\n'+block+'\n$$\n\n下文\n');
});

test('HTML 公式源码以静态转义标记保留，重新导入不丢失公式语义',async()=>{
  const source='\\text{"<&>"} + x\nnext';
  const snapshot=await readDocumentParts({html:'<p>'+marker(source,'block')+'</p>'});
  const output=await (await renderFile('html',snapshot)).blob.text();
  assert.ok(output.includes('data-export-equation="'+escaped(source)+'"'));
  assert.ok(output.includes('data-export-display="block"'));
  assert.ok(output.includes('>'+escaped(source)+'</span>'));
  assert.doesNotMatch(output,/<script|<iframe|onclick=/u);
  const roundtrip=await readDocumentParts({html:output});
  assert.deepEqual(equations(roundtrip),equations(snapshot));
});

test('可信公式源码取代旧渲染预览时不把被丢弃的SVG预览报成内容缺失',async()=>{
  const snapshot=await readDocumentParts({html:'<p>'+marker('a^2+b^2','inline','<svg><text>旧公式预览</text></svg>')+'</p>'});
  assert.equal(equations(snapshot)[0]?.equation,'a^2+b^2');
  assert.deepEqual(snapshot.warnings,[]);
  const output=await (await renderFile('html',snapshot)).blob.text();
  assert.doesNotMatch(output,/<svg|旧公式预览|导出提示/u);
});

test('有定界符、HTML或表格冲突的公式在Markdown中保留可读静态源码',async()=>{
  const sources=['\\text{cost $5}','x\n+y','<img src=x onerror=alert(1)>','a | b'];
  const snapshot=await readDocumentParts({html:'<p>'+sources.slice(0,3).map(source=>marker(source)).join(' ')+'</p>'+
    '<table><tr><th>表达式</th></tr><tr><td>'+marker(sources[3])+'</td></tr></table>'});
  const output=await markdown(snapshot);
  assert.ok(output.includes('data-export-equation="\\text{cost $5}"'));
  assert.ok(output.includes('data-export-equation="x&#10;+y"'));
  assert.ok(output.includes('&lt;img src=x onerror=alert(1)&gt;'));
  assert.doesNotMatch(output,/<img src=x/u);
  assert.ok(output.includes('data-export-equation="a | b"'));
});

test('飞书模型生成的公式marker经过导入和HTML再导入后保留精确源码',async()=>{
  const source='\\frac{a_1}{b} < c & \\text{"标签"}';
  const result=convertCapture({source:{title:'公式模型',docToken:'page'},images:[],code:{},warnings:[],
    blocks:[{id:'equation',type:'text',html:'<div data-block-id="equation" data-record-id="record-equation" data-block-type="text"><div class="ace-line">旧文本</div></div>'}],
    semantic:{version:1,recordId:'page',blocks:[{id:'equation',recordId:'record-equation',type:'text',ready:true,
      ops:[{insert:'\ufffc',attributes:{equation:source,display:'block'}}]}]}});
  const snapshot=await readDocumentParts({html:result.html});
  assert.equal(equations(snapshot)[0]?.equation,source);
  assert.equal(equations(snapshot)[0]?.display,'block');
  const output=await (await renderFile('html',snapshot)).blob.text();
  const elements=[];
  const visit=node=>{if(node.tagName==='span')elements.push(node);for(const child of node.childNodes||[])visit(child);};visit(parse(output));
  assert.equal(elements[0].attrs.find(attr=>attr.name==='data-export-equation').value,source);
  assert.equal(equations(await readDocumentParts({html:output}))[0]?.equation,source);
});
