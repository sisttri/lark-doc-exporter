import test from 'node:test';
import assert from 'node:assert/strict';
import {captureDiagram} from '../src/userscript/diagram.js';
import {diagramFixture,diagramElement,htmlNamespace} from './helpers/diagram.mjs';
import {pngDataUrl} from './helpers/whiteboard.mjs';

test('流程图保留真正 SVG 主资产与四倍高清 PNG 回退，保留 HTML 标签与白色背景', async () => {
  const f=diagramFixture(),before=JSON.stringify(f.source);
  const image=await captureDiagram(f.document,'diagram',f.options);
  assert.equal(image.mime,'image/svg+xml');assert.equal(image.width,200);assert.equal(image.height,100);
  assert.equal(image.blockId,'diagram');assert.equal(image.alt,'流程图');
  const primary=Buffer.from(image.dataUrl.split(',')[1],'base64').toString('utf8');
  assert.match(primary,/<foreignObject/u);assert.match(primary,/示例标签/u);assert.match(primary,/第二行/u);
  assert.deepEqual(image.rasterFallback,{mime:'image/png',width:800,height:400,dataUrl:pngDataUrl});
  assert.deepEqual(f.calls.slice(0,2),[1,4]);
  const svg=decodeURIComponent(f.sources[0].split(',')[1]);
  assert.match(svg,/<foreignObject/u);assert.match(svg,/<strong>示例标签<\/strong>/u);
  assert.match(svg,/第二行/u);assert.match(svg,/display:flex;align-items:center;white-space:normal/u);
  assert.match(svg,/xmlns="http:\/\/www.w3.org\/1999\/xhtml"/u);
  assert.equal(JSON.stringify(f.source),before);
  assert.equal(f.operations[0].name,'fill');assert.equal(f.operations[0].color,'#ffffff');
  assert.deepEqual(f.operations[0].args,[0,0,800,400]);assert.equal(f.operations[1].name,'draw');
  assert.equal(f.outputs[0].width,0);assert.equal(f.outputs[0].height,0);assert.equal(f.images[0].src,'');
});

test('流程图在请求原生渲染前限制边长和像素预算', async () => {
  for(const [width,height] of [[6000,2000],[3000,3000],[40000,4000]]) {
    const f=diagramFixture();
    f.view.getSvg=(scale=1) => {
      f.calls.push(scale);
      return diagramElement('svg',{width:width*scale+'px',height:height*scale+'px',viewBox:'0 0 '+width*scale+' '+height*scale},f.source.childNodes);
    };
    const image=await captureDiagram(f.document,'diagram',f.options);
    assert.ok(image);const output=image.rasterFallback;
    assert.ok(output.width<=8192 && output.height<=8192 && output.width*output.height<=16_000_000);
    assert.ok(f.calls[1]>0 && f.calls[1]<=4);
  }
});

test('流程图拒绝缺失能力、错文档、错记录和不连通块', async () => {
  for(const scenario of ['view','root','model','page-record','block-record','model-type','dom-type','detached','bad-id']) {
    const f=diagramFixture();
    if(scenario==='view') delete f.view.getSvg;
    if(scenario==='root') delete f.pageView.PageMain.blockManager.rootBlockModel;
    if(scenario==='model') f.root.children=[];
    if(scenario==='page-record') f.root.record.id='other-page';
    if(scenario==='block-record') f.model.record.id='other-record';
    if(scenario==='model-type') f.model.type='image';
    if(scenario==='dom-type') f.attributes['data-block-type']='view';
    if(scenario==='detached') f.block.isConnected=false;
    assert.equal(await captureDiagram(f.document,scenario==='bad-id'?'diagram"]': 'diagram',f.options),null,scenario);
    assert.equal(f.outputs.length,0,scenario);
  }
});

