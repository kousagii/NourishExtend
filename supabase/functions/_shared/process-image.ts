import { Image } from 'https://deno.land/x/imagescript@1.3.0/mod.ts';
import { inspectImage } from './image-check.mjs';
export async function processImage(bytes: Uint8Array): Promise<Uint8Array> {
  const dimensions = inspectImage(bytes);
  const image = await Image.decode(bytes);
  if (image.width !== dimensions.width || image.height !== dimensions.height) throw new Error('Invalid image dimensions.');
  const scale = Math.min(1,1200/image.width,1200/image.height);
  if (scale < 1) image.resize(Math.max(1,Math.round(image.width*scale)),Math.max(1,Math.round(image.height*scale)));
  const clean = await image.encode();
  if (clean.length > 5242880) throw new Error('Photo is too large after processing.');
  return clean;
}
