import {defaultTreeAdapter,parseFragment} from 'parse5';

const SVG='http://www.w3.org/2000/svg',XHTML='http://www.w3.org/1999/xhtml';
const XML='http://www.w3.org/XML/1998/namespace',XMLNS='http://www.w3.org/2000/xmlns/';
const XLINK='http://www.w3.org/1999/xlink';
const MAX_BYTES=2*1024*1024,MAX_NODES=20_000,MAX_DEPTH=96,MAX_EXPANDED=60_000;
const svgTags=new Set(('svg g defs symbol path rect circle ellipse line polyline polygon text tspan title desc '+
  'clipPath mask linearGradient radialGradient stop marker use foreignObject').split(' '));
const htmlTags=new Set(('div span strong b br i em p u s del sub sup small code pre blockquote ul ol li '+
  'table caption thead tbody tfoot tr td th colgroup col h1 h2 h3 h4 h5 h6').split(' '));
const svgAttributes=new Set(('id class x y x1 y1 x2 y2 cx cy r rx ry width height d points pathLength transform '+
  'viewBox preserveAspectRatio fill fill-opacity fill-rule stroke stroke-width stroke-opacity stroke-linecap '+
  'stroke-linejoin stroke-miterlimit stroke-dasharray stroke-dashoffset opacity paint-order vector-effect '+
  'font-family font-size font-weight font-style font-variant letter-spacing word-spacing text-anchor '+
  'dominant-baseline alignment-baseline baseline-shift dx dy textLength lengthAdjust clip-path clip-rule '+
  'clipPathUnits mask maskUnits maskContentUnits gradientUnits gradientTransform spreadMethod offset stop-color '+
  'stop-opacity marker-start marker-mid marker-end markerWidth markerHeight refX refY orient markerUnits '+
  'overflow display visibility direction unicode-bidi style href aria-label role xml:space xml:lang').split(' '));
const htmlAttributes=new Set(('id class style title dir lang width height colspan rowspan aria-label role xml:space xml:lang').split(' '));
const cssProperties=new Set(('display overflow overflow-x overflow-y text-align vertical-align align-items align-content '+
  'align-self justify-content flex flex-direction flex-wrap flex-grow flex-shrink flex-basis gap row-gap column-gap '+
  'width height min-width min-height max-width max-height margin margin-top margin-right margin-bottom margin-left '+
  'padding padding-top padding-right padding-bottom padding-left box-sizing font font-family font-size font-weight '+
  'font-style font-variant font-stretch color background background-color line-height letter-spacing word-spacing '+
  'white-space white-space-collapse text-wrap text-wrap-mode text-wrap-style word-break word-wrap overflow-wrap '+
  'text-decoration text-decoration-line text-decoration-color text-decoration-style text-indent text-transform '+
  'border border-width border-style border-color border-radius border-collapse border-spacing pointer-events '+
  'opacity fill fill-opacity fill-rule stroke stroke-width stroke-opacity stroke-linecap stroke-linejoin '+
  'stroke-dasharray stroke-dashoffset clip-path clip-rule mask transform transform-origin visibility').split(' '));
const functions=new Set(['rgb','rgba','hsl','hsla','matrix','translate','translatex','translatey','scale','scalex','scaley','rotate','skewx','skewy']);
const numericAttributes=new Set(('x y x1 y1 x2 y2 cx cy r rx ry width height d points pathLength transform viewBox '+
  'dx dy textLength gradientTransform offset markerWidth markerHeight refX refY').split(' '));
const textAttributes=new Set(['class','title','dir','lang','role','aria-label','xml:space','xml:lang']);

