-- Migration 12: courses (slice 1). An academy's staff author courses made of modules and lessons; signed-in users enroll for
-- free; paid courses come later with academy-scoped selling. Additive only: no DROP, no data deleted.
--
-- Visibility rules, all enforced here and not in the UI:
--   * A course (and its module titles) is public only while it is published AND its academy is active.
--   * Lesson content is readable by: staff of that academy, super admins, enrolled users, and anyone for lessons marked preview.
--   * The lesson titles of a public course are public through course_outline() so the syllabus can be shown without the content.
--   * Enrollments are written only by enroll_in_course / leave_course; clients have SELECT only.

create type public.course_status as enum ('draft', 'published', 'archived');
create type public.enrollment_status as enum ('active', 'withdrawn', 'removed');

create table public.courses (
  id uuid primary key default gen_random_uuid(),
  academy_id uuid not null references public.academies (id) on delete restrict,
  slug text not null check (slug ~ '^[a-z0-9]([a-z0-9-]{1,58})[a-z0-9]$'),
  title text not null check (char_length(title) between 3 and 160),
  summary text check (summary is null or char_length(summary) <= 300),
  description text check (description is null or char_length(description) <= 5000),
  status public.course_status not null default 'draft',
  published_at timestamptz,
  deleted_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (academy_id, slug)
);
create index courses_public_idx on public.courses (status) where deleted_at is null;
create trigger courses_touch before update on public.courses for each row execute function public.touch_updated_at();

