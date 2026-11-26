import test from 'node:test';
import assert from 'node:assert/strict';
import { readDocumentRoute, readDocumentSource } from '../src/userscript/source.js';

function pageView(href, { token = 'DocumentToken', title = '测试文档', mounted = true, embedded = '' } = {}) {
  const root = { getAttribute: key => key === 'data-record-id' ? token : null };
  const scroller = {};
  const view = {
    location: new URL(href),
    document: {
      title: '浏览器标题 - Feishu Docs',
      querySelector(selector) {
        if (selector === '.page-block-content') return mounted ? { textContent: title } : null;
        if (selector === '[data-block-type="page"]' || selector === '.page-block') return mounted ? root : null;
        if (selector === '.bear-web-x-container') return mounted ? scroller : null;
        return null;
      },
      querySelectorAll(selector) {
        return selector === 'iframe[src]' && embedded ? [{ getAttribute: () => embedded }] : [];
      },
    },
  };
  return { view, root, scroller };
}

test('任意飞书租户的独立文档和知识库路由保留资源身份，忽略查询参数与锚点', () => {
  for (const tenant of ['feishu.cn', 'alpha.feishu.cn', 'another-company.feishu.cn', 'sample-team.feishu.cn', 'my.feishu.cn', 'a.b.feishu.cn']) {
    for (const kind of ['docx', 'docs', 'wiki']) {
      const route = readDocumentRoute(new URL('https://' + tenant + '/' + kind + '/Abc123?from=share#anchor'));
      assert.equal(route.key, kind + ':Abc123');
      assert.equal(route.kind, kind);
      assert.equal(route.token, 'Abc123');
    }
  }
  assert.notEqual(readDocumentRoute('https://alpha.feishu.cn/wiki/Same').key,
    readDocumentRoute('https://alpha.feishu.cn/docx/Same').key);
});

test('外部域名、伪装后缀、知识库设置和非文档链接不作为文档路由', () => {
  for (const url of [
    'https://feishu.cn.example.com/wiki/Token', 'https://myfeishu.cn/docx/Token',
    'https://example.com/wiki/Token', 'http://alpha.feishu.cn/docx/Token',
    'https://alpha.feishu.cn/wiki/settings', 'https://alpha.feishu.cn/wiki/settings/space',
    'https://alpha.feishu.cn/drive/home', 'https://alpha.feishu.cn/wiki/Token/child',
  ]) assert.equal(readDocumentRoute(url).key, '', url);
});

test('文字正文就绪后才允许采集，新版和旧版链接均使用可识别的正文结构', () => {
  for (const kind of ['docx', 'docs', 'wiki']) {
    const { view } = pageView('https://another.feishu.cn/' + kind + '/DocumentToken');
    const source = readDocumentSource(view);
    assert.equal(source.key, kind + ':DocumentToken');
    assert.equal(source.ready, true);
    assert.equal(source.unsupported, false);
    assert.equal(source.docToken, 'DocumentToken');
    assert.equal(source.wikiToken, kind === 'wiki' ? 'DocumentToken' : '');
  }
  const { view } = pageView('https://another.feishu.cn/docx/DocumentToken', { mounted: false });
  const loading = readDocumentSource(view);
  assert.equal(loading.ready, false);
  assert.equal(loading.unsupported, false);
  assert.match(loading.reason, /正文/);
  assert.equal(loading.title, '浏览器标题');
});

test('独立文档换篇过渡中仍留存的旧根节点不被误认为新文档', () => {
  const { view } = pageView('https://another.feishu.cn/docx/NewDocument', { token: 'OldDocument' });
  assert.equal(readDocumentSource(view).ready, false);
  view.location.pathname = '/docx/OldDocument';
  assert.equal(readDocumentSource(view).ready, true);
});

test('Wiki 中识别到的电子表格与直接的其他文档类型返回明确类型提示', () => {
  for (const [path, label] of [['sheets', '电子表格'], ['base', '多维表格'], ['slides', '幻灯片'], ['file', '文件预览']]) {
    const { view } = pageView('https://another.feishu.cn/' + path + '/Other');
    const source = readDocumentSource(view);
    assert.equal(source.ready, false);
    assert.equal(source.unsupported, true);
    assert.match(source.reason, new RegExp(label));
  }
  const { view } = pageView('https://another.feishu.cn/wiki/Node', {
    mounted: false, embedded: 'https://another.feishu.cn/sheets/Other?from=wiki',
  });
  assert.equal(readDocumentSource(view).unsupported, true);
  assert.match(readDocumentSource(view).reason, /电子表格/);
  const documentWithEmbeddedSheet = pageView('https://another.feishu.cn/wiki/Node', {
    embedded: 'https://another.feishu.cn/sheets/Other',
  });
  assert.equal(readDocumentSource(documentWithEmbeddedSheet.view).ready, true);
});

test('隐藏、未挂载或缺少文档标识的正文仍处于等待状态', () => {
  const hidden = pageView('https://another.feishu.cn/wiki/Node');
  hidden.view.getComputedStyle = element => ({ display: element === hidden.root ? 'none' : 'block' });
  assert.equal(readDocumentSource(hidden.view).ready, false);
  const missingToken = pageView('https://another.feishu.cn/wiki/Node', { token: '' });
  assert.equal(readDocumentSource(missingToken.view).ready, false);
});
