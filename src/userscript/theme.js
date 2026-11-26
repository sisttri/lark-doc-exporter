// The saved document keeps its own styles; these tokens affect only the floating UI.
const palettes = {
  light:{surface:'#ffffff', text:'#23302b', muted:'#66756d', accent:'#28634b', warning:'#91600d'},
  dark:{surface:'#262c29', text:'#e4eae6', muted:'#b0bdb5', accent:'#abd6bb', warning:'#e6bd75'},
};

function color(value) {
  if (typeof value !== 'string') return null;
  const text = value.trim();
  const hex = /^#([\da-f]{3,8})$/iu.exec(text)?.[1];
  if (hex) {
    const expanded = hex.length <= 4 ? [...hex].map(part => part + part).join('') : hex;
    if (![6,8].includes(expanded.length)) return null;
    const rgb = [0,2,4].map(index => parseInt(expanded.slice(index, index + 2), 16));
    return {rgb, alpha:expanded.length === 8 ? parseInt(expanded.slice(6), 16) / 255 : 1};
  }
  const rgb = /^rgba?\(([^)]+)\)$/iu.exec(text);
  if (!rgb) return null;
  const parts = rgb[1].trim().split(/[\s,/]+/u);
  if (parts.length < 3 || parts.length > 4) return null;
  if (parts.some(part => !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?%?$/iu.test(part))) return null;
  const channels = parts.slice(0,3).map(part => parseFloat(part) * (part.endsWith('%') ? 2.55 : 1));
  const alpha = parts[3] === undefined ? 1 : parseFloat(parts[3]) / (parts[3].endsWith('%') ? 100 : 1);
  if (!channels.every(Number.isFinite) || !Number.isFinite(alpha)) return null;
  return {rgb:channels.map(channel => Math.min(255, Math.max(0, channel))), alpha:Math.min(1,Math.max(0,alpha))};
}

function opaque(value) {
  const parsed = color(value);
  return parsed?.alpha >= .95 ? parsed.rgb.map(Math.round) : null;
}
function hex(rgb) { return '#' + rgb.map(channel => Math.round(channel).toString(16).padStart(2,'0')).join(''); }
function luminance(rgb) {
  return rgb.map(channel => {
    const value = channel / 255;
    return value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4;
  }).reduce((sum, value, index) => sum + value * [.2126,.7152,.0722][index], 0);
}
function ratio(a, b) {
  const values = [luminance(a), luminance(b)].sort((x,y) => y - x);
  return (values[0] + .05) / (values[1] + .05);
}
export function contrastRatio(a, b) {
  const left = opaque(a), right = opaque(b);
  return left && right ? ratio(left, right) : 0;
}
function mix(a, b, amount) { return a.map((channel, index) => channel + (b[index] - channel) * amount); }
function readable(candidate, surface, minimum, additional = []) {
  const backgrounds = [surface, ...additional];
  const contrast = foreground => Math.min(...backgrounds.map(background => ratio(foreground, background)));
  if (contrast(candidate) >= minimum) return candidate;
  const target = contrast([0,0,0]) > contrast([255,255,255]) ? [0,0,0] : [255,255,255];
  for (let amount = .025; amount < 1; amount += .025) {
    const adjusted = mix(candidate, target, amount).map(Math.round);
    if (contrast(adjusted) >= minimum) return adjusted;
  }
  return target;
}
function buttonColors(candidate, surface) {
  const white = [255,255,255];
  for (let step = 0; step <= 40; step++) {
    const background = mix(candidate, [0,0,0], step / 40).map(Math.round);
    if (ratio(white, background) >= 4.5 && ratio(background, surface) >= 3) {
      return {background, text:'#ffffff'};
    }
  }
  const background = readable(candidate, surface, 3);
  const text = ratio([0,0,0], background) > ratio(white, background) ? '#000000' : '#ffffff';
  return {background, text};
}

