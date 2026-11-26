import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {createHash} from 'node:crypto';
import {gzipSync} from 'node:zlib';
import {readEmbeddedFont,encodeZ85,decodeZ85} from '../src/userscript/pdf-fonts.js';

const engineSource = 'self.pdfMake = {};';
const fontArchive = ['Regular', 'Bold'].map(name => ({name:name + '.woff2', compressed:'00000', compressedSize:1, size:1, hash:'a'.repeat(64)}));
const resources = {pdfEngine:engineSource, pdfFonts:JSON.stringify(fontArchive)};
const resourceHashes = Object.fromEntries(Object.entries(resources).map(([name, source]) => [name, createHash('sha256').update(source).digest('hex')]));
const bundled = await build({
  entryPoints:['src/userscript/pdf.js'], bundle:true, write:false, format:'esm',
  plugins:[{
    name:'test-pdf-worker',
    setup(builder) {
      builder.onResolve({filter:/^pdf-worker-assets$/}, () => ({path:'test',namespace:'pdf'}));
      builder.onLoad({filter:/.*/,namespace:'pdf'}, () => ({
        contents:'export const workerSource="worker source"; export const resourceHashes=' + JSON.stringify(resourceHashes) + ';',
        loader:'js',
      }));
    },
  }],
});
const {renderPdf} = await import('data:text/javascript;base64,' + Buffer.from(bundled.outputFiles[0].text).toString('base64'));

function environment(t) {
  const workers = [], revoked = [], urls = [], resourceCalls = [];
  const originalWorker = globalThis.Worker;
  const originalResource = globalThis.GM_getResourceText;
  const create = URL.createObjectURL, revoke = URL.revokeObjectURL;
  class TestWorker {
    constructor(url) { this.url=url; this.terminated=false; workers.push(this); }
    postMessage(message) { this.message=message; }
    terminate() { this.terminated=true; }
  }
  globalThis.Worker=TestWorker;
  globalThis.GM_getResourceText=name => { resourceCalls.push(name); return resources[name]; };
  URL.createObjectURL=blob => { urls.push(blob); return 'blob:pdf-worker'; };
  URL.revokeObjectURL=url => revoked.push(url);
  t.after(() => {
    globalThis.Worker=originalWorker;
    globalThis.GM_getResourceText=originalResource;
    URL.createObjectURL=create; URL.revokeObjectURL=revoke;
  });
  return {workers,revoked,urls,resourceCalls};
}

async function waitForWorker(workers) {
  const deadline = Date.now() + 1000;
  while (!workers.length && Date.now() < deadline) await new Promise(resolve => setImmediate(resolve));
  assert.equal(workers.length, 1);
}

test('用户脚本 PDF 将字体交给独立 worker，返回文件后终止并释放 URL', async t => {
  const {workers,revoked,urls,resourceCalls}=environment(t), stages=[];
  const snapshot={title:'测试',blocks:[],assets:[]};
  const pending=renderPdf(snapshot,{onProgress:stage=>stages.push(stage)});
  await waitForWorker(workers);
  const worker=workers[0];
  assert.equal(worker.message.snapshot,snapshot);
  assert.deepEqual(resourceCalls,['pdfEngine','pdfFonts']);
  assert.deepEqual(worker.message.fontArchive,fontArchive);
  assert.equal(await urls[0].text(),engineSource + '\n;\nworker source');
  worker.onmessage({data:{stage:'生成 PDF'}});
  const result={filename:'测试.pdf',blob:new Blob(['%PDF-1.4']),notes:[]};
  worker.onmessage({data:{result}});
  assert.equal(await pending,result);
  assert.deepEqual(stages,['生成 PDF']);
  assert.equal(worker.terminated,true);
  assert.deepEqual(revoked,['blob:pdf-worker']);
});

test('用户取消 PDF 时实际终止正在运行的 worker，且不交付迟到的文件', async t => {
  const {workers,revoked}=environment(t);
  let stopped=false;
  const pending=renderPdf({},{shouldStop:()=>stopped});
  const rejected=assert.rejects(pending,{name:'AbortError'});
  await waitForWorker(workers);
  stopped=true;
  await rejected;
  assert.equal(workers[0].terminated,true);
  assert.deepEqual(revoked,['blob:pdf-worker']);
  workers[0].onmessage?.({data:{result:{filename:'迟到.pdf'}}});
});