test('流程图可在同步引用内匹配数字模型 ID，并终止循环模型遍历', async () => {
  const f=diagramFixture(),query=f.document.querySelector;
  f.model.id=7;f.attributes['data-block-id']='7';
  f.document.querySelector=selector => selector==='[data-block-id="7"]' ? f.block : query(selector);
  f.root.children=[{innerBlockManager:{rootBlockModel:{children:[f.model]}}}];f.model.children=[f.root];
  assert.equal((await captureDiagram(f.document,'7',f.options)).blockId,'7');
});

test('流程图拒绝非法尺寸和超过预算的原生返回结果', async () => {
  for(const attrs of [{width:'0',height:'20',viewBox:'0 0 0 20'},
    {width:'NaN',height:'20',viewBox:'0 0 1 20'}, {width:'200%',height:'20',viewBox:'0 0 200 20'},
    {width:'200',height:'20',viewBox:'0 0 -200 20'},{width:'8193',height:'8193',viewBox:'0 0 8193 8193'}]) {
    const f=diagramFixture();f.view.getSvg=() => diagramElement('svg',attrs,f.source.childNodes);
    assert.equal(await captureDiagram(f.document,'diagram',f.options),null);assert.equal(f.outputs.length,0);
  }
});

test('流程图拒绝主动内容、外部资源和未知命名空间，不能静默删除文字', async () => {
  const dangerous=[diagramElement('script',{},[{nodeType:3,data:'alert(1)'}]),
    diagramElement('animate',{}),diagramElement('rect',{onclick:'alert(1)'}),
    diagramElement('rect',{fill:'url(https://example.invalid/image)'}),
    diagramElement('rect',{style:'background:u\\rl(https://example.invalid/image)'}),
    diagramElement('rect',{href:'https://example.invalid/image'}),
    diagramElement('rect',{style:'@import "https://example.invalid/style"'}),
    diagramElement('rect',{style:'background-image:image-set("https://example.invalid/image" 1x)'}),
    diagramElement('div',{},[], 'urn:unknown'),
    diagramElement('foreignObject',{},[diagramElement('iframe',{src:'https://example.invalid'},[],htmlNamespace)]),
  ];
  for(const node of dangerous) {
    const f=diagramFixture();f.source.childNodes.push(node);
    assert.equal(await captureDiagram(f.document,'diagram',f.options),null,node.localName);
    assert.equal(f.sources.length,0);assert.equal(f.outputs.length,0);
  }
});

test('流程图解码失败或编码失败返回 null 并释放自己的图片与画布', async () => {
  for(const scenario of ['decode','canvas','encode','invalid-png']) {
    const f=diagramFixture();
    if(scenario==='decode') f.setDecodeHook(() => Promise.reject(new Error('synthetic decode failure')));
    if(scenario==='canvas') f.document.createElement=() => {throw new Error('synthetic canvas failure');};
    if(['encode','invalid-png'].includes(scenario)) {
      const create=f.document.createElement;
      f.document.createElement=tag => {const canvas=create(tag);canvas.toDataURL=() => {
        if(scenario==='encode') throw new Error('synthetic encode failure');
        return 'data:image/jpeg;base64,AA==';
      };return canvas;};
    }
    assert.equal(await captureDiagram(f.document,'diagram',f.options),null,scenario);
    for(const canvas of f.outputs) {assert.equal(canvas.width,0);assert.equal(canvas.height,0);}
    for(const image of f.images) assert.equal(image.src,'');
  }
});

test('流程图等待期间切换文档、替换模型或修改内容会拒绝交付', async () => {
  for(const scenario of ['page','root','model','view','svg']) {
    const f=diagramFixture();f.setDecodeHook(() => {
      if(scenario==='page') f.pageAttributes['data-record-id']='other-page';
      if(scenario==='root') f.pageView.PageMain.blockManager.rootBlockModel={...f.root};
      if(scenario==='model') f.root.children=[{...f.model}];
      if(scenario==='view') f.model.blockManager.getBlockViewByBlockId=() => ({...f.view});
      if(scenario==='svg') f.labels.childNodes[0].childNodes.push({nodeType:3,data:'changed'});
      return Promise.resolve();
    });
    assert.equal(await captureDiagram(f.document,'diagram',f.options),null,scenario);
    assert.equal(f.outputs.length,0,scenario);
  }
});

