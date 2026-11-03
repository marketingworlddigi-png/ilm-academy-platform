-- Migration 15: teachers (membership role 'instructor') can work on their own academy's course content, invitations to
-- join an academy, and per-lesson learning progress. Additive: new tables and functions; four course-content policies are
-- replaced (DROP POLICY / CREATE POLICY, no data touched).
--
-- A teacher may create and edit modules and lessons and read the roster of their own academy's courses. A teacher may not
-- create, publish, archive or delete courses, change academy settings, or touch any other academy. Course status and the
-- academy itself stay with the owner and admins.

-- ------------------------------------------------------------------ helpers
create function public.is_academy_teacher(p_academy uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.has_academy_role(p_academy, array['academy_owner', 'academy_admin', 'instructor']::public.membership_role[]);
$$;
revoke all on function public.is_academy_teacher(uuid) from public;
grant execute on function public.is_academy_teacher(uuid) to anon, authenticated;

-- ------------------------------------------------------------------ course content: teachers join the staff
drop policy modules_read on public.course_modules;
create policy modules_read on public.course_modules for select to anon, authenticated
  using (public.course_is_public(course_id) or public.is_super_admin() or public.is_academy_teacher(public.course_academy(course_id)));
drop policy modules_write on public.course_modules;
create policy modules_write on public.course_modules for all to authenticated
  using (public.is_academy_teacher(public.course_academy(course_id))) with check (public.is_academy_teacher(public.course_academy(course_id)));

drop policy lessons_read on public.lessons;
create policy lessons_read on public.lessons for select to anon, authenticated
  using (public.is_super_admin() or public.is_academy_teacher(public.course_academy(course_id))
         or (public.course_is_public(course_id) and (is_preview or public.is_enrolled(course_id))));
drop policy lessons_write on public.lessons;
create policy lessons_write on public.lessons for all to authenticated
  using (public.is_academy_teacher(public.course_academy(course_id))) with check (public.is_academy_teacher(public.course_academy(course_id)));

-- Teachers see the draft courses they work on (the roster below too); they still cannot change a course row.
drop policy courses_read on public.courses;
create policy courses_read on public.courses for select to anon, authenticated
  using (public.course_is_public(id) or public.is_super_admin() or public.is_academy_teacher(academy_id));
drop policy enrollments_read on public.enrollments;
create policy enrollments_read on public.enrollments for select to authenticated
  using (user_id = auth.uid() or public.is_super_admin() or public.is_academy_teacher(public.course_academy(course_id)));

-- ------------------------------------------------------------------ invitations
-- The raw link token is returned once by invite_to_academy and never stored: only its SHA-256 is kept.
create type public.invite_status as enum ('pending', 'accepted', 'revoked');
create table public.academy_invites (
  id uuid primary key default gen_random_uuid(),
  academy_id uuid not null references public.academies (id) on delete cascade,
  email text not null check (email = lower(email) and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' and char_length(email) <= 254),
  role public.membership_role not null check (role in ('instructor', 'academy_admin')),
  token_hash text not null unique,
  status public.invite_status not null default 'pending',
  invited_by uuid not null references auth.users (id) on delete cascade,
  accepted_by uuid references auth.users (id) on delete set null,
  expires_at timestamptz not null default (now() + interval '14 days'),
  created_at timestamptz not null default now(),
  accepted_at timestamptz
);
create unique index academy_invites_open_uniq on public.academy_invites (academy_id, email, role) where status = 'pending';
alter table public.academy_invites enable row level security;
create policy invites_read on public.academy_invites for select to authenticated
  using (public.is_super_admin() or public.is_academy_staff(academy_id));
revoke all on public.academy_invites from anon, authenticated;
grant select on public.academy_invites to authenticated; -- the hash is useless without the token; writes only through functions

create function public.invite_to_academy(p_academy uuid, p_email text, p_role public.membership_role) returns text
language plpgsql security definer set search_path = '' as $$
declare v_email text := lower(trim(coalesce(p_email, ''))); v_token text; v_id uuid;
begin
  if auth.uid() is null then raise exception 'Sign in first' using errcode = '28000'; end if;
  if p_role not in ('instructor', 'academy_admin') then raise exception 'Invite someone as a teacher or an admin' using errcode = '22023'; end if;
  -- Admins may invite teachers; only the owner (or a platform admin) may invite another admin.
  if not (public.is_super_admin() or (public.is_academy_staff(p_academy)
          and (p_role = 'instructor' or public.has_academy_role(p_academy, array['academy_owner']::public.membership_role[])))) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or char_length(v_email) > 254 then raise exception 'Enter a valid email address' using errcode = '22023'; end if;
  update public.academy_invites set status = 'revoked'
    where academy_id = p_academy and email = v_email and role = p_role and status = 'pending';
  v_token := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
  insert into public.academy_invites (academy_id, email, role, token_hash, invited_by)
  values (p_academy, v_email, p_role, encode(sha256(convert_to(v_token, 'UTF8')), 'hex'), auth.uid()) returning id into v_id;
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, details)
  values (auth.uid(), 'academy.invited', 'academy', p_academy::text, jsonb_build_object('invite_id', v_id, 'email', v_email, 'role', p_role));
  return v_token;
end $$;

create function public.revoke_invite(p_invite uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare i public.academy_invites%rowtype;
begin
  select * into i from public.academy_invites where id = p_invite for update;
  if not found or not (public.is_super_admin() or public.is_academy_staff(i.academy_id)) then raise exception 'Invitation not found' using errcode = 'P0002'; end if;
  update public.academy_invites set status = 'revoked' where id = p_invite and status = 'pending';
end $$;

-- Whoever holds the single-use link joins with the invited role. Emails are not sent by the platform yet; the inviter shares the link.
create function public.accept_invite(p_token text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare i public.academy_invites%rowtype; v_active boolean;
begin
  if auth.uid() is null then raise exception 'Sign in to accept' using errcode = '28000'; end if;
  select * into i from public.academy_invites where token_hash = encode(sha256(convert_to(coalesce(p_token, ''), 'UTF8')), 'hex') for update;
  if not found or i.status <> 'pending' or i.expires_at < now() then
    raise exception 'This invitation is not valid any more. Ask the academy for a new one.' using errcode = 'P0002';
  end if;
  select (status = 'active' and deleted_at is null) into v_active from public.academies where id = i.academy_id;
  if not coalesce(v_active, false) then raise exception 'This academy is not open yet' using errcode = '55000'; end if;
  insert into public.memberships (academy_id, user_id, role, status) values (i.academy_id, auth.uid(), i.role, 'active')
    on conflict (academy_id, user_id, role) do update set status = 'active';
  update public.academy_invites set status = 'accepted', accepted_by = auth.uid(), accepted_at = now() where id = i.id;
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, details)
  values (auth.uid(), 'academy.invite_accepted', 'academy', i.academy_id::text, jsonb_build_object('invite_id', i.id, 'role', i.role));
  return i.academy_id;
end $$;

revoke execute on function public.invite_to_academy(uuid, text, public.membership_role), public.revoke_invite(uuid), public.accept_invite(text) from public, anon;
grant execute on function public.invite_to_academy(uuid, text, public.membership_role), public.revoke_invite(uuid), public.accept_invite(text) to authenticated;

-- ------------------------------------------------------------------ lesson progress
create table public.lesson_progress (
  user_id uuid not null references auth.users (id) on delete cascade,
  lesson_id uuid not null references public.lessons (id) on delete cascade,
  course_id uuid not null references public.courses (id) on delete cascade,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  last_position_seconds integer not null default 0 check (last_position_seconds between 0 and 86400),
  updated_at timestamptz not null default now(),
  primary key (user_id, lesson_id)
);
create index lesson_progress_course_idx on public.lesson_progress (course_id, user_id);
alter table public.lesson_progress enable row level security;
create policy lesson_progress_read on public.lesson_progress for select to authenticated
  using (user_id = auth.uid() or public.is_super_admin() or public.is_academy_teacher(public.course_academy(course_id)));
revoke all on public.lesson_progress from anon, authenticated;
grant select on public.lesson_progress to authenticated; -- writes only through the functions below

-- Progress counts only for people who can actually open the lesson: enrolled, or previewing a preview lesson.
create function public.can_learn_lesson(p_lesson uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and exists (
    select 1 from public.lessons l
    where l.id = p_lesson and public.course_is_public(l.course_id) and (public.is_enrolled(l.course_id) or l.is_preview));
$$;
revoke all on function public.can_learn_lesson(uuid) from public;
grant execute on function public.can_learn_lesson(uuid) to authenticated;

-- Opens a lesson (first call records the start) and remembers where the learner is in a video.
create function public.record_lesson_position(p_lesson uuid, p_seconds integer default 0) returns void
language plpgsql security definer set search_path = '' as $$
declare v_course uuid;
begin
  if not public.can_learn_lesson(p_lesson) then raise exception 'Lesson not found' using errcode = 'P0002'; end if;
  select course_id into v_course from public.lessons where id = p_lesson;
  insert into public.lesson_progress (user_id, lesson_id, course_id, last_position_seconds)
  values (auth.uid(), p_lesson, v_course, greatest(0, least(coalesce(p_seconds, 0), 86400)))
  on conflict (user_id, lesson_id) do update
    set last_position_seconds = excluded.last_position_seconds, updated_at = now();
end $$;

-- Marks the lesson complete (idempotent) and returns the next lesson in the course, or null at the end.
create function public.complete_lesson(p_lesson uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_course uuid; v_next uuid;
begin
  if not public.can_learn_lesson(p_lesson) then raise exception 'Lesson not found' using errcode = 'P0002'; end if;
  select course_id into v_course from public.lessons where id = p_lesson;
  insert into public.lesson_progress (user_id, lesson_id, course_id, completed_at)
  values (auth.uid(), p_lesson, v_course, now())
  on conflict (user_id, lesson_id) do update set completed_at = coalesce(public.lesson_progress.completed_at, now()), updated_at = now();
  select l.id into v_next
  from public.lessons l
  join public.course_modules m on m.id = l.module_id
  join public.course_modules cur on cur.id = (select module_id from public.lessons where id = p_lesson)
  join public.lessons me on me.id = p_lesson
  where l.course_id = v_course and l.id <> p_lesson
    and (m.position, l.position, l.created_at, l.id) > (cur.position, me.position, me.created_at, me.id)
  order by m.position, l.position, l.created_at, l.id limit 1;
  return v_next;
end $$;

-- Course percentage for the signed-in learner. Only lessons the learner can open count, so a preview-only visitor sees 0 of N.
create function public.course_progress(p_course uuid)
returns table (total_lessons integer, completed_lessons integer, percent integer)
language plpgsql stable security definer set search_path = '' as $$
declare v_total integer; v_done integer;
begin
  if auth.uid() is null then raise exception 'Sign in first' using errcode = '28000'; end if;
  select count(*) into v_total from public.lessons where course_id = p_course and public.course_is_public(p_course);
  select count(*) into v_done from public.lesson_progress lp join public.lessons l on l.id = lp.lesson_id
    where lp.user_id = auth.uid() and lp.course_id = p_course and lp.completed_at is not null;
  return query select v_total, v_done, case when v_total = 0 then 0 else (100 * v_done / v_total) end;
end $$;

revoke execute on function public.record_lesson_position(uuid, integer), public.complete_lesson(uuid), public.course_progress(uuid) from public, anon;
grant execute on function public.record_lesson_position(uuid, integer), public.complete_lesson(uuid), public.course_progress(uuid) to authenticated;