create table public.course_modules (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses (id) on delete restrict,
  title text not null check (char_length(title) between 2 and 160),
  position int not null default 0 check (position >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index course_modules_course_idx on public.course_modules (course_id, position);
create trigger course_modules_touch before update on public.course_modules for each row execute function public.touch_updated_at();

create table public.lessons (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses (id) on delete restrict,
  module_id uuid not null references public.course_modules (id) on delete restrict,
  title text not null check (char_length(title) between 2 and 160),
  body text check (body is null or char_length(body) <= 20000), -- plain text; the site never renders it as HTML
  resource_id uuid references public.resources (id) on delete set null, -- optional library book; access is still decided by can_access_resource
  is_preview boolean not null default false,
  position int not null default 0 check (position >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index lessons_course_idx on public.lessons (course_id, module_id, position);
create trigger lessons_touch before update on public.lessons for each row execute function public.touch_updated_at();

create table public.enrollments (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses (id) on delete restrict,
  user_id uuid not null references auth.users (id) on delete cascade,
  status public.enrollment_status not null default 'active',
  enrolled_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (course_id, user_id)
);
create index enrollments_user_idx on public.enrollments (user_id, status);
create trigger enrollments_touch before update on public.enrollments for each row execute function public.touch_updated_at();

-- ------------------------------------------------------------------ helpers
create function public.course_is_public(p_course uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.courses c join public.academies a on a.id = c.academy_id
    where c.id = p_course and c.status = 'published' and c.deleted_at is null and a.status = 'active' and a.deleted_at is null);
$$;

create function public.is_enrolled(p_course uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and public.course_is_public(p_course) and exists (
    select 1 from public.enrollments e where e.course_id = p_course and e.user_id = auth.uid() and e.status = 'active');
$$;

create function public.course_academy(p_course uuid) returns uuid
language sql stable security definer set search_path = '' as $$ select academy_id from public.courses where id = p_course; $$;

revoke all on function public.course_is_public(uuid), public.is_enrolled(uuid), public.course_academy(uuid) from public;
grant execute on function public.course_is_public(uuid), public.is_enrolled(uuid), public.course_academy(uuid) to anon, authenticated;

-- ------------------------------------------------------------------ integrity triggers
create function public.courses_guard() returns trigger language plpgsql security definer set search_path = '' as $$
declare v_active boolean;
begin
  if tg_op = 'INSERT' then
    if new.status <> 'draft' then raise exception 'A new course starts as a draft' using errcode = '22023'; end if;
    return new;
  end if;
  if new.academy_id is distinct from old.academy_id then raise exception 'A course cannot move to another academy' using errcode = '42501'; end if;
  if new.slug is distinct from old.slug and old.status = 'published' then raise exception 'Unpublish the course before changing its web address' using errcode = '22023'; end if;
  if new.status = 'published' and old.status is distinct from 'published' then
    select (status = 'active' and deleted_at is null) into v_active from public.academies where id = new.academy_id;
    if not coalesce(v_active, false) then raise exception 'The academy must be approved before a course can be published' using errcode = '22023'; end if;
    if not exists (select 1 from public.lessons where course_id = new.id) then raise exception 'Add at least one lesson before publishing' using errcode = '22023'; end if;
    new.published_at := coalesce(new.published_at, now());
  end if;
  if new.status is distinct from old.status then
    insert into public.audit_logs (actor_id, action, entity_type, entity_id, details)
    values (auth.uid(), 'course.' || new.status::text, 'course', new.id::text, jsonb_build_object('academy_id', new.academy_id, 'slug', new.slug, 'from', old.status));
  end if;
  return new;
end $$;
create trigger courses_guard_trg before insert or update on public.courses for each row execute function public.courses_guard();

create function public.course_modules_guard() returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'UPDATE' and new.course_id is distinct from old.course_id then raise exception 'A module cannot move to another course' using errcode = '42501'; end if;
  return new;
end $$;
create trigger course_modules_guard_trg before update on public.course_modules for each row execute function public.course_modules_guard();

create function public.lessons_guard() returns trigger language plpgsql security definer set search_path = '' as $$
declare v_academy uuid; v_res_academy uuid; v_res_found boolean;
begin
  if tg_op = 'UPDATE' and (new.course_id is distinct from old.course_id or new.module_id is distinct from old.module_id) then
    raise exception 'A lesson cannot move to another module' using errcode = '42501';
  end if;
  if not exists (select 1 from public.course_modules m where m.id = new.module_id and m.course_id = new.course_id) then
    raise exception 'The module does not belong to this course' using errcode = '22023';
  end if;
  if new.resource_id is not null then
    select academy_id into v_academy from public.courses where id = new.course_id;
    select true, academy_id into v_res_found, v_res_academy from public.resources where id = new.resource_id and deleted_at is null;
    -- A lesson may link a platform book or one of the same academy's books, never another academy's.
    if not coalesce(v_res_found, false) or (v_res_academy is not null and v_res_academy is distinct from v_academy) then
      raise exception 'That book cannot be linked from this course' using errcode = '22023';
    end if;
  end if;
  return new;
end $$;
create trigger lessons_guard_trg before insert or update on public.lessons for each row execute function public.lessons_guard();

-- A published course must keep at least one lesson.
create function public.lessons_keep_one() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from public.courses c where c.id = old.course_id and c.status = 'published')
     and not exists (select 1 from public.lessons l where l.course_id = old.course_id and l.id <> old.id) then
    raise exception 'A published course needs at least one lesson; unpublish it first' using errcode = '55000';
  end if;
  return old;
end $$;
create trigger lessons_keep_one_trg before delete on public.lessons for each row execute function public.lessons_keep_one();

-- ------------------------------------------------------------------ RLS
alter table public.courses enable row level security;
alter table public.course_modules enable row level security;
alter table public.lessons enable row level security;
alter table public.enrollments enable row level security;

create policy courses_read on public.courses for select to anon, authenticated
  using (public.course_is_public(id) or public.is_super_admin() or public.is_academy_staff(academy_id));
create policy courses_insert on public.courses for insert to authenticated
  with check (public.is_academy_staff(academy_id) and created_by = auth.uid());
create policy courses_update on public.courses for update to authenticated
  using (public.is_academy_staff(academy_id)) with check (public.is_academy_staff(academy_id));

create policy modules_read on public.course_modules for select to anon, authenticated
  using (public.course_is_public(course_id) or public.is_super_admin() or public.is_academy_staff(public.course_academy(course_id)));
create policy modules_write on public.course_modules for all to authenticated
  using (public.is_academy_staff(public.course_academy(course_id))) with check (public.is_academy_staff(public.course_academy(course_id)));

create policy lessons_read on public.lessons for select to anon, authenticated
  using (public.is_super_admin() or public.is_academy_staff(public.course_academy(course_id))
         or (public.course_is_public(course_id) and (is_preview or public.is_enrolled(course_id))));
create policy lessons_write on public.lessons for all to authenticated
  using (public.is_academy_staff(public.course_academy(course_id))) with check (public.is_academy_staff(public.course_academy(course_id)));

create policy enrollments_read on public.enrollments for select to authenticated
  using (user_id = auth.uid() or public.is_super_admin() or public.is_academy_staff(public.course_academy(course_id)));

revoke all on public.courses, public.course_modules, public.lessons, public.enrollments from anon, authenticated;
grant select on public.courses, public.course_modules, public.lessons to anon;
grant select, insert, update on public.courses to authenticated;
grant select, insert, update, delete on public.course_modules, public.lessons to authenticated;
grant select on public.courses, public.course_modules, public.lessons, public.enrollments to authenticated;

-- ------------------------------------------------------------------ outline and enrollment
-- The syllabus of a public course: titles only, no lesson content.
create function public.course_outline(p_course uuid)
returns table (lesson_id uuid, module_id uuid, title text, is_preview boolean, lesson_position int)
language sql stable security definer set search_path = '' as $$
  select l.id, l.module_id, l.title, l.is_preview, l.position
  from public.lessons l
  where l.course_id = p_course and public.course_is_public(p_course)
  order by l.position, l.created_at;
$$;
revoke all on function public.course_outline(uuid) from public;
grant execute on function public.course_outline(uuid) to anon, authenticated;

create function public.enroll_in_course(p_course uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare e public.enrollments%rowtype;
begin
  if auth.uid() is null then raise exception 'Sign in to enroll' using errcode = '28000'; end if;
  if not public.course_is_public(p_course) then raise exception 'Course not found' using errcode = 'P0002'; end if;
  select * into e from public.enrollments where course_id = p_course and user_id = auth.uid() for update;
  if found then
    if e.status = 'removed' then raise exception 'You cannot enroll in this course. Contact the academy.' using errcode = '42501'; end if;
    if e.status = 'withdrawn' then update public.enrollments set status = 'active' where id = e.id; end if;
    return e.id;
  end if;
  insert into public.enrollments (course_id, user_id) values (p_course, auth.uid()) returning id into e.id;
  return e.id;
end $$;

create function public.leave_course(p_course uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Sign in first' using errcode = '28000'; end if;
  update public.enrollments set status = 'withdrawn' where course_id = p_course and user_id = auth.uid() and status = 'active';
end $$;

revoke execute on function public.enroll_in_course(uuid), public.leave_course(uuid) from public, anon;
grant execute on function public.enroll_in_course(uuid), public.leave_course(uuid) to authenticated;
