import test from 'node:test';
import assert from 'node:assert/strict';
import { captureWhiteboardPreview, findWhiteboardCanvas } from '../src/userscript/whiteboard.js';
import { whiteboardFixture, pngDataUrl } from './helpers/whiteboard.mjs';

function clock(t, onWait) {
  let now = 0;
  t.mock.method(Date,'now',() => now);
  return {wait:async ms => { now += ms; onWait?.(now); },checkStop() {}};
}

test('白板仅复制明确内容层，白底填充在复制之前且返回PNG素材', async t => {
  const fixture = whiteboardFixture({decoys:true});
  assert.equal(findWhiteboardCanvas(fixture.block),fixture.content);
  const image = await captureWhiteboardPreview('board',{document:fixture.document,...clock(t)});
  assert.deepEqual(image,{blockId:'board',mime:'image/png',width:64,height:32,alt:'白板静态预览（当前画面）',dataUrl:pngDataUrl});
  assert.deepEqual(fixture.draws,[[fixture.content,0,0]]);
  assert.deepEqual(fixture.fills,[{color:'#ffffff',args:[0,0,64,32]}]);
  assert.deepEqual(fixture.operations,['fill','draw']);
  assert.equal(fixture.outputs[0].width,64);
  assert.equal(fixture.outputs[0].height,32);
});

test('白板像素判定扫描到后方条带，读取异常不能当作已就绪', async t => {
  const fixture = whiteboardFixture({height:3000});
  const scanned = [];
  fixture.content.getContext = () => ({getImageData(left,top,width,height) {
    scanned.push({top,height});
    return {data:new Uint8ClampedArray([0,0,0,top >= 2048 ? 255 : 0])};
  }});
  await captureWhiteboardPreview('board',{document:fixture.document,...clock(t)});
  const strips=[{top:0,height:1024},{top:1024,height:1024},{top:2048,height:952}];
  assert.ok(scanned.length >= strips.length*3);
  for (let start=0;start<scanned.length;start+=strips.length) assert.deepEqual(scanned.slice(start,start+strips.length),strips);
  fixture.content.getContext = () => ({getImageData() {throw new Error('合成像素读取失败');}});
  await assert.rejects(captureWhiteboardPreview('board',{document:fixture.document,...clock(t)}),/读取失败/u);
});

test('白板优先保留明确不透明背景，透明背景回退白色', async t => {
  for (const [background,expected] of [['rgb(12, 34, 56)','rgb(12, 34, 56)'],['rgba(12, 34, 56, 0.5)','#ffffff']]) {
    const fixture = whiteboardFixture({background});
    await captureWhiteboardPreview('board',{document:fixture.document,...clock(t)});
    assert.equal(fixture.fills[0].color,expected);
  }
});

test('白板等待每次重查节点，替换后复制新内容画布', async t => {
  const fixture = whiteboardFixture();
  const replacement = fixture.layer(fixture.stage,'content'); replacement.isConnected = false;
  const timing = clock(t,() => {fixture.content.isConnected=false;replacement.isConnected=true;});
  await captureWhiteboardPreview('board',{document:fixture.document,...timing});
  assert.deepEqual(fixture.draws,[[replacement,0,0]]);
});

test('白板拒绝无尺寸、隐藏、多个内容画布和其他块中的内容', async t => {
  for (const scenario of ['zero','hidden','multiple','nested']) {
    const fixture = whiteboardFixture();
    if (scenario === 'zero') fixture.content.width = 0;
    if (scenario === 'hidden') fixture.stage.style.visibility = 'hidden';
    if (scenario === 'multiple') fixture.layer(fixture.stage,'content');
    if (scenario === 'nested') {
      const nested = fixture.element('div','nested',fixture.block,{'data-block-type':'whiteboard'});
      fixture.stage.parentElement = nested;
    }
    assert.equal(findWhiteboardCanvas(fixture.block),null,scenario);
    await assert.rejects(captureWhiteboardPreview('board',{document:fixture.document,...clock(t)}),/白板/u);
    assert.deepEqual(fixture.draws,[],scenario);
  }
});

