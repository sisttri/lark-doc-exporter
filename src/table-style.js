// Only these normalized table values cross the capture/import/render boundary.
const horizontal = new Set(['left', 'center', 'right', 'justify']);
const vertical = new Set(['top', 'middle', 'bottom']);

export function normalizeAlign(value) {
  const text = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return horizontal.has(text) ? text : undefined;
}

export function normalizeValign(value) {
  const text = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return vertical.has(text) ? text : undefined;
}

export function normalizeColor(value) {
  if (typeof value !== 'string' || value.length > 64) return;
  const text = value.trim().toLowerCase();
  if (/^#[\da-f]{6}$/u.test(text)) return text;
  if (/^#[\da-f]{3}$/u.test(text)) return '#' + [...text.slice(1)].map(char => char + char).join('');
  const rgb = /^rgb\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)$/u.exec(text) ||
    /^rgba\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*1(?:\.0+)?\s*\)$/u.exec(text);
  if (rgb && rgb.slice(1).every(channel => Number(channel) <= 255)) {
    return '#' + rgb.slice(1).map(channel => Number(channel).toString(16).padStart(2, '0')).join('');
  }
}

export function normalizeCellStyle(fields = {}) {
  const result = {};
  for (const field of ['background', 'color']) {
    const value = normalizeColor(fields?.[field]);
    if (value) result[field] = value;
  }
  const align = normalizeAlign(fields?.align), valign = normalizeValign(fields?.valign);
  if (align) result.align = align;
  if (valign) result.valign = valign;
  return result;
}

function declarations(style, validators) {
  const result = new Map();
  if (typeof style !== 'string') return result;
  for (const declaration of style.split(';')) {
    const colon = declaration.indexOf(':');
    if (colon < 0) continue;
    const name = declaration.slice(0, colon).trim().toLowerCase();
    let value = declaration.slice(colon + 1).trim();
    if (validators) {
      if (!Object.hasOwn(validators, name)) continue;
      value = validators[name](value);
      if (value === undefined) continue;
    }
    result.set(name, value);
  }
  return result;
}

export function readCellStyle(style, legacy = {}) {
  const values = declarations(style, {
    'background-color':normalizeColor,color:normalizeColor,'text-align':normalizeAlign,'vertical-align':normalizeValign,
  });
  return normalizeCellStyle({
    background:values.get('background-color') ?? legacy.bgcolor,
    color:values.get('color'),
    align:values.get('text-align') ?? legacy.align,
    valign:values.get('vertical-align') ?? legacy.valign,
  });
}

export function cellStyleText(fields) {
  const style = normalizeCellStyle(fields);
  return [['background', 'background-color'], ['color', 'color'], ['align', 'text-align'], ['valign', 'vertical-align']]
    .flatMap(([field, property]) => style[field] ? [property + ':' + style[field]] : []).join(';');
}

export function normalizeColumnWidths(values) {
  if (!Array.isArray(values) || !values.length || values.length > 64 ||
    !values.every(value => typeof value === 'number' && Number.isFinite(value) && value > 0)) return;
  if (values.every(Number.isInteger) && values.reduce((sum, value) => sum + value, 0) === 10000) return values.slice();
  const maximum = Math.max(...values);
  const weights = values.map(value => value / maximum);
  const total = weights.reduce((sum, value) => sum + value, 0);
  const exact = weights.map(value => value * 10000 / total);
  const widths = exact.map(value => Math.max(1, Math.floor(value)));
  let remaining = 10000 - widths.reduce((sum, value) => sum + value, 0);
  const order = exact.map((value, index) => index).sort((a, b) =>
    remaining >= 0 ? (exact[b] % 1) - (exact[a] % 1) || a - b : widths[b] - widths[a] || a - b);
  for (const index of order) {
    if (remaining > 0) { widths[index]++; remaining--; }
    else if (remaining < 0) {
      const removed = Math.min(-remaining, widths[index] - 1);
      widths[index] -= removed; remaining += removed;
    }
  }
  return widths;
}

function attr(node, name) {
  if (typeof node?.getAttribute === 'function') return node.getAttribute(name) ?? '';
  return node?.attrs?.find(item => item.name === name && !item.namespace)?.value ?? '';
}

export function isAuxiliaryTable(node) {
  if (!node) return false;
  if (typeof node?.classList?.contains === 'function') return node.classList.contains('sticky-row-wrapper');
  return attr(node, 'class').split(/\s+/u).includes('sticky-row-wrapper');
}

const tagName = node => (node?.localName || node?.tagName || '').toLowerCase();
const elementChildren = node => node?.children ? [...node.children] :
  (node?.childNodes ?? []).filter(child => tagName(child));

