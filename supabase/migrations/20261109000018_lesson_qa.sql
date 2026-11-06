-- Migration 18: questions and answers on lessons. Additive: new tables and functions, no DROP.
--
-- Who can do what:
--   * Read: anyone who can open the lesson (enrolled, or a free-preview lesson), plus the academy's teachers and super admins.
--   * Ask / answer: enrolled learners and the academy's teachers. Short plain text only, rate limited.
--   * Hide / unhide: the academy's teachers and super admins. Hidden posts disappear for learners; teachers still see them.
-- Clients never write the tables. Everything goes through the four functions below. Names are a first-name snapshot taken at
-- posting time, so profiles stay private.

create table public.lesson_questions (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.lessons (id) on delete cascade,
  course_id uuid not null references public.courses (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  author_name text not null check (char_length(author_name) between 1 and 40),
  body text not null check (char_length(body) between 3 and 1000),
  hidden_at timestamptz,
  created_at timestamptz not null default now()
);
create index lesson_questions_lesson_idx on public.lesson_questions (lesson_id, created_at desc);

create table public.lesson_answers (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.lesson_questions (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  author_name text not null check (char_length(author_name) between 1 and 40),
  is_teacher boolean not null default false,
  body text not null check (char_length(body) between 2 and 2000),
  hidden_at timestamptz,
  created_at timestamptz not null default now()
);
create index lesson_answers_question_idx on public.lesson_answers (question_id, created_at);

alter table public.lesson_questions enable row level security;
alter table public.lesson_answers enable row level security;
-- Teachers and super admins may read the raw tables; everyone else reads through lesson_qa().
create policy lesson_questions_staff_read on public.lesson_questions for select to authenticated
  using (public.is_super_admin() or public.is_academy_teacher(public.course_academy(course_id)));
create policy lesson_answers_staff_read on public.lesson_answers for select to authenticated
  using (public.is_super_admin() or exists (select 1 from public.lesson_questions q where q.id = question_id and public.is_academy_teacher(public.course_academy(q.course_id))));
revoke all on public.lesson_questions, public.lesson_answers from anon, authenticated;
grant select on public.lesson_questions, public.lesson_answers to authenticated;

create function public.qa_author_name(p_user uuid) returns text
language sql stable security definer set search_path = '' as $$
  select coalesce(nullif(left(split_part(btrim(coalesce((select full_name from public.profiles where id = p_user), '')), ' ', 1), 40), ''), 'Learner');
$$;
revoke all on function public.qa_author_name(uuid) from public;

-- ------------------------------------------------------------------ read
create function public.lesson_qa(p_lesson uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_course uuid; v_mod boolean; v_post boolean;
begin
  if auth.uid() is null then return null; end if;
  select course_id into v_course from public.lessons where id = p_lesson;
  if v_course is null then return null; end if;
  v_mod := public.is_super_admin() or public.is_academy_teacher(public.course_academy(v_course));
  if not v_mod and not public.can_learn_lesson(p_lesson) then return null; end if;
  v_post := v_mod or public.is_enrolled(v_course);
  return jsonb_build_object('can_post', v_post, 'can_moderate', v_mod, 'items', coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', q.id, 'author', q.author_name, 'body', q.body, 'created_at', q.created_at, 'hidden', q.hidden_at is not null, 'mine', q.user_id = auth.uid(),
      'answers', coalesce((
        select jsonb_agg(jsonb_build_object('id', a.id, 'author', a.author_name, 'teacher', a.is_teacher, 'body', a.body,
                                            'created_at', a.created_at, 'hidden', a.hidden_at is not null, 'mine', a.user_id = auth.uid()) order by a.created_at)
        from public.lesson_answers a where a.question_id = q.id and (v_mod or a.hidden_at is null)), '[]'::jsonb)
    ) order by q.created_at desc)
    from (select * from public.lesson_questions where lesson_id = p_lesson and (v_mod or hidden_at is null) order by created_at desc limit 100) q), '[]'::jsonb));
end $$;