test('白板超出现有图片尺寸限制时明确失败，复制前拒绝分配大画布', async t => {
  for (const [width,height] of [[8193,1],[1,8193],[5000,4000]]) {
    const fixture = whiteboardFixture({width,height});
    await assert.rejects(captureWhiteboardPreview('board',{document:fixture.document,...clock(t)}),/尺寸/u);
    assert.deepEqual(fixture.outputs,[]);
    assert.equal(fixture.content.reads,0);
  }
});

test('白板透明内容层等待实际像素绘制，始终透明时明确未确认', async t => {
  for (const paints of [false,true]) {
    const fixture = whiteboardFixture(); fixture.content.alpha = 0;
    const timing = clock(t,now => {if (paints && now >= 420) fixture.content.alpha=255;});
    const pending = captureWhiteboardPreview('board',{document:fixture.document,...timing});
    if (paints) {
      assert.equal((await pending).dataUrl,pngDataUrl);
      assert.deepEqual(fixture.draws,[[fixture.content,0,0]]);
    } else {
      await assert.rejects(pending,/未绘制|未确认/u);
      assert.deepEqual(fixture.outputs,[]);
    }
  }
});

test('白板复制不可读、无上下文或导出空及错误类型数据时明确失败', async t => {
  for (const scenario of ['tainted','context','empty','wrong-type']) {
    const fixture = whiteboardFixture();
    const create = fixture.document.createElement;
    fixture.document.createElement = (...args) => {
      const output = create(...args);
      if (scenario === 'context') output.getContext = () => null;
      output.toDataURL = () => {
        if (scenario === 'tainted') throw Object.assign(new Error('合成不可读画布'),{name:'SecurityError'});
        return scenario === 'empty' ? 'data:,' : 'data:image/jpeg;base64,AA==';
      };
      return output;
    };
    await assert.rejects(captureWhiteboardPreview('board',{document:fixture.document,...clock(t)}));
  }
});

test('白板有界等待可以取消，不交付尚未采集的素材', async t => {
  const fixture = whiteboardFixture(); fixture.content.width = 0;
  let cancelled = false;
  const timing = clock(t,() => {cancelled=true;});
  await assert.rejects(captureWhiteboardPreview('board',{document:fixture.document,...timing,checkStop() {
    if (cancelled) throw Object.assign(new Error('已取消'),{name:'AbortError'});
  }}),{name:'AbortError'});
  assert.deepEqual(fixture.draws,[]);
});

test('已知白板view原生重绘到两倍真实像素，复制后精确恢复内联样式与尺寸', async t => {
  const original='width: 64px; height: 32px; border: 0;';
  const fixture=whiteboardFixture({view:true,viewStyle:original});
  const image=await captureWhiteboardPreview('board',{document:fixture.document,
    ...clock(t,() => fixture.redraw())});
  assert.equal(image.width,128);assert.equal(image.height,64);
  assert.ok(fixture.styleWrites.some(write => write.name === 'width' && write.value === '128px' && write.priority === 'important'));
  assert.ok(fixture.styleWrites.some(write => write.name === 'max-width' && write.value === 'none'));
  assert.deepEqual(fixture.draws,[[fixture.content,0,0]]);
  assert.equal(fixture.view.getAttribute('style'),original);
  assert.equal(fixture.content.width,64);assert.equal(fixture.content.height,32);
});

test('白板已有每CSS像素两点的内容画布时不修改view', async t => {
  const fixture=whiteboardFixture({view:true,width:128,height:64,cssWidth:64,cssHeight:32});
  const image=await captureWhiteboardPreview('board',{document:fixture.document,...clock(t)});
  assert.equal(image.width,128);assert.equal(image.height,64);
  assert.deepEqual(fixture.styleWrites,[]);
});

test('原生白板不支持重绘时恢复布局并复制原像素，明确清晰度限制', async t => {
  const fixture=whiteboardFixture({view:true});
  const image=await captureWhiteboardPreview('board',{document:fixture.document,...clock(t)});
  assert.equal(image.width,64);assert.equal(image.height,32);
  assert.match(image.alt,/清晰度受页面限制/u);
  assert.equal(fixture.view.getAttribute('style'),null);
  assert.equal(fixture.outputs.length,1);
  assert.deepEqual(fixture.draws,[[fixture.content,0,0]]);
});

