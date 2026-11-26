const MAX_BLOCKS=20_000, MAX_TEXT=4*1024*1024;
const key=value => typeof value==='string' || Number.isSafeInteger(value) ? String(value) : '';
// Runtime block IDs are used in quoted DOM selectors and synthesized block shells.
const blockKey=value => {const id=key(value);return /^[\w-]{1,160}$/u.test(id)?id:'';};
const pageWindow=() => typeof unsafeWindow==='undefined' ? globalThis : unsafeWindow;

function pageContext(document,pageView) {
  const page=document?.querySelector('[data-block-type="page"]');
  const root=pageView?.PageMain?.blockManager?.rootBlockModel;
  const recordId=page?.getAttribute('data-record-id');
  return page && page.isConnected!==false && recordId && root?.record?.id===recordId ? {page,root,recordId} : null;
}

function findModel(root,id,recordId,type) {
  const pending=[root],seen=new Set();
  while(pending.length && seen.size<MAX_BLOCKS) {
    const model=pending.pop();
    if(!model || typeof model!=='object' || seen.has(model)) continue;
    seen.add(model);
    if(blockKey(model.id)===id && model.record?.id===recordId && model.type===type) return model;
    for(const children of [model.children,model.innerBlockManager?.rootBlockModel?.children]) {
      if(!Array.isArray(children)) continue;
      if(children.length>MAX_BLOCKS || pending.length+children.length>MAX_BLOCKS) return null;
      for(let index=children.length-1;index>=0;index--) pending.push(children[index]);
    }
  }
  return null;
}

// Optional local capability shared by native asset readers. No remote requests or registry.
export function readBlockContext(document,id,{pageView=pageWindow(),type}={}) {
  try {
    const blockId=blockKey(id);
    if(!blockId) return null;
    const context=pageContext(document,pageView),element=document?.querySelector('[data-block-id="'+blockId+'"]');
    const recordId=element?.getAttribute('data-record-id'),blockType=element?.getAttribute('data-block-type');
    if(!context || !recordId || !blockType || type && blockType!==type || element.isConnected===false || !context.page.contains(element)) return null;
    const {root,page}=context,model=findModel(root,blockId,recordId,blockType);
    if(!model) return null;
    const getView=() => typeof model.blockManager?.getBlockViewByBlockId==='function'
      ? model.blockManager.getBlockViewByBlockId(model.id) || null : null;
    const view=getView();
    const current=() => {
      try {
        const next=pageContext(document,pageView);
        return Boolean(next?.root===root && next.page===page && next.recordId===context.recordId && document.querySelector('[data-block-id="'+blockId+'"]')===element &&
          element.isConnected!==false && element.getAttribute('data-record-id')===recordId &&
          element.getAttribute('data-block-type')===blockType && page.contains(element) &&
          findModel(root,blockId,recordId,blockType)===model && getView()===view);
      } catch {return false;}
    };
    return current() ? {model,view,root,page,element,current} : null;
  } catch {return null;}
}

