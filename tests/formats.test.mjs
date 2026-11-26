import assert from 'node:assert/strict';
import test from 'node:test';
import { strToU8, unzipSync } from 'fflate';
import { renderBundle, renderFile } from '../src/formats.js';
import { readDocumentParts } from '../src/importer.js';
import { convertCapture } from '../src/feishu.js';

const pngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGN4oKDwHwAFJAIgPqioaAAAAABJRU5ErkJggg==';
const png = Uint8Array.from(Buffer.from(pngBase64, 'base64'));

async function zipResult(kind, snapshot) {
  const { blob } = await renderFile(kind, snapshot);
  return unzipSync(new Uint8Array(await blob.arrayBuffer()));
}

test('飞书分词不改变表格的删除线范围、链接或导出字节', async () => {
  const strike = (text) => '<span style="text-decoration:line-through">' + text + '</span>';
  const link = '<a href="https://example.org/">链接</a>';
  async function exportFormats(words) {
    const marked = words.map(strike).join('');
    const cell = '有效 ' + marked + ' 保留 ' + strike(link) + ' 正常';
    const rows = '<tr><td><div class="ace-line">' + cell + '</div></td></tr>';
    const table = (id, head) => ({ id, type: 'table', html: '<div><table>' + head + rows + '</table></div>' });
    const { html } = convertCapture({ blocks: [
      table('1', '<tr><th>说明</th></tr>'), table('2', ''),
    ] });
    const snapshot = await readDocumentParts({html});
    const markdownFile = Object.entries(await zipResult('markdown', snapshot)).find(([name]) => name.endsWith('.md'));
    return [new TextDecoder().decode(markdownFile[1]), await (await renderFile('html', snapshot)).blob.text()];
  }
  const whole = await exportFormats(['原参数（弃用）']);
  const split = await exportFormats(['原', '参数', '（', '弃用', '）']);
  assert.deepEqual(split, whole);
  assert.match(whole[0], /\| 有效 ~~原参数（弃用）~~ 保留 ~~\[链接\]\(https:\/\/example\.org\/\)~~ 正常 \|/u);
  for (const output of whole) {
    assert.match(output, /有效 <s>原参数（弃用）<\/s> 保留 <s><a href="https:\/\/example\.org\/"[^>]*>链接<\/a><\/s> 正常/u);
  }
});

test('采集与转换发现的缺失进入内存正文，所有单项产物可定位', async () => {
  const capture = {
    blocks: [{ id: '33', type: 'code', html: '<div></div>' }],
    code: { 33: { lines: [{ num: 1, text: 'first' }, { num: 3, text: 'third' }] } },
    warnings: [{ code: 'missing_block', label: '疑似漏掉的块 77' }],
  };
  const converted = convertCapture(capture);
  const imported = await readDocumentParts({html: strToU8(converted.html)});
  const plain = await readDocumentParts({html: converted.html});
  assert.deepEqual(imported.warnings, converted.warnings);
  assert.deepEqual(plain.warnings, imported.warnings);
  const decoder = new TextDecoder();
  const outputs = [
    decoder.decode((await zipResult('attachments', imported))['manifest.txt']),
    decoder.decode((await zipResult('markdown', imported))['文档.md']),
    await (await renderFile('html', imported)).blob.text(),
  ];
  for (const output of outputs) {
    assert.match(output, /疑似漏掉的块 77/u);
    assert.match(output, /代码块 33 缺少第 2 行/u);
  }
});

test('一次打包的结果清单与最终 ZIP 的真实条目、字节数及单选文件名一致', async () => {
  const snapshot = await readDocumentParts({
    html: '<h1>组合</h1><img src="images/i.png">',
    assets: [{path: 'images/i.png', bytes: png}, {path: 'attachments/other.txt', bytes: strToU8('other')}],
  });
  for (const [kinds, expectedName, names] of [
    [['markdown'], '组合-Markdown.zip', ['组合.md','images/i.png']],
    [['attachments'], '组合-素材包.zip', ['manifest.txt','images/i.png','attachments/other.txt']],
    [['markdown','attachments','html'], '组合-导出.zip', ['组合.md','组合.html','images/i.png','attachments/other.txt','manifest.txt']],
  ]) {
    const result = renderBundle(kinds, snapshot);
    assert.equal(result.filename, expectedName);
    const actual = unzipSync(new Uint8Array(await result.blob.arrayBuffer()));
    assert.deepEqual(Object.keys(actual).sort(), names.sort());
    assert.deepEqual(result.entries, Object.entries(actual).map(([name, data]) => ({name,bytes:data.length})));
  }
});

