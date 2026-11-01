-- Migration 2: configurable catalog (boards / levels / subjects), library resources, copyright permissions.
-- Non-destructive: new objects only.

create type public.content_status as enum ('draft', 'in_review', 'published', 'archived');
create type public.access_tier as enum ('free', 'premium', 'academy');
create type public.resource_kind as enum ('book', 'note', 'pdf', 'document', 'audio', 'other');
create type public.license_type as enum (
  'original_work', 'explicit_permission', 'public_domain', 'open_license', 'commercial_license', 'unknown'
);
create type public.permission_status as enum (
  'not_reviewed', 'pending_verification', 'permission_requested', 'approved', 'rejected', 'expired', 'restricted', 'removed'
);

-- ------------------------------------------------- catalog (admin-managed, never hardcoded)
create table public.boards (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name_en text not null, name_ur text, name_ar text,
  description text,
  status public.content_status not null default 'draft',
  sort_order int not null default 0,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.levels (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references public.boards (id) on delete restrict,
  slug text not null,
  name_en text not null, name_ur text, name_ar text,
  sort_order int not null default 0,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (board_id, slug)
);
create table public.subjects (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name_en text not null, name_ur text, name_ar text,
  status public.content_status not null default 'draft',
  sort_order int not null default 0,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.level_subjects (
  level_id uuid not null references public.levels (id) on delete cascade,
  subject_id uuid not null references public.subjects (id) on delete cascade,
  primary key (level_id, subject_id)
);
create index levels_board_idx on public.levels (board_id);

-- ------------------------------------------------------------------- resources
-- A resource is one servable item (PDF, note, ...). academy_id NULL = platform-owned.
create table public.resources (
  id uuid primary key default gen_random_uuid(),
  academy_id uuid references public.academies (id) on delete restrict,
  kind public.resource_kind not null default 'pdf',
  title text not null,
  title_ur text, title_ar text,
  author text, publisher text, edition text, language text,
  publication_year int check (publication_year between 600 and 2200),
  description text,
  board_id uuid references public.boards (id),
  level_id uuid references public.levels (id),
  subject_id uuid references public.subjects (id),
  access_tier public.access_tier not null default 'premium',
  status public.content_status not null default 'draft',
  storage_path text, -- object name inside bucket "resources-private": <resource_id>/<file>
  created_by uuid references auth.users (id),
  deleted_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index resources_academy_idx on public.resources (academy_id);
create index resources_catalog_idx on public.resources (board_id, level_id, subject_id) where deleted_at is null;
create trigger resources_touch before update on public.resources for each row execute function public.touch_updated_at();

-- ----------------------------------------------------- copyright / distribution permission
-- Exactly one row per resource. Defaults are the most restrictive state.
create table public.copyright_permissions (
  resource_id uuid primary key references public.resources (id) on delete cascade,
  copyright_owner text,
  original_source text,
  publication_year int,
  license_type public.license_type not null default 'unknown',
  permission_status public.permission_status not null default 'not_reviewed',
  evidence_reference text,
  evidence_file_path text, -- object name in private bucket "copyright-evidence"
  verified_at timestamptz,
  verified_by uuid references auth.users (id),
  allow_online_view boolean not null default false,
  allow_download boolean not null default false,
  allow_commercial boolean not null default false,
  attribution_text text,
  expires_at timestamptz,
  restrictions text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  -- An approved record must carry evidence and a verifier.
  constraint approved_needs_verification check (
    permission_status <> 'approved'
    or (verified_by is not null and verified_at is not null and (evidence_reference is not null or evidence_file_path is not null))
  ),
  -- Any grant flag requires an approved record.
  constraint grants_need_approval check (
    permission_status = 'approved' or not (allow_online_view or allow_download or allow_commercial)
  )
);
create trigger copyright_touch before update on public.copyright_permissions for each row execute function public.touch_updated_at();

-- Every resource gets a restrictive permission row automatically.
create function public.resources_create_permission() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.copyright_permissions (resource_id) values (new.id);
  return new;
end $$;
create trigger resources_after_insert after insert on public.resources for each row execute function public.resources_create_permission();

-- Leaving "approved" (expired / removed / restricted / rejected ...) automatically switches every grant off.
create function public.copyright_clear_grants() returns trigger language plpgsql as $$
begin
  if new.permission_status <> 'approved' then
    new.allow_online_view := false; new.allow_download := false; new.allow_commercial := false;
  end if;
  return new;
end $$;
create trigger copyright_a_clear_grants before insert or update on public.copyright_permissions
  for each row execute function public.copyright_clear_grants();

-- Only super admins may verify/approve or change grant flags. Academy staff may supply evidence details and request review.
create function public.copyright_guard() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or public.is_super_admin() then
    if public.is_super_admin() and new.permission_status = 'approved'
       and (tg_op = 'INSERT' or old.permission_status is distinct from 'approved') then
      new.verified_by := auth.uid();
      new.verified_at := now();
    end if;
    return new;
  end if;
  if new.permission_status not in ('not_reviewed', 'pending_verification', 'permission_requested')
     and new.permission_status is distinct from old.permission_status then
    raise exception 'Only a platform administrator can set permission status to %', new.permission_status using errcode = '42501';
  end if;
  if new.allow_online_view is distinct from old.allow_online_view
     or new.allow_download is distinct from old.allow_download
     or new.allow_commercial is distinct from old.allow_commercial
     or new.verified_by is distinct from old.verified_by
     or new.verified_at is distinct from old.verified_at
     or new.expires_at is distinct from old.expires_at then
    raise exception 'Only a platform administrator can change distribution grants' using errcode = '42501';
  end if;
  -- Editing evidence on an already-approved record invalidates the approval until re-verified.
  if old.permission_status = 'approved' and (
       new.copyright_owner is distinct from old.copyright_owner or new.license_type is distinct from old.license_type
       or new.evidence_reference is distinct from old.evidence_reference or new.evidence_file_path is distinct from old.evidence_file_path) then
    raise exception 'Approved permission records can only be modified by a platform administrator' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger copyright_guard_trg before update on public.copyright_permissions for each row execute function public.copyright_guard();

-- Publishing guard: a resource cannot be published without an approved, unexpired permission.
create function public.resources_publish_guard() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.status = 'published' and (tg_op = 'INSERT' or old.status is distinct from 'published') then
    if not exists (
      select 1 from public.copyright_permissions p
      where p.resource_id = new.id and p.permission_status = 'approved' and (p.expires_at is null or p.expires_at > now())
    ) then
      raise exception 'Cannot publish: distribution permission is not approved' using errcode = '23514';
    end if;
  end if;
  return new;
end $$;
create trigger resources_publish_guard_trg before update on public.resources for each row execute function public.resources_publish_guard();

-- Only a super admin may move an expiring/revoked permission back; here we just expose the single source of truth for legality.
create function public.resource_legally_allows(p_resource uuid, p_purpose text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.copyright_permissions p
    join public.resources r on r.id = p.resource_id
    where p.resource_id = p_resource
      and p.permission_status = 'approved'
      and (p.expires_at is null or p.expires_at > now())
      and case p_purpose
            when 'view' then p.allow_online_view
            when 'download' then p.allow_download and p.allow_online_view
            else false
          end
      -- Paid distribution needs explicit commercial permission; premium access never overrides copyright.
      and (r.access_tier = 'free' or p.allow_commercial)
  );
$$;

-- ------------------------------------------------------------------------ RLS
alter table public.boards enable row level security;
alter table public.levels enable row level security;
alter table public.subjects enable row level security;
alter table public.level_subjects enable row level security;
alter table public.resources enable row level security;
alter table public.copyright_permissions enable row level security;

create policy boards_read on public.boards for select to anon, authenticated using (status = 'published' or public.is_super_admin());
create policy boards_write on public.boards for all to authenticated using (public.is_super_admin()) with check (public.is_super_admin());
create policy levels_read on public.levels for select to anon, authenticated
  using (public.is_super_admin() or exists (select 1 from public.boards b where b.id = board_id and b.status = 'published'));
create policy levels_write on public.levels for all to authenticated using (public.is_super_admin()) with check (public.is_super_admin());
create policy subjects_read on public.subjects for select to anon, authenticated using (status = 'published' or public.is_super_admin());
create policy subjects_write on public.subjects for all to authenticated using (public.is_super_admin()) with check (public.is_super_admin());
create policy level_subjects_read on public.level_subjects for select to anon, authenticated using (true);
create policy level_subjects_write on public.level_subjects for all to authenticated using (public.is_super_admin()) with check (public.is_super_admin());

-- Resource METADATA (title, cover info) is visible when published; file bytes are protected separately (migration 4).
create policy resources_read on public.resources for select to anon, authenticated
  using (
    deleted_at is null and (
      public.is_super_admin()
      or (academy_id is not null and public.is_academy_staff(academy_id))
      or (status = 'published' and (academy_id is null or exists (select 1 from public.academies a where a.id = academy_id and a.status = 'active')))
    )
  );
create policy resources_insert on public.resources for insert to authenticated
  with check (public.is_super_admin() or (academy_id is not null and public.is_academy_staff(academy_id)));
create policy resources_update on public.resources for update to authenticated
  using (public.is_super_admin() or (academy_id is not null and public.is_academy_staff(academy_id)))
  with check (public.is_super_admin() or (academy_id is not null and public.is_academy_staff(academy_id)));

-- Permission records are internal: super admins and the owning academy's staff only.
create policy copyright_read on public.copyright_permissions for select to authenticated
  using (public.is_super_admin() or exists (
    select 1 from public.resources r where r.id = resource_id and r.academy_id is not null and public.is_academy_staff(r.academy_id)));
create policy copyright_update on public.copyright_permissions for update to authenticated
  using (public.is_super_admin() or exists (
    select 1 from public.resources r where r.id = resource_id and r.academy_id is not null and public.is_academy_staff(r.academy_id)))
  with check (public.is_super_admin() or exists (
    select 1 from public.resources r where r.id = resource_id and r.academy_id is not null and public.is_academy_staff(r.academy_id)));

revoke all on public.copyright_permissions from anon;
revoke insert, delete on public.copyright_permissions from authenticated; -- rows are created by trigger only
revoke delete on public.resources from anon, authenticated; -- soft delete via deleted_at
revoke insert, update, delete on public.resources, public.boards, public.levels, public.subjects, public.level_subjects from anon;
