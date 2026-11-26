import { parseFragment, serializeOuter } from 'parse5';
import { cellStyleText, normalizeAlign, normalizeColor, normalizeColumnWidths, normalizeValign } from '../table-style.js';

function rgba(value) {
  const opaque = normalizeColor(value);
  if (opaque) return [...[1,3,5].map(index => parseInt(opaque.slice(index,index+2),16)),1];
  const match = /^rgba?\(([^)]+)\)$/iu.exec(value || '');
  if (!match) return [0,0,0,0];
  const parts = match[1].trim().split(/\s*[,/]\s*|\s+/u);
  if (parts.length !== 3 && parts.length !== 4) return [0,0,0,0];
  const numbers = parts.map((part,index) => Number(part.replace(/%$/u,'')) * (part.endsWith('%') ? index < 3 ? 2.55 : .01 : 1));
  if (!numbers.every((value,index) => Number.isFinite(value) && value >= 0 && value <= (index < 3 ? 255 : 1))) return [0,0,0,0];
  return [...numbers.slice(0,3),numbers[3] ?? 1];
}

const hex = channels => '#' + channels.map(value => Math.round(value).toString(16).padStart(2,'0')).join('');
const blend = (front, back) => front.slice(0,3).map((channel,index) => channel * front[3] + back[index] * (1-front[3]));

function alignment(style) {
  const value = style.textAlign?.toLowerCase();
  return normalizeAlign(value === 'start' ? style.direction === 'rtl' ? 'right' : 'left'
    : value === 'end' ? style.direction === 'rtl' ? 'left' : 'right' : value);
}

function span(node, name, maximum = 64) {
  const raw = node.getAttribute(name);
  return raw == null || raw === '' ? 1 : /^\d{1,5}$/u.test(raw) && Number(raw) >= 1 && Number(raw) <= maximum ? Number(raw) : 0;
}

function tableGrid(table, isHiddenCell) {
  let occupied = [], columns = 0, section;
  const complete = [];
  for (const row of table.rows) {
    if (row.parentElement !== section) occupied = [];
    section = row.parentElement;
    let cursor = 0, plain = !occupied.some(Boolean);
    const next = occupied.map(value => Math.max(0,value-1));
    const cells = [...row.cells].filter(cell => !isHiddenCell(cell));
    for (const cell of cells) {
      const across = span(cell,'colspan');
      const down = cell.getAttribute('rowspan') === '0' ? table.rows.length : span(cell,'rowspan',65534);
      if (!across || !down) return;
      plain &&= across === 1 && down === 1;
      while (occupied[cursor]) cursor++;
      if (occupied.slice(cursor,cursor+across).some(Boolean)) return;
      for (let index=cursor;index<cursor+across;index++) next[index] = Math.max(next[index] || 0,down-1);
      cursor += across;
      if (cursor > 64) return;
    }
    columns = Math.max(columns,cursor,occupied.length);
    if (plain && cells.length) complete.push(cells);
    occupied = next;
  }
  return {columns,complete};
}

function measuredWidths(table, isHiddenCell) {
  const grid = tableGrid(table,isHiddenCell);
  if (!grid?.columns) return;
  const widths = [];
  let valid = true;
  for (const child of table.children || []) {
    if (child.localName !== 'colgroup' && child.localName !== 'col') continue;
    const cols = child.localName === 'col' ? [child] : [...child.children].filter(node => node.localName === 'col');
    for (const col of cols.length ? cols : [child]) {
      const count = span(col,'span'), width = col.getBoundingClientRect().width;
      if (!count || !Number.isFinite(width) || width <= 0 || widths.length + count > 64) {valid=false;break;}
      widths.push(...Array(count).fill(width/count));
    }
    if (!valid) break;
  }
  if (valid && widths.length === grid.columns) return normalizeColumnWidths(widths);
  // A merged cell does not reveal its individual tracks. Use only a whole row
  // with no spans of its own and no earlier rowspan occupying one of its slots.
  for (const cells of grid.complete) {
    if (cells.length !== grid.columns) continue;
    const result = normalizeColumnWidths(cells.map(cell => cell.getBoundingClientRect().width));
    if (result) return result;
  }
}

