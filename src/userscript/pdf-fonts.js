import {gunzipSync} from 'fflate';

const Z85 = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ.-:+=^!/*?&<>()[]{}@%$#';

export function encodeZ85(bytes) {
  const encoded = new Uint8Array(Math.ceil(bytes.length / 4) * 5);
  for (let offset = 0; offset < bytes.length; offset += 4) {
    let value = 0;
    for (let index = 0; index < 4; index++) value = value * 256 + (bytes[offset + index] ?? 0);
    const target = offset / 4 * 5;
    for (let index = 4; index >= 0; index--) {
      encoded[target + index] = Z85.charCodeAt(value % 85);
      value = Math.floor(value / 85);
    }
  }
  return new TextDecoder().decode(encoded);
}

export function decodeZ85(encoded, size) {
  if (typeof encoded !== 'string' || !Number.isSafeInteger(size) || size < 0 || encoded.length !== Math.ceil(size / 4) * 5) throw invalid();
  const bytes = new Uint8Array(Math.ceil(size / 4) * 4);
  for (let offset = 0; offset < encoded.length; offset += 5) {
    let value = 0;
    for (let index = 0; index < 5; index++) {
      const digit = Z85.indexOf(encoded[offset + index]);
      if (digit < 0) throw invalid();
      value = value * 85 + digit;
    }
    if (value > 0xffffffff) throw invalid();
    const target = offset / 5 * 4;
    for (let index = 3; index >= 0; index--) {
      bytes[target + index] = value % 256;
      value = Math.floor(value / 256);
    }
  }
  return bytes.subarray(0, size);
}

function invalid() {
  return Object.assign(new Error('PDF 字体校验失败，请重新安装脚本。'), {code:'PDF_FONT_INVALID'});
}

export async function readEmbeddedFont({compressed, compressedSize, size, hash}) {
  let bytes;
  try {
    bytes = gunzipSync(decodeZ85(compressed, compressedSize));
  } catch { throw invalid(); }
  if (bytes.length !== size) throw invalid();
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
  const actual = Array.from(digest, byte => byte.toString(16).padStart(2, '0')).join('');
  if (actual !== hash) throw invalid();
  return bytes;
}
