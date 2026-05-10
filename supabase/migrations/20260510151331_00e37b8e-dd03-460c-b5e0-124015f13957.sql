
drop policy if exists "Public can view menu images" on storage.objects;

revoke execute on function public.has_role(uuid, public.app_role) from anon, authenticated, public;
