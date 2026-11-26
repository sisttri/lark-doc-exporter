import test from 'node:test';
import assert from 'node:assert/strict';
import {renderNativeWhiteboard} from '../src/userscript/whiteboard-native.js';
import {pngDataUrl} from './helpers/whiteboard.mjs';

function fixture() {
  const attributes = {'data-block-id':'board','data-block-type':'whiteboard','data-record-id':'board-record'};
  const pageAttributes = {'data-record-id':'page-record'};
  const block = {isConnected:true,getAttribute:name => attributes[name] ?? null};
  const page = {getAttribute:name => pageAttributes[name] ?? null,contains:node => node === block};
  const document = {
    querySelector:selector => selector === '[data-block-type="page"]' ? page : selector === '[data-block-id="board"]' ? block : null,
    contains:node => node === page || node === block || node.isConnected === true,
  };
  const bounds = {id:'synthetic-bounds',minX:10,maxX:410,minY:20,maxY:220};
  const calls = [], canvases = [];
  const manager = {
    getImageOffscreenCanvas(area,scale,background) {
      calls.push({area,scale,background});
      const canvas = {width:Math.ceil((area.maxX-area.minX)*scale),height:Math.ceil((area.maxY-area.minY)*scale),
        isConnected:false,toDataURL:type => {assert.equal(type,'image/png');return pngDataUrl;}};
      canvases.push(canvas);return canvas;
    },
  };
  const nodeManager = {getNodesBounds:() => bounds};
  const app = {application:{nodeManager},renderManager:manager};
  const model = {id:'board',type:'whiteboard',record:{id:'board-record'},children:[],
    whiteboardBlock:{abilityKit:{getRatioApp:() => ({app})}}};
  const root = {id:'page',type:'page',record:{id:'page-record'},children:[model]};
  const pageView = {PageMain:{blockManager:{rootBlockModel:root}}};
  const options = {document,pageView,checkStop(){}};
  return {attributes,pageAttributes,page,block,document,bounds,calls,canvases,manager,nodeManager,app,model,root,pageView,options};
}

test('原生画板按完整场景加边距重绘，保留场景与页面并释放离屏画布', async () => {
  const f = fixture(), original = {...f.bounds};
  const image = await renderNativeWhiteboard('board',f.options);
  assert.deepEqual(image,{blockId:'board',mime:'image/png',width:896,height:496,
    alt:'白板静态图（原始场景渲染）',dataUrl:pngDataUrl});
  assert.deepEqual(f.calls,[{area:{minX:-14,maxX:434,minY:-4,maxY:244},scale:2,background:'#ffffff'}]);
  assert.notEqual(f.calls[0].area,f.bounds);
  assert.deepEqual(f.bounds,original);
  assert.equal(f.canvases[0].width,0);assert.equal(f.canvases[0].height,0);
});

test('原生画板保留受限不透明背景色，RGB颜色规范化后传给渲染器', async () => {
  for(const [background,expected] of [['#123456','#123456'],['#234','#223344'],
    ['rgb(12, 34, 56)','#0c2238'],['rgba(4, 5, 6, 1)','#040506']]) {
    const f=fixture();
    assert.ok(await renderNativeWhiteboard('board',{...f.options,background}));
    assert.equal(f.calls[0].background,expected);
  }
});

test('原生画板的非法、透明或动态背景声明回退白色', async () => {
  for(const background of ['transparent','rgba(12, 34, 56, .5)','var(--page-background)',
    'url(https://example.invalid/background)','rgb(256, 0, 0)',{color:'#000000'}]) {
    const f=fixture();
    assert.ok(await renderNativeWhiteboard('board',{...f.options,background}));
    assert.equal(f.calls[0].background,'#ffffff');
  }
});

test('原生场景匹配数字模型ID及同步引用中的白板，遍历可处理循环引用', async () => {
  const f = fixture();f.model.id = 7;f.attributes['data-block-id']='7';
  const query=f.document.querySelector;
  f.document.querySelector=selector => selector === '[data-block-id="7"]' ? f.block : query(selector);
  f.root.children=[{id:'reference',children:[],innerBlockManager:{rootBlockModel:{children:[f.model]}}}];
  f.model.children=[f.root];
  assert.equal((await renderNativeWhiteboard('7',f.options)).blockId,'7');
  assert.equal(f.calls.length,1);
});

