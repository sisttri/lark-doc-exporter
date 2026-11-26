import test from 'node:test';
import assert from 'node:assert/strict';
import pdfmake from 'pdfmake';
import {zlibSync} from 'fflate';
import {pdfDefinition, prepareImages} from '../src/pdf.js';

const n = (tag, children = [], props = {}) => ({tag, children, ...props});
const documentOf = blocks => ({title:'Layout sample', blocks, assets:[], warnings:[]});
const tableOf = rows => n('table', rows.map(row => n('tr', row.map(value => n('td', [value])))));
const firstTable = doc => doc.content.find(item => item.table).table;
const pageWidth = 595.28 - 42 - 42;
const pixel = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aWZsAAAAASUVORK5CYII=';

test('PDF gives long descriptions more width while keeping every column within the page budget', () => {
  for (const columns of [2, 6, 10]) {
    const row = Array.from({length:columns}, (_, index) => index === 1 ? 'Long description with details that should wrap less often. '.repeat(8) : String(index + 1));
    const {doc, denseTables} = pdfDefinition(documentOf([tableOf([row, row])]));
    const {widths} = firstTable(doc);
    assert.equal(denseTables, 0);
    assert.equal(widths.length, columns);
    assert.ok(widths[1] > widths[0] * 1.5, JSON.stringify(widths));
    assert.ok(widths.every(width => Number.isFinite(width) && width >= 24));
    assert.ok(Math.abs(widths.reduce((sum, width) => sum + width, 0) + (columns - 1) * 16 - pageWidth) < .001);
  }
});

test('PDF keeps merged cell geometry, true headers, and wide-table fallback with adaptive columns', () => {
  const table = n('table', [
    n('thead', [n('tr', [n('th', ['ID']), n('th', ['Description']), n('th', ['State'])])]),
    n('tbody', [
      n('tr', [n('td', ['1'], {rowspan:2}), n('td', ['A detailed explanation '.repeat(12)], {colspan:2})]),
      n('tr', [n('td', ['Another description '.repeat(5)]), n('td', ['Ready'])]),
    ]),
  ]);
  const {doc} = pdfDefinition(documentOf([table]));
  const {widths, headerRows, body} = firstTable(doc);
  assert.equal(headerRows, 1);
  assert.equal(body[1][0].rowSpan, 2);
  assert.equal(body[1][1].colSpan, 2);
  assert.equal(body[2].length, 3);
  assert.ok(widths[1] > widths[0]);
  const wide = pdfDefinition(documentOf([tableOf([Array.from({length:13}, (_, index) => 'Cell ' + index)])]));
  assert.equal(wide.denseTables, 1);
  assert.ok(wide.notes.some(note => note.includes('宽表')));
  assert.match(JSON.stringify(wide.doc.content), /Cell 12/);
});

test('PDF preserves source outer-column proportions within each table width', () => {
  const table = tableOf([['A', 'A description much longer than its neighbors', 'C']]);
  table.columnWidths = [2000,3000,5000];
  const {doc} = pdfDefinition(documentOf([table]));
  const {widths} = firstTable(doc);
  for (const [index, expected] of [94.256,137.384,247.64].entries()) assert.ok(Math.abs(widths[index] - expected) < .001, JSON.stringify(widths));
  const nested = n('table', [n('tr', [n('td', [n('table', [n('tr', [n('td', ['Inner A']),n('td', ['Inner B'])])], {columnWidths:[2500,7500]})]),n('td', ['Neighbor'])])], {columnWidths:[6000,4000]});
  const outer = firstTable(pdfDefinition(documentOf([nested])).doc);
  const inner = outer.body[0][0].stack.find(item => item.table).table;
  assert.ok(Math.abs(inner.widths[0] + 8 - outer.widths[0] / 4) < .001);
  assert.ok(Math.abs(inner.widths[1] + 8 - outer.widths[0] * .75) < .001);
  const single = tableOf([['Single']]);
  single.columnWidths = [10000];
  assert.deepEqual(firstTable(pdfDefinition(documentOf([single])).doc).widths, [pageWidth]);
});

