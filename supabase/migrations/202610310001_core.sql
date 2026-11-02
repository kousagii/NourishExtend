-- Apply to a fresh Supabase project. Auth and Storage are supplied by Supabase.
begin;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '' check (length(display_name) <= 80),
  account_type text not null default 'individual' check (account_type in ('individual','organisation')),
  organisation_name text not null default '' check (length(organisation_name) <= 120),
  verified boolean not null default false,
  notifications_enabled boolean not null default true
);
create table public.donations (
  id uuid primary key default gen_random_uuid(),
  donor_id uuid not null references public.profiles on delete cascade,
  title text not null check (length(trim(title)) between 3 and 100),
  description text not null default '' check (length(description) <= 1500),
  quantity text not null check (length(trim(quantity)) between 1 and 80),
  category text not null check (category in ('Produce','Bakery','Pantry','Prepared','Other')),
  allergens text not null check (length(trim(allergens)) between 1 and 300),
  storage_info text not null check (length(trim(storage_info)) between 1 and 300),
  area text not null check (length(trim(area)) between 2 and 120),
  photo_path text not null,
  pickup_deadline timestamptz not null,
  status text not null default 'available' check (status in ('available','reserved','collected','cancelled')),
  created_at timestamptz not null default now(),
  closed_at timestamptz
);
create table public.pickup_details (
  donation_id uuid primary key references public.donations on delete cascade,
  instructions text not null check (length(trim(instructions)) between 3 and 1000)
);
create table public.reservations (
  id uuid primary key default gen_random_uuid(),
  donation_id uuid not null references public.donations on delete cascade,
  recipient_id uuid not null references public.profiles on delete cascade,
  status text not null default 'reserved' check (status in ('reserved','collected','cancelled')),
  donor_confirmed boolean not null default false,
  recipient_confirmed boolean not null default false,
  created_at timestamptz not null default now(),
  closed_at timestamptz
);
create unique index one_live_claim on public.reservations(donation_id) where status <> 'cancelled';
create index donations_feed on public.donations(status, pickup_deadline);
create index reservations_recipient on public.reservations(recipient_id);
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  reservation_id uuid not null references public.reservations on delete cascade,
  sender_id uuid not null references public.profiles on delete cascade,
  body text not null check (length(trim(body)) between 1 and 1500),
  created_at timestamptz not null default now()
);
create index messages_thread on public.messages(reservation_id, created_at);
create table public.community_posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles on delete cascade,
  kind text not null check (kind in ('request','update')),
  title text not null check (length(trim(title)) between 3 and 100),
  body text not null check (length(trim(body)) between 3 and 1500),
  area text not null check (length(trim(area)) between 2 and 120),
  hidden boolean not null default false,
  created_at timestamptz not null default now()
);
create table public.blocks (
  blocker_id uuid not null references public.profiles on delete cascade,
  blocked_id uuid not null references public.profiles on delete cascade,
  primary key (blocker_id,blocked_id), check(blocker_id <> blocked_id)
);
create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles on delete cascade,
  target_type text not null check(target_type in ('donation','post','user')),
  target_id uuid not null,
  reason text not null check(length(trim(reason)) between 5 and 1000),
  resolved boolean not null default false,
  created_at timestamptz not null default now()
);
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles on delete cascade,
  donation_id uuid references public.donations on delete cascade,
  body text not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_owner on public.notifications(user_id,created_at);
create table public.action_events (user_id uuid not null references public.profiles on delete cascade, created_at timestamptz not null default now());
create index action_events_owner on public.action_events(user_id,created_at);

create function public.init_profile() returns trigger language plpgsql security definer set search_path='' as $$
begin
  insert into public.profiles(id,display_name) values(new.id,left(coalesce(new.raw_user_meta_data->>'display_name',''),80));
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.init_profile();

create function public.actor() returns uuid language plpgsql security definer set search_path='' as $$
declare uid uuid := auth.uid();
begin
  if uid is null or not exists(select 1 from auth.users where id=uid and email_confirmed_at is not null) then
    raise exception 'Sign in with a verified email to continue.' using errcode='42501';
  end if;
  return uid;
end $$;
create function public.guard_action() returns uuid language plpgsql security definer set search_path='' as $$
declare uid uuid := public.actor();
begin
  -- Serialise counters for this actor so concurrent requests cannot evade limits.
  perform pg_advisory_xact_lock(hashtext(uid::text));
  if (select count(*) from public.action_events where user_id=uid and created_at>now()-interval '1 minute') >= 20
     or (select count(*) from public.action_events where user_id=uid and created_at>now()-interval '1 day') >= 300 then
    raise exception 'Too many requests. Please try again later.';
  end if;
  insert into public.action_events(user_id) values(uid);
  return uid;
