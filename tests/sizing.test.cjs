const {test}=require('node:test');const assert=require('node:assert/strict');const {validSize,sizeScale,textSize,SIZE_OPTIONS}=require('../src/sizing.cjs');
test('size preferences have a compact default and exactly the requested five steps',()=>{
 assert.deepEqual(SIZE_OPTIONS,[80,90,100,110,120]);assert.equal(validSize(null),100);assert.equal(validSize('110'),110);assert.equal(validSize(105),100);assert.equal(sizeScale(100),0.8);assert.equal(textSize(16,80),12);
});
