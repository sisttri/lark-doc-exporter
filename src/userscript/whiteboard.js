import {renderNativeWhiteboard} from './whiteboard-native.js';

const CONTENT_CANVAS = '.whiteboad-x-content-canvas canvas.whiteboad-x-normal-canvas';
const BLOCK_VIEW = '.whiteboard-view-container.is-block';
const STABLE_MS = 240;

function styleOf(node) {
  return node.ownerDocument?.defaultView?.getComputedStyle(node) || {};
}

function isVisibleInBlock(node, block) {
  if (node.isConnected === false || node.closest('[data-block-type]') !== block) return false;
  for (let current=node; current; current=current.parentElement) {
    const style = styleOf(current);
    const role = current.getAttribute('role');
    if (current.hidden || current.getAttribute('aria-hidden') === 'true'
      || ['BUTTON','INPUT','SELECT'].includes(current.tagName) || ['button','toolbar','menu','menuitem'].includes(role)
      || /(?:^|[-_\s])(?:mini[-_]?map|toolbar|auxiliary)(?:$|[-_\s])/iu.test(String(current.className || ''))
      || style.display === 'none' || ['hidden','collapse'].includes(style.visibility) || style.opacity === '0') return false;
    if (current === block) return true;
  }
  return false;
}

// The auxiliary layer contains editor controls. Only the known content layer is a preview.
export function findWhiteboardCanvas(block) {
  if (!block) return null;
  const candidates = [...block.querySelectorAll(CONTENT_CANVAS)].filter(canvas => {
    if (!isVisibleInBlock(canvas,block)) return false;
    const stage = canvas.closest('.whiteboad-x-canvas-container');
    const box = canvas.getBoundingClientRect();
    if (!stage || !block.contains(stage) || !canvas.width || !canvas.height || !box.width || !box.height) return false;
    return true;
  });
  return candidates.length === 1 ? candidates[0] : null;
}

function backgroundOf(canvas, block) {
  for (let node=canvas; node; node=node.parentElement) {
    const color = styleOf(node).backgroundColor || '';
    const rgb = /^rgba?\(([^)]+)\)$/iu.exec(color);
    const channels = rgb?.[1].trim().split(/[\s,/]+/u).map(Number);
    if (channels?.every(Number.isFinite) && (channels.length === 3 || channels.length === 4 && channels[3] === 1)) return color;
    if (node === block) break;
  }
  return '#ffffff';
}

function readPixels(canvas, block, fingerprint = true) {
  const context = canvas.getContext('2d');
  if (!context) throw new Error('白板内容画布无法读取');
  const background = /^rgba?\(([^)]+)\)$/iu.exec(backgroundOf(canvas,block));
  const rgb = background ? background[1].trim().split(/[\s,/]+/u).slice(0,3).map(Number) : [255,255,255];
  let drawn = false, hash = 2166136261;
  const rows = Math.max(1,Math.floor(65_536/canvas.width));
  for (let top=0; top<canvas.height; top+=rows) {
    const pixels = context.getImageData(0,top,canvas.width,Math.min(rows,canvas.height-top)).data;
    for (let index=0; index<pixels.length; index+=4) {
      const red = pixels[index], green = pixels[index+1], blue = pixels[index+2], alpha = pixels[index+3];
      if (alpha && (red !== rgb[0] || green !== rgb[1] || blue !== rgb[2])) {
        drawn = true;
        if (!fingerprint) return {drawn};
      }
      if (fingerprint) hash = Math.imul(hash ^ (red<<24 | green<<16 | blue<<8 | alpha),16777619) >>> 0;
    }
  }
  return {drawn,hash};
}

function withinImageLimits(canvas) {
  return canvas.width <= 8192 && canvas.height <= 8192 && canvas.width*canvas.height <= 16_000_000;
}

export function isWhiteboardReady(block) {
  const canvas = findWhiteboardCanvas(block);
  if (!canvas || !withinImageLimits(canvas)) return false;
  try {return readPixels(canvas,block,false).drawn;} catch {return false;}
}

async function waitForStableCanvas(id, document, wait, checkStop, {view, width = 0, height = 0} = {}) {
  const started = Date.now();
  let previous, signature = '', stableSince = started;
  while (Date.now()-started <= 2500) {
    checkStop();
    const block = document.querySelector('[data-block-id="' + id + '"]');
    const source = findWhiteboardCanvas(block);
    if (source && (!view || view.isConnected !== false && block.contains(view) && view.contains(source))) {
      if (!withinImageLimits(source)) {
        if (view) return null;
        throw new Error('白板预览尺寸超过图片限制');
      }
      if (source.width < width || source.height < height) {
        previous=null;signature='';
        await wait(120);
        continue;
      }
      const pixels = readPixels(source,block);
      const next = source.width + ':' + source.height + ':' + pixels.hash;
      if (!pixels.drawn || source !== previous || next !== signature) {
        previous=source;signature=next;stableSince=Date.now();
      }
      if (pixels.drawn && Date.now()-stableSince >= STABLE_MS) return {source,block};
    } else {previous=null;signature='';}
    await wait(120);
  }
  checkStop();
  return null;
}

