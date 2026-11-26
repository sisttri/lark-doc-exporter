import assert from 'node:assert/strict';
import test from 'node:test';
import {parse} from 'parse5';
import {convertCapture} from '../src/feishu.js';

const line = text => '<div class="ace-line">' + text + '</div>';
const block = (id,type,inner) => ({id,type,html:'<div data-block-id="' + id + '" data-block-type="' + type + '">' + inner + '</div>'});
const text = (id,value) => block(id,'text',line(value));
const list = (id,type,value,children='',number) => block(id,type,
  '<div class="list">' + (number===undefined ? '' : '<div class="order">' + number + '.</div>') +
  '<div class="list-content">' + line(value) + '</div></div><div class="children">' + children + '</div>');
const image = (id,type='image') => block(id,type,type==='image' ? '<img alt="示例图">' : '<svg><path d="M0 0h1"></path></svg>');
const table = (id,inner) => block(id,'table','<table><tbody><tr><td>' + inner + '</td></tr></tbody></table>');
const capture = (blocks,extra={}) => ({source:{title:'结构测试'},blocks,code:{},images:[],warnings:[],...extra});
function elements(root,tag) {
  if(typeof root==='string') root=parse(root);
  const found=[];
  function visit(node) {
    if(node.tagName===tag) found.push(node);
    for(const child of node.childNodes || []) visit(child);
  }
  visit(root);return found;
}
const attr = (node,key) => node.attrs?.find(item=>item.name===key)?.value || '';
const content = node => node.nodeName==='#text' ? node.value : (node.childNodes || []).map(content).join('');
const ownElements = node => (node.childNodes || []).filter(child=>child.tagName);

test('嵌套列表保留三层父子关系、混合类型和每层独立编号', () => {
  const leaf=list('leaf','bullet','<span style="text-decoration:line-through">叶子</span>');
  const first=list('first','ordered','子项甲',leaf.html,7);
  const second=list('second','ordered','子项乙','',8);
  const parent=list('parent','ordered','父项',first.html+second.html,4);
  const input=capture([parent,list('sibling','ordered','父级后项','',5)]),before=JSON.stringify(input);
  const result=convertCapture(input),ordered=elements(result.html,'ol');
  assert.equal(ordered.length,2);assert.deepEqual(ordered.map(node=>attr(node,'start')),['4','7']);
  const roots=ownElements(ordered[0]);assert.equal(roots.length,2);
  assert.equal(content(roots[0]),'父项子项甲叶子子项乙');assert.equal(content(roots[1]),'父级后项');
  assert.equal(ownElements(ordered[1]).length,2);
  assert.equal(elements(ordered[1],'ul').length,1);assert.equal(elements(result.html,'s').length,1);
  assert.deepEqual(result.warnings,[]);assert.equal(JSON.stringify(input),before);
});

test('列表项内部的正文、图片、代码和后续子列表按原顺序输出一次', () => {
  const item=list('parent','bullet','父项',text('paragraph','子段落').html+image('picture').html+
    block('code','code','').html+list('nested','ordered','子步骤','',3).html);
  const result=convertCapture(capture([item],{images:[{blockId:'picture',mime:'image/png',alt:'示例图'}],
    code:{code:{lines:[{num:1,text:'example()'}]}}}));
  const parent=elements(result.html,'li')[0];
  assert.deepEqual(ownElements(parent).map(node=>node.tagName),['p','img','pre','ol']);
  assert.equal(elements(parent,'img').length,1);assert.equal(elements(parent,'code').length,1);
  assert.equal(content(elements(parent,'p')[0]),'子段落');assert.deepEqual(result.warnings,[]);
});

test('Callout 自身文字和各类子块交错保留，不把后代正文压成说明文字', () => {
  const callout=block('notice','callout',line('说明开头')+
    image('board','whiteboard').html+text('paragraph','正文段落').html+
    block('code','code','').html+table('table',line('单元格')).html+
    list('item','bullet','项目').html+line('说明结尾'));
  const result=convertCapture(capture([callout],{images:[{blockId:'board',mime:'image/png',alt:'示例画板'}],
    code:{code:{lines:[{num:1,text:'const value = 1;'}]}}}));
  const quote=elements(result.html,'blockquote')[0];
  assert.deepEqual(ownElements(quote).map(node=>node.tagName),['p','img','p','pre','table','ul','p']);
  for(const marker of ['说明开头','正文段落','const value = 1;','单元格','项目','说明结尾']) {
    assert.equal(content(quote).split(marker).length-1,1,marker);
  }
  assert.deepEqual(result.warnings,[]);
});

