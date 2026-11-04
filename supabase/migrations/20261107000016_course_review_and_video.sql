-- Migration 16: (a) lessons get an optional video link; (b) courses go live only after a platform administrator approves them.
-- Additive: new columns and functions, plus an in-place replacement of courses_guard. No DROP, no data deleted.
--
-- Review flow: academy staff call submit_course_for_review(); a super admin calls review_course('approve' | 'changes', note).
-- Staff can no longer set status = 'published' or touch the review columns directly; the functions set a
-- transaction-local flag that the guard trigger honours, and it is not reachable from a client request.
-- Courses already published stay published (review_status 'none' means "never went through review").

-- ------------------------------------------------------------------ lesson video
-- https only, from known video hosts. The page builds the embed address itself from the parsed id; this is the second line of defence.
alter table public.lessons add column video_url text
  check (video_url is null or (
    char_length(video_url) <= 500
    and video_url ~ '^https://(www\.|m\.)?(youtube\.com|youtu\.be|youtube-nocookie\.com|vimeo\.com|player\.vimeo\.com|iframe\.mediadelivery\.net|player\.mediadelivery\.net)/[A-Za-z0-9_./?=&%#~:+-]+$'));

-- ------------------------------------------------------------------ review columns
alter table public.courses
  add column review_status text not null default 'none' check (review_status in ('none', 'submitted', 'changes_requested', 'approved')),
  add column review_note text check (review_note is null or char_length(review_note) <= 500),
  add column submitted_at timestamptz,
  add column reviewed_at timestamptz,
  add column reviewed_by uuid references auth.users (id) on delete set null;
create index courses_review_idx on public.courses (submitted_at) where review_status = 'submitted' and deleted_at is null;

create or replace function public.courses_guard() returns trigger language plpgsql security definer set search_path = '' as $$
declare v_active boolean;
begin
  if tg_op = 'INSERT' then
    if new.status <> 'draft' then raise exception 'A new course starts as a draft' using errcode = '22023'; end if;
    if new.review_status <> 'none' then raise exception 'A new course has not been reviewed' using errcode = '22023'; end if;
    return new;
  end if;
  if new.academy_id is distinct from old.academy_id then raise exception 'A course cannot move to another academy' using errcode = '42501'; end if;
  if new.slug is distinct from old.slug and old.status = 'published' then raise exception 'Unpublish the course before changing its web address' using errcode = '22023'; end if;

  -- Only the review functions (flag) or the system (no signed-in user) may publish or touch the review columns.
  if auth.uid() is not null and current_setting('app.course_review', true) is distinct from 'on' then
    if new.status = 'published' and old.status is distinct from 'published' then
      raise exception 'Submit the course for review; a platform administrator publishes it' using errcode = '42501';
    end if;
    if new.review_status is distinct from old.review_status or new.review_note is distinct from old.review_note
       or new.submitted_at is distinct from old.submitted_at or new.reviewed_at is distinct from old.reviewed_at or new.reviewed_by is distinct from old.reviewed_by then
      raise exception 'Only the review process can change review fields' using errcode = '42501';
    end if;
    -- Unpublishing or archiving cancels any pending or past approval.
    if new.status is distinct from old.status and new.status <> 'published' then
      new.review_status := 'none';
    end if;
  end if;

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

-- ------------------------------------------------------------------ staff: submit / withdraw
create function public.submit_course_for_review(p_course uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare c public.courses%rowtype; v_active boolean;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  select * into c from public.courses where id = p_course and deleted_at is null for update;
  -- Same answer for "does not exist" and "not yours", so ids cannot be probed.
  if not found or not public.is_academy_staff(c.academy_id) then raise exception 'Course not found' using errcode = 'P0002'; end if;
  if c.review_status = 'submitted' then return; end if; -- already waiting: idempotent
  if c.status <> 'draft' then raise exception 'Only a draft course can be submitted for review' using errcode = '55000'; end if;
  select (status = 'active' and deleted_at is null) into v_active from public.academies where id = c.academy_id;
  if not coalesce(v_active, false) then raise exception 'The academy must be approved before a course can be published' using errcode = '22023'; end if;
  if not exists (select 1 from public.lessons where course_id = p_course) then raise exception 'Add at least one lesson before submitting' using errcode = '22023'; end if;
  perform set_config('app.course_review', 'on', true);
  update public.courses set review_status = 'submitted', submitted_at = now() where id = p_course;
  perform set_config('app.course_review', 'off', true);
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, details)
  values (auth.uid(), 'course.submitted', 'course', p_course::text, jsonb_build_object('academy_id', c.academy_id, 'slug', c.slug, 'from', c.review_status));
end $$;

create function public.withdraw_course_submission(p_course uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare c public.courses%rowtype;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  select * into c from public.courses where id = p_course and deleted_at is null for update;
  if not found or not public.is_academy_staff(c.academy_id) then raise exception 'Course not found' using errcode = 'P0002'; end if;
  if c.review_status <> 'submitted' then return; end if;
  perform set_config('app.course_review', 'on', true);
  update public.courses set review_status = 'none', submitted_at = null where id = p_course;
  perform set_config('app.course_review', 'off', true);
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, details)
  values (auth.uid(), 'course.submission_withdrawn', 'course', p_course::text, jsonb_build_object('academy_id', c.academy_id, 'slug', c.slug));
end $$;

-- ------------------------------------------------------------------ super admin: decide
create function public.review_course(p_course uuid, p_decision text, p_note text default null) returns void
language plpgsql security definer set search_path = '' as $$
declare c public.courses%rowtype; v_note text := nullif(btrim(coalesce(p_note, '')), '');
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  if not public.is_super_admin() then raise exception 'Not allowed' using errcode = '42501'; end if;
  if p_decision not in ('approve', 'changes') then raise exception 'Choose approve or needs changes' using errcode = '22023'; end if;
  if p_decision = 'changes' and (v_note is null or char_length(v_note) < 3) then raise exception 'Tell the academy what to change' using errcode = '22023'; end if;
  if v_note is not null and char_length(v_note) > 500 then raise exception 'Keep the note under 500 characters' using errcode = '22023'; end if;
  select * into c from public.courses where id = p_course and deleted_at is null for update;
  if not found then raise exception 'Course not found' using errcode = 'P0002'; end if;
  if c.review_status <> 'submitted' or c.status <> 'draft' then raise exception 'This course is not waiting for review' using errcode = '55000'; end if;
  perform set_config('app.course_review', 'on', true);
  if p_decision = 'approve' then
    update public.courses set status = 'published', review_status = 'approved', review_note = v_note, reviewed_at = now(), reviewed_by = auth.uid() where id = p_course;
  else
    update public.courses set review_status = 'changes_requested', review_note = v_note, reviewed_at = now(), reviewed_by = auth.uid() where id = p_course;
  end if;
  perform set_config('app.course_review', 'off', true);
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, details)
  values (auth.uid(), case p_decision when 'approve' then 'course.approved' else 'course.changes_requested' end, 'course', p_course::text,
          jsonb_build_object('academy_id', c.academy_id, 'slug', c.slug, 'note', v_note));
end $$;

revoke execute on function public.submit_course_for_review(uuid), public.withdraw_course_submission(uuid), public.review_course(uuid, text, text) from public, anon;
grant execute on function public.submit_course_for_review(uuid), public.withdraw_course_submission(uuid), public.review_course(uuid, text, text) to authenticated;
