import assert from 'node:assert/strict';
import test from 'node:test';
import { contrastRatio, deriveTheme, installTheme } from '../src/userscript/theme.js';

test('浅色与深色页面优先于相反的系统设置，保留可读页面颜色', () => {
  const light = deriveTheme({surface:'#fff', text:'#1f2329', muted:'#646a73', accent:'#3370ff', dark:true});
  assert.equal(light.mode, 'light');
  assert.equal(light.surface, '#ffffff');
  assert.equal(light.text, '#1f2329');
  const dark = deriveTheme({surface:'rgb(32, 34, 37)', text:'#e8e9eb', accent:'#7b83ff', dark:false});
  assert.equal(dark.mode, 'dark');
  assert.equal(dark.surface, '#202225');
  assert.equal(dark.text, '#e8e9eb');
  for (const theme of [light, dark]) {
    assert.ok(contrastRatio(theme.text, theme.surface) >= 4.5);
    assert.ok(contrastRatio(theme.muted, theme.surface) >= 4.5);
    assert.ok(contrastRatio(theme.accent, theme.surface) >= 3);
    assert.ok(contrastRatio(theme['accent-text'], theme.accent) >= 4.5);
    assert.ok(contrastRatio(theme.warning, theme.surface) >= 4.5);
  }
});

test('米色和紫色主题跟随页面，低对比度的文字和强调色得到修正', () => {
  const theme = deriveTheme({surface:'#f7efd9', text:'#eee8d7', muted:'#e6dfcc', accent:'#b5a7ed', warning:'#f5cc87'});
  assert.equal(theme.surface, '#f7efd9');
  assert.notEqual(theme.accent, '#28634b');
  assert.ok(contrastRatio(theme.text, theme.surface) >= 4.5);
  assert.ok(contrastRatio(theme.muted, theme.surface) >= 4.5);
  assert.ok(contrastRatio(theme.accent, theme.surface) >= 3);
  assert.ok(contrastRatio(theme['accent-text'], theme.accent) >= 4.5);
  assert.ok(contrastRatio(theme.warning, theme.surface) >= 4.5);
});

test('透明、无效或缺失颜色使用安全的系统主题兜底', () => {
  const dark = deriveTheme({surface:'transparent', text:'var(--missing)', accent:'garbage', dark:true});
  assert.equal(dark.mode, 'dark');
  assert.ok(contrastRatio(dark.text, dark.surface) >= 4.5);
  const translucent = deriveTheme({surface:'rgba(255,255,255,.1)', dark:true});
  assert.equal(translucent.mode, 'dark');
  assert.equal(deriveTheme().mode, 'light');
});

function browserTheme({dark = false, page = '#fff', vars = {}} = {}) {
  const properties = new Map();
  const root = {}, body = {parentElement:root}, content = {parentElement:body};
  const listeners = new Map();
  const media = {matches:dark, addEventListener:(name, callback) => listeners.set(name, callback)};
  const host = {style:{setProperty:(name, value) => properties.set(name, value)}, setAttribute(name, value) {this[name] = value;}};
  const view = {
    document:{documentElement:root, body, querySelector:() => content},
    matchMedia:() => media,
    getComputedStyle:el => ({backgroundColor:el === content ? page : 'transparent', color:'#1f2329', getPropertyValue:name => vars[name] || ''}),
  };
  return {host, view, properties, listeners, media, setPage(value) {page = value;}, vars};
}

test('安装后跟随页面语义变量和运行中的主题切换，无需重载', () => {
  const fixture = browserTheme({vars:{'--bg-float':'#f8f0e3','--primary-pri-500':'#7951b0'}});
  const theme = installTheme(fixture.view, fixture.host);
  assert.equal(fixture.properties.get('--fle-surface'), '#f8f0e3');
  assert.equal(fixture.host['data-theme'], 'light');
  fixture.vars['--bg-float'] = '#202225';
  fixture.vars['--text-title'] = '#e8e9eb';
  fixture.setPage('#17191b');
  theme.refresh();
  assert.equal(fixture.host['data-theme'], 'dark');
  assert.equal(fixture.properties.get('--fle-surface'), '#202225');
  assert.ok(contrastRatio(fixture.properties.get('--fle-muted'), '#202225') >= 4.5);
});

test('缺少页面样式时响应系统主题变化，简化 DOM mock 可安装', () => {
  const fixture = browserTheme();
  fixture.view.getComputedStyle = () => ({backgroundColor:'transparent', color:'transparent', getPropertyValue:() => ''});
  installTheme(fixture.view, fixture.host);
  fixture.media.matches = true;
  fixture.listeners.get('change')();
  assert.equal(fixture.host['data-theme'], 'dark');
  assert.doesNotThrow(() => installTheme({document:{}}, {style:{}, setAttribute(){}}).refresh());
});

test('第三方深色皮肤未更新飞书语义变量时，面板仍跟随实际文档', () => {
  const fixture = browserTheme({page:'#1b1d20', vars:{'--bg-float':'#fff','--text-title':'#1f2329'}});
  installTheme(fixture.view, fixture.host);
  assert.equal(fixture.host['data-theme'], 'dark');
  const surface = fixture.properties.get('--fle-surface');
  assert.equal(surface, '#1b1d20');
  assert.ok(contrastRatio(fixture.properties.get('--fle-text'), surface) >= 4.5);
});

