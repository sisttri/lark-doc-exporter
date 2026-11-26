import {imageDimensions} from '../importer.js';
import {readBlockContext} from './model.js';

const MAX_BYTES=24*1024*1024, CACHE_BYTES=48*1024*1024, CACHE_ENTRIES=128;
const nativeHosts=/(?:^|\.)(?:feishu\.cn|feishu\.net|larksuite\.com|larkoffice\.com|byteimg\.com|ibytedtos\.com)$/u;
const pageWindow=()=>typeof unsafeWindow==='undefined'?globalThis:unsafeWindow;
const validToken=value=>typeof value==='string' && /^[\w-]{1,256}$/u.test(value);

function trustedURL(value,location,{blob=false}={}) {
  try {
    const url=new URL(value);
    if(blob && url.protocol==='blob:' && url.origin===location?.origin) return url;
    return url.protocol==='https:' && !url.username && !url.password && !url.port && nativeHosts.test(url.hostname) ? url : null;
  } catch {return null;}
}

// A single operation deadline covers the native callback, fetch and streamed body.
function operation(checkStop,timeoutMs) {
  const controller=new AbortController();let failure,closed=false,timeout,interval;
  let rejectStopped;
  const stopped=new Promise((resolve,reject)=>{rejectStopped=reject;});
  stopped.catch(()=>{});
  const stop=error=>{if(closed || failure)return;failure=error;rejectStopped(error);controller.abort();};
  const check=()=>{if(failure)throw failure;try{checkStop();}catch(error){stop(error);throw error;}};
  timeout=setTimeout(()=>stop(new Error('素材读取超时，请稍后重试')),Math.max(1,Math.min(Number(timeoutMs)||10_000,30_000)));
  interval=setInterval(()=>{try{check();}catch{}},50);
  return {signal:controller.signal,check,
    wait:promise=>Promise.race([Promise.resolve(promise),stopped]).then(value=>{check();return value;}),
    abort:()=>controller.abort(),
    close(){closed=true;clearTimeout(timeout);clearInterval(interval);controller.abort();}};
}

async function readBytes(url,{fetch,op,image=false}) {
  op.check();
  const response=await op.wait(fetch(url.href,{credentials:'include',redirect:'error',signal:op.signal}));
  if(!response?.ok) throw new Error('素材下载失败（HTTP '+(response?.status??'未知')+'），请检查文档权限');
  let final;
  try {final=new URL(response.url || url.href);} catch {throw new Error('素材下载地址无效');}
  if(final.origin!==url.origin || final.protocol!==url.protocol || final.pathname!==url.pathname || final.search!==url.search) {
    throw new Error('素材下载地址发生变化，未保存重定向内容');
  }
  const mime=(response.headers.get('content-type')||'').split(';')[0].trim().toLowerCase();
  if(image && mime && mime!=='application/octet-stream' && !/^image\/(?:png|jpeg|gif|webp)$/u.test(mime)) {
    throw new Error('高清图片返回了非图片内容，可能需要重新登录');
  }
  const declared=response.headers.get('content-length');
  if(declared && (!/^\d+$/u.test(declared) || Number(declared)>MAX_BYTES)) throw new Error('素材大小超过单项24 MiB限制');
  const reader=response.body?.getReader();
  if(!reader) throw new Error('浏览器不支持有界素材读取');
  const chunks=[];let length=0,finished=false;
  try {
    while(true) {
      const {value,done}=await op.wait(reader.read());
      if(done){finished=true;break;}
      if(!ArrayBuffer.isView(value) || value.BYTES_PER_ELEMENT!==1) throw new Error('素材下载流格式无效');
      length+=value.byteLength;
      if(length>MAX_BYTES) throw new Error('素材大小超过单项24 MiB限制');
      chunks.push(value);
    }
    if(!length)throw new Error('素材文件为空');
    const bytes=new Uint8Array(length);let offset=0;
    for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
    return {bytes,mime};
  } finally {
    if(!finished){op.abort();try{Promise.resolve(reader.cancel()).catch(()=>{});}catch{}}
    try{reader.releaseLock();}catch{}
  }
}

function cached(cache,key,root) {
  const entry=cache instanceof Map?cache.get(key):null;
  return entry?.nativeMedia===true && entry.root===root ? entry.result : null;
}

function remember(cache,key,root,result,size) {
  if(!(cache instanceof Map))return;
  cache.delete(key);cache.set(key,{nativeMedia:true,root,result,size});
  let count=0,total=0;
  for(const value of cache.values()){if(value?.nativeMedia===true){count++;total+=value.size;}}
  for(const [oldKey,value] of cache) {
    if(count<=CACHE_ENTRIES && total<=CACHE_BYTES)break;
    if(value?.nativeMedia!==true)continue;
    cache.delete(oldKey);count--;total-=value.size;
  }
}

function dataURL(mime,bytes) {
  const parts=[];
  for(let offset=0;offset<bytes.length;offset+=0x8000)parts.push(String.fromCharCode(...bytes.subarray(offset,offset+0x8000)));
  return 'data:'+mime+';base64,'+btoa(parts.join(''));
}

