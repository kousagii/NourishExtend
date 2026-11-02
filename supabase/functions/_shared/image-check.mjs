export const MAX_BYTES = 3 * 1024 * 1024;
export function inspectImage(bytes) {
  if (!(bytes instanceof Uint8Array) || bytes.length < 24 || bytes.length > MAX_BYTES) throw new Error('Choose a JPEG or PNG photo under 3 MB.');
  let width, height, type;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if ([137,80,78,71,13,10,26,10].every((v,i) => bytes[i] === v) && String.fromCharCode(...bytes.slice(12,16)) === 'IHDR') {
    type = 'png'; width = view.getUint32(16); height = view.getUint32(20);
  } else if (bytes[0] === 255 && bytes[1] === 216) {
    type = 'jpeg'; let i = 2;
    while (i + 8 < bytes.length) {
      if (bytes[i++] !== 255) throw new Error('Invalid JPEG.');
      while (bytes[i] === 255) i++;
      const marker = bytes[i++];
      if (marker === 217 || marker === 218) break;
      if (marker === 1 || (marker >= 208 && marker <= 215)) continue;
      const length = view.getUint16(i);
      if (length < 2 || i + length > bytes.length) throw new Error('Invalid JPEG.');
      if ([192,193,194].includes(marker)) { height = view.getUint16(i+3); width = view.getUint16(i+5); break; }
      i += length;
    }
  }
  if (!width || !height || width > 4096 || height > 4096 || width * height > 12000000) throw new Error('Choose a JPEG or PNG photo up to 4096 pixels and 12 megapixels.');
  return { width, height, type };
}