test('PDF clamps narrow source columns and redistributes the remaining width without overflow', () => {
  for (const columnWidths of [[1,1,9998], [2000,1,7999], [1,9997,1,1], [9199,800,1]]) {
    const table = tableOf([columnWidths.map(() => 'Cell')]);
    table.columnWidths = columnWidths;
    const {widths} = firstTable(pdfDefinition(documentOf([table])).doc);
    assert.ok(widths.every(width => Number.isFinite(width) && width >= 24));
    for (const [index, ratio] of columnWidths.entries()) if (ratio === 1) assert.equal(widths[index], 24);
    if (columnWidths[0] === 9199) assert.equal(widths[1], 24);
    if (columnWidths[0] === 2000) assert.ok(Math.abs((widths[0] + 8) / (widths[2] + 8) - 2000 / 7999) < .00001);
    assert.ok(Math.abs(widths.reduce((sum, width) => sum + width, 0) + (widths.length - 1) * 16 - pageWidth) < .001);
  }
  const table = tableOf([['Short', 'A much longer description '.repeat(12), 'C']]);
  const fallback = firstTable(pdfDefinition(documentOf([table])).doc).widths;
  for (const columnWidths of [[5000,5000], [5000,0,5000], '2000,3000,5000']) {
    assert.deepEqual(firstTable(pdfDefinition(documentOf([{...table,columnWidths}])).doc).widths, fallback);
  }
});

test('real PDF applies source column proportions, cell fills, colors and native vertical alignment', async () => {
  pdfmake.setUrlAccessPolicy(() => false);
  pdfmake.setLocalAccessPolicy(path => /^Helvetica(?:-Bold|-Oblique|-BoldOblique)?$/.test(path));
  pdfmake.addFonts({Noto:{normal:'Helvetica',bold:'Helvetica-Bold',italics:'Helvetica-Oblique',bolditalics:'Helvetica-BoldOblique'}});
  const table = n('table', [n('tr', [
    n('td', ['Top\n' + 'Tall\n'.repeat(7)], {background:'#ff0000',color:'#112233',align:'left',valign:'top'}),
    n('td', ['Middle'], {background:'#00ff00',color:'#112233',align:'center',valign:'middle'}),
    n('td', ['Bottom'], {background:'#0000ff',color:'#112233',align:'right',valign:'bottom'}),
  ])], {columnWidths:[2000,3000,5000]});
  const {doc} = pdfDefinition(documentOf([table]));
  const widths = firstTable(doc).widths.slice();
  doc.compress = false;
  const pdf = pdfmake.createPdf(doc), stream = await pdf.getStream();
  const items = stream._pdfMakePages.flatMap(page => page.items);
  const fills = items.filter(({type,item}) => type === 'vector' && ['#ff0000','#00ff00','#0000ff'].includes(item.color)).map(({item}) => item);
  assert.equal(fills.length, 3);
  for (const [index,color] of ['#ff0000','#00ff00','#0000ff'].entries()) {
    const fill = fills.find(item => item.color === color);
    assert.ok(Math.abs(fill.w / pageWidth - [.2,.3,.5][index]) < .00001);
    assert.ok(fill.x >= 42 && fill.x + fill.w <= 553.29);
  }
  const lines = items.filter(({type}) => type === 'line').map(({item}) => item);
  const line = text => lines.find(item => item.inlines.map(run => run.text).join('') === text);
  for (const text of ['Top','Middle','Bottom']) assert.ok(line(text).inlines.every(run => run.color === '#112233'));
  const middleStart = 42 + widths[0] + 16;
  const bottomEnd = 42 + pageWidth;
  assert.ok(Math.abs(line('Middle').x - middleStart - (widths[1] - line('Middle').getWidth()) / 2) < .001);
  assert.ok(Math.abs(line('Bottom').x + line('Bottom').getWidth() - bottomEnd) < .001);
  const bytes = await pdf.getBuffer();
  const translations = [...bytes.toString('latin1').matchAll(/1 0 0 1 0 ([\d.-]+) cm/g)].map(match => Number(match[1])).filter(value => value > 0);
  assert.equal(translations.length, 2);
  assert.ok(translations[0] > 10);
  assert.ok(Math.abs(translations[1] - 2 * translations[0]) < .001);
  assert.ok(bytes.subarray(0,5).equals(Buffer.from('%PDF-')));
});

