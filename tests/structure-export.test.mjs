import assert from 'node:assert/strict';
import test from 'node:test';
import {unzipSync} from 'fflate';
import {parse} from 'parse5';
import pdfmake from 'pdfmake';
import {convertCapture} from '../src/feishu.js';
import {readDocumentParts} from '../src/importer.js';
import {renderBundle} from '../src/formats.js';
import {pdfDefinition} from '../src/pdf.js';

const title='Structure sample';
const pngBase64='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGN4oKDwHwAFJAIgPqioaAAAAABJRU5ErkJggg==';
const png=Uint8Array.from(Buffer.from(pngBase64,'base64'));
const ace=text => '<div class="ace-line">'+text+'</div>';
const block=(id,type,body) => ({id,type,html:'<div data-block-id="'+id+'" data-block-type="'+type+'">'+body+'</div>'});
const item=(id,type,text,order,children='') => block(id,type,
  '<div class="list"><div class="order">'+(order ?? '')+'</div><div class="list-content">'+ace(text)+'</div></div>'+children);
const image=block('pic','image','<img alt="Sample figure">');
const imageMetadata={blockId:'pic',mime:'image/png',width:1,height:1,alt:'Sample figure'};

async function exported(blocks,extra={}) {
  const converted=convertCapture({source:{title},blocks,images:[],code:{},warnings:[],...extra});
  const snapshot=await readDocumentParts({html:converted.html,
    assets:extra.images?.length ? [{path:'images/pic.png',bytes:png}] : []});
  const output=renderBundle(['markdown','html','attachments'],snapshot);
  const files=unzipSync(new Uint8Array(await output.blob.arrayBuffer()));
  return {converted,snapshot,files,markdown:new TextDecoder().decode(files[title+'.md']),
    html:new TextDecoder().decode(files[title+'.html'])};
}

function nodes(root,predicate) {
  const found=[];
  function visit(node) {if(predicate(node))found.push(node);for(const child of node.childNodes ?? node.children ?? [])visit(child);}
  visit(root);return found;
}
const attribute=(node,name) => node.attrs?.find(item=>item.name===name)?.value;

test('nested captured lists retain hierarchy and independent numbering in Markdown, HTML and PDF', async () => {
  const leafA=item('leaf-a','ordered','Leaf C','4.');
  const leafB=item('leaf-b','ordered','Leaf D','5.');
  const child=item('child','bullet','Child B',null,leafA.html+leafB.html);
  const parent=item('parent','ordered','Parent A','9.',child.html);
  const sibling=item('sibling','ordered','Parent E','10.');
  const result=await exported([parent,sibling]);
  assert.deepEqual(result.snapshot.warnings,[]);
  assert.equal(result.markdown,'# Structure sample\n\n9. Parent A\n   - Child B\n     4. Leaf C\n     5. Leaf D\n10. Parent E\n');
  const document=parse(result.html);
  const lists=nodes(document,node=>['ul','ol'].includes(node.tagName));
  assert.deepEqual(lists.map(node=>[node.tagName,attribute(node,'start')]),[['ol','9'],['ul',undefined],['ol','4']]);
  assert.equal(nodes(lists[0],node=>node.tagName==='li').length,5);
  const {doc}=pdfDefinition(result.snapshot);
  const outer=doc.content.find(node=>node.ol);
  assert.equal(outer.start,9);assert.equal(outer.ol.length,2);
  const nested=outer.ol[0].stack.find(node=>node.ul);
  assert.equal(nested.ul.length,1);
  const ordered=nested.ul[0].stack.find(node=>node.ol);
  assert.equal(ordered.start,4);assert.equal(ordered.ol.length,2);
});

