-- Migration 6: resource admin support.

-- 1. Cover image (object name inside the public bucket "covers-public": <resource_id>/<file>).
alter table public.resources add column cover_path text;

-- 2. Replacing an upload needs an UPDATE policy (the upload API upserts). Same rules as the insert policies.
create policy evidence_update on storage.objects for update to authenticated
  using (bucket_id = 'copyright-evidence' and public.can_access_resource(((storage.foldername(name))[1])::uuid, 'review'));
create policy covers_update on storage.objects for update to authenticated
  using (bucket_id = 'covers-public' and public.is_super_admin());

-- 3. A published resource is only publicly LISTED while its distribution permission is approved and unexpired.
--    Takedowns (removed / rejected / restricted / expired status) and time-based expiry therefore delist it
--    automatically, with no job to run. Staff and super admins still see it.
create function public.resource_permission_valid(p_resource uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.copyright_permissions p
    where p.resource_id = p_resource and p.permission_status = 'approved' and (p.expires_at is null or p.expires_at > now())
  );
$$;
grant execute on function public.resource_permission_valid(uuid) to anon, authenticated;

drop policy resources_read on public.resources;
create policy resources_read on public.resources for select to anon, authenticated
  using (
    deleted_at is null and (
      public.is_super_admin()
      or (academy_id is not null and public.is_academy_staff(academy_id))
      or (
        status = 'published'
        and public.resource_permission_valid(id)
        and (academy_id is null or exists (select 1 from public.academies a where a.id = academy_id and a.status = 'active'))
      )
    )
  );

-- 4. Soft delete. A plain UPDATE setting deleted_at is rejected because the new row no longer passes the
--    SELECT policy, so deletion goes through this function. Returns true if a row was deleted.
create function public.soft_delete_resource(p_resource uuid) returns boolean
language plpgsql security definer set search_path = '' as $$
declare v_academy uuid; v_found boolean;
begin
  select academy_id, true into v_academy, v_found from public.resources where id = p_resource and deleted_at is null;
  if not coalesce(v_found, false) then return false; end if;
  if not (public.is_super_admin() or (v_academy is not null and public.is_academy_staff(v_academy))) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  update public.resources set deleted_at = now(), status = 'archived' where id = p_resource;
  return true;
end $$;
revoke execute on function public.soft_delete_resource(uuid) from public, anon;
grant execute on function public.soft_delete_resource(uuid) to authenticated;
