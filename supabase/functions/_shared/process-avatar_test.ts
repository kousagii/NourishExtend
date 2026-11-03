import {Image} from 'https://deno.land/x/imagescript@1.3.0/mod.ts';
import {processAvatar} from './process-avatar.ts';
import {inspectImage} from './image-check.mjs';
Deno.test('profile photos are decoded, re-encoded and bounded to 512 pixels',async()=>{
 const original=new Image(1600,800);original.fill(0xAA6633FF);
 const output=await processAvatar(await original.encode());const info=inspectImage(output);
 if(info.type!=='png'||info.width!==512||info.height!==256||output.length>1572864)throw new Error('Profile photo must fit its private bucket limits.');
 let rejected=false;try{await processAvatar(new Uint8Array([1,2,3]));}catch{rejected=true;}
 if(!rejected)throw new Error('Invalid photos must be rejected.');
});