test('Callout keeps image, code and styled table in order throughout the output formats', async () => {
  const code=block('code','code','<button class="code-block-header-btn"><span>Bash</span></button>');
  const table=block('table','table','<table><colgroup><col width="1"><col width="3"></colgroup>'+
    '<tr><th>Column A</th><th>Column B</th></tr><tr><td style="background-color:#123;color:#fff;text-align:right">Cell A</td><td>Cell B</td></tr></table>');
  const callout=block('callout','callout',ace('Callout introduction')+image.html+code.html+table.html+ace('Callout ending'));
  const result=await exported([callout],{images:[imageMetadata],code:{code:{lines:[{num:1,text:'printf sample'},{num:2,text:'echo complete'}]}}});
  assert.deepEqual(result.snapshot.warnings,[]);
  const expected=['Callout introduction','![Sample figure](images/pic.png)','> ```bash\n> printf sample\n> echo complete\n> ```','<table','Callout ending'];
  let previous=-1;
  for(const part of expected) {
    const index=result.markdown.indexOf(part);assert.ok(index>previous,part);previous=index;
  }
  assert.match(result.markdown,/<col style="width:25%"><col style="width:75%">/u);
  assert.match(result.markdown,/<td style="background-color:#112233;color:#ffffff;text-align:right">Cell A<\/td>/u);
  const document=parse(result.html),quote=nodes(document,node=>node.tagName==='blockquote')[0];
  assert.ok(quote);
  assert.equal(nodes(quote,node=>node.tagName==='img').length,1);
  assert.equal(nodes(quote,node=>node.tagName==='pre').length,1);
  assert.equal(nodes(quote,node=>node.tagName==='table').length,1);
  assert.deepEqual(result.files['images/pic.png'],png);
  const prepared={images:{pixel:'data:image/png;base64,'+pngBase64},names:new Map([['images/pic.png','pixel']]),
    dimensions:new Map([['images/pic.png',{width:1,height:1}]])};
  const {doc}=pdfDefinition(result.snapshot,prepared);
  const quoteBlock=doc.content.find(node=>node.color==='#4b6057');
  assert.ok(quoteBlock);
  assert.equal(quoteBlock.stack.filter(node=>node.image==='pixel').length,1);
  assert.equal(quoteBlock.stack.filter(node=>node.preserveLeadingSpaces).length,1);
  const renderedTable=quoteBlock.stack.find(node=>node.table).table;
  assert.equal(renderedTable.headerRows,1);
  assert.ok(Math.abs(renderedTable.widths[0]+8-(595.28-42-42-14)*.25)<.001);
  assert.equal(renderedTable.body[1][0].fillColor,'#112233');
  assert.equal(renderedTable.body[1][0].alignment,'right');
});

test('linear grid export keeps complete column contents and renders nested lists in an actual PDF', async () => {
  const left=block('left','grid_column',block('left-title','text',ace('Left column')).html+
    item('left-item','ordered','Column list','7.',item('left-child','bullet','Nested column child').html).html);
  const right=block('right','grid_column',block('right-title','text',ace('Right column')).html+image.html);
  const result=await exported([block('grid','grid',left.html+right.html)],{images:[imageMetadata]});
  assert.deepEqual(result.snapshot.warnings,[]);
  const positions=['Left column','7. Column list','Nested column child','Right column','![Sample figure](images/pic.png)']
    .map(text=>result.markdown.indexOf(text));
  assert.ok(positions.every((position,index)=>position>=0 && (!index || position>positions[index-1])));
  for(const text of ['Left column','Column list','Nested column child','Right column']) {
    assert.equal(result.markdown.split(text).length-1,1,text);
  }
  pdfmake.setUrlAccessPolicy(()=>false);
  pdfmake.setLocalAccessPolicy(path=>/^Helvetica(?:-Bold|-Oblique|-BoldOblique)?$/.test(path));
  pdfmake.addFonts({Noto:{normal:'Helvetica',bold:'Helvetica-Bold',italics:'Helvetica-Oblique',bolditalics:'Helvetica-BoldOblique'}});
  const prepared={images:{pixel:'data:image/png;base64,'+pngBase64},names:new Map([['images/pic.png','pixel']]),
    dimensions:new Map([['images/pic.png',{width:1,height:1}]])};
  const {doc}=pdfDefinition(result.snapshot,prepared);
  const pdf=pdfmake.createPdf(doc),stream=await pdf.getStream();
  const items=stream._pdfMakePages.flatMap(page=>page.items);
  const lines=items.filter(item=>item.type==='line').map(({item})=>({x:item.x,text:item.inlines.map(run=>run.text).join('')}));
  for(const text of ['Left column','Column list','Nested column child','Right column']) assert.ok(lines.some(line=>line.text===text),text);
  assert.ok(lines.find(line=>line.text==='Nested column child').x>lines.find(line=>line.text==='Column list').x);
  assert.equal(items.filter(item=>item.type==='image').length,1);
  assert.ok((await pdf.getBuffer()).subarray(0,5).equals(Buffer.from('%PDF-')));
});