function redrawPlan(block, source) {
  const views = [...block.querySelectorAll(BLOCK_VIEW)].filter(view => isVisibleInBlock(view,block));
  if (views.length !== 1 || !views[0].contains(source)) return null;
  const view = views[0], box = view.getBoundingClientRect(), canvasBox = source.getBoundingClientRect();
  if (![box.width,box.height,canvasBox.width,canvasBox.height].every(value => Number.isFinite(value) && value > 0)) return null;
  const density = Math.min(source.width/canvasBox.width,source.height/canvasBox.height);
  if (density >= 2) return null;
  let scale = Math.min(2,2/density,8192/source.width,8192/source.height,
    Math.sqrt(16_000_000/(source.width*source.height)));
  // Native backing sizes can round up; leave a pixel of room in both dimensions.
  if (!withinImageLimits({width:Math.ceil(source.width*scale),height:Math.ceil(source.height*scale)})) {
    scale = Math.max(1,scale-1/Math.min(source.width,source.height));
  }
  return {view,scale,cssWidth:box.width*scale,cssHeight:box.height*scale,
    width:Math.floor(canvasBox.width*density*scale),height:Math.floor(canvasBox.height*density*scale),
    originalWidth:source.width,originalHeight:source.height,limited:density*scale < 2};
}

async function restoreView(plan, style, id, document, wait) {
  if (style === null) plan.view.removeAttribute('style');
  else plan.view.setAttribute('style',style);
  const started = Date.now();
  while (Date.now()-started <= 900 && plan.view.isConnected !== false) {
    const block = document.querySelector('[data-block-id="' + id + '"]');
    const source = findWhiteboardCanvas(block);
    if (!block?.contains(plan.view) || source && plan.view.contains(source)
      && source.width === plan.originalWidth && source.height === plan.originalHeight) return;
    // Restoration must finish even after checkStop has begun throwing.
    try {await wait(60);} catch {return;}
  }
}

function copyPreview(id, {source,block}, document, checkStop, limited) {
  checkStop();
  const {width,height} = source;
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('白板预览画布无法创建');
  context.fillStyle = backgroundOf(source,block);
  context.fillRect(0,0,width,height);
  context.drawImage(source,0,0);
  const dataUrl = canvas.toDataURL('image/png');
  if (!/^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/u.test(dataUrl)) throw new Error('白板预览未生成有效PNG');
  return {blockId:id,mime:'image/png',width,height,
    alt:limited ? '白板静态预览（当前画面，清晰度受页面限制）' : '白板静态预览（当前画面）',dataUrl};
}

export async function captureWhiteboardPreview(id, {document = globalThis.document, wait, checkStop,
  pageView = typeof unsafeWindow === 'undefined' ? globalThis : unsafeWindow} = {}) {
  checkStop();
  let block = document.querySelector('[data-block-id="' + id + '"]');
  let source = findWhiteboardCanvas(block);
  if (!source) {
    const initial = await waitForStableCanvas(id,document,wait,checkStop);
    if (!initial) throw new Error('白板内容画面尚未绘制，或未确认唯一且可见的内容画布');
    ({block,source} = initial);
  }
  if (source && !withinImageLimits(source)) throw new Error('白板预览尺寸超过图片限制');
  const native = await renderNativeWhiteboard(id,{document,pageView,checkStop,background:backgroundOf(source,block),
    waitForReady:async () => Boolean(await waitForStableCanvas(id,document,wait,checkStop))});
  if (native) return native;
  const plan = source && redrawPlan(block,source);
  const box = source.getBoundingClientRect();
  const limited = Boolean(plan) || Math.min(source.width/box.width,source.height/box.height) < 2;
  if (plan && plan.scale > 1) {
    const style = plan.view.getAttribute('style');
    let image;
    try {
      // Only the known view is resized; the app owns every content-canvas backing pixel.
      plan.view.style.setProperty('width',plan.cssWidth + 'px','important');
      plan.view.style.setProperty('height',plan.cssHeight + 'px','important');
      plan.view.style.setProperty('max-width','none','important');
      const highResolution = await waitForStableCanvas(id,document,wait,checkStop,plan);
      if (highResolution) image = copyPreview(id,highResolution,document,checkStop,plan.limited);
    } finally {
      await restoreView(plan,style,id,document,wait);
    }
    checkStop();
    if (image) return image;
  }
  const preview = await waitForStableCanvas(id,document,wait,checkStop);
  if (!preview) throw new Error('白板内容画面尚未绘制，或未确认唯一且可见的内容画布');
  return copyPreview(id,preview,document,checkStop,limited);
}
