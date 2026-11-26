import assert from 'node:assert/strict';
import test from 'node:test';
import {readNativeImage,readNativeAttachment} from '../src/userscript/native-media.js';
import {mediaFixture} from './helpers/native-media.mjs';
import {pngDataUrl} from './helpers/whiteboard.mjs';

test('高清图片通过本块原生manager获取并保存原编码字节，重复采集复用本次缓存',async()=>{
  const f=mediaFixture(),cache=new Map();
  const expected={blockId:'asset',mime:'image/png',width:1,height:1,alt:'示例图片',dataUrl:pngDataUrl,source:'native-hd'};
  assert.deepEqual(await readNativeImage('asset',{...f.options,cache}),expected);
  assert.deepEqual(f.calls,[{options:{token:'image-token',isHD:true,fuzzy:false},context:{}}]);
  assert.deepEqual(await readNativeImage('asset',{...f.options,cache}),expected);
  assert.equal(f.fetches.length,1);assert.equal(f.canvases.length,0);
  assert.equal(f.fetches[0].init.credentials,'include');assert.equal(f.fetches[0].init.redirect,'error');
});

test('GIF高清资源保留原编码而非重采样PNG',async()=>{
  const f=mediaFixture(),bytes=new Uint8Array(Buffer.from('R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==','base64'));
  f.options.fetch=async()=>f.response(bytes,{mime:'image/gif'});
  const value=await readNativeImage('asset',f.options);
  assert.equal(value.mime,'image/gif');assert.equal(value.width,1);assert.equal(value.height,1);
  assert.equal(value.dataUrl,'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==');
});

test('原生高清blob来源仅接受当前文档origin，原生持有的URL不会被撤销',async()=>{
  const f=mediaFixture(),source='blob:https://example.feishu.cn/native-image';
  f.model.imageManager.fetch=(a,b,resolve)=>resolve({src:source,originSrc:source,mimeType:'image/png'});
  f.options.fetch=async(url,init)=>{f.fetches.push({url:String(url),init});return f.response(undefined,{url:String(url)});};
  assert.equal((await readNativeImage('asset',f.options)).dataUrl,pngDataUrl);
  assert.equal(f.fetches[0].url,source);
});

test('同一素材token在不同块复用编码时仍保留各块当前名称',async()=>{
  const f=mediaFixture(),cache=new Map();await readNativeImage('asset',{...f.options,cache});
  f.model.snapshot.image.name='另一图片说明';
  assert.equal((await readNativeImage('asset',{...f.options,cache})).alt,'另一图片说明');
  const g=mediaFixture('file'),fileCache=new Map();await readNativeAttachment('asset',{...g.options,cache:fileCache});
  g.model.snapshot.file.name='另一个名称.txt';
  assert.equal((await readNativeAttachment('asset',{...g.options,cache:fileCache})).name,'另一个名称.txt');
  assert.equal(f.fetches.length,1);assert.equal(g.fetches.length,1);
});

test('模型身份或图片token在异步获取后改变时拒绝旧资源且不写缓存',async()=>{
  for(const change of [f=>{f.pageAttributes['data-record-id']='other';},f=>{f.model.snapshot.image.token='other';},
    f=>{f.model.imageManager={...f.model.imageManager};}]) {
    const f=mediaFixture(),cache=new Map();
    f.options.fetch=async()=>{change(f);return f.response();};
    assert.equal(await readNativeImage('asset',{...f.options,cache}),null);assert.equal(cache.size,0);
  }
});

test('原生图片能力缺失和来源不受信任时不执行网络请求',async()=>{
  for(const source of ['https://other.invalid/image','http://example.feishu.cn/image','https://user:pass@example.feishu.cn/image',
    'javascript:alert(1)','blob:https://other.invalid/id']) {
    const f=mediaFixture();f.model.imageManager.fetch=(a,b,resolve)=>resolve({src:source});
    await assert.rejects(readNativeImage('asset',f.options));assert.equal(f.fetches.length,0);
  }
  const f=mediaFixture();delete f.model.imageManager;
  assert.equal(await readNativeImage('asset',f.options),null);assert.equal(f.fetches.length,0);
});

test('高清资源拒绝权限错误、登录页、重定向及损坏图片，不缓存失败',async()=>{
  for(const data of [{status:403},{mime:'text/html'}, {url:'https://other.invalid/redirect'},
    {bytes:new TextEncoder().encode('broken'),mime:'image/png'}]) {
    const f=mediaFixture(),cache=new Map();f.options.fetch=async()=>f.response(data.bytes,{...data});
    await assert.rejects(readNativeImage('asset',{...f.options,cache}));assert.equal(cache.size,0);
  }
});

test('高清资源流超过单项限额立即取消读取并中止请求',async()=>{
  const f=mediaFixture();let cancelled=false,signal;
  const stream=new ReadableStream({start(controller){controller.enqueue(new Uint8Array(24*1024*1024));controller.enqueue(new Uint8Array(1));},cancel(){cancelled=true;}});
  f.options.fetch=async(url,init)=>{signal=init.signal;const response=new Response(stream,{headers:{'content-type':'image/png'}});
    Object.defineProperty(response,'url',{value:String(url)});return response;};
  await assert.rejects(readNativeImage('asset',f.options));assert.equal(cancelled,true);assert.equal(signal.aborted,true);
});