export async function readNativeImage(id,{document=globalThis.document,pageView=pageWindow(),checkStop=()=>{},
  cache,timeoutMs,fetch:fetcher=globalThis.fetch}={}) {
  checkStop();
  const context=readBlockContext(document,id,{pageView,type:'image'});
  if(!context)return null;
  const {model,root}=context,manager=model.imageManager,image=model.snapshot?.image,token=image?.token;
  if(!validToken(token) || typeof manager?.fetch!=='function')return null;
  const current=()=>context.current() && model.imageManager===manager && model.snapshot?.image?.token===token;
  const alt=()=>typeof model.snapshot?.image?.name==='string'?model.snapshot.image.name:'';
  const key='native:image:'+root.record.id+':'+token;
  const previous=cached(cache,key,root);
  if(previous && current())return {...previous,blockId:id,alt:alt()};
  const op=operation(checkStop,timeoutMs);
  try {
    const sources=await op.wait(new Promise((resolve,reject)=>{
      try {Promise.resolve(manager.fetch({token,isHD:true,fuzzy:false},{},resolve)).catch(reject);}catch(error){reject(error);}
    }));
    if(!current())return null;
    const url=trustedURL(sources?.src,pageView.location||document.defaultView?.location,{blob:true});
    if(!url)throw new Error('高清图片来源地址未通过验证');
    const {bytes}=await readBytes(url,{fetch:fetcher,op,image:true});
    op.check();if(!current())return null;
    const [mime,width,height]=imageDimensions(bytes);
    if(!mime || !Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width<1 || height<1 ||
      width>8192 || height>8192 || width*height>16_000_000)throw new Error('高清图片编码无效或尺寸超过限制');
    const result={blockId:id,mime,width,height,alt:alt(),dataUrl:dataURL(mime,bytes),source:'native-hd'};
    op.check();if(!current())return null;
    remember(cache,key,root,result,bytes.byteLength);
    return result;
  } finally {op.close();}
}

export async function readNativeAttachment(id,{document=globalThis.document,pageView=pageWindow(),checkStop=()=>{},
  cache,timeoutMs,fetch:fetcher=globalThis.fetch}={}) {
  checkStop();
  const context=readBlockContext(document,id,{pageView,type:'file'});
  if(!context)return null;
  const {model,root}=context,file=model.snapshot?.file,token=file?.token,name=file?.name;
  if(!validToken(token) || typeof name!=='string' || !name.trim() || name.length>1024 || /[\u0000-\u001f]/u.test(name))return null;
  const hostname=pageView.globalConfig?.drive_api?.[0];
  if(typeof hostname!=='string' || !/^[a-z0-9.-]+$/iu.test(hostname))return null;
  const url=trustedURL('https://'+hostname+'/space/api/box/stream/download/all/'+token);
  if(!url)return null;
  url.searchParams.set('mount_node_token',model.record.id);url.searchParams.set('mount_point','docx_file');
  url.searchParams.set('synced_block_host_token',root.record.id);url.searchParams.set('synced_block_host_type','22');
  const current=()=>context.current() && model.snapshot?.file?.token===token && model.snapshot.file.name===name &&
    pageView.globalConfig?.drive_api?.[0]===hostname;
  const key='native:file:'+root.record.id+':'+token,previous=cached(cache,key,root);
  if(previous && current())return {...previous,blockId:id,name,bytes:previous.bytes.slice()};
  const op=operation(checkStop,timeoutMs);
  try {
    const {bytes,mime}=await readBytes(url,{fetch:fetcher,op});
    op.check();if(!current())return null;
    const nativeMime=typeof (file.mime_type||file.mimeType||file.mime)==='string' ? (file.mime_type||file.mimeType||file.mime).split(';')[0].trim().toLowerCase() : '';
    const html=mime==='text/html' || /^\s*(?:<!doctype\s+html|<html\b)/iu.test(new TextDecoder().decode(bytes.subarray(0,512)));
    if(html && !(/\.html?$/iu.test(name) && nativeMime==='text/html')) {
      throw new Error('附件返回了网页内容，可能需要重新登录或没有下载权限');
    }
    const jsonMime=value=>/^(?:application|text)\/(?:[\w.-]+\+)?json$/u.test(value);
    if(!(/\.json$/iu.test(name) || jsonMime(nativeMime))) {
      let jsonError=false;
      if(bytes.length<=64*1024) {
        try {
          const response=JSON.parse(new TextDecoder().decode(bytes));
          jsonError=response && typeof response==='object' && !Array.isArray(response) &&
            ['number','string'].includes(typeof response.code) && Number.isFinite(Number(response.code)) && Number(response.code)!==0 &&
            ['msg','message','error'].some(key=>typeof response[key]==='string' && response[key].trim());
        } catch {}
      }
      if(jsonMime(mime) || jsonError)throw new Error('附件返回了JSON接口响应，可能没有下载权限，未保存为原件');
    }
    const result={blockId:id,token,name,mime:mime||'application/octet-stream',bytes};
    remember(cache,key,root,{...result,bytes:bytes.slice()},bytes.byteLength);
    return result;
  } finally {op.close();}
}