test('原生画板在请求渲染前按边长和像素预算限制倍率', async () => {
  for (const [width,height] of [[6000,1200],[3500,3500],[30_000,4000]]) {
    const f=fixture();Object.assign(f.bounds,{minX:0,maxX:width,minY:0,maxY:height});
    const image=await renderNativeWhiteboard('board',f.options);
    assert.ok(image);
    assert.ok(image.width <= 8192 && image.height <= 8192 && image.width*image.height <= 16_000_000);
    const {area,scale}=f.calls[0];
    assert.ok(scale>0 && scale<=2);
    assert.ok(Math.abs(image.width/image.height-(area.maxX-area.minX)/(area.maxY-area.minY))<.01);
  }
});

test('缺失原生能力时返回null且不调用渲染器', async () => {
  for (const scenario of ['page-view','root','model','ability','ratio-app','bounds','renderer']) {
    const f=fixture();
    if(scenario==='page-view') f.options.pageView={};
    if(scenario==='root') delete f.pageView.PageMain.blockManager.rootBlockModel;
    if(scenario==='model') f.root.children=[];
    if(scenario==='ability') delete f.model.whiteboardBlock.abilityKit;
    if(scenario==='ratio-app') f.model.whiteboardBlock.abilityKit.getRatioApp=() => null;
    if(scenario==='bounds') delete f.nodeManager.getNodesBounds;
    if(scenario==='renderer') delete f.manager.getImageOffscreenCanvas;
    assert.equal(await renderNativeWhiteboard('board',f.options),null,scenario);
    assert.equal(f.calls.length,0,scenario);
  }
});

test('文档、记录或块类型不匹配时不读取原生场景', async () => {
  for(const scenario of ['page-record','block-record','model-type','dom-type','detached']) {
    const f=fixture();
    if(scenario==='page-record') f.root.record.id='other-page';
    if(scenario==='block-record') f.model.record.id='other-board';
    if(scenario==='model-type') f.model.type='image';
    if(scenario==='dom-type') f.attributes['data-block-type']='view';
    if(scenario==='detached') f.block.isConnected=false;
    assert.equal(await renderNativeWhiteboard('board',f.options),null,scenario);
    assert.equal(f.calls.length,0,scenario);
  }
});

test('损坏、空或数值溢出的场景边界不会触发画布分配', async () => {
  for(const bounds of [null,{}, {minX:0,maxX:NaN,minY:0,maxY:1},
    {minX:10,maxX:0,minY:0,maxY:1},{minX:0,maxX:0,minY:0,maxY:1},
    {minX:0,maxX:1e200,minY:0,maxY:1e200}]) {
    const f=fixture();f.nodeManager.getNodesBounds=() => bounds;
    assert.equal(await renderNativeWhiteboard('board',f.options),null);
    assert.equal(f.calls.length,0);
  }
});

test('原生渲染能力或编码异常返回null，独占画布仍释放', async () => {
  for(const scenario of ['ability','renderer','encode','invalid-png','empty','oversized']) {
    const f=fixture(), render=f.manager.getImageOffscreenCanvas;
    if(scenario==='ability') f.model.whiteboardBlock.abilityKit.getRatioApp=() => {throw new Error('synthetic failure');};
    else f.manager.getImageOffscreenCanvas=(...args) => {
      if(scenario==='renderer') throw new Error('synthetic failure');
      const canvas=render(...args);
      if(scenario==='encode') canvas.toDataURL=() => {throw new Error('synthetic failure');};
      if(scenario==='invalid-png') canvas.toDataURL=() => 'data:image/jpeg;base64,AA==';
      if(scenario==='empty') canvas.width=0;
      if(scenario==='oversized') canvas.width=8193;
      return canvas;
    };
    assert.equal(await renderNativeWhiteboard('board',f.options),null,scenario);
    for(const canvas of f.canvases) {assert.equal(canvas.width,0,scenario);assert.equal(canvas.height,0,scenario);}
  }
});

