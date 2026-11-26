import assert from 'node:assert/strict';
import test from 'node:test';
import { unzipSync } from 'fflate';
import { installPageExporter } from '../src/userscript/entry.js';
import { pngDataUrl } from './helpers/whiteboard.mjs';

class Element {
  children = [];
  listeners = new Map();
  style = {setProperty(key, value) { this[key] = value; }};
  hidden = false;
  _text = '';
  constructor(tag) {
    this.tag = tag; this.tagName = tag.toUpperCase(); this.localName = tag;
    this.className = '';
    this.classList = {
      add: (...names) => { this.className = [...new Set([...this.className.split(' '), ...names])].filter(Boolean).join(' '); },
      remove: (...names) => { this.className = this.className.split(' ').filter(name => !names.includes(name)).join(' '); },
      contains: name => this.className.split(' ').includes(name),
    };
  }
  get textContent() { return this._text + this.children.map(node => node.textContent).join(''); }
  set textContent(value) { this._text = String(value); this.children = []; }
  setAttribute(key, value) { this[key] = String(value); }
  getAttribute(key) { return this[key] ?? null; }
  removeAttribute(key) { delete this[key]; }
  addEventListener(type, listener) { this.listeners.set(type, listener); }
  removeEventListener(type) { this.listeners.delete(type); }
  append(...nodes) {
    for (let node of nodes) {
      if (typeof node === 'string') { const text = new Element('text'); text.textContent = node; node = text; }
      this.children.push(node); node.parent = this; node.parentNode = this; node.parentElement = this;
    }
  }
  replaceChildren(...nodes) { this._text = ''; this.children = []; this.append(...nodes); }
  remove() { if (this.parent) this.parent.children = this.parent.children.filter(node => node !== this); }
  click() { if (!this.disabled) return this.listeners.get('click')?.({target:this}); }
  focus() { this.focused = true; }
  contains(other) { return [...this.walk()].includes(other); }
  *walk() { yield this; for (const node of this.children) yield* node.walk(); }
}

