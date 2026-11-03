const {test,before,after} = require('node:test');
const assert = require('node:assert/strict');
const {PGlite} = require('@electric-sql/pglite');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
let db, directory;
const donor='10000000-0000-4000-8000-000000000001';
const recipient='10000000-0000-4000-8000-000000000002';
const stranger='10000000-0000-4000-8000-000000000003';
const unverified='10000000-0000-4000-8000-000000000004';
let donation, reservation;
async function asUser(user,sql,params=[]) {
  return db.transaction(async tx=>{
    await tx.exec('set local role authenticated');
    await tx.query("select set_config('request.jwt.claim.sub',$1,true)",[user]);
    return tx.query(sql,params);
  });
}
async function publish(extra={}) {
  const payload={title:'TEST ONLY — Rice',description:'Synthetic integration-test record',quantity:'2 sealed packs',category:'Pantry',allergens:'Unknown',storage_info:'Sealed, dry storage',area:'TEST AREA',photo_path:donor+'/test.png',pickup_deadline:new Date(Date.now()+86400000).toISOString(),instructions:'TEST PRIVATE PICKUP',...extra};
  const result=await asUser(donor,`select public.${extra.location_code?'publish_located_donation':'publish_donation'}($1::jsonb) id`,[JSON.stringify(payload)]);
  return result.rows[0].id;
}
before(async()=>{
  directory=await fs.mkdtemp(path.join(os.tmpdir(),'nourish-db-'));
  db=new PGlite(directory);
  // Minimal Supabase Auth/Storage schemas for the actual migration, not an app backend mock.
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create schema storage;
    create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,raw_user_meta_data jsonb default '{}');
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated;
    create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text);
    alter table storage.objects enable row level security;
    grant usage on schema storage to authenticated; grant select on storage.objects to authenticated;`);
  await db.exec(await fs.readFile(path.join(__dirname,'../supabase/migrations/202610310001_core.sql'),'utf8'));
  await db.exec(await fs.readFile(path.join(__dirname,'../supabase/migrations/202611030001_locations_inquiries.sql'),'utf8'));
  await db.exec(await fs.readFile(path.join(__dirname,'../supabase/migrations/202611030002_psgc_catalogue.sql'),'utf8'));
  await db.exec(await fs.readFile(path.join(__dirname,'../supabase/migrations/202611030003_notifications_comments.sql'),'utf8'));
  await db.exec(await fs.readFile(path.join(__dirname,'../supabase/migrations/202611030004_profile_photos.sql'),'utf8'));
  await db.exec(await fs.readFile(path.join(__dirname,'../supabase/migrations/202611040001_notification_history.sql'),'utf8'));
  await db.exec(await fs.readFile(path.join(__dirname,'../supabase/migrations/202611040002_community_likes.sql'),'utf8'));
  for(const id of [donor,recipient,stranger,unverified])await db.query("insert into auth.users values($1,$2,$3,'{\"display_name\":\"TEST MEMBER\"}')",[id,id+'@example.invalid',id===unverified?null:new Date().toISOString()]);
  await db.query("insert into storage.objects(bucket_id,name) values('food-photos',$1)",[donor+'/test.png']);
});
after(async()=>{await db?.close();if(directory)await fs.rm(directory,{recursive:true,force:true});});

test('unverified accounts cannot publish or reserve',async()=>{
  await assert.rejects(asUser(unverified,"select public.publish_post('request','Test request','Test body','Test area')"),/verified email/);
});
test('actual migration publishes public fields while hiding private pickup details',async()=>{
  donation=await publish();
  assert.equal((await asUser(stranger,'select title from public.donations where id=$1',[donation])).rows.length,1);
  assert.equal((await asUser(stranger,'select * from public.pickup_details where donation_id=$1',[donation])).rows.length,0);
  assert.equal((await asUser(donor,'select * from public.pickup_details where donation_id=$1',[donation])).rows[0].instructions,'TEST PRIVATE PICKUP');
});
test('direct writes and private profile preference reads are denied',async()=>{
  await assert.rejects(asUser(stranger,"update public.profiles set verified=true"),/permission denied/);
  await assert.rejects(asUser(stranger,"select notifications_enabled from public.profiles"),/permission denied/);
  await assert.rejects(asUser(stranger,"delete from public.donations"),/permission denied/);
});
test('anonymous clients cannot read application records',async()=>{
  await assert.rejects(db.transaction(async tx=>{await tx.exec('set local role anon');return tx.query('select * from public.donations');}),/permission denied/);
});
test('donors cannot reserve their own food',async()=>{
  await assert.rejects(asUser(donor,'select public.reserve_donation($1)',[donation]),/cannot be reserved/);
});
test('competing queued reservations produce exactly one winner',async()=>{
  // PGlite uses one connection; this tests simultaneous caller semantics, not multi-connection hosted contention.
  const results=await Promise.allSettled([recipient,stranger].map(user=>asUser(user,'select public.reserve_donation($1) id',[donation])));
  assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
  assert.equal(results.filter(r=>r.status==='rejected').length,1);
  reservation=results[0].value.rows[0].id;
  assert.equal((await db.query('select count(*)::int n from public.reservations where donation_id=$1',[donation])).rows[0].n,1);
});
test('only current participants can read pickup details and messages',async()=>{
  assert.equal((await asUser(recipient,'select * from public.pickup_details where donation_id=$1',[donation])).rows.length,1);
  await asUser(recipient,"select public.send_message($1,'TEST private message')",[reservation]);
  assert.equal((await asUser(donor,'select * from public.messages where reservation_id=$1',[reservation])).rows.length,1);
  assert.equal((await asUser(stranger,'select * from public.messages where reservation_id=$1',[reservation])).rows.length,0);
  await assert.rejects(asUser(stranger,"select public.send_message($1,'Intrusion test')",[reservation]),/unavailable/);
});
test('blocking stops new messages and hides private pickup instructions',async()=>{
  await asUser(donor,'select public.set_block($1,true)',[recipient]);
  await assert.rejects(asUser(recipient,"select public.send_message($1,'Blocked test')",[reservation]),/unavailable/);
  assert.equal((await asUser(recipient,'select * from public.pickup_details where donation_id=$1',[donation])).rows.length,0);
  await asUser(donor,'select public.set_block($1,false)',[recipient]);
});
test('both participants must confirm collection',async()=>{
  await assert.rejects(asUser(stranger,'select public.confirm_collection($1)',[reservation]),/cannot be confirmed/);
  await asUser(recipient,'select public.confirm_collection($1)',[reservation]);
  assert.equal((await asUser(donor,'select status from public.reservations where id=$1',[reservation])).rows[0].status,'reserved');
  await asUser(donor,'select public.confirm_collection($1)',[reservation]);
  assert.equal((await asUser(donor,'select status from public.donations where id=$1',[donation])).rows[0].status,'collected');
  assert.equal((await asUser(recipient,'select * from public.pickup_details where donation_id=$1',[donation])).rows.length,0);
});
test('cancelled claims lose private access and food can be reserved again',async()=>{
  const id=await publish();
  const claim=(await asUser(recipient,'select public.reserve_donation($1) id',[id])).rows[0].id;
  await asUser(recipient,'select public.cancel_reservation($1)',[claim]);
  assert.equal((await asUser(recipient,'select * from public.pickup_details where donation_id=$1',[id])).rows.length,0);
  await asUser(donor,'select public.set_block($1,true)',[recipient]);
  assert.equal((await asUser(recipient,"select * from public.donations where id=$1 and status='available'",[id])).rows.length,0);
  await asUser(donor,'select public.set_block($1,false)',[recipient]);
  await asUser(stranger,'select public.reserve_donation($1)',[id]);
});
test('expired donations cannot be reserved and are excluded for unrelated users',async()=>{
  const id=await publish();await db.query("update public.donations set pickup_deadline=now()-interval '1 hour' where id=$1",[id]);
  await assert.rejects(asUser(recipient,'select public.reserve_donation($1)',[id]),/no longer available/);
  assert.equal((await asUser(recipient,'select * from public.donations where id=$1',[id])).rows.length,0);
});
test('reports are private and organisation verification cannot be self-assigned',async()=>{
  await asUser(recipient,"select public.report_content('donation',$1,'TEST ONLY report')",[donation]);
  assert.equal((await asUser(donor,'select * from public.reports')).rows.length,0);
  assert.equal((await asUser(recipient,'select * from public.reports')).rows.length,1);
  await asUser(recipient,"select public.save_profile('TEST Organisation','organisation','TEST School',false)");
  assert.equal((await asUser(recipient,'select (public.my_profile()).verified verified')).rows[0].verified,false);
});
test('retention removes private details at 30 days and history at 90 days',async()=>{
  await db.query("update public.donations set closed_at=now()-interval '31 days' where id=$1",[donation]);
  await db.query("update public.reservations set closed_at=now()-interval '31 days' where id=$1",[reservation]);
  await db.exec('select public.purge_retained_data()');
  assert.equal((await db.query('select * from public.messages where reservation_id=$1',[reservation])).rows.length,0);
  assert.equal((await db.query('select * from public.pickup_details where donation_id=$1',[donation])).rows.length,0);
  assert.equal((await db.query('select * from public.donations where id=$1',[donation])).rows.length,1);
  await db.query("update public.donations set closed_at=now()-interval '91 days' where id=$1",[donation]);
  await db.exec('select public.purge_retained_data()');
  assert.equal((await db.query('select * from public.donations where id=$1',[donation])).rows.length,0);
});
test('rate limits reject excessive mutations',async()=>{
  await db.query("insert into public.action_events(user_id) select $1 from generate_series(1,20)",[stranger]);
  await assert.rejects(asUser(stranger,"select public.publish_post('update','TEST ONLY','TEST ONLY content','TEST AREA')"),/Too many requests/);
});
test('account removal releases active food and cascades private records',async()=>{
  const temporary='10000000-0000-4000-8000-000000000005';
  await db.query("insert into auth.users values($1,'test-deleted@example.invalid',now(),'{\"display_name\":\"TEST ONLY\"}')",[temporary]);
  const id=await publish();
  const claim=(await asUser(temporary,'select public.reserve_donation($1) id',[id])).rows[0].id;
  await asUser(temporary,"select public.send_message($1,'TEST ONLY deletion')",[claim]);
  await db.query('delete from auth.users where id=$1',[temporary]);
  assert.equal((await db.query('select * from public.profiles where id=$1',[temporary])).rows.length,0);
  assert.equal((await db.query('select * from public.messages where reservation_id=$1',[claim])).rows.length,0);
  assert.equal((await db.query('select status from public.donations where id=$1',[id])).rows[0].status,'available');
});
test('database survives closing and reopening the server engine',async()=>{
  const before=(await db.query('select count(*)::int n from public.donations')).rows[0].n;
  await db.close();db=new PGlite(directory);
  assert.equal((await db.query('select count(*)::int n from public.donations')).rows[0].n,before);
  assert.equal((await asUser(recipient,'select * from public.reports')).rows.length,1);
});

test('official catalogue supports cities, municipalities and same-name places',async()=>{
  assert.equal((await asUser(donor,"select count(*)::int n from public.locations")).rows[0].n,1642);
  assert.equal((await asUser(donor,"select count(*)::int n from public.locations where kind='Municipality'")).rows[0].n,1493);
  await assert.rejects(asUser(donor,"insert into public.locations values('0000000000','Forged','','','City')"),/permission denied/);
});
test('structured location validation preserves legacy fields and supports multiple community areas',async()=>{
  await db.exec('delete from public.action_events');
  const places=(await db.query('select code from public.locations order by code limit 2')).rows.map(r=>r.code);
  await assert.rejects(asUser(donor,"select public.publish_located_donation('{\"location_code\":\"invalid\"}')"),/Choose a city/);
  await assert.rejects(asUser(donor,"select public.publish_located_post('update','TEST ONLY','TEST ONLY body',array['invalid'])"),/Choose 1/);
  const post=(await asUser(donor,"select public.publish_located_post('update','TEST ONLY','TEST ONLY body',$1::text[]) id",[places])).rows[0].id;
  assert.equal((await asUser(recipient,'select id from public.community_posts where id=$1 and location_codes && $2::text[]',[post,[places[1]]])).rows.length,1);
  const located=await publish({location_code:places[0],neighbourhood:'TEST NEIGHBOURHOOD'});
  assert.equal((await asUser(recipient,'select id from public.donations where id=$1 and location_code=any($2::text[])',[located,places])).rows.length,1);
  assert.match((await asUser(donor,'select area from public.donations where id=$1',[located])).rows[0].area,/TEST NEIGHBOURHOOD/);
  const id=await publish();
  assert.equal((await asUser(donor,'select area,location_code from public.donations where id=$1',[id])).rows[0].area,'TEST AREA');
});
test('pre-reservation inquiries are private, deduplicated and never reserve food or expose pickup details',async()=>{
  await db.exec('delete from public.action_events');
  const id=await publish();
  await assert.rejects(asUser(unverified,"select public.send_inquiry($1,'TEST question')",[id]),/verified email/);
  await assert.rejects(asUser(donor,"select public.send_inquiry($1,'TEST question')",[id]),/unavailable/);
  await assert.rejects(asUser(recipient,"select public.send_inquiry($1,'  ')",[id]),/Enter a message/);
  const t=(await asUser(recipient,"select public.send_inquiry($1,'TEST inquiry') id",[id])).rows[0].id;
  assert.equal((await asUser(recipient,"select public.send_inquiry($1,'TEST second inquiry') id",[id])).rows[0].id,t);
  assert.equal((await asUser(donor,'select * from public.inquiry_messages where inquiry_id=$1',[t])).rows.length,2);
  assert.equal((await asUser(stranger,'select * from public.inquiries where id=$1',[t])).rows.length,0);
  assert.equal((await asUser(stranger,'select * from public.inquiry_messages where inquiry_id=$1',[t])).rows.length,0);
  await assert.rejects(asUser(stranger,"select public.send_inquiry($1,'TEST intrusion',$2)",[id,t]),/unavailable/);
  await assert.rejects(asUser(recipient,"update public.inquiries set donor_id=$1 where id=$2",[stranger,t]),/permission denied/);
  assert.equal((await asUser(recipient,'select * from public.pickup_details where donation_id=$1',[id])).rows.length,0);
  assert.equal((await db.query('select status from public.donations where id=$1',[id])).rows[0].status,'available');
  assert.equal((await db.query('select * from public.reservations where donation_id=$1',[id])).rows.length,0);
  assert.equal((await asUser(donor,'select * from public.notifications where inquiry_id=$1 and read_at is null',[t])).rows.length,2);
  await asUser(donor,'select public.read_inquiry($1)',[t]);
  assert.equal((await asUser(donor,'select * from public.notifications where inquiry_id=$1 and read_at is null',[t])).rows.length,0);
  await asUser(donor,'select public.set_block($1,true)',[recipient]);
  await assert.rejects(asUser(recipient,"select public.send_inquiry($1,'TEST blocked',$2)",[id,t]),/unavailable/);
  await asUser(donor,'select public.set_block($1,false)',[recipient]);
  // Notification opt-out also applies to inquiry messages.
  await asUser(recipient,"select public.save_profile('TEST MEMBER','individual','',false)");
  await asUser(donor,"select public.send_inquiry($1,'TEST reply',$2)",[id,t]);
  assert.equal((await asUser(recipient,'select * from public.notifications where inquiry_id=$1',[t])).rows.length,0);
  await asUser(stranger,'select public.reserve_donation($1)',[id]);
  await assert.rejects(asUser(recipient,"select public.send_inquiry($1,'TEST after reservation',$2)",[id,t]),/no longer accepting/);
  await db.query("update public.inquiries set last_message_at=now()-interval '31 days' where id=$1",[t]);
  await db.exec('select public.purge_retained_data()');
  assert.equal((await db.query('select * from public.inquiry_messages where inquiry_id=$1',[t])).rows.length,0);
});


test('reservation alerts identify food and pickup; both kinds of messages produce unread counts',async()=>{
  await db.exec('delete from public.action_events');
  const id=await publish();const claim=(await asUser(recipient,'select public.reserve_donation($1) id',[id])).rows[0].id;
  const notes=(await asUser(donor,'select * from public.notifications where donation_id=$1',[id])).rows;
  assert.equal(notes[0].reservation_id,claim);assert.equal(notes[0].kind,'reservation');assert.match(notes[0].body,/TEST ONLY/);
  const before=(await asUser(donor,'select public.unread_counts() counts')).rows[0].counts.messages;
  await asUser(recipient,"select public.send_message($1,'SYNTHETIC pickup question')",[claim]);
  assert.equal((await asUser(donor,'select public.unread_counts() counts')).rows[0].counts.messages,before+1);
  const stamp=(await db.query('select max(created_at) stamp from public.messages where reservation_id=$1',[claim])).rows[0].stamp;
  await asUser(stranger,'select public.read_pickup($1,$2)',[claim,stamp]);
  assert.equal((await db.query('select donor_read_at from public.reservations where id=$1',[claim])).rows[0].donor_read_at,null);
  await asUser(donor,'select public.read_pickup($1,$2)',[claim,stamp]);
  assert.equal((await asUser(donor,"select * from public.notifications where reservation_id=$1 and kind='pickup_message' and read_at is null",[claim])).rows.length,0);
  await asUser(donor,'select public.confirm_collection($1)',[claim]);
  const confirm=(await asUser(recipient,"select * from public.notifications where reservation_id=$1 and kind='confirm_collection'",[claim])).rows;
  // Recipient opted out earlier: unread messages still work without alert records.
  assert.equal(confirm.length,0);
  await asUser(recipient,"select public.save_profile('TEST MEMBER','individual','',true)");
  await asUser(recipient,'select public.confirm_collection($1)',[claim]);
  assert.equal((await asUser(donor,"select reservation_id from public.notifications where donation_id=$1 and kind='completed'",[id])).rows[0].reservation_id,claim);
});

test('comments have real authors, author-only removal, blocked visibility, reports and direct notification links',async()=>{
  await db.exec('delete from public.action_events');
  const post=(await asUser(donor,"select public.publish_post('update','SYNTHETIC POST','SYNTHETIC BODY','SYNTHETIC AREA') id")).rows[0].id;
  await assert.rejects(asUser(unverified,"select public.add_comment($1,'TEST')",[post]),/verified email/);
  const comment=(await asUser(recipient,"select public.add_comment($1,'SYNTHETIC COMMENT') id",[post])).rows[0].id;
  assert.equal((await asUser(stranger,'select author_id from public.community_comments where id=$1',[comment])).rows[0].author_id,recipient);
  const alert=(await asUser(donor,"select * from public.notifications where post_id=$1",[post])).rows[0];
  assert.equal(alert.kind,'community_comment');assert.match(alert.body,/SYNTHETIC POST/);
  await asUser(stranger,'select public.mark_notification_read($1)',[alert.id]);
  assert.equal((await asUser(donor,'select read_at from public.notifications where id=$1',[alert.id])).rows[0].read_at,null);
  await assert.rejects(asUser(stranger,'select public.hide_my_comment($1)',[comment]),/only remove your own/);
  await asUser(stranger,"select public.report_content('comment',$1,'SYNTHETIC REPORT')",[comment]);
  await asUser(donor,'select public.set_block($1,true)',[recipient]);
  assert.equal((await asUser(donor,'select * from public.community_comments where id=$1',[comment])).rows.length,0);
  await assert.rejects(asUser(recipient,"select public.add_comment($1,'BLOCKED COMMENT')",[post]),/unavailable/);
  await asUser(donor,'select public.set_block($1,false)',[recipient]);
  await asUser(recipient,'select public.hide_my_comment($1)',[comment]);
  assert.equal((await asUser(stranger,'select * from public.community_comments where id=$1',[comment])).rows.length,0);
});

test('profile photos must belong to the owner and never grant organisation verification',async()=>{
  await db.exec('delete from public.action_events');
  const path=donor+'/SYNTHETIC-avatar.png';await db.query("insert into storage.objects(bucket_id,name) values('profile-photos',$1)",[path]);
  await asUser(donor,"select public.save_profile_details('SYNTHETIC DONOR','individual','','SYNTHETIC BIO',$1)",[path]);
  assert.equal((await asUser(stranger,'select bio,avatar_path from public.profiles where id=$1',[donor])).rows[0].bio,'SYNTHETIC BIO');
  assert.equal((await asUser(stranger,"select * from storage.objects where bucket_id='profile-photos' and name=$1",[path])).rows.length,1);
  await assert.rejects(asUser(recipient,"select public.save_profile_details('TEST MEMBER','individual','','',$1)",[path]),/own uploaded/);
  await asUser(donor,'select public.set_block($1,true)',[recipient]);
  assert.equal((await asUser(recipient,"select * from storage.objects where bucket_id='profile-photos' and name=$1",[path])).rows.length,0);
  await asUser(donor,'select public.set_block($1,false)',[recipient]);
  assert.equal((await asUser(donor,'select verified from public.profiles where id=$1',[donor])).rows[0].verified,false);
});


test('post likes are authenticated, idempotent, reversible and cannot be assigned to another member',async()=>{
  await db.exec('delete from public.action_events');
  const post=(await asUser(donor,"select public.publish_post('update','LIKE TEST','SYNTHETIC BODY','TEST AREA') id")).rows[0].id;
  await assert.rejects(asUser(unverified,'select public.set_post_like($1,true)',[post]),/verified email/);
  await assert.rejects(db.transaction(async tx=>{await tx.exec('set local role anon');return tx.query('select public.set_post_like($1,true)',[post]);}),/permission denied/);
  await assert.rejects(asUser(recipient,'insert into public.community_likes(post_id,user_id) values($1,$2)',[post,donor]),/permission denied/);
  await Promise.all([1,2].map(()=>asUser(recipient,'select public.set_post_like($1,true)',[post])));
  assert.equal((await db.query('select count(*)::int n from public.community_likes where post_id=$1',[post])).rows[0].n,1);
  const activity=(await asUser(recipient,'select * from public.community_post_activity($1)',[[post]])).rows[0];
  assert.equal(Number(activity.like_count),1);assert.equal(activity.liked,true);assert.equal(Number(activity.comment_count),0);
  assert.equal((await asUser(stranger,'select * from public.community_likes where post_id=$1',[post])).rows.length,0);
  assert.equal((await asUser(recipient,'select * from public.community_likes where post_id=$1',[post])).rows.length,1);
  await asUser(recipient,'select public.set_post_like($1,false)',[post]);
  await asUser(recipient,'select public.set_post_like($1,false)',[post]);
  assert.equal(Number((await asUser(donor,'select * from public.community_post_activity($1)',[[post]])).rows[0].like_count),0);
});

test('post activity respects hidden posts, member blocking and visible comment counts',async()=>{
  await db.exec('delete from public.action_events');
  const post=(await asUser(donor,"select public.publish_post('request','ACTIVITY TEST','SYNTHETIC BODY','TEST AREA') id")).rows[0].id;
  await asUser(recipient,'select public.set_post_like($1,true)',[post]);
  const comment=(await asUser(recipient,"select public.add_comment($1,'SYNTHETIC COMMENT') id",[post])).rows[0].id;
  assert.equal(Number((await asUser(stranger,'select * from public.community_post_activity($1)',[[post]])).rows[0].comment_count),1);
  await asUser(stranger,'select public.set_block($1,true)',[recipient]);
  const filtered=(await asUser(stranger,'select * from public.community_post_activity($1)',[[post]])).rows[0];
  assert.equal(Number(filtered.comment_count),0);assert.equal(Number(filtered.like_count),0);
  await asUser(stranger,'select public.set_block($1,false)',[recipient]);
  await asUser(recipient,'select public.hide_my_comment($1)',[comment]);
  assert.equal(Number((await asUser(stranger,'select * from public.community_post_activity($1)',[[post]])).rows[0].comment_count),0);
  await asUser(donor,'select public.set_block($1,true)',[recipient]);
  await assert.rejects(asUser(recipient,'select public.set_post_like($1,true)',[post]),/unavailable/);
  assert.equal((await asUser(recipient,'select * from public.community_post_activity($1)',[[post]])).rows.length,0);
  assert.equal((await asUser(recipient,'select * from public.community_likes where post_id=$1',[post])).rows.length,0);
  await asUser(donor,'select public.set_block($1,false)',[recipient]);
  await db.query('update public.community_posts set hidden=true where id=$1',[post]);
  assert.equal((await asUser(donor,'select * from public.community_post_activity($1)',[[post]])).rows.length,0);
  await assert.rejects(asUser(recipient,'select public.set_post_like($1,true)',[post]),/unavailable/);
});

test('post activity rejects anonymous and oversized reads; likes obey mutation limits and cascade with posts',async()=>{
  await db.exec('delete from public.action_events');
  const post=(await asUser(donor,"select public.publish_post('update','CASCADE TEST','SYNTHETIC BODY','TEST AREA') id")).rows[0].id;
  await assert.rejects(db.transaction(async tx=>{await tx.exec('set local role anon');return tx.query('select * from public.community_post_activity($1)',[[post]]);}),/permission denied/);
  await assert.rejects(asUser(recipient,'select * from public.community_post_activity($1)',[Array(21).fill(post)]),/up to 20/);
  await assert.rejects(asUser(recipient,'select public.set_post_like($1,null)',[post]),/like or unlike/);
  await asUser(recipient,'select public.set_post_like($1,true)',[post]);
  await db.query('insert into public.action_events(user_id) select $1 from generate_series(1,20)',[recipient]);
  await assert.rejects(asUser(recipient,'select public.set_post_like($1,false)',[post]),/Too many requests/);
  await db.query('delete from public.community_posts where id=$1',[post]);
  assert.equal((await db.query('select * from public.community_likes where post_id=$1',[post])).rows.length,0);
});
