import { Image } from 'https://deno.land/x/imagescript@1.3.0/mod.ts';
import { processImage } from './process-image.ts';
import { inspectImage } from './image-check.mjs';
function assert(value: unknown,message: string){if(!value)throw new Error(message);}
Deno.test('actual server processor decodes, re-encodes and bounds a food photo',async()=>{
  const photo=new Image(1600,800);photo.fill(0xAA6633FF);
  const output=await processImage(await photo.encode());
  const info=inspectImage(output);
  assert(info.type==='png'&&info.width===1200&&info.height===600,'Image must be bounded and re-encoded to PNG.');
});
Deno.test('actual server processor rejects a corrupt file with a plausible PNG header',async()=>{
  const corrupt=new Uint8Array(40);corrupt.set([137,80,78,71,13,10,26,10]);corrupt.set([73,72,68,82],12);
  const view=new DataView(corrupt.buffer);view.setUint32(16,10);view.setUint32(20,10);
  let rejected=false;try{await processImage(corrupt);}catch{rejected=true;}
  assert(rejected,'A header alone must not be accepted as an image.');
});
Deno.test('actual server processor strips embedded text/location metadata',async()=>{
  const photo=new Image(4,4);photo.fill(0xAA6633FF);
  const original=await photo.encode();
  const payload=new TextEncoder().encode('GPSLatitude\0TEST_ONLY_LOCATION');
  const chunk=new Uint8Array(payload.length+12),view=new DataView(chunk.buffer);
  view.setUint32(0,payload.length);chunk.set([116,69,88,116],4);chunk.set(payload,8);
  let crc=0xffffffff;
  for(const byte of chunk.slice(4,-4)){crc^=byte;for(let i=0;i<8;i++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}
  view.setUint32(chunk.length-4,(crc^0xffffffff)>>>0);
  const tagged=new Uint8Array(original.length+chunk.length);
  tagged.set(original.slice(0,33));tagged.set(chunk,33);tagged.set(original.slice(33),33+chunk.length);
  assert(new TextDecoder().decode(tagged).includes('TEST_ONLY_LOCATION'),'Fixture must contain metadata.');
  const clean=await processImage(tagged);
  assert(!new TextDecoder().decode(clean).includes('TEST_ONLY_LOCATION'),'Location text must not survive processing.');
});