test('组合下载把生成的 PDF 写入同一归档，清单按真实字节统计', async () => {
  const snapshot = await readDocumentParts({
    html: '<h1>组合</h1><img src="images/i.png">', assets: [{path: 'images/i.png', bytes: png}],
  });
  const pdf = strToU8('%PDF-1.4\n生成的 PDF 字节\n%%EOF');
  const result = renderBundle(['markdown', 'html'], snapshot, [{name:'组合.pdf',bytes:pdf}]);
  assert.equal(result.filename, '组合-导出.zip');
  const actual = unzipSync(new Uint8Array(await result.blob.arrayBuffer()));
  assert.deepEqual(Object.keys(actual).sort(), ['images/i.png','组合.html','组合.md','组合.pdf']);
  assert.deepEqual(actual['组合.pdf'], pdf);
  assert.deepEqual(result.entries, Object.entries(actual).map(([name, bytes]) => ({name,bytes:bytes.length})));
  const onlyExtra = renderBundle([], snapshot, [{name:'组合.pdf',bytes:pdf}]);
  assert.deepEqual(Object.keys(unzipSync(new Uint8Array(await onlyExtra.blob.arrayBuffer()))), ['组合.pdf']);
});

test('附加文件拒绝不安全路径、冲突文件名和超过总字节限制的归档', async () => {
  const snapshot = await readDocumentParts({
    html: '<h1>组合</h1><img src="images/i.png">', assets: [{path: 'images/i.png', bytes: png}],
  });
  const bytes = strToU8('PDF');
  for (const name of ['../escape.pdf','/escape.pdf','nested/file.pdf','nested\\file.pdf','.',
    '..','file.pdf/','con.pdf','trailing.','trailing ','x\u0000.pdf','x:stream.pdf']) {
    assert.throws(() => renderBundle(['markdown'], snapshot, [{name,bytes}]), /附加文件/u, name);
  }
  for (const extraFiles of [
    [{name:'组合.html',bytes}],
    [{name:'组合.pdf',bytes},{name:'组合.PDF',bytes}],
    [{name:'é.pdf',bytes},{name:'e\u0301.pdf',bytes}],
    [{name:'IMAGES',bytes}],
  ]) assert.throws(() => renderBundle(['markdown','html'], snapshot, extraFiles), /重复|冲突|附加文件/u);
  assert.throws(() => renderBundle(['markdown'], snapshot, [{name:'组合.pdf',bytes:[1,2]}]), /附加文件/u);
  const large = new Uint8Array(40 * 1024 * 1024);
  assert.throws(() => renderBundle(['markdown'], snapshot,
    [{name:'a.pdf',bytes:large},{name:'b.pdf',bytes:large}]), {code:'render_limit'});
});

test('HTML import strips active markup and replaces unloaded resources in both export formats', async () => {
  const snapshot = await readDocumentParts({html: `
    <title>Fallback</title><base href="https://untrusted.invalid/">
    <script>UNTRUSTED_SCRIPT</script><style>@import 'https://untrusted.invalid/style';</style>
    <main><h1>合成文档</h1><p onclick="UNTRUSTED_HANDLER()">正常<strong>内容</strong></p>
    <img src="https://untrusted.invalid/remote.png" alt="远程图">
    <img src="images/missing.png" alt="缺图">
    <iframe src="https://untrusted.invalid/frame"></iframe>
    <a href="javascript:UNTRUSTED_LINK()">普通文字</a>
    <a href="https://example.org/path?q=one&amp;x=2">网页</a></main>`});
  assert.equal(snapshot.title, '合成文档');
  assert.deepEqual(snapshot.assets, []);
  assert.deepEqual(snapshot.warnings.map(({ code }) => code).sort(),
    ['missing_image', 'remote_image', 'unsupported_block', 'unsupported_link']);
  const { blob } = await renderFile('html', snapshot);
  const html = await blob.text();
  assert.match(html, /Content-Security-Policy/);
  assert.match(html, /远程图/);
  assert.match(html, /缺图/);
  assert.match(html, /https:\/\/example\.org\/path\?q=one&amp;x=2/);
  assert.doesNotMatch(html, /<script|<iframe|onclick=|UNTRUSTED_|untrusted\.invalid/);
  const markdown = new TextDecoder().decode((await zipResult('markdown', snapshot))['合成文档.md']);
  assert.match(markdown, /正常\*\*内容\*\*/);
  assert.match(markdown, /远程图/);
  assert.doesNotMatch(markdown, /untrusted\.invalid|UNTRUSTED_/);
});