export function deriveTheme(input = {}) {
  const supplied = opaque(input.surface);
  const mode = supplied ? luminance(supplied) < .35 ? 'dark' : 'light' : input.dark ? 'dark' : 'light';
  const defaults = palettes[mode];
  const surface = supplied || opaque(defaults.surface);
  const baseText = readable(opaque(input.text) || opaque(defaults.text), surface, 4.5);
  let softAmount = mode === 'dark' ? .075 : .045;
  let soft = mix(surface, baseText, softAmount).map(Math.round);
  // Mid-gray surfaces can sit on opposite sides of the black/white threshold.
  // Reduce the selection tint until the same foreground remains readable on both.
  while (ratio(baseText, soft) < 4.5) {
    softAmount /= 2;
    soft = mix(surface, baseText, softAmount).map(Math.round);
  }
  const text = readable(baseText, surface, 4.5, [soft]);
  const muted = readable(opaque(input.muted) || opaque(defaults.muted), surface, 4.5, [soft]);
  const pageAccent = opaque(input.accent) || opaque(defaults.accent);
  const accent = readable(pageAccent, surface, 4.5, [soft]);
  const accentText = ratio([0,0,0], accent) > ratio([255,255,255], accent) ? '#000000' : '#ffffff';
  const button = buttonColors(pageAccent, surface);
  const warning = readable(opaque(input.warning) || opaque(defaults.warning), surface, 4.5);
  return {
    mode, surface:hex(surface), text:hex(text), muted:hex(muted), accent:hex(accent),
    'accent-text':accentText, button:hex(button.background), 'button-text':button.text, warning:hex(warning),
    border:hex(mix(surface, text, mode === 'dark' ? .25 : .16)),
    soft:hex(soft),
    shadow:mode === 'dark' ? '0 8px 28px rgb(0 0 0 / .38)' : '0 8px 28px rgb(15 30 23 / .16)',
  };
}

export function installTheme(view, host) {
  const {document} = view;
  const media = view.matchMedia?.('(prefers-color-scheme: dark)');
  const resolved = new Map();
  let context;
  let previous = '';

  function resolve(value) {
    if (!value || typeof value !== 'string') return null;
    if (opaque(value)) return value;
    if (color(value)) return null;
    if (resolved.has(value)) return resolved.get(value);
    let result = null;
    // Canvas resolves named, HSL, OKLCH and color() values into the same sRGB space.
    // It is never attached to the page and is reused for subsequent theme refreshes.
    try {
      if (view.CSS?.supports?.('color', value)) {
        context ||= document.createElement('canvas').getContext('2d', {willReadFrequently:true});
        if (context) {
          context.clearRect(0,0,1,1); context.fillStyle = value; context.fillRect(0,0,1,1);
          const [r,g,b,a] = context.getImageData(0,0,1,1).data;
          if (a >= 242) result = hex([r,g,b]);
        }
      }
    } catch {}
    resolved.set(value, result);
    return result;
  }
  function refresh() {
    let input = {dark:Boolean(media?.matches)};
    if (typeof view.getComputedStyle === 'function') {
      const root = document.documentElement;
      const body = document.body;
      const content = document.querySelector?.('[data-block-type="page"], .page-block, .docx-root') || body || root;
      const styles = [content, body, root].filter(Boolean).map(node => view.getComputedStyle(node));
      const semantic = (...names) => {
        for (const name of names) {
          for (const style of styles) {
            const value = resolve(style.getPropertyValue?.(name)?.trim());
            if (value) return value;
          }
        }
        return null;
      };
      let pageBackground;
      for (let node = content; node; node = node.parentElement) {
        pageBackground = resolve(view.getComputedStyle(node).backgroundColor);
        if (pageBackground) break;
      }
      const surface = semantic('--bg-float', '--bg-dialog', '--bg-body', '--bg-base') || pageBackground;
      const bodyBackground = semantic('--bg-body', '--bg-base');
      // A custom skin may repaint the document without updating Feishu's tokens.
      // Preserve normal float/body elevation, but follow a repainted document.
      const mismatched = surface && pageBackground && (luminance(opaque(surface)) < .35) !== (luminance(opaque(pageBackground)) < .35);
      const repainted = bodyBackground && pageBackground && opaque(bodyBackground).some((channel, index) => Math.abs(channel - opaque(pageBackground)[index]) > 24);
      input = {
        ...input,
        surface:mismatched || repainted ? pageBackground : surface,
        text:semantic('--text-title', '--text-normal', '--text-body') || resolve(styles[0]?.color),
        muted:semantic('--text-caption', '--text-placeholder'),
        accent:semantic('--primary-pri-500', '--primary-pri-600', '--primary-color', '--color-primary'),
        warning:semantic('--function-warning-700', '--function-warning-600'),
      };
    }
    const theme = deriveTheme(input);
    const serialized = JSON.stringify(theme);
    if (previous === serialized) return;
    previous = serialized;
    host.setAttribute?.('data-theme', theme.mode);
    if (host.style) {
      host.style.colorScheme = theme.mode;
      for (const [key,value] of Object.entries(theme)) {
        if (key !== 'mode') host.style.setProperty?.('--fle-' + key, value);
      }
    }
  }
  media?.addEventListener?.('change', refresh);
  if (view.MutationObserver) {
    const observer = new view.MutationObserver(refresh);
    const options = {
      attributes:true, subtree:false,
      attributeFilter:['class','style','data-theme','data-color-mode','data-theme-mode','data-color-scheme'],
    };
    for (const node of [document.documentElement, document.body].filter(Boolean)) observer.observe(node, options);
  }
  refresh();
  return {refresh};
}
