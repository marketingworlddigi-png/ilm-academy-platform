-- Migration 1: identity, tenancy, helper functions.
-- Target: the dedicated "education-platform" Supabase project ONLY.
-- Non-destructive: creates new objects only (no DROP / TRUNCATE / DELETE of existing data).

create type public.membership_role as enum ('academy_owner', 'academy_admin', 'instructor', 'student');
create type public.membership_status as enum ('pending', 'active', 'suspended', 'removed');
create type public.academy_status as enum ('pending', 'needs_info', 'active', 'rejected', 'suspended');

create function public.touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

-- ---------------------------------------------------------------- profiles
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  preferred_locale text not null default 'en-pk' check (preferred_locale in ('en-pk', 'ur-pk', 'ar')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger profiles_touch before update on public.profiles for each row execute function public.touch_updated_at();

create function public.handle_new_user() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, full_name) values (new.id, new.raw_user_meta_data ->> 'full_name') on conflict do nothing;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- Platform-level administrators. Rows are created only by a database owner / service role (no RLS write policy).
create table public.platform_admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- academies
create table public.academies (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]([a-z0-9-]{1,38})[a-z0-9]$'),
  name text not null check (char_length(name) between 2 and 120),
  description text,
  status public.academy_status not null default 'pending',
  owner_id uuid not null references auth.users (id),
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index academies_status_idx on public.academies (status) where deleted_at is null;
create trigger academies_touch before update on public.academies for each row execute function public.touch_updated_at();

create table public.memberships (
  id uuid primary key default gen_random_uuid(),
  academy_id uuid not null references public.academies (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.membership_role not null,
  status public.membership_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (academy_id, user_id, role)
);
create index memberships_user_idx on public.memberships (user_id);
create trigger memberships_touch before update on public.memberships for each row execute function public.touch_updated_at();

-- ------------------------------------------------------------------ helpers
-- SECURITY DEFINER so policies can consult memberships without recursive RLS.
create function public.is_super_admin() returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.platform_admins where user_id = auth.uid());
$$;

create function public.has_academy_role(p_academy uuid, p_roles public.membership_role[]) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.memberships m
    where m.academy_id = p_academy and m.user_id = auth.uid() and m.status = 'active' and m.role = any (p_roles)
  );
$$;

create function public.is_academy_staff(p_academy uuid) returns boolean language sql stable security definer set search_path = '' as $$
  select public.has_academy_role(p_academy, array['academy_owner', 'academy_admin']::public.membership_role[]);
$$;

-- ------------------------------------------------------------- guard trigger
-- Only super admins may change academy approval status or ownership. Backend roles (no JWT subject) are exempt.
create function public.academies_guard() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is not null and not public.is_super_admin() then
    if new.status is distinct from old.status or new.owner_id is distinct from old.owner_id then
      raise exception 'Only a platform administrator can change academy status or owner' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;
create trigger academies_guard_trg before update on public.academies for each row execute function public.academies_guard();

-- Academy registration: the only way a normal user can create an academy (always starts as pending).
create function public.register_academy(p_name text, p_slug text) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  insert into public.academies (name, slug, owner_id, status) values (p_name, p_slug, auth.uid(), 'pending') returning id into v_id;
  insert into public.memberships (academy_id, user_id, role, status) values (v_id, auth.uid(), 'academy_owner', 'active');
  return v_id;
end $$;
revoke all on function public.register_academy(text, text) from public, anon;
grant execute on function public.register_academy(text, text) to authenticated;

-- ---------------------------------------------------------------------- RLS
alter table public.profiles enable row level security;
alter table public.platform_admins enable row level security;
alter table public.academies enable row level security;
alter table public.memberships enable row level security;

create policy profiles_select on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_super_admin());
create policy profiles_update_own on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

create policy platform_admins_select on public.platform_admins for select to authenticated using (public.is_super_admin());

create policy academies_select on public.academies for select to anon, authenticated
  using (
    deleted_at is null and (status = 'active' or public.is_super_admin() or public.is_academy_staff(id)
      or public.has_academy_role(id, array['instructor', 'student']::public.membership_role[]))
  );
create policy academies_update on public.academies for update to authenticated
  using (public.is_super_admin() or public.is_academy_staff(id))
  with check (public.is_super_admin() or public.is_academy_staff(id));
create policy academies_admin_delete on public.academies for delete to authenticated using (public.is_super_admin());
-- No INSERT policy: academies are created through register_academy().

create policy memberships_select on public.memberships for select to authenticated
  using (user_id = auth.uid() or public.is_super_admin() or public.is_academy_staff(academy_id));
-- Staff manage non-owner memberships in their own academy; only owners/super admins touch owner rows.
create policy memberships_insert on public.memberships for insert to authenticated
  with check (
    public.is_super_admin()
    or (public.is_academy_staff(academy_id) and role <> 'academy_owner'
        and (role <> 'academy_admin' or public.has_academy_role(academy_id, array['academy_owner']::public.membership_role[])))
  );
create policy memberships_update on public.memberships for update to authenticated
  using (public.is_super_admin() or (public.is_academy_staff(academy_id) and role <> 'academy_owner'))
  with check (public.is_super_admin() or (public.is_academy_staff(academy_id) and role <> 'academy_owner'
        and (role <> 'academy_admin' or public.has_academy_role(academy_id, array['academy_owner']::public.membership_role[]))));
create policy memberships_delete on public.memberships for delete to authenticated
  using (public.is_super_admin() or (public.is_academy_staff(academy_id) and role <> 'academy_owner'));

-- Least privilege: anonymous visitors only read public academy rows.
revoke all on public.profiles, public.platform_admins, public.memberships from anon;
revoke insert, delete on public.academies from anon, authenticated;
revoke insert on public.academies from authenticated;
grant delete on public.academies to authenticated; -- gated by academies_admin_delete (super admin only)
revoke all on public.academies from anon;
grant select on public.academies to anon;
