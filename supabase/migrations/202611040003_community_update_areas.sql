-- Updates are community-wide; food requests still require validated local areas.
-- Keep historical post locations without rewriting existing records.
begin;
create or replace function public.publish_located_post(p_kind text,p_title text,p_body text,p_locations text[]) returns uuid language plpgsql security definer set search_path='' as $$
declare result uuid; codes text[]; summary text;
begin
 if p_kind='update' then
  -- Ignore stale selections from a client that switches post type.
  result:=public.publish_post(p_kind,p_title,p_body,'Community-wide');
  return result;
 end if;
 select array_agg(distinct c order by c) into codes from unnest(p_locations) c;
 if coalesce(cardinality(codes),0) not between 1 and 20 or exists(select 1 from unnest(codes) c where c is null or not exists(select 1 from public.locations l where l.code=c)) then
  raise exception 'Choose 1–20 cities or municipalities from the list.';
 end if;
 select left(string_agg(name,', ' order by name),120) into summary from public.locations where code=any(codes);
 result:=public.publish_post(p_kind,p_title,p_body,summary);
 update public.community_posts set location_codes=codes where id=result;
 return result;
end $$;
commit;
