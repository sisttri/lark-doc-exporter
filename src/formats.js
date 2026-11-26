import { strToU8, zipSync } from 'fflate';
import { visibleTags, webLink } from './importer.js';
import { safeStem, warningLabel } from './shared.js';

const zipOptions = { level: 1, mtime: new Date(2000, 0, 1) };
const rasterTypes = new Set(['image/png', 'image/jpeg', 'image/gif', 'image/webp']);
const maxOutputSize = 80 * 1024 * 1024;
const maxMarkdownSize = 24 * 1024 * 1024;
const htmlStyle = 'body{font:16px/1.65 system-ui,sans-serif;max-width:850px;margin:40px auto;padding:0 20px;color:#202020}' +
  'img{max-width:100%;height:auto}.table-scroll{max-width:100%;overflow-x:auto;margin:1em 0}' +
  'table{border-collapse:collapse}th,td{border:1px solid #999;padding:5px 10px;vertical-align:top}' +
  'pre{white-space:pre;overflow:auto;max-width:100%;tab-size:4;background:#f2f2f2;padding:12px}a{overflow-wrap:anywhere}figure{margin:1em 0}' +
  '.export-toc{margin:1em 0 1.5em;color:#4e5969}.export-toc summary{cursor:pointer;width:fit-content}' +
  '.export-toc ul{list-style:none;padding:0;margin:.6em 0}.export-toc li{margin:.3em 0}' +
  '.export-toc .toc-level-3{padding-left:1em}.export-toc .toc-level-4{padding-left:2em}' +
  '.export-toc .toc-level-5{padding-left:3em}.export-toc .toc-level-6{padding-left:4em}' +
  '@media(max-width:600px){body{margin:20px auto;padding:0 16px}}' +
  '@media print{body{max-width:none;margin:0;padding:0}.export-toc{display:none}.table-scroll{overflow:visible}' +
  'pre{white-space:pre-wrap;overflow-wrap:anywhere;overflow:visible}table{width:100%}th,td{overflow-wrap:anywhere}}';
const csp = "default-src 'none'; script-src 'none'; connect-src 'none'; img-src data:; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'";
const blockTags = new Set((
  'article section div p h1 h2 h3 h4 h5 h6 blockquote ul ol li pre hr figure figcaption table dl dt dd'
).split(' '));
const markdownBlocksInCells = new Set(['blockquote', 'ul', 'ol', 'pre', 'hr', 'figure', 'table', 'dl']);

function outputLimit() {
  return Object.assign(new Error('导出结果超过本机处理上限。'), { code: 'render_limit' });
}

function escapeHtml(text) {
  return String(text).replace(/[&<>"'\r]/gu, (character) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;', '\r': '&#13;' }[character]
  ));
}

function utf8Size(text) {
  let size = text.length;
  if (!/[\u0080-\uFFFF]/.test(text)) return size;
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (code <= 127) continue;
    if (code < 2048) size++;
    else if (code >= 0xd800 && code <= 0xdbff &&
      text.charCodeAt(i + 1) >= 0xdc00 && text.charCodeAt(i + 1) <= 0xdfff) { size += 2; i++; }
    else size += 2;
  }
  return size;
}