test('PDF worker 失败时报告原因并清理，取消后的操作不创建 worker', async t => {
  const {workers,revoked}=environment(t);
  await assert.rejects(renderPdf({},{shouldStop:()=>true}),{name:'AbortError'});
  assert.equal(workers.length,0);
  const pending=renderPdf({});
  const rejected=assert.rejects(pending,{code:'PDF_LIMIT'});
  await waitForWorker(workers);
  workers[0].onmessage({data:{error:'PDF_LIMIT'}});
  await rejected;
  assert.equal(workers[0].terminated,true);
  assert.deepEqual(revoked,['blob:pdf-worker']);
});

test('PDF 缓存缺失、损坏或资源 API 不可用时明确报错，不创建 Worker', async t => {
  for (const [label, read] of [
    ['missing', () => ''],
    ['invalid text', () => null],
    ['corrupt engine', name => name === 'pdfEngine' ? 'broken engine' : resources[name]],
    ['corrupt fonts', name => name === 'pdfFonts' ? '{' : resources[name]],
    ['unavailable API', () => { throw new Error('cache unavailable'); }],
  ]) await t.test(label, async t => {
    const {workers,urls}=environment(t);
    globalThis.GM_getResourceText=read;
    await assert.rejects(renderPdf({}), {code:'PDF_RESOURCE_INVALID', message:'PDF 资源校验失败，请重新安装脚本。'});
    assert.deepEqual(workers,[]);
    assert.deepEqual(urls,[]);
  });
});

test('PDF 读取安装缓存期间取消时不创建 Worker', async t => {
  const {workers,urls,resourceCalls}=environment(t);
  let stopped=false;
  globalThis.GM_getResourceText=name => { resourceCalls.push(name); stopped=true; return resources[name]; };
  await assert.rejects(renderPdf({}, {shouldStop:()=>stopped}), {name:'AbortError'});
  assert.deepEqual(resourceCalls,['pdfEngine']);
  assert.deepEqual(workers,[]);
  assert.deepEqual(urls,[]);
});

test('Worker 无法启动或发送任务失败时释放全部资源', async t => {
  for (const stage of ['construct', 'post']) await t.test(stage, async t => {
    const {revoked}=environment(t);
    let terminated=false;
    globalThis.Worker=class {
      constructor() { if (stage === 'construct') throw new Error('worker unavailable'); }
      postMessage() { throw new Error('cannot post'); }
      terminate() { terminated=true; }
    };
    await assert.rejects(renderPdf({}));
    assert.deepEqual(revoked,['blob:pdf-worker']);
    assert.equal(terminated, stage === 'post');
  });
});

test('内嵌字体解压后核对字节数和 SHA-256，拒绝损坏字体', async () => {
  const bytes=Buffer.from('OTTO embedded font bytes');
  const compressed=gzipSync(bytes);
  const spec={size:bytes.length,hash:createHash('sha256').update(bytes).digest('hex'),compressed:encodeZ85(compressed),compressedSize:compressed.length};
  assert.deepEqual(await readEmbeddedFont(spec),new Uint8Array(bytes));
  await assert.rejects(readEmbeddedFont({...spec,hash:'0'.repeat(64)}),{code:'PDF_FONT_INVALID'});
  await assert.rejects(readEmbeddedFont({...spec,size:1}),{code:'PDF_FONT_INVALID'});
  await assert.rejects(readEmbeddedFont({...spec,compressed:'not a gzip archive'}),{code:'PDF_FONT_INVALID'});
});

test('Z85 uses the standard vector and preserves padded byte tails', () => {
  const vector=new Uint8Array([0x86,0x4f,0xd2,0x6f,0xb5,0x59,0xf7,0x5b]);
  assert.equal(encodeZ85(vector),'HelloWorld');
  assert.deepEqual(decodeZ85('HelloWorld',8),vector);
  for(let size=0;size<10;size++) {
    const bytes=Uint8Array.from({length:size},(_,index)=>(index*71+255)%256);
    const encoded=encodeZ85(bytes);
    assert.equal(encoded.length,Math.ceil(size/4)*5);
    assert.deepEqual(decodeZ85(encoded,size),bytes);
  }
  for(const [encoded,size] of [['~~~~~',4],['#####',4],['Hello',5],['Hello',-1]]) {
    assert.throws(()=>decodeZ85(encoded,size),{code:'PDF_FONT_INVALID'});
  }
});
