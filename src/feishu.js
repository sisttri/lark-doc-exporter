// 采集 JSON → 标准 HTML 转换器。
// 输入是 页面采集器 生成的 capture 对象；输出是 importer.js 可直接导入的
// 完整 HTML 文档。纯函数：不读写文件、不访问网络、不产生时间戳，相同输入输出完全一致。
import { parseFragment } from 'parse5';
import { warningMarker } from './shared.js';
import { cellStyleText, columnGroupHtml, isAuxiliaryTable, logicalTableRows, readCellStyle, readTableColumnWidths } from './table-style.js';

const ZERO_WIDTH = /[\u200b\ufeff\u2060]/gu;
const MIME_EXTENSIONS = Object.freeze({
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
});
const RASTER_EXTENSIONS = new Set(['png', 'jpg', 'gif', 'webp']);
const HEADING_TYPE = /^heading([1-6])$/u;
const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const CELL_BLOCK_TYPES = new Set([
  'text', 'bullet', 'ordered', 'code', 'image', 'whiteboard', 'quote', 'callout', 'quote_container', 'synced_reference', 'divider', 'todo',
  'heading1', 'heading2', 'heading3', 'heading4', 'heading5', 'heading6', 'file',
]);
const LANGUAGE_ALIASES = Object.freeze({
  'plain text': 'text',
  plaintext: 'text',
  纯文本: 'text',
  'c++': 'cpp',
  'c#': 'csharp',
  'f#': 'fsharp',
  'objective-c': 'objectivec',
  proto: 'protobuf',
  golang: 'go',
  py: 'python',
  js: 'javascript',
  ts: 'typescript',
  yml: 'yaml',
  md: 'markdown',
  shell: 'bash',
  shellscript: 'bash',
});

