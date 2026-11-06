-- Migration 22: a lesson that has a quiz can only be marked complete after the learner has passed that quiz.
-- Replaces complete_lesson in place (same signature, grants kept). Lessons already completed stay completed.
create or replace function public.complete_lesson(p_lesson uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_course uuid; v_next uuid; v_quiz uuid;
begin
  if not public.can_learn_lesson(p_lesson) then raise exception 'Lesson not found' using errcode = 'P0002'; end if;
  select course_id into v_course from public.lessons where id = p_lesson;
  select id into v_quiz from public.quizzes where lesson_id = p_lesson;
  if v_quiz is not null
     and not exists (select 1 from public.lesson_progress where user_id = auth.uid() and lesson_id = p_lesson and completed_at is not null)
     and not exists (select 1 from public.quiz_attempts where quiz_id = v_quiz and user_id = auth.uid() and passed)
  then
    raise exception 'Pass the lesson quiz first' using errcode = '22023';
  end if;
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
