import assert from 'node:assert/strict';
import test from 'node:test';
import { parse } from 'parse5';
import { unzipSync } from 'fflate';
import { convertCapture } from '../src/feishu.js';
import { renderBundle, renderFile } from '../src/formats.js';
import { readDocumentParts } from '../src/importer.js';

const textBlock = (content) => ({id:'2',type:'text',html:'<div><div class="ace-line">'+content+'</div></div>'});
const capture = (blocks) => ({source:{title:'富内容测试'},blocks,code:{},images:[],warnings:[]});
const attr = (node,name) => node.attrs?.find(item=>item.name===name)?.value;
function elements(html,tag) {
  const result=[];
  function visit(node) { if(node.tagName===tag)result.push(node);for(const child of node.childNodes||[])visit(child); }
  visit(parse(html));return result;
}
const model = (blocks) => ({version:1,title:'阅读示例',blocks,assets:[],warnings:[]});

test('未知行内图形保留转义的语义文本或占位，并明确提示降级', () => {
  const semantic=convertCapture(capture([textBlock('公式：<svg aria-label="x &lt; y"><script>bad()</script><path d="M0 0"/></svg> 后文')]));
  assert.match(semantic.html,/x &lt; y/);
  assert.equal(semantic.warnings.filter(note=>note.code==='unsupported_block').length,1);
  assert.doesNotMatch(semantic.html,/<svg|<script|bad\(\)/);
  const unknown=convertCapture(capture([textBlock('图形：<svg><path d="M0 0"/></svg> 后文')]));
  assert.match(unknown.html,/未转换的行内图形/);
  assert.equal(unknown.warnings[0].code,'unsupported_block');
});

test('公式使用可用的TeX或MathML说明文本，不回传可执行图形', () => {
  const result=convertCapture(capture([textBlock(
    '<span data-latex="a^2 + b^2"><svg><path d="M0 0"/></svg></span> '+
    '<math><semantics><mi>x</mi><annotation encoding="application/x-tex">x^2</annotation></semantics></math>',
  )]));
  assert.match(result.html,/a\^2 \+ b\^2/);
  assert.match(result.html,/x\^2/);
  assert.doesNotMatch(result.html,/<svg|<math|<annotation/);
  assert.equal(result.warnings.filter(note=>note.code==='unsupported_block').length,2);
  const accessible=convertCapture(capture([textBlock('<span role="math" aria-label="x + y"><svg aria-hidden="true"><path/></svg></span>')]));
  assert.match(accessible.html,/x \+ y/);
  assert.equal(accessible.warnings[0].code,'unsupported_block');
});

test('控件与链接装饰图标保持安静，不把可见正文当控件删除', () => {
  const result=convertCapture(capture([textBlock(
    '<button><svg aria-label="操作"><path/></svg></button>'+
    '<span role="toolbar"><svg aria-label="操作"><path/></svg></span>'+
    '<svg aria-hidden="true"><path/></svg><svg role="presentation"><path/></svg>'+
    '<a href="https://example.org/guide"><svg class="ud-icon"><path/></svg>教程</a>'+
    '<svg data-icon="file"><path/></svg><span contenteditable="false">保留序号</span>',
  )]));
  assert.deepEqual(result.warnings,[]);
  assert.match(result.html,/教程<\/a>/);
  assert.match(result.html,/保留序号/);
  assert.doesNotMatch(result.html,/操作|未转换的行内图形/);
});

test('折叠箭头作为控件跳过，外层折叠容器中的正文和真正公式仍保留', () => {
  const arrow='<div class="svg-wrapper"><svg width="16" height="16"><path d="M0 0L8 8L16 0"/></svg></div>';
  const controls='<div class="fold-wrapper can-fold fold-block-id-7">'+
    '<div class="fold-wrapper can-fold fold-block-id-7 fold-handler-wrapper"><div class="fold-handler">'+arrow+'</div></div>'+
    '<span contenteditable="false">保留标题与正文</span></div>';
  const result=convertCapture(capture([textBlock(controls)]));
  assert.deepEqual(result.warnings,[]);
  assert.match(result.html,/保留标题与正文/);
  assert.doesNotMatch(result.html,/未转换的行内图形|<svg/);
  const formula=convertCapture(capture([textBlock(controls+'<svg aria-label="x + y"><path/></svg>')]));
  assert.equal(formula.warnings.filter(note=>note.code==='unsupported_block').length,1);
  assert.match(formula.html,/x \+ y/);
  assert.match(formula.html,/保留标题与正文/);
});