test('local assets retain exact bytes and nested names across all export formats', async () => {
  const first = strToU8('first');
  const second = strToU8('second');
  const snapshot = await readDocumentParts({
    html: `<h1>示例</h1>
      <img alt="图" src="./images/%E5%9B%BE.png">
      <a href="attachments/a/%E6%96%87%20%28%E7%A8%BF%29%23%25.txt">第一份</a>
      <a href="attachments/missing.txt">缺附件</a>`,
    assets: [
      {path: 'images/图.png', bytes: png},
      {path: 'attachments/a/文 (稿)#%.txt', bytes: first},
      {path: 'attachments/b/文 (稿)#%.txt', bytes: second},
    ],
  });
  assert.deepEqual(snapshot.warnings.map(({ code }) => code), ['missing_attachment']);
  assert.equal(snapshot.warnings[0].label, 'attachments/missing.txt');
  const markdownZip = await zipResult('markdown', snapshot);
  const markdown = new TextDecoder().decode(markdownZip['示例.md']);
  assert.match(markdown, /images\/%E5%9B%BE\.png/);
  assert.match(markdown, /attachments\/a\/%E6%96%87%20%28%E7%A8%BF%29%23%25\.txt/);
  assert.deepEqual(markdownZip['attachments/a/文 (稿)#%.txt'], first);
  const { blob } = await renderFile('html', snapshot);
  const html = await blob.text();
  assert.ok(html.includes(`data:image/png;base64,${pngBase64}`));
  assert.ok(html.includes('data:application/octet-stream;base64,Zmlyc3Q='));
  assert.ok(html.includes('data:application/octet-stream;base64,c2Vjb25k'));
  const attachments = await zipResult('attachments', snapshot);
  assert.deepEqual(attachments['images/图.png'], png);
  assert.deepEqual(attachments['attachments/a/文 (稿)#%.txt'], first);
  assert.deepEqual(attachments['attachments/b/文 (稿)#%.txt'], second);
  const manifest = new TextDecoder().decode(attachments['manifest.txt']);
  assert.match(manifest, /missing_attachment/);
  assert.match(manifest, /attachments\/missing\.txt/);
});

test('inline raster images are packaged and inline active image types are blocked', async () => {
  const snapshot = await readDocumentParts({html: `<p>内嵌图片</p>
  <img src="data:image/png;base64,${pngBase64}">
  <img alt="活动图" src="data:image/svg+xml,&lt;svg&gt;&lt;script&gt;alert(1)&lt;/script&gt;&lt;/svg&gt;">
  <img alt="坏图" src="data:image/png;base64,YWJj">`});
  assert.equal(snapshot.assets.length, 1);
  assert.deepEqual(snapshot.assets[0].bytes, png);
  assert.deepEqual(snapshot.warnings.map(({ code }) => code), ['invalid_image', 'invalid_image']);
  const { blob } = await renderFile('html', snapshot);
  assert.doesNotMatch(await blob.text(), /svg\+xml|alert\(1\)/);
});

test('Markdown keeps literal pipes and uses inert HTML for merged or headerless tables', async () => {
  const snapshot = await readDocumentParts({html: `<h1>复杂内容</h1>
    <table><tr><th>左|边</th><th>右</th></tr><tr><td><code>a|b</code></td><td>甲 | 乙</td></tr></table>
    <table><tr><td colspan="2">合并&lt;单元格&gt;</td></tr><tr><td>甲</td><td>乙</td></tr></table>
    <pre><code>first
&#96;&#96;&#96;
last</code></pre>`});
  const files = await zipResult('markdown', snapshot);
  const markdown = new TextDecoder().decode(files['复杂内容.md']);
  assert.ok(markdown.includes('| 左\\|边 | 右 |'));
  assert.ok(markdown.includes('`a\\|b`'));
  assert.ok(markdown.includes('甲 \\| 乙'));
  assert.match(markdown, /<td colspan="2">合并&lt;单元格&gt;<\/td>/);
  assert.match(markdown, /^\x60{4}\nfirst\n\x60{3}\nlast\n\x60{4}$/m);
});