function relativeUrl(path) {
  return path.split('/').map((part) => encodeURIComponent(part).replace(/[!'()*]/gu,
    (character) => '%' + character.charCodeAt(0).toString(16).toUpperCase())).join('/');
}

function dataUrl(bytes, type) {
  if (typeof bytes.toBase64 === 'function') return 'data:' + type + ';base64,' + bytes.toBase64();
  const encoded = [];
  for (let start = 0; start < bytes.length; start += 12_288) {
    encoded.push(btoa(String.fromCharCode(...bytes.subarray(start, start + 12_288))));
  }
  return 'data:' + type + ';base64,' + encoded.join('');
}

function textContent(node) {
  if (typeof node === 'string') return node;
  return (node.children ?? []).map(textContent).join('');
}

function visitedAssets(nodes, paths = new Set()) {
  for (const node of nodes) {
    if (typeof node !== 'object') continue;
    if (node.path) paths.add(node.path);
    if (node.children) visitedAssets(node.children, paths);
  }
  return paths;
}

function htmlNodes(nodes, lookup, embedded, account = (markup) => markup, presentation) {
  return nodes.map((node) => {
    if (typeof node === 'string') return account(escapeHtml(node));
    const { tag, children = [] } = node;
    if (!visibleTags.has(tag)) return htmlNodes(children, lookup, embedded, account, presentation);
    const asset = lookup.get(node.path);
    if (tag === 'img') {
      if (!rasterTypes.has(asset?.type) || asset.role !== 'image') return account('[缺少图片]');
      const src = embedded ? embedded(asset, true) : relativeUrl(asset.path);
      return account('<img src="' + escapeHtml(src) + '" alt="' + escapeHtml(node.alt ?? '') + '">');
    }
    if (tag === 'br' || tag === 'hr') return account('<' + tag + '>');
    let attrs = '';
    if (tag === 'a') {
      if (asset) {
        const href = embedded ? embedded(asset, false) : relativeUrl(asset.path);
        attrs = ' href="' + escapeHtml(href) + '"';
        if (embedded || asset.role === 'attachment') attrs += ' download="' + escapeHtml(asset.path.split('/').at(-1)) + '"';
      } else if (node.href && webLink(node.href)) {
        attrs = ' href="' + escapeHtml(webLink(node.href)) + '" rel="noopener noreferrer"';
      } else {
        return htmlNodes(children, lookup, embedded, account, presentation);
      }
    }
    if (tag === 'td' || tag === 'th') {
      for (const name of ['colspan', 'rowspan']) {
        const value = node[name];
        if (Number.isInteger(value) && value >= 2 && value <= 64) attrs += ' ' + name + '="' + value + '"';
      }
    }
    if (tag === 'ol' && Number.isInteger(node.start)) attrs = ' start="' + node.start + '"';
    if (tag === 'code' && /^[a-z0-9][a-z0-9-]{0,31}$/u.test(node.language ?? '')) {
      attrs = ' class="language-' + node.language + '"';
    }
    if (presentation?.headings.has(node)) attrs += ' id="' + presentation.headings.get(node) + '"';
    const opening = account((tag === 'table' && presentation ? '<div class="table-scroll">' : '') + '<' + tag + attrs + '>');
    let contents = htmlNodes(children, lookup, embedded, account, presentation);
    if (tag === 'pre' && typeof children[0] === 'string' && children[0].startsWith('\n')) {
      contents = account('\n') + contents;
    }
    return opening + contents + account('</' + tag + '>' + (tag === 'table' && presentation ? '</div>' : ''));
  }).join('');
}

function htmlNavigation(blocks, title) {
  const headings = new WeakMap(), entries = [];
  let count = 0, skippedTitle = false;
  function visit(nodes) {
    for (const node of nodes) {
      if (typeof node !== 'object') continue;
      if (/^h[1-6]$/u.test(node.tag)) {
        const id = 'fle-section-' + ++count;
        const label = textContent(node).replace(/\s+/gu, ' ').trim();
        headings.set(node, id);
        if (!skippedTitle && node.tag === 'h1' && label === title.trim()) skippedTitle = true;
        else if (label) entries.push({id, label:Array.from(label).slice(0,160).join(''), level:node.tag[1]});
      }
      visit(node.children || []);
    }
  }
  visit(blocks);
  const longDocument = textContent({children:blocks}).replace(/\s/gu, '').length >= 1000;
  const markup = entries.length >= 3 && longDocument ? '<nav class="export-toc" data-feishu-export-navigation="1" aria-label="文档目录">' +
    '<details><summary>目录</summary><ul>' + entries.map(({id,label,level}) =>
      '<li class="toc-level-' + level + '"><a href="#' + id + '">' + escapeHtml(label) + '</a></li>').join('') + '</ul></details></nav>' : '';
  return {headings, markup};
}

function exportBlocks({ blocks, warnings }) {
  if (!warnings.length) return blocks;
  return [...blocks, { tag: 'h2', children: ['导出提示'] }, {
    tag: 'ul',
    children: warnings.map(({ code, label }) => ({
      tag: 'li', children: [label ? warningLabel(code) + ' · ' + label : warningLabel(code)],
    })),
  }];
}

function standaloneHtml(snapshot, limit) {
  const { title, blocks, assets } = snapshot;
  const lookup = new Map(assets.map((asset) => [asset.path, asset]));
  let size = 0;
  function account(markup) {
    size += utf8Size(markup);
    if (size > limit) throw outputLimit();
    return markup;
  }
  const embedded = (asset, image) => {
    if (size + Math.ceil(asset.bytes.length / 3) * 4 > limit) throw outputLimit();
    return dataUrl(asset.bytes, image ? asset.type : 'application/octet-stream');
  };
  const navigation = htmlNavigation(blocks, title);
  const body = account(navigation.markup) + htmlNodes(exportBlocks(snapshot), lookup, embedded, account, navigation);
  let supplemental = '';
  const referenced = visitedAssets(blocks);
  const unreferenced = assets.filter((asset) => !referenced.has(asset.path));
  if (unreferenced.length) {
    const contents = unreferenced.map((asset) => account(
      '<li><a href="' + embedded(asset, false) + '" download="' + escapeHtml(asset.path.split('/').at(-1)) + '">' +
      escapeHtml(asset.path) + '</a></li>')).join('');
    supplemental = account('<section><h2>随包文件</h2><ul>') + contents + account('</ul></section>');
  }
  const metadata = '<meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="' + csp + '">' +
    '<meta name="referrer" content="no-referrer"><meta name="viewport" content="width=device-width, initial-scale=1">';
  const head = account('<!doctype html><html lang="zh-CN"><head>' + metadata +
    '<title>' + escapeHtml(title) + '</title><style>' + htmlStyle + '</style></head><body>');
  return head + body + supplemental + account('</body></html>');
}

function markdownHtml(nodes, lookup) {
  // Keep raw HTML on one line and keep imported punctuation inert in inline HTML contexts.
  let size = 0;
  return htmlNodes(nodes, lookup, null, (markup) => {
    const encoded = markup.replace(/[\n\u0085\u2028\u2029!\[\]]/gu, (character) => '&#' + character.charCodeAt(0) + ';');
    size += utf8Size(encoded);
    if (size > maxMarkdownSize) throw outputLimit();
    return encoded;
  });
}

function joinMarkdown(parts, separator) {
  let size = utf8Size(separator) * Math.max(0, parts.length - 1);
  for (const part of parts) {
    size += utf8Size(part);
    if (size > maxMarkdownSize) throw outputLimit();
  }
  return parts.join(separator);
}

function indentMarkdown(text, prefix, blankPrefix = '') {
  let size = utf8Size(text) + prefix.length;
  if (size > maxMarkdownSize) throw outputLimit();
  let lines = 1;
  for (let offset = text.indexOf('\n'); offset >= 0; offset = text.indexOf('\n', offset + 1)) {
    if (++lines > 200_000) throw outputLimit();
    size += prefix.length;
    if (size > maxMarkdownSize) throw outputLimit();
  }
  return text.replace(/(^|\n)(?=[^\n])/gu, '$1' + prefix)
    .replace(/(^|\n)(?=\n|$)/gu, '$1' + blankPrefix);
}

function escapeMarkdown(text) {
  return text.replace(/[\t\r\n\f ]+/gu, ' ')
    .replace(/[\\`*_{}\[\]<>()#+~!$]/gu, '\\$&')
    .replace(/&(?=[a-z#])/giu, '&amp;');
}

function longestBackticks(text) {
  return (text.match(/`+/gu) ?? []).reduce((longest, run) => Math.max(longest, run.length), 0);
}

function markdownInline(nodes, lookup, table = false) {
  return joinMarkdown(nodes.map((node) => {
    if (typeof node === 'string') {
      const escaped = escapeMarkdown(node);
      return table ? escaped.replaceAll('|', '\\|') : escaped;
    }
    const { tag, children = [] } = node;
    const asset = lookup.get(node.path);
    if (tag === 'img') {
      if (!asset || asset.role !== 'image' || !rasterTypes.has(asset.type)) return '\\[缺少图片\\]';
      const alt = escapeMarkdown(node.alt ?? '');
      return '![' + (table ? alt.replaceAll('|', '\\|') : alt) + '](' + relativeUrl(asset.path) + ')';
    }
    if (tag === 'br') return table ? '<br>' : '  \n';
    if (tag === 'code') {
      let text = textContent(node).replace(/\r?\n/gu, ' ');
      if (!text) return '<code></code>';
      if (table) text = text.replaceAll('|', '\\|');
      const fence = '`'.repeat(longestBackticks(text) + 1);
      const pad = text.startsWith('`') || text.endsWith('`') ||
        (text.trim() && text.startsWith(' ') && text.endsWith(' ')) ? ' ' : '';
      return fence + pad + text + pad + fence;
    }
    const inner = markdownInline(children, lookup, table);
    if (tag === 'a') {
      const href = asset ? relativeUrl(asset.path) : webLink(node.href ?? '').replace(/[<>()\s|\\]/gu,
        (character) => '%' + character.charCodeAt(0).toString(16).toUpperCase().padStart(2, '0'));
      return href ? '[' + (inner.trim() || '链接') + '](' + href + ')' : inner;
    }
    const delimiter = { b: '**', strong: '**', i: '*', em: '*', s: '~~', del: '~~', strike: '~~' }[tag];
    if (delimiter && inner.trim()) return inner.replace(/(\S(?:[\s\S]*\S)?)/u, delimiter + '$1' + delimiter);
    if (['u', 'sup', 'sub', 'small'].includes(tag)) return '<' + tag + '>' + inner + '</' + tag + '>';
    return inner;
  }), '');
}

function onlyElements(node) {
  return (node.children ?? []).filter((child) => typeof child !== 'string');
}

function complexCell(node) {
  return (node.children ?? []).some((child) => typeof child === 'object' &&
    (markdownBlocksInCells.has(child.tag) || complexCell(child)));
}

function markdownTable(table, lookup) {
  const sections = onlyElements(table);
  const rows = sections.flatMap((node) => node.tag === 'tr' ? [node] : onlyElements(node));
  const cells = rows.map(onlyElements);
  if (sections.some((node) => !['tr', 'thead', 'tbody', 'tfoot'].includes(node.tag)) ||
    rows.some((node) => node.tag !== 'tr') ||
    !cells[0]?.length || cells[0].some(({ tag }) => tag !== 'th') ||
    cells.slice(1).some((row) => row.some(({ tag }) => tag !== 'td')) ||
    cells.some((row) => row.length !== cells[0].length ||
      row.some((cell) => cell.colspan || cell.rowspan || complexCell(cell)))) {
    return markdownHtml([table], lookup);
  }
  const lines = cells.map((row) => '| ' +
    row.map((cell) => {
      const parts = [];
      let inline = [];
      for (const child of cell.children ?? []) {
        if (typeof child === 'object' && blockTags.has(child.tag)) {
          if (inline.length) parts.push(markdownInline(inline, lookup, true).trim());
          parts.push(markdownInline(child.children ?? [], lookup, true).trim());
          inline = [];
        } else {
          inline.push(child);
        }
      }
      if (inline.length) parts.push(markdownInline(inline, lookup, true).trim());
      return joinMarkdown(parts.filter(Boolean), '<br>');
    }).join(' | ') + ' |');
  lines.splice(1, 0, '| ' + cells[0].map(() => '---').join(' | ') + ' |');
  return joinMarkdown(lines, '\n');
}

function markdownList(node, lookup) {
  let index = node.start ?? 1;
  if (index < 0) return markdownHtml([node], lookup);
  return joinMarkdown(onlyElements(node).map((item) => {
    const prefix = node.tag === 'ol' ? index++ + '. ' : '- ';
    let text = '';
    let pending = [];
    for (const child of item.children ?? []) {
      if (typeof child === 'object' && (child.tag === 'ul' || child.tag === 'ol')) {
        const paragraph = markdownFlow(pending, lookup);
        text += (text && paragraph ? '\n\n' : '') + paragraph;
        const sublist = markdownList(child, lookup);
        text += (text ? '\n' : '') + sublist;
        pending = [];
      } else {
        pending.push(child);
      }
    }
    const paragraph = markdownFlow(pending, lookup);
    text += (text && paragraph ? '\n\n' : '') + paragraph;
    return prefix + indentMarkdown(text, ' '.repeat(prefix.length)).slice(text ? prefix.length : 0);
  }), '\n');
}

function markdownBlock(node, lookup) {
  const { tag, children = [] } = node;
  if (/^h[1-6]$/u.test(tag)) return '#'.repeat(Number(tag[1])) + ' ' + markdownInline(children, lookup).trim();
  if (tag === 'pre') {
    const code = textContent(node);
    const fence = '`'.repeat(Math.max(3, longestBackticks(code) + 1));
    const codeNode = onlyElements(node).find((child) => child.tag === 'code');
    const language = codeNode && typeof codeNode.language === 'string' ? codeNode.language : '';
    return fence + language + '\n' + code + (code.endsWith('\n') ? '' : '\n') + fence;
  }
  if (tag === 'blockquote') {
    const content = markdownFlow(children, lookup);
    return content ? indentMarkdown(content, '> ', '>') : '>';
  }
  if (tag === 'ul' || tag === 'ol') return markdownList(node, lookup);
  if (tag === 'table') return markdownTable(node, lookup);
  if (tag === 'hr') return '---';
  if (tag === 'dl') return markdownHtml([node], lookup);
  if (tag === 'figcaption') return '*' + markdownInline(children, lookup).trim() + '*';
  return markdownFlow(children, lookup);
}

function markdownFlow(nodes, lookup) {
  const chunks = [];
  let inline = [];
  function flush() {
    const text = markdownInline(inline, lookup).trim();
    if (text) chunks.push(text
      .replace(/(^|\n)([0-9]{1,9})([.)])(?= )/gu, '$1$2\\$3')
      .replace(/(^|\n)([-+>])(?= )|(^|\n)([-=])(?=[-=]*(?:\n|$))/gu,
        (_, beforeList, marker, beforeRule, rule) => (beforeList ?? beforeRule) + '\\' + (marker ?? rule)));
    inline = [];
  }
  for (const node of nodes) {
    if (typeof node === 'object' && blockTags.has(node.tag)) {
      flush();
      chunks.push(markdownBlock(node, lookup));
    } else {
      inline.push(node);
    }
  }
  flush();
  return joinMarkdown(chunks.filter(Boolean), '\n\n');
}

