-- Migration 19: assignments. One optional assignment per lesson; learners hand in short text; teachers mark it.
-- Additive: new tables and functions, no DROP.
--
-- Who can do what:
--   * Write the assignment: the academy's teachers (owner, admin, instructor) through row-level security.
--   * Hand in: enrolled learners, through submit_assignment(). One submission each; it can be replaced until it is marked.
--   * Mark: the academy's teachers and super admins, through grade_submission(). Audited.
--   * Read a submission: its author, and the academy's teachers. Teachers list them with names through list_submissions().

create table public.assignments (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null unique references public.lessons (id) on delete cascade,
  title text not null check (char_length(title) between 2 and 160),
  instructions text not null check (char_length(instructions) between 2 and 4000),
  max_points integer not null default 100 check (max_points between 1 and 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger assignments_touch before update on public.assignments for each row execute function public.touch_updated_at();

create table public.assignment_submissions (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.assignments (id) on delete cascade,
  course_id uuid not null references public.courses (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  body text not null check (char_length(body) between 2 and 5000),
  submitted_at timestamptz not null default now(),
  score integer check (score is null or score >= 0),
  feedback text check (feedback is null or char_length(feedback) <= 2000),
  graded_by uuid references auth.users (id) on delete set null,
  graded_at timestamptz,
  unique (assignment_id, user_id)
);
create index assignment_submissions_assignment_idx on public.assignment_submissions (assignment_id, submitted_at desc);

create function public.assignment_academy(p_assignment uuid) returns uuid
language sql stable security definer set search_path = '' as $$
  select public.lesson_academy(a.lesson_id) from public.assignments a where a.id = p_assignment;
$$;
revoke all on function public.assignment_academy(uuid) from public;
grant execute on function public.assignment_academy(uuid) to authenticated;

alter table public.assignments enable row level security;
alter table public.assignment_submissions enable row level security;

create policy assignments_staff on public.assignments for all to authenticated
  using (public.is_super_admin() or public.is_academy_teacher(public.lesson_academy(lesson_id)))
  with check (public.is_academy_teacher(public.lesson_academy(lesson_id)));
create policy assignment_submissions_read on public.assignment_submissions for select to authenticated
  using (user_id = auth.uid() or public.is_super_admin() or public.is_academy_teacher(public.course_academy(course_id)));

revoke all on public.assignments, public.assignment_submissions from anon, authenticated;
grant select, insert, update, delete on public.assignments to authenticated;
grant select on public.assignment_submissions to authenticated; -- written only by the functions below

-- ------------------------------------------------------------------ learner functions
-- The assignment for a lesson with the caller's own submission. Null when there is none or the caller cannot open the lesson.
create function public.get_assignment(p_lesson uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare a public.assignments%rowtype; s public.assignment_submissions%rowtype;
begin
  if auth.uid() is null or not public.can_learn_lesson(p_lesson) then return null; end if;
  select * into a from public.assignments where lesson_id = p_lesson;
  if not found then return null; end if;
  select * into s from public.assignment_submissions where assignment_id = a.id and user_id = auth.uid();
  return jsonb_build_object('id', a.id, 'title', a.title, 'instructions', a.instructions, 'max_points', a.max_points,
    'can_submit', public.is_enrolled((select course_id from public.lessons where id = p_lesson)),
    'submission', case when s.id is null then null else jsonb_build_object(
      'body', s.body, 'submitted_at', s.submitted_at, 'score', s.score, 'feedback', s.feedback, 'graded_at', s.graded_at) end);
end $$;

create function public.submit_assignment(p_assignment uuid, p_body text) returns void
language plpgsql security definer set search_path = '' as $$
declare a public.assignments%rowtype; v_course uuid; v_body text := btrim(coalesce(p_body, '')); v_graded timestamptz;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  select * into a from public.assignments where id = p_assignment;
  if not found then raise exception 'Assignment not found' using errcode = 'P0002'; end if;
  select course_id into v_course from public.lessons where id = a.lesson_id;
  if not public.is_enrolled(v_course) then raise exception 'Enroll in this course to hand in work' using errcode = '42501'; end if;
  if char_length(v_body) < 2 then raise exception 'Write your answer first' using errcode = '22023'; end if;
  if char_length(v_body) > 5000 then raise exception 'Keep your answer under 5000 characters' using errcode = '22023'; end if;
  select graded_at into v_graded from public.assignment_submissions where assignment_id = p_assignment and user_id = auth.uid();
  if v_graded is not null then raise exception 'This work has been marked and can no longer be changed' using errcode = '42501'; end if;
  insert into public.assignment_submissions (assignment_id, course_id, user_id, body)
  values (p_assignment, v_course, auth.uid(), v_body)
  on conflict (assignment_id, user_id) do update set body = excluded.body, submitted_at = now();
end $$;

-- ------------------------------------------------------------------ teacher functions
create function public.list_submissions(p_assignment uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_academy uuid := public.assignment_academy(p_assignment);
begin
  if auth.uid() is null or v_academy is null or not (public.is_super_admin() or public.is_academy_teacher(v_academy)) then return null; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id', s.id, 'author', public.qa_author_name(s.user_id), 'body', s.body,
      'submitted_at', s.submitted_at, 'score', s.score, 'feedback', s.feedback, 'graded_at', s.graded_at) order by s.graded_at is not null, s.submitted_at)
    from public.assignment_submissions s where s.assignment_id = p_assignment), '[]'::jsonb);
end $$;

create function public.grade_submission(p_submission uuid, p_score integer, p_feedback text) returns void
language plpgsql security definer set search_path = '' as $$
declare s public.assignment_submissions%rowtype; a public.assignments%rowtype; v_fb text := nullif(btrim(coalesce(p_feedback, '')), '');
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  select * into s from public.assignment_submissions where id = p_submission;
  if not found or not (public.is_super_admin() or public.is_academy_teacher(public.course_academy(s.course_id))) then
    raise exception 'Not found' using errcode = 'P0002';
  end if;
  select * into a from public.assignments where id = s.assignment_id;
  if p_score is null or p_score < 0 or p_score > a.max_points then
    raise exception 'Score must be between 0 and %', a.max_points using errcode = '22023';
  end if;
  if v_fb is not null and char_length(v_fb) > 2000 then raise exception 'Keep feedback under 2000 characters' using errcode = '22023'; end if;
  update public.assignment_submissions set score = p_score, feedback = v_fb, graded_by = auth.uid(), graded_at = now() where id = p_submission;
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, details)
  values (auth.uid(), 'assignment.graded', 'assignment_submission', p_submission::text, jsonb_build_object('course_id', s.course_id, 'score', p_score));
end $$;

revoke execute on function public.get_assignment(uuid), public.submit_assignment(uuid, text), public.list_submissions(uuid), public.grade_submission(uuid, integer, text) from public, anon;
grant execute on function public.get_assignment(uuid), public.submit_assignment(uuid, text), public.list_submissions(uuid), public.grade_submission(uuid, integer, text) to authenticated;
