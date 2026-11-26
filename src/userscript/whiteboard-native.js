import {normalizeColor} from '../table-style.js';

const boundsKeys = ['minX','maxX','minY','maxY'];

function sceneBounds(manager) {
  const source = manager.getNodesBounds();
  if (!source || !boundsKeys.every(key => Number.isFinite(source[key]))) return null;
  const bounds = Object.fromEntries(boundsKeys.map(key => [key,source[key]]));
  const width = bounds.maxX-bounds.minX, height = bounds.maxY-bounds.minY;
  return width > 0 && height > 0 && Number.isFinite(width*height) ? bounds : null;
}

function findBoard(root, id, recordId) {
  const pending = [root], seen = new Set();
  while (pending.length && seen.size < 20_000) {
    const model = pending.pop();
    if (!model || typeof model !== 'object' || seen.has(model)) continue;
    seen.add(model);
    if (String(model.id) === id && model.type === 'whiteboard' && model.record?.id === recordId) return model;
    if (Array.isArray(model.children)) pending.push(...model.children);
    const children = model.innerBlockManager?.rootBlockModel?.children;
    if (Array.isArray(children)) pending.push(...children);
  }
  return null;
}

// Optional, local renderer capability. Unknown page versions use the DOM preview.
export async function renderNativeWhiteboard(id, {document, pageView, checkStop = () => {}, waitForReady, background} = {}) {
  let canvas, owned = false;
  try {
    checkStop();
    const key = String(id);
    if (!/^[\w-]{1,160}$/u.test(key)) return null;
    const page = document?.querySelector('[data-block-type="page"]');
    const block = document?.querySelector('[data-block-id="' + key + '"]');
    const pageId = page?.getAttribute('data-record-id'), recordId = block?.getAttribute('data-record-id');
    const root = pageView?.PageMain?.blockManager?.rootBlockModel;
    if (!pageId || !recordId || !root || root.record?.id !== pageId || block.isConnected === false ||
      block.getAttribute('data-block-type') !== 'whiteboard' || !page.contains(block)) return null;
    const model = findBoard(root,key,recordId);
    const app = model?.whiteboardBlock?.abilityKit?.getRatioApp?.()?.app;
    const manager = app?.application?.nodeManager, renderer = app?.renderManager;
    if (typeof manager?.getNodesBounds !== 'function' || typeof renderer?.getImageOffscreenCanvas !== 'function') return null;
    const belongsToPage = () => pageView?.PageMain?.blockManager?.rootBlockModel === root && root.record?.id === pageId &&
      document.querySelector('[data-block-type="page"]') === page && page.getAttribute('data-record-id') === pageId &&
      document.querySelector('[data-block-id="' + key + '"]') === block && block.isConnected !== false &&
      block.getAttribute('data-record-id') === recordId && page.contains(block) && findBoard(root,key,recordId) === model &&
      model.whiteboardBlock?.abilityKit?.getRatioApp?.()?.app === app;
    if (waitForReady && !await waitForReady()) return null;
    checkStop();
    if (!belongsToPage()) return null;
    const source = sceneBounds(manager);
    if (!source) return null;
    const bounds = {minX:source.minX-24,maxX:source.maxX+24,minY:source.minY-24,maxY:source.maxY+24};
    const width = bounds.maxX-bounds.minX, height = bounds.maxY-bounds.minY;
    const scale = Math.min(2,8192/width,8192/height,Math.sqrt(15_900_000/(width*height)));
    if (!Number.isFinite(scale) || scale <= 0 || width*scale < 1 || height*scale < 1) return null;
    checkStop();
    // The verified API returns a detached HTMLCanvas synchronously. Do not await
    // unknown promises or change the scene, viewport, nodes or shared bounds.
    canvas = renderer.getImageOffscreenCanvas(bounds,scale,normalizeColor(background) || '#ffffff');
    if (!canvas || typeof canvas.then === 'function' || canvas.isConnected !== false ||
      typeof canvas.toDataURL !== 'function' || document.contains?.(canvas)) return null;
    owned = true;
    checkStop();
    const outputWidth = canvas.width, outputHeight = canvas.height;
    if (!Number.isSafeInteger(outputWidth) || !Number.isSafeInteger(outputHeight) || outputWidth < 1 || outputHeight < 1 ||
      outputWidth > 8192 || outputHeight > 8192 || outputWidth*outputHeight > 16_000_000) return null;
    const dataUrl = canvas.toDataURL('image/png');
    // Keep the encoded payload inside the importer's existing 24 MiB entry cap.
    if (typeof dataUrl !== 'string' || dataUrl.length > 32*1024*1024+64 ||
      !/^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/u.test(dataUrl)) return null;
    checkStop();
    const currentBounds = sceneBounds(manager);
    if (!belongsToPage() || !currentBounds || !boundsKeys.every(name => currentBounds[name] === source[name])) return null;
    return {blockId:id,mime:'image/png',width:outputWidth,height:outputHeight,
      alt:'白板静态图（原始场景渲染）',dataUrl};
  } catch (error) {
    if (error?.name === 'AbortError') throw error;
    return null;
  } finally {
    if (owned) {
      try {canvas.width=0;canvas.height=0;} catch {}
    }
  }
}
