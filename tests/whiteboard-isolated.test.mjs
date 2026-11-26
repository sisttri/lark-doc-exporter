import assert from 'node:assert/strict';
import test from 'node:test';
import {readIsolatedWhiteboard} from '../src/userscript/whiteboard-isolated.js';
import {mediaFixture} from './helpers/native-media.mjs';
import {pngDataUrl} from './helpers/whiteboard.mjs';

function fixture() {
  const f=mediaFixture('whiteboard'),bounds={minX:10,maxX:410,minY:20,maxY:220},calls=[],released=[];
  let hook=()=>{};
  const proxy={getOriginImageDataByNodeId(padding,nodes,transparent,ratio){
    calls.push({padding,nodes,transparent,ratio});
    const width=Math.ceil((bounds.maxX-bounds.minX+2*padding)*ratio),height=Math.ceil((bounds.maxY-bounds.minY+2*padding)*ratio);
    const wrapper={data:{width,height,data:new Uint8ClampedArray(width*height*4)},release(){released.push(wrapper);}};
    hook(wrapper);return Promise.resolve(wrapper);
  }};
  const ratioApp={ratioAppProxy:proxy,app:{application:{nodeManager:{getNodesBounds:()=>bounds}}}};
  const isolateEnv={getRatioApp:()=>ratioApp};f.model.whiteboardBlock={isolateEnv};
  return {...f,bounds,calls,released,proxy,ratioApp,isolateEnv,setHook:value=>{hook=value;}};
}

test('隔离画板只在原生完整边界已知时按预算请求，编码后释放wrapper与离屏画布',async()=>{
  const f=fixture(),before={...f.bounds};const image=await readIsolatedWhiteboard('asset',f.options);
  assert.deepEqual(image,{blockId:'asset',mime:'image/png',width:896,height:496,
    alt:'白板静态图',dataUrl:pngDataUrl,source:'native-isolated'});
  assert.deepEqual(f.calls,[{padding:24,nodes:[''],transparent:false,ratio:2}]);
  assert.deepEqual(f.bounds,before);assert.equal(f.released.length,1);
  assert.equal(f.canvases[0].width,0);assert.equal(f.canvases[0].height,0);
});

test('隔离代理存在但完整场景边界不可信时不请求ImageData',async()=>{
  for(const configure of [f=>{delete f.ratioApp.app;},f=>{delete f.proxy.getOriginImageDataByNodeId;},
    f=>{f.ratioApp.app.application.nodeManager.getNodesBounds=()=>({width:100,height:50});},
    f=>{f.bounds.maxX=Infinity;},f=>{f.model.type='image';}]) {
    const f=fixture();configure(f);assert.equal(await readIsolatedWhiteboard('asset',f.options),null);
    assert.equal(f.calls.length,0);assert.equal(f.canvases.length,0);
  }
});

test('隔离请求在分配前限制大场景倍率，DOM预览尺寸不参与场景预算',async()=>{
  const f=fixture();Object.assign(f.bounds,{minX:0,maxX:30_000,minY:0,maxY:4000});
  const image=await readIsolatedWhiteboard('asset',f.options);
  assert.ok(image.width<=8192&&image.height<=8192&&image.width*image.height<=16_000_000);
  assert.ok(f.calls[0].ratio>0&&f.calls[0].ratio<1);assert.equal(f.released.length,1);
});

test('隔离输出损坏、超出预先预算或编码失败时释放所有输出并回退',async()=>{
  for(const scenario of ['oversize','wrong-buffer','encode','invalid-png','context']) {
    const f=fixture();
    f.setHook(wrapper=>{if(scenario==='oversize')wrapper.data.width=8193;if(scenario==='wrong-buffer')wrapper.data.data=new Uint8ClampedArray(1);});
    const create=f.document.createElement;
    f.document.createElement=tag=>{const canvas=create(tag);
      if(scenario==='encode')canvas.toDataURL=()=>{throw new Error('synthetic');};
      if(scenario==='invalid-png')canvas.toDataURL=()=>'';
      if(scenario==='context')canvas.getContext=()=>null;return canvas;};
    assert.equal(await readIsolatedWhiteboard('asset',f.options),null,scenario);assert.equal(f.released.length,1,scenario);
    for(const canvas of f.canvases){assert.equal(canvas.width,0,scenario);assert.equal(canvas.height,0,scenario);}
  }
});

test('隔离代理返回缩略图、裁剪图或错误宽高比时不冒充完整场景',async()=>{
  for(const [width,height] of [[1,1],[896,248],[448,248]]) {
    const f=fixture();f.setHook(wrapper=>{wrapper.data={width,height,data:new Uint8ClampedArray(width*height*4)};});
    assert.equal(await readIsolatedWhiteboard('asset',f.options),null);
    assert.equal(f.released.length,1);assert.equal(f.canvases.length,0);
  }
});

test('异步隔离读取过程中更换页面、模型、场景或代理时不交付旧数据',async()=>{
  for(const change of [f=>{f.pageAttributes['data-record-id']='other';},f=>{f.root.children=[{...f.model}];},
    f=>{f.bounds.maxX++;},f=>{f.ratioApp.ratioAppProxy={...f.proxy};}]) {
    const f=fixture();f.setHook(()=>change(f));
    assert.equal(await readIsolatedWhiteboard('asset',f.options),null);assert.equal(f.released.length,1);assert.equal(f.canvases.length,0);
  }
});

test('隔离请求超时后返回的wrapper也会立即释放且不创建画布',async()=>{
  const f=fixture();let resolve;
  f.proxy.getOriginImageDataByNodeId=()=>new Promise(done=>{resolve=done;});
  assert.equal(await readIsolatedWhiteboard('asset',{...f.options,timeoutMs:10}),null);
  let released=0;resolve({data:{width:1,height:1,data:new Uint8ClampedArray(4)},release(){released++;}});
  await new Promise(done=>setTimeout(done,0));assert.equal(released,1);assert.equal(f.canvases.length,0);
});

test('隔离wrapper异步释放失败不会污染导出或触发未处理拒绝',async()=>{
  const f=fixture();let released=0;
  f.setHook(wrapper=>{wrapper.release=()=>{released++;return Promise.reject(new Error('synthetic release failure'));};});
  assert.ok(await readIsolatedWhiteboard('asset',f.options));
  await new Promise(done=>setTimeout(done,0));assert.equal(released,1);
});

test('隔离请求取消传播AbortError，迟到或取消瞬间到达的wrapper只释放一次',async()=>{
  const f=fixture();let resolve,stopped=false,released=0;
  f.proxy.getOriginImageDataByNodeId=()=>new Promise(done=>{resolve=done;});
  const task=readIsolatedWhiteboard('asset',{...f.options,checkStop(){if(stopped)throw Object.assign(new Error('取消'),{name:'AbortError'});}});
  stopped=true;await assert.rejects(task,{name:'AbortError'});
  resolve({data:{width:1,height:1,data:new Uint8ClampedArray(4)},release(){released++;}});
  await new Promise(done=>setTimeout(done,0));assert.equal(released,1);assert.equal(f.canvases.length,0);
});

test('隔离画板等待就绪之后再取边界，不支持隔离能力时不等待',async()=>{
  const f=fixture();let waited=0;
  const options={...f.options,waitForReady:async()=>{waited++;f.bounds.maxX+=100;return true;}};
  assert.equal((await readIsolatedWhiteboard('asset',options)).width,1096);assert.equal(waited,1);
  delete f.model.whiteboardBlock.isolateEnv;
  assert.equal(await readIsolatedWhiteboard('asset',options),null);assert.equal(waited,1);
});
