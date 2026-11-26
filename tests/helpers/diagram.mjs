import {pngDataUrl} from './whiteboard.mjs';

export const svgNamespace = 'http://www.w3.org/2000/svg';
export const htmlNamespace = 'http://www.w3.org/1999/xhtml';

export function diagramElement(localName, attributes = {}, childNodes = [], namespaceURI = svgNamespace) {
  return {nodeType:1,localName,namespaceURI,childNodes,
    attributes:Object.entries(attributes).map(([name,value]) => ({name,localName:name,namespaceURI:null,value:String(value)})),
    getAttribute:name => attributes[name] ?? null};
}

function serialize(node) {
  if (node.nodeType === 3) return node.data.replaceAll('&','&amp;').replaceAll('<','&lt;');
  const attributes=node.attributes.map(({name,value}) => ' '+name+'="'+value.replaceAll('&','&amp;').replaceAll('"','&quot;')+'"').join('');
  return '<'+node.localName+attributes+'>'+node.childNodes.map(serialize).join('')+'</'+node.localName+'>';
}

export function diagramFixture() {
  const attributes={'data-block-id':'diagram','data-block-type':'diagram','data-record-id':'diagram-record'};
  const pageAttributes={'data-record-id':'page-record'};
  const block={isConnected:true,getAttribute:name => attributes[name] ?? null};
  const page={getAttribute:name => pageAttributes[name] ?? null,contains:node => node === block};
  const calls=[],outputs=[],sources=[],operations=[];
  let decodeHook=() => Promise.resolve();
  const labels=diagramElement('foreignObject',{width:'80',height:'30'},[
    diagramElement('div',{xmlns:htmlNamespace,style:'display:flex;align-items:center;white-space:normal'},[
      diagramElement('strong',{},[{nodeType:3,data:'示例标签'}],htmlNamespace),
      diagramElement('br',{},[],htmlNamespace),{nodeType:3,data:'第二行'},
    ],htmlNamespace),
  ]);
  const source=diagramElement('svg',{xmlns:svgNamespace,width:'200px',height:'100px',viewBox:'-0.5 -0.5 200 100'},[
    diagramElement('path',{d:'M0 0 L100 50',stroke:'#000000'}),labels,
  ]);
  const view={getSvg(scale=1) {
    calls.push(scale);
    return scale===1 ? source : diagramElement('svg',{xmlns:svgNamespace,width:(200*scale)+'px',height:(100*scale)+'px',
      viewBox:'-0.5 -0.5 '+(200*scale)+' '+(100*scale)},source.childNodes);
  }};
  const model={id:'diagram',type:'diagram',record:{id:'diagram-record'},children:[],
    blockManager:{getBlockViewByBlockId:id => id===model.id ? view : null}};
  const root={id:'page',record:{id:'page-record'},children:[model]};
  const pageView={PageMain:{blockManager:{rootBlockModel:root}}};
  const images=[];
  const document={
    querySelector:selector => selector==='[data-block-type="page"]' ? page : selector==='[data-block-id="diagram"]' ? block : null,
    contains:node => node === page || node === block || node.isConnected === true,
    defaultView:{
      XMLSerializer:class {serializeToString(node) {return serialize(node);}},
      Image:class {
        constructor() {images.push(this);}
        set src(value) {this.source=value;if(value)sources.push(value);}
        get src() {return this.source;}
        removeAttribute(name) {if(name==='src')this.source='';}
        decode() {return decodeHook(this);}
      },
    },
    createElement(tag) {
      if(tag!=='canvas') throw new Error('unexpected element');
      const canvas={width:0,height:0,isConnected:false,toDataURL:() => pngDataUrl,getContext:() => context};
      const context={fillStyle:'',fillRect:(...args) => operations.push({name:'fill',args,color:context.fillStyle}),
        drawImage:(...args) => operations.push({name:'draw',args})};
      outputs.push(canvas);return canvas;
    },
  };
  return {attributes,pageAttributes,block,page,calls,outputs,sources,operations,source,labels,view,model,root,pageView,document,images,
    options:{pageView,checkStop(){}},setDecodeHook:hook => {decodeHook=hook;}};
}