function invalid() { throw new Error('Unsupported SVG'); }
function xml(value) {
  return value.replace(/[&<>"\r]/gu,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\r':'&#13;'}[char]));
}
function finiteNumbers(value) {
  return [...value.replace(/#[0-9a-f]{3,8}\b/giu,'').matchAll(/[-+]?(?:\d*\.\d+|\d+\.?\d*)(?:e[-+]?\d+)?/giu)]
    .every(match=>Number.isFinite(Number(match[0])) && Math.abs(Number(match[0]))<=1_000_000);
}
function safeValue(value,refs) {
  if(value.length>65_536 || /[\\\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]|\/\*|\*\/|@|(?:javascript|vbscript)\s*:/iu.test(value)) invalid();
  const normalized=value.replace(/url\(\s*(['"]?)(#[A-Za-z0-9_.:-]{1,160})\1\s*\)/giu,(_,quote,id)=>{
    refs.push(id.slice(1));return 'url('+id+')';
  });
  const functionsOnly=normalized.replace(/url\(#[A-Za-z0-9_.:-]{1,160}\)/gu,'');
  for(const match of functionsOnly.matchAll(/([-a-z][\w-]*)\s*\(/giu)) if(!functions.has(match[1].toLowerCase())) invalid();
  return normalized;
}
function safeStyle(value,refs) {
  if(value.length>8192) invalid();
  const declarations=[];
  for(const part of value.split(';')) {
    if(!part.trim()) continue;
    const separator=part.indexOf(':');
    if(separator<1) invalid();
    const property=part.slice(0,separator).trim().toLowerCase();
    if(!cssProperties.has(property)) invalid();
    const content=safeValue(part.slice(separator+1).trim(),refs);
    if(!content || !finiteNumbers(content)) invalid();
    declarations.push(property+':'+content);
  }
  return declarations.join(';');
}
function parsed(source) {
  let nodes=0,depth=0;
  const count=()=>{if(++nodes>MAX_NODES)invalid();};
  const adapter={...defaultTreeAdapter};
  for(const method of ['createElement','createCommentNode','createDocumentFragment']) {
    adapter[method]=(...args)=>{count();return defaultTreeAdapter[method](...args);};
  }
  adapter.insertText=(parent,text)=>{
    if(parent.childNodes.at(-1)?.nodeName!=='#text') count();
    defaultTreeAdapter.insertText(parent,text);
  };
  adapter.onItemPush=()=>{if(++depth>MAX_DEPTH)invalid();};
  adapter.onItemPop=()=>{depth--;};
  return parseFragment(source,{scriptingEnabled:false,treeAdapter:adapter});
}

// Rebuild as XML, rather than returning input markup interpreted by an HTML
// parser. The result is safe both as an image and as a standalone SVG file.
export function sanitizeSvg(source) {
  try {
    if(typeof source!=='string' || source.length>MAX_BYTES || new TextEncoder().encode(source).length>MAX_BYTES ||
      /<!doctype|<!entity|<\?|[\u0000-\u0008\u000b\u000c\u000e-\u001f]/iu.test(source)) return null;
    const fragment=parsed(source);
    const roots=fragment.childNodes.filter(node=>node.nodeName!=='#comment' && !(node.nodeName==='#text'&&!node.value.trim()));
    if(roots.length!==1 || roots[0].tagName!=='svg' || roots[0].namespaceURI!==SVG) return null;
    const root=roots[0],ids=new Map(),references=new Map(),children=new Map();
    const attributes=new Map((root.attrs||[]).map(item=>[item.name,item.value]));
    const size=name=>{
      const value=attributes.get(name);
      return typeof value==='string' && /^\d+(?:\.\d+)?(?:px)?$/u.test(value) ? Number.parseFloat(value) : NaN;
    };
    let width=size('width'),height=size('height');
    const viewBox=attributes.get('viewBox')?.trim().split(/[\s,]+/u).map(Number);
    const box=viewBox || [0,0,width,height];
    if(!attributes.has('width') && viewBox) width=box[2];
    if(!attributes.has('height') && viewBox) height=box[3];
    if(!Number.isFinite(width*height) || width<1 || height<1 || width>100_000 || height>100_000 ||
      box.length!==4 || !box.every(value=>Number.isFinite(value)&&Math.abs(value)<=1_000_000) || box[2]<=0 || box[3]<=0) return null;
    let count=0;
    function serialize(node,html=false,depth=0) {
      if(++count>MAX_NODES || depth>MAX_DEPTH) invalid();
      if(node.nodeName==='#comment') return '';
      if(node.nodeName==='#text') return xml(node.value);
      if(node.namespaceURI!==(html?XHTML:SVG) || !(html?htmlTags:svgTags).has(node.tagName)) invalid();
      const refs=[],attrs=[];references.set(node,refs);
      for(const attribute of node.attrs||[]) {
        let name=attribute.prefix ? attribute.prefix+':'+attribute.name : attribute.name;
        const value=attribute.value;
        if(name==='xmlns' || name.startsWith('xmlns:')) {
          if(name==='xmlns' && value!==(html?XHTML:SVG) || name==='xmlns:xlink' && value!==XLINK ||
            !['xmlns','xmlns:xlink'].includes(name) || attribute.namespace && attribute.namespace!==XMLNS) invalid();
          continue;
        }
        if(attribute.namespace && ![XML,XLINK].includes(attribute.namespace)) invalid();
        if(name==='xlink:href') name='href';
        if(!(html?htmlAttributes:svgAttributes).has(name)) invalid();
        let content;
        if(name==='href') {
          if(!/^#[A-Za-z0-9_.:-]{1,160}$/u.test(value)) invalid();
          refs.push(value.slice(1));content=value;
        } else if(textAttributes.has(name)) content=value;
        else if(name==='style') content=safeStyle(value,refs);
        else content=safeValue(value,refs);
        if(name==='id') {
          if(!/^[A-Za-z0-9_.:-]{1,160}$/u.test(content) || ids.has(content)) invalid();
          ids.set(content,node);
        }
        if(numericAttributes.has(name) && !finiteNumbers(content)) invalid();
        if(node===root && ['width','height','viewBox'].includes(name)) continue;
        attrs.push(name+'="'+xml(content)+'"');
      }
      if(node===root) attrs.unshift('xmlns="'+SVG+'"','width="'+width+'"','height="'+height+'"','viewBox="'+box.join(' ')+'"');
      else if(html && node.parentNode?.namespaceURI===SVG) attrs.unshift('xmlns="'+XHTML+'"');
      const descendants=(node.childNodes||[]).filter(child=>child.nodeName!=='#comment');children.set(node,descendants);
      const content=descendants.map(child=>serialize(child,html||node.tagName==='foreignObject',depth+1)).join('');
      if(html && ['br','col'].includes(node.tagName)) return '<'+node.tagName+(attrs.length?' '+attrs.join(' '):'')+'/>';
      return '<'+node.tagName+(attrs.length?' '+attrs.join(' '):'')+'>'+content+'</'+node.tagName+'>';
    }
    const normalized=serialize(root);
    // Count the expanded reference graph, including presentation references.
    // Reject cycles and exponential use trees before handing it to a renderer.
    const states=new Map(),costs=new Map();
    function cost(node,depth=0) {
      if(depth>MAX_DEPTH || states.get(node)===1) invalid();
      if(costs.has(node)) {
        const previous=costs.get(node);
        if(depth+previous.depth>MAX_DEPTH) invalid();
        return previous;
      }
      states.set(node,1);let nodes=1,maxDepth=0;
      const linked=(references.get(node)||[]).map(id=>{if(!ids.has(id))invalid();return ids.get(id);});
      for(const child of [...(children.get(node)||[]),...linked]) {
        const result=cost(child,depth+1);nodes+=result.nodes;maxDepth=Math.max(maxDepth,result.depth+1);
        if(nodes>MAX_EXPANDED) invalid();
      }
      const result={nodes,depth:maxDepth};states.set(node,2);costs.set(node,result);return result;
    }
    cost(root);
    if(new TextEncoder().encode(normalized).length>MAX_BYTES) return null;
    return {source:normalized,width,height};
  } catch { return null; }
}