test('第三方米色或紫色皮肤未更新语义变量时，面板跟随重涂的正文底色', () => {
  for (const background of ['#f7efd9','#e9e2ff']) {
    const fixture = browserTheme({page:background, vars:{'--bg-float':'#fff','--bg-body':'#fff'}});
    installTheme(fixture.view, fixture.host);
    assert.equal(fixture.properties.get('--fle-surface'), background);
  }
  const normalLayers = browserTheme({page:'#ffffff', vars:{'--bg-float':'#ffffff','--bg-body':'#f5f5f5'}});
  installTheme(normalLayers.view, normalLayers.host);
  assert.equal(normalLayers.properties.get('--fle-surface'), '#ffffff');
});

test('格式说明在普通和选中背景上都保持可读，包括临界对比度配色', () => {
  for (const input of [
    {surface:'#ffffff', text:'#777777', muted:'#777777'},
    {surface:'#202225', text:'#898b8f', muted:'#898b8f'},
    {surface:'#f7efd9', text:'#857e70', muted:'#857e70'},
  ]) {
    const theme = deriveTheme(input);
    for (const text of [theme.text, theme.muted]) for (const background of [theme.surface, theme.soft]) {
      assert.ok(contrastRatio(text, background) >= 4.5, `${text} on ${background}`);
    }
  }
});

test('主题未变时刷新不重复修改宿主样式', () => {
  const fixture = browserTheme();
  let writes = 0;
  fixture.host.style.setProperty = (name, value) => {writes++;fixture.properties.set(name,value);};
  const theme = installTheme(fixture.view, fixture.host);
  const initialWrites = writes;
  theme.refresh();theme.refresh();
  assert.ok(initialWrites > 0);
  assert.equal(writes, initialWrites);
});

test('飞书浅深蓝主题分离链接和按钮，按钮优先白字且均保持可读', () => {
  const light = deriveTheme({surface:'#ffffff', text:'#1f2329', accent:'#4070ff'});
  const dark = deriveTheme({surface:'#202225', text:'#e8e9eb', accent:'#4c88ff'});
  for (const theme of [light, dark]) {
    assert.equal(theme['button-text'], '#ffffff');
    assert.ok(contrastRatio(theme['button-text'], theme.button) >= 4.5);
    assert.ok(contrastRatio(theme.button, theme.surface) >= 3);
    assert.ok(contrastRatio(theme.accent, theme.surface) >= 4.5);
    assert.ok(contrastRatio(theme.accent, theme.soft) >= 4.5);
  }
  assert.notEqual(dark.accent, dark.button, '深色页亮色链接与白字深蓝按钮各有角色');
  assert.ok(parseInt(dark.accent.slice(1,3),16) >= 0x4c, '深色页链接保持亮蓝');
});

test('无法同时满足白字与按钮边界时采用安全黑白文字回退', () => {
  const theme = deriveTheme({surface:'#555555', accent:'#a9bbff'});
  assert.ok(contrastRatio(theme.button, theme.surface) >= 3);
  assert.ok(contrastRatio(theme['button-text'], theme.button) >= 4.5);
});

test('根与body主题属性变化立即刷新，监听范围不包括宿主或后代', () => {
  const fixture = browserTheme({vars:{'--bg-float':'#ffffff'}});
  let notify;
  const observed = [];
  fixture.view.MutationObserver = class {
    constructor(callback) {notify = callback;}
    observe(node, options) {observed.push({node, options});}
  };
  installTheme(fixture.view, fixture.host);
  assert.deepEqual(observed.map(item => item.node), [fixture.view.document.documentElement, fixture.view.document.body]);
  for (const {options} of observed) {
    assert.equal(options.attributes, true);
    assert.equal(options.subtree, false);
    assert.ok(options.attributeFilter.includes('class'));
    assert.ok(options.attributeFilter.includes('style'));
    assert.ok(options.attributeFilter.includes('data-theme'));
    assert.ok(options.attributeFilter.includes('data-color-mode'));
  }
  fixture.vars['--bg-float'] = '#202225';
  fixture.setPage('#202225');
  notify([{type:'attributes', attributeName:'data-theme'}]);
  assert.equal(fixture.host['data-theme'], 'dark');
  assert.equal(fixture.properties.get('--fle-surface'), '#202225');
});

test('中灰背景的选中底色不会跨过文字可读阈值', () => {
  for (const surface of ['#7a7a7a','#787878']) {
    const theme = deriveTheme({surface, text:'#000', muted:'#777'});
    for (const foreground of [theme.text, theme.muted, theme.accent]) {
      for (const background of [theme.surface, theme.soft]) {
        assert.ok(contrastRatio(foreground, background) >= 4.5, `${foreground} on ${background}`);
      }
    }
  }
});

test('稳定采样主题的两种背景始终存在共同可读的黑或白文字', () => {
  for (let index = 0; index < 768; index++) {
    const hex = value => '#' + (value % 0x1000000).toString(16).padStart(6,'0');
    const surface = index < 256 ? '#' + index.toString(16).padStart(2,'0').repeat(3) : hex(index * 7919);
    const theme = deriveTheme({surface, text:hex(index * 104729), muted:hex(index * 15485863), accent:hex(index * 32452843)});
    assert.ok(['#000000','#ffffff'].some(foreground => [theme.surface, theme.soft].every(background => contrastRatio(foreground, background) >= 4.5)), surface);
    for (const foreground of [theme.text, theme.muted, theme.accent]) for (const background of [theme.surface, theme.soft]) {
      assert.ok(contrastRatio(foreground, background) >= 4.5, `${foreground} on ${background}`);
    }
  }
});