test('页面原有canvas不能被当作离屏输出或清空', async () => {
  const f=fixture();const visible={width:800,height:600,isConnected:true,toDataURL:() => pngDataUrl};
  f.manager.getImageOffscreenCanvas=() => visible;
  assert.equal(await renderNativeWhiteboard('board',f.options),null);
  assert.equal(visible.width,800);assert.equal(visible.height,600);
});

test('未知异步或thenable渲染接口立即回退，不调用then或等待完成', async () => {
  const f=fixture();let consumed=false;
  f.manager.getImageOffscreenCanvas=() => ({then() {consumed=true;}});
  assert.equal(await renderNativeWhiteboard('board',f.options),null);
  assert.equal(consumed,false);
});

test('原生场景等待就绪后才读取最终bounds，不支持原生能力时不等待', async () => {
  const f=fixture();let waited=0;
  f.options.waitForReady=async() => {waited++;f.bounds.maxX=510;return true;};
  assert.equal((await renderNativeWhiteboard('board',f.options)).width,1096);
  assert.equal(waited,1);
  delete f.model.whiteboardBlock.abilityKit;
  assert.equal(await renderNativeWhiteboard('board',f.options),null);
  assert.equal(waited,1);
});

test('原生画板就绪检查返回false或等待期间换文档时不调用renderer', async () => {
  for(const scenario of ['not-ready','page','root','app']) {
    const f=fixture();
    f.options.waitForReady=async() => {
      if(scenario==='page') f.pageAttributes['data-record-id']='other-page';
      if(scenario==='root') f.pageView.PageMain.blockManager.rootBlockModel={...f.root};
      if(scenario==='app') f.model.whiteboardBlock.abilityKit.getRatioApp=() => ({app:{...f.app}});
      return scenario!=='not-ready';
    };
    assert.equal(await renderNativeWhiteboard('board',f.options),null,scenario);
    assert.equal(f.calls.length,0,scenario);
  }
});

test('原生画板就绪等待的取消传播且不分配画布', async () => {
  const f=fixture();
  f.options.waitForReady=async() => {throw Object.assign(new Error('cancelled'),{name:'AbortError'});};
  await assert.rejects(renderNativeWhiteboard('board',f.options),{name:'AbortError'});
  assert.equal(f.calls.length,0);
});

test('渲染后文档归属、模型或场景变化时拒绝交付并释放离屏画布', async () => {
  for(const scenario of ['page','root','model','bounds']) {
    const f=fixture(),render=f.manager.getImageOffscreenCanvas;
    f.manager.getImageOffscreenCanvas=(...args) => {
      const canvas=render(...args);
      if(scenario==='page') f.pageAttributes['data-record-id']='other-page';
      if(scenario==='root') f.pageView.PageMain.blockManager.rootBlockModel={...f.root};
      if(scenario==='model') f.root.children=[{...f.model}];
      if(scenario==='bounds') f.bounds.maxX+=1;
      return canvas;
    };
    assert.equal(await renderNativeWhiteboard('board',f.options),null,scenario);
    assert.equal(f.canvases[0].width,0);assert.equal(f.canvases[0].height,0);
  }
});

test('原生渲染前或渲染后取消均传播AbortError，已分配画布释放', async () => {
  for(const stage of ['before','after']) {
    const f=fixture();let stopped=stage==='before';
    const render=f.manager.getImageOffscreenCanvas;
    f.manager.getImageOffscreenCanvas=(...args) => {const canvas=render(...args);stopped=true;return canvas;};
    f.options.checkStop=() => {if(stopped)throw Object.assign(new Error('cancelled'),{name:'AbortError'});};
    await assert.rejects(renderNativeWhiteboard('board',f.options),{name:'AbortError'});
    assert.equal(f.calls.length,stage==='before'?0:1);
    for(const canvas of f.canvases) {assert.equal(canvas.width,0);assert.equal(canvas.height,0);}
  }
});