test('Markdown 表格有样式时保留安全 HTML，普通表格仍使用管道语法', async () => {
  const snapshot = await readDocumentParts({html:'<h1>表格样式</h1>' +
    '<table><colgroup><col width="1"><col width="3"></colgroup><tr><th>宽度</th><th>保留</th></tr><tr><td>甲</td><td>乙</td></tr></table>' +
    '<table><tr><th style="background-color:#123;color:#fff;text-align:center;vertical-align:middle">底色</th><th>保留</th></tr><tr><td>丙</td><td>丁</td></tr></table>' +
    '<table><tr><th>普通</th><th>表格</th></tr><tr><td>戊</td><td>己</td></tr></table>'});
  const markdown = new TextDecoder().decode((await zipResult('markdown', snapshot))['表格样式.md']);
  assert.match(markdown, /<colgroup><col style="width:25%"><col style="width:75%"><\/colgroup>/u);
  assert.match(markdown, /<th style="background-color:#112233;color:#ffffff;text-align:center;vertical-align:middle">底色<\/th>/u);
  assert.match(markdown, /\| 普通 \| 表格 \|\n\| --- \| --- \|/u);
  assert.doesNotMatch(markdown, /table-scroll/u);
});

test('表格导出复验伪造中立树，不允许字段注入 CSS 或属性', async () => {
  const snapshot = {title:'伪造样式',assets:[],warnings:[],blocks:[{
    tag:'table',columnWidths:[25,'75%;background:url(https://bad.invalid/x)'],children:[{
      tag:'tbody',children:[{tag:'tr',children:[{
        tag:'td',background:'#fff;position:fixed',color:'red',align:'right" onclick="alert(1)',valign:'url(https://bad.invalid/x)',children:['安全文字'],
      }]}],
    }],
  }]};
  const output = await (await renderFile('html', snapshot)).blob.text();
  assert.match(output, /<table><tbody><tr><td>安全文字<\/td>/u);
  assert.doesNotMatch(output, /bad\.invalid|onclick|position:fixed|color:red|alert\(1\)/u);
});

test('深色表格内的代码与链接继承单元格对比色，外部内容仍保持默认样式', async () => {
  const snapshot = await readDocumentParts({html:'<h1>深色对比</h1>' +
    '<pre><code>表格外代码</code></pre><p><a href="https://example.org/outside">表格外链接</a></p>' +
    '<table><tr><td style="background-color:#123;color:#fff"><div>' +
    '<pre><code>深色格代码</code></pre><p><a href="https://example.org/dark"><u>深色格链接</u></a></p>' +
    '<table><tr><td style="background-color:#fff;color:#000"><pre><code>内层浅色格代码</code></pre>' +
    '<a href="https://example.org/nested">内层浅色格链接</a></td></tr></table></div></td></tr></table>'});
  const output = await (await renderFile('html', snapshot)).blob.text();
  const markdown = new TextDecoder().decode((await zipResult('markdown', snapshot))['深色对比.md']);
  for (const rendered of [output, markdown]) {
    assert.match(rendered, /<pre style="color:inherit;background:transparent"><code>深色格代码<\/code><\/pre>/u);
    assert.match(rendered, /<a href="https:\/\/example\.org\/dark" rel="noopener noreferrer" style="color:inherit"><u>深色格链接<\/u><\/a>/u);
    assert.match(rendered, /<td style="background-color:#ffffff;color:#000000"><pre style="color:inherit;background:transparent"><code>内层浅色格代码<\/code><\/pre>/u);
    assert.match(rendered, /<a href="https:\/\/example\.org\/nested" rel="noopener noreferrer" style="color:inherit">内层浅色格链接<\/a>/u);
  }
  assert.match(output, /<pre><code>表格外代码<\/code><\/pre>/u);
  assert.match(output, /<a href="https:\/\/example\.org\/outside" rel="noopener noreferrer">表格外链接<\/a>/u);
  assert.match(markdown, /\[表格外链接\]\(https:\/\/example\.org\/outside\)/u);
  assert.match(markdown, /\x60{3}\n表格外代码\n\x60{3}/u);
});

test('memory assets reject traversal and portable path collisions', async () => {
  for (const paths of [
    { 'attachments/../bad.txt': strToU8('x') },
    { 'attachments/x/File.txt': strToU8('x'), 'attachments/x/file.txt': strToU8('y') },
    { 'attachments/x': strToU8('x'), 'attachments/x/a': strToU8('y') },
    { '/images/image.png': png },
    { 'attachments/aux.txt': strToU8('y') },
    { 'unexpected.txt': strToU8('y') },
  ]) {
    const assets = Object.entries(paths).map(([path, bytes]) => ({path, bytes}));
    await assert.rejects(readDocumentParts({html: '<h1>正常</h1>', assets}), {code: 'invalid_input'});
  }
});