test('文件块保留安全的名称与HTTP链接，原件未采集的提示进入正文和清单', async () => {
  const result=convertCapture(capture([
    {id:'3',type:'file',html:'<div><a href="https://example.org/manual.pdf">操作手册.pdf</a><button>删除</button></div>'},
    {id:'4',type:'file',html:'<div><a href="javascript:alert(1)">危险链接.txt</a></div>'},
    {id:'5',type:'table',html:'<div><table><tr><td><div data-block-type="file" data-block-id="6"><a href="https://example.org/table.csv">记录.csv</a></div></td></tr></table></div>'},
  ]));
  assert.equal(result.warnings.filter(note=>note.code==='missing_attachment').length,3);
  assert.match(result.html,/https:\/\/example\.org\/manual\.pdf/);
  assert.match(result.html,/https:\/\/example\.org\/table\.csv/);
  assert.match(result.html,/危险链接\.txt/);
  assert.doesNotMatch(result.html,/javascript:|alert\(1\)|删除/);
  const imported=await readDocumentParts({html: result.html});
  const output=renderBundle(['attachments','html'],imported);
  const entries=unzipSync(new Uint8Array(await output.blob.arrayBuffer()));
  const manifest=new TextDecoder().decode(entries['manifest.txt']);
  assert.match(manifest,/原件未采集/);
  assert.equal(Object.keys(entries).filter(name=>name.startsWith('attachments/')).length,0);
});

test('长文离线HTML目录折叠展示，重复和中文标题有唯一稳定锚点', async () => {
  const snapshot=model([
    {tag:'h1',children:['阅读示例']},
    {tag:'h2',children:['重复 & <标题>']},
    {tag:'p',children:['正文内容'.repeat(280)]},
    {tag:'h2',children:['重复 & <标题>']},
    {tag:'h3',children:['后续说明']},
  ]);
  const html=await (await renderFile('html',snapshot)).blob.text();
  assert.equal(html,await (await renderFile('html',snapshot)).blob.text());
  assert.match(html,/<meta name="viewport" content="width=device-width, initial-scale=1">/);
  const nav=elements(html,'nav').find(node=>attr(node,'data-feishu-export-navigation')==='1');
  assert.ok(nav);
  assert.equal(attr(elements(html,'details')[0],'open'),undefined);
  const headings=[...elements(html,'h1'),...elements(html,'h2'),...elements(html,'h3')];
  const ids=headings.map(node=>attr(node,'id'));
  assert.equal(new Set(ids).size,ids.length);
  assert.ok(ids.every(id=>/^fle-section-\d+$/.test(id)));
  const hrefs=elements(html,'a').map(node=>attr(node,'href'));
  assert.equal(hrefs.length,3);
  assert.ok(hrefs.every(href=>href.startsWith('#')&&ids.includes(href.slice(1))));
  assert.match(html,/重复 &amp; &lt;标题&gt;/);
  assert.match(html,/script-src 'none'; connect-src 'none'/);
  assert.doesNotMatch(html,/<script/);
});

test('短文不显示目录，宽表和代码使用离线阅读容器，Markdown保持原结构', async () => {
  const snapshot=model([
    {tag:'h2',children:['简短说明']},
    {tag:'table',children:[{tag:'tbody',children:[{tag:'tr',children:[{tag:'td',colspan:2,children:[{tag:'s',children:['删除线内容']}]}]}]}]},
    {tag:'pre',children:[{tag:'code',language:'text',children:['long_code_value'.repeat(20)]}]},
  ]);
  const html=await (await renderFile('html',snapshot)).blob.text();
  assert.equal(elements(html,'nav').length,0);
  assert.match(html,/<div class="table-scroll"><table>/);
  assert.match(html,/pre\{[^}]*white-space:pre;[^}]*overflow:auto/);
  assert.match(html,/@media print/);
  assert.match(html,/<td colspan="2"><s>删除线内容<\/s><\/td>/);
  const mdZip=renderBundle(['markdown'],snapshot);
  const mdEntries=unzipSync(new Uint8Array(await mdZip.blob.arrayBuffer()));
  const markdown=new TextDecoder().decode(Object.values(mdEntries)[0]);
  assert.match(markdown,/<table><tbody><tr><td colspan="2"><s>删除线内容<\/s><\/td>/);
  assert.doesNotMatch(markdown,/table-scroll|fle-section-|data-feishu-export-navigation/);
});