function directTableRows(table) {
  const rows = [];
  for (const group of elementChildren(table)) {
    const section = tagName(group);
    if (section === 'tr') rows.push({row:group,section:'tbody',group:table,auxiliary:false});
    else if (['thead','tbody','tfoot'].includes(section)) {
      for (const row of elementChildren(group)) if (tagName(row) === 'tr') rows.push({row,section,group,auxiliary:false});
    }
  }
  // Minimal capture DOMs can expose only the native table.rows collection.
  if (!rows.length && table?.rows) {
    for (const row of table.rows) {
      const group = row.parentElement || table, section = tagName(group);
      rows.push({row,section:['thead','tfoot'].includes(section) ? section : 'tbody',group,auxiliary:false});
    }
  }
  return rows;
}

function cellText(node) {
  if (tagName(node) === 'table') return '';
  if (node.nodeName === '#text') return node.value ?? node.nodeValue ?? '';
  if (node.childNodes?.length) return [...node.childNodes].map(cellText).join('');
  return typeof node.textContent === 'string' ? node.textContent : '';
}

function sameTableRow(first, second) {
  const cells = row => row.cells ? [...row.cells] : elementChildren(row).filter(cell => ['td','th'].includes(tagName(cell)));
  const left = cells(first), right = cells(second);
  return left.length > 0 && left.length === right.length && left.every((cell, index) => {
    const other = right[index];
    if (['colspan','rowspan'].some(span => (Number(attr(cell, span)) || 1) !== (Number(attr(other, span)) || 1))) return false;
    const id = attr(cell, 'data-block-id'), otherId = attr(other, 'data-block-id');
    if (id && otherId) return id === otherId;
    const text = value => cellText(value).replace(/[\u200b\ufeff\u2060]/gu, '').replace(/\s+/gu, ' ').trim();
    return text(cell) === text(other);
  });
}

export function logicalTableRows(block, main) {
  if (!main) return [];
  const rows = directTableRows(main);
  if (elementChildren(main).some(group => tagName(group) === 'thead') || rows.some(row => row.section === 'thead')) return rows;
  const headerTables = [];
  function visit(node) {
    if (node === main) return;
    if (tagName(node) === 'table') {
      if (isAuxiliaryTable(node)) {
        const entries = directTableRows(node);
        if (!headerTables.some(previous => previous.length === entries.length &&
          previous.every((entry, index) => sameTableRow(entry.row, entries[index].row)))) headerTables.push(entries);
      }
      return;
    }
    for (const child of elementChildren(node)) visit(child);
  }
  visit(block);
  const headers = headerTables.flatMap(entries => entries.map(entry => ({...entry,section:'thead',auxiliary:true})));
  let duplicate = 0;
  while (duplicate < headers.length && duplicate < rows.length && sameTableRow(headers[duplicate].row, rows[duplicate].row)) duplicate++;
  return [...rows.slice(0, duplicate).map(entry => ({...entry,section:'thead'})), ...headers.slice(duplicate), ...rows.slice(duplicate)];
}

function parseWidth(value) {
  const match = /^(\d+(?:\.\d+)?|\.\d+)\s*(px|%)?$/iu.exec(value.trim());
  if (match && Number(match[1]) > 0 && Number.isFinite(Number(match[1]))) {
    return {value:Number(match[1]),unit:match[2]?.toLowerCase() || 'px'};
  }
}

function columnWidth(node) {
  return declarations(attr(node, 'style'), {width:parseWidth}).get('width') || parseWidth(attr(node, 'width'));
}

export function readTableColumnWidths(table) {
  const values = [];
  let unit;
  for (const group of table.childNodes ?? []) {
    if (group.tagName !== 'colgroup') continue;
    const columns = (group.childNodes ?? []).filter(node => node.tagName === 'col');
    for (const column of columns.length ? columns : [group]) {
      const width = columnWidth(column) || (column !== group ? columnWidth(group) : undefined);
      const rawSpan = attr(column, 'span');
      const span = rawSpan === '' ? 1 : /^\d{1,2}$/u.test(rawSpan) ? Number(rawSpan) : 0;
      if (!width || span < 1 || span > 64 || values.length + span > 64 || (unit && width.unit !== unit)) return;
      unit = width.unit;
      values.push(...Array(span).fill(width.value));
    }
  }
  return normalizeColumnWidths(values);
}

export function columnGroupHtml(values) {
  const widths = normalizeColumnWidths(values);
  return widths ? '<colgroup>' + widths.map(width => '<col style="width:' + width / 100 + '%">').join('') + '</colgroup>' : '';
}
