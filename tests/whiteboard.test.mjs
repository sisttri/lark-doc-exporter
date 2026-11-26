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
  assert.deepEqual(scanned,[{top:0,height:1024},{top:1024,height:1024},{top:2048,height:952}]);
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
