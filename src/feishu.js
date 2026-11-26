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
  'image/svg+xml': 'svg',
});
const RASTER_EXTENSIONS = new Set(['png', 'jpg', 'gif', 'webp']);
const HEADING_TYPE = /^heading([1-6])$/u;
const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const CELL_BLOCK_TYPES = new Set([
  'text', 'bullet', 'ordered', 'code', 'image', 'whiteboard', 'diagram', 'quote', 'callout', 'quote_container', 'synced_reference', 'view', 'grid', 'grid_column', 'divider', 'todo',
  'heading1', 'heading2', 'heading3', 'heading4', 'heading5', 'heading6', 'file', 'isv',
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
    if (['whiteboard','diagram','file'].includes(nodeAttr(node, 'data-block-type'))) return;
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
  const equation=nodeAttr(node,'data-export-equation');
  if(equation) {
    return '<span data-export-equation="'+escapeText(equation)+'" data-export-display="'+
      (nodeAttr(node,'data-export-display')==='block'?'block':'inline')+'">'+escapeText(equation)+'</span>';
  }
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
  const semanticTags={b:'strong',strong:'strong',i:'em',em:'em',u:'u',s:'s',del:'s',strike:'s',code:'code',sup:'sup',sub:'sub'};
  const semanticTag=Object.hasOwn(semanticTags,tag)?semanticTags[tag]:null;
  if(semanticTag && !(suppressBold && semanticTag==='strong') && !wrappers.includes(semanticTag)) wrappers.unshift(semanticTag);
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
      if (isHiddenOrControl(child)) continue;
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

export function attachmentHtmlPath(attachment) {
  const rawId=String(attachment?.blockId ?? 'file').normalize('NFC');
  let id=rawId;
  if(!/^[A-Za-z0-9_-]{1,64}$/u.test(id)) {
    let hash=2166136261;
    for(const character of rawId) {hash=Math.imul(hash^character.codePointAt(0),16777619)>>>0;}
    id=(rawId.replace(/[^A-Za-z0-9_-]/gu,'').slice(0,48)||'file')+'-'+hash.toString(16).padStart(8,'0');
  }
  let name=String(attachment?.name ?? '附件').normalize('NFC')
    .replace(/[\u0000-\u001f\u007f-\u009f\u2028-\u202e\u2066-\u2069<>:"/\\|?*]/gu,'_')
    .replace(/^[. ]+|[. ]+$/gu,'') || '附件';
  if(/^(?:con|prn|aux|nul|com[1-9¹²³]|lpt[1-9¹²³])(?:\.|$)/iu.test(name)) name='_'+name;
  const extension=/\.[^.]{1,32}$/u.exec(name)?.[0] || '';
  const maximum=160-id.length-1;
  if(name.length>maximum) {
    let stem=name.slice(0,maximum-extension.length);
    if(/[\ud800-\udbff]$/u.test(stem)) stem=stem.slice(0,-1);
    name=stem+extension;
  }
  name=name.replace(/[. ]+$/gu,'') || '附件';
  return 'attachments/'+id+'-'+name;
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
  const attachmentByBlock=new Map();
  for(const attachment of Array.isArray(capture.attachments)?capture.attachments:[]) {
    if(attachment?.blockId!=null && attachment.bytes instanceof Uint8Array) attachmentByBlock.set(String(attachment.blockId),attachment);
  }
  const semanticByBlock=new Map(),semanticOnly=new Set();
  const semantic=capture.semantic;
  if(semantic?.version===1 && Array.isArray(semantic.blocks)) {
    if(capture.source?.docToken && semantic.recordId!==capture.source.docToken) {
      addWarning('missing_block','正文模型与采集页面不一致，未使用模型语义补充。');
    } else {
      warnings.push(...normalizeWarnings(semantic.warnings));
      for(const block of semantic.blocks) {
        if(block && typeof block.id==='string' && typeof block.type==='string' && block.ready!==false) semanticByBlock.set(block.id,block);
      }
    }
  }
  function modelFor(info) {
    const block=semanticByBlock.get(String(info.id));
    const recordId=info.element?nodeAttr(info.element,'data-record-id'):'';
    return block?.type===info.type && (!recordId || !block.recordId || recordId===block.recordId) ? block : null;
  }
  function modelInline(model,force=false) {
    const ops=Array.isArray(model?.ops)?model.ops:[];
    const special=ops.some(op=>typeof op?.attributes?.equation==='string' && op.attributes.equation || op?.attributes?.mention);
    if(!special && !force) return null;
    if(ops.some(op=>op?.attributes?.unresolvedInline===true)) {
      addWarning('unsupported_block','块 '+model.id+' 包含无法完整还原的内联组件，'+(force?'已保留可读源码和占位。':'保留页面正文，未使用模型整段替换。'));
      if(!force) return null;
    }
    if(!ops.length) return typeof model?.text==='string'?escapeText(model.text).replace(/\r?\n/gu,'<br>'):null;
    let html='';
    const enabled=value=>value!==undefined && value!==null && ![false,0,'false','0'].includes(value);
    for(const op of ops) {
      const attributes=op?.attributes || {};
      if(attributes.fixEnter!==undefined) continue;
      let piece;
      if(typeof attributes.equation==='string' && attributes.equation) {
        const latex=attributes.equation;
        piece='<span data-export-equation="'+escapeText(latex)+'" data-export-display="'+
          (attributes.display==='block'?'block':'inline')+'">'+escapeText(latex)+'</span>';
      } else {
        const mention=attributes.mention;
        const insert=typeof op?.insert==='string'?cleanText(op.insert).replace(/\ufffc/gu,attributes.unresolvedInline?'[未转换的内联内容]':''):
          attributes.unresolvedInline?'[未转换的内联内容]':'';
        const label=mention && typeof mention.title==='string' && mention.title ? mention.title:insert;
        piece=escapeText(label).replace(/\r?\n/gu,'<br>');
        if(enabled(attributes.inlineCode)) piece='<code>'+piece+'</code>';
        for(const [name,tag] of [['bold','strong'],['italic','em'],['underline','u'],['strikethrough','s']]) {
          if(enabled(attributes[name])) piece='<'+tag+'>'+piece+'</'+tag+'>';
        }
        const href=safeHref(mention?.url || attributes.link);
        if(href) piece='<a href="'+escapeText(href)+'">'+piece+'</a>';
      }
      html+=piece;
    }
    return html;
  }
  function applyModelInline(element,force=false) {
    const id=nodeAttr(element,'data-block-id'),type=nodeAttr(element,'data-block-type');
    if(nodeAttr(element,'data-export-semantic-only')==='1') semanticOnly.add(id);
    const model=modelFor({id,type,element});
    const html=modelInline(model,force || nodeAttr(element,'data-export-semantic-only')==='1');
    if(html!==null) {
      const lines=[];
      function ownLines(node) {
        for(const child of childElements(node)) {
          if(isHiddenOrControl(child) || nodeAttr(child,'data-block-type')) continue;
          if(hasClass(child,'ace-line')) lines.push(child);else ownLines(child);
        }
      }
      ownLines(element);
      if(lines.length) {
        lines[0].childNodes=parseFragment(html).childNodes;
        for(const child of lines[0].childNodes) child.parentNode=lines[0];
        for(const line of lines.slice(1)) line.childNodes=[];
      } else if(['text','bullet','ordered','todo','quote','callout'].includes(type) || HEADING_TYPE.test(type)) {
        const line=parseFragment('<div class="ace-line">'+html+'</div>').childNodes[0];
        line.parentNode=element;
        element.childNodes.unshift(line);
      }
    }
    for(const child of childElements(element)) {
      if(isHiddenOrControl(child)) continue;
      if(nodeAttr(child,'data-block-type')) applyModelInline(child);else applyModelDescendants(child);
    }
  }
  function applyModelDescendants(node) {
    for(const child of childElements(node)) {
      if(isHiddenOrControl(child)) continue;
      if(nodeAttr(child,'data-block-type')) applyModelInline(child);else applyModelDescendants(child);
    }
  }

  function listNumber(info) {
    function findOrder(node) {
      for (const child of childElements(node)) {
        if (isHiddenOrControl(child)) continue;
        const type = nodeAttr(child, 'data-block-type');
        if (type && type !== 'page') continue;
        if (hasClass(child, 'order')) return child;
        const found = findOrder(child);
        if (found) return found;
      }
      return null;
    }
    const order = findOrder(info.element);
    const number = order ? Number.parseInt(textContent(order).trim(), 10) :
      semanticOnly.has(info.id)?Number.parseInt(modelFor(info)?.seq,10):Number.NaN;
    return Number.isSafeInteger(number) ? number : null;
  }

  function renderSequence(infos, cell = false) {
    const fragments = [];
    for (let index = 0; index < infos.length;) {
      const { type } = infos[index];
      if (type === 'bullet' || type === 'ordered') {
        const items = [];
        let next = listNumber(infos[index]) ?? 1;
        while (index < infos.length && infos[index].type === type) {
          const number = type === 'ordered' ? listNumber(infos[index]) : null;
          if (items.length && number !== null && number !== next) break;
          items.push(infos[index++]);
          next++;
        }
        const list = renderList(type, items, cell);
        if (list) fragments.push(list);
        continue;
      }
      const html = cell ? renderCellBlock(infos[index]) : renderBlock(infos[index]);
      if (html) fragments.push(html);
      index++;
    }
    return fragments;
  }

  // Only descend through untyped wrappers: typed children must be dispatched as
  // blocks, rather than letting their text flatten into the parent's ace-lines.
  function contentParts(element) {
    const parts = [];
    function visit(node) {
      for (const child of childElements(node)) {
        if (isHiddenOrControl(child)) continue;
        const type = nodeAttr(child, 'data-block-type');
        if (type && type !== 'page') parts.push({id:nodeAttr(child, 'data-block-id'),type,element:child});
        else if (hasClass(child, 'ace-line')) parts.push({line:child});
        else visit(child);
      }
    }
    visit(element);
    return parts;
  }

  function renderContent(parts, cell = false, inline = false) {
    const fragments = [];
    for (let index = 0; index < parts.length;) {
      if (parts[index].line) {
        const lines = [];
        while (index < parts.length && parts[index].line) {
          const html = renderInline(parts[index++].line.childNodes, false);
          if (hasVisibleContent(html)) lines.push(html);
        }
        if (lines.length) fragments.push(inline ? lines.join('<br>') : '<p>' + lines.join('<br>') + '</p>');
      } else {
        const children = [];
        while (index < parts.length && !parts[index].line) children.push(parts[index++]);
        fragments.push(...renderSequence(children, cell));
      }
    }
    return joinCellFragments(fragments);
  }

  function renderList(kind, infos, cell = false) {
    const tag = kind === 'ordered' ? 'ol' : 'ul';
    const start = kind === 'ordered' ? listNumber(infos[0]) : null;
    const items = [];
    for (const info of infos) {
      const content = renderContent(contentParts(info.element), cell, true);
      if (content) items.push('<li>' + content + '</li>');
    }
    if (!items.length) return null;
    return '<' + tag + (start === null || start === 1 ? '' : ' start="' + start + '"') + '>' + items.join('') +
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

  function renderQuote(info, cell = false) {
    const content = renderContent(contentParts(info.element), cell);
    return content ? '<blockquote>' + content + '</blockquote>' : null;
  }

  function renderContainer(info, cell = false) {
    convertedContainers.add(info.type);
    const previousWarnings = warnings.length;
    const content = renderContent(contentParts(info.element), cell);
    if (!content && warnings.length === previousWarnings) {
      const label = info.type === 'quote_container' ? '引用容器 ' : info.type === 'view' ? '视图容器 '
        : ['grid','grid_column'].includes(info.type) ? '分栏容器 ' : '同步块 ';
      addWarning('unsupported_block', label + info.id + ' 尚未读取到已渲染正文');
      return null;
    }
    return info.type === 'quote_container' ? '<blockquote>' + content + '</blockquote>' : content || null;
  }

  function renderTodo(info) {
    const content = renderLines(info.element);
    if (!content) return null;
    const checked=semanticOnly.has(info.id)?modelFor(info)?.done===true:detectChecked(info.element);
    return '<p>' + (checked ? '☑ ' : '☐ ') + content + '</p>';
  }

  function renderCode(info) {
    const record = codeMap[info.id];
    const lines = Array.isArray(record?.lines) ? record.lines : [];
    if(!lines.length && semanticOnly.has(info.id)) {
      const model=modelFor(info);
      if(typeof model?.text==='string' && model.text) return '<pre><code>'+escapeText(model.text)+'</code></pre>';
    }
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
    const label = info.type === 'whiteboard' ? '白板块 ' : info.type === 'diagram' ? '图表块 ' : '图片块 ';
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
    if (!alt && info.type === 'diagram') alt = '图表';
    if (!alt) {
      const element = findFirstElement(info.element, (node) => node.tagName === 'img');
      alt = sanitizeImageAlt(element ? nodeAttr(element, 'alt') : '');
    }
    const html='<img src="' + escapeText(imageHtmlPath(image)) + '" alt="' + escapeText(alt) + '">';
    const caption=modelFor(info)?.caption;
    return typeof caption==='string' && caption.trim() ? '<figure>'+html+'<figcaption>'+escapeText(caption).replace(/\r?\n/gu,'<br>')+'</figcaption></figure>':html;
  }

  function renderFile(info) {
    convertedContainers.add('file');
    const attachment=attachmentByBlock.get(info.id);
    if(attachment) {
      const href=attachmentHtmlPath(attachment).split('/').map(encodeURIComponent).join('/');
      return '<p><a href="'+escapeText(href)+'" download="">'+
        escapeText(typeof attachment.name==='string' && attachment.name?attachment.name:'附件')+'</a></p>';
    }
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

  function renderSource(info) {
    const model=modelFor(info),source=model?.source;
    if(source?.language==='mermaid' && typeof source.text==='string' && source.text.trim()) {
      convertedContainers.add('isv');
      return '<pre><code class="language-mermaid">'+escapeText(source.text)+'</code></pre>';
    }
    const items=model?.timeline;
    if(Array.isArray(items) && items.length && items.every(item=>item &&
      ['time','title','text'].every(name=>typeof item[name]==='string'))) {
      convertedContainers.add('isv');
      return '<ol>'+items.map(item=>{
        const heading=[item.time,item.title].filter(Boolean).map(value=>escapeText(value).replace(/\r?\n/gu,'<br>')).join(' · ');
        const body=escapeText(item.text).replace(/\r?\n/gu,'<br>');
        return '<li>'+(heading?'<p>'+heading+'</p>':'')+(body?'<p>'+body+'</p>':'')+'</li>';
      }).join('')+'</ol>';
    }
    addWarning('unsupported_block','插件块 '+info.id+' 的源码格式未识别。');
    return null;
  }

  function renderCellBlock(info) {
    switch (info.type) {
      case 'text': return renderLines(info.element) || null;
      case 'bullet':
      case 'ordered': return renderList(info.type, [info], true);
      case 'code': return renderCode(info);
      case 'image':
      case 'diagram':
      case 'whiteboard': return renderImage(info);
      case 'file': return renderFile(info);
      case 'isv': return renderSource(info);
      case 'quote':
      case 'callout': return renderQuote(info, true);
      case 'quote_container':
      case 'synced_reference':
      case 'view': return renderContainer(info);
      case 'grid':
      case 'grid_column': return renderContainer(info, true);
      case 'table':
        addWarning('unsupported_block', '表格内嵌套表格未转换');
        return null;
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
    return renderSequence(infos, true);
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
      case 'diagram':
      case 'whiteboard': return renderImage(info);
      case 'file': return renderFile(info);
      case 'isv': return renderSource(info);
      case 'table': return renderTable(info);
      case 'quote':
      case 'callout': return renderQuote(info);
      case 'quote_container':
      case 'synced_reference':
      case 'view':
      case 'grid':
      case 'grid_column': return renderContainer(info);
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
    const sourceOnly=block.semanticOnly===true;
    if(sourceOnly) semanticOnly.add(id);
    const element = parseBlock(block.html) || (sourceOnly && semanticByBlock.get(id)?.type===type ? parseBlock(
      '<div data-block-id="'+escapeText(id)+'" data-block-type="'+escapeText(type)+'"><div class="ace-line"></div></div>') : null);
    if (!element) {
      addWarning('unsupported_block', '块 ' + (id || '(无 id)') + ' 无法解析');
      continue;
    }
    applyModelInline(element,sourceOnly);
    if (!['whiteboard','diagram','file'].includes(type)) normalizeRichContent(element, id, addWarning);
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
