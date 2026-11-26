export const pngDataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGN4oKDwHwAFJAIgPqioaAAAAABJRU5ErkJggg==';

export function whiteboardFixture({width = 64, height = 32, background = 'transparent', decoys = false,
  view = false, cssWidth = width, cssHeight = height, viewStyle} = {}) {
  const nodes = [], styleWrites = [];
  const document = {defaultView:{getComputedStyle:node => ({display:'block',visibility:'visible',opacity:'1',backgroundColor:'transparent',...node.style})}};
  function element(tagName, className, parentElement, attributes = {}) {
    const style = {};
    function readStyle(value) {
      for (const key of Object.keys(style)) delete style[key];
      for (const part of String(value || '').split(';')) {
        const colon = part.indexOf(':');
        if (colon < 0) continue;
        const key = part.slice(0,colon).trim().replace(/-([a-z])/gu,(_,letter) => letter.toUpperCase());
        style[key] = part.slice(colon+1).replace(/!important/gu,'').trim();
      }
    }
    readStyle(attributes.style);
    const node = {
      tagName:tagName.toUpperCase(), className, parentElement, ownerDocument:document,
      style, isConnected:true, hidden:false, textContent:'', children:[],
      getAttribute:name => attributes[name] ?? null,
      setAttribute(name,value) {
        attributes[name]=String(value);
        if (name === 'style') {readStyle(value);styleWrites.push({node,value:String(value)});}
      },
      removeAttribute(name) {
        delete attributes[name];
        if (name === 'style') {readStyle('');styleWrites.push({node,value:null});}
      },
      getBoundingClientRect:() => ({top:0,left:0,bottom:height,right:width,width,height}),
      matches(selector) {
        if (selector === '[data-block-type]') return Boolean(attributes['data-block-type']);
        const [tag,...classes] = selector.split('.');
        return (!tag || tag.toLowerCase() === tagName) && classes.every(name => className.split(' ').includes(name));
      },
      closest(selector) {
        for (let current=this; current; current=current.parentElement) if (current.matches?.(selector)) return current;
        return null;
      },
      contains(child) {
        for (let current=child; current; current=current.parentElement) if (current === this) return true;
        return false;
      },
      querySelectorAll(selector) {
        const parts = selector.split(' ');
        return nodes.filter(child => child !== this && this.contains(child) && child.matches(parts.at(-1)) &&
          (parts.length === 1 || child.parentElement?.closest(parts[0])));
      },
      querySelector(selector) { return this.querySelectorAll(selector)[0] || null; },
    };
    Object.defineProperty(style,'setProperty',{value(name,value,priority) {
      const key = name.replace(/-([a-z])/gu,(_,letter) => letter.toUpperCase());
      style[key]=String(value);
      attributes.style=Object.entries(style).map(([property,current]) => property + ':' + current).join(';');
      styleWrites.push({node,name,value,priority});
    }});
    parentElement?.children.push(node); nodes.push(node); return node;
  }
  const block = element('div','board-block',null,{'data-block-id':'board','data-block-type':'whiteboard'});
  const viewNode = view ? element('div','whiteboard-view-container is-block',block,
    viewStyle === undefined ? {} : {style:viewStyle}) : null;
  if (viewNode) viewNode.getBoundingClientRect = () => {
    const width=Number.parseFloat(viewNode.style.width) || cssWidth;
    const height=Number.parseFloat(viewNode.style.height) || cssHeight;
    return {top:0,left:0,bottom:height,right:width,width,height};
  };
  const app = element('div','whiteboad-x-app',viewNode || block);
  const stage = element('div','whiteboad-x-canvas-container',app);
  stage.style.backgroundColor = background;
  function layer(parent, kind) {
    const container = element('div','whiteboad-x-' + kind + '-canvas',parent);
    const normal = element('div','whiteboad-x-normal-container',container);
    const canvas = element('canvas','whiteboad-x-normal-canvas',normal);
    if (viewNode) canvas.getBoundingClientRect = viewNode.getBoundingClientRect;
    Object.assign(canvas,{width,height,alpha:255,reads:0,getContext:() => ({getImageData() {
      canvas.reads++; return {data:new Uint8ClampedArray([0,0,0,canvas.alpha])};
    }})}); return canvas;
  }
  const auxiliary = layer(stage,'auxiliary');
  const content = layer(stage,'content');
  const excluded = [auxiliary];
  if (decoys) {
    const hidden = layer(stage,'content'); hidden.parentElement.style.display = 'none'; excluded.push(hidden);
    const minimap = element('div','whiteboad-x-minimap',app);
    excluded.push(layer(element('div','whiteboad-x-canvas-container',minimap),'content'));
    const toolbar = element('div','board-tools',app,{role:'toolbar'});
    excluded.push(layer(element('div','whiteboad-x-canvas-container',toolbar),'content'));
  }
  block.outerHTML = '<div data-block-id="board" data-block-type="whiteboard"><div class="whiteboad-x-canvas-container"><div class="whiteboad-x-content-canvas"><canvas class="whiteboad-x-normal-canvas"></canvas></div></div></div>';
  const draws = [], fills = [], outputs = [], operations = [];
  document.querySelector = selector => selector === '[data-block-id="board"]' ? block : null;
  document.createElement = () => {
    const output = {width:0,height:0,getContext:() => context,toDataURL:() => pngDataUrl};
    const context = {
      fillStyle:'', fillRect:(...args) => {operations.push('fill');fills.push({color:context.fillStyle,args});},
      drawImage:(...args) => {operations.push('draw');draws.push(args);},
    };
    outputs.push(output); return output;
  };
  function redraw(density = width/cssWidth) {
    const box = viewNode.getBoundingClientRect();
    for (const canvas of block.querySelectorAll('canvas.whiteboad-x-normal-canvas')) {
      if (canvas.isConnected === false) continue;
      canvas.width=Math.round(box.width*density);canvas.height=Math.round(box.height*density);
    }
  }
  return {block,stage,content,auxiliary,excluded,document,draws,fills,outputs,operations,element,layer,
    view:viewNode,styleWrites,redraw};
}
