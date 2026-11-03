-- Additive notification routing, unread pickup tracking and community comments.
begin;
alter table public.notifications add column kind text not null default 'update';
alter table public.notifications add column title text not null default 'Update';
alter table public.notifications add column reservation_id uuid references public.reservations on delete cascade;
alter table public.notifications add column post_id uuid references public.community_posts on delete cascade;
alter table public.reservations add column donor_read_at timestamptz;
alter table public.reservations add column recipient_read_at timestamptz;
alter table public.reservations add column last_message_at timestamptz;
alter table public.reservations add column last_sender_id uuid references public.profiles on delete set null;

create function public.describe_notification() returns trigger language plpgsql security definer set search_path='' as $$
declare food text; person text; claim public.reservations;
begin
  select coalesce(nullif(display_name,''),'A member') into person from public.profiles where id=auth.uid();
  person:=coalesce(person,'A member');
  if new.post_id is not null then return new; end if;
  if new.donation_id is null then new.title:='Account or donation update'; return new; end if;
  select title into food from public.donations where id=new.donation_id;
  if new.inquiry_id is not null then
    new.kind:='inquiry_message';new.title:='New inquiry message';
    new.body:=person||' sent you a message about “'||coalesce(food,'a donation')||'”.';
    return new;
  end if;
  select r.* into claim from public.reservations r join public.donations d on d.id=r.donation_id
    where r.donation_id=new.donation_id and new.user_id in (r.recipient_id,d.donor_id)
    order by r.created_at desc,r.id desc limit 1;
  new.reservation_id:=claim.id;
  if new.body like 'Your donation has been reserved.%' then
    new.kind:='reservation';new.title:='Your food was reserved';new.body:=person||' reserved “'||food||'”. Open the pickup to arrange collection.';
  elsif new.body like 'Reservation confirmed.%' then
    new.kind:='reservation';new.title:='Reservation confirmed';new.body:='You reserved “'||food||'”. Open your pickup for private collection instructions.';
  elsif new.body='You have a new pickup message.' then
    new.kind:='pickup_message';new.title:='New pickup message';new.body:=person||' messaged you about collecting “'||food||'”.';
  elsif new.body like 'Please confirm collection%' then
    new.kind:='confirm_collection';new.title:='Confirm the handover';new.body:=person||' confirmed collection of “'||food||'”. Open the pickup and confirm only if the food has been collected.';
  elsif new.body like 'Collection confirmed by both people.%' then
    new.kind:='completed';new.title:='Collection completed';new.body:='Both people confirmed collection of “'||food||'”. This exchange is now completed.';
  elsif new.body='A reservation was cancelled.' then
    new.kind:='cancelled';new.title:='Reservation cancelled';new.body:=person||' cancelled the reservation for “'||food||'”. Open the pickup to see its status.';
  elsif new.body='The donor cancelled this donation.' then
    new.kind:='cancelled';new.title:='Donation cancelled';new.body:='The donor cancelled “'||food||'”. Do not travel to collect this donation.';
  else new.title:='Update about “'||coalesce(food,'a donation')||'”';end if;
  return new;
end $$;
create trigger notification_description before insert on public.notifications for each row execute function public.describe_notification();
-- Existing notifications retain their original message and receive a specific item/destination.
update public.notifications n set title='Update about “'||d.title||'”',
  reservation_id=(select r.id from public.reservations r where r.donation_id=d.id and n.user_id in (r.recipient_id,d.donor_id) order by r.created_at desc,r.id desc limit 1)
  from public.donations d where n.donation_id=d.id and n.inquiry_id is null;
update public.notifications set kind='inquiry_message',title='Inquiry message' where inquiry_id is not null;
update public.notifications set kind='pickup_message',title='Pickup message' where body='You have a new pickup message.';

create function public.track_pickup_message() returns trigger language plpgsql security definer set search_path='' as $$
begin
  update public.reservations r set last_message_at=new.created_at,last_sender_id=new.sender_id,
    donor_read_at=case when new.sender_id=d.donor_id then new.created_at else r.donor_read_at end,
    recipient_read_at=case when new.sender_id=r.recipient_id then new.created_at else r.recipient_read_at end
    from public.donations d where r.id=new.reservation_id and d.id=r.donation_id;
  return new;
end $$;
create trigger pickup_message_unread after insert on public.messages for each row execute function public.track_pickup_message();
update public.reservations r set last_message_at=m.created_at,last_sender_id=m.sender_id from
  (select distinct on(reservation_id) reservation_id,created_at,sender_id from public.messages order by reservation_id,created_at desc,id desc) m where m.reservation_id=r.id;