test('real PDF keeps styled row and column spans and lets multipage cells flow from the top', async () => {
  pdfmake.setUrlAccessPolicy(() => false);
  pdfmake.setLocalAccessPolicy(path => /^Helvetica(?:-Bold|-Oblique|-BoldOblique)?$/.test(path));
  pdfmake.addFonts({Noto:{normal:'Helvetica',bold:'Helvetica-Bold',italics:'Helvetica-Oblique',bolditalics:'Helvetica-BoldOblique'}});
  const merged = n('table', [
    n('tr', [n('td', ['Merged'], {colspan:2,rowspan:2,background:'#aabbcc',align:'center',valign:'middle'}),n('td', ['First\n' + 'Tall\n'.repeat(5)])]),
    n('tr', [n('td', ['Second\n' + 'Tall\n'.repeat(5)])]),
  ], {columnWidths:[2000,3000,5000]});
  const longText = Array.from({length:180}, (_, index) => 'Line ' + index).join('\n');
  const long = n('table', [n('tr', [n('td', [longText], {background:'#ddeeff',valign:'bottom'}),n('td', ['Neighbor'])])], {columnWidths:[6000,4000]});
  const {doc} = pdfDefinition(documentOf([merged,long]));
  doc.compress = false;
  const pdf = pdfmake.createPdf(doc), stream = await pdf.getStream();
  const pages = stream._pdfMakePages;
  assert.ok(pages.length > 2);
  const items = pages.flatMap(page => page.items);
  const fills = items.filter(({type,item}) => type === 'vector' && item.color === '#aabbcc').map(({item}) => item);
  assert.equal(fills.length, 2);
  assert.ok(fills.every(fill => Math.abs(fill.w - pageWidth / 2) < .001));
  assert.ok(Math.abs(fills[0].x - fills[1].x) < .001);
  const begins = items.filter(({type}) => type === 'beginVerticalAlignment').map(({item}) => item);
  assert.equal(begins.find(item => item.verticalAlignment === 'middle')?.isCellContentMultiPage, false);
  assert.equal(begins.find(item => item.verticalAlignment === 'bottom')?.isCellContentMultiPage, true);
  const text = items.filter(({type}) => type === 'line').map(({item}) => item.inlines.map(run => run.text).join('')).join('\n');
  assert.match(text, /Line 179/);
  const bytes = await pdf.getBuffer();
  const translations = [...bytes.toString('latin1').matchAll(/1 0 0 1 0 ([\d.-]+) cm/g)].map(match => Number(match[1])).filter(value => value > 0);
  assert.equal(translations.length, 1);
  assert.ok(translations[0] > 20);
});