function styledHtml(html, style) {
  if (!style) return html;
  const table = parseFragment('<table><tbody><tr>' + html + '</tr></tbody></table>').childNodes[0];
  const cell = table?.childNodes[0]?.childNodes[0]?.childNodes.find(node => node.tagName === 'td' || node.tagName === 'th');
  if (!cell) return html;
  const existing = cell.attrs.find(attr => attr.name === 'style');
  if (existing) existing.value = existing.value.replace(/;?\s*$/u,'') + ';' + style;
  else cell.attrs.push({name:'style',value:style});
  return serializeOuter(cell);
}

export function createTableStyleCapture() {
  let styles = new WeakMap(), backgrounds = new WeakMap(), cells = new WeakMap(), tables = new WeakMap();
  const canRead = node => node?.nodeType === 1 && typeof node.ownerDocument?.defaultView?.getComputedStyle === 'function';
  function readStyle(node) {
    if (styles.has(node)) return styles.get(node);
    if (!canRead(node)) return {};
    const computed = node.ownerDocument.defaultView.getComputedStyle(node);
    const snapshot = Object.fromEntries(['backgroundColor','color','textAlign','verticalAlign','direction','display'].map(key => [key,computed[key]]));
    styles.set(node,snapshot);
    return snapshot;
  }
  function cellState(cell, html = cell.outerHTML) {
    let cached = cells.get(cell);
    if (cached?.html !== html) {
      styles.delete(cell); backgrounds.delete(cell);
      cached = {html};
      cells.set(cell,cached);
    }
    return cached;
  }
  function isHiddenCell(cell) {
    if (cell.hidden || cell.getAttribute?.('hidden') != null || cell.getAttribute?.('aria-hidden') === 'true') return true;
    if (!canRead(cell)) return false;
    const cached = cellState(cell);
    if (cached.hidden === undefined) cached.hidden = readStyle(cell).display === 'none';
    return cached.hidden;
  }
  function background(node) {
    const layers = [];
    let result;
    while (node) {
      if (backgrounds.has(node)) {result=backgrounds.get(node);break;}
      const layer = rgba(readStyle(node).backgroundColor);
      layers.push({node,layer});
      if (layer[3] === 1) {result={channels:layer.slice(0,3),captured:true};break;}
      node = node.parentElement;
    }
    result ||= {channels:[255,255,255],captured:false};
    for (const {node,layer} of layers.reverse()) {
      result = {channels:blend(layer,result.channels),captured:result.captured || layer[3] > 0};
      backgrounds.set(node,result);
    }
    return result;
  }
  return {
    isHiddenCell,
    cellHtml(cell, html = cell.outerHTML) {
      if (!canRead(cell)) return html;
      const cached = cellState(cell,html);
      if (cached.styled !== undefined) return cached.styled;
      const style = readStyle(cell), fill = background(cell);
      const lines = [...cell.querySelectorAll('.ace-line')].filter(line => line.closest('td,th') === cell);
      const lineStyles = lines.map(line => {styles.delete(line);return readStyle(line);});
      const alignments = new Set(lineStyles.map(alignment));
      const foreground = value => {const color=rgba(value);return color[3] > 0 ? hex(blend(color,fill.channels)) : undefined;};
      const colors = new Set(lineStyles.map(line => foreground(line.color)));
      const value = cellStyleText({
        background:fill.captured ? hex(fill.channels) : undefined,
        color:fill.captured ? colors.size === 1 && !colors.has(undefined) ? [...colors][0] : foreground(style.color) : undefined,
        align:alignments.size === 1 && !alignments.has(undefined) ? [...alignments][0] : alignment(style),
        valign:normalizeValign(style.verticalAlign),
      });
      const visibility = cell.style?.display === 'none' && style.display && style.display !== 'none' && !isHiddenCell(cell)
        ? ';display:table-cell!important' : '';
      const styled = styledHtml(html,value+visibility);
      cached.styled = styled;
      return styled;
    },
    columnWidths(table) {
      if (!canRead(table)) return;
      const html = table.outerHTML, cached = tables.get(table);
      if (cached?.html === html) return cached.widths;
      const widths = measuredWidths(table,isHiddenCell);
      tables.set(table,{html,widths});
      return widths;
    },
    beginFinalReview() {
      styles = new WeakMap(); backgrounds = new WeakMap(); cells = new WeakMap(); tables = new WeakMap();
    },
  };
}
