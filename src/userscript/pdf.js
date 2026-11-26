import {validFontCoverage} from '../pdf-emoji.js';

function cancelled() {
  return new DOMException('保存已取消', 'AbortError');
}

function invalidResource() {
  return Object.assign(new Error('PDF 资源校验失败，请重新安装脚本。'), {code:'PDF_RESOURCE_INVALID'});
}

async function readCachedPdfResources(hashes, shouldStop) {
  const resources = {};
  for (const name of ['pdfEngine', 'pdfFonts']) {
    if (shouldStop()) throw cancelled();
    let source;
    try { source = GM_getResourceText(name); } catch { throw invalidResource(); }
    if (shouldStop()) throw cancelled();
    if (typeof source !== 'string' || !source) throw invalidResource();
    let digest;
    try { digest = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(source))); }
    catch { throw invalidResource(); }
    if (shouldStop()) throw cancelled();
    const actual = Array.from(digest, byte => byte.toString(16).padStart(2, '0')).join('');
    if (actual !== hashes[name]) throw invalidResource();
    resources[name] = source;
  }
  let fontArchive;
  try { fontArchive = JSON.parse(resources.pdfFonts); } catch { throw invalidResource(); }
  const names = ['Regular.woff2', 'Bold.woff2', 'Emoji.ttf', 'Symbols.ttf'];
  if (!Array.isArray(fontArchive) || fontArchive.length !== names.length ||
      names.some(name => fontArchive.filter(font => font?.name === name).length !== 1) ||
      fontArchive.some(font => !Number.isSafeInteger(font.size) || font.size <= 0 ||
        !Number.isSafeInteger(font.compressedSize) || font.compressedSize <= 0 ||
        typeof font.compressed !== 'string' || font.compressed.length !== Math.ceil(font.compressedSize / 4) * 5 ||
        !/^[a-f0-9]{64}$/.test(font.hash) ||
        (font.name === 'Emoji.ttf' || font.name === 'Symbols.ttf') && !validFontCoverage(font.coverage))) throw invalidResource();
  return {engineSource:resources.pdfEngine, fontArchive};
}

export async function renderPdf(snapshot, {shouldStop = () => false, onProgress} = {}) {
  if (shouldStop()) throw cancelled();
  const {workerSource, resourceHashes} = await import('pdf-worker-assets');
  if (shouldStop()) throw cancelled();
  const {engineSource, fontArchive} = await readCachedPdfResources(resourceHashes, shouldStop);
  if (shouldStop()) throw cancelled();
  return new Promise((resolve, reject) => {
    let worker, url, cancellationTimer;
    let settled = false;
    function finish(error, result) {
      if (settled) return;
      settled = true;
      clearInterval(cancellationTimer);
      worker?.terminate();
      if (url) URL.revokeObjectURL(url);
      if (error) reject(error);
      else resolve(result);
    }
    try {
      // 两部分都来自本地：引擎为安装缓存，自有排版逻辑保留在主脚本中。
      url = URL.createObjectURL(new Blob([engineSource, '\n;\n', workerSource], {type:'text/javascript'}));
      worker = new Worker(url);
      cancellationTimer = setInterval(() => {
        if (shouldStop()) finish(cancelled());
      }, 50);
      worker.onmessage = ({data}) => {
        if (settled) return;
        if (shouldStop()) { finish(cancelled()); return; }
        if (data.stage) {
          try { onProgress?.(data.stage); } catch {}
        } else if (data.error) {
          const messages = {
            PDF_LIMIT:'文档超过 PDF 排版容量上限，请选择其他格式。',
            PDF_FONT_INVALID:'PDF 字体校验失败，请重新安装脚本。',
            PDF_RESOURCE_INVALID:'PDF 资源校验失败，请重新安装脚本。',
          };
          const message = messages[data.error] || 'PDF 生成失败，请重试。';
          finish(Object.assign(new Error(message), {code:data.error}));
        } else if (data.result) finish(null, data.result);
      };
      worker.onerror = event => {
        event.preventDefault();
        finish(Object.assign(new Error('PDF 生成失败，请重试。'), {code:'PDF_FAILED'}));
      };
      worker.onmessageerror = () => finish(Object.assign(new Error('无法读取 PDF 生成结果，请重试。'), {code:'PDF_FAILED'}));
      worker.postMessage({snapshot, fontArchive});
    } catch (error) { finish(error); }
  });
}