test('real PDF keeps nested content readable in colored cells without changing colors outside tables', async () => {
  pdfmake.setUrlAccessPolicy(() => false);
  pdfmake.setLocalAccessPolicy(path => /^(?:Helvetica|Courier)(?:-Bold|-Oblique|-BoldOblique)?$/.test(path));
  pdfmake.addFonts({
    Noto:{normal:'Helvetica',bold:'Helvetica-Bold',italics:'Helvetica-Oblique',bolditalics:'Helvetica-BoldOblique'},
    Courier:{normal:'Courier',bold:'Courier-Bold',italics:'Courier-Oblique',bolditalics:'Courier-BoldOblique'},
  });
  const link = text => n('a', [text], {href:'https://example.org/readable'});
  const code = text => n('pre', [n('code', [text])]);
  const inline = text => n('p', [n('code', [text])]);
  const nested = n('table', [n('thead', [n('tr', [n('th', ['Inherited header A']),n('th', ['Inherited header B'])])]),n('tr', [
    n('td', [code('Inherited nested code'),inline('Inherited nested inline')]),
    n('td', [n('p', [link('Own nested link')]),n('blockquote', ['Own nested quote']),code('Own nested code'),inline('Own nested inline')], {background:'#eeeeee',color:'#222222'}),
  ])]);
  const table = n('table', [n('tr', [n('td', [
    n('p', ['Dark plain']),code('Dark block code'),n('blockquote', [n('p', ['Dark quote']),n('p', [link('Dark quote link')])]),n('img', [], {alt:'Dark image alt'}),
    n('p', [link('Dark link')]),inline('Dark inline'),n('ul', [n('li', [link('Dark list link')])]),nested,
  ], {background:'#111111',color:'#ffffff'})])]);
  const {doc} = pdfDefinition(documentOf([
    table,code('Outside block code'),n('blockquote', ['Outside quote']),n('p', [link('Outside link')]),inline('Outside inline'),n('p', ['Outside plain']),n('img', [], {alt:'Outside image alt'}),
    n('table', [n('tr', [n('th', ['Outside header'])])]),
  ]));
  const pdf = pdfmake.createPdf(doc), stream = await pdf.getStream();
  const runs = stream._pdfMakePages.flatMap(page => page.items.filter(({type}) => type === 'line').flatMap(({item}) => item.inlines));
  const headerFills = stream._pdfMakePages.flatMap(page => page.items.filter(({type,item}) => type === 'vector' && item.color === '#e5eee8'));
  assert.equal(headerFills.length, 1);
  const colors = new Map([
    ['Dark plain','#ffffff'],['Dark block code','#ffffff'],['Dark quote','#ffffff'],['Dark quote link','#ffffff'],
    ['Dark link','#ffffff'],['Dark inline','#ffffff'],['Dark list link','#ffffff'],['Dark image alt','#ffffff'],
    ['Inherited nested code','#ffffff'],['Inherited nested inline','#ffffff'],
    ['Inherited header A','#ffffff'],['Inherited header B','#ffffff'],['Outside header','#202c25'],
    ['Own nested link','#222222'],['Own nested quote','#222222'],['Own nested code','#222222'],['Own nested inline','#222222'],
    ['Outside block code','#314d40'],['Outside quote','#4b6057'],['Outside link','#155e50'],['Outside inline','#202c25'],['Outside plain','#202c25'],['Outside image alt','#596960'],
  ]);
  for (const [text,color] of colors) {
    const words = text.split(' ');
    const start = runs.findIndex((_, index) => words.every((word, offset) => runs[index + offset]?.text.trim() === word));
    assert.ok(start >= 0, text);
    assert.ok(runs.slice(start, start + words.length).every(run => run.color === color), text);
  }
  for (const text of ['Dark inline','Inherited nested inline','Own nested inline']) {
    const word = text.split(' ')[0];
    assert.ok(runs.filter(run => run.text.trim() === word).every(run => !run.background), text);
  }
  assert.ok(runs.some(run => run.text.trim() === 'Outside' && run.background === '#edf1ee'));
  assert.ok(runs.filter(run => run.link).every(run => [].concat(run.decoration || []).includes('underline')));
  assert.ok((await pdf.getBuffer()).subarray(0,5).equals(Buffer.from('%PDF-')));
});

