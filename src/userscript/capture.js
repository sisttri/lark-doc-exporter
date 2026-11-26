// 飞书 Wiki 页面内采集逻辑（在油猴脚本的页面上下文中运行）。
// 读取当前页面 DOM、已加载图片与画板场景，图形优先由本页本地渲染器输出。
// 不自行调用飞书网络接口或 CLI，不上传文档内容。
import { parseFragment, serialize } from "parse5";
import { readDocumentSource } from './source.js';
import { captureWhiteboardPreview, findWhiteboardCanvas, isWhiteboardReady } from './whiteboard.js';
import { captureLoadedImage, readImageState, sameImageState } from './image.js';
import { createTableStyleCapture } from './table.js';
import { columnGroupHtml, isAuxiliaryTable, logicalTableRows } from '../table-style.js';
export { readDocumentSource } from './source.js';

const ZERO_WIDTH = /[\u200b\u200c\u200d\u2060\ufeff]/gu;
const CODE_ROW = ".code-line-wrapper[data-line-num]";
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const CONTAINER_TYPES = new Set(['page', 'table', 'code', 'grid', 'quote', 'quote_container', 'synced_reference', 'view']);

// Compare supported content, not viewport positioning, editor selection or toolbar state.
function semanticContent(html, cell = false) {
  const fragment = parseFragment(html);
  const tokens = [], texts = [];
  let nested = false;
  const appendText = (text, formatting) => {
    if (!text) return;
    texts.push(text);
    const key = JSON.stringify([Boolean(formatting.bold),Boolean(formatting.italic),Boolean(formatting.strike),
      Boolean(formatting.underline),formatting.href || '',Boolean(formatting.code),formatting.script || '']);
    const last = tokens.at(-1);
    if (last?.format === key) last.text += text;
    else tokens.push({format:key,text});
  };
  const visit = (node, formatting = {}, depth = 0) => {
    if (node.nodeName === '#text') {
      const text = String(node.value || '').replace(ZERO_WIDTH, '');
      appendText(text,formatting);
      return;
    }
    const attrs = new Map((node.attrs || []).map(({name,value}) => [name,value]));
    if (['button','input','textarea','select','svg','script','style','template'].includes(node.tagName)
      || attrs.has('hidden') || attrs.get('aria-hidden') === 'true'
      || /(?:display\s*:\s*none|visibility\s*:\s*hidden)/iu.test(attrs.get('style') || '')) return;
    if (depth > 1 && attrs.has('data-block-id') && (!cell || CONTAINER_TYPES.has(attrs.get('data-block-type')))) nested = true;
    const tag = node.tagName;
    const style = new Map((attrs.get('style') || '').split(';').flatMap(part => {
      const separator = part.indexOf(':');
      return separator < 0 ? [] : [[part.slice(0,separator).trim().toLowerCase(),part.slice(separator+1).trim().toLowerCase()]];
    }));
    const next = {...formatting};
    if (['strong','b'].includes(tag) || /^(?:bold|bolder|[6-9]\d\d)$/u.test(style.get('font-weight') || '')) next.bold = true;
    if (['em','i'].includes(tag) || /^(?:italic|oblique)$/u.test(style.get('font-style') || '')) next.italic = true;
    const decoration = (style.get('text-decoration') || '') + ' ' + (style.get('text-decoration-line') || '');
    if (['s','del','strike'].includes(tag) || /\bline-through\b/u.test(decoration)) next.strike = true;
    if (tag === 'u' || /\bunderline\b/u.test(decoration)) next.underline = true;
    if (tag === 'a' && attrs.get('href')) next.href = attrs.get('href');
    if (tag === 'code') next.code = true;
    if (tag === 'sup' || tag === 'sub') next.script = tag;
    if (tag === 'br') appendText('\n',next);
    const shape = ['rowspan','colspan','start'].flatMap(key => attrs.has(key) ? [[key,attrs.get(key)]] : []);
    if (shape.length) tokens.push({shape});
    for (const child of node.childNodes || []) visit(child, next, depth + 1);
  };
  visit(fragment);
  return {fingerprint:JSON.stringify(tokens), text:texts.join(''), nested};
}

function abortError() {
  return Object.assign(new Error("已取消"), { name: "AbortError" });
}

function cleanText(value) {
  return String(value || "").replace(ZERO_WIDTH, " ").replace(/\s+/gu, " ").trim();
}

function hasNumericId(block) {
  const num = Number(block.id);
  return Number.isSafeInteger(num) && String(num) === block.id;
}

function missingRanges(lines) {
  const ranges = [];
  let next = 1;
  for (const num of [...lines.keys()].sort((a, b) => a - b)) {
    if (num > next) ranges.push([next, num - 1]);
    next = num + 1;
  }
  return ranges;
}

function formatRange(start, end) {
  return start === end ? String(start) : start + "–" + end;
}

// 一次滚动步：收集新出现的块 / 更完整的块 / 代码行，返回滚动前状态。
function collectStep(scroller, ratio, sampleCode, sampleTable, sampleBlock) {
  const fresh = [];
  const improved = [];
  const positions = [];
  const scrollerRect = scroller.getBoundingClientRect();
  const height = Math.max(1, scroller.scrollHeight);
  for (const el of document.querySelectorAll("[data-block-id]")) {
    const id = el.getAttribute("data-block-id");
    if (el.getAttribute("data-block-type") === "table") sampleTable(el);
    const top = scroller.scrollTop + el.getBoundingClientRect().top - scrollerRect.top;
    // 记录相对位置（比例）：页面高度因展开代码块变化时仍能定位；每步都刷新以取最新布局。
    const position = Math.max(0, Math.min(1, top / height));
    positions.push([id, position]);
    const sampled = sampleBlock(el);
    if (sampled?.fresh) fresh.push({...sampled.block,position});
    else if (sampled) improved.push(sampled.block);
  }
  let addedLines = 0;
  for (const el of document.querySelectorAll(".docx-code-block[data-block-id]")) {
    addedLines += sampleCode(el);
  }
  const scrollTop = scroller.scrollTop;
  const atBottom = scrollTop + scroller.clientHeight >= scroller.scrollHeight - 3;
  scroller.scrollTop = Math.min(scrollTop + Math.round(scroller.clientHeight * ratio), scroller.scrollHeight);
  return {
    fresh,
    improved,
    positions,
    addedLines,
    scrollTop,
    sh: scroller.scrollHeight,
    ch: scroller.clientHeight,
    atBottom,
  };
}

