import test from 'node:test';
import assert from 'node:assert/strict';
import { capturePage } from '../src/userscript/capture.js';
import { convertCapture } from '../src/feishu.js';
import { readDocumentParts } from '../src/importer.js';
import { whiteboardFixture, pngDataUrl } from './helpers/whiteboard.mjs';

const ROW = '.code-line-wrapper[data-line-num]';

function virtualWhiteboard(t, {mounted = () => true, decoys = false} = {}) {
  const session = virtualDocument(t,{textIds:[],totalHeight:600});
  const fixture = whiteboardFixture({decoys});
  const doc = globalThis.document;
  const page = doc.querySelector('.page-block');
  const originalOne = doc.querySelector, originalAll = doc.querySelectorAll, originalCreate = doc.createElement;
  fixture.block.parentElement = {closest:() => page};
  fixture.block.getBoundingClientRect = () => ({top:120-session.scroller.scrollTop,bottom:152-session.scroller.scrollTop,height:32,width:64});
  fixture.block.scrollIntoView = () => { session.scroller.scrollTop = 56; };
  const all = fixture.block.querySelectorAll;
  fixture.block.querySelectorAll = selector => mounted(session) ? all.call(fixture.block,selector) : [];
  doc.querySelector = selector => selector === '[data-block-id="board"]' ? fixture.block : originalOne(selector);
  doc.querySelectorAll = selector => selector === '[data-block-id]' ? [page,fixture.block] : originalAll(selector);
  doc.createElement = tag => tag === 'canvas' ? fixture.document.createElement(tag) : originalCreate(tag);
  return {...session,...fixture};
}

function virtualImage(t, {change = () => {}, bitmapScale = 1, hidden = false, candidates = 1, onBitmap = () => {}} = {}) {
  const session = virtualDocument(t,{textIds:[],totalHeight:600});
  const doc = globalThis.document, page = doc.querySelector('.page-block');
  const originalOne = doc.querySelector, originalAll = doc.querySelectorAll, originalCreate = doc.createElement;
  const draws = [], bitmaps = [];
  const block = {
    parentElement:{closest:() => page},textContent:'',
    outerHTML:'<div data-block-id="picture" data-block-type="image"><img src="loaded.png"></div>',
    getAttribute:name => ({'data-block-id':'picture','data-block-type':'image'})[name] ?? null,
    getBoundingClientRect:() => ({top:120-session.scroller.scrollTop,bottom:152-session.scroller.scrollTop,height:32,width:64}),
    scrollIntoView() { session.scroller.scrollTop=56; },
  };
  function image(source, width = 16) {
    return {currentSrc:source,complete:true,naturalWidth:width,naturalHeight:8,hidden,
      parentElement:block,closest:() => block,getAttribute:() => '',
      getBoundingClientRect:() => ({width:16,height:8})};
  }
  let current = image('loaded-low.png');
  const refresh = () => {change({elapsed:session.elapsed(),get current() {return current;},replace:next => {current=next;},image});return current;};
  block.querySelector = selector => selector === 'img' ? refresh() : null;
  block.querySelectorAll = selector => selector === 'img' ? Array.from({length:candidates},() => refresh()) : [];
  doc.querySelector = selector => selector === '[data-block-id="picture"]' ? block : originalOne(selector);
  doc.querySelectorAll = selector => selector === '[data-block-id]' ? [page,block] : originalAll(selector);
  doc.createElement = tag => {
    if (tag !== 'canvas') return originalCreate(tag);
    const canvas = {width:0,height:0,getContext:() => ({drawImage(source) {draws.push(source);canvas.source=source;}}),
      toDataURL:() => 'data:image/png;base64,' + btoa(canvas.source.source || canvas.source.currentSrc)};
    return canvas;
  };
  const previous = Object.getOwnPropertyDescriptor(globalThis,'createImageBitmap');
  globalThis.createImageBitmap = async source => {
    const scale = typeof bitmapScale === 'function' ? bitmapScale(session.elapsed()) : bitmapScale;
    const bitmap = {width:source.naturalWidth*scale,height:source.naturalHeight*scale,
      source:source.currentSrc,closed:false,close() {this.closed=true;}};
    bitmaps.push(bitmap); await onBitmap(source); return bitmap;
  };
  t.after(() => {if (previous) Object.defineProperty(globalThis,'createImageBitmap',previous);else delete globalThis.createImageBitmap;});
  return {...session,draws,bitmaps};
}

test('普通图按已解码位图像素复制，保留高密度资源而非natural尺寸', async t => {
  const session = virtualImage(t,{bitmapScale:2});
  const result = await capturePage({onProgress:session.onProgress});
  assert.equal(result.images[0].width,32);
  assert.equal(result.images[0].height,16);
  assert.equal(session.draws[0],session.bitmaps[0]);
  assert.equal(session.draws.length,1,'稳定图片复核尺寸后复用PNG，避免重复编码');
  assert.ok(session.bitmaps.every(bitmap => bitmap.closed));
  assert.deepEqual(result.warnings,[]);
});

for (const replacement of ['source','node']) {
  test('普通图等待期间重查' + (replacement === 'source' ? '同节点所选源' : '替换节点') + '后保存稳定图片', async t => {
    let changed = false;
    const session = virtualImage(t,{change(state) {
      if (changed || state.elapsed < 400) return;
      changed=true;
      if (replacement === 'source') state.current.currentSrc='loaded-final.png';
      else state.replace(state.image('loaded-final.png'));
    }});
    const result = await capturePage({onProgress:session.onProgress});
    assert.equal(atob(result.images[0].dataUrl.split(',')[1]),'loaded-final.png');
    assert.equal(result.images.length,1);
    assert.deepEqual(result.warnings,[]);
  });
}

test('普通图首次成功后同源更高像素到达会替换已保存素材，即使HTML不变', async t => {
  const session = virtualImage(t,{change(state) {if (state.elapsed >= 1000) state.current.naturalWidth=64;}});
  const result = await capturePage({onProgress:session.onProgress});
  assert.equal(result.images.length,1);
  assert.equal(result.images[0].width,64);
  assert.deepEqual(result.warnings,[]);
});

test('普通图末尾复核解码像素尺寸，即使节点、源及natural尺寸均未变化', async t => {
  const session = virtualImage(t,{bitmapScale:elapsed => elapsed >= 1000 ? 2 : 1});
  const result = await capturePage({onProgress:session.onProgress});
  assert.equal(result.images.length,1);
  assert.equal(result.images[0].width,32);
  assert.ok(session.bitmaps.every(bitmap => bitmap.closed));
  assert.deepEqual(result.warnings,[]);
});

for (const replacement of ['source','node']) {
  test('普通图首次成功后' + (replacement === 'source' ? '同节点源切换' : '节点替换') + '会更新已有素材', async t => {
    let changed = false;
    const session = virtualImage(t,{change(state) {
      if (changed || state.elapsed < 1000) return;
      changed=true;
      if (replacement === 'source') state.current.currentSrc='loaded-later.png';
      else state.replace(state.image('loaded-later.png'));
    }});
    const result = await capturePage({onProgress:session.onProgress});
    assert.equal(result.images.length,1);
    assert.equal(atob(result.images[0].dataUrl.split(',')[1]),'loaded-later.png');
    assert.deepEqual(result.warnings,[]);
  });
}

test('普通图只有隐藏img时明确提示未能读取，不保存隐藏素材', async t => {
  const session = virtualImage(t,{hidden:true});
  const result = await capturePage({onProgress:session.onProgress});
  assert.deepEqual(result.images,[]);
  assert.ok(result.warnings.some(warning => warning.code === 'image_unreadable'));
});

for (const candidates of [0,2]) {
  test('普通图' + (candidates ? '存在多个可见候选' : '没有img') + '时明确提示无法确认素材', async t => {
    const session = virtualImage(t,{candidates});
    const result = await capturePage({onProgress:session.onProgress});
    assert.deepEqual(result.images,[]);
    assert.ok(result.warnings.some(warning => warning.code === 'image_unreadable'));
  });
}

