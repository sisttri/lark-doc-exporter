import {Linter} from 'eslint';
import fs from 'node:fs/promises';
import {fileURLToPath} from 'node:url';

// Tampermonkey 5.5.1's default editor rules, including its ES6 browser globals.
// GM grants are supplied by the userscript manager rather than the web page.
const config = {
  env:{es6:true, browser:true},
  globals:{GM_registerMenuCommand:'readonly', GM_getResourceText:'readonly'},
  parserOptions:{ecmaVersion:2022, sourceType:'script', ecmaFeatures:{globalReturn:true}, allowAwaitOutsideFunction:true},
  rules:{
    curly:[1,'multi-line'], 'dot-location':0, 'dot-notation':[1,{allowKeywords:true}],
    'no-caller':1, 'no-case-declarations':2, 'no-div-regex':0, 'no-empty-pattern':2,
    'no-eq-null':0, 'no-eval':1, 'no-extra-bind':1, 'no-fallthrough':1,
    'no-implicit-globals':2, 'no-implied-eval':1, 'no-lone-blocks':1, 'no-loop-func':1,
    'no-multi-spaces':1, 'no-multi-str':1, 'no-native-reassign':1, 'no-octal-escape':2,
    'no-octal':2, 'no-proto':1, 'no-redeclare':2, 'no-return-assign':1, 'no-sequences':1,
    'no-undef':1, 'no-useless-call':1, 'no-useless-concat':1, 'no-with':1,
  },
};

export function userscriptDiagnostics(source) {
  return new Linter({configType:'eslintrc'}).verify(source, config);
}

export function assertUserscriptLint(source) {
  const messages = userscriptDiagnostics(source);
  if (messages.length) {
    throw new Error('油猴编辑器静态检查未通过（' + messages.length + ' 项）：\n' +
      messages.slice(0,20).map(item => `${item.line}:${item.column} ${item.ruleId || 'syntax'} ${item.message}`).join('\n'));
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  assertUserscriptLint(await fs.readFile(new URL('../lark-doc-exporter.user.js', import.meta.url), 'utf8'));
  console.log('油猴编辑器静态检查：0 错误，0 警告。');
}
