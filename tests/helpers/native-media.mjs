import {pngDataUrl} from './whiteboard.mjs';

export const pngBytes=new Uint8Array(Buffer.from(pngDataUrl.split(',')[1],'base64'));
export function mediaFixture(type='image') {
  const attributes={'data-block-id':'asset','data-block-type':type,'data-record-id':'asset-record'};
  const pageAttributes={'data-record-id':'page-record'};
  const image={isConnected:true,complete:true,naturalWidth:1,naturalHeight:1,currentSrc:'https://example.feishu.cn/preview.png',
    getAttribute:name=>name==='alt'?'示例图片':null,getBoundingClientRect:()=>({width:1,height:1})};
  const block={isConnected:true,getAttribute:name=>attributes[name]??null,querySelectorAll:tag=>tag==='img'?[image]:[]};
  image.closest=()=>block;image.parentElement=block;
  const page={getAttribute:name=>pageAttributes[name]??null,contains:node=>node===block};
  const calls=[],fetches=[],canvases=[];
  const model={id:'asset',type,record:{id:'asset-record'},snapshot:{
    image:{token:'image-token',name:'示例图片'},file:{token:'file-token',name:'示例.txt',mime_type:'text/plain'}},
    imageManager:{fetch(options,context,resolve) {calls.push({options,context});resolve({src:'https://example.feishu.cn/hd/image-token'});return Promise.resolve();}}};
  const root={id:'page',record:{id:'page-record'},children:[model]};
  const pageView={location:new URL('https://example.feishu.cn/wiki/wiki-token'),globalConfig:{drive_api:['drive.feishu.cn']},
    PageMain:{blockManager:{rootBlockModel:root}}};
  const document={querySelector:selector=>selector==='[data-block-type="page"]'?page:selector==='[data-block-id="asset"]'?block:null,
    defaultView:{getComputedStyle:()=>({display:'block',visibility:'visible',opacity:'1'}),location:pageView.location},
    createElement:tag=>{if(tag!=='canvas')throw new Error('unexpected element');
      const canvas={width:0,height:0,getContext:()=>({drawImage(){},putImageData(){}}),toDataURL:()=>pngDataUrl};canvases.push(canvas);return canvas;}};
  image.ownerDocument=document;block.ownerDocument=document;
  const response=(bytes=type==='image'?pngBytes:new TextEncoder().encode('附件原文'),{mime=type==='image'?'image/png':'text/plain',status=200,url}={})=>{
    const value=new Response(bytes,{status,headers:{'content-type':mime}});
    Object.defineProperty(value,'url',{value:url||'https://example.feishu.cn/hd/image-token'});return value;};
  const options={document,pageView,checkStop(){},wait:ms=>new Promise(resolve=>setTimeout(resolve,ms)),
    fetch:async(url,init)=>{fetches.push({url:String(url),init});return response(undefined,{url:String(url)});}};
  return {attributes,pageAttributes,image,block,page,model,root,pageView,document,calls,fetches,canvases,response,options};
}