test('普通图等待期间取消会停止且恢复阅读位置', async t => {
  const session = virtualImage(t);
  await assert.rejects(capturePage({onProgress:session.onProgress,shouldStop:() => session.elapsed() >= 400}),{name:'AbortError'});
  assert.equal(session.scroller.scrollTop,session.originalTop);
  assert.equal(session.draws.length,0);
});

test('普通图按解码后像素检查尺寸上限，超限不创建输出且释放位图', async t => {
  const session = virtualImage(t,{bitmapScale:1024});
  const result = await capturePage({onProgress:session.onProgress});
  assert.deepEqual(result.images,[]);
  assert.equal(session.draws.length,0);
  assert.ok(session.bitmaps.every(bitmap => bitmap.closed));
  assert.ok(result.warnings.some(warning => warning.code === 'image_unreadable' && warning.label.includes('尺寸')));
});

test('普通图无ImageBitmap接口时仍能从已加载img复制PNG', async t => {
  const session = virtualImage(t);
  delete globalThis.createImageBitmap;
  const result = await capturePage({onProgress:session.onProgress});
  assert.equal(result.images[0].width,16);
  assert.equal(atob(result.images[0].dataUrl.split(',')[1]),'loaded-low.png');
  assert.deepEqual(result.warnings,[]);
});

test('普通图异步创建位图期间换源会丢弃旧位图并重新稳定采集', async t => {
  let changed = false;
  const session = virtualImage(t,{onBitmap(source) {
    if (changed) return;
    changed=true; source.currentSrc='loaded-during-decode.png';
  }});
  const result = await capturePage({onProgress:session.onProgress});
  assert.equal(result.images.length,1);
  assert.equal(atob(result.images[0].dataUrl.split(',')[1]),'loaded-during-decode.png');
  assert.equal(session.draws.length,1);
  assert.ok(session.bitmaps.every(bitmap => bitmap.closed));
  assert.deepEqual(result.warnings,[]);
});

test('普通图位图创建期间取消也会释放位图而不交付素材', async t => {
  let cancelled = false;
  const session = virtualImage(t,{onBitmap() {cancelled=true;}});
  await assert.rejects(capturePage({onProgress:session.onProgress,shouldStop:() => cancelled}),{name:'AbortError'});
  assert.equal(session.draws.length,0);
  assert.ok(session.bitmaps.every(bitmap => bitmap.closed));
  assert.equal(session.scroller.scrollTop,session.originalTop);
});

test('白板内容canvas保存为PNG，排除辅助层、缩略图和隐藏或工具画布', async t => {
  const session = virtualWhiteboard(t,{decoys:true});
  const result = await capturePage({onProgress:session.onProgress});
  assert.deepEqual(result.images,[{blockId:'board',mime:'image/png',width:64,height:32,alt:'白板静态预览（当前画面）',dataUrl:pngDataUrl}]);
  assert.deepEqual(session.draws,[[session.content,0,0]]);
  assert.deepEqual(session.fills,[{color:'#ffffff',args:[0,0,64,32]}]);
  assert.deepEqual(result.warnings,[]);
  assert.equal(session.scroller.scrollTop,session.originalTop);
});

test('白板内容层迟挂载时有界等待并采集最终节点', async t => {
  const session = virtualWhiteboard(t,{mounted:clock => clock.elapsed() >= 1400});
  const result = await capturePage({onProgress:session.onProgress});
  assert.equal(result.images.length,1);
  assert.deepEqual(result.warnings,[]);
});

test('白板没有可读内容画布时给出明确失败并恢复阅读位置', async t => {
  const session = virtualWhiteboard(t,{mounted:() => false});
  const result = await capturePage({onProgress:session.onProgress});
  assert.deepEqual(result.images,[]);
  assert.ok(result.warnings.some(warning => warning.code === 'image_unreadable' && warning.label.includes('白板')));
  assert.equal(session.scroller.scrollTop,session.originalTop);
});

test('白板等待期间取消会停止采集并恢复阅读位置', async t => {
  const session = virtualWhiteboard(t,{mounted:() => false});
  await assert.rejects(capturePage({onProgress:session.onProgress,shouldStop:() => session.elapsed() >= 1500}),{name:'AbortError'});
  assert.equal(session.scroller.scrollTop,session.originalTop);
});

test('白板首次不可读在定向补采后恢复，不保留已恢复的失败提示', async t => {
  const session = virtualWhiteboard(t);
  let readable = false;
  const create = globalThis.document.createElement;
  globalThis.document.createElement = tag => {
    const canvas = create(tag);
    if (tag === 'canvas') canvas.toDataURL = () => {
      if (!readable) throw new Error('合成暂不可读');
      return pngDataUrl;
    };
    return canvas;
  };
  const result = await capturePage({onProgress(progress) {
    session.onProgress(progress); if (progress.stage === 'audit') readable=true;
  }});
  assert.equal(result.images.length,1);
  assert.deepEqual(result.warnings,[]);
  assert.equal(session.scroller.scrollTop,session.originalTop);
});

for (const recovers of [false,true]) {
test(recovers ? '引用内白板补采恢复后不保留正文未加载提示' : '同步引用只有白板时以内容画布复核，不误报正文未加载', async t => {
  const session = virtualWhiteboard(t);
  const doc = globalThis.document;
  const originalOne = doc.querySelector, originalAll = doc.querySelectorAll;
  const pageParent = session.block.parentElement;
  const reference = {
    parentElement:pageParent,textContent:'',
    outerHTML:'<div data-block-id="reference" data-block-type="synced_reference">' + session.block.outerHTML + '</div>',
    getAttribute:name => ({'data-block-id':'reference','data-block-type':'synced_reference'})[name] ?? null,
    getBoundingClientRect:() => ({top:90-session.scroller.scrollTop,bottom:190-session.scroller.scrollTop,height:100}),
    querySelectorAll:() => [session.block],
    scrollIntoView() {session.scroller.scrollTop=90;},
  };
  session.block.parentElement = {closest:() => reference};
  doc.querySelector = selector => selector === '[data-block-id="reference"]' ? reference : originalOne(selector);
  doc.querySelectorAll = selector => selector === '[data-block-id]' ? [originalOne('.page-block'),reference,session.block] : originalAll(selector);
  let readable = !recovers;
  const create = doc.createElement;
  doc.createElement = tag => {
    const canvas = create(tag);
    if (tag === 'canvas') canvas.toDataURL = () => {
      if (!readable) throw new Error('合成暂不可读');
      return pngDataUrl;
    };
    return canvas;
  };
  const result = await capturePage({onProgress(progress) {
    session.onProgress(progress); if (progress.stage === 'audit') readable=true;
  }});
  assert.equal(result.images.length,1);
  assert.equal(result.blocks[0].type,'synced_reference');
  assert.deepEqual(result.warnings,[]);
  assert.equal(session.scroller.scrollTop,session.originalTop);
});
}

