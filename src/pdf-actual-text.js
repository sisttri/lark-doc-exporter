const needsActualText = /[\p{Extended_Pictographic}\p{Regional_Indicator}\p{Emoji_Presentation}\u20e3\u2610-\u2612\ufe0e\ufe0f\u200d]/u;

function textNeedsReplacement(value) {
  if (typeof value === 'string') return needsActualText.test(value);
  if (Array.isArray(value)) return value.some(textNeedsReplacement);
  return !!value && textNeedsReplacement(value.text);
}

function firstReplacementNode(value) {
  if (Array.isArray(value)) {
    for (const child of value) {
      const found = firstReplacementNode(child);
      if (found) return found;
    }
  } else if (value && typeof value === 'object') {
    if (textNeedsReplacement(value.text)) return value;
    for (const children of [value.content,value.stack,value.columns,value.ul,value.ol,value.table?.body]) {
      const found = firstReplacementNode(children);
      if (found) return found;
    }
  }
}

function unavailable() {
  return Object.assign(new Error('PDF 文本保真接口不可用，请重新安装脚本。'), {code:'PDF_RESOURCE_INVALID'});
}

function replacementHex(text) {
  let hex = 'feff';
  for (let index = 0; index < text.length; index++) hex += text.charCodeAt(index).toString(16).padStart(4,'0');
  return hex;
}

function restoreMethod(object, key, descriptor) {
  if (descriptor) Object.defineProperty(object,key,descriptor);
  else delete object[key];
}

// pdfmake 0.3.15 consumes _inlines during layout and resolves getStream only after
// rendering. Capture its current PDFKit instance at measurement; never patch a
// prototype. The pinned engine regression checks both extraction and pixels.
export function preparePdfActualText(doc) {
  const node = firstReplacementNode(doc.content);
  if (!node) { return () => {}; }
  // ActualText on a Span marked-content sequence was introduced in PDF 1.5.
  if (!doc.version || parseFloat(doc.version) < 1.5) doc.version = '1.5';
  let document, fragmentDescriptor;
  Object.defineProperty(node,'_inlines',{
    configurable:true,
    set(inlines) {
      Object.defineProperty(this,'_inlines',{value:inlines,writable:true,enumerable:true,configurable:true});
      const measuredDocument = inlines.find(inline => inline.font?.document)?.font.document;
      if (!measuredDocument || typeof measuredDocument._fragment !== 'function' || typeof measuredDocument.addContent !== 'function') throw unavailable();
      document = measuredDocument;
      fragmentDescriptor = Object.getOwnPropertyDescriptor(document,'_fragment');
      const fragment = document._fragment;
      document._fragment = function(text,...args) {
        if (typeof text !== 'string' || !needsActualText.test(text)) return fragment.call(this,text,...args);
        const addContent = this.addContent;
        const contentDescriptor = Object.getOwnPropertyDescriptor(this,'addContent');
        let marked = false, replaced = false;
        this.addContent = function(content) {
          const result = addContent.call(this,content);
          // Keep BDC/EMC inside _fragment's coordinate transform. Wrapping text()
          // crosses its save/restore and gives extractors incorrect text bounds.
          if (content === 'BT') {
            if (replaced) throw unavailable();
            addContent.call(this,'/Span << /ActualText <' + replacementHex(text) + '> >> BDC');
            marked = true; replaced = true;
          } else if (content === 'ET' && marked) {
            marked = false;
            addContent.call(this,'EMC');
          }
          return result;
        };
        try {
          const result = fragment.call(this,text,...args);
          if (!replaced || marked) throw unavailable();
          return result;
        }
        finally {
          restoreMethod(this,'addContent',contentDescriptor);
          if (marked) addContent.call(this,'EMC');
        }
      };
    },
  });
  return completed => {
    if (document) restoreMethod(document,'_fragment',fragmentDescriptor);
    else if (completed) throw unavailable();
  };
}
