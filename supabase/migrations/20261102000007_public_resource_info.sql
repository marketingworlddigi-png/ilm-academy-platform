-- Migration 7: what a public book page may show about its distribution permission.
-- copyright_permissions itself is not readable by visitors (it holds evidence and internal notes), so this
-- function exposes only the attribution line, licence and the two reading grants, and only for a listed resource.
create function public.public_resource_info(p_resource uuid)
returns table (attribution_text text, license_type public.license_type, allow_online_view boolean, allow_download boolean)
language sql stable security definer set search_path = '' as $$
  select p.attribution_text, p.license_type, p.allow_online_view, p.allow_download
  from public.copyright_permissions p
  join public.resources r on r.id = p.resource_id
  where p.resource_id = p_resource
    and r.status = 'published' and r.deleted_at is null
    and public.resource_permission_valid(p_resource)
    and (r.academy_id is null or exists (select 1 from public.academies a where a.id = r.academy_id and a.status = 'active'));
$$;
revoke execute on function public.public_resource_info(uuid) from public;
grant execute on function public.public_resource_info(uuid) to anon, authenticated;
