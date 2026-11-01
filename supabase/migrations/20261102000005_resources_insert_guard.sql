-- SECURITY FIX: resources_publish_guard_trg only fires BEFORE UPDATE, and a resource's permission row is created
-- AFTER INSERT. An academy could therefore INSERT a resource with status = 'published' and have it listed publicly
-- without any approved distribution permission.
--
-- A brand-new resource can never have an approved permission yet, so academy staff may only insert drafts.
-- Super admins and the backend (no JWT, e.g. service role / migrations) may insert other statuses, matching
-- the convention used by copyright_guard.
create function public.resources_insert_guard() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.status <> 'draft' and auth.uid() is not null and not public.is_super_admin() then
    raise exception 'New resources must be created as drafts; publishing requires an approved distribution permission'
      using errcode = '42501';
  end if;
  return new;
end $$;

create trigger resources_insert_guard_trg before insert on public.resources
  for each row execute function public.resources_insert_guard();