/** HTML 文本转义（正文与属性共用；单双引号一并转义，输出可预测）。 */
function escapeText(value) {
  return String(value).replace(/[&<>"']/gu, (character) => ESCAPES[character]);
}

/** 去掉飞书 DOM 里的零宽占位字符。 */
function cleanText(value) {
  return String(value ?? '').replace(ZERO_WIDTH, '');
}

/** 读取节点属性（忽略命名空间属性）。 */
function nodeAttr(node, name) {
  return node.attrs?.find((item) => item.name === name && !item.namespace)?.value ?? '';
}

/** 节点 class 是否包含给定 token。 */
function hasClass(node, name) {
  return nodeAttr(node, 'class').split(/\s+/u).includes(name);
}

function isHidden(node) {
  return node.attrs?.some(({name, value}) => name === 'hidden' || (name === 'aria-hidden' && value === 'true')) ||
    /(?:^|;)\s*(?:display\s*:\s*none|visibility\s*:\s*hidden)(?:\s*!important)?\s*(?:;|$)/iu.test(nodeAttr(node, 'style')) ||
    ['doc-cover-toolbar', 'docx-popup-container', 'layer-popup'].some(name => hasClass(node, name));
}

function hasFinalDisplayNone(style) {
  // Unknown escaping/comments cannot establish that a source cell is absent.
  if (/\\|\/\*/u.test(style)) return false;
  let display = '', important = false, start = 0, depth = 0, quote = '';
  for (let index = 0; index <= style.length; index++) {
    const char = style[index];
    if (quote) { if (char === quote) quote = ''; continue; }
    if (char === '"' || char === "'") { quote = char; continue; }
    if (char && '([{'.includes(char)) depth++;
    if (char && ')]}'.includes(char) && --depth < 0) return false;
    if (index !== style.length && (char !== ';' || depth)) continue;
    const match = /^\s*display\s*:\s*(.*?)\s*$/iu.exec(style.slice(start, index));
    start = index + 1;
    if (!match) continue;
    const priority = /!\s*important\s*$/iu.test(match[1]);
    if (important && !priority) continue;
    display = match[1].replace(/!\s*important\s*$/iu, '').trim().toLowerCase();
    important = priority;
  }
  return !quote && !depth && display === 'none';
}

function isHiddenOrControl(node) {
  return ['button', 'input', 'textarea', 'select', 'svg', 'script', 'style', 'template'].includes(node.tagName) || isHidden(node) ||
    hasClass(node, 'fold-handler-wrapper') || hasClass(node, 'fold-handler');
}

// Keep unknown inline graphics visible as text, without importing active SVG/MathML.
function normalizeRichContent(root, blockId, addWarning) {
  let position = 0;
  function accessibleText(node) {
    const explicit = ['data-latex', 'data-tex', 'data-formula', 'aria-label', 'alt']
      .map(name => nodeAttr(node, name)).find(value => value.trim());
    const annotation = findFirstElement(node, child => child.tagName === 'annotation' &&
      /^(?:application\/x-tex|text\/x-tex)$/iu.test(nodeAttr(child, 'encoding')));
    const title = findFirstElement(node, child => child.tagName === 'title');
    return cleanText(explicit || (annotation ? textContent(annotation) : '') ||
      (title ? textContent(title) : '') || (node.tagName === 'math' ? textContent(node) : ''))
      .replace(/\s+/gu, ' ').trim().slice(0, 2048);
  }
  function visit(node) {
    if (nodeAttr(node, 'data-block-type') === 'whiteboard') return;
    for (let index = 0; index < (node.childNodes || []).length; index++) {
      const child = node.childNodes[index];
      if (!child.tagName || isHidden(child)) continue;
      if (['button','toolbar','menu','menuitem'].includes(nodeAttr(child, 'role'))) continue;
      if (child.tagName !== 'svg' && isHiddenOrControl(child)) continue;
      const formula = child.tagName === 'math' || nodeAttr(child, 'role') === 'math' ||
        ['data-latex','data-tex','data-formula'].some(name => nodeAttr(child, name).trim());
      const graphic = child.tagName === 'svg';
      if (graphic && !formula && (nodeAttr(child, 'role') === 'presentation' || nodeAttr(child, 'data-icon') ||
        /(?:^|\s)(?:[\w-]*-)?icon(?:-[\w-]+)?(?:\s|$)/iu.test(nodeAttr(child, 'class')))) continue;
      if (formula || graphic) {
        const label = accessibleText(child);
        const kind = formula ? '公式' : '行内图形';
        addWarning('unsupported_block', '块 ' + blockId + ' 中的第 ' + ++position + ' 处' + kind + (label ? '已转为文字说明，请核对' : '未能转换'));
        child.parentNode = null;
        node.childNodes[index] = {nodeName:'#text',value:label ? '[' + kind + '文字说明：' + label + ']' : '[未转换的' + kind + ']',parentNode:node};
      } else visit(child);
    }
  }
  visit(root);
}

/** 直接子元素节点（跳过文本、注释）。 */
function childElements(node) {
  return (node.childNodes ?? []).filter((child) => typeof child.tagName === 'string');
}

/** 深度优先按文档顺序查找第一个匹配元素。 */
function findFirstElement(node, predicate) {
  for (const child of childElements(node)) {
    if (predicate(child)) return child;
    const found = findFirstElement(child, predicate);
    if (found) return found;
  }
  return null;
}

/** 深度优先按文档顺序收集所有匹配元素。 */
function collectElements(node, predicate) {
  const result = [];
  const walk = (current) => {
    for (const child of childElements(current)) {
      if (predicate(child)) result.push(child);
      walk(child);
    }
  };
  walk(node);
  return result;
}

/** 拼接节点纯文本（去掉零宽字符）。 */
function textContent(node) {
  if (node.nodeName === '#text') return cleanText(node.value ?? '');
  return (node.childNodes ?? []).map(textContent).join('');
}

/**
 * 收集块内所有 .ace-line（文档顺序）。飞书文本可能拆成多行；表格单元格等
 * 嵌套结构里也可能出现，因此按深度优先顺序收集。
 */
function collectAceLines(node) {
  return collectElements(node, (element) => hasClass(element, 'ace-line'));
}

/** 解析单个根级块 HTML，返回第一个元素节点；解析失败返回 null。 */
function parseBlock(html) {
  if (typeof html !== 'string' || !html.trim()) return null;
  const fragment = parseFragment(html, { scriptingEnabled: false });
  return fragment.childNodes.find((node) => typeof node.tagName === 'string') ?? null;
}

/** 解析内联样式，返回需要包裹的标签名（外层在前）。 */
function styleWrappers(style, suppressBold) {
  if (!style) return [];
  const declarations = new Map();
  for (const part of style.split(';')) {
    const separator = part.indexOf(':');
    if (separator < 0) continue;
    const name = part.slice(0, separator).trim().toLowerCase();
    const value = part.slice(separator + 1).trim().toLowerCase();
    if (name && value) declarations.set(name, value);
  }
  const wrappers = [];
  const weight = declarations.get('font-weight') ?? '';
  if (!suppressBold && /^(?:bold|bolder|[6-9]\d\d)$/u.test(weight)) wrappers.push('strong');
  const fontStyle = declarations.get('font-style') ?? '';
  if (/^(?:italic|oblique)$/u.test(fontStyle)) wrappers.push('em');
  const decoration = (declarations.get('text-decoration') ?? '') + ' ' + (declarations.get('text-decoration-line') ?? '');
  if (/\bunderline\b/u.test(decoration)) wrappers.push('u');
  if (/\bline-through\b/u.test(decoration)) wrappers.push('s');
  return wrappers;
}

/** 只保留 http/https/mailto 且可被 importer 正常保留的链接。 */
function safeHref(raw) {
  const value = String(raw ?? '').trim();
  if (!/^(?:https?:\/\/|mailto:)/iu.test(value)) return '';
  if (/[\u0000-\u001f\u007f\\]/u.test(value)) return '';
  try {
    const url = new URL(value);
    return url.username || url.password ? '' : url.href;
  } catch {
    return '';
  }
}

/** 把代码块语言名规范化为 class 后缀。 */
function normalizeLanguage(raw) {
  const name = cleanText(raw ?? '').trim().toLowerCase();
  if (!name) return '';
  if (LANGUAGE_ALIASES[name]) return LANGUAGE_ALIASES[name];
  const slug = name
    .replace(/\+/gu, 'p')
    .replace(/#/gu, 'sharp')
    .replace(/[^a-z0-9]+/gu, '-')
    .replace(/^-+|-+$/gu, '');
  return /^[a-z][a-z0-9-]*$/u.test(slug) ? slug : '';
}

/** 将内联节点递归转换为 HTML；未知元素解包，保留文本与支持的样式/链接。 */
function renderInline(nodes, suppressBold) {
  let html = '';
  for (const node of nodes ?? []) html += renderInlineNode(node, suppressBold);
  // 飞书分词会把同一个删除线范围拆成多个叶子；文本已转义，此处只有生成的标签会匹配。
  return html.replaceAll('</s><s>', '');
}

function renderInlineNode(node, suppressBold) {
  if (node.nodeName === '#text') {
    const text = cleanText(node.value ?? '');
    return text ? escapeText(text) : '';
  }
  const tag = typeof node.tagName === 'string' ? node.tagName : '';
  if (!tag) return renderInline(node.childNodes, suppressBold);
  if (isHiddenOrControl(node)) return '';
  if (tag === 'br') return '<br>';
  if (tag === 'img') {
    // 行内表情：只保留 alt 文本；没有 alt 时丢弃。
    const alt = cleanText(nodeAttr(node, 'alt')).trim();
    return alt ? escapeText(alt) : '';
  }
  const content = renderInline(node.childNodes, suppressBold);
  if (tag === 'a') {
    const href = safeHref(nodeAttr(node, 'href'));
    return href ? '<a href="' + escapeText(href) + '">' + content + '</a>' : content;
  }
  let wrapped = content;
  const wrappers = styleWrappers(nodeAttr(node, 'style'), suppressBold);
  for (let index = wrappers.length - 1; index >= 0; index--) {
    wrapped = '<' + wrappers[index] + '>' + wrapped + '</' + wrappers[index] + '>';
  }
  return wrapped;
}

/** 渲染块内所有非空行，行间用 join 连接。 */
function renderLines(element, { suppressBold = false, join = '<br>' } = {}) {
  const lines = [];
  for (const line of collectAceLines(element)) {
    const html = renderInline(line.childNodes, suppressBold);
    if (html.replace(/<[^>]*>/gu, '').trim()) lines.push(html);
  }
  return lines.join(join);
}

/** 内容是否为空（转义后的实体保留为可见文本）。 */
function hasVisibleContent(html) {
  return html.replace(/<[^>]*>/gu, '').trim() !== '';
}

/** 收集单元格内的块（文档顺序，遇表格嵌套停止）。 */
function collectCellBlocks(cell, addWarning) {
  const infos = [];
  const walk = (node) => {
    for (const child of childElements(node)) {
      const type = nodeAttr(child, 'data-block-type');
      if (type === 'table') {
        addWarning('unsupported_block', '表格内嵌套表格未转换');
        continue;
      }
      if (CELL_BLOCK_TYPES.has(type)) {
        infos.push({ id: nodeAttr(child, 'data-block-id'), type, element: child });
        continue;
      }
      walk(child);
    }
  };
  walk(cell);
  return infos;
}

/** 判断片段是否是块级内容（用于单元格内的分隔策略）。 */
function isBlockFragment(html) {
  return /^<(?:p|pre|ul|ol|table|blockquote|h[1-6]|hr|figure|div|section|article)(?:[\s>])/u.test(html);
}

/** 单元格内多个块用 br 或块级标签自然连接。 */
function joinCellFragments(fragments) {
  let result = '';
  let previousBlock = null;
  for (const fragment of fragments) {
    const block = isBlockFragment(fragment);
    if (result && previousBlock === false && block === false) result += '<br>';
    result += fragment;
    previousBlock = block;
  }
  return result;
}

/** 检查 todo 块是否已勾选（兼容 aria/data 属性与常见状态 class）。 */
function detectChecked(element) {
  const checkedClass = /^(?:is-|todo-|checkbox-)*(?:checked|done|completed)$/u;
  const checkNode = (node) => {
    for (const { name, value } of node.attrs ?? []) {
      if (name === 'checked') return true;
      if (['aria-checked', 'data-checked', 'data-done'].includes(name) &&
        /^(?:true|1|checked|done)$/iu.test(value.trim())) return true;
      if (name === 'class') {
        for (const token of value.split(/\s+/u)) {
          if (checkedClass.test(token.toLowerCase().replace(/--+/gu, '-'))) return true;
        }
      }
    }
    if (node.tagName === 'input' && nodeAttr(node, 'type').toLowerCase() === 'checkbox' &&
      node.attrs?.some(({ name }) => name === 'checked')) return true;
    return childElements(node).some(checkNode);
  };
  return checkNode(element);
}

/** 规范化 capture.warnings：只接受 {code, label} 字符串。 */
function normalizeWarnings(warnings) {
  if (!Array.isArray(warnings)) return [];
  const result = [];
  for (const item of warnings) {
    if (!item || typeof item !== 'object') continue;
    const code = typeof item.code === 'string' ? item.code.trim() : '';
    if (!code) continue;
    const label = typeof item.label === 'string' ? item.label.trim() : '';
    result.push(label ? { code, label } : { code });
  }
  return result;
}

/** 去除完全重复的 warning，保持首次出现顺序。 */
function dedupeWarnings(warnings) {
  const seen = new Set();
  const result = [];
  for (const item of warnings) {
    const label = typeof item.label === 'string' ? item.label : '';
    const key = item.code + '\u0000' + label;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(label ? { code: item.code, label } : { code: item.code });
  }
  return result;
}

/**
 * 图片素材在标准 HTML 中的相对路径：images/<blockId>.<ext>。
 * 扩展名优先由 MIME 映射；未知 MIME 退回 capture file 的扩展名，再退回 png。
 */
export function imageHtmlPath(image) {
  const blockId = String(image?.blockId ?? '').replace(/[^0-9A-Za-z_-]+/gu, '') || 'image';
  const mime = String(image?.mime ?? '').split(';', 1)[0].trim().toLowerCase();
  let extension = MIME_EXTENSIONS[mime];
  if (!extension) {
    const match = /\.([A-Za-z0-9]+)$/u.exec(String(image?.file ?? ''));
    const candidate = match ? match[1].toLowerCase() : '';
    extension = RASTER_EXTENSIONS.has(candidate) ? candidate : 'png';
  }
  return 'images/' + blockId + '.' + extension;
}

/**
 * 把采集 JSON 转换为完整、独立、可被 importer 导入的 HTML。
 * @param {object} capture capture.json 解析结果
 * @returns {{ title: string, html: string, warnings: Array<{code: string, label?: string}> }}
 */
export function convertCapture(capture) {
  if (!capture || typeof capture !== 'object') throw new TypeError('capture 必须是对象。');
  if (!Array.isArray(capture.blocks)) throw new TypeError('capture.blocks 必须是数组。');

  const warnings = [];
  const checkedCodeLines = new Map();
  const unsupportedTypes = new Set();
  const convertedContainers = new Set();
  const addWarning = (code, label) => {
    if (label) warnings.push({ code, label });
    else warnings.push({ code });
  };

  const codeMap = capture.code && typeof capture.code === 'object' ? capture.code : {};
  const imageByBlock = new Map();
  for (const image of Array.isArray(capture.images) ? capture.images : []) {
    if (image && image.blockId != null) imageByBlock.set(String(image.blockId), image);
  }

  function renderSequence(infos) {
    const fragments = [];
    for (let index = 0; index < infos.length;) {
      const { type } = infos[index];
      if (type === 'bullet' || type === 'ordered') {
        const items = [];
        while (index < infos.length && infos[index].type === type) items.push(infos[index++]);
        const list = renderList(type, items);
        if (list) fragments.push(list);
        continue;
      }
      const html = renderBlock(infos[index]);
      if (html) fragments.push(html);
      index++;
    }
    return fragments;
  }

  function renderList(kind, infos) {
    const tag = kind === 'ordered' ? 'ol' : 'ul';
    let start = null;
    if (kind === 'ordered') {
      const order = findFirstElement(infos[0].element, (element) => hasClass(element, 'order'));
      const number = order ? Number.parseInt(textContent(order).trim(), 10) : Number.NaN;
      if (Number.isInteger(number) && number !== 1) start = number;
    }
    const items = [];
    for (const info of infos) {
      const content = renderLines(info.element);
      if (hasVisibleContent(content)) items.push('<li>' + content + '</li>');
    }
    if (!items.length) return null;
    return '<' + tag + (start === null ? '' : ' start="' + start + '"') + '>' + items.join('') +
      '</' + tag + '>';
  }

  function renderHeading(info, level) {
    const order = findFirstElement(info.element, (element) => hasClass(element, 'heading-order'));
    const orderText = order ? cleanText(textContent(order)).replace(/\s+/gu, ' ').trim() : '';
    // 飞书标题默认整段加粗，标题内忽略 font-weight:bold，避免导出成多余的行内粗体。
    const content = renderLines(info.element, { suppressBold: true, join: ' ' });
    const parts = [];
    if (orderText) parts.push(escapeText(orderText));
    if (content) parts.push(content);
    const heading = parts.join(' ');
    return heading ? '<h' + level + '>' + heading + '</h' + level + '>' : null;
  }

  function renderText(info) {
    const content = renderLines(info.element);
    return content ? '<p>' + content + '</p>' : null;
  }

  function renderQuote(info) {
    const content = renderLines(info.element);
    return content ? '<blockquote><p>' + content + '</p></blockquote>' : null;
  }

  function renderContainer(info) {
    convertedContainers.add(info.type);
    const children = [];
    function visit(node) {
      for (const child of childElements(node)) {
        if (isHiddenOrControl(child)) continue;
        const type = nodeAttr(child, 'data-block-type');
        if (type && type !== 'page') {
          children.push({id:nodeAttr(child, 'data-block-id'), type, element:child});
        } else visit(child);
      }
    }
    visit(info.element);
    if (!children.length) {
      if (info.type === 'quote_container') {
        const content = renderQuote(info);
        if (content) return content;
      }
      const label = info.type === 'quote_container' ? '引用容器 ' : '同步块 ';
      addWarning('unsupported_block', label + info.id + ' 尚未读取到已渲染正文');
      return null;
    }
    const content = renderSequence(children).join('');
    return info.type === 'quote_container' ? '<blockquote>' + content + '</blockquote>' : content || null;
  }

  function renderTodo(info) {
    const content = renderLines(info.element);
    if (!content) return null;
    return '<p>' + (detectChecked(info.element) ? '☑ ' : '☐ ') + content + '</p>';
  }

  function renderCode(info) {
    const record = codeMap[info.id];
    const lines = Array.isArray(record?.lines) ? record.lines : [];
    if (!lines.length) {
      const label = '代码块 ' + info.id + ' 缺少内容';
      addWarning('missing_code', label);
      return '<p>[' + escapeText(label) + ']</p>';
    }
    const ordered = lines.map((line, index) => {
      const num = Number(line?.num);
      return {
        num: Number.isSafeInteger(num) && num >= 1 ? num : index + 1,
        index,
        text: cleanText(line?.text ?? ''),
      };
    }).sort((first, second) => first.num - second.num || first.index - second.index);
    const button = findFirstElement(info.element, (element) => hasClass(element, 'code-block-header-btn'));
    const language = normalizeLanguage(button ? textContent(button) : '');
    const classAttribute = language ? ' class="language-' + language + '"' : '';
    const pieces = [];
    let run = [];
    function flush() {
      if (run.length) pieces.push('<pre><code' + classAttribute + '>' + run.join('\n') + '</code></pre>');
      run = [];
    }
    function missing(first, last) {
      flush();
      const range = first === last ? String(first) : first + '–' + last;
      const label = '代码块 ' + info.id + ' 缺少第 ' + range + ' 行';
      addWarning('code_lines_missing', label);
      pieces.push('<p>[' + escapeText(label) + ']</p>');
    }
    let next = 1;
    for (const line of ordered) {
      if (line.num > next) missing(next, line.num - 1);
      run.push(escapeText(line.text));
      next = line.num + 1;
    }
    const last = Number.isSafeInteger(record.totalLines) ? Math.max(record.totalLines, next - 1) : next - 1;
    if (next <= last) missing(next, last);
    checkedCodeLines.set(info.id, last);
    flush();
    return pieces.join('');
  }

  // 飞书给图片生成的样板 alt（如 "Feishu Docs - Image"）不是正文内容，导出时清空。
  function sanitizeImageAlt(value) {
    const alt = cleanText(value ?? "").replace(/\s+/gu, " ").trim();
    if (!alt) return "";
    if (/^feishu docs\s*[-–—]\s*image(?:\s*\d+)?$/iu.test(alt)) return "";
    if (alt === "图片" || alt === "Image") return "";
    return alt;
  }

  function renderImage(info) {
    const image = imageByBlock.get(info.id);
    const label = info.type === 'whiteboard' ? '白板块 ' : '图片块 ';
    if (!image) {
      addWarning('missing_image', label + info.id + ' 缺少素材');
      return null;
    }
    const mime = String(image.mime ?? '').split(';', 1)[0].trim().toLowerCase();
    if (mime && !MIME_EXTENSIONS[mime]) {
      addWarning('invalid_image', label + info.id + ' 的 MIME 类型不受支持：' + mime);
    }
    let alt = sanitizeImageAlt(image.alt);
    if (!alt && info.type === 'whiteboard') alt = '白板静态预览（当前画面）';
    if (!alt) {
      const element = findFirstElement(info.element, (node) => node.tagName === 'img');
      alt = sanitizeImageAlt(element ? nodeAttr(element, 'alt') : '');
    }
    return '<img src="' + escapeText(imageHtmlPath(image)) + '" alt="' + escapeText(alt) + '">';
  }

  function renderFile(info) {
    convertedContainers.add('file');
    function visibleText(node) {
      if (node.nodeName === '#text') return cleanText(node.value || '');
      if (isHiddenOrControl(node) || ['button','toolbar','menu','menuitem'].includes(nodeAttr(node, 'role'))) return '';
      return (node.childNodes || []).map(visibleText).join('');
    }
    const links = [];
    function visit(node) {
      if (isHiddenOrControl(node) || ['button','toolbar','menu','menuitem'].includes(nodeAttr(node, 'role'))) return;
      if (node.tagName === 'a') {
        const href = safeHref(nodeAttr(node, 'href'));
        if (/^https?:\/\//iu.test(href)) {
          const name = visibleText(node).replace(/\s+/gu,' ').trim().slice(0,2048) || '附件链接';
          links.push('<a href="' + escapeText(href) + '">' + escapeText(name) + '</a>');
          return;
        }
      }
      for (const child of childElements(node)) visit(child);
    }
    visit(info.element);
    const name = visibleText(info.element).replace(/\s+/gu,' ').trim().slice(0,2048) || '附件';
    addWarning('missing_attachment', '附件块 ' + info.id + ' 原件未采集，仅保留文件名和可用链接');
    return '<p>' + (links.length ? links.join('、') : escapeText(name)) + ' [原件未采集]</p>';
  }

  function renderCellBlock(info) {
    switch (info.type) {
      case 'text': return renderLines(info.element) || null;
      case 'bullet':
      case 'ordered': return renderList(info.type, [info]);
      case 'code': return renderCode(info);
      case 'image':
      case 'whiteboard': return renderImage(info);
      case 'file': return renderFile(info);
      case 'quote':
      case 'callout': return renderQuote(info);
      case 'quote_container':
      case 'synced_reference': return renderContainer(info);
      case 'divider': return '<hr>';
      case 'todo': return renderTodo(info);
      default: {
        const heading = HEADING_TYPE.exec(info.type);
        if (heading) {
          // 单元格内的标题只保留强调语义，不引入块级标题层级。
          const content = renderLines(info.element, { suppressBold: true, join: ' ' });
          return content ? '<strong>' + content + '</strong>' : null;
        }
        addWarning('unsupported_block', '未适配的单元格块类型：' + (info.type || '(空)'));
        return null;
      }
    }
  }

  function renderCellSequence(infos) {
    const fragments = [];
    for (let index = 0; index < infos.length;) {
      const { type } = infos[index];
      if (type === 'bullet' || type === 'ordered') {
        const items = [];
        while (index < infos.length && infos[index].type === type) items.push(infos[index++]);
        const list = renderList(type, items);
        if (list) fragments.push(list);
        continue;
      }
      const html = renderCellBlock(infos[index]);
      if (html) fragments.push(html);
      index++;
    }
    return fragments;
  }

  function renderTableCell(cell) {
    const tag = cell.tagName === 'th' ? 'th' : 'td';
    let attributes = '';
    for (const span of ['colspan', 'rowspan']) {
      const value = Number.parseInt(nodeAttr(cell, span), 10);
      if (Number.isInteger(value) && value >= 2) attributes += ' ' + span + '="' + value + '"';
    }
    const style = cellStyleText(readCellStyle(nodeAttr(cell, 'style'), {
      align:nodeAttr(cell, 'align'),valign:nodeAttr(cell, 'valign'),bgcolor:nodeAttr(cell, 'bgcolor'),
    }));
    if (style) attributes += ' style="' + style + '"';
    const blocks = collectCellBlocks(cell, addWarning);
    let content;
    if (blocks.length) content = joinCellFragments(renderCellSequence(blocks));
    else content = renderLines(cell) || renderInline(cell.childNodes, false);
    return '<' + tag + attributes + '>' + content + '</' + tag + '>';
  }

  function renderTable(info) {
    function findTable(node) {
      if (node.tagName === 'table') return isAuxiliaryTable(node) ? null : node;
      for (const child of childElements(node)) {
        const found = findTable(child);
        if (found) return found;
      }
      return null;
    }
    const table = findTable(info.element);
    if (!table) {
      addWarning('unsupported_block', '表格块 ' + info.id + ' 无法解析');
      return null;
    }
    function renderRow(row) {
      const cells = childElements(row).filter((cell) =>
        (cell.tagName === 'td' || cell.tagName === 'th') &&
        !cell.attrs?.some(({name, value}) => name === 'hidden' || (name === 'aria-hidden' && value === 'true')) &&
        !hasFinalDisplayNone(nodeAttr(cell, 'style')));
      return cells.length ? '<tr>' + cells.map(renderTableCell).join('') + '</tr>' : '';
    }
    const parts = [];
    for (const child of childElements(table)) {
      if (child.tagName === 'caption') {
        const content = renderLines(child) || renderInline(child.childNodes, false);
        parts.push('<caption>' + content + '</caption>');
      }
    }
    let group, section, rowParts = [];
    function flushRows() {
      if (rowParts.length) parts.push('<' + section + '>' + rowParts.join('') + '</' + section + '>');
      rowParts = [];
    }
    for (const entry of logicalTableRows(info.element, table)) {
      if (group !== entry.group || section !== entry.section) flushRows();
      group = entry.group; section = entry.section;
      const rendered = renderRow(entry.row);
      if (rendered) rowParts.push(rendered);
    }
    flushRows();
    const content = parts.join('');
    const columns = columnGroupHtml(readTableColumnWidths(table));
    return content ? '<table' + (columns ? ' style="table-layout:fixed;width:100%;overflow-wrap:anywhere"' : '') + '>' + columns + content + '</table>' : null;
  }

  function renderBlock(info) {
    const heading = HEADING_TYPE.exec(info.type);
    if (heading) return renderHeading(info, Number(heading[1]));
    switch (info.type) {
      case 'text': return renderText(info);
      case 'code': return renderCode(info);
      case 'image':
      case 'whiteboard': return renderImage(info);
      case 'file': return renderFile(info);
      case 'table': return renderTable(info);
      case 'quote':
      case 'callout': return renderQuote(info);
      case 'quote_container':
      case 'synced_reference': return renderContainer(info);
      case 'divider': return '<hr>';
      case 'todo': return renderTodo(info);
      default:
        unsupportedTypes.add(info.type);
        addWarning('unsupported_block', '块 ' + (info.id || '(无 id)') + ' 未转换（' + (info.type || '(空)') + '）');
        return null;
    }
  }

  const infos = [];
  for (const block of capture.blocks) {
    if (!block || typeof block !== 'object') {
      addWarning('unsupported_block', '存在无法识别的块');
      continue;
    }
    const type = typeof block.type === 'string' ? block.type : '';
    const id = String(block.id ?? '');
    const element = parseBlock(block.html);
    if (!element) {
      addWarning('unsupported_block', '块 ' + (id || '(无 id)') + ' 无法解析');
      continue;
    }
    if (type !== 'whiteboard') normalizeRichContent(element, id, addWarning);
    infos.push({ id, type, element });
  }

  const rawTitle = cleanText(capture.source?.title ?? '').replace(/\s+/gu, ' ').trim();
  const title = rawTitle || '文档';
  const body = renderSequence(infos).join('');
  // 旧采集器只列前若干缺行、按类型汇总未知块。对于已复核的范围使用逐块、逐段结果。
  const captureWarnings = normalizeWarnings(capture.warnings).filter(({code, label = ''}) => {
    if (code === 'unsupported_block' && label.startsWith('未适配的块类型：')) {
      const type = label.slice('未适配的块类型：'.length);
      return !unsupportedTypes.has(type) && !convertedContainers.has(type);
    }
    if (code === 'code_lines_missing') {
      const summary = /^代码块 (\S+) 缺少行 ([0-9,、– -]+)$/u.exec(label);
      if (summary && checkedCodeLines.has(summary[1])) {
        const checked = checkedCodeLines.get(summary[1]);
        return summary[2].match(/\d+/gu)?.some(value => Number(value) > checked);
      }
    }
    return true;
  });
  const allWarnings = dedupeWarnings([...captureWarnings, ...warnings]);
  const metadata = allWarnings.length ?
    '<meta name="' + warningMarker + '" content="' + escapeText(JSON.stringify(allWarnings)) + '">' : '';
  const html = '<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8"><title>' +
    escapeText(title) + '</title>' + metadata + '</head><body><h1>' + escapeText(title) + '</h1>' + body +
    '</body></html>';
  return { title, html, warnings: allWarnings };
}
