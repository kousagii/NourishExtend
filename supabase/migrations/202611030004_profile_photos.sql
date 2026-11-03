begin;
alter table public.profiles add column bio text not null default '' check(length(bio)<=240);
alter table public.profiles add column avatar_path text;
grant select(bio,avatar_path) on public.profiles to authenticated;
grant select(avatar_path) on public.profiles to service_role;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 values('profile-photos','profile-photos',false,1572864,array['image/png']);
create policy profile_photo_read on storage.objects for select to authenticated using(
 bucket_id='profile-photos' and (split_part(name,'/',1)=auth.uid()::text or
 exists(select 1 from public.profiles p where p.avatar_path=name and not public.is_blocked(p.id)))
);
create function public.save_profile_details(p_name text,p_type text,p_organisation text,p_bio text,p_avatar text) returns void language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); notifications boolean;
begin
 select notifications_enabled into notifications from public.profiles where id=uid;
 perform public.save_profile(p_name,p_type,p_organisation,notifications);
 if length(coalesce(p_bio,''))>240 then raise exception 'Keep your bio within 240 characters.';end if;
 if p_avatar is not null and not exists(select 1 from storage.objects where bucket_id='profile-photos' and name=p_avatar and split_part(name,'/',1)=uid::text) then raise exception 'Choose your own uploaded profile photo.';end if;
 update public.profiles set bio=trim(coalesce(p_bio,'')),avatar_path=p_avatar where id=uid;
end $$;
revoke all on function public.save_profile_details(text,text,text,text,text) from public,anon,authenticated;
grant execute on function public.save_profile_details(text,text,text,text,text) to authenticated;
commit;