test('流程图解码前与绘制后取消均传播 AbortError 并释放资源', async () => {
  for(const stage of ['before','decode','draw']) {
    const f=diagramFixture();let cancelled=stage==='before';
    f.options.checkStop=() => {if(cancelled)throw Object.assign(new Error('cancelled'),{name:'AbortError'});};
    if(stage==='decode') f.setDecodeHook(() => {cancelled=true;return Promise.resolve();});
    if(stage==='draw') {
      const create=f.document.createElement;
      f.document.createElement=tag => {const canvas=create(tag),context=canvas.getContext('2d'),draw=context.drawImage;
        context.drawImage=(...args) => {draw(...args);cancelled=true;};return canvas;};
    }
    await assert.rejects(captureDiagram(f.document,'diagram',f.options),{name:'AbortError'});
    for(const canvas of f.outputs) {assert.equal(canvas.width,0);assert.equal(canvas.height,0);}
    for(const image of f.images) assert.equal(image.src,'');
  }
});

test('流程图解码长时间无响应会有界退出且不分配画布', async t => {
  t.mock.timers.enable({apis:['setTimeout','Date'],now:0});
  const f=diagramFixture();f.setDecodeHook(() => new Promise(()=>{}));
  const result=captureDiagram(f.document,'diagram',f.options);
  t.mock.timers.tick(8000);
  assert.equal(await result,null);
  assert.equal(f.outputs.length,0);assert.equal(f.images[0].src,'');
});

test('流程图等待解码时取消及时传播并清除未完成图片', async t => {
  t.mock.timers.enable({apis:['setTimeout','Date'],now:0});
  const f=diagramFixture();let cancelled=false;
  f.options.checkStop=() => {if(cancelled)throw Object.assign(new Error('cancelled'),{name:'AbortError'});};
  f.setDecodeHook(() => new Promise(()=>{}));
  const result=captureDiagram(f.document,'diagram',f.options);
  cancelled=true;t.mock.timers.tick(100);
  await assert.rejects(result,{name:'AbortError'});
  assert.equal(f.outputs.length,0);assert.equal(f.images[0].src,'');
});

test('流程图资源清理失败不能覆盖原始取消信号', async () => {
  const f=diagramFixture();let cancelled=false;
  f.options.checkStop=() => {if(cancelled)throw Object.assign(new Error('cancelled'),{name:'AbortError'});};
  const create=f.document.createElement;
  f.document.createElement=tag => {
    const canvas=create(tag),context=canvas.getContext('2d'),draw=context.drawImage;
    context.drawImage=(...args) => {
      draw(...args);cancelled=true;
      Object.defineProperty(canvas,'width',{set(){throw new Error('synthetic cleanup failure');}});
    };
    return canvas;
  };
  await assert.rejects(captureDiagram(f.document,'diagram',f.options),{name:'AbortError'});
});

test('流程图绘制或编码期间源内容变化不会交付旧版本图片', async () => {
  for(const stage of ['draw','encode']) {
    const f=diagramFixture(),create=f.document.createElement;
    const change=() => f.labels.childNodes[0].childNodes.push({nodeType:3,data:'changed'});
    f.document.createElement=tag => {
      const canvas=create(tag);
      if(stage==='draw') {
        const context=canvas.getContext('2d'),draw=context.drawImage;
        context.drawImage=(...args) => {draw(...args);change();};
      } else canvas.toDataURL=() => {change();return pngDataUrl;};
      return canvas;
    };
    assert.equal(await captureDiagram(f.document,'diagram',f.options),null,stage);
    assert.equal(f.outputs[0].width,0);assert.equal(f.outputs[0].height,0);
  }
});