for (const delayedPixels of [false,true]) {
test(delayedPixels ? '表格白板透明画布随后绘制时更新就绪状态，即使HTML完全相同' : '表格单元格内白板画布已挂载时按已就绪内容保留', async t => {
  const session = virtualWhiteboard(t);
  if (delayedPixels) session.content.alpha = 0;
  const doc = globalThis.document;
  const originalOne = doc.querySelector, originalAll = doc.querySelectorAll;
  const cell = {
    outerHTML:'<td>' + session.block.outerHTML + '</td>',textContent:'',
    getAttribute:() => null,querySelectorAll:() => [session.block],
    getBoundingClientRect:session.block.getBoundingClientRect,
  };
  const row = {cells:[cell],parentElement:{localName:'tbody'},getAttribute:() => null,cloneNode:() => ({outerHTML:'<tr></tr>'})};
  const table = {
    parentElement:session.block.parentElement,textContent:'',
    outerHTML:'<div data-block-id="table" data-block-type="table"><table><tbody><tr>' + cell.outerHTML + '</tr></tbody></table></div>',
    getAttribute:name => ({'data-block-id':'table','data-block-type':'table'})[name] ?? null,
    getBoundingClientRect:session.block.getBoundingClientRect,
    querySelector:selector => selector === 'table' ? {rows:[row]} : null,
    querySelectorAll:() => [session.block],
  };
  session.block.parentElement = {closest:() => table};
  doc.querySelector = selector => selector === '[data-block-id="table"]' ? table : originalOne(selector);
  doc.querySelectorAll = selector => selector === '[data-block-id]' ? [originalOne('.page-block'),table,session.block] : originalAll(selector);
  const originalHtml = cell.outerHTML;
  const result = await capturePage({onProgress(progress) {
    session.onProgress(progress); if (progress.stage === 'audit') session.content.alpha=255;
  }});
  assert.equal(result.images.length,1);
  assert.equal(cell.outerHTML,originalHtml);
  assert.match(result.blocks[0].html,/data-block-type="whiteboard"/u);
  assert.deepEqual(result.warnings,[]);
});
}