test('下载流的取消清理永不结束时也不突破素材读取超时',async()=>{
  const f=mediaFixture();let cancelled=0;
  f.options.fetch=async url=>({ok:true,url:String(url),headers:new Headers({'content-type':'image/png'}),
    body:{getReader:()=>({read:()=>new Promise(()=>{}),cancel(){cancelled++;return new Promise(()=>{});},releaseLock(){}})}});
  const finished=readNativeImage('asset',{...f.options,timeoutMs:10}).then(()=>false,()=>true);
  assert.equal(await Promise.race([finished,new Promise(resolve=>setTimeout(()=>resolve(false),80))]),true);
  assert.equal(cancelled,1);
});

test('原生callback失败/超时可重试；用户取消立即传播且迟到callback不发起下载',async()=>{
  const f=mediaFixture();let callback;
  f.model.imageManager.fetch=(a,b,resolve)=>{callback=resolve;return Promise.resolve();};
  await assert.rejects(readNativeImage('asset',{...f.options,timeoutMs:15}));
  callback({src:'https://example.feishu.cn/late'});await new Promise(resolve=>setTimeout(resolve,1));
  assert.equal(f.fetches.length,0);
  let cancelled=false;const task=readNativeImage('asset',{...f.options,timeoutMs:1000,checkStop(){if(cancelled)throw Object.assign(new Error('取消'),{name:'AbortError'});}});
  cancelled=true;await assert.rejects(task,{name:'AbortError'});assert.equal(f.fetches.length,0);
});

test('附件通过文档模型的token和文件名下载原字节，wiki地址不冒充宿主文档token',async()=>{
  const f=mediaFixture('file'),value=await readNativeAttachment('asset',f.options);
  assert.deepEqual(value,{blockId:'asset',token:'file-token',name:'示例.txt',mime:'text/plain',bytes:new TextEncoder().encode('附件原文')});
  const url=new URL(f.fetches[0].url);
  assert.equal(url.origin,'https://drive.feishu.cn');assert.equal(url.pathname,'/space/api/box/stream/download/all/file-token');
  assert.equal(url.searchParams.get('mount_node_token'),'asset-record');assert.equal(url.searchParams.get('mount_point'),'docx_file');
  assert.equal(url.searchParams.get('synced_block_host_token'),'page-record');assert.equal(url.searchParams.get('synced_block_host_type'),'22');
});

test('附件仅接受已验证nativefile配置，不读取DOM链接或下载权限错误页',async()=>{
  for(const configure of [f=>{f.pageView.globalConfig.drive_api=['other.invalid'];},
    f=>{f.model.snapshot.file.token='bad/token';},f=>{f.model.type='image';}]) {
    const f=mediaFixture('file');configure(f);assert.equal(await readNativeAttachment('asset',f.options),null);assert.equal(f.fetches.length,0);
  }
  for(const options of [{status:403},{mime:'text/html'}, {url:'https://accounts.feishu.cn/login'}]) {
    const f=mediaFixture('file');f.options.fetch=async()=>f.response(new TextEncoder().encode('<html>请登录</html>'),options);
    await assert.rejects(readNativeAttachment('asset',f.options));
  }
});

test('附件保留合法HTML文件但拒绝文件名不对应的登录文档',async()=>{
  const f=mediaFixture('file');f.model.snapshot.file.name='example.html';f.model.snapshot.file.mime_type='text/html';
  const bytes=new TextEncoder().encode('<!doctype html><html><body>附件正文</body></html>');
  f.options.fetch=async(url)=>f.response(bytes,{mime:'text/html',url:String(url)});
  assert.deepEqual((await readNativeAttachment('asset',f.options)).bytes,bytes);
});

test('普通附件收到HTTP200 JSON接口错误时拒绝交付，也不把失败写入缓存',async()=>{
  for(const mime of ['application/json','text/plain']) {
    const f=mediaFixture('file'),cache=new Map(),bytes=new TextEncoder().encode('{"code":10003,"msg":"permission denied"}');
    f.options.fetch=async url=>f.response(bytes,{mime,url:String(url)});
    await assert.rejects(readNativeAttachment('asset',{...f.options,cache}));assert.equal(cache.size,0);
  }
});

test('明确JSON附件保留原字节，普通文本中的JSON内容不被宽泛拒绝',async()=>{
  for(const [name,nativeMime,responseMime,body] of [
    ['配置.json','text/plain','application/json','{"code":10003,"msg":"document content"}'],
    ['配置数据','application/json','application/json','{"enabled":true}'],
    ['记录.txt','text/plain','text/plain','{"code":12,"value":"normal data"}'],
    ['记录.txt','text/plain','text/plain','正文\n{"code":10003,"msg":"example"}'],
  ]) {
    const f=mediaFixture('file'),bytes=new TextEncoder().encode(body);
    f.model.snapshot.file.name=name;f.model.snapshot.file.mime_type=nativeMime;
    f.options.fetch=async url=>f.response(bytes,{mime:responseMime,url:String(url)});
    assert.deepEqual((await readNativeAttachment('asset',f.options)).bytes,bytes);
  }
});

test('同token跨文档不复用缓存，图片和附件缓存保持有界且不保存失败',async()=>{
  const f=mediaFixture(),cache=new Map();await readNativeImage('asset',{...f.options,cache});
  const g=mediaFixture();g.root={...g.root};g.pageView.PageMain.blockManager.rootBlockModel=g.root;
  await readNativeImage('asset',{...g.options,cache});assert.equal(g.fetches.length,1);
  for(let n=0;n<140;n++){f.model.snapshot.image.token='image-'+n;await readNativeImage('asset',{...f.options,cache});}
  assert.ok(cache.size<=128);
});