test('PDF lets large diagrams use the text width and does not enlarge small images', () => {
  const image = path => n('img', [], {path});
  const prepared = {
    images:{large:'data:image/png;base64,' + pixel, small:'data:image/png;base64,' + pixel, tall:'data:image/png;base64,' + pixel},
    names:new Map([['images/large.png','large'],['images/small.png','small'],['images/tall.png','tall']]),
    dimensions:new Map([['images/large.png',{width:1400,height:500}],['images/small.png',{width:48,height:24}],['images/tall.png',{width:160,height:1600}]]),
  };
  const {doc} = pdfDefinition(documentOf([image('images/large.png'), image('images/small.png'), image('images/tall.png')]), prepared);
  const images = doc.content.filter(item => item.image);
  assert.equal(images[0].fit[0], pageWidth);
  assert.ok(images[0].fit[1] >= 375);
  assert.ok(images[1].fit[0] <= 48 * .75);
  assert.ok(images[1].fit[1] <= 24 * .75);
  assert.ok(images[2].fit[1] <= 650);
});

function imageEnvironment(t, dimensions) {
  const closed = [], canvases = [], draws = [];
  const previous = Object.fromEntries(['createImageBitmap','OffscreenCanvas'].map(key => [key,Object.getOwnPropertyDescriptor(globalThis,key)]));
  globalThis.createImageBitmap = async blob => {
    const source = new Uint8Array(await blob.arrayBuffer());
    if (!source.length || source[0] === 0) throw new Error('bad image');
    return {...dimensions, close:() => closed.push(true)};
  };
  class TestCanvas {
    constructor(width, height) { this.width = width; this.height = height; canvases.push({width,height}); }
    getContext() { return {drawImage(...args){draws.push(args.slice(1));}}; }
    async convertToBlob() { return new Blob([Uint8Array.of(1,2,3)], {type:'image/png'}); }
  }
  globalThis.OffscreenCanvas = TestCanvas;
  t.after(() => {
    for (const [key, descriptor] of Object.entries(previous)) {
      if (descriptor) Object.defineProperty(globalThis,key,descriptor); else delete globalThis[key];
    }
  });
  return {closed, canvases, draws};
}

test('PDF decodes a fitting PNG once and retains its original bytes without canvas re-encoding', async t => {
  const {closed, canvases} = imageEnvironment(t, {width:800,height:400});
  const bytes = new Uint8Array(Buffer.from(pixel, 'base64'));
  const snapshot = {...documentOf([n('img', [], {path:'images/a.png'})]), assets:[{path:'images/a.png',role:'image',type:'image/png',bytes}]};
  const prepared = await prepareImages(snapshot);
  assert.equal(canvases.length, 0);
  assert.equal(closed.length, 1);
  assert.deepEqual(prepared.dimensions.get('images/a.png'), {width:800,height:400});
  const encoded = prepared.images[prepared.names.get('images/a.png')].split(',')[1];
  assert.deepEqual(new Uint8Array(Buffer.from(encoded, 'base64')), bytes);
});

test('PDF keeps large PNG and JPEG bytes, reports unreadable images, and preserves pixel limits', async t => {
  const environment = imageEnvironment(t, {width:3200,height:800});
  const png = new Uint8Array(Buffer.from(pixel, 'base64'));
  const jpeg = Uint8Array.of(255,216,255,217);
  const assets = [
    {path:'images/a.png',role:'image',type:'image/png',bytes:png},
    {path:'images/b.png',role:'image',type:'image/png',bytes:Uint8Array.of(0)},
    {path:'images/c.jpg',role:'image',type:'image/jpeg',bytes:jpeg},
  ];
  const snapshot = {...documentOf(assets.map(asset => n('img', [], {path:asset.path}))), assets};
  const prepared = await prepareImages(snapshot);
  assert.equal(environment.canvases.length, 0);
  for (const asset of [assets[0], assets[2]]) {
    const encoded = prepared.images[prepared.names.get(asset.path)];
    assert.ok(encoded.startsWith('data:' + asset.type + ';base64,'));
    assert.deepEqual(new Uint8Array(Buffer.from(encoded.split(',')[1], 'base64')), asset.bytes);
    assert.deepEqual(prepared.dimensions.get(asset.path), {width:3200,height:800});
  }
  assert.equal(prepared.skipped, 1);
  assert.ok(pdfDefinition(snapshot, prepared).notes.some(note => note.includes('图片')));
  t.mock.method(globalThis, 'createImageBitmap', async () => ({width:6000,height:6000,close(){}}));
  await assert.rejects(prepareImages(snapshot), {code:'PDF_LIMIT'});
});

