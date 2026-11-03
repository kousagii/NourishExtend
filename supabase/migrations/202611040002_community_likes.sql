-- Private like membership, authenticated aggregate counts, and idempotent writes.
begin;
create table public.community_likes (
 post_id uuid not null references public.community_posts on delete cascade,
 user_id uuid not null references public.profiles on delete cascade,
 created_at timestamptz not null default now(),
 primary key (post_id,user_id)
);
create index community_likes_user on public.community_likes(user_id);
alter table public.community_likes enable row level security;
create policy likes_read_own on public.community_likes for select to authenticated using (
 user_id=auth.uid() and exists(select 1 from public.community_posts p where p.id=post_id and not p.hidden and not public.is_blocked(p.author_id))
);
revoke all on public.community_likes from public,anon,authenticated;
grant select on public.community_likes to authenticated;

create function public.community_post_activity(p_posts uuid[]) returns table(post_id uuid,like_count bigint,comment_count bigint,liked boolean)
language plpgsql stable security definer set search_path='' as $$
declare uid uuid:=public.actor();
begin
 if p_posts is null or cardinality(p_posts)>20 then raise exception 'Choose up to 20 posts.';end if;
 return query select p.id,
  (select count(*) from public.community_likes l where l.post_id=p.id and not public.is_blocked(l.user_id)),
  (select count(*) from public.community_comments c where c.post_id=p.id and not c.hidden and not public.is_blocked(c.author_id)),
  exists(select 1 from public.community_likes l where l.post_id=p.id and l.user_id=uid)
 from public.community_posts p where p.id=any(p_posts) and not p.hidden and not public.is_blocked(p.author_id);
end $$;

create function public.set_post_like(p_post uuid,p_liked boolean) returns boolean
language plpgsql security definer set search_path='' as $$
declare uid uuid:=public.guard_action(); item public.community_posts;
begin
 if p_liked is null then raise exception 'Choose like or unlike.';end if;
 select * into item from public.community_posts where id=p_post for share;
 if item.id is null or item.hidden or public.is_blocked(item.author_id) then raise exception 'This post is unavailable.';end if;
 if p_liked then
  insert into public.community_likes(post_id,user_id) values(item.id,uid) on conflict do nothing;
 else
  delete from public.community_likes where post_id=item.id and user_id=uid;
 end if;
 return p_liked;
end $$;
revoke all on function public.community_post_activity(uuid[]),public.set_post_like(uuid,boolean) from public,anon,authenticated;
grant execute on function public.community_post_activity(uuid[]),public.set_post_like(uuid,boolean) to authenticated;
commit;
