import assert from 'node:assert/strict';
import test from 'node:test';
import {captureLoadedImage,readImageState,sameImageState} from '../src/userscript/image.js';
import {mediaFixture} from './helpers/native-media.mjs';

test('图片采集优先保存原生高清资源，并交付实际页面状态供最终复核',async()=>{
  const f=mediaFixture(),state=readImageState(f.block);
  const result=await captureLoadedImage('asset',{...f.options,cache:new Map()});
  assert.equal(result.image.source,'native-hd');assert.equal(result.image.mime,'image/png');
  assert.equal(sameImageState(result.state,state),true);assert.equal(f.canvases.length,0);
});

test('原生高清资源读取失败仍可保存已加载位图，保留现有稳定性检查',async()=>{
  const f=mediaFixture();f.model.imageManager.fetch=(a,b,resolve)=>resolve({src:'https://other.invalid/image'});
  const result=await captureLoadedImage('asset',{...f.options,wait:ms=>new Promise(resolve=>setTimeout(resolve,ms))});
  assert.equal(result.image.mime,'image/png');assert.equal(result.image.width,1);assert.equal(f.canvases.length,1);
  assert.equal(result.image.source,'loaded-bitmap');
});

test('高清请求耗时不挤占已加载位图回退的稳定等待期限',async t=>{
  const f=mediaFixture();let now=0;t.mock.method(Date,'now',()=>now);
  f.options.fetch=async()=>{now=4000;return f.response(undefined,{status:403});};
  f.options.wait=async ms=>{now+=ms;};
  const result=await captureLoadedImage('asset',f.options);
  assert.equal(result.image.source,'loaded-bitmap');assert.equal(f.canvases.length,1);
});

test('用户取消原生图片读取时不继续位图回退或分配画布',async()=>{
  const f=mediaFixture();let stopped=false;
  f.model.imageManager.fetch=()=>new Promise(()=>{});
  const result=captureLoadedImage('asset',{...f.options,checkStop(){if(stopped)throw Object.assign(new Error('取消'),{name:'AbortError'});}});
  stopped=true;await assert.rejects(result,{name:'AbortError'});assert.equal(f.canvases.length,0);
});