test('PDF cuts tall images into consecutive original-resolution bands and declares the pagination', async t => {
  const {canvases, draws, closed} = imageEnvironment(t, {width:1000,height:8000});
  const path = 'images/tall.png';
  const snapshot = {...documentOf([n('img', [], {path,alt:'Diagram'})]),
    assets:[{path,role:'image',type:'image/png',bytes:new Uint8Array(Buffer.from(pixel,'base64'))}]};
  const prepared = await prepareImages(snapshot);
  assert.ok(canvases.length > 1);
  let top = 0;
  for (let index = 0; index < canvases.length; index++) {
    const {width,height} = canvases[index];
    assert.equal(width,1000);
    assert.ok(height > 0 && height * pageWidth / width <= 600);
    assert.deepEqual(draws[index],[0,top,width,height,0,0,width,height]);
    top += height;
  }
  assert.equal(top,8000);
  assert.equal(closed.length,1);
  const {doc,notes} = pdfDefinition(snapshot,prepared);
  const images = doc.content.filter(item => item.image);
  assert.equal(images.length,canvases.length);
  assert.deepEqual(images.map(item => item.image),Object.keys(prepared.images));
  assert.ok(images.every(item => item.width === pageWidth));
  assert.deepEqual(notes,[]);
  assert.equal(JSON.stringify(doc.content).match(/长图已按原分辨率连续分段排版/gu).length,1);
  assert.equal(JSON.stringify(doc.content).match(/Diagram/gu).length,1);
});

test('PDF commits complete image assets without orphan slices or names shared with a later image', async t => {
  imageEnvironment(t,{width:1000,height:3000});
  t.mock.method(globalThis,'createImageBitmap',async blob => ({width:1000,height:blob.type==='image/jpeg'?400:3000,close(){}}));
  let conversions = 0;
  const convert = t.mock.method(globalThis.OffscreenCanvas.prototype,'convertToBlob',async () => {
    if (++conversions === 3) throw new Error('unreadable last band');
    return new Blob([Uint8Array.of(1,2,3)],{type:'image/png'});
  });
  const assets = [
    {path:'images/tall.png',role:'image',type:'image/png',bytes:new Uint8Array(Buffer.from(pixel,'base64'))},
    {path:'images/next.jpg',role:'image',type:'image/jpeg',bytes:Uint8Array.of(255,216,255,217)},
  ];
  const snapshot = {...documentOf(assets.map(({path}) => n('img',[],{path}))),assets};
  const incomplete = await prepareImages(snapshot);
  assert.equal(incomplete.skipped,1);
  assert.equal(incomplete.names.has(assets[0].path),false);
  assert.equal(incomplete.dimensions.has(assets[0].path),false);
  assert.equal(incomplete.slices.has(assets[0].path),false);
  assert.deepEqual(Object.keys(incomplete.images),[incomplete.names.get(assets[1].path)]);
  convert.mock.restore();
  const complete = await prepareImages(snapshot);
  const tallIds = complete.slices.get(assets[0].path).map(part => part.id);
  const nextId = complete.names.get(assets[1].path);
  assert.equal(tallIds.includes(nextId),false);
  assert.deepEqual(Object.keys(complete.images),[...tallIds,nextId]);
});