create function public.read_pickup(p_reservation uuid,p_through timestamptz) returns void language plpgsql security definer set search_path='' as $$
declare uid uuid:=public.actor();
begin
  update public.reservations r set donor_read_at=case when uid=d.donor_id then greatest(r.donor_read_at,least(p_through,now())) else r.donor_read_at end,
    recipient_read_at=case when uid=r.recipient_id then greatest(r.recipient_read_at,least(p_through,now())) else r.recipient_read_at end
    from public.donations d where r.id=p_reservation and d.id=r.donation_id and uid in (d.donor_id,r.recipient_id);
  update public.notifications set read_at=now() where user_id=uid and reservation_id=p_reservation and kind='pickup_message' and created_at<=p_through and read_at is null;
end $$;
create function public.mark_notification_read(p_notification uuid) returns void language plpgsql security definer set search_path='' as $$
declare uid uuid:=public.actor();
begin update public.notifications set read_at=now() where id=p_notification and user_id=uid and read_at is null;end $$;
create function public.unread_counts() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare uid uuid:=public.actor(); notes integer; threads integer; pickups integer;
begin
  select count(*) into notes from public.notifications where user_id=uid and read_at is null;
  select count(*) into threads from public.inquiries where uid in (donor_id,inquirer_id) and
    coalesce(case when uid=donor_id then donor_read_at else inquirer_read_at end,'-infinity'::timestamptz)<last_message_at;
  select count(*) into pickups from public.reservations r join public.donations d on d.id=r.donation_id
    where uid in (d.donor_id,r.recipient_id) and r.last_sender_id<>uid and
    coalesce(case when uid=d.donor_id then r.donor_read_at else r.recipient_read_at end,'-infinity'::timestamptz)<r.last_message_at;
  return jsonb_build_object('notifications',notes,'messages',threads+pickups);
end $$;

create table public.community_comments (
 id uuid primary key default gen_random_uuid(),
 post_id uuid not null references public.community_posts on delete cascade,
 author_id uuid not null references public.profiles on delete cascade,
 body text not null check(length(trim(body)) between 1 and 1000),
 hidden boolean not null default false,
 created_at timestamptz not null default now()
);
create index community_comments_post on public.community_comments(post_id,created_at,id);
alter table public.community_comments enable row level security;
create policy comments_read on public.community_comments for select to authenticated using (
 not hidden and not public.is_blocked(author_id) and exists(select 1 from public.community_posts p where p.id=post_id and not p.hidden and not public.is_blocked(p.author_id))
);
revoke all on public.community_comments from public,anon,authenticated;
grant select on public.community_comments to authenticated;
alter table public.reports drop constraint reports_target_type_check;
alter table public.reports add constraint reports_target_type_check check(target_type in ('donation','post','user','comment'));
create function public.add_comment(p_post uuid,p_body text) returns uuid language plpgsql security definer set search_path='' as $$
declare uid uuid:=public.guard_action(); item public.community_posts; result uuid; person text;
begin
 select * into item from public.community_posts where id=p_post for share;
 if item.id is null or item.hidden or public.is_blocked(item.author_id) then raise exception 'This post is unavailable.';end if;
 if p_body is null or length(trim(p_body)) not between 1 and 1000 then raise exception 'Write a comment of 1–1000 characters.';end if;
 insert into public.community_comments(post_id,author_id,body) values(item.id,uid,trim(p_body)) returning id into result;
 select coalesce(nullif(display_name,''),'A member') into person from public.profiles where id=uid;
 if uid<>item.author_id then
  insert into public.notifications(user_id,post_id,kind,title,body)
    select item.author_id,item.id,'community_comment','New community comment',person||' commented on “'||item.title||'”.'
    where exists(select 1 from public.profiles where id=item.author_id and notifications_enabled);
 end if;
 return result;
end $$;
create function public.hide_my_comment(p_comment uuid) returns void language plpgsql security definer set search_path='' as $$
declare uid uuid:=public.guard_action();
begin
 update public.community_comments set hidden=true where id=p_comment and author_id=uid;
 if not found then raise exception 'You can only remove your own comments.';end if;
end $$;
create or replace function public.report_content(p_type text,p_target uuid,p_reason text) returns void language plpgsql security definer set search_path='' as $$
declare uid uuid:=public.guard_action();
begin
 if not ((p_type='donation' and exists(select 1 from public.donations where id=p_target)) or (p_type='post' and exists(select 1 from public.community_posts where id=p_target)) or (p_type='user' and exists(select 1 from public.profiles where id=p_target)) or (p_type='comment' and exists(select 1 from public.community_comments where id=p_target and not hidden))) then raise exception 'Content not found.';end if;
 insert into public.reports(reporter_id,target_type,target_id,reason) values(uid,p_type,p_target,trim(p_reason));
end $$;
revoke all on function public.describe_notification(),public.track_pickup_message(),public.read_pickup(uuid,timestamptz),public.mark_notification_read(uuid),public.unread_counts(),public.add_comment(uuid,text),public.hide_my_comment(uuid) from public,anon,authenticated;
grant execute on function public.read_pickup(uuid,timestamptz),public.mark_notification_read(uuid),public.unread_counts(),public.add_comment(uuid,text),public.hide_my_comment(uuid) to authenticated;
commit;