function zipFiles(files) {
  const bytes = zipSync(files, zipOptions);
  return new Blob([bytes], { type: 'application/zip' });
}

function attachmentManifest(snapshot) {
  const referenced = visitedAssets(snapshot.blocks);
  const included = snapshot.assets.filter((asset) => referenced.has(asset.path)).map(({ path }) => path);
  const unreferenced = snapshot.assets.filter((asset) => !referenced.has(asset.path)).map(({ path }) => path);
  const diagnostics = new Map();
  const missing = new Set();
  for (const { code, label } of snapshot.warnings) {
    diagnostics.set(code, (diagnostics.get(code) ?? 0) + 1);
    if (label) missing.add(code + ': ' + label);
  }
  return strToU8([
    '已打包且在正文中引用', ...included, ...(included.length ? [] : ['（无）']),
    '', '已打包但正文未引用', ...unreferenced, ...(unreferenced.length ? [] : ['（无）']),
    '', '缺失、无效或未转换的项目', ...[...diagnostics].map(([code, count]) => code + ': ' + count), ...missing,
    ...(diagnostics.size ? [] : ['（无）']), '',
  ].join('\n'));
}

export async function renderFile(kind, snapshot) {
  const file = safeStem(snapshot.title);
  if (kind === 'html') {
    return {
      filename: file + '.html',
      blob: new Blob([standaloneHtml(snapshot, maxOutputSize)], { type: 'text/html;charset=utf-8' }),
    };
  }
  if (kind === 'markdown' || kind === 'attachments') return renderBundle([kind], snapshot);
  throw new Error('不支持此导出格式。');
}