// A virtual editor retains a spacer at each unrendered end of the code zone.
// Reading immediately after scrolling still sees the previous rendered rows.
function virtualDocument(t, { unavailable = [], totalHeight = 2200, textIds, lineText, auditShift = 0, delayedLines } = {}) {
  let now = 0;
  let y = 75;
  let renderedAt = y;
  let movedAt = 0;
  let audit = false;
  const originalTop = y;
  const rowHeight = 20;
  const rowCount = 30;
  let codeTop = 700;
  const delayed = new Set(delayedLines ?? [1, 2, 3, 6, 29, 30]);
  const viewport = 160;
  const rect = (top, height) => ({ top: top - y, bottom: top - y + height, height });
  const scroller = {
    clientHeight: viewport, get scrollHeight() { return totalHeight; },
    get scrollTop() { return y; },
    set scrollTop(value) {
      const next = Math.max(0, Math.min(totalHeight - viewport, value));
      if (next !== y) { y = next; movedAt = now; }
    },
    getBoundingClientRect: () => ({ top: 0, bottom: viewport, height: viewport }),
  };
  t.mock.method(globalThis, 'setTimeout', (fn, ms) => {
    now += ms;
    if (now - movedAt >= 220) renderedAt = y;
    queueMicrotask(fn);
  });
  t.mock.method(Date, 'now', () => now);

  function block(id, type, top, height, parentElement) {
    return {
      textContent: type, outerHTML: '<div>' + ' '.repeat(410) + '</div>', parentElement,
      getAttribute: (key) => ({ 'data-block-id': id, 'data-block-type': type, 'data-record-id': type === 'page' ? 'testDocument' : '' })[key] ?? null,
      getBoundingClientRect: () => rect(typeof top === 'function' ? top() : top, height),
      querySelectorAll: () => [], querySelector: () => null,
      scrollIntoView: ({ block: align }) => { scroller.scrollTop = (typeof top === 'function' ? top() : top) + (height - viewport) * (align === 'end' ? 1 : 0.5); },
    };
  }
  const page = block('1', 'page', 0, totalHeight, null);
  const code = block('2', 'code', () => codeTop, rowHeight * rowCount, { closest: () => page });
  const roots = textIds ? textIds.map(id => block(id, 'text', 0, 20, { closest: () => page })) : [code];
  const rows = Array.from({ length: rowCount }, (_, i) => ({
    get textContent() { return lineText ? lineText(i + 1, audit) : 'line ' + (i + 1); },
    getAttribute: () => String(i + 1),
    getBoundingClientRect: () => rect(codeTop + i * rowHeight, rowHeight),
  }));
  function visibleRows() {
    return rows.filter((row, i) => {
      const top = codeTop + i * rowHeight;
      return top + rowHeight > renderedAt && top < renderedAt + viewport
        && !unavailable.includes(i + 1) && (audit || !delayed.has(i + 1));
    });
  }
  const zone = {
    getBoundingClientRect: () => rect(codeTop, rowHeight * rowCount),
    get lastElementChild() {
      return { contains: (node) => node === rows.at(-1) && visibleRows().includes(node) };
    },
  };
  code.querySelectorAll = (sel) => sel === ROW ? visibleRows() : [];
  code.querySelector = (sel) => sel === ROW ? visibleRows()[0] ?? null
    : ['.code-block-content', '.code-block-zone-container'].includes(sel) ? zone : null;
  const doc = {
    head: { append() {} }, createElement: () => ({ remove() {} }),
    querySelector: (sel) => {
      if (sel === '.bear-web-x-container') return scroller;
      if (sel === '.page-block-content') return { textContent: '测试文档' };
      if (sel === '.page-block' || sel === '[data-block-type="page"]') return page;
      if (sel === '[data-block-id="2"]') return code;
      return null;
    },
    querySelectorAll: (sel) => {
      if (sel === '[data-block-id]') return [page, ...roots];
      if (sel === '.docx-code-block[data-block-id]') return textIds ? [] : [code];
      if (sel === ROW) return visibleRows();
      return [];
    },
  };
  const location = { href: 'https://sample.feishu.cn/wiki/test', pathname: '/wiki/test' };
  const previous = Object.fromEntries(['document', 'location'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  Object.assign(globalThis, { document: doc, location });
  t.after(() => {
    for (const [key, descriptor] of Object.entries(previous)) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  });
  return {
    scroller, originalTop, location, elapsedAtPosition:() => now - movedAt, elapsed:() => now,
    growHeight:amount => { totalHeight += amount; },
    onProgress: (progress) => {
      if (progress.stage === 'audit') {
        audit = true; codeTop += auditShift; totalHeight += auditShift;
      }
    },
  };
}

test('补回虚拟代码块首三行、中间行和尾行，保留源行号和内容', async (t) => {
  const session = virtualDocument(t);
  const result = await capturePage({ onProgress: session.onProgress });
  assert.deepEqual(result.code['2'].lines, Array.from({ length: 30 }, (_, i) => ({ num: i + 1, text: 'line ' + (i + 1) })));
  assert.equal(result.code['2'].totalLines, 30);
  assert.deepEqual(result.warnings, []);
  assert.equal(session.scroller.scrollTop, session.originalTop);
});

test('仍不可见的行给出连续行号范围，未确认的尾行单独说明', async (t) => {
  const session = virtualDocument(t, { unavailable: [1, 2, 3, 6, 29, 30] });
  const result = await capturePage({ onProgress: session.onProgress });
  assert.match(result.warnings.find(w => w.code === 'code_lines_missing')?.label ?? '', /1[–-]3、6/);
  assert.equal(result.code['2'].totalLines, undefined);
  assert.match(result.warnings.find(w => w.code === 'code_tail_unconfirmed')?.label ?? '', /29[–-]30/);
});

test('审计前布局位移时重新定位代码块，补回尚未出现的连续尾行', async (t) => {
  const session = virtualDocument(t, {
    auditShift: 2100,
    delayedLines: Array.from({length:10}, (_, i) => i + 21),
  });
  const result = await capturePage({onProgress:session.onProgress});
  assert.deepEqual(result.code['2'].lines, Array.from({length:30}, (_, i) => ({num:i + 1, text:'line ' + (i + 1)})));
  assert.equal(result.code['2'].totalLines, 30);
  assert.deepEqual(result.warnings, []);
  assert.equal(session.scroller.scrollTop, session.originalTop);
});

test('默认 400 步耗尽且未确认文末，返回有原因的部分采集结果', async (t) => {
  const session = virtualDocument(t, { totalHeight: 80000 });
  const result = await capturePage({ onProgress: session.onProgress });
  assert.match(result.warnings.find(w => w.code === 'capture_step_limit')?.label ?? '', /400.*文末/);
});

test('采集中换篇不会把旧文档的滚动位置写回新文档', async (t) => {
  const session = virtualDocument(t);
  let stop = false;
  await assert.rejects(capturePage({
    onProgress(progress) {
      if (progress.stage === 'scroll') {
        session.location.pathname = '/wiki/next';
        session.scroller.scrollTop = 640;
        stop = true;
      }
    }, shouldStop: () => stop,
  }), { name: 'AbortError' });
  assert.equal(session.scroller.scrollTop, 640);
});

test('切换到其他内容类型时即使旧正文仍在 DOM 里也拒绝采集', async (t) => {
  const session = virtualDocument(t);
  session.location.href = 'https://sample.feishu.cn/sheets/SheetToken';
  session.location.pathname = '/sheets/SheetToken';
  await assert.rejects(capturePage(), /电子表格/);
  assert.equal(session.scroller.scrollTop, session.originalTop);
});

test('大整数块编号保留页面顺序，跳过不精确的连续编号扫描', async (t) => {
  const ids = ['9007199254740996', '9007199254740992', '9007199254740993', '9007199254740994', '9007199254740995'];
  const session = virtualDocument(t, { textIds: ids, totalHeight: 200 });
  const result = await capturePage({ onProgress: session.onProgress });
  assert.deepEqual(result.blocks.map(b => b.id), ids);
  assert.deepEqual(result.warnings, []);
});

test('有行号的空占位随后出现文本时补齐，同时保留真实空行', async (t) => {
  const session = virtualDocument(t, {
    lineText(num, audit) { return num === 27 || (num === 28 && !audit) ? '' : 'line ' + num; },
  });
  const result = await capturePage({ onProgress: session.onProgress });
  assert.equal(result.code['2'].lines[26].text, '');
  assert.equal(result.code['2'].lines[27].text, 'line 28');
  assert.ok(!result.warnings.some(warning => warning.code === 'capture_content_changed'));
});

test('已读取代码行发生等长修改时更新观察到的行并报告内容变化', async t => {
  const session = virtualDocument(t, {lineText:(num,audit) => (audit ? 'edit ' : 'line ') + num});
  const result = await capturePage({onProgress:session.onProgress});
  assert.ok(result.code['2'].lines.some(line => line.text.startsWith('edit ')), '审计中的当前行应能替换等长旧文本');
  assert.equal(result.warnings.filter(w => w.code === 'capture_content_changed').length, 1);
  assert.equal(session.scroller.scrollTop, session.originalTop);
});

test('代码行虚拟化为空占位时不清除已读取文本或误报编辑',async t=>{
  const session=virtualDocument(t,{lineText:(num,audit)=>audit&&num===27?'':'line '+num});
  const result=await capturePage({onProgress:session.onProgress});
  assert.equal(result.code['2'].lines.find(line=>line.num===27).text,'line 27');
  assert.ok(!result.warnings.some(w=>w.code==='capture_content_changed'));
});

function changingText(t, {styleOnly = false, shrink = false, late = false, stable = false} = {}) {
  const session = virtualDocument(t, {textIds:[], totalHeight:600});
  const doc = globalThis.document, page = doc.querySelector('.page-block');
  const originalAll=doc.querySelectorAll, originalOne=doc.querySelector;
  let audit=false;
  const value = () => late && session.elapsedAtPosition() < 260 ? '' : shrink && session.scroller.scrollTop > 120 ? '' : audit && !styleOnly && !late && !stable ? '新版' : '原文';
  const root={
    getAttribute:key => ({'data-block-id':'2','data-block-type':'text'})[key] ?? null,
    parentElement:{closest:()=>page},
    get textContent(){return value();},
    get outerHTML(){return '<div data-block-id="2" data-block-type="text"><div class="zone-container"><div class="ace-line">' +
      (value() ? '<span data-string="true"' + (audit && styleOnly ? ' style="text-decoration:line-through"' : '') + '>'+value()+'</span>' : '<span class="render-unit-wrapper"></span>') + '</div></div></div>';},
    querySelector:selector => value() && selector.includes('ace-line') ? {} : null,
    querySelectorAll:()=>[],
    getBoundingClientRect:()=>({top:0,bottom:80,height:80}),
    scrollIntoView(){},
  };
  doc.querySelectorAll=selector => selector==='[data-block-id]' ? [page,root] : originalAll(selector);
  doc.querySelector=selector => selector==='[data-block-id="2"]' ? root : originalOne(selector);
  return {...session, root, onProgress(progress){session.onProgress(progress);if(progress.stage==='audit')audit=true;}};
}

test('正文等长替换与仅删除线变化均能复核并报告', async t => {
  for(const styleOnly of [false,true]) await t.test(styleOnly?'删除线':'正文',async t => {
    const session=changingText(t,{styleOnly});
    const result=await capturePage({onProgress:session.onProgress});
    assert.match(result.blocks[0].html,styleOnly ? /line-through/ : /新版/);
    assert.ok(result.warnings.some(w=>w.code==='capture_content_changed'));
  });
});

test('叶块被虚拟占位替换时保留已采集正文且不误报编辑',async t=>{
  const session=changingText(t,{shrink:true});
  const result=await capturePage({onProgress:session.onProgress});
  assert.match(result.blocks[0].html,/原文/);
  assert.ok(!result.warnings.some(w=>w.code==='capture_content_changed'));
});

test('定位尺寸、焦点类名和选区属性变化不作为正文编辑',async t=>{
  const session=changingText(t,{stable:true});
  const original=Object.getOwnPropertyDescriptor(session.root,'outerHTML').get;
  let active=false;
  Object.defineProperty(session.root,'outerHTML',{get(){return original.call(this).replace('<div data-block-id="2"',
    '<div style="height:'+(active?120:80)+'px;left:'+(active?3:0)+'px" class="'+(active?'focused':'')+'" data-selected="'+active+'" data-block-id="2"');}});
  const result=await capturePage({onProgress(progress){session.onProgress(progress);if(progress.stage==='audit')active=true;}});
  assert.ok(!result.warnings.some(w=>w.code==='capture_content_changed'));
});

test('等价标签、样式声明和文本分词重组不作为正文编辑',async t=>{
  const session=changingText(t,{stable:true});
  const original=Object.getOwnPropertyDescriptor(session.root,'outerHTML').get;
  let refreshed=false;
  Object.defineProperty(session.root,'outerHTML',{get(){return original.call(this).replace('>原文</span>',refreshed?
    ' style="font-weight : bold; text-decoration: line-through"><span>原</span><span>文</span></span>' :
    '><b><s>原文</s></b></span>');}});
  const result=await capturePage({onProgress(progress){session.onProgress(progress);if(progress.stage==='audit')refreshed=true;}});
  assert.ok(!result.warnings.some(w=>w.code==='capture_content_changed'));
});

test('表格已就绪单元格的等长文本和删除线更新进入重建结果',async t=>{
  for(const styleOnly of [false,true])await t.test(styleOnly?'删除线':'正文',async t=>{
    const session=virtualDocument(t,{textIds:[],totalHeight:600});
    const doc=globalThis.document,page=doc.querySelector('.page-block'),all=doc.querySelectorAll,one=doc.querySelector;
    let audit=false;
    const value=()=>audit&&!styleOnly?'新版':'原文';
    const part={getAttribute:()=> 'text',querySelector:()=>({}),classList:{contains:()=>false},get textContent(){return value();}};
    const cell={
      getAttribute:key=>({'data-block-id':'22','data-block-type':'table_cell'})[key]??null,
      get textContent(){return value();},get outerHTML(){return '<td data-block-id="22"><div data-block-id="23" data-block-type="text"><div class="ace-line"><span data-string="true"'+
        (audit&&styleOnly?' style="text-decoration-line:line-through"':'')+'>'+value()+'</span></div></div></td>';},
      querySelectorAll:()=>[part],getBoundingClientRect:()=>({top:0,bottom:20,height:20}),
    };
    const row={cells:[cell],getAttribute:()=> '0',cloneNode:()=>({outerHTML:'<tr></tr>'})};
    const table={
      getAttribute:key=>({'data-block-id':'2','data-block-type':'table'})[key]??null,parentElement:{closest:()=>page},
      get textContent(){return value();},get outerHTML(){return '<div data-block-id="2" data-block-type="table"><table><tr>'+cell.outerHTML+'</tr></table></div>';},
      querySelector:selector=>selector==='table'?{rows:[row]}:null,querySelectorAll:()=>[],getBoundingClientRect:()=>({top:0,bottom:20,height:20}),
    };
    doc.querySelectorAll=selector=>selector==='[data-block-id]'?[page,table]:all(selector);
    doc.querySelector=selector=>selector==='[data-block-id="2"]'?table:one(selector);
    const result=await capturePage({onProgress(progress){session.onProgress(progress);if(progress.stage==='audit')audit=true;}});
    assert.match(result.blocks[0].html,styleOnly?/line-through/:/新版/);
    assert.equal(result.warnings.filter(w=>w.code==='capture_content_changed').length,1);
  });
});

test('同节点迟到正文不能被短暂稳定的空占位提前跳过',async t=>{
  const session=changingText(t,{late:true});
  const result=await capturePage({onProgress:session.onProgress});
  assert.match(result.blocks[0].html,/原文/);
  assert.ok(!result.warnings.some(w=>w.code==='capture_content_changed'));
});

test('自适应等待在稳定段落上少于固定380ms，显式固定模式仍可对照',async t=>{
  const timings={};
  for(const mode of ['fixed','adaptive'])await t.test(mode,async t=>{
    const session=changingText(t,{stable:true});
    const result=await capturePage({...(mode==='fixed'?{dwellMs:380}:{}),onProgress:session.onProgress});
    assert.match(result.blocks[0].html,/原文/);
    timings[mode]=session.elapsed();
  });
  assert.ok(timings.adaptive<timings.fixed,JSON.stringify(timings));
});

test('滚到文末后高度继续增长时继续采集新尾部',async t=>{
  const session=changingText(t,{stable:true});
  const doc=globalThis.document,page=doc.querySelector('.page-block'),all=doc.querySelectorAll,one=doc.querySelector;
  let grown=false;
  const tail={
    getAttribute:key=>({'data-block-id':'3','data-block-type':'text'})[key]??null,
    parentElement:{closest:()=>page},textContent:'迟到的文末',
    outerHTML:'<div data-block-id="3" data-block-type="text"><div class="ace-line"><span data-string="true">迟到的文末</span></div></div>',
    querySelectorAll:()=>[],querySelector:()=>null,
    getBoundingClientRect:()=>({top:850-session.scroller.scrollTop,bottom:870-session.scroller.scrollTop,height:20}),
    scrollIntoView(){},
  };
  doc.querySelectorAll=selector=>selector==='[data-block-id]'?[...all(selector),...(grown?[tail]:[])]:all(selector);
  doc.querySelector=selector=>selector==='[data-block-id="3"]'&&grown?tail:one(selector);
  const result=await capturePage({onProgress(progress){session.onProgress(progress);if(!grown&&progress.stage==='scroll'&&progress.percent>=95){grown=true;session.growHeight(320);}}});
  assert.ok(result.blocks.some(block=>block.html.includes('迟到的文末')));
  assert.ok(!result.warnings.some(w=>w.code==='capture_step_limit'));
});

for (const wrapper of ['page','quote_container','direct','missing']) test(wrapper + ' 容器中多层嵌套列表跨视口重建且本行只保留一次',async t=>{
  const session=virtualDocument(t,{textIds:[],totalHeight:1500});
  const doc=globalThis.document,outer=doc.querySelector('.page-block'),all=doc.querySelectorAll,one=doc.querySelector;
  const early=()=>session.scroller.scrollTop<400;
  function list(id,text,parent,children){
    return {
      getAttribute:key=>({'data-block-id':id,'data-block-type':'ordered'})[key]??null,
      parentElement:{closest:()=>parent()},
      get textContent(){return text+children().map(child=>child.textContent).join('');},
      get outerHTML(){return '<div data-block-id="'+id+'" data-block-type="ordered"><div class="list-wrapper ordered-list"><div class="list"><div class="zone-container"><div class="ace-line"><span data-string="true">'+text+'</span></div></div></div><div class="list-children">'+children().map(child=>child.outerHTML).join('')+'</div></div></div>';},
      querySelectorAll:()=>[],querySelector:()=>null,
      getBoundingClientRect:()=>({top:(Number(id)>5?700:100)-session.scroller.scrollTop,bottom:950-session.scroller.scrollTop,height:850}),
      scrollIntoView(){},
    };
  }
  const first=list('5','早屏子项',()=>parent,()=>[]);
  const grandchild=list('8','晚屏孙项',()=>last,()=>[]);
  const last=list('7','晚屏子项',()=>parent,()=>[grandchild]);
  const direct = wrapper === 'direct' || wrapper === 'missing';
  const parent=list('4','列表本行',()=>direct?reference:inner,()=>early()?[first]:[last]);
  const inner={
    getAttribute:key=>({'data-block-id':'3','data-block-type':wrapper})[key]??null,parentElement:{closest:()=>reference},
    get textContent(){return '同步标题'+parent.textContent;},
    get outerHTML(){return '<div data-block-id="3" data-block-type="'+wrapper+'"><div class="page-block-content">同步标题</div><div class="reference-page-block-childen">'+parent.outerHTML+'</div></div>';},
    querySelectorAll:()=>[],getBoundingClientRect:()=>({top:90-session.scroller.scrollTop,bottom:1000-session.scroller.scrollTop,height:910}),
  };
  const reference={
    getAttribute:key=>({'data-block-id':'2','data-block-type':direct?'quote_container':'synced_reference'})[key]??null,parentElement:{closest:()=>outer},
    get textContent(){return direct?parent.textContent:inner.textContent;},get outerHTML(){return '<div data-block-id="2" data-block-type="'+(direct?'quote_container':'synced_reference')+'">'+
      (wrapper==='missing'?'<span>容器本行</span>':direct?parent.outerHTML:inner.outerHTML)+'</div>';},
    querySelectorAll:()=>[],getBoundingClientRect:()=>({top:90-session.scroller.scrollTop,bottom:1000-session.scroller.scrollTop,height:910}),
  };
  const nodes=()=>[outer,reference,...(direct?[]:[inner]),parent,...(early()?[first]:[last,grandchild])];
  doc.querySelectorAll=selector=>selector==='[data-block-id]'?nodes():all(selector);
  doc.querySelector=selector=>nodes().find(node=>selector==='[data-block-id="'+node.getAttribute('data-block-id')+'"]')||one(selector);
  const result=await capturePage({onProgress:session.onProgress});
  assert.equal(result.blocks.length,1);
  if(wrapper==='missing'){
    assert.ok(result.warnings.some(w=>w.code==='missing_block'&&w.label.includes('列表块')));
    assert.ok(!result.warnings.some(w=>w.label.includes('表格块')));
    assert.ok(!result.blocks[0].html.includes('早屏子项'),'无法确认位置时不盲目追加');
    return;
  }
  for(const text of ['列表本行','早屏子项','晚屏子项','晚屏孙项'])assert.equal(result.blocks[0].html.split(text).length-1,1,text);
  assert.deepEqual(result.warnings,[]);
  const converted=convertCapture(result);
  for(const text of ['列表本行','早屏子项','晚屏子项','晚屏孙项'])assert.ok(converted.html.includes(text),text);
});

function delayedReference(t,{neverReady=false,perWindow=false,growAfterSecondSweep=false}={}) {
  const session=virtualDocument(t,{textIds:[],totalHeight:2400});
  const doc=globalThis.document,outer=doc.querySelector('.page-block'),all=doc.querySelectorAll,one=doc.querySelector;
  let loaded=false,grown=false,auditing=false,endVisits=0;
  const inside=()=>session.scroller.scrollTop<(grown?2200:1600)&&session.scroller.scrollTop+160>600;
  const ready=()=>{
    if(perWindow)return !neverReady&&inside()&&session.elapsedAtPosition()>=900;
    if(!neverReady&&inside()&&session.elapsedAtPosition()>=900)loaded=true;
    return loaded;
  };
  const leafTop=index=>index<12?650+index*70:1900+(index-12)*70;
  const leaves=Array.from({length:growAfterSecondSweep?18:12},(_,index)=>({
    getAttribute:key=>({'data-block-id':String(index+4),'data-block-type':'text'})[key]??null,
    parentElement:{closest:()=>inner},textContent:'引用段落-'+index,
    outerHTML:'<div data-block-id="'+(index+4)+'" data-block-type="text"><div class="ace-line"><span data-string="true">引用段落-'+index+'</span></div></div>',
    querySelectorAll:()=>[],querySelector:()=>({}),
    getBoundingClientRect:()=>({top:leafTop(index)-session.scroller.scrollTop,bottom:leafTop(index)+30-session.scroller.scrollTop,height:30}),
  }));
  const visibleLeaves=()=>leaves.filter((leaf,index)=>{
    if(growAfterSecondSweep&&auditing&&endVisits>=2&&session.elapsedAtPosition()>=400)grown=true;
    const box=leaf.getBoundingClientRect();
    return (index<12||grown)&&(ready()||(!neverReady&&index===0))&&box.bottom>0&&box.top<160;
  });
  const inner={
    getAttribute:key=>({'data-block-id':'3','data-block-type':'page'})[key]??null,parentElement:{closest:()=>reference},
    get textContent(){return '引用标题'+visibleLeaves().map(leaf=>leaf.textContent).join('');},
    get outerHTML(){return '<div data-block-id="3" data-block-type="page"><div class="page-block-content">引用标题</div><div class="reference-page-block-childen">'+visibleLeaves().map(leaf=>leaf.outerHTML).join('')+'</div></div>';},
    querySelectorAll:()=>[],getBoundingClientRect:()=>({top:600-session.scroller.scrollTop,bottom:(grown?2200:1600)-session.scroller.scrollTop,height:grown?1600:1000}),
  };
  const reference={
    getAttribute:key=>({'data-block-id':'2','data-block-type':'synced_reference'})[key]??null,parentElement:{closest:()=>outer},
    get textContent(){return inner.textContent;},get outerHTML(){return '<div data-block-id="2" data-block-type="synced_reference">'+inner.outerHTML+'</div>';},
    querySelectorAll:()=>[],getBoundingClientRect:()=>({top:600-session.scroller.scrollTop,bottom:(grown?2200:1600)-session.scroller.scrollTop,height:grown?1600:1000}),
    scrollIntoView(){session.scroller.scrollTop=600;},
  };
  const nodes=()=>[outer,...(inside()?[reference,inner,...visibleLeaves()]:[])];
  doc.querySelectorAll=selector=>selector==='[data-block-id]'?nodes():all(selector);
  doc.querySelector=selector=>nodes().find(node=>selector==='[data-block-id="'+node.getAttribute('data-block-id')+'"]')||one(selector);
  if(growAfterSecondSweep){
    const descriptor=Object.getOwnPropertyDescriptor(session.scroller,'scrollTop');
    Object.defineProperty(session.scroller,'scrollTop',{get:descriptor.get,set(value){
      const before=descriptor.get.call(this);descriptor.set.call(this,value);
      if(auditing&&before<1439&&descriptor.get.call(this)>=1439)endVisits++;
    }});
    const progress=session.onProgress;
    session.onProgress=value=>{progress(value);if(value.message?.startsWith('复核引用区域'))auditing=true;};
  }
  session.proof=()=>({grown,endVisits});
  return session;
}

test('引用页延迟挂载且叶块跨视口时定向复核补齐全部正文',async t=>{
  const session=delayedReference(t);
  const result=await capturePage({onProgress:session.onProgress});
  for(let index=0;index<12;index++)assert.equal(result.blocks[0].html.split('引用段落-'+index+'<').length-1,1,'引用段落'+index);
  assert.deepEqual(result.warnings,[]);
  assert.equal(session.scroller.scrollTop,session.originalTop);
});

test('引用页一直只有空壳时给出未确认提示而非静默成功',async t=>{
  const session=delayedReference(t,{neverReady:true});
  const result=await capturePage({onProgress:session.onProgress});
  assert.ok(result.warnings.some(w=>w.code==='missing_block'&&w.label.includes('引用')));
  assert.equal(session.scroller.scrollTop,session.originalTop);
});

test('引用页每个新视口均延迟挂载时等待当前叶块，不能复用历史ready',async t=>{
  const session=delayedReference(t,{perWindow:true});
  const result=await capturePage({onProgress:session.onProgress});
  for(let index=0;index<12;index++)assert.equal(result.blocks[0].html.split('引用段落-'+index+'<').length-1,1,'引用段落'+index);
  assert.deepEqual(result.warnings,[]);
});

test('引用第二遍旧尾后继续长出内容时重新核验边界而非静默结束',async t=>{
  const session=delayedReference(t,{growAfterSecondSweep:true});
  const result=await capturePage({onProgress:session.onProgress});
  assert.equal(session.proof().grown,true);
  assert.ok(result.blocks[0].html.includes('引用段落-12<'),'新增范围应得到继续扫描');
  assert.ok(result.warnings.some(w=>w.code==='missing_block'&&w.label.includes('引用')),'三遍内未稳定的新范围应明确提示');
});

test('引用定向复核期间取消会停止并恢复原阅读位置',async t=>{
  const session=delayedReference(t);
  let stop=false;
  await assert.rejects(capturePage({
    onProgress(progress){session.onProgress(progress);if(progress.message?.startsWith('复核引用区域'))stop=true;},
    shouldStop:()=>stop,
  }),{name:'AbortError'});
  assert.equal(session.scroller.scrollTop,session.originalTop);
});

test('引用复核只滚动目标区域，不重新扫描全篇',async t=>{
  const session=delayedReference(t);
  const descriptor=Object.getOwnPropertyDescriptor(session.scroller,'scrollTop');
  const positions=[];
  let auditing=false,metrics;
  Object.defineProperty(session.scroller,'scrollTop',{
    get:descriptor.get,
    set(value){descriptor.set.call(this,value);if(auditing)positions.push(descriptor.get.call(this));},
  });
  await capturePage({onProgress(progress){
    session.onProgress(progress);
    if(progress.message?.startsWith('复核引用区域'))auditing=true;
    if(progress.stage==='recheck'||progress.stage==='done')auditing=false;
    if(progress.stage==='done')metrics=progress.metrics;
  }});
  assert.ok(positions.length>0);
  assert.ok(positions.every(position=>position>=600&&position<=1600),JSON.stringify(positions));
  assert.equal(metrics.referenceRegions,1);
  assert.ok(metrics.referenceSteps>0&&metrics.referenceSteps<metrics.scrollSteps,JSON.stringify(metrics));
});

test('逐格合并互补快照，区分合法空格与未挂载的单格并记录行列', async (t) => {
  const session = virtualDocument(t, { textIds: [], totalHeight: 2200 });
  const doc = globalThis.document;
  const page = doc.querySelector('.page-block');
  const originalOne = doc.querySelector;
  const originalAll = doc.querySelectorAll;
  let audit = false;
  // 第一屏的第一格最丰富；第二屏仅渲染第 2 行第 3 格，整表文本长度反而减少。
  const rows = Array.from({ length: 3 }, (_, r) => ({
    cloneNode: () => ({ outerHTML: '<tr data-index="' + r + '"></tr>' }),
    getAttribute: () => String(r), cells: Array.from({ length: 4 }, (_, c) => {
      const n = r * 4 + c;
      function body() {
        if (n === 0 && session.scroller.scrollTop > 180) return null;
        if (n === 6 && (!audit || Math.abs(session.scroller.scrollTop + 80 - 800) > 90)) return null;
        if (n === 11) return null;
        return n === 5 ? '' : 'value-' + n;
      }
      const textBlock = {
        classList: { contains: () => body() === '' },
        get textContent() { return body() || ''; },
        querySelector: () => body() === null ? null : {},
        getAttribute: () => 'text',
      };
      return {
        getAttribute: key => key === 'data-block-id' ? String(100 + n) : key === 'data-block-type' ? 'table_cell' : null,
        get textContent() { return body() || '\u200b'; },
        get outerHTML() {
          const text = body();
          const inside = text === null ? '<div class="render-unit-wrapper"></div>' :
            '<div data-block-type="text" class="docx-text-block ' + (!text ? 'isEmpty' : '') + '"><div class="ace-line"><span data-string="true">' + text + '</span></div></div>';
          return '<td data-block-id="' + (100+n) + '">' + inside + '</td>';
        },
        querySelectorAll: sel => body() !== null && sel.includes('data-block-type') ? [textBlock] : [],
        querySelector: () => null,
        getBoundingClientRect: () => ({ top: 400*(r+1)-10-session.scroller.scrollTop, height:20 }),
      };
    }),
  }));
  const table = { rows, get textContent() { return rows.flatMap(row => row.cells.map(cell => cell.textContent)).join(''); } };
  const el = {
    getAttribute: key => ({'data-block-id':'152','data-block-type':'table'})[key],
    parentElement: { closest: () => page }, textContent:'table', querySelectorAll: () => [],
    querySelector: s => s === 'table' ? table : null, scrollIntoView() {},
    getBoundingClientRect: () => ({ top: 390-session.scroller.scrollTop, height:820 }),
    get outerHTML() { return '<div><table><tbody>' + rows.map((row,r) => '<tr data-index="'+r+'">' + row.cells.map(c => c.outerHTML).join('') + '</tr>').join('') + '</tbody></table></div>'; },
  };
  doc.querySelectorAll = s => s === '[data-block-id]' ? [page,el] : originalAll(s);
  doc.querySelector = s => s === '[data-block-id="152"]' ? el : originalOne(s);
  const result = await capturePage({ onProgress(p) { session.onProgress(p); if (p.stage === 'audit') audit = true; } });
  assert.match(result.blocks[0].html, /value-0</);
  assert.match(result.blocks[0].html, /value-6</);
  assert.deepEqual(result.warnings.map(w => w.code), ['table_cell_unconfirmed']);
  assert.match(result.warnings[0].label, /152.*第 3 行第 4 列/);
  const converted = convertCapture(result);
  const snapshot = await readDocumentParts({html:converted.html, name:'table'});
  assert.deepEqual(snapshot.warnings.filter(w => w.code === 'table_cell_unconfirmed'), result.warnings);
});

for (const kind of ['quote_container', 'synced_reference', 'quote']) {
  test(kind + ' 内表格合并交错单格快照并报告缺格，根内容刷新后保留一次表结构', async t => {
    const session = virtualDocument(t, {textIds:[], totalHeight:1500});
    const doc = globalThis.document;
    const page = doc.querySelector('.page-block');
    const originalOne = doc.querySelector;
    const originalAll = doc.querySelectorAll;
    let audit = false, recheck = false;
    function body(index) {
      if (index === 0) return session.scroller.scrollTop < 180 ? 'early-' + 'a'.repeat(60) : null;
      if (index === 2) return audit && Math.abs(session.scroller.scrollTop + 80 - 800) < 90 ? 'late-value' : null;
      return index === 1 ? 'constant' : null;
    }
    const cells = Array.from({length:4}, (_, index) => {
      const part = {
        classList:{contains:() => false},
        get textContent() { return body(index) || ''; },
        getAttribute:() => 'text', querySelector:() => body(index) === null ? null : {},
      };
      return {
        getAttribute:key => key === 'data-block-id' ? String(100 + index) : key === 'data-block-type' ? 'table_cell' : null,
        get textContent() { return body(index) || ''; },
        get outerHTML() {
          return '<td data-block-id="' + (100 + index) + '">' + (body(index) === null ? '' :
            '<div data-block-type="text"><div class="ace-line"><span data-string="true">' + body(index) + '</span></div></div>') + '</td>';
        },
        querySelectorAll:() => body(index) === null ? [] : [part],
        getBoundingClientRect:() => ({top:(index < 2 ? 400 : 800) - session.scroller.scrollTop - 10, height:20}),
      };
    });
    const rows = [0,1].map(r => ({
      getAttribute:() => String(r), cells:cells.slice(r * 2, r * 2 + 2),
      cloneNode:() => ({outerHTML:'<tr data-index="' + r + '"></tr>'}),
    }));
    const table = {rows};
    const plainTable = () => '<table data-keep="table"><caption>caption</caption>' + rows.map(row =>
      '<tr>' + row.cells.map(cell => '<td>' + cell.textContent + '</td>').join('') + '</tr>').join('') + '</table>';
    const container = {
      getAttribute:key => ({'data-block-id':'2','data-block-type':kind})[key] ?? null,
      parentElement:{closest:() => page},
      get textContent() { return cells.map(cell => cell.textContent).join('') + (recheck ? 'fresh-root'.repeat(15) : ''); },
      get outerHTML() {
        return '<div data-block-type="' + kind + '" data-block-id="2" data-keep="container">' +
          (recheck ? '<span>fresh-root</span>' : '') +
          '<div data-block-type="table" data-block-id="3">' + plainTable() + '</div></div>';
      },
      querySelectorAll:() => [],
      getBoundingClientRect:() => ({top:390-session.scroller.scrollTop, height:430}),
      scrollIntoView() { session.scroller.scrollTop = 400; },
    };
    const nested = {
      getAttribute:key => ({'data-block-id':'3','data-block-type':'table'})[key] ?? null,
      parentElement:{closest:() => container},
      get textContent() { return cells.map(cell => cell.textContent).join(''); },
      get outerHTML() { return '<div data-block-type="table" data-block-id="3">' + plainTable() + '</div>'; },
      querySelector:selector => selector === 'table' ? table : null, querySelectorAll:() => [],
      getBoundingClientRect:() => ({top:390-session.scroller.scrollTop, height:430}),
    };
    doc.querySelectorAll = selector => selector === '[data-block-id]' ? [page,container,nested] : originalAll(selector);
    doc.querySelector = selector => selector === '[data-block-id="2"]' ? container
      : selector === '[data-block-id="3"]' ? nested : originalOne(selector);
    const result = await capturePage({onProgress(progress) {
      session.onProgress(progress);
      if (progress.stage === 'audit') audit = true;
      if (progress.stage === 'recheck') recheck = true;
    }});
    assert.equal(result.blocks.length, 1);
    const root = result.blocks[0];
    assert.match(root.html, /early-a{60}</);
    assert.match(root.html, /late-value</);
    assert.match(root.html, /data-keep="container"/);
    assert.match(root.html, /data-keep="table"/);
    assert.equal((root.html.match(/<table\b/gu) || []).length, 1);
    if (kind === 'quote') assert.match(root.html, /fresh-root/);
    assert.deepEqual(result.warnings.map(w => w.code), ['table_cell_unconfirmed']);
    assert.match(result.warnings[0].label, /表格块 3 第 2 行第 2 列/);
    if (kind !== 'quote') {
      const converted = convertCapture(result);
      assert.equal((converted.html.match(/<table\b/gu) || []).length, 1);
      assert.match(converted.html, /early-a{60}</);
      assert.match(converted.html, /late-value</);
    }
  });
}

for (const mountsDuringImage of [false, true]) {
  test(mountsDuringImage ? '缺块在素材等待期间挂载后仍采集入结果，不能仅凭 DOM 存在结束' : '缺块窗口等待异步挂载后采集，保持缺块定位而非重扫全文', async t => {
    const session = virtualDocument(t, {textIds:[], totalHeight:1500});
    const doc = globalThis.document;
    const page = doc.querySelector('.page-block');
    const originalOne = doc.querySelector;
    const originalAll = doc.querySelectorAll;
    const originalCreate = doc.createElement;
    let structure = false;
    const delay = mountsDuringImage ? 320 : 240;
    const mounted = () => structure && session.elapsedAtPosition() >= delay
      && session.scroller.scrollTop <= 530 && session.scroller.scrollTop + 160 >= 530;
    function block(id, top, type = 'text') {
      return {
        getAttribute:key => ({'data-block-id':id,'data-block-type':type})[key] ?? null,
        parentElement:{closest:() => page}, textContent:id,
        outerHTML:'<div data-block-id="' + id + '"><span data-string="true">' + (id === '4' ? '迟到章节' : id) + ' '.repeat(410) + '</span></div>',
        getBoundingClientRect:() => ({top:top-session.scroller.scrollTop, bottom:top+20-session.scroller.scrollTop, height:20}),
        querySelectorAll:() => [], querySelector:() => null,
        scrollIntoView() { session.scroller.scrollTop = top - 70; },
      };
    }
    const roots = [block('2',200), block('3',400), block('5',600), block('6',800), block('7',1000)];
    const missing = block('4',520,'heading2');
    const image = block('8',550,'image');
    const img = {
      get complete() { return session.elapsedAtPosition() >= delay; },
      get naturalWidth() { return this.complete ? 1 : 0; }, naturalHeight:1,
      getAttribute:() => '',closest:() => image,parentElement:image,
      getBoundingClientRect:() => ({width:1,height:1}),
    };
    image.querySelector = selector => selector === 'img' ? img : null;
    image.querySelectorAll = selector => selector === 'img' ? [img] : [];
    doc.createElement = tag => tag === 'canvas' ? {
      getContext:() => ({drawImage() {}}), toDataURL:() => 'data:image/png;base64,AA==',
    } : originalCreate(tag);
    doc.querySelectorAll = selector => selector === '[data-block-id]' ? [page, ...roots,
      ...(mounted() ? [missing] : []), ...(mountsDuringImage && structure ? [image] : [])] : originalAll(selector);
    doc.querySelector = selector => selector === '[data-block-id="4"]' ? mounted() ? missing : null
      : selector === '[data-block-id="8"]' ? structure && mountsDuringImage ? image : null
      : roots.find(root => selector === '[data-block-id="' + root.getAttribute('data-block-id') + '"]') || originalOne(selector);
    const result = await capturePage({onProgress(progress) {
      session.onProgress(progress);
      if (progress.stage === 'structure') structure = true;
    }});
    assert.ok(result.blocks.some(item => item.id === '4'), 'DOM 后来挂载的缺块必须写进实际采集结果');
    assert.match(result.blocks.find(item => item.id === '4').html, /迟到章节/);
    assert.deepEqual(result.warnings, []);
    assert.equal(session.scroller.scrollTop, session.originalTop);
  });
}

test('同步引用内嵌页面重建跨视口子标题，保留页壳和标题并合入单份表格', async t => {
  const session = virtualDocument(t, {textIds:[], totalHeight:1500});
  const doc = globalThis.document;
  const outerPage = doc.querySelector('.page-block');
  const originalOne = doc.querySelector;
  const originalAll = doc.querySelectorAll;
  const early = () => session.scroller.scrollTop < 300;
  const title = (id, text) => ({
    getAttribute:key => ({'data-block-id':id,'data-block-type':'heading3'})[key] ?? null,
    parentElement:{closest:() => innerPage}, textContent:text,
    outerHTML:'<div data-block-id="' + id + '" data-block-type="heading3"><div class="zone-container"><div class="ace-line"><span data-string="true">' + text + '</span></div></div></div>',
    querySelectorAll:() => [],
    getBoundingClientRect:() => ({top:(id === '4' ? 100 : 600) - session.scroller.scrollTop, height:20}),
  });
  const first = title('4','YOLOv2详解');
  const second = title('5','YOLOv7详解');
  const cells = ['first-cell','second-cell'].map((text, index) => {
    const mounted = () => index === 0 ? early() : !early();
    const part = {
      getAttribute:() => 'text', classList:{contains:() => false},
      get textContent() { return mounted() ? text : ''; }, querySelector:() => mounted() ? {} : null,
    };
    return {
      getAttribute:key => key === 'data-block-id' ? String(100 + index) : key === 'data-block-type' ? 'table_cell' : null,
      get textContent() { return mounted() ? text : ''; },
      get outerHTML() { return '<td data-block-id="' + (100 + index) + '">' + (mounted() ? '<div data-block-type="text"><div class="ace-line"><span data-string="true">' + text + '</span></div></div>' : '') + '</td>'; },
      querySelectorAll:() => mounted() ? [part] : [],
      getBoundingClientRect:() => ({top:(index === 0 ? 100 : 600)-session.scroller.scrollTop, height:20}),
    };
  });
  const row = {cells, getAttribute:() => '0', cloneNode:() => ({outerHTML:'<tr></tr>'})};
  const table = {
    getAttribute:key => ({'data-block-id':'6','data-block-type':'table'})[key] ?? null,
    parentElement:{closest:() => innerPage},
    get textContent() { return cells.map(cell => cell.textContent).join(''); },
    get outerHTML() { return '<div data-block-id="6" data-block-type="table"><table data-keep="nested-table"><tbody><tr>' + cells.map(cell => cell.outerHTML).join('') + '</tr></tbody></table></div>'; },
    querySelector:selector => selector === 'table' ? {rows:[row]} : null, querySelectorAll:() => [],
    getBoundingClientRect:() => ({top:100-session.scroller.scrollTop, height:520}),
  };
  const innerPage = {
    getAttribute:key => ({'data-block-id':'3','data-block-type':'page'})[key] ?? null,
    parentElement:{closest:() => reference},
    get textContent() { return '同步页标题' + (early() ? first.textContent : second.textContent) + table.textContent; },
    get outerHTML() {
      return '<div data-block-id="3" data-block-type="page" data-keep="inner-page"><div class="page-block-content">同步页标题</div>' +
        '<div class="page-block-children reference-page-block-childen" data-keep="children">' + (early() ? first.outerHTML : second.outerHTML) + table.outerHTML + '</div></div>';
    },
    querySelectorAll:() => [],
    getBoundingClientRect:() => ({top:90-session.scroller.scrollTop, height:550}),
  };
  const reference = {
    getAttribute:key => ({'data-block-id':'2','data-block-type':'synced_reference'})[key] ?? null,
    parentElement:{closest:() => outerPage},
    get textContent() { return innerPage.textContent; },
    get outerHTML() { return '<div data-block-id="2" data-block-type="synced_reference" data-keep="reference">' + innerPage.outerHTML + '</div>'; },
    querySelectorAll:() => [],
    getBoundingClientRect:() => ({top:90-session.scroller.scrollTop, height:550}),
  };
  const all = () => [outerPage,reference,innerPage,early() ? first : second,table];
  doc.querySelectorAll = selector => selector === '[data-block-id]' ? all() : originalAll(selector);
  doc.querySelector = selector => all().find(item => selector === '[data-block-id="' + item.getAttribute('data-block-id') + '"]') || originalOne(selector);
  const result = await capturePage({onProgress:session.onProgress});
  assert.equal(result.blocks.length, 1);
  const html = result.blocks[0].html;
  for (const text of ['YOLOv2详解','YOLOv7详解','first-cell','second-cell','同步页标题']) assert.equal(html.split(text).length - 1, 1, text);
  for (const kept of ['reference','inner-page','children','nested-table']) assert.match(html, new RegExp('data-keep="' + kept + '"'));
  assert.equal((html.match(/<table\b/gu) || []).length, 1);
  assert.deepEqual(result.warnings, []);
  const converted = convertCapture(result);
  assert.match(converted.html, /YOLOv2详解/);
  assert.match(converted.html, /YOLOv7详解/);
  assert.equal((converted.html.match(/<table\b/gu) || []).length, 1);
});
