const CONTENT_CANVAS = '.whiteboad-x-content-canvas canvas.whiteboad-x-normal-canvas';

function styleOf(node) {
  return node.ownerDocument?.defaultView?.getComputedStyle(node) || {};
}

// The auxiliary layer contains editor controls. Only the known content layer is a preview.
export function findWhiteboardCanvas(block) {
  if (!block) return null;
  const candidates = [...block.querySelectorAll(CONTENT_CANVAS)].filter(canvas => {
    if (canvas.isConnected === false || canvas.closest('[data-block-type]') !== block) return false;
    const stage = canvas.closest('.whiteboad-x-canvas-container');
    const box = canvas.getBoundingClientRect();
    if (!stage || !block.contains(stage) || !canvas.width || !canvas.height || !box.width || !box.height) return false;
    for (let node=canvas; node; node=node.parentElement) {
      const style = styleOf(node);
      const role = node.getAttribute('role');
      if (node.hidden || node.getAttribute('aria-hidden') === 'true'
        || ['BUTTON','INPUT','SELECT'].includes(node.tagName) || ['button','toolbar','menu','menuitem'].includes(role)
        || /(?:^|[-_\s])(?:mini[-_]?map|toolbar|auxiliary)(?:$|[-_\s])/iu.test(String(node.className || ''))
        || style.display === 'none' || ['hidden','collapse'].includes(style.visibility) || style.opacity === '0') return false;
      if (node === block) break;
    }
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

function hasDrawnPixels(canvas) {
  const context = canvas.getContext('2d');
  if (!context) throw new Error('白板内容画布无法读取');
  const rows = Math.max(1,Math.floor(65_536/canvas.width));
  for (let top=0; top<canvas.height; top+=rows) {
    const pixels = context.getImageData(0,top,canvas.width,Math.min(rows,canvas.height-top)).data;
    for (let index=3; index<pixels.length; index+=4) if (pixels[index]) return true;
  }
  return false;
}

function withinImageLimits(canvas) {
  return canvas.width <= 8192 && canvas.height <= 8192 && canvas.width*canvas.height <= 16_000_000;
}

export function isWhiteboardReady(block) {
  const canvas = findWhiteboardCanvas(block);
  if (!canvas || !withinImageLimits(canvas)) return false;
  try {return hasDrawnPixels(canvas);} catch {return false;}
}

export async function captureWhiteboardPreview(id, {document = globalThis.document, wait, checkStop} = {}) {
  const started = Date.now();
  let previous, size = '', stableSince = started, empty = false;
  while (Date.now()-started <= 2500) {
    checkStop();
    const block = document.querySelector('[data-block-id="' + id + '"]');
    const source = findWhiteboardCanvas(block);
    if (source) {
      const {width,height} = source;
      if (!withinImageLimits(source)) throw new Error('白板预览尺寸超过图片限制');
      const nextSize = width + ':' + height;
      if (source !== previous || nextSize !== size) {previous=source;size=nextSize;stableSince=Date.now();}
      if (Date.now()-stableSince >= 120) {
        empty = !hasDrawnPixels(source);
        if (!empty) {
          checkStop();
          const canvas = document.createElement('canvas');
          canvas.width = width; canvas.height = height;
          const context = canvas.getContext('2d');
          if (!context) throw new Error('白板预览画布无法创建');
          context.fillStyle = backgroundOf(source,block);
          context.fillRect(0,0,width,height);
          context.drawImage(source,0,0);
          const dataUrl = canvas.toDataURL('image/png');
          if (!/^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/u.test(dataUrl)) throw new Error('白板预览未生成有效PNG');
          return {blockId:id,mime:'image/png',width,height,alt:'白板静态预览（当前画面）',dataUrl};
        }
      }
    } else {previous=null;size='';}
    await wait(60);
  }
  checkStop();
  throw new Error(empty ? '白板内容画面尚未绘制，预览未确认' : '未读到唯一且可见的白板内容画布');
}
