import {Image} from 'https://deno.land/x/imagescript@1.3.0/mod.ts';
import {processImage} from './process-image.ts';
export async function processAvatar(bytes:Uint8Array):Promise<Uint8Array>{
 const image=await Image.decode(await processImage(bytes));
 const scale=Math.min(1,512/image.width,512/image.height);
 if(scale<1)image.resize(Math.max(1,Math.round(image.width*scale)),Math.max(1,Math.round(image.height*scale)));
 return image.encode();
}
