import test from 'node:test';
import assert from 'node:assert/strict';
import {unzipSync} from 'fflate';
import {sanitizeSvg} from '../src/svg.js';
import {readDocumentParts,limits} from '../src/importer.js';
import {renderFile,renderBundle} from '../src/formats.js';
import {prepareImages} from '../src/pdf.js';
import {pngDataUrl} from './helpers/whiteboard.mjs';

const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="200px" height="100px" viewBox="-0.5 -0.5 200 100">'+
  '<defs><linearGradient id="tone"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#08f"/></linearGradient></defs>'+
  '<rect width="200" height="100" fill="url(#tone)"/>'+
  '<foreignObject x="5" y="5" width="190" height="90"><div xmlns="http://www.w3.org/1999/xhtml" style="display:flex;align-items:center;justify-content:center;font-size:16px;white-space:normal">'+
  '<span><strong>示例标签</strong><br/>第二行 &amp; details</span></div></foreignObject></svg>';
const encode = value => new TextEncoder().encode(value);
const png = Uint8Array.from(Buffer.from(pngDataUrl.split(',')[1],'base64'));
const imageHtml = '<h1>SVG sample</h1><figure><img src="images/diagram.svg" alt="Diagram"><figcaption>Caption</figcaption></figure>';

test('静态 SVG 保留矢量坐标、foreignObject 完整标签和本地渐变，规范输出可重复校验', () => {
  const result = sanitizeSvg(svg);
  assert.ok(result);
  assert.equal(result.width,200);assert.equal(result.height,100);
  assert.match(result.source,/viewBox="-0\.5 -0\.5 200 100"/u);
  assert.match(result.source,/<foreignObject/u);
  assert.match(result.source,/<strong>示例标签<\/strong>/u);
  assert.match(result.source,/第二行 &amp; details/u);
  assert.match(result.source,/xmlns="http:\/\/www.w3.org\/1999\/xhtml"/u);
  assert.match(result.source,/display:flex;align-items:center;justify-content:center/u);
  assert.deepEqual(sanitizeSvg(result.source),result);
});

test('SVG 支持有限的本地 use 与裁剪，不读取外部资源', () => {
  const value='<svg width="100" height="100" viewBox="0 0 100 100"><defs><path id="shape" d="M0 0 L50 50"/>'+
    '<clipPath id="crop"><rect width="80" height="80"/></clipPath></defs><g clip-path="url(#crop)"><use href="#shape"/></g></svg>';
  const result=sanitizeSvg(value);assert.ok(result);
  assert.match(result.source,/<use href="#shape"/u);assert.match(result.source,/clip-path="url\(#crop\)"/u);
  assert.match(result.source,/xmlns="http:\/\/www.w3.org\/2000\/svg"/u);
});

