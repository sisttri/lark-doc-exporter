// This module only consumes the neutral document tree. Nothing here reads a page.
import {warningLabel} from './shared.js';
import {normalizeCellStyle, normalizeColumnWidths} from './table-style.js';
import {missingEmojiGlyphs, splitEmojiRuns} from './pdf-emoji.js';
const INLINE = new Set(['a', 'span', 'strong', 'b', 'em', 'i', 's', 'del', 'strike', 'small', 'u', 'code', 'mark', 'sub', 'sup', 'br']);
const SECTIONS = new Set(['thead', 'tbody', 'tfoot']);
const MiB = 1024 * 1024;
const PAGE_MARGINS = [42,44,42,43];
const PAGE_WIDTH = 595.28 - PAGE_MARGINS[0] - PAGE_MARGINS[2];
const COLUMN_GAP = 16; // lightHorizontalLines uses 8 pt on each side of an interior column boundary.
const MIN_COLUMN_WIDTH = 24;
const MAX_IMAGE_HEIGHT = 600;
function limit() { throw Object.assign(new Error('PDF_LIMIT'), {code: 'PDF_LIMIT'}); }
export function plain(node) {
  if (typeof node === 'string') return node;
  if (node.tag === 'br') return '\n';
  if (node.tag === 'img') return node.alt || '图片';
  return (node.children || []).map(plain).join('');
}
function checkedSize(snapshot) {
  let chars = 0, nodes = 0;
  function check(node) {
    if (++nodes > 20000) limit();
    if (typeof node === 'string') { chars += node.length; if (chars > 300000) limit(); }
    else (node.children || []).forEach(check);
  }
  snapshot.blocks.forEach(check);
}
function dataUrl(bytes, type) {
  const pieces = [];
  for (let i = 0; i < bytes.length; i += 16384) {
    pieces.push(String.fromCharCode(...bytes.subarray(i, i + 16384)));
  }
  return 'data:' + type + ';base64,' + btoa(pieces.join(''));
}
function staticPng(bytes) {
  const signature = [137,80,78,71,13,10,26,10];
  if (!signature.every((byte, index) => bytes[index] === byte)) return false;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  for (let offset = 8; offset + 12 <= bytes.length;) {
    const length = view.getUint32(offset);
    if (length > bytes.length - offset - 12) return false;
    const kind = String.fromCharCode(...bytes.subarray(offset + 4, offset + 8));
    if (kind === 'acTL') return false;
    if (kind === 'IEND') return length === 0;
    offset += length + 12;
  }
  return false;
}
export async function prepareImages(snapshot) {
  checkedSize(snapshot);
  const referenced = new Set();
  function visit(node) {
    if (typeof node === 'string') return;
    if (node.tag === 'img' && node.path) referenced.add(node.path);
    (node.children || []).forEach(visit);
  }
  snapshot.blocks.forEach(visit);
  const images = {}, names = new Map(), dimensions = new Map(), slices = new Map();
  let pixels = 0, bytes = 0, renderedBytes = 0, skipped = 0, staticImages = 0;
  for (const asset of snapshot.assets) {
    if (asset.role !== 'image' || !referenced.has(asset.path)) continue;
    const raster = asset.type === 'image/svg+xml' ? asset.rasterFallback : asset;
    bytes += asset.bytes.length + (asset.type === 'image/svg+xml' ? raster?.bytes.length || 0 : 0);
    if (bytes > 24 * MiB || referenced.size > 110) limit();
    // foreignObject contains diagram labels; SVG-to-PDF does not render it.
    // Only a separately validated PNG is passed to the raster decoder.
    if (!raster || asset.type === 'image/svg+xml' && raster.type !== 'image/png') {skipped++;continue;}
    let bitmap;
    try {
      bitmap = await createImageBitmap(new Blob([raster.bytes], {type:raster.type}));
      pixels += bitmap.width * bitmap.height;
      if (pixels > 28e6) limit();
      const {width,height} = bitmap;
      const displayWidth = Math.min(PAGE_WIDTH,width * .75);
      const sliceHeight = Math.max(1,Math.floor(MAX_IMAGE_HEIGHT * width / displayWidth));
      const entries = [], parts = [];
      let assetBytes = 0;
      for (let top = 0; top < height; top += sliceHeight) {
        const partHeight = Math.min(sliceHeight,height-top);
        let preparedBytes, type = 'image/png';
        if (height <= sliceHeight && (raster.type === 'image/jpeg' || raster.type === 'image/png' && staticPng(raster.bytes))) {
          preparedBytes = raster.bytes;
          type = raster.type;
        } else {
          const canvas = new OffscreenCanvas(width, partHeight);
          try {
            canvas.getContext('2d').drawImage(bitmap, 0, top, width, partHeight, 0, 0, width, partHeight);
            const rendered = await canvas.convertToBlob({type:'image/png'});
            if (renderedBytes + assetBytes + rendered.size > 32 * MiB) limit();
            preparedBytes = new Uint8Array(await rendered.arrayBuffer());
          } finally { canvas.width = 0; canvas.height = 0; }
        }
        assetBytes += preparedBytes.length;
        if (renderedBytes + assetBytes > 32 * MiB) limit();
        const id = 'image' + names.size + '_' + parts.length;
        entries.push([id,dataUrl(preparedBytes,type)]);
        parts.push({id,width,height:partHeight});
      }
      renderedBytes += assetBytes;
      Object.assign(images,Object.fromEntries(entries));
      names.set(asset.path, parts[0].id);
      dimensions.set(asset.path, {width, height});
      if (parts.length > 1) slices.set(asset.path,parts);
      if (raster.type === 'image/gif' || raster.type === 'image/webp') staticImages++;
    } catch (error) {
      if (error.code === 'PDF_LIMIT') throw error;
      skipped++;
    } finally { bitmap?.close(); }
  }
  return {images, names, dimensions, slices, skipped, staticImages};
}