export async function capturePage({ stepRatio = 0.6, dwellMs, maxSteps = 400, onProgress, shouldStop } = {}) {
  const report = (payload) => {
    if (typeof onProgress !== "function") return;
    try { onProgress(payload); } catch {}
  };
  const checkStop = () => { if (shouldStop && shouldStop()) throw abortError(); };
  const source = readDocumentSource();
  if (!source.ready) throw new Error(source.reason);
  const scroller = document.querySelector(".bear-web-x-container");
  report({ stage: "prepare", message: "准备采集：" + source.title });

  const originalPath = location.pathname;
  const originalScroll = scroller.scrollTop;
  const style = document.createElement("style");
  style.id = "feishu-local-export-style";
  style.textContent = ".code-block-content{max-height:none!important;height:auto!important;overflow:visible!important}";
  document.head.append(style);
  const warnings = [];
  const started = Date.now();
  const changed = new Set();
  let adaptiveWaitMs = 0;
  let referenceSteps = 0, referenceRegions = 0;
  function contentChanged(id, type) {
    const key = type + ':' + id;
    if (changed.has(key)) return;
    changed.add(key);
    warnings.push({code:'capture_content_changed', label:type + ' ' + id + ' 在采集期间发生变化，结果可能包含不同时刻的内容，请重新保存核对。'});
  }
  try {
    scroller.scrollTop = 0;
    await wait(150);
    await settleDom(900);

    // A quiet DOM alone may still contain the preceding viewport. Include actual
    // visible text/line numbers and code coverage before taking the fast path.
    function domSignature() {
      const viewport = scroller.getBoundingClientRect();
      const top = viewport.top, bottom = top + scroller.clientHeight;
      const parts = [scroller.scrollHeight];
      let ready = true, visible = 0;
      for (const el of document.querySelectorAll('[data-block-id]')) {
        const type = el.getAttribute('data-block-type') || '';
        if (CONTAINER_TYPES.has(type) && type !== 'code' && type !== 'table') continue;
        const box = el.getBoundingClientRect();
        if (box.bottom <= top || box.top >= bottom || !box.height) continue;
        visible++;
        const id = el.getAttribute('data-block-id');
        if (type === 'code') {
          const rows = [...el.querySelectorAll(CODE_ROW)].map(row => ({row,box:row.getBoundingClientRect()}))
            .filter(({box}) => box.bottom > top && box.top < bottom);
          parts.push(id, rows.map(({row}) => [row.getAttribute('data-line-num'),row.textContent]));
          const first = rows[0]?.box, last = rows.at(-1)?.box;
          if (!first || first.top > Math.max(top,box.top) + first.height || last.bottom < Math.min(bottom,box.bottom) - last.height) ready = false;
        } else {
          const text = cleanText(el.textContent);
          parts.push(id,type,text);
          if (type === 'image') {
            const img = el.querySelector('img');
            if (!img?.complete || !img.naturalWidth) ready = false;
          } else if (type === 'whiteboard') {
            const canvas = findWhiteboardCanvas(el);
            parts.push(canvas ? [canvas.width,canvas.height] : null);
            if (!isWhiteboardReady(el)) ready = false;
          } else if (!text && type !== 'divider' && !/\bisEmpty\b/u.test(el.outerHTML)) ready = false;
        }
      }
      return {signature:JSON.stringify(parts),ready,visible};
    }
    async function settleDom(timeout = 600) {
      const started = Date.now();
      let previous = "";
      let stableSince = started;
      while (Date.now() - started < timeout) {
        checkStop();
        const state = domSignature();
        if (state.signature !== previous) {
          previous = state.signature;
          stableSince = Date.now();
        }
        const elapsed = Date.now() - started;
        if (elapsed >= (state.visible ? 140 : 280) && Date.now() - stableSince >= 80 && (state.ready || !state.visible)) break;
        await wait(35);
      }
      adaptiveWaitMs += Date.now() - started;
    }

    const scoreOf = (el) => (el.textContent ? el.textContent.length : 0) * 1000 + el.querySelectorAll("*").length;

    const tables = new Map();
    const tableStyles = createTableStyleCapture();
    function sampleTable(el) {
      let table = el.querySelector("table");
      if (isAuxiliaryTable(table)) {
        table = [...el.querySelectorAll('table')].find(candidate => {
          if (isAuxiliaryTable(candidate)) return false;
          for (let parent=candidate.parentElement;parent && parent !== el;parent=parent.parentElement) {
            if (isAuxiliaryTable(parent)) return false;
          }
          return true;
        });
      }
      if (!table) return;
      const rows = logicalTableRows(el,table);
      if (!rows.length) return;
      const id = el.getAttribute("data-block-id");
      if (!tables.has(id)) tables.set(id, { rows: new Map(), cells: new Map() });
      const state = tables.get(id);
      state.columnWidths = tableStyles.columnWidths(table) || state.columnWidths;
      const offset = scroller.scrollTop - scroller.getBoundingClientRect().top;
      const auxiliaryCount = rows.filter(entry => entry.auxiliary).length;
      const headerCount = rows.filter(entry => entry.section === 'thead').length;
      let index = 0, headerIndex = -headerCount;
      for (const {row,section,auxiliary} of rows) {
        const indexAttr = row.getAttribute("data-index");
        const rowNum = section === 'thead' ? headerIndex++ : indexAttr && /^\d+$/u.test(indexAttr) && Number.isSafeInteger(Number(indexAttr)) ? Number(indexAttr) : index;
        if (!auxiliary) index++;
        const keys = [];
        for (const cell of row.cells) {
          if (tableStyles.isHiddenCell(cell)) continue;
          const col = keys.length;
          const key = cell.getAttribute("data-block-id") || cell.getAttribute("data-record-id") || rowNum + ":" + col;
          keys.push(key);
          const previous = state.cells.get(key);
          const length = cleanText(cell.textContent).length;
          const parts = [...cell.querySelectorAll("[data-block-type]")];
          // 飞书真实空文本块带 isEmpty 和已挂载的行。只有 td 或 render-unit-wrapper 仍是占位。
          const ready = parts.length ? parts.every(part => {
            const type = part.getAttribute("data-block-type");
            if (type === "image") return Boolean(part.querySelector("img"));
            if (type === "whiteboard") return isWhiteboardReady(part);
            if (type === "code") return Boolean(part.querySelector(CODE_ROW));
            if (type === "divider") return true;
            if (type === "text" || type === "bullet" || type === "ordered" || type === "todo" || type.startsWith("heading")) {
              if (!part.querySelector(".ace-line")) return false;
            }
            if (cleanText(part.textContent)) return true;
            return part.classList.contains("isEmpty") && Boolean(part.querySelector(".ace-line [data-string]"));
          }) : (cell.getAttribute("data-block-type") !== "table_cell" && length > 0);
          const rect = cell.getBoundingClientRect();
          const center = rect.height > 0 ? offset + rect.top + rect.height / 2 : previous?.center;
          if (previous?.ready && !ready) continue;
          const html = tableStyles.cellHtml(cell);
          if (previous?.html === html && previous.ready === ready) continue;
          const semantic = ready ? semanticContent(html, true) : null;
          if (previous?.ready && ready && previous.semantic && semantic && semantic.text.trim()
            && semantic.fingerprint !== previous.semantic.fingerprint && length <= previous.length
            && !semantic.nested && !previous.semantic.nested) {
            if (length === previous.length) contentChanged(key, '表格单元格');
            else continue;
          }
          if (!previous || (!previous.ready && ready) || (previous.ready === ready && length >= previous.length)) {
            state.cells.set(key, { rowNum:rowNum+(section === 'thead' ? headerCount : auxiliaryCount), col, ready, length, center, html, semantic });
          }
        }
        const existing = state.rows.get(rowNum);
        if (!existing || existing.section !== section || (keys.length >= existing.keys.length && keys.some((key, i) => existing.keys[i] !== key))) {
          const shell = row.cloneNode(false).outerHTML;
          state.rows.set(rowNum, { keys, shell, section });
        }
      }
    }

    function writeTable(block, state) {
      // 只在脱离页面的 HTML 语法树上替换表格行，保留块外壳、每格原始标记及合并属性。
      const fragment = parseFragment(block.html);
      function findTable(node) {
        if (isAuxiliaryTable(node)) return;
        if (node.tagName === "table") return node;
        for (const child of node.childNodes || []) {
          const result = findTable(child);
          if (result) return result;
        }
      }
      let table = findTable(fragment);
      if (!table) {
        table = parseFragment("<table></table>").childNodes[0];
        const root = fragment.childNodes.find(node => node.tagName);
        if (!root) return;
        root.childNodes.push(table);
        table.parentNode = root;
      }
      const groups = new Map();
      const placed = new Set();
      for (const [, row] of [...state.rows].sort((a, b) => a[0] - b[0])) {
        const cells = row.keys.map(key => { placed.add(key); return state.cells.get(key).html; }).join("");
        const markup = row.shell.replace(/<\/tr>$/iu, () => cells + "</tr>");
        if (!groups.has(row.section)) groups.set(row.section, []);
        groups.get(row.section).push(markup);
      }
      if (placed.size !== state.cells.size) warnings.push({ code: "table_structure_unconfirmed", label: "表格块 " + block.id + " 的列结构在采集期间变化，部分单元格位置未能确认。" });
      const sections = [...groups].map(([tag, rows]) => "<" + tag + ">" + rows.join("") + "</" + tag + ">").join("");
      const rebuilt = parseFragment("<table>" + sections + "</table>").childNodes[0];
      for (const child of rebuilt.childNodes) child.parentNode = table;
      const columns = state.columnWidths ? parseFragment('<table>' + columnGroupHtml(state.columnWidths) + '</table>').childNodes[0].childNodes : null;
      if (columns) for (const column of columns) column.parentNode = table;
      table.childNodes = [...table.childNodes.filter(child => child.tagName === "caption" || !columns && child.tagName === "colgroup"), ...(columns || []), ...rebuilt.childNodes];
      block.html = serialize(fragment);
    }

    // 普通图片复制已加载位图，画板优先本页场景渲染；不自行请求原件。
    async function captureImage(id) {
      if (blocks.get(id)?.type === 'whiteboard') {
        try {
          images.push(await captureWhiteboardPreview(id,{wait,checkStop}));
          whiteboardErrors.delete(id);
          return true;
        } catch (error) {
          if (error.name === 'AbortError') throw error;
          whiteboardErrors.set(id,String(error.message || error).slice(0,120));
          return false;
        }
      }
      try {
        const index = images.findIndex(image => image.blockId === id);
        const saved = index < 0 ? undefined : {image:images[index],state:imageStates.get(id)};
        const {image,state} = await captureLoadedImage(id,{wait,checkStop,saved});
        if (index < 0) images.push(image); else images[index]=image;
        imageStates.set(id,state); observedImages.set(id,state); imageErrors.delete(id);
        return true;
      } catch (error) {
        if (error.name === 'AbortError') throw error;
        imageErrors.set(id,String(error.message || error).slice(0,120));
        return false;
      }
    }

    const blocks = new Map();
    const positions = new Map();
    const codeBlocks = new Map();
    const images = [];
    const failedImages = new Set();
    const whiteboardErrors = new Map();
    const imageStates = new Map(), observedImages = new Map(), pendingImages = new Set(), imageErrors = new Map();
    function sampleBlock(el) {
      const id = el.getAttribute('data-block-id');
      const type = el.getAttribute('data-block-type') || '';
      if (type === 'image') {
        const state = readImageState(el);
        if (!observedImages.has(id) || !sameImageState(observedImages.get(id),state)) pendingImages.add(id);
        observedImages.set(id,state);
      }
      const stored = blocks.get(id), html = el.outerHTML;
      if (stored?.observedHtml === html) return null;
      if (stored) stored.observedHtml = html;
      const score = scoreOf(el);
      const semantic = !CONTAINER_TYPES.has(type) ? semanticContent(html) : null;
      const parent = el.parentElement?.closest('[data-block-id]');
      const block = {id,type,parentId:parent && parent !== el ? parent.getAttribute('data-block-id') : '',html,observedHtml:html,score,semantic};
      if (!stored) return {fresh:true,block};
      const previous = stored.semantic;
      const equalContentSize = semantic && previous && semantic.text.trim() && previous.text.trim()
        && semantic.text.length === previous.text.length && !semantic.nested && !previous.nested;
      if (equalContentSize && semantic.fingerprint !== previous.fingerprint) {
        contentChanged(id,'正文块');
        return {block};
      }
      return score > stored.score ? {block} : null;
    }
    function mergeSamples(snap) {
      for (const entry of snap.positions) positions.set(entry[0],entry[1]);
      for (const block of snap.fresh) blocks.set(block.id,block);
      for (const block of snap.improved) Object.assign(blocks.get(block.id),block);
    }
    async function collectImages(snap) {
      for (const block of snap.fresh) {
        if (block.type === 'whiteboard' && !images.some(image => image.blockId === block.id)) {
          if (!await captureImage(block.id)) failedImages.add(block.id);
        }
      }
      for (const id of [...pendingImages]) {
        pendingImages.delete(id);
        if (await captureImage(id)) failedImages.delete(id); else failedImages.add(id);
      }
    }
    function codeData(id) {
      if (!codeBlocks.has(id)) codeBlocks.set(id, { lines: new Map(), lastSeen: 0 });
      return codeBlocks.get(id);
    }

    // 同一时刻读取行号、正文和位置。编辑器用空白占位元素表示未渲染的首尾。
    function sampleCode(el) {
      const id = el.getAttribute("data-block-id");
      const data = codeData(id);
      const before = data.lines.size;
      const zone = el.querySelector(".code-block-zone-container");
      const content = zone || el.querySelector(".code-block-content");
      const offset = scroller.scrollTop - scroller.getBoundingClientRect().top;
      if (content) {
        const rect = content.getBoundingClientRect();
        if (rect.height > 0) {
          data.top = offset + rect.top;
          data.bottom = offset + rect.bottom;
        }
      }
      let last;
      for (const row of el.querySelectorAll(CODE_ROW)) {
        const num = Number(row.getAttribute("data-line-num"));
        if (!Number.isSafeInteger(num) || num < 1) continue;
        // 空行可能是先于文字出现的渲染占位。重采时允许真正的正文替换它。
        const text = row.textContent.replace(ZERO_WIDTH, "");
        const previous = data.lines.get(num);
        if (text && previous && previous !== text) contentChanged(id,'代码块');
        if (text || !data.lines.has(num)) data.lines.set(num,text);
        data.lastSeen = Math.max(data.lastSeen, num);
        last = { row, num };
      }
      if (last) {
        const rect = last.row.getBoundingClientRect();
        if (rect.height > 0) {
          data.anchor = { num: last.num, y: offset + rect.top, height: rect.height };
          if (Number.isFinite(data.bottom)) {
            data.estimatedEnd = last.num + Math.max(0, Math.round((data.bottom - offset - rect.bottom) / rect.height));
          }
        }
        if (zone?.lastElementChild?.contains(last.row)) data.confirmedEnd = last.num;
      }
      return data.lines.size - before;
    }
    let noProgress = 0;
    let steps = 0;
    for (; steps < maxSteps; steps++) {
      checkStop();
      const snap = collectStep(scroller, stepRatio, sampleCode, sampleTable, sampleBlock);
      let added = snap.addedLines;
      mergeSamples(snap); added += snap.fresh.length;
      await collectImages(snap);
      const percent = Math.max(0, Math.min(95, Math.round(
        (snap.scrollTop / Math.max(1, snap.sh - snap.ch)) * 95,
      )));
      report({ stage: "scroll", message: "滚动采集：" + percent + "% · 块 " + blocks.size + " · 代码块 " + codeBlocks.size, percent, blocks: blocks.size, codeBlocks: codeBlocks.size });
      if (snap.atBottom) {
        noProgress = added === 0 ? noProgress + 1 : 0;
        // 到达底部后飞书还会异步加载后续内容，多等几拍确认页面高度不再增长再结束。
        await wait(650);
        const grown = scroller.scrollHeight > snap.sh + 8;
        if (grown) {
          noProgress = 0;
        } else {
          await settleDom(800);
        }
        if (!grown && noProgress >= 2) break;
      } else {
        noProgress = 0;
        if (Number.isFinite(dwellMs)) await wait(Math.max(0,dwellMs));
        else await settleDom();
      }
    }

    if (steps >= maxSteps) {
      warnings.push({ code: "capture_step_limit", label: "已达到 " + maxSteps + " 步滚动上限，未确认文末，导出可能缺少后续内容。" });
    }

    const pageBlock = [...blocks.values()].find((block) => block.type === "page");
    const pageId = pageBlock ? pageBlock.id : "1";
    const roots = [...blocks.values()].filter((block) => block.parentId === pageId);
    if (!roots.length) throw new Error("没有采集到文档内容，请刷新页面后重试");
    function refreshRoots() {
      roots.length = 0;
      for (const block of blocks.values()) if (block.parentId === pageId) roots.push(block);
      if (roots.every(hasNumericId)) roots.sort((a,b) => Number(a.id)-Number(b.id));
    }

    // 定位辅助：以相对位置定位，失败后从估计位置向两侧快速扩散扫描。
    const tryAt = async (id, scrollTop) => {
      checkStop();
      const maxTop = scroller.scrollHeight - scroller.clientHeight;
      scroller.scrollTop = Math.max(0, Math.min(scrollTop, maxTop));
      await wait(70);
      checkStop();
      let el = document.querySelector('[data-block-id="' + id + '"]');
      if (!el) return false;
      el.scrollIntoView({ block: "center" });
      await wait(60);
      el = document.querySelector('[data-block-id="' + id + '"]');
      return Boolean(el);
    };
    const revealBlock = async (id, position) => {
      const sh = scroller.scrollHeight;
      const ch = scroller.clientHeight;
      const estimate = Math.round((Number.isFinite(position) ? position : 0) * sh);
      if (await tryAt(id, estimate - ch / 2)) return true;
      const step = Math.max(180, Math.round(ch * 0.6));
      for (let delta = step; delta <= sh; delta += step) {
        if (estimate - ch / 2 + delta <= sh && await tryAt(id, estimate - ch / 2 + delta)) return true;
        if (estimate - ch / 2 - delta >= 0 && await tryAt(id, estimate - ch / 2 - delta)) return true;
      }
      return false;
    };
    // 缺块结构扫描：根块 id 是连续递增的，发现空洞时在相邻块之间用更细步长补采。
    const rootList = [...blocks.values()].filter((block) => block.parentId === pageId);
    const rootIds = rootList.every(hasNumericId) ? rootList.map((block) => Number(block.id)).sort((a, b) => a - b) : [];
    const missingIds = [];
    if (rootIds.length > 4 && rootIds[rootIds.length - 1] - rootIds[0] + 1 <= rootIds.length * 1.5 + 8) {
      const present = new Set(rootIds);
      for (let id = rootIds[0]; id <= rootIds[rootIds.length - 1]; id += 1) if (!present.has(id)) missingIds.push(id);
    }
    // 以相邻已采块为锚点扫描缺失块：先定位后一个块，再向上/向下逐小步重扫邻近区域。
    async function collectAtCurrentPosition() {
      checkStop();
      const snap = collectStep(scroller, 0, sampleCode, sampleTable, sampleBlock);
      mergeSamples(snap);
      await collectImages(snap);
    }
    const hasBlock = (id) => blocks.has(String(id));
    async function sampleMissingBlock(id) {
      for (const delay of [70, 150, 240]) {
        await wait(delay);
        await collectAtCurrentPosition();
        // 等待图片时正文仍可能继续挂载，看到目标后再采样，不能把 DOM 存在当作交付。
        if (!hasBlock(id) && document.querySelector('[data-block-id="' + id + '"]')) await collectAtCurrentPosition();
        if (hasBlock(id)) return true;
      }
      return false;
    }
    const scanAround = async (anchorId, missingId, direction) => {
      if (!await revealBlock(anchorId, positions.get(anchorId))) return false;
      if (await sampleMissingBlock(missingId)) return true;
      const startScroll = scroller.scrollTop;
      const stepSize = Math.max(120, Math.round(scroller.clientHeight * 0.22));
      const maxDelta = scroller.clientHeight * 2.2;
      for (let delta = stepSize; delta <= maxDelta; delta += stepSize) {
        checkStop();
        const maxTop = scroller.scrollHeight - scroller.clientHeight;
        scroller.scrollTop = direction === "up" ? Math.max(0, startScroll - delta) : Math.min(maxTop, startScroll + delta);
        if (await sampleMissingBlock(missingId)) return true;
      }
      return false;
    };
    if (missingIds.length) {
      report({ stage: "structure", message: "补采漏掉的块…", missing: missingIds.length });
      for (const missingId of missingIds) {
        checkStop();
        if (hasBlock(missingId)) continue;
        const nextId = rootIds.find((id) => id > missingId);
        const prevId = [...rootIds].reverse().find((id) => id < missingId);
        let found = false;
        if (nextId !== undefined) found = await scanAround(nextId, missingId, "up");
        if (!found && prevId !== undefined) found = await scanAround(prevId, missingId, "down");
        if (!found) warnings.push({ code: "missing_block", label: "疑似漏掉的块 " + missingId });
      }
    }
    // 结构补采可能新增根块，刷新根块列表供后续补采与返回使用；按块 id 数值恢复文档顺序。
    refreshRoots();

    report({ stage: "audit", message: "核对表格、图片与代码完整性…" });
    await collectAtCurrentPosition();
    function insideReference(block,id) {
      if (block.id === id) return false;
      let parent = block.parentId;
      const visited = new Set();
      while (parent && parent !== id && !visited.has(parent)) {
        visited.add(parent); parent = blocks.get(parent)?.parentId;
      }
      return parent === id;
    }
    function referenceState(id) {
      const descendants = [];
      let ready = false;
      for (const block of blocks.values()) {
        if (!insideReference(block,id)) continue;
        let content = block.semantic?.fingerprint || '';
        if (block.type === 'code') {
          const lines = codeBlocks.get(block.id)?.lines;
          content = lines ? JSON.stringify([...lines]) : '';
          if (lines?.size) ready = true;
        } else if (block.type === 'table') {
          const cells = tables.get(block.id)?.cells;
          content = cells ? JSON.stringify([...cells].map(([key,cell])=>[key,cell.ready,cell.semantic?.fingerprint])) : '';
          if (cells?.size) ready = true;
        } else if ((!CONTAINER_TYPES.has(block.type) && block.semantic?.text.trim())
          || ['image','whiteboard'].includes(block.type) && images.some(image=>image.blockId===block.id)
          || block.type === 'whiteboard' && isWhiteboardReady(document.querySelector('[data-block-id="' + block.id + '"]'))
          || /\bisEmpty\b/u.test(block.html)) ready = true;
        descendants.push([block.id,block.parentId,block.type,content]);
      }
      return {signature:JSON.stringify(descendants),ready};
    }
    async function auditReference(reference) {
      checkStop(); referenceRegions++;
      report({stage:'audit',message:'复核引用区域 ' + referenceRegions + '…'});
      const viewHeight = scroller.clientHeight;
      const maxTop = () => Math.max(0,scroller.scrollHeight-viewHeight);
      const readBounds = () => {
        const el = document.querySelector('[data-block-id="'+reference.id+'"]');
        if (!el) return null;
        const box = el.getBoundingClientRect();
        if (!(box.height > 0)) return null;
        const top = scroller.scrollTop + box.top - scroller.getBoundingClientRect().top;
        return {top:Math.max(0,top),bottom:top+box.height};
      };
      const warn = () => warnings.push({code:'missing_block',label:'引用块 ' + reference.id + ' 的正文加载或跨视口复核尚未确认完整，请重新保存核对。'});
      function currentWindow(bounds) {
        const top = scroller.getBoundingClientRect().top, bottom = top+viewHeight;
        const parts = [];
        for (const el of document.querySelectorAll('[data-block-id]')) {
          const block = blocks.get(el.getAttribute('data-block-id'));
          if (!block || !insideReference(block,reference.id)) continue;
          if (CONTAINER_TYPES.has(block.type) && block.type !== 'table' && block.type !== 'code') continue;
          const content = ['bullet','ordered'].includes(block.type) ? el.querySelector?.('.list') || el : el;
          const box = content.getBoundingClientRect();
          if (!box.height || box.top+box.height <= top || box.top >= bottom) continue;
          if (block.type === 'code') {
            for (const row of el.querySelectorAll(CODE_ROW)) {
              const line = row.getBoundingClientRect();
              if (line.top+line.height <= top || line.top >= bottom) continue;
              parts.push([block.id,row.getAttribute('data-line-num'),row.textContent]);
            }
          } else {
            if (block.type === 'image') {
              const image = el.querySelector('img');
              if (!image?.complete || !image.naturalWidth) continue;
            } else if (block.type === 'whiteboard') {
              if (!isWhiteboardReady(el)) continue;
            } else if (!cleanText(content.textContent) && !/\bisEmpty\b/u.test(content.outerHTML)) continue;
            parts.push([block.id,content.textContent]);
          }
        }
        return {signature:JSON.stringify(parts),ready:parts.length>0};
      }
      async function waitWindow(bounds) {
        const began = Date.now();
        let quietSince = began, previous = currentWindow(bounds).signature;
        while (Date.now()-began < 1800) {
          checkStop(); await wait(70); await collectAtCurrentPosition();
          bounds = readBounds() || bounds;
          const window = currentWindow(bounds);
          if (window.signature !== previous) {previous=window.signature;quietSince=Date.now();}
          // References may retain a previous leaf while the new viewport is still mounting.
          if (window.ready && Date.now()-began >= 980 && Date.now()-quietSince >= 140) return true;
        }
        return false;
      }
      scroller.scrollTop = Math.max(0,Math.min(maxTop(),(positions.get(reference.id)||0)*scroller.scrollHeight));
      await settleDom(800);
      let bounds = readBounds();
      if (!bounds) {
        if (!await revealBlock(reference.id,positions.get(reference.id))) { warn(); return; }
        bounds = readBounds();
      }
      if (!bounds) { warn(); return; }
      // Remote references can expose a stable shell long before their body mounts.
      // Hold at their start, then require a second local sweep with no new content.
      scroller.scrollTop = Math.max(0,Math.min(maxTop(),bounds.top));
      const warmStarted = Date.now();
      let quietSince = warmStarted, previous = referenceState(reference.id).signature;
      while (Date.now()-warmStarted < 1800) {
        await wait(70); await collectAtCurrentPosition();
        const state = referenceState(reference.id);
        if (state.signature !== previous) {previous=state.signature;quietSince=Date.now();}
        bounds = readBounds() || bounds;
        if (state.ready && Date.now()-warmStarted >= 980 && Date.now()-quietSince >= 280) break;
      }
      let confirmed = false;
      const step = Math.max(80,Math.round(viewHeight*.6));
      for (let pass=0;pass<3;pass++) {
        bounds = readBounds() || bounds;
        let target = Math.max(0,Math.min(maxTop(),bounds.top));
        let atBottom = false, windowsReady = true, coveredBottom = target;
        const budget = Math.max(4,Math.min(maxSteps,120));
        for (let index=0;index<budget;index++) {
          checkStop();
          scroller.scrollTop = target;
          if (!await waitWindow(bounds)) windowsReady = false;
          referenceSteps++; coveredBottom = Math.max(coveredBottom,scroller.scrollTop+viewHeight);
          const current = readBounds();
          if (!current) break;
          bounds = current;
          const end = Math.max(bounds.top,bounds.bottom-viewHeight);
          if (scroller.scrollTop >= end-3) {atBottom=true;break;}
          const next = Math.min(maxTop(),end,Math.max(target,scroller.scrollTop)+step);
          if (next <= scroller.scrollTop+1) break;
          target = next;
        }
        await wait(350); await collectAtCurrentPosition();
        const finalBounds = readBounds();
        if (!finalBounds || finalBounds.bottom > coveredBottom+3) atBottom = false;
        if (finalBounds) bounds = finalBounds;
        const state = referenceState(reference.id);
        if (pass>0 && atBottom && windowsReady && state.ready && state.signature===previous) {confirmed=true;break;}
        previous = state.signature;
      }
      if (!confirmed) warn();
    }
    // Only known reference regions are revisited; ordinary document sections keep
    // the adaptive one-pass path. Newly mounted nested references join this queue.
    for (const reference of blocks.values()) {
      if (reference.type === 'synced_reference') await auditReference(reference);
    }
    refreshRoots();
    tableStyles.beginFinalReview();
    const tableBlocks = new Map([...blocks].filter(([, block]) => block.type === "table"));
    for (const block of tableBlocks.values()) {
      checkStop();
      const currentTable = document.querySelector('[data-block-id="' + block.id + '"]');
      if (currentTable) sampleTable(currentTable);
      async function sampleAt(y, done) {
        const maxTop = Math.max(0, scroller.scrollHeight - scroller.clientHeight);
        scroller.scrollTop = Math.max(0, Math.min(maxTop, y - scroller.clientHeight / 2));
        for (const delay of [80, 160, 280]) {
          await wait(delay);
          checkStop();
          const el = document.querySelector('[data-block-id="' + block.id + '"]');
          if (el) sampleTable(el);
          if (done()) break;
        }
      }
      const top = (positions.get(block.id) || 0) * scroller.scrollHeight;
      if (!tables.has(block.id)) await sampleAt(top, () => tables.has(block.id));
      const saved = tables.get(block.id);
      if (!saved?.cells.size) {
        warnings.push({ code: "table_structure_unconfirmed", label: "表格块 " + block.id + " 未读到单元格结构。" });
        continue;
      }
      const tried = [];
      for (const entry of saved.cells.values()) {
        if (entry.ready) continue;
        const center = entry.center ?? top;
        if (tried.some(y => Math.abs(y - center) < scroller.clientHeight / 4)) continue;
        tried.push(center);
        await sampleAt(center, () => [...saved.cells.values()].every(cell =>
          cell.ready || Math.abs((cell.center ?? top) - center) >= scroller.clientHeight / 4));
      }
      for (const cell of saved.cells.values()) {
        if (!cell.ready) warnings.push({ code: "table_cell_unconfirmed", label: "表格块 " + block.id + " 第 " + (cell.rowNum + 1) + " 行第 " + (cell.col + 1) + " 列未确认已渲染。" });
      }
      writeTable(block, saved);
    }
    for (const id of new Set([...failedImages,...imageStates.keys()])) {
      checkStop();
      if (!await revealBlock(id, positions.get(id))) {
        if (blocks.get(id)?.type === 'image') imageErrors.set(id,'未能定位图片以复核已加载位图');
        continue;
      }
      if (await captureImage(id)) failedImages.delete(id);
    }
    for (const [id,reason] of imageErrors) warnings.push({code:'image_unreadable',label:'图片块 ' + id + '：' + reason});
    for (const [id,reason] of whiteboardErrors) {
      warnings.push({code:'image_unreadable',label:'白板块 ' + id + '：' + reason});
    }
    // 只滚到该代码块的缺行窗口。渲染可能比滚动慢，原地分次采样，并按读到的实际行号结束等待。
    async function sampleWindow(id, y, reached) {
      checkStop();
      const maxTop = Math.max(0, scroller.scrollHeight - scroller.clientHeight);
      scroller.scrollTop = Math.max(0, Math.min(maxTop, y - scroller.clientHeight / 2));
      for (const delay of [70, 150, 240]) {
        await wait(delay);
        checkStop();
        const el = document.querySelector('[data-block-id="' + id + '"]');
        if (el) sampleCode(el);
        if (reached()) return;
      }
    }
    for (const block of blocks.values()) {
      if (block.type !== "code") continue;
      const { id } = block;
      const data = codeData(id);
      const blockY = (positions.get(id) || 0) * scroller.scrollHeight;
      if (!data.confirmedEnd || missingRanges(data.lines).length) {
        // 前面的块展开或视口变化会使绝对坐标过期，先用当前块重校代码区域。
        if (await revealBlock(id, positions.get(id))) {
          const el = document.querySelector('[data-block-id="' + id + '"]');
          if (el) sampleCode(el);
        }
      }
      if (!data.confirmedEnd) {
        // 实际代码区域的底边优先于由行高推测的末行，折行时仍可定位到块尾。
        await sampleWindow(id, data.bottom ?? blockY, () => Boolean(data.confirmedEnd));
      }
      if (!data.lines.size) await sampleWindow(id, data.top ?? blockY, () => data.lines.size > 0);
      // 按代码区域实际高度限制定位次数，损坏或跳变的行号不能引发长时间重复滚动。
      const regionHeight = Math.max(0, (data.bottom ?? blockY) - (data.top ?? blockY));
      let windows = 4 + Math.ceil(3 * regionHeight / Math.max(1, scroller.clientHeight));
      for (const [start, end] of missingRanges(data.lines)) {
        let num = start;
        while (num <= end && windows > 0) {
          if (data.lines.has(num)) { num += 1; continue; }
          const anchor = data.anchor;
          if (!anchor) break;
          windows -= 1;
          // 滚到这个缺口的第一行。用实际返回的可见行重新校准一次，吸收自动换行的高度差。
          let targetY = anchor.y + (num - anchor.num) * anchor.height;
          const missingLine = num;
          for (let pass = 0; pass < 2; pass += 1) {
            targetY = Math.max(data.top ?? -Infinity, Math.min(data.bottom ?? Infinity, targetY));
            await sampleWindow(id, targetY, () => data.lines.has(missingLine));
            if (data.lines.has(num)) break;
            const current = data.anchor;
            const adjustedY = current.y + (num - current.num) * current.height;
            if (Math.abs(adjustedY - targetY) < current.height) break;
            targetY = adjustedY;
          }
          // 一个渲染窗口内永久缺失的行统一在结束时列出，不为每行重复等待。
          num += data.lines.has(num) ? 1 : Math.max(1, Math.floor(scroller.clientHeight / (2 * anchor.height)));
        }
      }
      const ranges = missingRanges(data.lines);
      if (!data.lines.size) {
        warnings.push({ code: "code_unreadable", label: "代码块 " + id + " 没有读到内容" });
        continue;
      }
      if (ranges.length) {
        warnings.push({ code: "code_lines_missing", label: "代码块 " + id + " 缺少行 " + ranges.map(([start, end]) => formatRange(start, end)).join("、") });
      }
      if (!data.confirmedEnd) {
        const estimate = data.estimatedEnd > data.lastSeen ? "，按渲染高度估计待核对行 " + formatRange(data.lastSeen + 1, data.estimatedEnd) : "";
        warnings.push({ code: "code_tail_unconfirmed", label: "代码块 " + id + " 已读到第 " + data.lastSeen + " 行，未确认块尾" + estimate });
      }
    }

    // 结构性补采
    report({ stage: "recheck", message: "补采未完整渲染的块…" });
    const suspicious = roots.filter((block) => {
      if (["text", "quote", "callout"].includes(block.type)) return block.html.length < 400;
      if (block.type.startsWith("heading")) return !block.html.includes("data-string");
      if (block.type === "image") return !block.html.includes("<img");
      if (block.type === "bullet" || block.type === "ordered") return !block.html.includes("data-string") && !block.html.includes("list-content");
      return false;
    });
    for (const block of suspicious) {
      if (!await revealBlock(block.id, positions.get(block.id))) continue;
      const el = document.querySelector('[data-block-id="' + block.id + '"]');
      if (!el) continue;
      const refreshed = sampleBlock(el);
      if (refreshed) Object.assign(blocks.get(block.id),refreshed.block);
    }

    const childrenByParent = new Map();
    for (const block of blocks.values()) {
      if (!childrenByParent.has(block.parentId)) childrenByParent.set(block.parentId, []);
      childrenByParent.get(block.parentId).push(block);
    }
    // Nested lists virtualize independently of their enclosing reference page.
    // Rebuild the known child slot bottom-up, keeping the parent's own list line.
    const rebuiltLists = new Set();
    function rebuildList(block, visiting = new Set()) {
      if (rebuiltLists.has(block.id) || visiting.has(block.id)) return;
      const children = childrenByParent.get(block.id) || [];
      if (!children.length || !['bullet','ordered'].includes(block.type)) return;
      visiting.add(block.id);
      for (const child of children) rebuildList(child,visiting);
      visiting.delete(block.id);
      const fragment = parseFragment(block.html);
      function findChildren(node) {
        const attrs = node.attrs || [];
        const id = attrs.find(attr => attr.name === 'data-block-id')?.value;
        if (id && id !== block.id) return null;
        const classes = attrs.find(attr => attr.name === 'class')?.value.split(/\s+/u) || [];
        if (classes.includes('list-children')) return node;
        for (const child of node.childNodes || []) {
          const found = findChildren(child);
          if (found) return found;
        }
        return null;
      }
      const slot = findChildren(fragment);
      if (!slot) {
        warnings.push({code:'missing_block',label:'列表块 ' + block.id + ' 未找到嵌套内容容器，未能确认子项位置。'});
        return;
      }
      const ordered = [...children];
      if (ordered.every(hasNumericId)) ordered.sort((a,b) => Number(a.id)-Number(b.id));
      else ordered.sort((a,b) => (positions.get(a.id) ?? Infinity)-(positions.get(b.id) ?? Infinity));
      slot.childNodes = parseFragment(ordered.map(child=>child.html).join('')).childNodes;
      for (const child of slot.childNodes) child.parentNode = slot;
      block.html = serialize(fragment);
      rebuiltLists.add(block.id);
    }
    for (const block of blocks.values()) rebuildList(block);
    const embeddedPages = new Map([...blocks].filter(([, block]) => block.type === "page" && block.id !== pageId));
    for (const page of embeddedPages.values()) {
      const children = childrenByParent.get(page.id) || [];
      if (!children.length) continue;
      const fragment = parseFragment(page.html);
      function findPageChildren(node) {
        const attrs = node.attrs || [];
        const type = attrs.find(attr => attr.name === "data-block-type")?.value;
        const id = attrs.find(attr => attr.name === "data-block-id")?.value;
        if (type === "page" && id !== page.id) return null;
        const classes = (attrs.find(attr => attr.name === "class")?.value || "").split(/\s+/u);
        if (classes.includes("page-block-children") || classes.includes("reference-page-block-childen")) return node;
        for (const child of node.childNodes || []) {
          const found = findPageChildren(child);
          if (found) return found;
        }
        return null;
      }
      const body = findPageChildren(fragment);
      if (!body) {
        warnings.push({ code: "missing_block", label: "内嵌页面 " + page.id + " 未找到正文容器，未能合并已采集的内容。" });
        continue;
      }
      if (children.every(hasNumericId)) children.sort((a, b) => Number(a.id) - Number(b.id));
      const rebuilt = parseFragment(children.map(child => child.html).join(""));
      body.childNodes = rebuilt.childNodes;
      for (const child of body.childNodes) child.parentNode = body;
      page.html = serialize(fragment);
    }

    // 容器快照可能只含一个视口，等根块最后一次刷新后原位写回重建内容。
    const nestedByRoot = new Map();
    const rebuiltBlocks = new Map([...tableBlocks, ...embeddedPages, ...[...rebuiltLists].map(id => [id,blocks.get(id)])]);
    for (const block of rebuiltBlocks.values()) {
      if (block.parentId === pageId) continue;
      let owner = blocks.get(block.parentId);
      while (owner && owner.parentId !== pageId) owner = blocks.get(owner.parentId);
      if (!owner) continue;
      if (!nestedByRoot.has(owner.id)) nestedByRoot.set(owner.id, new Map());
      nestedByRoot.get(owner.id).set(block.id, block);
    }
    for (const root of roots) {
      const nested = nestedByRoot.get(root.id);
      if (!nested) continue;
      const fragment = parseFragment(root.html);
      const restored = new Set();
      function restoreNested(node) {
        for (let index = 0; index < (node.childNodes || []).length; index++) {
          let child = node.childNodes[index];
          const id = child.attrs?.find(attr => attr.name === "data-block-id")?.value;
          const block = nested.get(id);
          if (block) {
            const replacement = parseFragment(block.html).childNodes.find(item => item.tagName);
            if (replacement) {
              replacement.parentNode = node;
              node.childNodes[index] = replacement;
              child = replacement;
              restored.add(id);
            }
          }
          restoreNested(child);
        }
      }
      restoreNested(fragment);
      root.html = serialize(fragment);
      for (const id of nested.keys()) {
        if (!restored.has(id)) {
          const type = nested.get(id).type;
          const table = type === 'table';
          warnings.push({
            code: table ? "table_structure_unconfirmed" : "missing_block",
            label: (type === 'page' ? "内嵌页面 " : table ? "表格块 " : "列表块 ") + id + " 未能确认在容器中的位置。",
          });
        }
      }
    }

    const knownRootTypes = new Set(["heading1", "heading2", "heading3", "heading4", "heading5", "heading6", "text",
      "bullet", "ordered", "code", "table", "image", "whiteboard", "quote", "quote_container", "synced_reference", "view", "callout", "divider", "todo", "grid", "file"]);
    for (const type of new Set(roots.map((block) => block.type))) {
      if (!knownRootTypes.has(type)) warnings.push({ code: "unsupported_block", label: "未适配的块类型：" + type });
    }

    report({ stage: "done", message: "采集完成：块 " + roots.length + " · 代码块 " + codeBlocks.size + " · 图片 " + images.length,
      metrics:{elapsedMs:Date.now()-started,scrollSteps:Math.min(steps+1,maxSteps),adaptiveWaitMs,referenceSteps,referenceRegions,waitMode:Number.isFinite(dwellMs)?'fixed':'adaptive'} });
    return {
      version: 1,
      generator: "feishu-local-exporter 油猴页面采集",
      source: { ...source, capturedAt: new Date().toISOString() },
      pageBlockId: pageId,
      blocks: roots.map(({ id, type, html }) => ({ id, type, html })),
      code: Object.fromEntries([...codeBlocks].map(([id, data]) => {
        const lines = [...data.lines].sort((a, b) => a[0] - b[0]).map(([num, text]) => ({ num, text }));
        return [id, data.confirmedEnd ? { lines, totalLines: data.confirmedEnd } : { lines }];
      })),
      images,
      warnings,
    };
  } finally {
    style.remove();
    if (location.pathname === originalPath && document.querySelector(".bear-web-x-container") === scroller
        && readDocumentSource().docToken === source.docToken) {
      scroller.scrollTop = originalScroll;
    }
  }
}
