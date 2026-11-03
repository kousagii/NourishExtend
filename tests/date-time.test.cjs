const {test}=require('node:test');
const assert=require('node:assert/strict');
const {deadlineISO,phtParts}=require('../src/date-time.cjs');
test('Philippines calendar values keep their timezone and reject impossible dates',()=>{
 assert.equal(deadlineISO('2026-11-03 18:30'),'2026-11-03T10:30:00.000Z');
 assert.equal(deadlineISO('2026-02-30 18:30'),null);
 assert.equal(deadlineISO('2026-11-03 24:10'),null);
 assert.equal(deadlineISO('2026-11-03'),null);
 assert.deepEqual(phtParts(new Date('2026-11-03T20:00:00Z')),{date:'2026-11-04',time:'04:00'});
});
