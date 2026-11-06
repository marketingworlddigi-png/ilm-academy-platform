-- Migration 21: private lesson notes. Additive: one new table, no DROP.
-- A learner keeps one plain-text note per lesson. Only they can read or change it (not even the academy's teachers),
-- and only for lessons they can open.

create table public.lesson_notes (
  user_id uuid not null references auth.users (id) on delete cascade,
  lesson_id uuid not null references public.lessons (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 5000),
  updated_at timestamptz not null default now(),
  primary key (user_id, lesson_id)
);

alter table public.lesson_notes enable row level security;
create policy lesson_notes_own_read on public.lesson_notes for select to authenticated using (user_id = auth.uid());
create policy lesson_notes_own_insert on public.lesson_notes for insert to authenticated
  with check (user_id = auth.uid() and public.can_learn_lesson(lesson_id));
create policy lesson_notes_own_update on public.lesson_notes for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid() and public.can_learn_lesson(lesson_id));
create policy lesson_notes_own_delete on public.lesson_notes for delete to authenticated using (user_id = auth.uid());

revoke all on public.lesson_notes from anon, authenticated;
grant select, insert, update, delete on public.lesson_notes to authenticated;