function tableRows(table) {
  const rows = [];
  for (const node of table.children || []) {
    if (node.tag === 'tr') rows.push({node, header: false});
    if (SECTIONS.has(node.tag)) {
      for (const row of node.children || []) {
        if (row.tag === 'tr') rows.push({node:row, header:node.tag === 'thead'});
      }
    }
  }
  return rows;
}
function isHeading(tag) { return /^h[1-6]$/.test(tag); }
function withDecoration(inherited = [], decoration) {
  return inherited.includes(decoration) ? inherited : [...inherited, decoration];
}
function boundLongTokens(value) {
  // pdfmake remeasures the remaining text at each forced line break.
  return value.replace(/[^\s\u200b\u3000-\u9fff]{128,}/gu, token => token.match(/.{1,64}/gu).join('\u200b'));
}
function columnWidths(grid, count, availableWidth, hints) {
  const source = normalizeColumnWidths(hints);
  if (source?.length === count) {
    const padding = source.map((_, index) => (index ? COLUMN_GAP / 2 : 0) + (index < count - 1 ? COLUMN_GAP / 2 : 0));
    const widths = Array(count);
    let pending = source.map((_, index) => index), remaining = availableWidth, total = 10000;
    while (pending.length) {
      const available = remaining, weightTotal = total;
      const narrow = pending.filter(index => available * source[index] / weightTotal - padding[index] < MIN_COLUMN_WIDTH);
      if (!narrow.length) {
        for (const index of pending) widths[index] = remaining * source[index] / total - padding[index];
        break;
      }
      for (const index of narrow) {
        widths[index] = MIN_COLUMN_WIDTH;
        remaining -= MIN_COLUMN_WIDTH + padding[index];
        total -= source[index];
      }
      pending = pending.filter(index => widths[index] === undefined);
    }
    return widths;
  }
  const weights = Array(count).fill(1);
  function contentUnits(node) {
    let longest = 0, line = 0;
    for (const character of plain(node)) {
      if (character === '\n' || character === '\r') { longest = Math.max(longest, line); line = 0; }
      else line += character.codePointAt(0) < 128 ? .55 : 1;
    }
    function hasImage(item) {
      return typeof item !== 'string' && (item.tag === 'img' || (item.children || []).some(hasImage));
    }
    return Math.min(160, Math.max(1, longest, line, hasImage(node) ? 20 : 0));
  }
  for (const row of grid) {
    for (let column = 0; column < row.length; column++) {
      const entry = row[column];
      if (!entry?.cell) continue;
      const weight = Math.sqrt(contentUnits(entry.cell) / entry.colSpan);
      for (let index = column; index < column + entry.colSpan; index++) weights[index] = Math.max(weights[index], weight);
    }
  }
  const budget = availableWidth - (count - 1) * COLUMN_GAP;
  const remaining = budget - count * MIN_COLUMN_WIDTH;
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
  return weights.map(weight => MIN_COLUMN_WIDTH + remaining * weight / totalWeight);
}
export function pdfDefinition(snapshot, prepared = {images:{}, names:new Map()}) {
  checkedSize(snapshot);
  let denseTables = 0, equations = 0;
  const missingGlyphs = new Set();
  function auditGlyphs(text) {
    if (prepared.fontCoverage) {
      for (const glyph of missingEmojiGlyphs(text,prepared.fontCoverage)) { missingGlyphs.add(glyph); }
    }
  }
  function textLine(str, add = {}) {
    auditGlyphs(str);
    const runs = splitEmojiRuns(str);
    if (!runs.some(run => run.font)) return {text:boundLongTokens(str), ...add};
    return {text:runs.map(run => run.font ? run : {text:boundLongTokens(run.text)}), ...add};
  }
  function codeLine(source, add = {}) {
    const runs = source.match(/[\x00-\x7f]+|[^\x00-\x7f]+/gu) || [];
    return {text:runs.map(text => textLine(text,{font:/^[\x00-\x7f]+$/u.test(text) ? 'Courier' : 'Noto'})),
      preserveLeadingSpaces:true, ...add};
  }
  function sequence(nodes, availableWidth, fontSize, cellColor) {
    const out = [], buffer = [];
    function flush() { if (buffer.length) out.push({text:buffer.splice(0)}); }
    function walk(node, style) {
      if (typeof node === 'string') { if (node) buffer.push(textLine(node, style)); return; }
      const tag = node.tag;
      if (typeof node.equation === 'string') {
        equations++;
        const source = codeLine(node.equation,style);
        if (node.display === 'block') { flush(); out.push({...source,margin:[0,4,0,5]}); }
        else buffer.push(source);
        return;
      }
      if (tag === 'br') { buffer.push(textLine('\n', style)); return; }
      if (tag === 'img') {
        flush();
        const id = prepared.names.get(node.path);
        if (id) {
          const slices = prepared.slices?.get(node.path);
          const size = prepared.dimensions?.get(node.path);
          if (slices) {
            for (const part of slices) out.push({image:part.id,width:Math.min(availableWidth,part.width * .75),margin:[0,3,0,3]});
          } else {
            const fit = size ? [Math.min(availableWidth, size.width * .75), Math.min(MAX_IMAGE_HEIGHT, size.height * .75)]
              : [Math.min(315,availableWidth), 245];
            out.push({image:id, fit, margin:[0,3,0,3]});
          }
        }
        if (node.alt || !id) out.push(textLine(node.alt || '图片无法排版', {fontSize:9,color:cellColor ?? '#596960'}));
        return;
      }
      if (INLINE.has(tag)) {
        const next = {...style};
        if (tag === 'strong' || tag === 'b') next.bold = true;
        if (tag === 'em' || tag === 'i') next.italics = true;
        if (tag === 's' || tag === 'del' || tag === 'strike') next.decoration = withDecoration(style.decoration, 'lineThrough');
        if (tag === 'small' || tag === 'sup' || tag === 'sub') next.fontSize = 8;
        if (tag === 'u') next.decoration = withDecoration(style.decoration, 'underline');
        if (tag === 'a' && /^(?:https?:\/\/|mailto:)/i.test(node.href || '')) {
          next.link = node.href; next.color = cellColor ?? '#155e50'; next.decoration = withDecoration(style.decoration, 'underline');
        }
        if (tag === 'code' && !cellColor) next.background = '#edf1ee';
        (node.children || []).forEach(child => walk(child, next));
        return;
      }
      flush(); out.push(block(node, availableWidth, fontSize, cellColor));
    }
    nodes.forEach(node => walk(node, {})); flush();
    return out.length ? out : [{text:''}];
  }
  function table(node, availableWidth, fontSize, cellColor) {
    const rows = tableRows(node);
    if (!rows.length) return textLine('');
    const rowCells = rows.map(({node}) => (node.children || []).filter(cell => cell.tag === 'td' || cell.tag === 'th'));
    const grid = rows.map(() => []);
    let width = 0, headers = 0;
    for (let r = 0; r < rows.length; r++) {
      const cells = rowCells[r];
      if (r === headers && (rows[r].header || (cells.length && cells.every(c => c.tag === 'th')))) headers++;
      let c = 0;
      for (const cell of cells) {
        while (grid[r][c] !== undefined) c++;
        const cs = Math.max(1, cell.colspan || 1), rs = Math.max(1, Math.min(rows.length - r, cell.rowspan || 1));
        if (c + cs > 12 || (c + cs) * rows.length > 14000) return flatTable();
        for (let y = r; y < r+rs; y++) {
          for (let x = c; x < c+cs; x++) {
            if (grid[y][x] !== undefined) return flatTable();
            grid[y][x] = {};
          }
        }
        grid[r][c] = {cell, colSpan:cs, rowSpan:rs};
        width = Math.max(width, c + cs); c += cs;
      }
    }
    if (!width) return textLine('');
    const columnWidth = (availableWidth - (width - 1) * COLUMN_GAP) / width;
    if (columnWidth < MIN_COLUMN_WIDTH) return flatTable();
    const widths = columnWidths(grid, width, availableWidth, node.columnWidths);
    if (headers >= rows.length) headers = 0;
    const body = grid.map(row => Array.from({length:width}, (_, index) => {
      const entry = row[index];
      if (!entry) return {text:''};
      if (!entry.cell) return {};
      const {cell, colSpan, rowSpan} = entry;
      const style = normalizeCellStyle(cell);
      const color = style.color ?? cellColor;
      const cellWidth = widths.slice(index, index + colSpan).reduce((sum, value) => sum + value, 0) + (colSpan - 1) * COLUMN_GAP;
      return {stack:sequence(cell.children || [], cellWidth, 9, color), bold:cell.tag === 'th',
        fillColor:style.background ?? (cell.tag === 'th' && !cellColor ? '#e5eee8' : undefined), color,
        alignment:style.align, verticalAlignment:style.valign, colSpan, rowSpan};
    }));
    return {table:{headerRows:headers, widths, body}, layout:'lightHorizontalLines', fontSize:9, margin:[0,5,0,6]};
    function flatTable() {
      denseTables++;
      const stack = rowCells.map(cells => {
        const nodes = cells.flatMap((cell, index) => [...(index ? ['　｜　'] : []), ...(cell.children || [])]);
        return {stack:sequence(nodes, availableWidth, fontSize, cellColor),margin:[0,0,0,4]};
      });
      return {stack, margin:[0,4,0,6]};
    }
  }
  function block(node, availableWidth, fontSize, cellColor) {
    const tag = node.tag, kids = node.children || [];
    if (isHeading(tag)) {
      const level = Number(tag[1]);
      const headingSize = [22,17,14,12,11,10][level-1];
      return {stack:sequence(kids, availableWidth, headingSize, cellColor), bold:true, fontSize:headingSize, margin:[0,8,0,4], headlineLevel:level};
    }
    if (tag === 'table') {
      const caption = kids.find(k => k.tag === 'caption');
      const content = table(node, availableWidth, fontSize, cellColor);
      return caption ? {stack:[{stack:sequence(caption.children || [], availableWidth, fontSize, cellColor), bold:true},content]} : content;
    }
    if (tag === 'ul' || tag === 'ol') {
      const items = kids.filter(x => x.tag === 'li');
      if (!items.length) return textLine('');
      const start = Number.isSafeInteger(node.start) ? node.start : 1;
      const markerChars = tag === 'ol' ? Math.max(String(start).length, String(start + items.length - 1).length) : 1;
      // Allow for pdfmake's number, period and space when budgeting width for list content.
      const itemWidth = availableWidth - fontSize * (markerChars * .6 + .7);
      const margin = [0,3,0,4];
      if (itemWidth < MIN_COLUMN_WIDTH) {
        return {
          stack:items.map((item,index) => ({stack:[textLine(tag === 'ol' ? (start+index)+'.' : '•'),
            ...sequence(item.children || [], availableWidth, fontSize, cellColor)]})), margin
        };
      }
      return {[tag]:items.map(item => ({stack:sequence(item.children || [], itemWidth, fontSize, cellColor)})),
        ...(tag === 'ol' ? {start} : {}), margin};
    }
    if (tag === 'hr') return {canvas:[{type:'line', x1:0, y1:0, x2:Math.min(200,availableWidth), y2:0, lineWidth:.5, lineColor:'#9bafa4'}],margin:[0,6,0,6]};
    if (tag === 'pre') {
      return codeLine(plain(node),{fontSize:9,margin:[Math.min(6,availableWidth-MIN_COLUMN_WIDTH),4,0,5],color:cellColor ?? '#314d40'});
    }
    if (tag === 'blockquote') {
      const indent = Math.min(14,availableWidth-MIN_COLUMN_WIDTH);
      return {stack:sequence(kids, availableWidth-indent, fontSize, cellColor),margin:[indent,4,0,5],color:cellColor ?? '#4b6057'};
    }
    return {stack:sequence(kids, availableWidth, fontSize, cellColor), margin:[0,1,0,3]};
  }
  const content = sequence(snapshot.blocks, PAGE_WIDTH, 10);
  function matchesTitle(node) {
    if (typeof node === 'string') return false;
    return (node.tag === 'h1' && plain(node).replace(/\s+/gu,' ').trim() === snapshot.title.trim()) || (node.children || []).some(matchesTitle);
  }
  const hasTitle = snapshot.blocks.some(matchesTitle);
  if (!hasTitle) content.unshift(textLine(snapshot.title,{bold:true,fontSize:22,margin:[0,0,0,9]}));
  const notices = new Map((snapshot.warnings || []).map(({code,label}) => [label || warningLabel(code),
    warningLabel(code) + (label ? ' · ' + label : '')]));
  for (const notice of notices.values()) auditGlyphs(notice);
  const notes = [];
  if (prepared.skipped) notes.push(prepared.skipped + ' 幅图片已用文字说明');
  if (prepared.staticImages) notes.push(prepared.staticImages + ' 幅图片以静态画面排版');
  if (denseTables) notes.push(denseTables + ' 个宽表已按行展开');
  if (equations) notes.push(equations + ' 处公式已保留为 LaTeX 源码，未进行数学排版');
  if (missingGlyphs.size) {
    const codepoints = [...missingGlyphs].map(glyph => [...glyph].map(character =>
      'U+' + character.codePointAt(0).toString(16).toUpperCase().padStart(4,'0')).join(' '));
    notes.push('PDF 字体未覆盖的表情或符号：' + codepoints.join('；') + '。原字符已保留，可能显示为空框。');
  }
  for (const note of notes) if (!notices.has(note)) notices.set(note,note);
  if (prepared.slices?.size) {
    const note = prepared.slices.size + ' 幅长图已按原分辨率连续分段排版';
    notices.set(note,note);
  }
  if (notices.size) {
    content.push({text:'保存提示',bold:true,fontSize:12,margin:[0,10,0,5]},
      {ul:[...notices.values()].map(notice => textLine(notice)),fontSize:9,color:'#715522'});
  }
  return {denseTables, notes, doc:{info:{title:snapshot.title, creator:'本地导出工具'}, pageSize:'A4',pageMargins:PAGE_MARGINS,
    defaultStyle:{font:'Noto',fontSize:10,lineHeight:1.2,color:'#202c25'}, images:prepared.images, content,
    footer:(page, pages) => ({text:page+' / '+pages,alignment:'center',fontSize:8,color:'#68756d',margin:[0,10,0,0]})}};
}