test('分栏按各栏 DOM 阅读顺序展开，保留嵌套 Callout、列表和图片', () => {
  const left=block('left','grid_column',text('left-top','左栏第一段').html+
    block('notice','callout',line('左栏提示')+list('left-item','bullet','左栏项目').html).html);
  const right=block('right','grid_column',text('right-top','右栏第一段').html+image('diagram','diagram').html);
  const grid=block('grid','grid',left.html+'<div hidden>'+text('hidden','隐藏栏').html+'</div>'+right.html);
  const result=convertCapture(capture([text('before','分栏前'),grid,text('after','分栏后')],
    {images:[{blockId:'diagram',mime:'image/png',alt:'示例流程图'}],
      warnings:[{code:'unsupported_block',label:'未适配的块类型：grid'}]}));
  const body=elements(result.html,'body')[0];
  assert.equal(content(body),'结构测试分栏前左栏第一段左栏提示左栏项目右栏第一段分栏后');
  assert.deepEqual(ownElements(body).map(node=>node.tagName),['h1','p','p','blockquote','p','img','p']);
  assert.deepEqual(result.warnings,[]);
});

test('表格单元格中的分栏与 Callout 复用结构转换，子标题仍按单元格语义处理', () => {
  const inside=block('grid','grid',block('column','grid_column',
    block('notice','callout',line('格内提示')+block('heading','heading2',line('格内标题')).html+
      list('parent','bullet','格内父项',list('child','ordered','格内子项','',2).html).html+image('picture').html).html).html);
  const result=convertCapture(capture([table('table',inside.html)],{images:[{blockId:'picture',mime:'image/png'}]}));
  const cell=elements(result.html,'td')[0];
  assert.equal(elements(cell,'blockquote').length,1);assert.equal(elements(cell,'ul').length,1);
  assert.equal(elements(cell,'ol').length,1);assert.equal(elements(cell,'img').length,1);
  assert.equal(elements(cell,'h2').length,0);assert.equal(content(elements(cell,'strong')[0]),'格内标题');
  assert.deepEqual(result.warnings,[]);
});

test('引用内分栏和 Callout 的未知子块及缺图仍有准确提示', () => {
  const reference=block('reference','synced_reference',block('grid','grid',block('column','grid_column',
    block('notice','callout',line('提示正文')+block('unknown','databaseview',line('未知正文')).html+
      image('missing','diagram').html).html).html).html);
  const result=convertCapture(capture([reference]));
  assert.match(result.html,/<blockquote><p>提示正文<\/p><\/blockquote>/u);
  assert.deepEqual(result.warnings,[
    {code:'unsupported_block',label:'块 unknown 未转换（databaseview）'},
    {code:'missing_image',label:'图表块 missing 缺少素材'},
  ]);
});

test('父列表没有自身编号时不会误用后代编号，连续列表重启时保持独立起点', () => {
  const parent=list('parent','ordered','无显式父编号',list('child','ordered','子列表','',6).html);
  const result=convertCapture(capture([parent,list('next','ordered','父级第二项','',2),
    list('restart','ordered','重新开始','',1),list('last','ordered','重启第二项','',2)]));
  assert.deepEqual(elements(result.html,'ol').map(node=>attr(node,'start')),['','6','']);
  const body=elements(result.html,'body')[0];
  assert.equal(ownElements(body).filter(node=>node.tagName==='ol').length,2);
  assert.deepEqual(result.warnings,[]);
});

test('空分栏不会冒充完整正文，未知的真实块仍单独告警', () => {
  const result=convertCapture(capture([block('empty','grid',''),block('unknown','unknown-widget','')]));
  assert.deepEqual(result.warnings,[
    {code:'unsupported_block',label:'分栏容器 empty 尚未读取到已渲染正文'},
    {code:'unsupported_block',label:'块 unknown 未转换（unknown-widget）'},
  ]);
});

test('表格里的隐藏结构容器及其未知块不输出，分栏百分比与按钮不是正文', () => {
  const hidden=block('hidden-grid','grid',block('hidden-column','grid_column',
    text('hidden-text','不应导出').html+block('hidden-widget','unknown-widget','').html).html);
  hidden.html=hidden.html.replace('<div ','<div hidden ');
  const shown=block('shown-grid','grid',block('shown-column','grid_column',
    '<span class="grid-column-percent">50%</span><button>'+line('编辑按钮')+'</button>'+text('shown-text','可见正文').html).html);
  const result=convertCapture(capture([table('table',hidden.html+shown.html)]));
  const cell=elements(result.html,'td')[0];
  assert.equal(content(cell),'可见正文');assert.deepEqual(result.warnings,[]);
});

test('自身没有文字的父列表仍保留子列表和已采图形，隐藏子项不会增加编号', () => {
  const child=list('child','ordered','实际子项','',3);
  const hidden=list('hidden','ordered','隐藏子项','',4);
  const parent=list('parent','bullet','',child.html+hidden.html.replace('<div ','<div aria-hidden="true" ')+image('board','whiteboard').html);
  const result=convertCapture(capture([parent],{images:[{blockId:'board',mime:'image/png'}]}));
  const root=elements(result.html,'ul')[0];
  assert.equal(elements(root,'li').length,2);assert.equal(content(root),'实际子项');
  assert.equal(elements(root,'img').length,1);assert.equal(attr(elements(root,'ol')[0],'start'),'3');
  assert.deepEqual(result.warnings,[]);
});