test('白板原生重绘保持比例并遵守边长与像素预算', async t => {
  for (const [width,height] of [[5000,1000],[3000,3000],[4000,3000],[8192,1]]) {
    const fixture=whiteboardFixture({view:true,width,height});
    const image=await captureWhiteboardPreview('board',{document:fixture.document,
      ...clock(t,() => fixture.redraw())});
    assert.ok(image.width <= 8192 && image.height <= 8192 && image.width*image.height <= 16_000_000);
    assert.ok(image.width <= width*2 && image.height <= height*2);
    assert.ok(Math.abs(image.width/image.height-width/height) <= 0.01);
    if (width < 8192) {
      assert.ok(image.width > width && image.height > height);
      assert.match(image.alt,/清晰度受页面限制/u);
    } else assert.deepEqual(fixture.styleWrites,[]);
    assert.equal(fixture.view.getAttribute('style'),null);
  }
});

test('白板重绘中替换内容节点后重查并等待新节点像素稳定', async t => {
  const fixture=whiteboardFixture({view:true});
  const replacement=fixture.layer(fixture.stage,'content');replacement.isConnected=false;
  let copiedAt=0;
  const timing=clock(t,now => {
    if (now >= 120) {fixture.content.isConnected=false;replacement.isConnected=true;}
    fixture.redraw();copiedAt=now;
  });
  const image=await captureWhiteboardPreview('board',{document:fixture.document,...timing});
  assert.equal(image.width,128);
  assert.deepEqual(fixture.draws,[[replacement,0,0]]);
  assert.ok(copiedAt >= 360);
  assert.equal(fixture.view.getAttribute('style'),null);
});

test('白板取消或复制异常时finally恢复view，恢复等待不再检查取消', async t => {
  for (const failure of ['cancel','copy']) {
    const fixture=whiteboardFixture({view:true,viewStyle:''});
    let now=0;
    const timing=clock(t,time => {now=time;fixture.redraw();});
    if (failure === 'copy') fixture.document.createElement=() => {throw new Error('合成复制失败');};
    await assert.rejects(captureWhiteboardPreview('board',{document:fixture.document,...timing,checkStop() {
      if (failure === 'cancel' && now >= 120) throw Object.assign(new Error('已取消'),{name:'AbortError'});
    }}),failure === 'cancel' ? {name:'AbortError'} : /合成复制失败/u);
    assert.equal(fixture.view.getAttribute('style'),'');
    assert.equal(fixture.content.width,64);assert.equal(fixture.content.height,32);
    assert.ok(fixture.styleWrites.some(write => write.name === 'width' && write.value === '128px'));
  }
});

test('白板背景已绘制但内容稍晚出现时等待非背景像素与内容稳定窗口', async t => {
  const fixture=whiteboardFixture({view:true});
  let now=0, copiedAt=0;
  fixture.content.getContext=() => ({getImageData() {
    return {data:new Uint8ClampedArray(now < 420 ? [255,255,255,255] : now < 540 ? [20,20,20,255] : [0,0,0,255])};
  }});
  const draw=fixture.document.createElement;
  fixture.document.createElement=(...args) => {copiedAt=now;return draw(...args);};
  await captureWhiteboardPreview('board',{document:fixture.document,...clock(t,time => {now=time;fixture.redraw();})});
  assert.ok(copiedAt >= 780,'内容最后变化后至少稳定240ms才复制');
});

test('只有背景的白板有界失败，不把背景误报为绘制完成', async t => {
  const fixture=whiteboardFixture();
  fixture.content.getContext=() => ({getImageData:() => ({data:new Uint8ClampedArray([255,255,255,255])})});
  await assert.rejects(captureWhiteboardPreview('board',{document:fixture.document,...clock(t)}),/未绘制|未确认/u);
  assert.deepEqual(fixture.outputs,[]);
});