test('a raster with valid dimensions and corrupt image data remains a downloadable file', async () => {
  const corrupt = png.slice();
  corrupt[44] ^= 1;
  const snapshot = await readDocumentParts({
    html: '<h1>坏图</h1><img src="images/corrupt.png">', assets: [{path: 'images/corrupt.png', bytes: corrupt}],
  });
  assert.deepEqual(snapshot.warnings.map(({ code }) => code), ['invalid_image']);
  assert.equal(snapshot.assets[0].type, 'application/octet-stream');
  assert.deepEqual((await zipResult('attachments', snapshot))['images/corrupt.png'], corrupt);
  const { blob } = await renderFile('html', snapshot);
  assert.doesNotMatch(await blob.text(), /<img/);
});

test('Markdown distinguishes text resembling a list or rule from actual lists and rules', async () => {
  const snapshot = await readDocumentParts({html: '<h1>格式</h1><p>1. 段落</p><p>---</p><ol><li>列表</li></ol><hr>'});
  const markdown = new TextDecoder().decode((await zipResult('markdown', snapshot))['格式.md']);
  assert.ok(markdown.includes('1\\. 段落'));
  assert.ok(markdown.includes('\\---'));
  assert.ok(markdown.includes('1. 列表'));
  assert.match(markdown, /^---$/m);
});

test('Markdown HTML fallback never emits source line breaks as Markdown syntax', async () => {
  const marker = '![synth](https://benign.invalid/asset.png)';
  const snapshot = await readDocumentParts({html: '<h1>后备表格</h1><table><tr><td colspan="2">A\n\n' +
    marker + '</td></tr></table><ol start="-1"><li>B\n\n' + marker +
    '</li></ol><dl><dt>C</dt><dd>D\n\n' + marker + '</dd></dl>'});
  const markdown = new TextDecoder().decode((await zipResult('markdown', snapshot))['后备表格.md']);
  const rawBlocks = markdown.split('\n').filter((line) => line.includes('benign.invalid'));
  assert.equal(rawBlocks.length, 3);
  assert.ok(rawBlocks.every(
    (line) => /^<(?:table|ol|dl)\b/.test(line) && line.includes('&#10;&#10;&#33;&#91;synth&#93;('),
  ));
  assert.ok(!markdown.includes(marker));
});

test('embedded raster names cannot collide with asset names or parent directories', async () => {
  const snapshot = await readDocumentParts({
    html: '<h1>路径</h1><img src="data:image/png;base64,' + pngBase64 + '">',
    assets: [{path: 'images/Embedded-1.png', bytes: png}, {path: 'images/embedded-2.png/folder.png', bytes: png}],
  });
  assert.ok(snapshot.assets.some(({ path }) => path === 'images/embedded-3.png'));
  const files = await zipResult('attachments', snapshot);
  for (const asset of snapshot.assets) assert.deepEqual(files[asset.path], asset.bytes);
});

test('HTML parser enforces depth and node count inside otherwise skipped subtrees', async () => {
  const depth = '<h1>深度</h1><template>' + '<section>'.repeat(110) + '</section>'.repeat(110) + '</template>';
  const count = '<h1>数量</h1><template>' + '<span></span>'.repeat(60_001) + '</template>';
  await assert.rejects(readDocumentParts({html: depth}), { code: 'html_limit' });
  await assert.rejects(readDocumentParts({html: count}), { code: 'html_limit' });
});

test('HTML export preserves character-reference carriage returns and full Unicode title characters', async () => {
  const title = '字'.repeat(159) + '😀';
  const snapshot = await readDocumentParts({html: '<h1>' + title + '余</h1><pre>&#13;换行</pre>'});
  assert.equal(snapshot.title, title);
  const { blob } = await renderFile('html', snapshot);
  assert.deepEqual(await readDocumentParts({html: await blob.text()}), snapshot);
});

test('Markdown rejects excessive multiline expansion before generating nested indentation', async () => {
  const snapshot = await readDocumentParts({html: '<h1>长引文</h1><blockquote><pre>' + '行\n'.repeat(200_001) + '</pre></blockquote>'});
  await assert.rejects(renderFile('markdown', snapshot), { code: 'render_limit' });
});

test('Markdown 围栏与 HTML 代码保留语言标识和正文', async () => {
  const snapshot = await readDocumentParts({html: '<h1>示例</h1><pre><code class="language-yaml">key: value</code></pre>'});
  const markdownZip = await zipResult('markdown', snapshot);
  const markdown = new TextDecoder().decode(markdownZip['示例.md']);
  const fence = String.fromCharCode(96).repeat(3);
  assert.ok(markdown.includes(fence + 'yaml\nkey: value\n' + fence), '代码围栏应带语言标识');
  const html = await (await renderFile('html', snapshot)).blob.text();
  assert.match(html, /<pre><code class="language-yaml">key: value<\/code><\/pre>/);
});
