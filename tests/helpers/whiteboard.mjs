export const pngDataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGN4oKDwHwAFJAIgPqioaAAAAABJRU5ErkJggg==';

export function whiteboardFixture({width = 64, height = 32, background = 'transparent', decoys = false} = {}) {
  const nodes = [];
  const document = {defaultView:{getComputedStyle:node => ({display:'block',visibility:'visible',opacity:'1',backgroundColor:'transparent',...node.style})}};
  function element(tagName, className, parentElement, attributes = {}) {
    const node = {
      tagName:tagName.toUpperCase(), className, parentElement, ownerDocument:document,
      style:{}, isConnected:true, hidden:false, textContent:'', children:[],
      getAttribute:name => attributes[name] ?? null,
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
    parentElement?.children.push(node); nodes.push(node); return node;
  }
  const block = element('div','board-block',null,{'data-block-id':'board','data-block-type':'whiteboard'});
  const app = element('div','whiteboad-x-app',block);
  const stage = element('div','whiteboad-x-canvas-container',app);
  stage.style.backgroundColor = background;
  function layer(parent, kind) {
    const container = element('div','whiteboad-x-' + kind + '-canvas',parent);
    const normal = element('div','whiteboad-x-normal-container',container);
    const canvas = element('canvas','whiteboad-x-normal-canvas',normal);
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
  return {block,stage,content,auxiliary,excluded,document,draws,fills,outputs,operations,element,layer};
}
