-- Migration 17: quizzes. One optional quiz per lesson; single-choice questions; scored in the database.
-- Additive: new tables and functions, no DROP, nothing existing changes.
--
-- Security model: the answer key (quiz_options.is_correct) is readable only by the academy's teachers and super admins.
-- Learners never select from the quiz tables. They read a quiz through get_quiz(), which leaves out is_correct, and they
-- submit through submit_quiz_attempt(), which scores on the server and only then reveals the right answers.

create table public.quizzes (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null unique references public.lessons (id) on delete cascade,
  title text not null check (char_length(title) between 2 and 160),
  pass_percent integer not null default 70 check (pass_percent between 1 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger quizzes_touch before update on public.quizzes for each row execute function public.touch_updated_at();

create table public.quiz_questions (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references public.quizzes (id) on delete cascade,
  prompt text not null check (char_length(prompt) between 2 and 500),
  explanation text check (explanation is null or char_length(explanation) <= 500),
  position integer not null default 0 check (position >= 0),
  created_at timestamptz not null default now()
);
create index quiz_questions_quiz_idx on public.quiz_questions (quiz_id, position);

create table public.quiz_options (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.quiz_questions (id) on delete cascade,
  label text not null check (char_length(label) between 1 and 200),
  is_correct boolean not null default false,
  position integer not null default 0 check (position >= 0)
);
create index quiz_options_question_idx on public.quiz_options (question_id, position);
create unique index quiz_options_one_correct on public.quiz_options (question_id) where is_correct;

create table public.quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references public.quizzes (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  course_id uuid not null references public.courses (id) on delete cascade,
  score integer not null check (score >= 0),
  total integer not null check (total > 0),
  percent integer not null check (percent between 0 and 100),
  passed boolean not null,
  answers jsonb not null,
  created_at timestamptz not null default now()
);
create index quiz_attempts_user_idx on public.quiz_attempts (user_id, quiz_id, created_at desc);

-- ------------------------------------------------------------------ helpers (resolve the owning academy)
create function public.lesson_academy(p_lesson uuid) returns uuid
language sql stable security definer set search_path = '' as $$
  select c.academy_id from public.lessons l join public.courses c on c.id = l.course_id where l.id = p_lesson;
$$;
create function public.quiz_academy(p_quiz uuid) returns uuid
language sql stable security definer set search_path = '' as $$
  select public.lesson_academy(q.lesson_id) from public.quizzes q where q.id = p_quiz;
$$;
create function public.question_academy(p_question uuid) returns uuid
language sql stable security definer set search_path = '' as $$
  select public.quiz_academy(qq.quiz_id) from public.quiz_questions qq where qq.id = p_question;
$$;
revoke all on function public.lesson_academy(uuid), public.quiz_academy(uuid), public.question_academy(uuid) from public;
grant execute on function public.lesson_academy(uuid), public.quiz_academy(uuid), public.question_academy(uuid) to authenticated;

-- Size limits so one quiz cannot grow without bound.
create function public.quiz_questions_limit() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if (select count(*) from public.quiz_questions where quiz_id = new.quiz_id) >= 50 then
    raise exception 'A quiz can have at most 50 questions' using errcode = '22023';
  end if;
  return new;
end $$;
create function public.quiz_options_limit() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if (select count(*) from public.quiz_options where question_id = new.question_id) >= 6 then
    raise exception 'A question can have at most 6 options' using errcode = '22023';
  end if;
  return new;
end $$;
create trigger quiz_questions_limit before insert on public.quiz_questions for each row execute function public.quiz_questions_limit();
create trigger quiz_options_limit before insert on public.quiz_options for each row execute function public.quiz_options_limit();

-- ------------------------------------------------------------------ row-level security
alter table public.quizzes enable row level security;
alter table public.quiz_questions enable row level security;
alter table public.quiz_options enable row level security;
alter table public.quiz_attempts enable row level security;

create policy quizzes_staff on public.quizzes for all to authenticated
  using (public.is_super_admin() or public.is_academy_teacher(public.lesson_academy(lesson_id)))
  with check (public.is_academy_teacher(public.lesson_academy(lesson_id)));
create policy quiz_questions_staff on public.quiz_questions for all to authenticated
  using (public.is_super_admin() or public.is_academy_teacher(public.quiz_academy(quiz_id)))
  with check (public.is_academy_teacher(public.quiz_academy(quiz_id)));
create policy quiz_options_staff on public.quiz_options for all to authenticated
  using (public.is_super_admin() or public.is_academy_teacher(public.question_academy(question_id)))
  with check (public.is_academy_teacher(public.question_academy(question_id)));
create policy quiz_attempts_read on public.quiz_attempts for select to authenticated
  using (user_id = auth.uid() or public.is_super_admin() or public.is_academy_teacher(public.course_academy(course_id)));

revoke all on public.quizzes, public.quiz_questions, public.quiz_options, public.quiz_attempts from anon, authenticated;
grant select, insert, update, delete on public.quizzes, public.quiz_questions, public.quiz_options to authenticated;
grant select on public.quiz_attempts to authenticated; -- attempts are written only by submit_quiz_attempt()

-- ------------------------------------------------------------------ learner functions
-- The quiz for a lesson, without the answer key. Null when the lesson has no quiz or the caller cannot open the lesson.
create function public.get_quiz(p_lesson uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_quiz public.quizzes%rowtype;
begin
  if not public.can_learn_lesson(p_lesson) then return null; end if;
  select * into v_quiz from public.quizzes where lesson_id = p_lesson;
  if not found then return null; end if;
  return jsonb_build_object(
    'id', v_quiz.id, 'title', v_quiz.title, 'pass_percent', v_quiz.pass_percent,
    'questions', coalesce((
      select jsonb_agg(jsonb_build_object('id', qq.id, 'prompt', qq.prompt, 'options', (
        select coalesce(jsonb_agg(jsonb_build_object('id', o.id, 'label', o.label) order by o.position, o.id), '[]'::jsonb)
        from public.quiz_options o where o.question_id = qq.id)) order by qq.position, qq.created_at, qq.id)
      from public.quiz_questions qq where qq.quiz_id = v_quiz.id), '[]'::jsonb));
end $$;

-- p_answers is an object of question id to option id. Every question must be answered.
-- Scores on the server, stores the attempt, and returns the result with the right answers and explanations.
create function public.submit_quiz_attempt(p_quiz uuid, p_answers jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_quiz public.quizzes%rowtype; v_course uuid; q record; v_picked uuid; v_correct uuid;
  v_score integer := 0; v_total integer := 0; v_percent integer; v_passed boolean; v_review jsonb := '[]'::jsonb;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  select * into v_quiz from public.quizzes where id = p_quiz;
  if not found or not public.can_learn_lesson(v_quiz.lesson_id) then raise exception 'Quiz not found' using errcode = 'P0002'; end if;
  if p_answers is null or jsonb_typeof(p_answers) <> 'object' then raise exception 'Answer every question' using errcode = '22023'; end if;
  if (select count(*) from public.quiz_attempts where quiz_id = p_quiz and user_id = auth.uid() and created_at > now() - interval '1 day') >= 30 then
    raise exception 'Too many attempts today. Try again tomorrow.' using errcode = '54000';
  end if;
  select course_id into v_course from public.lessons where id = v_quiz.lesson_id;

  for q in select id, prompt, explanation from public.quiz_questions where quiz_id = p_quiz order by position, created_at, id loop
    select id into v_correct from public.quiz_options where question_id = q.id and is_correct;
    if v_correct is null then raise exception 'This quiz is not ready yet' using errcode = '55000'; end if;
    begin
      v_picked := nullif(p_answers ->> q.id::text, '')::uuid;
    exception when invalid_text_representation then v_picked := null;
    end;
    if v_picked is null or not exists (select 1 from public.quiz_options where id = v_picked and question_id = q.id) then
      raise exception 'Answer every question' using errcode = '22023';
    end if;
    v_total := v_total + 1;
    if v_picked = v_correct then v_score := v_score + 1; end if;
    v_review := v_review || jsonb_build_object('question_id', q.id, 'picked', v_picked, 'correct', v_correct,
                                               'is_correct', v_picked = v_correct, 'explanation', q.explanation);
  end loop;
  if v_total = 0 then raise exception 'This quiz has no questions yet' using errcode = '55000'; end if;

  v_percent := (v_score * 100) / v_total;
  v_passed := v_percent >= v_quiz.pass_percent;
  insert into public.quiz_attempts (quiz_id, user_id, course_id, score, total, percent, passed, answers)
  values (p_quiz, auth.uid(), v_course, v_score, v_total, v_percent, v_passed, p_answers);
  return jsonb_build_object('score', v_score, 'total', v_total, 'percent', v_percent, 'passed', v_passed,
                            'pass_percent', v_quiz.pass_percent, 'review', v_review);
end $$;

revoke execute on function public.get_quiz(uuid), public.submit_quiz_attempt(uuid, jsonb) from public, anon;
grant execute on function public.get_quiz(uuid), public.submit_quiz_attempt(uuid, jsonb) to authenticated;
