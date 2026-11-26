import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {userscriptDiagnostics, assertUserscriptLint} from '../tools/userscript-lint.mjs';

test('distributed userscript passes the default Tampermonkey editor checks', async () => {
  const source = await fs.readFile(new URL('../lark-doc-exporter.user.js', import.meta.url), 'utf8');
  assertUserscriptLint(source);
  for (const [example, rule] of [
    ["(() => { const object = {}; object['name']; })();",'dot-notation'],
    ['(() => { var repeated; var repeated; })();','no-redeclare'],
    ['(() => { if (true)\n  Math.random(); })();','curly'],
  ]) {
    assert.ok(userscriptDiagnostics(source + '\n' + example).some(message => message.ruleId === rule), rule + ' remains active after bundled libraries');
  }
});

test('editor gate keeps undefined names, duplicate declarations, syntax and eval checks active', () => {
  for (const [source, rule] of [
    ['(() => { missingBrowserApi(); })();','no-undef'],
    ['(() => { var value; var value; })();','no-redeclare'],
    ['(() => { eval("1"); })();','no-eval'],
  ]) {
    assert.ok(userscriptDiagnostics(source).some(message => message.ruleId === rule), rule);
  }
  assert.ok(userscriptDiagnostics('(() => { const = ; })();').some(message => message.fatal));
  assert.deepEqual(userscriptDiagnostics('/* global globalThis:readonly */\n(() => { globalThis.location; GM_getResourceText("pdfEngine"); })();'), []);
});

test('upstream style exceptions do not leak into any first-party module', async () => {
  const source = await fs.readFile(new URL('../lark-doc-exporter.user.js', import.meta.url), 'utf8');
  let modules = 0;
  const probe = `(() => { var repeated; var repeated; const object = {}; object['name'];
    if (true)
      Math.random();
    let index = 0; index++, index++;
  })();\n`;
  const checked = source.replace(/^(\s*\/\/ src\/[^\n]+\n)/gm, marker => { modules++; return marker + probe; });
  assert.ok(modules > 0);
  const messages = userscriptDiagnostics(checked);
  for (const rule of ['dot-notation', 'no-redeclare', 'curly', 'no-sequences']) {
    assert.equal(messages.filter(message => message.ruleId === rule).length, modules, rule);
  }
});
