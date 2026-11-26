const SVG = 'http://www.w3.org/2000/svg', XHTML = 'http://www.w3.org/1999/xhtml';
const svgTags = new Set(['svg','g','defs','path','rect','circle','ellipse','line','polyline','polygon',
  'text','tspan','title','desc','clipPath','linearGradient','radialGradient','stop','foreignObject']);
const htmlTags = new Set(['div','span','strong','b','br','i','em','p']);

function findDiagram(root,id,recordId) {
  const pending=[root],seen=new Set();
  while(pending.length && seen.size<20_000) {
    const model=pending.pop();
    if(!model || typeof model!=='object' || seen.has(model)) continue;
    seen.add(model);
    if(String(model.id)===id && model.type==='diagram' && model.record?.id===recordId) return model;
    if(Array.isArray(model.children)) pending.push(...model.children);
    const children=model.innerBlockManager?.rootBlockModel?.children;
    if(Array.isArray(children)) pending.push(...children);
  }
  return null;
}

function dimensions(svg) {
  if(svg?.namespaceURI!==SVG || svg.localName!=='svg') return null;
  const size=name => {
    const value=svg.getAttribute(name);
    return typeof value==='string' && /^\d+(?:\.\d+)?(?:px)?$/u.test(value) ? Number.parseFloat(value) : NaN;
  };
  const width=size('width'),height=size('height');
  const box=svg.getAttribute('viewBox')?.trim().split(/[\s,]+/u).map(Number);
  if(!Number.isFinite(width*height) || width<1 || height<1 || !box || box.length!==4 ||
    !box.every(Number.isFinite) || box[2]<=0 || box[3]<=0) return null;
  return {width,height};
}

// SVG is a private rendering input, never inserted into the page or exported as
// active markup. Reject unsupported features instead of removing graph labels.
function staticSource(svg,serializer) {
  const pending=[{node:svg,html:false,depth:0}];let count=0;
  while(pending.length) {
    const {node,html,depth}=pending.pop();
    if(++count>20_000 || depth>128) return null;
    if(node.nodeType===3 || node.nodeType===4 || node.nodeType===8) continue;
    if(node.nodeType!==1 || node.namespaceURI!==(html?XHTML:SVG) ||
      !(html?htmlTags:svgTags).has(node.localName)) return null;
    for(const attribute of node.attributes) {
      const name=attribute.name.toLowerCase(),value=attribute.value;
      if(name==='xmlns' || name.startsWith('xmlns:')) {
        if(![SVG,XHTML,'http://www.w3.org/1999/xlink'].includes(value)) return null;
      } else if(attribute.namespaceURI && attribute.namespaceURI!=='http://www.w3.org/XML/1998/namespace') return null;
      if(name.startsWith('on') || /(?:^|:)(?:href|src)$/u.test(name) ||
        /[\\\u0000-\u001f]|(?:url|image(?:-set)?|cross-fade|element|paint)\s*\(|@import|expression\s*\(|javascript\s*:|(?:animation|transition|behavior|binding)\s*:/iu.test(value)) return null;
    }
    for(const child of node.childNodes) pending.push({node:child,html:html || node.localName==='foreignObject',depth:depth+1});
  }
  const source=serializer.serializeToString(svg);
  return typeof source==='string' && source.length<=2*1024*1024 ? source : null;
}

async function decode(image,checkStop) {
  let timer;
  try {
    const deadline=Date.now()+8000;
    await Promise.race([image.decode(),new Promise((resolve,reject) => {
      const tick=() => {
        try {
          checkStop();
          if(Date.now()>=deadline) throw new Error('流程图解码超时');
          timer=setTimeout(tick,100);
        } catch(error) {reject(error);}
      };
      timer=setTimeout(tick,100);
    })]);
  } finally {clearTimeout(timer);}
}

export async function captureDiagram(document,id,{pageView=typeof unsafeWindow==='undefined'?globalThis:unsafeWindow,checkStop=()=>{}}={}) {
  let canvas,image;
  try {
    checkStop();
    const key=String(id);
    if(!/^[\w-]{1,160}$/u.test(key)) return null;
    const page=document?.querySelector('[data-block-type="page"]');
    const block=document?.querySelector('[data-block-id="'+key+'"]');
    const pageId=page?.getAttribute('data-record-id'),recordId=block?.getAttribute('data-record-id');
    const root=pageView?.PageMain?.blockManager?.rootBlockModel;
    if(!pageId || !recordId || !root || root.record?.id!==pageId || block.isConnected===false ||
      block.getAttribute('data-block-type')!=='diagram' || !page.contains(block)) return null;
    const model=findDiagram(root,key,recordId);
    const view=model?.blockManager?.getBlockViewByBlockId?.(model.id);
    if(typeof view?.getSvg!=='function') return null;
    const belongsToPage=() => pageView?.PageMain?.blockManager?.rootBlockModel===root && root.record?.id===pageId &&
      document.querySelector('[data-block-type="page"]')===page && page.getAttribute('data-record-id')===pageId &&
      document.querySelector('[data-block-id="'+key+'"]')===block && block.isConnected!==false &&
      block.getAttribute('data-record-id')===recordId && page.contains(block) && findDiagram(root,key,recordId)===model &&
      model.blockManager?.getBlockViewByBlockId?.(model.id)===view;
    const browser=document.defaultView || globalThis,serializer=new browser.XMLSerializer();
    const base=view.getSvg(),size=dimensions(base),original=staticSource(base,serializer);
    if(!size || !original || !belongsToPage()) return null;
    const scale=Math.min(4,8192/size.width,8192/size.height,Math.sqrt(15_900_000/(size.width*size.height)));
    if(!Number.isFinite(scale) || scale<=0) return null;
    const svg=view.getSvg(scale),output=dimensions(svg),source=staticSource(svg,serializer);
    if(!output || !source) return null;
    const width=Math.ceil(output.width),height=Math.ceil(output.height);
    if(width>8192 || height>8192 || width*height>16_000_000) return null;
    checkStop();
    image=new browser.Image();
    // A data URI preserves foreignObject labels while keeping canvas readable.
    image.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(source);
    await decode(image,checkStop);
    checkStop();
    if(!belongsToPage() || staticSource(view.getSvg(),serializer)!==original) return null;
    canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
    const context=canvas.getContext('2d');
    if(!context) return null;
    context.fillStyle='#ffffff';context.fillRect(0,0,width,height);
    context.drawImage(image,0,0,width,height);
    checkStop();
    const dataUrl=canvas.toDataURL('image/png');
    if(typeof dataUrl!=='string' || dataUrl.length>32*1024*1024+64 ||
      !/^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/u.test(dataUrl) || !belongsToPage() ||
      staticSource(view.getSvg(),serializer)!==original) return null;
    return {blockId:id,mime:'image/png',width,height,alt:'流程图',dataUrl};
  } catch(error) {
    if(error?.name==='AbortError') throw error;
    return null;
  } finally {
    try {image?.removeAttribute('src');} catch {}
    if(canvas) {
      try {canvas.width=0;} catch {}
      try {canvas.height=0;} catch {}
    }
  }
}