function harness({captureHook, captureImages = [], captureData = {}, onYield, pdfHook, pdfNotes = [], warnings = [], initialFormats, initialPosition} = {}) {
  let captures = 0, pdfs = 0, domToken, menu;
  let downloadBlock = '';
  let ready = true, unsupported = false, reason = '';
  const delayed = new Map(), intervals = [];
  let timerId = 0;
  const head = new Element('head'), body = new Element('body'), root = new Element('div');
  root.setAttribute('data-block-type', 'page'); body.append(root);
  const downloads = [], downloadAttempts = [], blobs = new Map(), events = new Map(), stored = new Map();
  if (initialFormats !== undefined) stored.set('feishu-local-export-formats', JSON.stringify(initialFormats));
  if (initialPosition !== undefined) stored.set('feishu-local-export-position', String(initialPosition));
  const location = new URL('https://example.feishu.cn/wiki/A');
  const byId = id => [...body.walk(), ...head.walk()].find(node => node.id === id);
  const view = {
    location, innerWidth:1024, innerHeight:768,
    document: {
      head, body, getElementById:byId,
      querySelector:selector => selector.includes('page-block') || selector.includes('data-block-type="page"') ? root : byId(selector.replace(/^#/, '')),
      createElement(tag) {
        const element = new Element(tag);
        if (tag === 'a') element.click = () => {
          downloadAttempts.push({name:element.download, blob:blobs.get(element.href)});
          if (downloadBlock instanceof Error) throw downloadBlock;
          if (downloadBlock === 'undelivered') return;
          const event = {target:element,defaultPrevented:false,preventDefault() { this.defaultPrevented = true; }};
          element.listeners.get('click')?.(event);
          if (downloadBlock === 'preventDefault') event.preventDefault();
          if (!event.defaultPrevented) downloads.push({name:element.download, blob:blobs.get(element.href)});
        };
        return element;
      },
      addEventListener:(type, listener) => events.set('document:' + type, listener),
    },
    navigation: {addEventListener:(type, listener) => events.set(type, listener)},
    addEventListener:(type, listener) => events.set(type, listener),
    setTimeout(fn, ms) {
      if (ms < 100) return setTimeout(() => { onYield?.(); fn(); }, ms);
      const id = ++timerId; delayed.set(id, {fn, ms}); return id;
    },
    clearTimeout(id) { delayed.delete(id); clearTimeout(id); },
    setInterval(fn) { intervals.push(fn); return intervals.length; },
    clearInterval() {},
    URL: {createObjectURL(blob) { const id = 'test:' + blobs.size; blobs.set(id, blob); return id; }, revokeObjectURL(id) { blobs.delete(id); }},
    localStorage:{getItem:key => stored.get(key), setItem:(key,value) => stored.set(key,value)},
  };
  const source = () => {
    const [, kind, urlToken] = location.pathname.split('/');
    const token = domToken ?? urlToken;
    return {key:kind + ':' + urlToken, kind, wikiToken:kind === 'wiki' ? urlToken : '', docToken:token,
      title:'文档' + token, href:location.href, ready, unsupported, reason};
  };
  installPageExporter(view, {
    readSource:source,
    registerMenu:(label, callback) => { menu = {label, callback}; },
    capture:async options => {
      captures++;
      const atStart = source();
      await captureHook?.(options);
      return {source:atStart,
        blocks:[{id:'p',type:'text',html:'<div class="zone-container"><div class="ace-line">正文</div></div>'}],
        code:{}, images:captureImages, warnings, ...captureData};
    },
    renderPdf:async (snapshot, options) => {
      pdfs++;
      await pdfHook?.(snapshot, options);
      return {filename:snapshot.title + '.pdf', blob:new Blob(['%PDF-fake'], {type:'application/pdf'}), notes:pdfNotes};
    },
  });
  const get = key => byId('feishu-local-export-' + key);
  const select = (...kinds) => {
    for (const input of get('formats').walk()) {
      if (input.tag !== 'input') continue;
      input.checked = kinds.includes(input.value);
      input.listeners.get('change')?.();
    }
  };
  const navigate = (token, kind = 'wiki') => {
    location.pathname = '/' + kind + '/' + token;
    events.get('currententrychange')?.();
  };
  const poll = () => {
    for (const fn of intervals) fn();
    for (const [id, timer] of [...delayed]) {
      if (timer.ms < 2000) { delayed.delete(id); timer.fn(); }
    }
  };
  return {
    get, select, navigate, downloads, downloadAttempts, stored, menu:() => menu,
    blockDownloads(mode) { downloadBlock = mode; },
    open:() => { if (!get('popover').hidden) get('close').click(); get('launcher').click(); },
    reuse:async () => { get('supplement').click(); await get('button').click(); },
    fire:(key,type,event={}) => get(key).listeners.get(type)?.({target:get(key),...event}),
    outside:() => events.get('document:pointerdown')?.({target:body}),
    setActive:key => { view.document.activeElement=get(key); },
    keyboard:key => events.get('document:keydown')?.({key,target:view.document.activeElement}),
    resize(width,height) { view.innerWidth=width; view.innerHeight=height; events.get('resize')?.(); },
    panelText:() => get('panel').textContent, captures:() => captures, pdfs:() => pdfs, poll,
    changeDom(token) { domToken = token; },
    setReadiness(value, detail = '', isUnsupported = false) { ready = value; reason = detail; unsupported = isUnsupported; },
    autoClose() { for (const [id, timer] of [...delayed]) if (timer.ms === 4000) { delayed.delete(id); timer.fn(); } },
  };
}

test('低调悬浮入口打开非模态面板，空选择不能开始', () => {
  const ui = harness();
  assert.ok(ui.get('launcher'));
  assert.equal(ui.get('launcher').getAttribute('aria-label'), '保存到本地');
  assert.notEqual(ui.get('popover').getAttribute('aria-modal'), 'true');
  assert.equal(ui.get('popover').getAttribute('aria-label'), '文档保存');
  assert.equal(ui.get('heading'), undefined);
  assert.equal(ui.get('popover').hidden, true);
  assert.equal(ui.get('chooser').hidden, true);
  assert.equal(ui.get('card').hidden, true);
  ui.open();
  assert.equal(ui.get('panel').hidden, false);
  assert.equal(ui.get('chooser').hidden, false);
  assert.match(ui.panelText(), /文档A/);
  const checked = [...ui.get('formats').walk()].filter(node => node.tag === 'input' && node.checked);
  assert.deepEqual(checked.map(input => input.value), ['markdown']);
  ui.select();
  assert.equal(ui.get('button').disabled, true);
  ui.select('html');
  assert.equal(ui.get('button').disabled, false);
  assert.match(ui.panelText(), /素材包/);
  ui.select('attachments');
  assert.match(ui.get('plan').textContent, /已采集素材与清单/);
  ui.get('close').click();
  assert.equal(ui.get('popover').hidden, true);
});

test('内存素材验证期间取消也不会交付新文件，仍可下载上一份结果', async (t) => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'createImageBitmap');
  let release;
  Object.defineProperty(globalThis, 'createImageBitmap', {configurable:true, value:() => new Promise(resolve => {
    release = () => resolve({width:1,height:1,close(){}});
  })});
  t.after(() => {
    if (previous) Object.defineProperty(globalThis, 'createImageBitmap', previous);
    else delete globalThis.createImageBitmap;
  });
  const images = [];
  const ui = harness({captureImages:images});
  ui.open(); ui.select('html'); await ui.get('button').click();
  const original = ui.downloads[0].blob;
  images.push({blockId:'image',dataUrl:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGN4oKDwHwAFJAIgPqioaAAAAABJRU5ErkJggg=='});
  ui.open();
  const pending = ui.get('button').click();
  const started = Date.now();
  while (!release && Date.now() - started < 1000) await new Promise(resolve => setImmediate(resolve));
  assert.ok(release, '任务应进入素材验证阶段');
  ui.get('cancel').click(); release(); await pending;
  assert.equal(ui.downloads.length, 1);
  assert.match(ui.get('status').textContent, /已取消/);
  ui.get('redownload').click();
  assert.equal(ui.downloads.at(-1).blob, original);
});

test('普通保存自动发起下载并自动收起，有内容缺失时提示保留到关闭', async () => {
  const complete = harness();
  complete.open(); complete.select('html');
  await complete.get('button').click();
  assert.equal(complete.get('chooser').hidden, true);
  assert.equal(complete.downloads[0].name, '文档A.html');
  assert.equal(complete.downloads[0].blob.type, 'text/html;charset=utf-8');
  assert.match(complete.get('status').textContent, /已交给浏览器保存/);
  assert.equal(complete.get('card').hidden, false);
  complete.autoClose();
  assert.equal(complete.get('popover').hidden, true);

  const partial = harness({warnings:[{code:'code_lines_missing',label:'章节一：缺失第 3 行'}]});
  partial.open(); partial.select('html');
  await partial.get('button').click();
  assert.match(partial.get('status').textContent, /部分保存/);
  assert.match(partial.panelText(), /章节一：缺失第 3 行/);
  partial.autoClose();
  assert.equal(partial.get('card').hidden, false);
  partial.get('dismiss').click();
  assert.equal(partial.get('popover').hidden, true);
});

test('每次完整保存采集最新内容，显式补存与再次下载复用本次采集', async () => {
  const ui = harness();
  ui.open(); ui.select('html');
  await ui.get('button').click();
  assert.equal(ui.captures(), 1);
  ui.get('redownload').click();
  assert.equal(ui.downloads[1].blob, ui.downloads[0].blob);
  ui.open(); ui.select('markdown');
  await ui.reuse();
  assert.equal(ui.captures(), 1);
  assert.equal(ui.downloads.at(-1).name, '文档A-Markdown.zip');
  ui.open(); ui.select('html');
  await ui.get('button').click();
  assert.equal(ui.captures(), 2);
});

test('被页面取消或未送达的下载显示失败，重新下载复用已生成文件', async () => {
  for (const mode of ['preventDefault', 'undelivered']) {
    const ui = harness();
    ui.blockDownloads(mode); ui.open(); ui.select('html');
    await ui.get('button').click();
    assert.equal(ui.downloads.length, 0);
    assert.match(ui.get('status').textContent, /保存失败.*(?:取消|阻止).*下载/u);
    assert.doesNotMatch(ui.get('status').textContent, /已交给浏览器/u);
    assert.equal(ui.get('redownload').hidden, false);
    assert.equal(ui.get('retry').hidden, false);
    ui.autoClose(); assert.equal(ui.get('card').hidden, false);
    ui.blockDownloads(''); ui.get(mode === 'preventDefault' ? 'retry' : 'redownload').click();
    assert.equal(ui.downloads.length, 1);
    assert.equal(ui.captures(), 1);
    assert.match(ui.get('status').textContent, /已交给浏览器/u);
    assert.equal(ui.get('retry').hidden, true);
  }
});

test('重新下载和下载提示被取消时显示失败，不丢失原文件或重复采集', async () => {
  const ui = harness({warnings:[{code:'code_lines_missing',label:'第 3 行缺失'}]});
  ui.open(); ui.select('html'); await ui.get('button').click();
  const original = ui.downloads[0].blob;
  ui.blockDownloads('preventDefault');
  assert.doesNotThrow(() => ui.get('redownload').click());
  assert.match(ui.get('status').textContent, /保存失败.*下载/u);
  assert.doesNotThrow(() => ui.get('report').click());
  assert.match(ui.get('status').textContent, /保存失败.*下载/u);
  assert.equal(ui.downloads.length, 1);
  ui.blockDownloads(''); ui.get('retry').click();
  assert.equal(ui.downloads.at(-1).blob, original);
  assert.match(ui.get('status').textContent, /部分保存.*已交给浏览器/u);
  assert.equal(ui.captures(), 1);
  ui.get('report').click();
  assert.match(ui.downloads.at(-1).name, /保存提示\.txt$/u);
  assert.match(await ui.downloads.at(-1).blob.text(), /第 3 行缺失/u);
  assert.match(ui.get('status').textContent, /部分保存.*已交给浏览器/u);
  assert.match(ui.get('report-status').textContent, /提示文件已交给浏览器保存/u);
});

test('提示报告成功不会覆盖正文尚未交付的失败状态，重试仍复用正文文件', async () => {
  const ui = harness({warnings:[{code:'code_lines_missing',label:'第 3 行缺失'}]});
  ui.blockDownloads('preventDefault'); ui.open(); ui.select('html'); await ui.get('button').click();
  assert.equal(ui.downloads.length, 0);
  const documentStatus = ui.get('status').textContent;
  ui.blockDownloads(''); ui.get('report').click();
  assert.match(ui.downloads[0].name, /保存提示\.txt$/u);
  assert.equal(ui.get('status').textContent, documentStatus);
  assert.match(ui.get('report-status').textContent, /提示文件已交给浏览器保存/u);
  assert.equal(ui.get('retry').hidden, false);
  ui.get('retry').click();
  assert.equal(ui.downloads[1].name, '文档A.html');
  assert.match(ui.get('status').textContent, /部分保存.*已交给浏览器/u);
  assert.equal(ui.get('retry').hidden, true);
  assert.equal(ui.captures(), 1);
});

for (const error of [new Error('下载异常'), new DOMException('下载被拒绝', 'SecurityError'), new DOMException('下载中止', 'AbortError')]) {
  test('正文下载抛出 ' + error.name + ' 后重试同一个 Blob，不重复采集或生成 PDF', async () => {
    const ui = harness();
    ui.blockDownloads(error); ui.open(); ui.select('pdf'); await ui.get('button').click();
    const original = ui.downloadAttempts[0].blob;
    assert.equal(ui.downloads.length, 0);
    assert.match(ui.get('status').textContent, /保存失败/u);
    assert.equal(ui.get('retry').hidden, false);
    ui.blockDownloads(''); await ui.get('retry').click();
    assert.equal(ui.downloads[0].blob, original);
    assert.equal(ui.captures(), 1);
    assert.equal(ui.pdfs(), 1);
  });
}

for (const reportFailsFirst of [false, true]) {
  test('PDF 生成失败后，报告' + (reportFailsFirst ? '先失败再成功' : '成功') + '仍保留正文失败与重试', async () => {
    let pdfFails = true;
    const ui = harness({warnings:[{code:'code_lines_missing',label:'第 3 行缺失'}],
      pdfHook:() => { if (pdfFails) throw new Error('PDF 生成失败，请重试。'); }});
    ui.open(); ui.select('pdf'); await ui.get('button').click();
    const documentStatus = ui.get('status').textContent;
    const heading = ui.get('job-heading').textContent;
    assert.match(documentStatus, /保存失败.*PDF/u);
    assert.equal(ui.get('retry').hidden, false);
    let reportBlob;
    if (reportFailsFirst) {
      ui.blockDownloads(new Error('提示下载异常')); ui.get('report').click();
      reportBlob = ui.downloadAttempts.at(-1).blob;
      assert.equal(ui.get('status').textContent, documentStatus);
      assert.equal(ui.get('job-heading').textContent, heading);
      assert.equal(ui.get('retry').hidden, false);
      assert.match(ui.get('report-status').textContent, /提示文件.*失败/u);
    }
    ui.blockDownloads(''); ui.get('report').click();
    assert.match(ui.downloads[0].name, /保存提示\.txt$/u);
    if (reportBlob) assert.equal(ui.downloads[0].blob, reportBlob);
    assert.equal(ui.get('status').textContent, documentStatus);
    assert.equal(ui.get('job-heading').textContent, heading);
    assert.equal(ui.get('retry').hidden, false);
    assert.match(ui.get('report-status').textContent, /提示文件已交给浏览器保存/u);
    pdfFails = false; await ui.get('retry').click();
    assert.equal(ui.downloads[1].name, '文档A.pdf');
    assert.equal(ui.pdfs(), 2);
    assert.equal(ui.get('retry').hidden, true);
  });
}

test('提示报告失败只重试报告，不将已交付的正文变成失败', async () => {
  const ui = harness({warnings:[{code:'code_lines_missing',label:'第 3 行缺失'}]});
  ui.open(); ui.select('html'); await ui.get('button').click();
  const original = ui.downloads[0].blob, documentStatus = ui.get('status').textContent;
  ui.blockDownloads(new Error('提示下载异常')); ui.get('report').click();
  const reportBlob = ui.downloadAttempts.at(-1).blob;
  assert.equal(ui.get('status').textContent, documentStatus);
  assert.equal(ui.get('retry').hidden, true);
  assert.match(ui.get('report').textContent, /重试/u);
  ui.blockDownloads(''); ui.get('report').click();
  assert.equal(ui.downloads[1].blob, reportBlob);
  assert.equal(ui.get('status').textContent, documentStatus);
  ui.get('redownload').click();
  assert.equal(ui.downloads[2].blob, original);
  assert.equal(ui.captures(), 1);
});

test('下载失败后切篇清除待下载正文和提示报告', async () => {
  const ui = harness({warnings:[{code:'code_lines_missing',label:'第 3 行缺失'}]});
  ui.blockDownloads(new Error('下载异常')); ui.open(); ui.select('html'); await ui.get('button').click();
  const oldReport = ui.get('report'); oldReport.click();
  ui.navigate('B');
  assert.equal(ui.get('retry').hidden, true);
  assert.equal(ui.get('redownload').hidden, true);
  ui.blockDownloads(''); ui.open(); await ui.get('button').click();
  oldReport.click();
  assert.deepEqual(ui.downloads.map(file => file.name), ['文档B.html']);
  ui.get('report').click();
  assert.equal(ui.downloads[1].name, '文档B-保存提示.txt');
});

test('取消新保存后下载报告保留取消状态，旧文件仍可下载', async () => {
  let release, pause = false;
  const ui = harness({warnings:[{code:'code_lines_missing',label:'第 3 行缺失'}],
    captureHook:() => pause ? new Promise(resolve => { release = resolve; }) : undefined});
  ui.open(); ui.select('html'); await ui.get('button').click();
  const original = ui.downloads[0].blob;
  pause = true; ui.open(); const pending = ui.get('button').click();
  ui.get('cancel').click(); release(); await pending;
  const documentStatus = ui.get('status').textContent;
  assert.match(documentStatus, /已取消/u);
  ui.get('report').click();
  assert.equal(ui.get('status').textContent, documentStatus);
  assert.equal(ui.get('retry').hidden, true);
  ui.get('redownload').click();
  assert.equal(ui.downloads.at(-1).blob, original);
});

test('入口保留 PNG、JPEG、GIF、WebP 原编码和原字节到 HTML 与 Markdown 素材', async () => {
  const jpeg = '/9j/4AAQSkZJRgABAQAASABIAAD/4QBMRXhpZgAATU0AKgAAAAgAAYdpAAQAAAABAAAAGgAAAAAAA6ABAAMAAAABAAEAAKACAAQAAAABAAAAAaADAAQAAAABAAAAAQAAAAD/7QA4UGhvdG9zaG9wIDMuMAA4QklNBAQAAAAAAAA4QklNBCUAAAAAABDUHYzZjwCyBOmACZjs+EJ+/8AAEQgAAQABAwEiAAIRAQMRAf/EAB8AAAEFAQEBAQEBAAAAAAAAAAABAgMEBQYHCAkKC//EALUQAAIBAwMCBAMFBQQEAAABfQECAwAEEQUSITFBBhNRYQcicRQygZGhCCNCscEVUtHwJDNicoIJChYXGBkaJSYnKCkqNDU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6g4SFhoeIiYqSk5SVlpeYmZqio6Slpqeoqaqys7S1tre4ubrCw8TFxsfIycrS09TV1tfY2drh4uPk5ebn6Onq8fLz9PX29/j5+v/EAB8BAAMBAQEBAQEBAQEAAAAAAAABAgMEBQYHCAkKC//EALURAAIBAgQEAwQHBQQEAAECdwABAgMRBAUhMQYSQVEHYXETIjKBCBRCkaGxwQkjM1LwFWJy0QoWJDThJfEXGBkaJicoKSo1Njc4OTpDREVGR0hJSlNUVVZXWFlaY2RlZmdoaWpzdHV2d3h5eoKDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uLj5OXm5+jp6vLz9PX29/j5+v/bAEMAAgICAgICAwICAwUDAwMFBgUFBQUGCAYGBgYGCAoICAgICAgKCgoKCgoKCgwMDAwMDA4ODg4ODw8PDw8PDw8PD//bAEMBAgICBAQEBwQEBxALCQsQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEP/dAAQAAf/aAAwDAQACEQMRAD8A+Y6KKK/n8/2AP//Z';
  const images = [
    {blockId:'png',mime:'image/png',extension:'png',dataUrl:pngDataUrl},
    {blockId:'jpeg',mime:'image/jpeg',extension:'jpg',dataUrl:'data:image/jpeg;base64,' + jpeg},
    {blockId:'gif',mime:'image/gif',extension:'gif',dataUrl:'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw=='},
    {blockId:'webp',mime:'image/webp',extension:'webp',dataUrl:'data:image/webp;base64,UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEADsD+JaQAA3AAAAAA'},
  ];
  const blocks = images.map(({blockId:id}) => ({id,type:'image',html:'<div data-block-id="'+id+'" data-block-type="image"><img></div>'}));
  const ui = harness({captureImages:images,captureData:{blocks}});
  ui.open(); ui.select('markdown','html'); await ui.get('button').click();
  assert.equal(ui.downloads.length, 1);
  const files = unzipSync(new Uint8Array(await ui.downloads[0].blob.arrayBuffer()));
  const html = new TextDecoder().decode(files['文档A.html']);
  for (const image of images) {
    const path = 'images/' + image.blockId + '.' + image.extension;
    assert.deepEqual(files[path], new Uint8Array(Buffer.from(image.dataUrl.split(',')[1], 'base64')));
    assert.ok(html.includes(image.dataUrl));
  }
  assert.doesNotMatch(ui.panelText(), /图片缺失|图片无效/u);
  ui.open(); ui.select('html'); await ui.reuse();
  const standalone = await ui.downloads.at(-1).blob.text();
  for (const image of images) assert.ok(standalone.includes(image.dataUrl));
});

test('入口将 SVG 原图及嵌套 PNG 回退传给 PDF 快照，归档只保存 SVG 主素材', async () => {
  const source = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="10" viewBox="0 0 20 10"><text x="1" y="8">Vector</text></svg>';
  const image = {blockId:'vector',mime:'image/svg+xml',dataUrl:'data:image/svg+xml;base64,'+Buffer.from(source).toString('base64'),
    rasterFallback:{mime:'image/png',dataUrl:pngDataUrl}};
  let saved;
  const ui = harness({captureImages:[image],captureData:{blocks:[{id:'vector',type:'diagram',html:'<div data-block-type="diagram"></div>'}]},
    pdfHook:snapshot => { saved = snapshot; }});
  ui.open(); ui.select('markdown','html','pdf'); await ui.get('button').click();
  assert.equal(ui.downloads.length, 1);
  assert.equal(saved.assets[0]?.type, 'image/svg+xml');
  assert.deepEqual(saved.assets[0].rasterFallback, {type:'image/png',bytes:new Uint8Array(Buffer.from(pngDataUrl.split(',')[1],'base64'))});
  const files = unzipSync(new Uint8Array(await ui.downloads[0].blob.arrayBuffer()));
  assert.match(new TextDecoder().decode(files['images/vector.svg']), />Vector<\/text>/u);
  assert.ok(!Object.keys(files).some(path => path.endsWith('.png')));
  assert.deepEqual(saved.warnings, []);
});

test('入口将附件原件与语义源码共同交付所有格式', async () => {
  const bytes = new TextEncoder().encode('public attachment\n第二行');
  let saved;
  const ui = harness({captureData:{
    blocks:[{id:'file',type:'file',html:'<div data-block-type="file">公开附件.txt</div>'},
      {id:'equation',type:'text',html:'<div data-block-id="equation" data-record-id="record-equation" data-block-type="text"><div class="ace-line">旧文本</div></div>'}],
    attachments:[{blockId:'file',name:'公开附件.txt',mime:'text/plain',bytes}],
    semantic:{version:1,recordId:'A',blocks:[{id:'equation',recordId:'record-equation',type:'text',ready:true,
      ops:[{insert:'\ufffc',attributes:{equation:'x^2'}}]}]},
  },pdfHook:snapshot => { saved = snapshot; }});
  ui.open(); ui.select('markdown','html','attachments','pdf'); await ui.get('button').click();
  assert.equal(ui.downloads.length, 1);
  const files = unzipSync(new Uint8Array(await ui.downloads[0].blob.arrayBuffer()));
  assert.deepEqual(files['attachments/file-公开附件.txt'], bytes);
  const html = new TextDecoder().decode(files['文档A.html']);
  assert.match(html, /href="data:application\/octet-stream;base64,/u);
  assert.match(decodeURI(new TextDecoder().decode(files['文档A.md'])), /attachments\/file-公开附件\.txt/u);
  assert.match(html, /data-export-equation="x\^2"/u);
  assert.deepEqual(saved.assets.find(asset => asset.role === 'attachment')?.bytes, bytes);
  assert.deepEqual(saved.warnings, []);
});

test('PDF 单选直接下载 PDF，多格式只下载一个包含 PDF 的 ZIP 且清单吻合', async () => {
  const ui = harness();
  ui.open(); ui.select('pdf');
  await ui.get('button').click();
  assert.equal(ui.downloads.length, 1);
  assert.equal(ui.downloads[0].name, '文档A.pdf');
  assert.equal(await ui.downloads[0].blob.text(), '%PDF-fake');
  assert.equal(ui.get('pdf'), undefined);
  ui.open(); ui.select('markdown', 'html', 'attachments', 'pdf');
  await ui.reuse();
  assert.equal(ui.downloads.length, 2);
  const file = ui.downloads.at(-1);
  assert.equal(file.name, '文档A-导出.zip');
  const entries = unzipSync(new Uint8Array(await file.blob.arrayBuffer()));
  assert.deepEqual(Object.keys(entries).sort(), ['manifest.txt', '文档A.html', '文档A.md', '文档A.pdf'].sort());
  assert.equal(new TextDecoder().decode(entries['文档A.pdf']), '%PDF-fake');
  for (const name of Object.keys(entries)) assert.ok(ui.panelText().includes(name));
  assert.equal(ui.captures(), 1);
  assert.equal(ui.pdfs(), 2);
});

test('PDF 转换提示同时写入面板和归档清单，后续补存 HTML 保持原始采集提示', async () => {
  const note = '1 幅图片已用文字说明';
  let pdfInput;
  const ui = harness({pdfNotes:[note], pdfHook:snapshot => { pdfInput = snapshot; }});
  ui.open(); ui.select('pdf', 'attachments');
  await ui.get('button').click();
  const entries = unzipSync(new Uint8Array(await ui.downloads[0].blob.arrayBuffer()));
  const manifest = new TextDecoder().decode(entries['manifest.txt']);
  assert.match(ui.get('warnings').textContent, /1 幅图片已用文字说明/);
  assert.equal(ui.get('warnings').hidden, false);
  assert.ok(manifest.includes(note), '实际下载的清单应记录与面板相同的 PDF 转换提示');
  const missingSection = manifest.split('缺失、无效或未转换的项目')[1];
  assert.ok(missingSection, '清单应有缺失项目章节');
  assert.doesNotMatch(missingSection, /（无）/);
  assert.deepEqual(pdfInput.warnings, [], 'PDF 转换提示不应污染本次采集的原始提示');

  ui.open(); ui.select('html');
  await ui.reuse();
  assert.equal(ui.captures(), 1);
  assert.equal(ui.get('warnings').hidden, true);
  assert.ok(!(await ui.downloads.at(-1).blob.text()).includes(note));
  assert.deepEqual(pdfInput.warnings, []);
});

test('采集或生成 PDF 期间取消与换篇均不会交付旧文件', async () => {
  for (const stage of ['capture', 'pdf']) {
    for (const action of ['cancel', 'navigate']) {
      let release, options;
      const defer = (...args) => {
        options = stage === 'capture' ? args[0] : args[1];
        return new Promise(resolve => { release = resolve; });
      };
      const ui = harness(stage === 'capture' ? {captureHook:defer} : {pdfHook:defer});
      ui.open(); ui.select('pdf');
      const pending = ui.get('button').click();
      const started = Date.now();
      while (!release && Date.now() - started < 1000) await new Promise(resolve => setImmediate(resolve));
      assert.ok(release, '任务应进入被测试的异步阶段');
      if (action === 'navigate') ui.navigate('B'); else ui.get('cancel').click();
      assert.equal(options.shouldStop(), true);
      release(); await pending;
      assert.deepEqual(ui.downloads, []);
      assert.equal(ui.get('redownload').hidden, true);
    }
  }
});

test('PDF 生成后交给浏览器前仍能取消，取消后的补存复用已采集内容', async () => {
  let generated = false;
  const ui = harness({
    pdfHook:() => { generated = true; },
    onYield:() => { if (generated) ui.get('cancel').click(); },
  });
  ui.open(); ui.select('pdf');
  await ui.get('button').click();
  assert.equal(generated, true);
  assert.deepEqual(ui.downloads, []);
  assert.match(ui.get('status').textContent, /已取消/);
  generated = false;
  ui.open(); ui.select('html');
  await ui.reuse();
  assert.equal(ui.downloads.length, 1);
  assert.equal(ui.captures(), 1);
});

test('路由切换后等待新正文，自动恢复并使旧文件与提示失效', async () => {
  const ui = harness({warnings:[{code:'code_lines_missing',label:'章节一：缺失第 3 行'}]});
  ui.open(); ui.select('html');
  await ui.get('button').click();
  ui.changeDom('A'); ui.navigate('B'); ui.open();
  assert.equal(ui.get('button').disabled, true);
  assert.equal(ui.get('redownload').hidden, true);
  assert.doesNotMatch(ui.panelText(), /文档A|章节一/);
  ui.changeDom('B'); ui.poll();
  assert.equal(ui.get('button').disabled, false);
  await ui.get('button').click();
  assert.equal(ui.downloads.at(-1).name, '文档B.html');
  ui.changeDom('C'); ui.get('redownload').click();
  assert.equal(ui.downloads.length, 2);
  assert.equal(ui.get('redownload').hidden, true);
  assert.doesNotMatch(ui.panelText(), /章节一/);
});

test('换篇后已识别为电子表格时优先显示类型提示，即使前篇正文仍未替换', async () => {
  const ui = harness();
  ui.open(); ui.select('html');
  await ui.get('button').click();
  ui.changeDom('A');
  ui.setReadiness(false, '当前页面是电子表格，暂不支持保存这一类型。', true);
  ui.navigate('B'); ui.open();
  assert.equal(ui.get('button').disabled, true);
  assert.equal(ui.get('redownload').hidden, true);
  assert.match(ui.get('availability').textContent, /电子表格/);
  assert.doesNotMatch(ui.get('availability').textContent, /前一篇|等待当前文档/);
});

test('独立 docx 文档与正文未就绪、明确不支持类型有可理解的状态', async () => {
  const ui = harness();
  ui.navigate('D', 'docx'); ui.open(); ui.select('html');
  await ui.get('button').click();
  assert.equal(ui.downloads.at(-1).name, '文档D.html');
  ui.setReadiness(false, '正在等待文档正文加载'); ui.open();
  assert.equal(ui.get('button').disabled, true);
  assert.match(ui.panelText(), /正在等待文档正文加载/);
  ui.setReadiness(true); ui.poll();
  assert.equal(ui.get('button').disabled, false);
  ui.setReadiness(false, '当前页面是电子表格，暂不能保存为文档', true); ui.open();
  assert.equal(ui.get('button').disabled, true);
  assert.match(ui.panelText(), /电子表格/);
});

test('重新采集失败仍可再次下载上一份文件，旧成功提示计时不会收起新窗口', async () => {
  let count = 0;
  const ui = harness({captureHook:() => { if (++count === 2) throw new Error('页面未加载'); }});
  ui.open(); ui.select('html');
  await ui.get('button').click();
  const previous = ui.downloads[0].blob;
  ui.open(); ui.autoClose();
  assert.equal(ui.get('chooser').hidden, false);
  await ui.get('button').click();
  assert.match(ui.get('status').textContent, /失败/);
  ui.get('redownload').click();
  assert.equal(ui.downloads.at(-1).blob, previous);
  assert.equal(ui.downloads.length, 2);
});

test('格式选择在保存前持久化，无效或空偏好回退到 Markdown', () => {
  for (const initialFormats of [[], ['unknown']]) {
    const ui = harness({initialFormats}); ui.open();
    const selected = [...ui.get('formats').walk()].filter(node => node.tag === 'input' && node.checked);
    assert.deepEqual(selected.map(input => input.value), ['markdown']);
    ui.select('html', 'pdf');
    assert.deepEqual(JSON.parse(ui.stored.get('feishu-local-export-formats')).sort(), ['html', 'pdf']);
  }
});

test('收起进度不会取消或重复采集，隐藏期间完成不会弹开', async () => {
  let release, options;
  const ui=harness({captureHook:opts=>{options=opts;return new Promise(resolve=>{release=resolve;});}});
  ui.open();ui.select('html');
  const pending=ui.get('button').click();
  ui.get('close').click();
  assert.equal(ui.get('popover').hidden,true);
  assert.equal(options.shouldStop(),false);
  ui.open();
  assert.equal(ui.get('card').hidden,false);
  assert.equal(ui.captures(),1);
  ui.outside();release();await pending;
  assert.equal(ui.downloads.length,1);
  assert.equal(ui.get('popover').hidden,true);
  ui.open();
  assert.equal(ui.get('chooser').hidden,false);
  assert.equal(ui.get('history').open,false);
  assert.equal(ui.get('button').textContent,'保存到本地');
});

test('成功自动收起避开当前操作，异常重开仍有摘要', async () => {
  const ui=harness();ui.open();ui.select('html');await ui.get('button').click();
  ui.fire('popover','pointerenter');ui.autoClose();
  assert.equal(ui.get('popover').hidden,false);
  ui.fire('popover','pointerleave');ui.autoClose();
  assert.equal(ui.get('popover').hidden,true);
  const partial=harness({warnings:[{code:'code_lines_missing',label:'缺失第3行'}]});
  partial.open();partial.select('html');await partial.get('button').click();
  partial.get('close').click();partial.open();
  assert.equal(partial.get('chooser').hidden,false);
  assert.equal(partial.get('notice').hidden,false);
  assert.match(partial.get('notice').textContent,/内容提示/);
  partial.get('notice-details').click();
  assert.equal(partial.get('card').hidden,false);
});

test('补存明确显示读取时间，重新下载与补存不刷新时间', async () => {
  const ui=harness();ui.open();ui.select('html');await ui.get('button').click();
  const time=ui.get('history-time').textContent;
  ui.get('redownload').click();ui.get('close').click();ui.open();
  ui.get('supplement').click();
  assert.match(ui.get('snapshot-note').textContent,/使用.*读取的内容/);
  assert.equal(ui.get('button').textContent,'补存所选格式');
  ui.select('pdf');await ui.get('button').click();
  assert.equal(ui.get('history-time').textContent,time);
  assert.equal(ui.captures(),1);
});

test('拖动入口不触发点击，位置持久化且小窗口保持可见', () => {
  const ui=harness();
  ui.fire('launcher','pointerdown',{button:0,pointerId:1,clientX:980,clientY:470});
  ui.fire('launcher','pointermove',{pointerId:1,clientX:980,clientY:300,preventDefault(){}});
  ui.fire('launcher','pointerup',{pointerId:1});ui.open();
  assert.equal(ui.get('popover').hidden,true);
  assert.ok(Number(ui.stored.get('feishu-local-export-position'))>0);
  ui.resize(320,240);
  const top=parseFloat(ui.get('launcher').style.top);
  assert.ok(top>=12 && top+40<=228);
  const restored=harness({initialPosition:.4});
  assert.ok(Math.abs(parseFloat(restored.get('launcher').style.top)-(768*.4-20))<1);
});

test('拖动被系统取消后，下一次键盘打开不会被吞掉', () => {
  const ui=harness();
  ui.fire('launcher','pointerdown',{button:0,pointerId:1,clientX:980,clientY:470});
  ui.fire('launcher','pointermove',{pointerId:1,clientX:980,clientY:300,preventDefault(){}});
  ui.fire('launcher','pointercancel',{type:'pointercancel',pointerId:1});
  ui.open();
  assert.equal(ui.get('popover').hidden,false);
});

test('鼠标操作遗留的按钮焦点不阻止收起，键盘操作中的面板保留', async () => {
  const mouse=harness();mouse.open();mouse.select('html');await mouse.get('button').click();
  mouse.setActive('button');mouse.autoClose();
  assert.equal(mouse.get('popover').hidden,true);
  const keyboard=harness();keyboard.open();keyboard.select('html');await keyboard.get('button').click();
  keyboard.setActive('redownload');keyboard.keyboard('Tab');keyboard.autoClose();
  assert.equal(keyboard.get('popover').hidden,false);
  keyboard.outside();keyboard.autoClose();
  assert.equal(keyboard.get('popover').hidden,true);
});
