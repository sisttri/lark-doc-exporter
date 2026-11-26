const emojiCharacter = /[\p{Extended_Pictographic}\p{Regional_Indicator}\p{Emoji_Presentation}]/u;
const possibleFallback = /[\p{Extended_Pictographic}\p{Regional_Indicator}\p{Emoji_Presentation}\u20e3\u2610-\u2612]/u;
const checkbox = /^[\u2610-\u2612]/u;
const textSymbol = /^[©®™]/u;
const keycap = /^[#*0-9]\ufe0f?\u20e3$/u;
let segmenter;

// Font selection is local to PDF text runs. Keep the original grapheme and all
// selectors/joiners; a font change must not rewrite exported document text.
export function splitEmojiRuns(text) {
  if (!text) return [];
  if (!possibleFallback.test(text)) return [{text}];
  segmenter ??= new Intl.Segmenter(undefined, {granularity:'grapheme'});
  const runs = [];
  for (const {segment} of segmenter.segment(text)) {
    let font;
    if (checkbox.test(segment)) font = 'NotoSymbols';
    else if ((emojiCharacter.test(segment) || keycap.test(segment)) &&
      (!textSymbol.test(segment) || segment.includes('\ufe0f'))) font = 'NotoEmoji';
    const previous = runs.at(-1);
    if (previous && previous.font === font) previous.text += segment;
    else runs.push(font ? {text:segment,font} : {text:segment});
  }
  return runs;
}

export function validFontCoverage(ranges) {
  if (!Array.isArray(ranges) || !ranges.length || ranges.length>10000) return false;
  let previous=-1;
  for (const range of ranges) {
    if (!Array.isArray(range) || range.length!==2 || !Number.isSafeInteger(range[0]) || !Number.isSafeInteger(range[1]) ||
      range[0]<0 || range[0]<=previous || range[0]>range[1] || range[1]>0x10ffff) return false;
    previous=range[1];
  }
  return true;
}

function covered(codepoint,ranges) {
  let low=0,high=ranges.length-1;
  while (low<=high) {
    const middle=Math.floor((low+high)/2),[start,end]=ranges[middle];
    if (codepoint<start) high=middle-1;
    else if (codepoint>end) low=middle+1;
    else return true;
  }
  return false;
}

export function missingEmojiGlyphs(text,coverage) {
  const runs=splitEmojiRuns(text).filter(run => run.font);
  if (!runs.length) return [];
  const missing=new Set();
  for (const {text,font} of runs) {
    const ranges=coverage?.[font];
    if (!validFontCoverage(ranges)) throw Object.assign(new Error('PDF 字体覆盖范围无效。'),{code:'PDF_FONT_INVALID'});
    for (const {segment} of segmenter.segment(text)) {
      if ([...segment].some(character => !/\p{Default_Ignorable_Code_Point}/u.test(character) &&
        !covered(character.codePointAt(0),ranges))) missing.add(segment);
    }
  }
  return [...missing];
}
