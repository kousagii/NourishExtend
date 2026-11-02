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
async function publish() {
  const payload={title:'TEST ONLY — Rice',description:'Synthetic integration-test record',quantity:'2 sealed packs',category:'Pantry',allergens:'Unknown',storage_info:'Sealed, dry storage',area:'TEST AREA',photo_path:donor+'/test.png',pickup_deadline:new Date(Date.now()+86400000).toISOString(),instructions:'TEST PRIVATE PICKUP'};
  const result=await asUser(donor,'select public.publish_donation($1::jsonb) id',[JSON.stringify(payload)]);
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
