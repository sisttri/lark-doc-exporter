import { defaultTreeAdapter, parse } from 'parse5';
import { warningMarker, warnings as warningTypes } from './shared.js';

const MiB = 1024 * 1024;
export const limits = { html: 8 * MiB, entry: 24 * MiB, expanded: 48 * MiB, entries: 384 };
const utf8 = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true });
const htmlNamespace = 'http://www.w3.org/1999/xhtml';
export const visibleTags = new Set((
  'article section div p span h1 h2 h3 h4 h5 h6 b strong i em u s del strike blockquote ' +
  'ul ol li pre code br hr a img figure figcaption table caption thead tbody tfoot tr th td ' +
  'sup sub small dl dt dd'
).split(' '));
const omittedTags = new Set('script style template noscript title link meta base source track param area'.split(' '));
const unsupportedTags = new Set('iframe frame frameset object embed video audio canvas input button select textarea form'.split(' '));
const rasterExtensions = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/gif': 'gif', 'image/webp': 'webp' };

const crcTable = Uint32Array.from({ length: 256 }, (_, n) => {
  for (let i = 0; i < 8; i++) n = (n >>> 1) ^ ((n & 1) ? 0xedb88320 : 0);
  return n;
});

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = (crc >>> 8) ^ crcTable[(crc ^ byte) & 255];
  return (crc ^ 0xffffffff) >>> 0;
}

function inputError(code, message) {
  return Object.assign(new Error(message), { code });
}

function invalidInput() {
  return inputError('invalid_input', '采集内容或素材路径无效。');
}

function inputLimit() {
  return inputError('input_limit', '采集内容超过处理限制（384 个条目、单项 24 MiB、合计 48 MiB；正文最多 8 MiB）。');
}

function htmlLimit() {
  return inputError('html_limit', 'HTML 元素数量或嵌套超过限制。');
}

export function boundedHtml(html) {
  let nodes = 0;
  let depth = 0;
  function count() {
    if (++nodes > 60_000) throw htmlLimit();
  }
  const treeAdapter = { ...defaultTreeAdapter };
  for (const name of ['createElement', 'createCommentNode', 'createDocumentFragment']) {
    treeAdapter[name] = (...args) => {
      count();
      return defaultTreeAdapter[name](...args);
    };
  }
  treeAdapter.insertText = (parent, text) => {
    if (parent.childNodes.at(-1)?.nodeName !== '#text') count();
    defaultTreeAdapter.insertText(parent, text);
  };
  treeAdapter.insertTextBefore = (parent, text, reference) => {
    if (parent.childNodes[parent.childNodes.indexOf(reference) - 1]?.nodeName !== '#text') count();
    defaultTreeAdapter.insertTextBefore(parent, text, reference);
  };
  treeAdapter.onItemPush = () => { if (++depth > 98) throw htmlLimit(); };
  treeAdapter.onItemPop = () => { depth--; };
  return parse(html, { scriptingEnabled: true, treeAdapter });
}

