const {test}=require('node:test');
const assert=require('node:assert/strict');
test('image validation rejects unknown formats, excessive dimensions and oversized bodies',async()=>{
  const {inspectImage,MAX_BYTES}=await import('../supabase/functions/_shared/image-check.mjs');
  assert.throws(()=>inspectImage(new Uint8Array(50)));
  assert.throws(()=>inspectImage(new Uint8Array(MAX_BYTES+1)));
  const bytes=Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jhXQAAAAASUVORK5CYII=','base64'));
  assert.deepEqual(inspectImage(bytes),{width:1,height:1,type:'png'});
  new DataView(bytes.buffer).setUint32(16,99999);
  assert.throws(()=>inspectImage(bytes),/4096/);
});
