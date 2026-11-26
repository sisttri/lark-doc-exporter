import assert from 'node:assert/strict';
import test from 'node:test';
import {resolveObjectURL} from 'node:buffer';
import {downloadFile} from '../src/userscript/download.js';

function browser({cancelBefore=false,cancelAfter=false,undelivered=false,failAt,cleanupThrows=false}={}) {
  const body=[],downloads=[],urls=[],timers=[];
  const failure=new Error('synthetic '+failAt+' failure');
  class Anchor extends EventTarget {
    click() {
      if(failAt==='click') throw failure;
      if(undelivered) return;
      const event=new Event('click',{bubbles:true,cancelable:true});
      if(cancelBefore) event.preventDefault();
      this.dispatchEvent(event);
      if(cancelAfter) event.preventDefault();
      if(!event.defaultPrevented) downloads.push({name:this.download,blob:resolveObjectURL(this.href)});
    }
    remove() {
      const index=body.indexOf(this);
      if(index>=0) body.splice(index,1);
      if(cleanupThrows) throw new Error('synthetic anchor cleanup failure');
    }
  }
  const view={
    document:{
      createElement(tag) {
        assert.equal(tag,'a');
        if(failAt==='createElement') throw failure;
        return new Anchor();
      },
      body:{append(link) {body.push(link);if(failAt==='append') throw failure;}},
    },
    URL:{
      createObjectURL(blob) {
        if(failAt==='createObjectURL') throw failure;
        const url=URL.createObjectURL(blob);urls.push(url);return url;
      },
      revokeObjectURL(url) {
        URL.revokeObjectURL(url);
        if(cleanupThrows) throw new Error('synthetic URL cleanup failure');
      },
    },
    setTimeout(fn,delay) {
      if(failAt==='setTimeout') throw failure;
      timers.push({fn,delay});return timers.length;
    },
  };
  return {view,body,downloads,urls,timers,failure,cleanup(){for(const url of urls)URL.revokeObjectURL(url);}};
}

test('正常下载向浏览器交付原始 Blob 和文件名，移除链接并延迟释放 URL', async t=>{
  const f=browser();t.after(f.cleanup);
  const blob=new Blob(['sample'],{type:'text/plain'});
  assert.equal(downloadFile(f.view,blob,'示例.txt'),undefined);
  assert.equal(f.downloads.length,1);
  assert.equal(f.downloads[0].name,'示例.txt');
  assert.equal(f.downloads[0].blob.type,'text/plain');
  assert.equal(await f.downloads[0].blob.text(),'sample');
  assert.deepEqual(f.body,[]);
  assert.equal(await resolveObjectURL(f.urls[0]).text(),'sample');
  assert.equal(f.timers.length,1);
  f.timers[0].fn();
  assert.equal(resolveObjectURL(f.urls[0]),undefined);
});

for(const scenario of ['cancelBefore','cancelAfter','undelivered']) {
  test('下载点击'+scenario+'时明确失败，不假报已交付或保留 URL',t=>{
    const f=browser({[scenario]:true});t.after(f.cleanup);
    assert.throws(()=>downloadFile(f.view,new Blob(['sample']),'sample.txt'),error=>
      error.code==='download_blocked' && /取消|阻止/u.test(error.message));
    assert.deepEqual(f.downloads,[]);
    assert.deepEqual(f.body,[]);
    assert.deepEqual(f.timers,[]);
    assert.ok(f.urls.every(url=>resolveObjectURL(url)===undefined));
  });
}

for(const failAt of ['createObjectURL','createElement','append','click','setTimeout']) {
  test('下载 '+failAt+' 异常传播原错误并清理已分配的链接与 URL',t=>{
    const f=browser({failAt});t.after(f.cleanup);
    assert.throws(()=>downloadFile(f.view,new Blob(['sample']),'sample.txt'),error=>error===f.failure);
    assert.deepEqual(f.body,[]);
    assert.ok(f.urls.every(url=>resolveObjectURL(url)===undefined));
  });
}

test('失败清理本身抛错不会覆盖下载被取消这一错误',t=>{
  const f=browser({cancelAfter:true,cleanupThrows:true});t.after(f.cleanup);
  assert.throws(()=>downloadFile(f.view,new Blob(['sample']),'sample.txt'),{code:'download_blocked'});
  assert.deepEqual(f.body,[]);
  assert.ok(f.urls.every(url=>resolveObjectURL(url)===undefined));
});

test('成功后的链接和延迟 URL 清理异常不会变成未处理错误',t=>{
  const f=browser({cleanupThrows:true});t.after(f.cleanup);
  assert.doesNotThrow(()=>downloadFile(f.view,new Blob(['sample']),'sample.txt'));
  assert.equal(f.downloads.length,1);
  assert.deepEqual(f.body,[]);
  assert.doesNotThrow(()=>f.timers[0].fn());
  assert.equal(resolveObjectURL(f.urls[0]),undefined);
});
