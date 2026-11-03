-- Additive update. Apply after 202610310001_core.sql; existing area text is preserved.
begin;
create table public.locations (
  code text primary key check(code ~ '^[0-9]{10}$'),
  name text not null,
  province text not null,
  region text not null,
  kind text not null check(kind in ('City','Municipality'))
);
alter table public.locations enable row level security;
create policy locations_read on public.locations for select to authenticated using(true);
revoke all on public.locations from public,anon,authenticated;
grant select on public.locations to authenticated;
alter table public.donations add column location_code text references public.locations(code);
alter table public.community_posts add column location_codes text[] not null default '{}';
create index donations_location on public.donations(location_code,status,pickup_deadline);
create index posts_locations on public.community_posts using gin(location_codes);

create function public.publish_located_donation(p_data jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare place public.locations; result uuid; neighbourhood text:=trim(coalesce(p_data->>'neighbourhood',''));
begin
  select * into place from public.locations where code=p_data->>'location_code';
  if place.code is null then raise exception 'Choose a city or municipality from the list.'; end if;
  if length(neighbourhood)>60 then raise exception 'Keep the neighbourhood within 60 characters.'; end if;
  result:=public.publish_donation(p_data || jsonb_build_object('area',left(concat_ws(', ',nullif(neighbourhood,''),place.name,coalesce(nullif(place.province,''),place.region)),120)));
  update public.donations set location_code=place.code where id=result;
  return result;
end $$;
create function public.publish_located_post(p_kind text,p_title text,p_body text,p_locations text[]) returns uuid language plpgsql security definer set search_path='' as $$
declare result uuid; codes text[]; summary text;
begin
  select array_agg(distinct c order by c) into codes from unnest(p_locations) c;
  if coalesce(cardinality(codes),0) not between 1 and 20 or exists(select 1 from unnest(codes) c where c is null or not exists(select 1 from public.locations l where l.code=c)) then
    raise exception 'Choose 1–20 cities or municipalities from the list.';
  end if;
  select left(string_agg(name,', ' order by name),120) into summary from public.locations where code=any(codes);
  result:=public.publish_post(p_kind,p_title,p_body,summary);
  update public.community_posts set location_codes=codes where id=result;
  return result;
end $$;

create table public.inquiries (
  id uuid primary key default gen_random_uuid(),
  donation_id uuid not null references public.donations on delete cascade,
  donor_id uuid not null references public.profiles on delete cascade,
  inquirer_id uuid not null references public.profiles on delete cascade,
  donation_title text not null,
  last_message_at timestamptz not null default now(),
  donor_read_at timestamptz,
  inquirer_read_at timestamptz,
  unique(donation_id,inquirer_id), check(donor_id<>inquirer_id)
);
create index inquiries_donor on public.inquiries(donor_id,last_message_at);
create index inquiries_inquirer on public.inquiries(inquirer_id,last_message_at);
create table public.inquiry_messages (
  id uuid primary key default gen_random_uuid(),
  inquiry_id uuid not null references public.inquiries on delete cascade,
  sender_id uuid not null references public.profiles on delete cascade,
  body text not null check(length(trim(body)) between 1 and 1500),
  created_at timestamptz not null default now()
);
create index inquiry_messages_thread on public.inquiry_messages(inquiry_id,created_at,id);
alter table public.notifications add column inquiry_id uuid references public.inquiries on delete cascade;
alter table public.inquiries enable row level security;
alter table public.inquiry_messages enable row level security;
create function public.inquiry_participant(p_inquiry uuid) returns boolean language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.inquiries where id=p_inquiry and auth.uid() in (donor_id,inquirer_id));
$$;
create policy inquiries_read on public.inquiries for select to authenticated using(auth.uid() in (donor_id,inquirer_id));
create policy inquiry_messages_read on public.inquiry_messages for select to authenticated using(public.inquiry_participant(inquiry_id));
revoke all on public.inquiries,public.inquiry_messages from public,anon,authenticated;
grant select on public.inquiries,public.inquiry_messages to authenticated;

