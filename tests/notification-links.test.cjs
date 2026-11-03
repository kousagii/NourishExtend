const {test}=require('node:test');const assert=require('node:assert/strict');const {notificationDestination}=require('../src/notification-links.cjs');
test('notifications open the exact pickup, inquiry or community post',()=>{
 assert.deepEqual(notificationDestination({donation_id:'food',reservation_id:'claim'}),{screen:'Pickup',params:{id:'claim'}});
 assert.deepEqual(notificationDestination({kind:'confirm_collection',reservation_id:'claim'}),{screen:'Pickup',params:{id:'claim',showDetails:true}});
 assert.deepEqual(notificationDestination({donation_id:'food',inquiry_id:'thread'}),{screen:'Inquiry',params:{id:'thread'}});
 assert.deepEqual(notificationDestination({post_id:'post'}),{screen:'CommunityPost',params:{id:'post'}});
 assert.equal(notificationDestination({}),null);
});
