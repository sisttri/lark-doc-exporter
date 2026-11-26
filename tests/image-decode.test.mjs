import assert from 'node:assert/strict';
import test from 'node:test';
import {captureLoadedImage} from '../src/userscript/image.js';
import {mediaFixture} from './helpers/native-media.mjs';

function pendingDecode(t) {
  const fixture=mediaFixture();
  delete fixture.model.imageManager;
  let now=0, complete, entered;
  const started=new Promise(resolve=>{entered=resolve;});
  const decoded=new Promise(resolve=>{complete=resolve;});
  const previous=Object.getOwnPropertyDescriptor(globalThis,'createImageBitmap');
  globalThis.createImageBitmap=()=>{entered();return decoded;};
  t.after(()=>{if(previous)Object.defineProperty(globalThis,'createImageBitmap',previous);else delete globalThis.createImageBitmap;});
  t.mock.method(Date,'now',()=>now);
  let closed=0;
  const bitmap={width:1,height:1,close(){closed++;}};
  return {fixture,started,complete:()=>complete(bitmap),closed:()=>closed,advance:time=>{now=time;},
    options:{...fixture.options,wait:async ms=>{now+=ms;}}};
}

const observe=promise=>promise.then(value=>({value}),error=>({error}));
const boundedResult=promise=>Promise.race([promise,new Promise(resolve=>setTimeout(()=>resolve('still-pending'),200))]);

test('位图仍在解码时取消及时结束，并释放迟到结果',async t=>{
  const f=pendingDecode(t);let stopped=false;
  const result=observe(captureLoadedImage('asset',{...f.options,checkStop(){if(stopped)throw Object.assign(new Error('取消'),{name:'AbortError'});}}));
  await f.started;stopped=true;
  const beforeDecode=await boundedResult(result);
  f.complete();await result;await new Promise(resolve=>setImmediate(resolve));
  assert.notEqual(beforeDecode,'still-pending','取消不能等待位图解码完成');
  assert.equal(beforeDecode.error?.name,'AbortError');
  assert.equal(f.closed(),1);assert.equal(f.fixture.canvases.length,0);
});

test('位图解码受回退剩余期限约束，超时后释放迟到结果',async t=>{
  const f=pendingDecode(t);
  const result=observe(captureLoadedImage('asset',f.options));
  await f.started;f.advance(2501);
  const beforeDecode=await boundedResult(result);
  f.complete();await result;await new Promise(resolve=>setImmediate(resolve));
  assert.notEqual(beforeDecode,'still-pending','2500ms期限必须覆盖解码等待');
  assert.match(beforeDecode.error?.message || '',/超时/u);
  assert.equal(f.closed(),1);assert.equal(f.fixture.canvases.length,0);
});

test('解码在轮询前完成也复核期限，过期位图不进入画布',async t=>{
  const f=pendingDecode(t);
  const result=observe(captureLoadedImage('asset',f.options));
  await f.started;f.advance(2501);f.complete();
  const output=await result;
  assert.match(output.error?.message || '',/超时/u);
  assert.equal(f.closed(),1);assert.equal(f.fixture.canvases.length,0);
});