test('SVG 静态文字属性和十六进制颜色不被当作可执行 CSS 或指数尺寸', () => {
  const source='<svg width="20" height="20" viewBox="0 0 20 20" aria-label="mail@example.invalid">'+
    '<foreignObject width="20" height="20"><div xmlns="http://www.w3.org/1999/xhtml" title="Use url(example) as text" '+
    'style="color:#3c6e71;background-color:#46e17f;font-size:12px">label</div></foreignObject></svg>';
  const result=sanitizeSvg(source);assert.ok(result);
  assert.match(result.source,/aria-label="mail@example\.invalid"/u);
  assert.match(result.source,/color:#3c6e71;background-color:#46e17f/u);
});

test('SVG 拒绝主动内容、外部地址、CSS 逃逸、未知命名空间及处理指令', () => {
  const body=value => '<svg width="20" height="20" viewBox="0 0 20 20">'+value+'</svg>';
  for(const value of [
    body('<script>alert(1)</script>'),body('<animate attributeName="x" dur="1s"/>'),
    body('<rect onclick="alert(1)"/>'),body('<use href="https://example.invalid/x.svg#shape"/>'),
    body('<rect fill="url(https://example.invalid/x)"/>'),
    body('<rect style="fill:u\\rl(https://example.invalid/x)"/>'),
    body('<rect style="background-image:image-set(\'https://example.invalid/x\' 1x)"/>'),
    body('<style>@import "https://example.invalid/x";</style>'),
    body('<foreignObject><iframe src="https://example.invalid/x"/></foreignObject>'),
    body('<foreignObject><div xmlns="urn:unknown">label</div></foreignObject>'),
    '<?xml-stylesheet href="https://example.invalid/x"?>'+body('<rect/>'),
    '<!DOCTYPE svg [<!ENTITY label SYSTEM "https://example.invalid/x">]>'+body('<text>&label;</text>'),
    body('<g xmlns:x="urn:unknown"><x:script/></g>'),
  ]) assert.equal(sanitizeSvg(value),null,value.slice(0,100));
});

test('SVG 拒绝循环引用、指数 use 扩张、重复或不存在的引用 ID', () => {
  const body=value => '<svg width="20" height="20" viewBox="0 0 20 20">'+value+'</svg>';
  for(const value of [
    body('<g id="loop"><use href="#loop"/></g>'),
    body('<g id="a"><use href="#b"/></g><g id="b"><use href="#a"/></g>'),
    body('<rect id="same"/><circle id="same"/>'),body('<use href="#absent"/>'),
    body('<defs>'+Array.from({length:18},(_,i)=>'<g id="n'+i+'">'+(i ? '<use href="#n'+(i-1)+'"/><use href="#n'+(i-1)+'"/>' : '<rect width="1" height="1"/>')+'</g>').join('')+'</defs><use href="#n17"/>'),
  ]) assert.equal(sanitizeSvg(value),null);
});

test('SVG 数值、字节、节点和深度边界在序列化前受限', () => {
  for(const value of [
    '<svg width="NaN" height="1" viewBox="0 0 1 1"/>',
    '<svg width="1" height="1" viewBox="0 0 -1 1"/>',
    '<svg width="1" height="1" viewBox="0 0 1 1"><path d="M0 0L1e999 1"/></svg>',
    '<svg width="1" height="1" viewBox="0 0 1 1">'+ '<g>'.repeat(110)+'<text>deep</text>'+'</g>'.repeat(110)+'</svg>',
    '<svg width="1" height="1" viewBox="0 0 1 1">'+'<rect/>'.repeat(20001)+'</svg>',
    '<svg width="1" height="1" viewBox="0 0 1 1"><text>'+'x'.repeat(2*1024*1024)+'</text></svg>',
  ]) assert.equal(sanitizeSvg(value),null);
});

test('SVG 主资产通过内存校验、HTML、Markdown 与素材包，PNG 回退不作为额外文件打包', async () => {
  const result=sanitizeSvg(svg);assert.ok(result);
  const model=await readDocumentParts({html:imageHtml,assets:[{path:'images/diagram.svg',bytes:encode(svg),rasterFallback:{bytes:png}}]});
  assert.deepEqual(model.warnings,[]);assert.equal(model.assets.length,1);
  assert.equal(model.assets[0].type,'image/svg+xml');assert.deepEqual(model.assets[0].bytes,encode(result.source));
  assert.deepEqual(model.assets[0].rasterFallback,{type:'image/png',bytes:png});
  const html=await (await renderFile('html',model)).blob.text();
  assert.match(html,/src="data:image\/svg\+xml;base64,/u);assert.doesNotMatch(html,/<object|<iframe|<svg/u);
  const files=unzipSync(new Uint8Array(await renderBundle(['markdown','attachments'],model).blob.arrayBuffer()));
  assert.deepEqual(files['images/diagram.svg'],encode(result.source));
  assert.ok(Object.keys(files).every(name=>!name.endsWith('.png')));
  assert.match(new TextDecoder().decode(files['SVG sample.md']),/!\[Diagram\]\(images\/diagram\.svg\)/u);
  const again=await readDocumentParts({html});assert.equal(again.assets[0].type,'image/svg+xml');
  assert.deepEqual(again.assets[0].bytes,model.assets[0].bytes);
});

test('拒绝的 SVG 图片不会伪装为二进制附件留在任何导出结果中', async () => {
  const unsafe=encode('<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"><script>unsafe()</script></svg>');
  const model=await readDocumentParts({html:imageHtml,assets:[{path:'images/diagram.svg',bytes:unsafe}]});
  assert.deepEqual(model.assets,[]);
  assert.deepEqual(model.warnings,[{code:'invalid_image',label:'images/diagram.svg'}]);
  const output=await (await renderFile('html',model)).blob.text();assert.doesNotMatch(output,/svg\+xml|unsafe\(\)/u);
  const files=unzipSync(new Uint8Array(await renderBundle(['markdown','attachments'],model).blob.arrayBuffer()));
  assert.ok(!Object.hasOwn(files,'images/diagram.svg'));
  await assert.rejects(renderFile('html',{...model,assets:[{path:'images/diagram.svg',bytes:unsafe,type:'image/svg+xml',role:'image'}]}),{code:'invalid_svg'});
  assert.throws(()=>renderBundle(['attachments'],{...model,assets:[{path:'images/diagram.svg',bytes:unsafe,type:'application/octet-stream',role:'image'}]}),{code:'invalid_svg'});
});

test('SVG PNG 回退在异步校验前独立快照，仍受单项和合计字节限制', async () => {
  const primary=encode(svg),fallback=png.slice();
  const pending=readDocumentParts({html:imageHtml,assets:[{path:'images/diagram.svg',bytes:primary,rasterFallback:{bytes:fallback}}]});
  primary.fill(0);fallback.fill(0);
  const model=await pending;assert.ok(model.assets[0]?.rasterFallback);assert.deepEqual(model.assets[0].rasterFallback.bytes,png);
  await assert.rejects(readDocumentParts({html:imageHtml,assets:[{path:'images/diagram.svg',bytes:encode(svg),rasterFallback:{bytes:new Uint8Array(limits.entry)}}]}),{code:'input_limit'});
  await assert.rejects(readDocumentParts({html:imageHtml,assets:[{path:'images/diagram.svg',bytes:encode(svg),rasterFallback:{bytes:[1,2]}}]}),{code:'invalid_input'});
  const invalid=await readDocumentParts({html:imageHtml,assets:[{path:'images/diagram.svg',bytes:encode(svg),rasterFallback:{bytes:Uint8Array.of(1,2,3)}}]});
  assert.ok(invalid.warnings.some(w=>w.code==='invalid_image'));assert.ok(!invalid.assets[0].rasterFallback);
});

test('PDF 只解码经过校验的 PNG 回退，不把含 foreignObject 的 SVG 交给 PDF 引擎', async t => {
  const model=await readDocumentParts({html:imageHtml,assets:[{path:'images/diagram.svg',bytes:encode(svg),rasterFallback:{bytes:png}}]});
  const previous=Object.getOwnPropertyDescriptor(globalThis,'createImageBitmap');const calls=[];
  globalThis.createImageBitmap=async blob=>{calls.push({type:blob.type,bytes:new Uint8Array(await blob.arrayBuffer())});assert.equal(blob.type,'image/png');return {width:1,height:1,close(){}};};
  t.after(()=>{if(previous)Object.defineProperty(globalThis,'createImageBitmap',previous);else delete globalThis.createImageBitmap;});
  const prepared=await prepareImages(model);assert.equal(prepared.skipped,0);assert.ok(prepared.names.has('images/diagram.svg'));
  assert.deepEqual(calls,[{type:'image/png',bytes:png}]);
  assert.match(Object.values(prepared.images)[0],/^data:image\/png;base64,/u);
  const noFallback=await readDocumentParts({html:imageHtml,assets:[{path:'images/diagram.svg',bytes:encode(svg)}]});
  const skipped=await prepareImages(noFallback);assert.equal(skipped.skipped,1);assert.equal(calls.length,1);
});