test('PDF applies its output byte limit across all long-image bands before reading an oversized blob', async t => {
  imageEnvironment(t,{width:1000,height:3000});
  let readBlobs = 0;
  t.mock.method(globalThis.OffscreenCanvas.prototype,'convertToBlob',async () => ({
    size:17*1024*1024,
    async arrayBuffer() {readBlobs++;return new Uint8Array(17*1024*1024).buffer;},
  }));
  const path = 'images/tall.png';
  const snapshot = {...documentOf([n('img',[],{path})]),
    assets:[{path,role:'image',type:'image/png',bytes:new Uint8Array(Buffer.from(pixel,'base64'))}]};
  await assert.rejects(prepareImages(snapshot),{code:'PDF_LIMIT'});
  assert.equal(readBlobs,1);
});

function rasterPng(width,height) {
  const chunk = (tag,data) => {
    const content = Buffer.concat([Buffer.from(tag),Buffer.from(data)]);
    let crc = 0xffffffff;
    for (const byte of content) {
      crc ^= byte;
      for (let bit=0; bit<8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
    const length = Buffer.alloc(4), checksum = Buffer.alloc(4);
    length.writeUInt32BE(data.length); checksum.writeUInt32BE((crc ^ 0xffffffff) >>> 0);
    return Buffer.concat([length,content,checksum]);
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width); header.writeUInt32BE(height,4); header[8]=8; header[9]=6;
  const pixels = new Uint8Array((width*4+1)*height);
  for (let row=0; row<height; row++) for (let col=0; col<width; col++) pixels[row*(width*4+1)+1+col*4+3]=255;
  return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',zlibSync(pixels)),chunk('IEND',new Uint8Array())]);
}

test('real PDF paginates readable tall-image bands and keeps nested bands inside their containers', async t => {
  const {canvases} = imageEnvironment(t,{width:1000,height:3000});
  t.mock.method(globalThis.OffscreenCanvas.prototype,'convertToBlob',async function() {
    return new Blob([rasterPng(this.width,this.height)],{type:'image/png'});
  });
  const path = 'images/tall.png', image = () => n('img',[],{path});
  const table = n('table',[n('tr',[n('td',[n('blockquote',[image()])]),n('td',['Neighbor'])])]);
  const snapshot = {...documentOf([image(),n('blockquote',[image()]),table]),
    assets:[{path,role:'image',type:'image/png',bytes:new Uint8Array(Buffer.from(pixel,'base64'))}]};
  const prepared = await prepareImages(snapshot);
  assert.ok(canvases.length > 1);
  pdfmake.setUrlAccessPolicy(() => false);
  pdfmake.setLocalAccessPolicy(path => /^Helvetica(?:-Bold|-Oblique|-BoldOblique)?$/.test(path));
  pdfmake.addFonts({Noto:{normal:'Helvetica',bold:'Helvetica-Bold',italics:'Helvetica-Oblique',bolditalics:'Helvetica-BoldOblique'}});
  const {doc} = pdfDefinition(snapshot,prepared);
  const cellWidth = doc.content.find(item => item.table).table.widths[0];
  const pdf = pdfmake.createPdf(doc), stream = await pdf.getStream();
  const pages = stream._pdfMakePages;
  const images = pages.flatMap((page,index) => page.items.filter(item => item.type === 'image').map(({item}) => ({...item,page:index})));
  assert.equal(images.length,canvases.length*3);
  const rootImages = images.slice(0,canvases.length);
  assert.ok(new Set(rootImages.map(image => image.page)).size > 1);
  assert.ok(rootImages.every(image => Math.abs(image._width-pageWidth)<.01));
  const quoteImages = images.slice(canvases.length,canvases.length*2);
  assert.ok(quoteImages.every(image => image.x >= 56 && image.x+image._width <= 595.28-42+.01));
  const tableImages = images.slice(canvases.length*2);
  assert.ok(tableImages.every(image => image.x >= 56 && image.x+image._width <= 42+cellWidth+.01),JSON.stringify({cellWidth,tableImages:tableImages.map(({x,_width})=>({x,width:_width}))}));
  assert.ok(images.every(image => image.y>=44 && image.y+image._height<=841.89-43+.01));
  assert.ok((await pdf.getBuffer()).subarray(0,5).equals(Buffer.from('%PDF-')));
});

test('PDF keeps static-frame notices and output-size limits when image preparation is needed', async t => {
  const environment = imageEnvironment(t, {width:3200,height:800});
  const gif = new Uint8Array(Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7','base64'));
  const assets = [
    {path:'images/a.gif',role:'image',type:'image/gif',bytes:gif},
    {path:'images/b.webp',role:'image',type:'image/webp',bytes:Uint8Array.of(1)},
  ];
  const snapshot = {...documentOf(assets.map(({path}) => n('img',[],{path}))),assets};
  const prepared = await prepareImages(snapshot);
  assert.deepEqual(environment.canvases,[{width:3200,height:800},{width:3200,height:800}]);
  assert.equal(prepared.staticImages, 2);
  for (const {path} of assets) {
    assert.deepEqual(prepared.dimensions.get(path),{width:3200,height:800});
    assert.ok(prepared.images[prepared.names.get(path)].startsWith('data:image/png;base64,'));
  }
  assert.ok(pdfDefinition(snapshot, prepared).notes.some(note => note.includes('静态画面')));
  t.mock.method(globalThis.OffscreenCanvas.prototype, 'convertToBlob', async () => new Blob([new Uint8Array(33 * 1024 * 1024)], {type:'image/png'}));
  await assert.rejects(prepareImages(snapshot), {code:'PDF_LIMIT'});
});

test('real PDF layout keeps adaptive merged tables and repeated headers inside the page', async () => {
  pdfmake.setUrlAccessPolicy(() => false);
  pdfmake.setLocalAccessPolicy(path => /^Helvetica(?:-Bold|-Oblique|-BoldOblique)?$/.test(path));
  pdfmake.addFonts({Noto:{normal:'Helvetica',bold:'Helvetica-Bold',italics:'Helvetica-Oblique',bolditalics:'Helvetica-BoldOblique'}});
  const header = n('thead', [n('tr', ['ID','Detail','More','State','Kind','Count'].map(text => n('th',[text])))]);
  const rows = Array.from({length:45}, (_, index) => [
    n('tr', [n('td',[String(index + 1)],{rowspan:2}), n('td',['Explanation ' + index + ': ' + 'Readable content '.repeat(6)],{colspan:2}), n('td',['Ready']),n('td',['A']),n('td',[String(index)])]),
    n('tr', [n('td',['Second detail ' + index]),n('td',['More']),n('td',['Ready']),n('td',['B']),n('td',[String(index)])]),
  ]).flat();
  const table = n('table', [header, n('tbody', rows)]);
  const {doc} = pdfDefinition(documentOf([table]));
  const pdf = pdfmake.createPdf(doc), stream = await pdf.getStream();
  const pages = stream._pdfMakePages;
  assert.ok(pages.length > 1);
  for (const page of pages) {
    const lines = page.items.filter(item => item.type === 'line').map(({item}) => item);
    assert.ok(lines.some(line => line.inlines.map(run => run.text).join('') === 'Detail'));
    for (const line of lines) assert.ok(line.x >= 41 && line.x + line.getWidth() <= 554, JSON.stringify({x:line.x,width:line.getWidth()}));
  }
  const text = pages.flatMap(page => page.items.filter(item => item.type === 'line').map(({item}) => item.inlines.map(run => run.text).join(''))).join('\n');
  assert.match(text, /Explanation 44/);
  assert.ok((await pdf.getBuffer()).subarray(0,5).equals(Buffer.from('%PDF-')));
});
