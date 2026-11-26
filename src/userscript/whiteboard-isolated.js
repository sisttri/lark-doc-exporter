import {readBlockContext} from './model.js';

const pageWindow=()=>typeof unsafeWindow==='undefined'?globalThis:unsafeWindow;
const release=wrapper=>{try{Promise.resolve(wrapper?.release?.()).catch(()=>{});}catch{}};
function boundsOf(manager) {
  const bounds=manager.getNodesBounds();
  if(!bounds || !['minX','maxX','minY','maxY'].every(name=>Number.isFinite(bounds[name])))return null;
  const {minX,maxX,minY,maxY}=bounds,width=maxX-minX+48,height=maxY-minY+48;
  if(maxX<=minX || maxY<=minY || !Number.isFinite(width*height))return null;
  return {minX,maxX,minY,maxY};
}

// The proxy may allocate before resolving. A DOM preview is never a scene-size budget.
export async function readIsolatedWhiteboard(id,{document=globalThis.document,pageView=pageWindow(),
  checkStop=()=>{},waitForReady,timeoutMs=8000}={}) {
  let wrapper,canvas,owned=false,finished=false,timer,interval,rejectStopped;
  try {
    checkStop();
    const context=readBlockContext(document,id,{pageView,type:'whiteboard'});
    if(!context)return null;
    const board=context.model.whiteboardBlock,environment=board?.isolateEnv;
    if(typeof environment?.getRatioApp!=='function')return null;
    const ratioApp=environment.getRatioApp(),proxy=ratioApp?.ratioAppProxy,app=ratioApp?.app;
    const manager=app?.application?.nodeManager;
    if(typeof proxy?.getOriginImageDataByNodeId!=='function' || typeof manager?.getNodesBounds!=='function')return null;
    const current=()=>{
      const next=environment.getRatioApp();
      return context.current() && context.model.whiteboardBlock===board && board.isolateEnv===environment &&
        next?.ratioAppProxy===proxy && next.app===app && app.application?.nodeManager===manager;
    };
    const stopped=new Promise((resolve,reject)=>{rejectStopped=reject;});stopped.catch(()=>{});
    timer=setTimeout(()=>rejectStopped(new Error('隔离画板读取超时')),Math.max(1,Math.min(Number(timeoutMs)||8000,30_000)));
    interval=setInterval(()=>{try{checkStop();}catch(error){rejectStopped(error);}},50);
    const wait=promise=>Promise.race([Promise.resolve(promise),stopped]);
    if(waitForReady && await wait(waitForReady())===false)return null;
    checkStop();if(!current())return null;
    const bounds=boundsOf(manager);
    if(!bounds)return null;
    const width=bounds.maxX-bounds.minX+48,height=bounds.maxY-bounds.minY+48;
    const ratio=Math.min(2,8192/width,8192/height,Math.sqrt(15_900_000/(width*height)));
    if(!Number.isFinite(ratio) || ratio<=0)return null;
    const maxWidth=Math.ceil(width*ratio),maxHeight=Math.ceil(height*ratio);
    // All wrappers are owned, including values arriving after timeout or cancellation.
    const receiving=Promise.resolve(proxy.getOriginImageDataByNodeId(24,[''],false,ratio)).then(value=>{
      if(finished)release(value);else wrapper=value;
      return value;
    });
    await wait(receiving);checkStop();
    const finalBounds=boundsOf(manager);
    if(!current() || !finalBounds || Object.keys(bounds).some(key=>bounds[key]!==finalBounds[key]))return null;
    const data=wrapper?.data,w=data?.width,h=data?.height,pixels=data?.data;
    if(!Number.isSafeInteger(w) || !Number.isSafeInteger(h) || w<1 || h<1 || w!==maxWidth || h!==maxHeight ||
      w>8192 || h>8192 || w*h>16_000_000 || !ArrayBuffer.isView(pixels) || pixels.BYTES_PER_ELEMENT!==1 || pixels.byteLength!==w*h*4)return null;
    canvas=document.createElement('canvas');
    if(canvas.isConnected===true || document.contains?.(canvas))return null;
    owned=true;canvas.width=w;canvas.height=h;
    const output=canvas.getContext('2d');
    if(!output)return null;
    output.putImageData(data,0,0);checkStop();
    const dataUrl=canvas.toDataURL('image/png');
    if(dataUrl.length>32*1024*1024+64 || !/^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/u.test(dataUrl))return null;
    checkStop();
    const encodedBounds=boundsOf(manager);
    if(!current() || !encodedBounds || Object.keys(bounds).some(key=>bounds[key]!==encodedBounds[key]))return null;
    return {blockId:id,mime:'image/png',width:w,height:h,alt:'白板静态图',dataUrl,source:'native-isolated'};
  } catch(error) {if(error?.name==='AbortError')throw error;return null;}
  finally {
    finished=true;clearTimeout(timer);clearInterval(interval);release(wrapper);
    if(owned){try{canvas.width=0;canvas.height=0;}catch{}}
  }
}