end $$;
create function public.is_blocked(other_user uuid) returns boolean language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.blocks where (blocker_id=auth.uid() and blocked_id=other_user) or (blocked_id=auth.uid() and blocker_id=other_user));
$$;
create function public.is_participant(reservation uuid) returns boolean language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.reservations r join public.donations d on d.id=r.donation_id where r.id=reservation and auth.uid() in (r.recipient_id,d.donor_id));
$$;
create function public.can_read_donation(donation uuid) returns boolean language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.donations d where d.id=donation and (d.donor_id=auth.uid() or
    (d.status='available' and d.pickup_deadline>now() and not public.is_blocked(d.donor_id)) or
    exists(select 1 from public.reservations r where r.donation_id=d.id and r.recipient_id=auth.uid() and (d.status<>'available' or not public.is_blocked(d.donor_id)))));
$$;
create function public.notify(target uuid, donation uuid, content text) returns void language sql security definer set search_path='' as $$
  insert into public.notifications(user_id,donation_id,body)
  select target,donation,content where exists(select 1 from public.profiles where id=target and notifications_enabled);
$$;
create function public.release_departing_reservations() returns trigger language plpgsql security definer set search_path='' as $$
begin
  perform public.notify(d.donor_id,null,'A reservation was cancelled because the recipient deleted their account.')
    from public.reservations r join public.donations d on d.id=r.donation_id
    where r.recipient_id=old.id and r.status='reserved' and d.donor_id<>old.id;
  perform public.notify(r.recipient_id,null,'A donation was cancelled because the donor deleted their account.')
    from public.reservations r join public.donations d on d.id=r.donation_id
    where d.donor_id=old.id and r.status='reserved' and r.recipient_id<>old.id;
  update public.donations d set status='available' where d.status='reserved' and d.donor_id<>old.id
    and exists(select 1 from public.reservations r where r.donation_id=d.id and r.recipient_id=old.id and r.status='reserved');
  return old;
end $$;
create trigger on_profile_deleted before delete on public.profiles for each row execute function public.release_departing_reservations();

-- All tables are read through RLS. Mutations use explicit, validated functions only.
alter table public.profiles enable row level security;
alter table public.donations enable row level security;
alter table public.pickup_details enable row level security;
alter table public.reservations enable row level security;
alter table public.messages enable row level security;
alter table public.community_posts enable row level security;
alter table public.blocks enable row level security;
alter table public.reports enable row level security;
alter table public.notifications enable row level security;
alter table public.action_events enable row level security;
create policy profiles_read on public.profiles for select to authenticated using (id=auth.uid() or not public.is_blocked(id));
create policy donations_read on public.donations for select to authenticated using (public.can_read_donation(id));
create policy pickup_read on public.pickup_details for select to authenticated using (
  exists(select 1 from public.donations d where d.id=donation_id and d.donor_id=auth.uid()) or
  exists(select 1 from public.reservations r join public.donations d on d.id=r.donation_id where r.donation_id=pickup_details.donation_id and r.recipient_id=auth.uid() and r.status='reserved' and not public.is_blocked(d.donor_id))
);
create policy reservations_read on public.reservations for select to authenticated using (public.is_participant(id));
create policy messages_read on public.messages for select to authenticated using (public.is_participant(reservation_id));
create policy posts_read on public.community_posts for select to authenticated using ((not hidden and not public.is_blocked(author_id)) or author_id=auth.uid());
create policy blocks_read on public.blocks for select to authenticated using (blocker_id=auth.uid());
create policy reports_read on public.reports for select to authenticated using (reporter_id=auth.uid());
create policy notifications_read on public.notifications for select to authenticated using (user_id=auth.uid());

create function public.save_profile(p_name text,p_type text,p_organisation text,p_notifications boolean) returns void language plpgsql security definer set search_path='' as $$
declare uid uuid := public.guard_action();
begin
  if length(trim(p_name)) not between 2 and 80 then raise exception 'Display name must have 2–80 characters.'; end if;
  if p_type='organisation' and length(trim(p_organisation))<2 then raise exception 'Enter an organisation name.'; end if;
  update public.profiles set display_name=trim(p_name),account_type=p_type,organisation_name=trim(p_organisation),notifications_enabled=p_notifications where id=uid;
