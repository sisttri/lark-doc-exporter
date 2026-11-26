const TEXT_KINDS = new Set(['docx', 'docs', 'wiki']);
const OTHER_LABELS = {
  sheets: '电子表格', base: '多维表格', bitable: '多维表格', slides: '幻灯片',
  mindnotes: '思维笔记', file: '文件预览',
};
const RESERVED_WIKI_PATHS = new Set(['settings', 'home', 'space', 'spaces', 'search']);
const ZERO_WIDTH = /[\u200b\u200c\u200d\u2060\ufeff]/gu;

function cleanText(value) {
  return String(value || '').replace(ZERO_WIDTH, ' ').replace(/\s+/gu, ' ').trim();
}

export function readDocumentRoute(location = globalThis.location) {
  const href = typeof location === 'string' ? location : location?.href || '';
  const empty = { href, key: '', kind: '', token: '' };
  let url;
  try { url = new URL(href); } catch { return empty; }
  const hostname = url.hostname.toLowerCase().replace(/\.$/u, '');
  if (url.protocol !== 'https:' || (hostname !== 'feishu.cn' && !hostname.endsWith('.feishu.cn'))) return empty;
  const pathname = typeof location?.pathname === 'string' ? location.pathname : url.pathname;
  const match = pathname.match(/^\/(docx|docs|wiki|sheets|base|bitable|slides|mindnotes|file)\/([A-Za-z0-9]+)\/?$/u);
  if (!match || (match[1] === 'wiki' && RESERVED_WIKI_PATHS.has(match[2]))) return empty;
  return { href, key: match[1] + ':' + match[2], kind: match[1], token: match[2] };
}

function isVisible(element, view) {
  if (!element || element.isConnected === false || element.hidden || element.getAttribute?.('aria-hidden') === 'true') return false;
  const style = view.getComputedStyle?.(element);
  return style?.display !== 'none' && style?.visibility !== 'hidden';
}

function embeddedKind(document, href) {
  for (const frame of document?.querySelectorAll?.('iframe[src]') || []) {
    const src = frame.getAttribute('src');
    let embedded;
    try { embedded = readDocumentRoute(new URL(src, href)); } catch { continue; }
    if (Object.hasOwn(OTHER_LABELS, embedded.kind)) return embedded.kind;
  }
  return '';
}

export function readDocumentSource(view = globalThis) {
  const { document } = view;
  const route = readDocumentRoute(view.location);
  const pageBlock = document?.querySelector('[data-block-type="page"]') || document?.querySelector('.page-block');
  const titleEl = document?.querySelector('.page-block-content');
  const title = cleanText(titleEl?.textContent || (document?.title || '').replace(/\s*-\s*(?:Feishu Docs|飞书云文档)$/iu, ''));
  const docToken = pageBlock?.getAttribute('data-record-id') || '';
  const source = {
    href: route.href, key: route.key, kind: route.kind,
    wikiToken: route.kind === 'wiki' ? route.token : '', docToken, title,
    ready: false, unsupported: false, reason: '',
  };
  if (!route.key) {
    source.reason = '请打开一篇飞书文档后保存。';
    return source;
  }
  const otherKind = !TEXT_KINDS.has(route.kind) ? route.kind
    : route.kind === 'wiki' && !pageBlock ? embeddedKind(document, route.href) : '';
  if (otherKind) {
    source.unsupported = true;
    source.reason = '当前页面是' + OTHER_LABELS[otherKind] + '，暂不支持保存这一类型。';
    return source;
  }
  const scroller = document?.querySelector('.bear-web-x-container');
  if (!isVisible(pageBlock, view) || !isVisible(scroller, view) || !docToken || !title) {
    source.reason = '正在等待文档正文加载。';
    return source;
  }
  if (route.kind !== 'wiki' && docToken !== route.token) {
    source.reason = '正在等待当前文档，页面仍显示前一篇正文。';
    return source;
  }
  source.ready = true;
  return source;
}