-- One conversation per person/listing. Creating a conversation always includes a real message.
create function public.send_inquiry(p_donation uuid,p_body text,p_inquiry uuid default null) returns uuid language plpgsql security definer set search_path='' as $$
declare uid uuid:=public.guard_action(); item public.donations; thread public.inquiries; target uuid;
begin
  if p_body is null or length(trim(p_body)) not between 1 and 1500 then raise exception 'Enter a message of 1–1500 characters.'; end if;
  select * into item from public.donations where id=p_donation for update;
  if item.id is null or item.status<>'available' or item.pickup_deadline<=now() then raise exception 'This listing is no longer accepting inquiries.'; end if;
  if p_inquiry is null then
    if uid=item.donor_id or public.is_blocked(item.donor_id) then raise exception 'Messaging is unavailable.'; end if;
    insert into public.inquiries(donation_id,donor_id,inquirer_id,donation_title)
      values(item.id,item.donor_id,uid,item.title) on conflict(donation_id,inquirer_id) do nothing;
    select * into thread from public.inquiries where donation_id=item.id and inquirer_id=uid for update;
  else
    select * into thread from public.inquiries where id=p_inquiry and donation_id=item.id for update;
  end if;
  if thread.id is null or uid not in (thread.donor_id,thread.inquirer_id) then raise exception 'Messaging is unavailable.'; end if;
  target:=case when uid=thread.donor_id then thread.inquirer_id else thread.donor_id end;
  if public.is_blocked(target) then raise exception 'Messaging is unavailable.'; end if;
  insert into public.inquiry_messages(inquiry_id,sender_id,body) values(thread.id,uid,trim(p_body));
  update public.inquiries set last_message_at=now(),donor_read_at=case when uid=donor_id then now() else donor_read_at end,
    inquirer_read_at=case when uid=inquirer_id then now() else inquirer_read_at end where id=thread.id;
  insert into public.notifications(user_id,donation_id,inquiry_id,body)
    select target,item.id,thread.id,'New message about a food donation. Open Messages to reply.'
    where exists(select 1 from public.profiles where id=target and notifications_enabled);
  return thread.id;
end $$;
create function public.read_inquiry(p_inquiry uuid,p_through timestamptz default now()) returns void language plpgsql security definer set search_path='' as $$
declare uid uuid:=public.actor();
begin
  update public.inquiries set donor_read_at=case when uid=donor_id then greatest(donor_read_at,least(p_through,now())) else donor_read_at end,
    inquirer_read_at=case when uid=inquirer_id then greatest(inquirer_read_at,least(p_through,now())) else inquirer_read_at end
    where id=p_inquiry and uid in (donor_id,inquirer_id);
  update public.notifications set read_at=now() where user_id=uid and inquiry_id=p_inquiry and read_at is null and created_at<=p_through;
end $$;
revoke all on function public.publish_located_donation(jsonb),public.publish_located_post(text,text,text,text[]),public.inquiry_participant(uuid),public.send_inquiry(uuid,text,uuid),public.read_inquiry(uuid,timestamptz) from public,anon,authenticated;
grant execute on function public.publish_located_donation(jsonb),public.publish_located_post(text,text,text,text[]),public.inquiry_participant(uuid),public.send_inquiry(uuid,text,uuid),public.read_inquiry(uuid,timestamptz) to authenticated;

-- Reuse the original retention rules and add inquiry cleanup, without scheduling a job.
alter function public.purge_retained_data() rename to purge_core_retained_data;
create function public.purge_retained_data() returns void language plpgsql security definer set search_path='' as $$
begin
  delete from public.inquiries i using public.donations d where i.donation_id=d.id and
    (i.last_message_at<now()-interval '30 days' or coalesce(d.closed_at,d.pickup_deadline)<now()-interval '30 days');
  perform public.purge_core_retained_data();
end $$;
revoke all on function public.purge_core_retained_data(),public.purge_retained_data() from public,anon,authenticated,service_role;
grant execute on function public.purge_retained_data() to service_role;
commit;
