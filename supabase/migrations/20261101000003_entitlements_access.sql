-- Migration 3: entitlement engine and the single server-side access decision for resources.
-- Non-destructive: new objects only.

create type public.entitlement_scope as enum ('platform', 'academy', 'resource');
create type public.entitlement_source as enum (
  'subscription', 'purchase', 'bundle', 'lifetime', 'trial', 'sponsored', 'scholarship', 'promotion', 'manual_grant'
);

create table public.entitlements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  scope public.entitlement_scope not null,
  scope_id uuid, -- academy id or resource id; NULL for platform-wide
  source public.entitlement_source not null,
  starts_at timestamptz not null default now(),
  expires_at timestamptz, -- NULL = lifetime
  revoked_at timestamptz,
  granted_by uuid references auth.users (id),
  note text,
  created_at timestamptz not null default now(),
  constraint scope_id_matches check ((scope = 'platform') = (scope_id is null)),
  constraint window_valid check (expires_at is null or expires_at > starts_at)
);
create index entitlements_lookup_idx on public.entitlements (user_id, scope, scope_id);

create function public.has_entitlement(p_user uuid, p_scope public.entitlement_scope, p_scope_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.entitlements e
    where e.user_id = p_user and e.scope = p_scope and e.scope_id is not distinct from p_scope_id
      and e.revoked_at is null and e.starts_at <= now() and (e.expires_at is null or e.expires_at > now())
  );
$$;

-- The one decision function. Storage policies and server code both call it.
-- purpose: 'view' | 'download' | 'review' (review = staff verifying a file before approval; no entitlement needed).
create function public.can_access_resource(p_resource uuid, p_purpose text) returns boolean
language plpgsql stable security definer set search_path = '' as $$
declare
  r public.resources%rowtype;
  v_uid uuid := auth.uid();
  v_academy_active boolean := true;
begin
  select * into r from public.resources where id = p_resource and deleted_at is null;
  if not found then return false; end if;

  if p_purpose = 'review' then
    return v_uid is not null and (public.is_super_admin() or (r.academy_id is not null and public.is_academy_staff(r.academy_id)));
  end if;
  if p_purpose not in ('view', 'download') then return false; end if;

  if r.status <> 'published' then return false; end if;
  if r.academy_id is not null then
    select (a.status = 'active' and a.deleted_at is null) into v_academy_active from public.academies a where a.id = r.academy_id;
    if not coalesce(v_academy_active, false) then return false; end if;
  end if;

  -- Legal gate first: no tier or purchase can override it.
  if not public.resource_legally_allows(p_resource, p_purpose) then return false; end if;

  -- Every file requires a signed-in account (free accounts included).
  if v_uid is null then return false; end if;

  case r.access_tier
    when 'free' then return true;
    when 'premium' then
      return public.has_entitlement(v_uid, 'platform', null)
          or public.has_entitlement(v_uid, 'resource', r.id)
          or (r.academy_id is not null and public.has_entitlement(v_uid, 'academy', r.academy_id));
    when 'academy' then
      return r.academy_id is not null and (
        public.has_academy_role(r.academy_id, array['academy_owner','academy_admin','instructor','student']::public.membership_role[])
        or public.has_entitlement(v_uid, 'academy', r.academy_id));
  end case;
  return false;
end $$;
revoke all on function public.can_access_resource(uuid, text) from public;
grant execute on function public.can_access_resource(uuid, text) to anon, authenticated;

-- ------------------------------------------------------------------------ RLS
alter table public.entitlements enable row level security;
create policy entitlements_select on public.entitlements for select to authenticated
  using (user_id = auth.uid() or public.is_super_admin()
         or (scope = 'academy' and public.is_academy_staff(scope_id)));
-- Entitlements are written only by server code (approve_payment etc.) via the service role, or super admins.
create policy entitlements_admin_write on public.entitlements for all to authenticated
  using (public.is_super_admin()) with check (public.is_super_admin());
revoke all on public.entitlements from anon;
