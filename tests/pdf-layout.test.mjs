import test from 'node:test';
import assert from 'node:assert/strict';
import pdfmake from 'pdfmake';
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
  const closed = [], canvases = [];
  const previous = Object.fromEntries(['createImageBitmap','OffscreenCanvas'].map(key => [key,Object.getOwnPropertyDescriptor(globalThis,key)]));
  globalThis.createImageBitmap = async blob => {
    const source = new Uint8Array(await blob.arrayBuffer());
    if (!source.length || source[0] === 0) throw new Error('bad image');
    return {...dimensions, close:() => closed.push(true)};
  };
  class TestCanvas {
    constructor(width, height) { this.width = width; this.height = height; canvases.push(this); }
    getContext() { return {drawImage(){}}; }
    async convertToBlob() { return new Blob([Uint8Array.of(1,2,3)], {type:'image/png'}); }
  }
  globalThis.OffscreenCanvas = TestCanvas;
  t.after(() => {
    for (const [key, descriptor] of Object.entries(previous)) {
      if (descriptor) Object.defineProperty(globalThis,key,descriptor); else delete globalThis[key];
    }
  });
  return {closed, canvases};
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

test('PDF still resizes large images, reports unreadable images, and preserves pixel limits', async t => {
  const environment = imageEnvironment(t, {width:3200,height:800});
  const assets = [
    {path:'images/a.png',role:'image',type:'image/png',bytes:Uint8Array.of(1,2,3)},
    {path:'images/b.png',role:'image',type:'image/png',bytes:Uint8Array.of(0)},
  ];
  const snapshot = {...documentOf(assets.map(asset => n('img', [], {path:asset.path}))), assets};
  const prepared = await prepareImages(snapshot);
  assert.equal(environment.canvases.length, 1);
  assert.deepEqual([environment.canvases[0].width, environment.canvases[0].height], [1600,400]);
  assert.deepEqual(prepared.dimensions.get('images/a.png'), {width:1600,height:400});
  assert.equal(prepared.skipped, 1);
  assert.ok(pdfDefinition(snapshot, prepared).notes.some(note => note.includes('图片')));
  t.mock.method(globalThis, 'createImageBitmap', async () => ({width:6000,height:6000,close(){}}));
  await assert.rejects(prepareImages(snapshot), {code:'PDF_LIMIT'});
});

test('PDF keeps static-frame notices and output-size limits when image preparation is needed', async t => {
  const environment = imageEnvironment(t, {width:80,height:40});
  const gif = new Uint8Array(Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7','base64'));
  const snapshot = {...documentOf([n('img', [], {path:'images/a.gif'})]), assets:[{path:'images/a.gif',role:'image',type:'image/gif',bytes:gif}]};
  const prepared = await prepareImages(snapshot);
  assert.equal(environment.canvases.length, 1);
  assert.equal(prepared.staticImages, 1);
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