-- ------------------------------------------------------------------ write
create function public.ask_question(p_lesson uuid, p_body text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_course uuid; v_body text := btrim(coalesce(p_body, '')); v_id uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  select course_id into v_course from public.lessons where id = p_lesson;
  if v_course is null or not (public.is_enrolled(v_course) or public.is_academy_teacher(public.course_academy(v_course))) then
    raise exception 'Enroll in this course to ask a question' using errcode = '42501';
  end if;
  if char_length(v_body) < 3 then raise exception 'Write your question (at least 3 characters)' using errcode = '22023'; end if;
  if char_length(v_body) > 1000 then raise exception 'Keep the question under 1000 characters' using errcode = '22023'; end if;
  if (select count(*) from public.lesson_questions where user_id = auth.uid() and created_at > now() - interval '1 day') >= 10 then
    raise exception 'You have asked a lot of questions today. Try again tomorrow.' using errcode = '54000';
  end if;
  insert into public.lesson_questions (lesson_id, course_id, user_id, author_name, body)
  values (p_lesson, v_course, auth.uid(), public.qa_author_name(auth.uid()), v_body) returning id into v_id;
  return v_id;
end $$;

create function public.post_answer(p_question uuid, p_body text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare q public.lesson_questions%rowtype; v_body text := btrim(coalesce(p_body, '')); v_teacher boolean; v_id uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  select * into q from public.lesson_questions where id = p_question;
  if not found then raise exception 'Question not found' using errcode = 'P0002'; end if;
  v_teacher := public.is_academy_teacher(public.course_academy(q.course_id));
  if not (v_teacher or public.is_enrolled(q.course_id)) then raise exception 'Enroll in this course to answer' using errcode = '42501'; end if;
  if q.hidden_at is not null and not v_teacher then raise exception 'Question not found' using errcode = 'P0002'; end if;
  if char_length(v_body) < 2 then raise exception 'Write your answer' using errcode = '22023'; end if;
  if char_length(v_body) > 2000 then raise exception 'Keep the answer under 2000 characters' using errcode = '22023'; end if;
  if (select count(*) from public.lesson_answers where user_id = auth.uid() and created_at > now() - interval '1 day') >= 30 then
    raise exception 'You have posted a lot of answers today. Try again tomorrow.' using errcode = '54000';
  end if;
  insert into public.lesson_answers (question_id, user_id, author_name, is_teacher, body)
  values (p_question, auth.uid(), public.qa_author_name(auth.uid()), v_teacher, v_body) returning id into v_id;
  return v_id;
end $$;

-- p_kind is 'question' or 'answer'. Teachers of the academy and super admins only. Audited.
create function public.set_qa_hidden(p_kind text, p_id uuid, p_hidden boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare v_course uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  if p_kind = 'question' then
    select course_id into v_course from public.lesson_questions where id = p_id;
  elsif p_kind = 'answer' then
    select q.course_id into v_course from public.lesson_answers a join public.lesson_questions q on q.id = a.question_id where a.id = p_id;
  else
    raise exception 'Choose question or answer' using errcode = '22023';
  end if;
  if v_course is null or not (public.is_super_admin() or public.is_academy_teacher(public.course_academy(v_course))) then
    raise exception 'Not found' using errcode = 'P0002';
  end if;
  if p_kind = 'question' then
    update public.lesson_questions set hidden_at = case when p_hidden then coalesce(hidden_at, now()) else null end where id = p_id;
  else
    update public.lesson_answers set hidden_at = case when p_hidden then coalesce(hidden_at, now()) else null end where id = p_id;
  end if;
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, details)
  values (auth.uid(), case when p_hidden then 'qa.hidden' else 'qa.unhidden' end, 'lesson_' || p_kind, p_id::text, jsonb_build_object('course_id', v_course));
end $$;

revoke execute on function public.lesson_qa(uuid), public.ask_question(uuid, text), public.post_answer(uuid, text), public.set_qa_hidden(text, uuid, boolean) from public, anon;
grant execute on function public.lesson_qa(uuid), public.ask_question(uuid, text), public.post_answer(uuid, text), public.set_qa_hidden(text, uuid, boolean) to authenticated;