export function readPageModel({document=globalThis.document,pageView=pageWindow()}={}) {
  try {
    const context=pageContext(document,pageView);
    if(!context) return null;
    const {root,page,recordId}=context,rootId=blockKey(root.id);
    if(!rootId) return null;
    const blocks=[],warnings=[],seen=new Set(),ids=new Set();
    let textSize=0,limited=false;
    const warn=(code,label) => warnings.push({code,label});
    const text=value => {
      if(typeof value!=='string') return '';
      textSize+=value.length;
      if(textSize>MAX_TEXT) {limited=true;return '';}
      return value;
    };
    const caption=(value,id) => {
      const chunks=value?.text?.initialAttributedTexts?.text;
      if(chunks==null) return '';
      if(Array.isArray(chunks) && chunks.length>MAX_BLOCKS) {limited=true;return '';}
      if(!Array.isArray(chunks) || !chunks.every(chunk=>typeof chunk==='string')) {
        warn('unsupported_block','块 '+id+' 的图注结构未识别，未将未知数据拼入正文。');return '';
      }
      let output='';
      for(const chunk of chunks) {
        output+=text(chunk);
        if(limited) return '';
      }
      return output;
    };
    const childrenOf=model => Array.isArray(model.innerBlockManager?.rootBlockModel?.children)
      ? model.innerBlockManager.rootBlockModel.children : Array.isArray(model.children) ? model.children : [];
    const rootChildren=childrenOf(root);
    const roots=rootChildren.slice(0,MAX_BLOCKS).map(model=>blockKey(model?.id)).filter(Boolean);
    const pending=[];
    for(let index=Math.min(rootChildren.length,MAX_BLOCKS)-1;index>=0;index--) pending.push({model:rootChildren[index],parentId:rootId});
    if(rootChildren.length>MAX_BLOCKS) limited=true;
    while(pending.length && blocks.length<MAX_BLOCKS && !limited) {
      const {model,parentId}=pending.pop();
      if(!model || typeof model!=='object' || seen.has(model)) {
        warn('missing_block','正文模型包含重复或循环节点，未确认完整结构。');continue;
      }
      seen.add(model);
      const id=blockKey(model.id),type=typeof model.type==='string' ? model.type : '';
      if(!id || !type || ids.has(id)) {warn('missing_block','正文模型包含无法区分的块，未确认完整结构。');continue;}
      ids.add(id);
      const snapshot=model.snapshot || {},children=childrenOf(model);
      if(children.length>MAX_BLOCKS) {limited=true;break;}
      const ready=snapshot.type!=='pending' && !(type==='synced_reference' && model.isAllDataReady!==true) &&
        !(type==='fallback' && snapshot.type==='whiteboard');
      const block={id,recordId:key(model.record?.id),parentId,type,children:children.map(child=>blockKey(child?.id)).filter(Boolean),ready};
      if(!ready) warn('missing_block','正文模型块 '+id+' 尚未加载完整。');
      if(typeof model.zoneState?.allText==='string') block.text=text(model.zoneState.allText);
      const ops=model.zoneState?.content?.ops;
      if(Array.isArray(ops)) {
        block.ops=[];
        if(ops.length>100_000) {limited=true;break;}
        for(const op of ops) {
          if(limited) break;
          const attrs=op?.attributes || {},attributes={};
          for(const name of ['bold','italic','underline','strikethrough','inlineCode','fixEnter']) {
            if(['boolean','number','string'].includes(typeof attrs[name])) attributes[name]=attrs[name];
          }
          for(const name of ['link','equation']) if(typeof attrs[name]==='string') attributes[name]=text(attrs[name]);
          if(attrs['inline-component']!==undefined) {
            attributes.unresolvedInline=true;
            try {
              if(typeof attrs['inline-component']!=='string' || attrs['inline-component'].length>=64*1024) throw new Error('shape');
              const component=JSON.parse(attrs['inline-component']);
              if(component?.type==='mention_doc') {
                if(component.data && (typeof component.data.title==='string' && component.data.title ||
                  typeof component.data.raw_url==='string' && component.data.raw_url)) {
                  attributes.mention={title:text(component.data.title),url:text(component.data.raw_url)};
                  delete attributes.unresolvedInline;
                } else warn('unsupported_block','块 '+id+' 的文档引用元数据无法解析。');
              }
            } catch {warn('unsupported_block','块 '+id+' 的文档引用元数据无法解析。');}
          }
          if(typeof op?.insert!=='string' && !attributes.equation && !attributes.mention) attributes.unresolvedInline=true;
          block.ops.push({insert:text(op?.insert),attributes});
        }
      }
      if(type==='image') block.caption=caption(snapshot.image?.caption,id);
      if(type==='whiteboard') block.caption=caption(snapshot.caption,id);
      if(type==='ordered' && ['string','number'].includes(typeof snapshot.seq)) block.seq=String(snapshot.seq);
      if(type==='todo' && typeof snapshot.done==='boolean') block.done=snapshot.done;
      if(type==='isv') {
        if(snapshot.block_type_id==='blk_631fefbbae02400430b8f9f4' && typeof snapshot.data?.data==='string') {
          block.source={language:'mermaid',text:text(snapshot.data.data)};
        } else if(snapshot.block_type_id==='blk_6358a421bca0001c22536e4c' && Array.isArray(snapshot.data?.items) &&
          snapshot.data.items.length<=MAX_BLOCKS && snapshot.data.items.every(item=>item &&
            ['time','title','text'].every(name=>item[name]===undefined || typeof item[name]==='string'))) {
          block.timeline=snapshot.data.items.map(item=>({time:text(item.time),title:text(item.title),text:text(item.text)}));
        } else warn('unsupported_block','插件块 '+id+' 的源码格式未识别。');
      }
      if(limited) block.ready=false;
      blocks.push(block);
      if(children.length>MAX_BLOCKS || pending.length+children.length>MAX_BLOCKS) {limited=true;break;}
      for(let index=children.length-1;index>=0;index--) pending.push({model:children[index],parentId:id});
    }
    if(pending.length || limited) warn('missing_block','正文模型超过读取限制，未确认完整结构。');
    const next=pageContext(document,pageView);
    if(next?.root!==root || next.page!==page || next.recordId!==recordId) return null;
    return {version:1,rootId,recordId,roots,blocks,warnings};
  } catch {return null;}
}