// 直接写最终归档；清单取自实际写入的字节。
export function renderBundle(kinds, snapshot, extraFiles = []) {
  const selected = new Set(kinds);
  if (!Array.isArray(extraFiles)) throw new Error('附加文件需要安全的根目录文件名和字节数据。');
  for (const extra of extraFiles) {
    const name = extra?.name;
    if (typeof name !== 'string' || !name || name !== name.normalize('NFC') || Array.from(name).length > 160 ||
      /[\\/:*?"<>|\x00-\x1f\x7f-\x9f\u2028-\u202e\u2066-\u2069]/u.test(name) ||
      /^[.\s]+$|[. ]$/u.test(name) ||
      /^(?:con|prn|aux|nul|com[1-9¹²³]|lpt[1-9¹²³])(?:\.|$)/iu.test(name) ||
      !(extra.bytes instanceof Uint8Array)) {
      throw new Error('附加文件需要安全的根目录文件名和字节数据。');
    }
  }
  if ((!selected.size && !extraFiles.length) ||
    [...selected].some(kind => !['markdown', 'html', 'attachments'].includes(kind))) {
    throw new Error('不支持此导出格式。');
  }
  const file = safeStem(snapshot.title);
  const files = Object.create(null);
  const paths = new Map();
  let totalBytes = 0;
  function addFile(name, bytes) {
    const parts = name.split('/');
    let prefix = '';
    for (let index = 0; index < parts.length; index++) {
      prefix += (index ? '/' : '') + parts[index];
      const key = prefix.normalize('NFC').toLowerCase();
      const directory = index < parts.length - 1;
      const previous = paths.get(key);
      if (previous && (previous.name !== prefix || !previous.directory || !directory)) {
        throw new Error('归档中的文件名重复或与目录冲突。');
      }
      if (!previous) paths.set(key, {name:prefix,directory});
    }
    totalBytes += bytes.length;
    if (totalBytes > maxOutputSize) throw outputLimit();
    files[name] = bytes;
  }
  let referenced;
  if (selected.has('markdown')) {
    const lookup = new Map(snapshot.assets.map(asset => [asset.path, asset]));
    referenced = visitedAssets(snapshot.blocks);
    addFile(file + '.md', strToU8(markdownFlow(exportBlocks(snapshot), lookup) + '\n'));
  }
  if (selected.has('html')) addFile(file + '.html', strToU8(standaloneHtml(snapshot, maxOutputSize)));
  if (selected.has('attachments')) addFile('manifest.txt', attachmentManifest(snapshot));
  for (const asset of snapshot.assets) {
    if (selected.has('attachments') || referenced?.has(asset.path)) addFile(asset.path, asset.bytes);
  }
  for (const extra of extraFiles) addFile(extra.name, extra.bytes);
  const suffix = selected.size === 1 && !extraFiles.length ?
    { markdown: 'Markdown', attachments: '素材包', html: 'HTML' }[kinds[0]] : '导出';
  const blob = zipFiles(files);
  if (blob.size > maxOutputSize) throw outputLimit();
  return {
    filename: file + '-' + suffix + '.zip',
    blob,
    entries: Object.entries(files).map(([name, bytes]) => ({ name, bytes: bytes.length })),
  };
}
