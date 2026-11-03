const {test}=require('node:test');const assert=require('node:assert/strict');
const {inquiryMember,pickupMember,conversationList,chatDay}=require('../src/conversations.cjs');
test('both sides of a conversation see the other member; blocked profiles stay unavailable',()=>{
 const donor={id:'donor',display_name:'SYNTHETIC Donor'},recipient={id:'recipient',display_name:'SYNTHETIC Recipient'};
 const inquiry={donor_id:'donor',inquirer_id:'recipient',donor,inquirer:recipient};
 const pickup={donations:{donor_id:'donor',donor},recipient};
 assert.equal(inquiryMember(inquiry,'donor'),recipient);assert.equal(inquiryMember(inquiry,'recipient'),donor);
 assert.equal(pickupMember(pickup,'donor'),recipient);assert.equal(pickupMember(pickup,'recipient'),donor);
 assert.equal(inquiryMember({...inquiry,donor:null},'recipient'),null);
});
test('newest messages sort across pickups and inquiries, independently of reservation creation time',()=>{
 const inquiries=[{id:'inquiry',donor_id:'donor',last_message_at:'2026-11-04T01:00:00Z',inquirer_read_at:'2026-11-04T01:00:00Z'}];
 const pickups=[{id:'pickup',created_at:'2026-10-20T00:00:00Z',donations:{donor_id:'donor'},last_message_at:'2026-11-04T02:00:00Z',last_sender_id:'donor',recipient_read_at:'2026-11-04T00:00:00Z'}];
 const result=conversationList({inquiries,pickups},'recipient');
 assert.deepEqual(result.map(r=>r.type),['pickup','inquiry']);assert.equal(result[0].unread,true);assert.equal(result[1].unread,false);
 assert.equal(conversationList({pickups:[{...pickups[0],last_sender_id:'recipient'}]},'recipient')[0].unread,false);
 assert.equal(pickups[0].created_at,'2026-10-20T00:00:00Z');
});
test('chat day separators use Philippines time around midnight',()=>{
 assert.equal(chatDay('2026-11-03T16:01:00Z'),chatDay('2026-11-04T01:00:00Z'));
 assert.notEqual(chatDay('2026-11-03T15:59:00Z'),chatDay('2026-11-03T16:01:00Z'));
});
