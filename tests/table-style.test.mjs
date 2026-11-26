import assert from 'node:assert/strict';
import test from 'node:test';
import { parseFragment } from 'parse5';
import { cellStyleText, isAuxiliaryTable, logicalTableRows, normalizeColumnWidths, readCellStyle, readTableColumnWidths } from '../src/table-style.js';

test('固定表头副本只按明确 class token 判断，兼容 DOM 与 parse5', () => {
  assert.equal(isAuxiliaryTable({classList:{contains:token => token === 'sticky-row-wrapper'}}), true);
  const read = classes => isAuxiliaryTable(parseFragment('<table class="' + classes + '"></table>').childNodes[0]);
  assert.equal(read('table sticky-row-wrapper header-row'), true);
  assert.equal(read('table header-row'), false);
  assert.equal(read('table not-sticky-row-wrapper sticky-row-wrapper-copy'), false);
});

test('懒加载表格尚未挂载时辅助表判断安全返回 false', () => {
  assert.equal(isAuxiliaryTable(null), false);
  assert.equal(isAuxiliaryTable(undefined), false);
});

test('逻辑表格行兼容仅 rows 的 DOM，按稳定 ID 区分独立表头和重复副本', () => {
  const cell = (id, textContent) => ({textContent,getAttribute:name => name === 'data-block-id' ? id : null});
  const header = {cells:[cell('head', '系统')]}, data = {cells:[cell('data', 'Rocky')]};
  const auxiliary = {tagName:'TABLE',rows:[header],classList:{contains:token => token === 'sticky-row-wrapper'}};
  const main = {tagName:'TABLE',rows:[data]};
  const block = {children:[auxiliary, main]};
  const detached = logicalTableRows(block, main);
  assert.deepEqual(detached.map(entry => [entry.row,entry.section,entry.auxiliary]), [[header,'thead',true],[data,'tbody',false]]);
  const duplicate = {cells:[cell('head','系统')]};
  main.rows = [duplicate, data];
  assert.deepEqual(logicalTableRows(block, main).map(entry => [entry.row,entry.section]), [[duplicate,'thead'],[data,'tbody']]);
  main.rows = [{cells:[cell('different-head','系统')]}];
  assert.equal(logicalTableRows(block, main).length, 2);
  assert.deepEqual(logicalTableRows(block, null), []);
});

test('表格样式只采用最后合法白名单声明，CSS 函数、注释和优先级不能穿过边界', () => {
  const fields = readCellStyle('background-color:#123;background-color:url(https://bad.invalid/x);' +
    'color:rgb(255,255,255);color:expression(alert(1));' +
    'text-align:left;text-align:center;text-align:right!important;' +
    'vertical-align:bottom;vertical-align:top/* override */;position:fixed;__proto__:bad;constructor:bad');
  assert.deepEqual(fields, {background:'#112233',color:'#ffffff',align:'center',valign:'bottom'});
  assert.equal(cellStyleText(fields), 'background-color:#112233;color:#ffffff;text-align:center;vertical-align:bottom');
  assert.deepEqual(readCellStyle('background-color:var(--color);color:rgba(0,0,0,.5);text-align:inherit;vertical-align:1px'), {});
});

test('列宽保持有限正整数比例并可稳定重复规范化', () => {
  for (const source of [[1,2,3], [1,3], [Number.MIN_VALUE,Number.MAX_VALUE], Array(64).fill(1)]) {
    const result = normalizeColumnWidths(source);
    assert.equal(result.reduce((sum, width) => sum + width, 0), 10000);
    assert.ok(result.every(width => Number.isInteger(width) && width >= 1));
    assert.deepEqual(normalizeColumnWidths(result), result);
  }
  for (const source of [[], Array(65).fill(1), [1,0], [1,-1], [1,Infinity], [1,NaN], [1,'2']]) {
    assert.equal(normalizeColumnWidths(source), undefined);
  }
});

test('来源列宽限制 span、单位与完整性，不拾取内层表格列', () => {
  const read = contents => readTableColumnWidths(parseFragment('<table>' + contents + '</table>').childNodes[0]);
  assert.deepEqual(read('<colgroup><col width="1"><col span="2" style="width:2px"></colgroup>'), [2000,4000,4000]);
  assert.deepEqual(read('<colgroup span="2" width="50%"></colgroup>'), [5000,5000]);
  for (const contents of [
    '<colgroup><col width="1"><col></colgroup>',
    '<colgroup><col width="1px"><col width="20%"></colgroup>',
    '<colgroup><col width="1" span="65"></colgroup>',
    '<colgroup><col width="1" span="2x"></colgroup>',
    '<colgroup><col style="width:calc(100% - 1px)"></colgroup>',
    '<tr><td><table><colgroup><col width="1"></colgroup><tr><td>内层</td></tr></table></td></tr>',
  ]) assert.equal(read(contents), undefined);
});
