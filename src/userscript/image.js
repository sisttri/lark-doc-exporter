function visibleImage(node, block) {
  if (node.isConnected === false || node.closest('[data-block-id]') !== block) return false;
  const box = node.getBoundingClientRect();
  if (!box.width || !box.height) return false;
  for (let current=node; current; current=current.parentElement) {
    const style = current.ownerDocument?.defaultView?.getComputedStyle(current) || {};
    if (current.hidden || current.getAttribute('aria-hidden') === 'true'
      || style.display === 'none' || ['hidden','collapse'].includes(style.visibility) || style.opacity === '0') return false;
    if (current === block) break;
  }
  return true;
}

export function readImageState(block) {
  if (!block) return null;
  const candidates = [...block.querySelectorAll('img')].filter(node => visibleImage(node,block));
  if (candidates.length !== 1) return null;
  const node = candidates[0];
  return {node,source:node.currentSrc || node.getAttribute('src') || '',
    width:node.naturalWidth,height:node.naturalHeight,complete:node.complete};
}

export function sameImageState(a, b) {
  return a === b || Boolean(a && b && a.node === b.node && a.source === b.source
    && a.width === b.width && a.height === b.height && a.complete === b.complete);
}

function checkDimensions(width, height) {
  if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width < 1 || height < 1
    || width > 8192 || height > 8192 || width*height > 16_000_000) throw new Error('图片位图尺寸超过限制或无效');
}

// Read only the image already loaded by the page; do not fetch or rewrite its URL.
export async function captureLoadedImage(id, {document = globalThis.document, wait, checkStop, saved} = {}) {
  const started = Date.now();
  let previous = null, stableSince = started;
  const current = () => readImageState(document.querySelector('[data-block-id="' + id + '"]'));
  while (Date.now()-started <= 2500) {
    checkStop();
    const state = current();
    if (!sameImageState(state,previous)) {previous=state;stableSince=Date.now();}
    if (state?.complete && state.width && state.height && Date.now()-stableSince >= 120) {
      checkDimensions(state.width,state.height);
      let bitmap;
      try {
        // ImageBitmap copies media pixels, including a selected high-density resource.
        // naturalWidth/naturalHeight alone can be density-corrected CSS dimensions.
        if (typeof globalThis.createImageBitmap === 'function') bitmap = await globalThis.createImageBitmap(state.node);
        checkStop();
        if (!sameImageState(state,current())) continue;
        const width = bitmap?.width ?? state.width, height = bitmap?.height ?? state.height;
        checkDimensions(width,height);
        if (saved && sameImageState(saved.state,state) && saved.image.width === width && saved.image.height === height) {
          return {state,image:saved.image};
        }
        const canvas = document.createElement('canvas');
        canvas.width=width; canvas.height=height;
        const context = canvas.getContext('2d');
        if (!context) throw new Error('图片画布无法创建');
        context.drawImage(bitmap || state.node,0,0,width,height);
        const dataUrl = canvas.toDataURL('image/png');
        if (!/^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/u.test(dataUrl)) throw new Error('图片未生成有效PNG');
        if (!sameImageState(state,current())) continue;
        return {state,image:{blockId:id,alt:state.node.getAttribute('alt') || '',mime:'image/png',width,height,dataUrl}};
      } finally {bitmap?.close();}
    }
    await wait(60);
  }
  checkStop();
  throw new Error('未读到唯一、可见且加载稳定的图片');
}