function safeSegment(segment) {
  return Boolean(segment && segment !== '.' && segment !== '..' &&
    !/[\u0000-\u001f\u007f-\u009f\u2028-\u202e\u2066-\u2069<>:"/\\|?*]/u.test(segment) &&
    !/[. ]$/u.test(segment) &&
    !/^(?:con|prn|aux|nul|com[1-9¹²³]|lpt[1-9¹²³])(?:\.|$)/iu.test(segment));
}

function safeParts(parts) {
  return parts.every((part) => part.length <= 160 && safeSegment(part));
}

function assetPath(raw) {
  const path = raw.normalize('NFC');
  if (path.length > 512 || !safeParts(path.split('/'))) {
    throw invalidInput();
  }
  if (!/^(?:images|attachments)\/.+$/u.test(path)) {
    throw invalidInput();
  }
  return path;
}

function validatePaths(entries) {
  const paths = new Map();
  for (const { path } of entries) {
    const parts = path.split('/');
    let prefix = '';
    for (let i = 1; i <= parts.length; i++) {
      prefix += (i === 1 ? '' : '/') + parts[i - 1];
      const key = prefix.toLowerCase();
      const last = i === parts.length;
      const previous = paths.get(key);
      if (previous && (previous.prefix !== prefix || !previous.directory || last)) {
        throw invalidInput();
      }
      if (last || !previous) paths.set(key, { prefix, directory: !last });
    }
  }
}

function imageDimensions(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const ascii = (start, end) => String.fromCharCode(...bytes.subarray(start, end));
  const be16 = (offset) => view.getUint16(offset);
  const le16 = (offset) => view.getUint16(offset, true);
  const be32 = (offset) => view.getUint32(offset);
  const le24 = (offset) => le16(offset) | (bytes[offset + 2] << 16);
  if (bytes.length >= 33 && be32(0) === 0x89504e47 && be32(4) === 0x0d0a1a0a &&
    be32(8) === 13 && ascii(12, 16) === 'IHDR') {
    let imageData = false;
    for (let offset = 8, chunks = 0; offset + 12 <= bytes.length && chunks < 16_384; chunks++) {
      const length = be32(offset);
      const end = offset + 8 + length;
      if (end + 4 > bytes.length || crc32(bytes.subarray(offset + 4, end)) !== be32(end)) break;
      const tag = ascii(offset + 4, offset + 8);
      if (tag === 'IDAT' && length) imageData = true;
      if (tag === 'IEND' && imageData && length === 0 && end + 4 === bytes.length) {
        return ['image/png', be32(16), be32(20)];
      }
      offset = end + 4;
    }
    return [];
  }
  if (bytes.length >= 14 && /^GIF8[79]a$/u.test(ascii(0, 6))) {
    return ['image/gif', le16(6), le16(8)];
  }
  if (bytes.length >= 25 && ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP' &&
    view.getUint32(4, true) + 8 === bytes.length) {
    switch (ascii(12, 16)) {
      case 'VP8X':
        if (bytes.length >= 30) return ['image/webp', le24(24) + 1, le24(27) + 1];
        break;
      case 'VP8L':
        if (bytes[20] === 0x2f) {
          return ['image/webp', (le16(21) & 0x3fff) + 1, ((view.getUint32(21, true) >>> 14) & 0x3fff) + 1];
        }
        break;
      case 'VP8 ':
        if (bytes.length >= 30 && bytes[23] === 0x9d && bytes[24] === 1 && bytes[25] === 0x2a) {
          return ['image/webp', le16(26) & 0x3fff, le16(28) & 0x3fff];
        }
        break;
    }
  }
  if (bytes.length >= 12 && be16(0) === 0xffd8) {
    for (let offset = 2; offset + 8 < bytes.length;) {
      if (bytes[offset++] !== 0xff) break;
      while (bytes[offset] === 0xff) offset++;
      const marker = bytes[offset++];
      if (offset + 7 > bytes.length || marker === 0xda || marker === 0xd9) break;
      const length = be16(offset);
      if (length < 2 || offset + length > bytes.length) break;
      if (length >= 8 && [0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) {
        return ['image/jpeg', be16(offset + 5), be16(offset + 3)];
      }
      offset += length;
    }
  }
  return [];
}

async function rasterType(bytes) {
  const [type, width, height] = imageDimensions(bytes);
  if (!type || !width || !height || width > 8192 || height > 8192 || width * height > 16_000_000) return '';
  if (typeof createImageBitmap !== 'function') return type;
  try {
    const bitmap = await createImageBitmap(new Blob([bytes], { type }));
    const valid = bitmap.width <= 8192 && bitmap.height <= 8192 && bitmap.width * bitmap.height <= 16_000_000;
    bitmap.close();
    return valid ? type : '';
  } catch {
    return '';
  }
}

function localPath(raw) {
  try {
    const parts = raw.replace(/^(?:\.\/)+/u, '').split(/[?#]/u, 1)[0].split('/').map(decodeURIComponent);
    const path = parts.join('/').normalize('NFC');
    if (path.length > 512 || !['images', 'attachments'].includes(parts[0]) || parts.length < 2 ||
      !safeParts(parts) || !safeParts(path.split('/'))) return '';
    return path;
  } catch {
    return '';
  }
}

export function webLink(raw) {
  if (/[\u0000-\u001f\u007f\\]/u.test(raw) || !/^(?:https?:\/\/|mailto:)/iu.test(raw)) return '';
  try {
    const url = new URL(raw);
    return url.username || url.password ? '' : url.href;
  } catch {
    return '';
  }
}

function attr(node, name) {
  return node.attrs?.find((item) => item.name === name && !item.namespace)?.value ?? '';
}

function joinText(items) {
  const result = [];
  for (const item of items) {
    if (typeof item === 'string' && typeof result.at(-1) === 'string') result[result.length - 1] += item;
    else result.push(item);
  }
  return result;
}

function nodeText(node) {
  if (typeof node === 'string') return node;
  return node.children?.map(nodeText).join('') ?? '';
}

function preservedWarnings(serialized) {
  try {
    const warnings = JSON.parse(serialized);
    if (!Array.isArray(warnings) || warnings.length > 60_000) return [];
    return warnings.flatMap((item) => {
      if (!item || typeof item.code !== 'string' || !Object.hasOwn(warningTypes, item.code)) return [];
      const { code, label } = item;
      return typeof label === 'string' && label.trim() ? [{ code, label }] : [{ code }];
    });
  } catch {
    return [];
  }
}

async function documentModel(html, files, fallback) {
  const document = boundedHtml(html);
  const root = document.childNodes.find(({ tagName }) => tagName === 'html');
  const head = root.childNodes.find(({ tagName }) => tagName === 'head');
  const body = root.childNodes.find(({ tagName }) => tagName === 'body');
  if (!body) throw inputError('invalid_html', 'HTML 未包含可导入的正文。');
  const assets = new Map();
  const warnings = [];
  const cacheWarnings = head.childNodes.find(
    (node) => node.tagName === 'meta' && attr(node, 'name') === warningMarker,
  );
  const cachedWarnings = cacheWarnings ? preservedWarnings(attr(cacheWarnings, 'content')) : [];
  const importedWarningLocations = new Set(cachedWarnings.filter(item => item.label)
    .map(({ code, label }) => code + '\0' + label));
  const occupiedPaths = new Set();
  let embedded = 0;
  let firstHeading = '';
  let nodes = 0;
  let totalBytes = files.get('document.html')?.length ?? 0;
  for (const [path, bytes] of files) {
    if (path === 'document.html') continue;
    const role = path.startsWith('images/') ? 'image' : 'attachment';
    const type = role === 'image' ? await rasterType(bytes) : '';
    totalBytes += bytes.length;
    assets.set(path, { path, type: type || 'application/octet-stream', bytes, role });
    let occupied = path.toLowerCase();
    while (!occupiedPaths.has(occupied)) {
      occupiedPaths.add(occupied);
      const separator = occupied.lastIndexOf('/');
      if (separator < 0) break;
      occupied = occupied.slice(0, separator);
    }
  }

  function note(code, description, children, path) {
    if (!path || !importedWarningLocations.has(code + '\0' + path)) {
      warnings.push(path ? { code, label: path } : { code });
    }
    const text = '[' + description + ']';
    return { tag: 'span', children: children?.length ? joinText([...children, ' ' + text]) : [text] };
  }

  async function readImage(node) {
    const raw = attr(node, 'src').trim();
    const alt = attr(node, 'alt').slice(0, 2048);
    const label = alt ? '图片：' + alt : '图片';
    if (/^data:/iu.test(raw)) {
      const data = /^data:(image\/(?:png|jpeg|gif|webp));base64,([a-z0-9+/]+={0,2})$/iu.exec(raw);
      if (!data) return note('invalid_image', '无效' + label);
      const encoded = data[2];
      if (encoded.length > (limits.entry * 4) / 3 || totalBytes + encoded.length * 3 / 4 > limits.expanded ||
        assets.size + 1 >= limits.entries) return note('invalid_image', '无效' + label);
      try {
        const bytes = Uint8Array.from(atob(encoded), (character) => character.charCodeAt(0));
        const type = await rasterType(bytes);
        if (!type || data[1].toLowerCase() !== type) return note('invalid_image', '无效' + label);
        let path;
        do { path = 'images/embedded-' + ++embedded + '.' + rasterExtensions[type]; } while (occupiedPaths.has(path));
        occupiedPaths.add(path);
        assets.set(path, { path, type, bytes, role: 'image' });
        totalBytes += bytes.length;
        return { tag: 'img', path, alt };
      } catch {
        return note('invalid_image', '无效' + label);
      }
    }
    if (/^(?:\/\/|[a-z][a-z\d+.-]*:)/iu.test(raw)) return note('remote_image', '未加载外部' + label);
    const path = localPath(raw);
    const asset = assets.get(path);
    if (asset?.role === 'image' && asset.type.startsWith('image/')) return { tag: 'img', path, alt };
    if (asset?.role === 'image') return note('invalid_image', '无效' + label, null, path);
    return note('missing_image', '缺少' + label, null, path);
  }

  async function readNodes(list, depth) {
    if (depth > 96) throw htmlLimit();
    const result = [];
    for (const node of list) {
      if (++nodes > 60_000) throw htmlLimit();
      if (node.nodeName === '#text') {
        if (node.value) result.push(node.value);
        continue;
      }
      const tag = node.tagName;
      if (!tag || omittedTags.has(tag)) continue;
      if (tag === 'nav' && attr(node, 'data-feishu-export-navigation') === '1') continue;
      if (node.namespaceURI !== htmlNamespace || unsupportedTags.has(tag) || tag.includes('-')) {
        result.push(note('unsupported_block', '未转换的内容块'));
        continue;
      }
      if (tag === 'img') {
        result.push(await readImage(node));
        continue;
      }
      const children = await readNodes(node.childNodes ?? [], depth + 1);
      if (!visibleTags.has(tag)) {
        result.push(...children);
        continue;
      }
      if (tag === 'a') {
        const raw = attr(node, 'href').trim();
        const path = localPath(raw);
        const href = webLink(raw);
        if (path && assets.has(path)) result.push({ tag, path, children });
        else if (path?.startsWith('attachments/') || node.attrs?.some(({ name }) => name === 'download')) {
          result.push(note('missing_attachment', '缺少附件', children, path));
        } else if (href) result.push({ tag, href, children });
        else if (raw && !raw.startsWith('#')) result.push(note('unsupported_link', '未保留的链接', children));
        else result.push(...children);
        continue;
      }
      const item = { tag };
      if (!['br', 'hr'].includes(tag)) item.children = children;
      if (tag === 'h1' && !firstHeading) firstHeading = nodeText(item).trim();
      if (tag === 'td' || tag === 'th') {
        for (const span of ['colspan', 'rowspan']) {
          const value = Number(attr(node, span));
          if (Number.isInteger(value) && value >= 2 && value <= 64) item[span] = value;
        }
      } else if (tag === 'ol') {
        const value = attr(node, 'start');
        if (/^-?\d{1,6}$/u.test(value) && Number(value) !== 1) item.start = Number(value);
      } else if (tag === 'code') {
        // 代码块语言由 <code class="language-xxx"> 传入，供 Markdown 围栏标注使用。
        const language = /(?:^|\s)language-([a-z0-9][a-z0-9-]{0,31})(?:\s|$)/iu.exec(attr(node, 'class'))?.[1];
        if (language) item.language = language.toLowerCase();
      }
      result.push(item);
    }
    return joinText(result);
  }

  const blocks = await readNodes(body.childNodes, 0);
  if (!blocks.some((item) => typeof item !== 'string' || item.trim())) {
    throw inputError('invalid_html', 'HTML 未包含可导入的正文。');
  }
  const htmlTitle = head.childNodes.find(({ tagName }) => tagName === 'title')?.childNodes
    .map((node) => node.value ?? '').join('');
  const fullTitle = (firstHeading || htmlTitle?.trim() || fallback).replace(/\s+/gu, ' ').trim();
  const title = fullTitle.match(/^.{1,160}/u)?.[0] || '文档';
  return {
    version: 1, title, blocks,
    assets: [...assets.values()].sort((first, second) => first.path < second.path ? -1 : Number(first.path > second.path)),
    warnings: [...cachedWarnings, ...warnings],
  };
}

function decodeHtml(bytes) {
  try {
    return utf8.decode(bytes).replace(/^\uFEFF/u, '');
  } catch {
    throw inputError('invalid_encoding', '文档正文必须使用 UTF-8 编码。');
  }
}

export async function readDocumentParts({html, assets = [], name = '文档'} = {}) {
  if (!(typeof html === 'string' || html instanceof Uint8Array) || !Array.isArray(assets)) {
    throw inputError('invalid_input', '采集正文和素材数据无效。');
  }
  if (html.length > limits.html || assets.length + 1 > limits.entries) throw inputLimit();
  const body = typeof html === 'string' ? new TextEncoder().encode(html) : html;
  if (body.length > limits.html) throw inputLimit();
  const entries = [{path:'document.html', bytes:body}];
  let expanded = body.length;
  for (const asset of assets) {
    if (!asset || typeof asset.path !== 'string' || !(asset.bytes instanceof Uint8Array)) {
      throw inputError('invalid_input', '素材路径或字节数据无效。');
    }
    const path = assetPath(asset.path);
    expanded += asset.bytes.length;
    if (asset.bytes.length > limits.entry || expanded > limits.expanded) throw inputLimit();
    entries.push({path, bytes:asset.bytes});
  }
  validatePaths(entries);
  // Snapshot before documentModel first awaits image validation. External views
  // (including Buffer/subarrays) cannot later mutate the retained document.
  const files = new Map();
  for (const {path,bytes} of entries) {
    const owned = path === 'document.html' && typeof html === 'string';
    files.set(path, owned ? bytes : new Uint8Array(bytes));
  }
  return documentModel(decodeHtml(files.get('document.html')), files, typeof name === 'string' ? name : '文档');
}