end $$;
create function public.publish_donation(p_data jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare uid uuid := public.guard_action(); new_id uuid; deadline timestamptz := (p_data->>'pickup_deadline')::timestamptz;
begin
  if deadline<=now() or deadline>now()+interval '30 days' then raise exception 'Choose a pickup deadline within the next 30 days.'; end if;
  if not exists(select 1 from storage.objects where bucket_id='food-photos' and name=p_data->>'photo_path' and split_part(name,'/',1)=uid::text) then raise exception 'Upload a food photo first.'; end if;
  insert into public.donations(donor_id,title,description,quantity,category,allergens,storage_info,area,photo_path,pickup_deadline)
  values(uid,trim(p_data->>'title'),coalesce(p_data->>'description',''),trim(p_data->>'quantity'),p_data->>'category',trim(p_data->>'allergens'),trim(p_data->>'storage_info'),trim(p_data->>'area'),p_data->>'photo_path',deadline) returning id into new_id;
  insert into public.pickup_details values(new_id,trim(p_data->>'instructions'));
  return new_id;
end $$;
create function public.reserve_donation(p_donation uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare uid uuid := public.guard_action(); item public.donations; claim uuid;
begin
  select * into item from public.donations where id=p_donation for update;
  if not found or item.status<>'available' or item.pickup_deadline<=now() then raise exception 'This donation is no longer available.'; end if;
  if item.donor_id=uid or public.is_blocked(item.donor_id) then raise exception 'This donation cannot be reserved.'; end if;
  insert into public.reservations(donation_id,recipient_id) values(p_donation,uid) returning id into claim;
  update public.donations set status='reserved' where id=p_donation;
  perform public.notify(item.donor_id,p_donation,'Your donation has been reserved. Arrange collection in Activity.');
  perform public.notify(uid,p_donation,'Reservation confirmed. View private pickup details in Activity.');
  return claim;
end $$;
create function public.cancel_reservation(p_reservation uuid) returns void language plpgsql security definer set search_path='' as $$
declare uid uuid := public.guard_action(); claim public.reservations; item public.donations;
begin
  select * into claim from public.reservations where id=p_reservation;
  select * into item from public.donations where id=claim.donation_id for update;
  select * into claim from public.reservations where id=p_reservation for update;
  if claim.id is null or uid not in (item.donor_id,claim.recipient_id) or claim.status<>'reserved' then raise exception 'This reservation cannot be cancelled.'; end if;
  update public.reservations set status='cancelled',closed_at=now() where id=claim.id;
  update public.donations set status='available' where id=item.id;
  perform public.notify(item.donor_id,item.id,'A reservation was cancelled.');
  perform public.notify(claim.recipient_id,item.id,'A reservation was cancelled.');
end $$;
create function public.confirm_collection(p_reservation uuid) returns void language plpgsql security definer set search_path='' as $$
declare uid uuid := public.guard_action(); claim public.reservations; item public.donations;
begin
  select * into claim from public.reservations where id=p_reservation;
  select * into item from public.donations where id=claim.donation_id for update;
  select * into claim from public.reservations where id=p_reservation for update;
  if claim.id is null or uid not in (item.donor_id,claim.recipient_id) or claim.status<>'reserved' then raise exception 'This collection cannot be confirmed.'; end if;
  update public.reservations set donor_confirmed=donor_confirmed or uid=item.donor_id,recipient_confirmed=recipient_confirmed or uid=recipient_id where id=claim.id returning * into claim;
  if claim.donor_confirmed and claim.recipient_confirmed then
    update public.reservations set status='collected',closed_at=now() where id=claim.id;
    update public.donations set status='collected',closed_at=now() where id=item.id;
    perform public.notify(item.donor_id,item.id,'Collection confirmed by both people. Thank you for sharing.');
    perform public.notify(claim.recipient_id,item.id,'Collection confirmed by both people.');
  else
    perform public.notify(case when uid=item.donor_id then claim.recipient_id else item.donor_id end,item.id,'Please confirm collection after the food is handed over.');
  end if;
end $$;
create function public.cancel_donation(p_donation uuid) returns void language plpgsql security definer set search_path='' as $$
declare uid uuid := public.guard_action(); item public.donations;
begin
  select * into item from public.donations where id=p_donation for update;
  if item.donor_id is distinct from uid or item.status not in ('available','reserved') then raise exception 'This donation cannot be cancelled.'; end if;
  perform public.notify(r.recipient_id,item.id,'The donor cancelled this donation.') from public.reservations r where r.donation_id=item.id and r.status='reserved';
  update public.reservations set status='cancelled',closed_at=now() where donation_id=item.id and status='reserved';
  update public.donations set status='cancelled',closed_at=now() where id=item.id;
end $$;
create function public.send_message(p_reservation uuid,p_body text) returns void language plpgsql security definer set search_path='' as $$
declare uid uuid := public.guard_action(); claim public.reservations; donor uuid;
begin
  select * into claim from public.reservations where id=p_reservation;
  select donor_id into donor from public.donations where id=claim.donation_id;
  if claim.id is null or uid not in (donor,claim.recipient_id) or claim.status<>'reserved' or public.is_blocked(case when uid=donor then claim.recipient_id else donor end) then raise exception 'Messaging is unavailable for this reservation.'; end if;
  insert into public.messages(reservation_id,sender_id,body) values(claim.id,uid,trim(p_body));
  perform public.notify(case when uid=donor then claim.recipient_id else donor end,claim.donation_id,'You have a new pickup message.');
end $$;
create function public.publish_post(p_kind text,p_title text,p_body text,p_area text) returns uuid language plpgsql security definer set search_path='' as $$
declare uid uuid := public.guard_action(); result uuid;
begin
  insert into public.community_posts(author_id,kind,title,body,area) values(uid,p_kind,trim(p_title),trim(p_body),trim(p_area)) returning id into result;
  return result;
end $$;
create function public.report_content(p_type text,p_target uuid,p_reason text) returns void language plpgsql security definer set search_path='' as $$
declare uid uuid := public.guard_action();
begin
  if not ((p_type='donation' and exists(select 1 from public.donations where id=p_target)) or (p_type='post' and exists(select 1 from public.community_posts where id=p_target)) or (p_type='user' and exists(select 1 from public.profiles where id=p_target))) then raise exception 'Content not found.'; end if;
  insert into public.reports(reporter_id,target_type,target_id,reason) values(uid,p_type,p_target,trim(p_reason));
end $$;
create function public.set_block(p_user uuid,p_blocked boolean) returns void language plpgsql security definer set search_path='' as $$
declare uid uuid := public.guard_action();
begin
  if p_blocked then insert into public.blocks values(uid,p_user) on conflict do nothing;
  else delete from public.blocks where blocker_id=uid and blocked_id=p_user; end if;
end $$;
create function public.mark_notifications_read() returns void language plpgsql security definer set search_path='' as $$
declare uid uuid := public.guard_action();
begin update public.notifications set read_at=now() where user_id=uid and read_at is null; end $$;

-- Private bucket; uploads are only accepted through the authenticated image processor.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('food-photos','food-photos',false,5242880,array['image/png']);
create policy food_photo_read on storage.objects for select to authenticated using (
  bucket_id='food-photos' and (split_part(name,'/',1)=auth.uid()::text or exists(select 1 from public.donations d where d.photo_path=name and public.can_read_donation(d.id)))
);

-- Owner-only maintenance. Schedule daily using pg_cron in the hosted project.
create function public.purge_retained_data() returns void language plpgsql security definer set search_path='' as $$
begin
  update public.reservations r set status='cancelled',closed_at=d.pickup_deadline from public.donations d where r.donation_id=d.id and r.status='reserved' and d.pickup_deadline<now()-interval '1 day';
  update public.donations set status='cancelled',closed_at=pickup_deadline where status='reserved' and pickup_deadline<now()-interval '1 day';
  delete from public.messages m using public.reservations r where m.reservation_id=r.id and r.closed_at<now()-interval '30 days';
  delete from public.pickup_details p using public.donations d where p.donation_id=d.id and coalesce(d.closed_at,d.pickup_deadline)<now()-interval '30 days';
  delete from public.reservations where status='cancelled' and closed_at<now()-interval '90 days';
  delete from public.donations where coalesce(closed_at,pickup_deadline)<now()-interval '90 days';
  delete from public.community_posts where created_at<now()-interval '90 days';
  delete from public.notifications where created_at<now()-interval '30 days';
  delete from public.reports where created_at<now()-interval '90 days';
  delete from public.action_events where created_at<now()-interval '1 day';
end $$;

revoke all on all tables in schema public from anon,authenticated;
grant usage on schema public to authenticated;
grant usage on schema public to service_role;
grant select on public.donations to service_role;
grant select on public.donations,public.pickup_details,public.reservations,public.messages,public.community_posts,public.blocks,public.reports,public.notifications to authenticated;
-- Notification preferences are private even though display names are visible to members.
grant select(id,display_name,account_type,organisation_name,verified) on public.profiles to authenticated;
create function public.my_profile() returns public.profiles language sql stable security definer set search_path='' as $$ select * from public.profiles where id=auth.uid(); $$;
revoke all on all functions in schema public from public,anon,authenticated;
grant execute on function public.is_blocked(uuid),public.is_participant(uuid),public.can_read_donation(uuid),public.my_profile(),public.guard_action() to authenticated;
grant execute on function public.save_profile(text,text,text,boolean),public.publish_donation(jsonb),public.reserve_donation(uuid),public.cancel_reservation(uuid),public.confirm_collection(uuid),public.cancel_donation(uuid),public.send_message(uuid,text),public.publish_post(text,text,text,text),public.report_content(text,uuid,text),public.set_block(uuid,boolean),public.mark_notifications_read() to authenticated;
grant execute on function public.purge_retained_data() to service_role;
commit;