test('白板内容画布晚挂载后仍尝试已知view的高清重绘', async t => {
  const fixture=whiteboardFixture({view:true});fixture.content.isConnected=false;
  const image=await captureWhiteboardPreview('board',{document:fixture.document,...clock(t,now => {
    if (now >= 240) fixture.content.isConnected=true;
    fixture.redraw();
  })});
  assert.equal(image.width,128);assert.equal(image.height,64);
  assert.equal(fixture.view.getAttribute('style'),null);
});

test('白板view必须是当前块唯一可见的已知容器才能修改样式', async t => {
  for (const scenario of ['multiple','hidden','nested','unrelated']) {
    const fixture=whiteboardFixture({view:true});
    if (scenario === 'multiple') fixture.element('div','whiteboard-view-container is-block',fixture.block);
    if (scenario === 'hidden') fixture.view.style.visibility='hidden';
    if (scenario === 'nested') {
      const nested=fixture.element('div','nested',fixture.block,{'data-block-type':'whiteboard'});
      fixture.view.parentElement=nested;
    }
    if (scenario === 'unrelated') fixture.stage.parentElement=fixture.block;
    const pending=captureWhiteboardPreview('board',{document:fixture.document,...clock(t)});
    if (scenario === 'hidden' || scenario === 'nested') await assert.rejects(pending,/白板/u);
    else assert.equal((await pending).width,64);
    assert.deepEqual(fixture.styleWrites,[],scenario);
  }
});

test('白板重绘期间view被替换时仅恢复原view并回退当前原预览', async t => {
  const fixture=whiteboardFixture({view:true,viewStyle:'border: 0;'});
  const replacement=fixture.element('div','whiteboard-view-container is-block',fixture.block);
  replacement.isConnected=false;
  const image=await captureWhiteboardPreview('board',{document:fixture.document,...clock(t,now => {
    if (now >= 120) {fixture.view.isConnected=false;replacement.isConnected=true;fixture.stage.parentElement=replacement;}
  })});
  assert.equal(image.width,64);
  assert.equal(fixture.view.getAttribute('style'),'border: 0;');
  assert.equal(replacement.getAttribute('style'),null);
  assert.ok(fixture.styleWrites.every(write => write.node === fixture.view));
});

test('白板等待或像素读取异常时仍恢复原view样式', async t => {
  for (const scenario of ['wait','pixels']) {
    const fixture=whiteboardFixture({view:true,viewStyle:'border: 0;'});
    const timing=clock(t,() => fixture.redraw());
    if (scenario === 'wait') timing.wait=async () => {throw new Error('合成等待失败');};
    else fixture.content.getContext=() => ({getImageData() {throw new Error('合成读取失败');}});
    await assert.rejects(captureWhiteboardPreview('board',{document:fixture.document,...timing}),/合成/u);
    assert.equal(fixture.view.getAttribute('style'),'border: 0;');
    assert.ok(fixture.styleWrites.some(write => write.name === 'width'));
  }
});

test('原生重绘意外超出预算时恢复并回退原预览，不分配超限输出', async t => {
  const fixture=whiteboardFixture({view:true});
  const image=await captureWhiteboardPreview('board',{document:fixture.document,...clock(t,() => {
    fixture.redraw();
    if (fixture.view.style.width) fixture.content.width=8193;
  })});
  assert.equal(image.width,64);assert.equal(image.height,32);
  assert.match(image.alt,/清晰度受页面限制/u);
  assert.equal(fixture.view.getAttribute('style'),null);
  assert.equal(fixture.outputs.length,1);
});

test('恢复布局期间收到取消也先完成恢复，再拒绝交付已复制素材', async t => {
  const fixture=whiteboardFixture({view:true});
  let now=0;
  await assert.rejects(captureWhiteboardPreview('board',{document:fixture.document,
    ...clock(t,time => {now=time;fixture.redraw();}),checkStop() {
      if (now >= 400) throw Object.assign(new Error('已取消'),{name:'AbortError'});
    }}),{name:'AbortError'});
  assert.equal(fixture.view.getAttribute('style'),null);
  assert.equal(fixture.content.width,64);assert.equal(fixture.content.height,32);
});
