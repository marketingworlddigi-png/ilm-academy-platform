-- Migration 20: course certificates. Additive: one new table and functions, no DROP.
--
-- A learner earns a certificate when they are enrolled, have completed every lesson, and have passed every quiz in the course.
-- The certificate stores a snapshot of the name, course and academy at issue time, so later edits cannot change it.
-- Anyone with the code can check it through verify_certificate(), which returns only the name, course, academy and date.
-- Clients never write the table. Academy owners/admins and super admins can revoke (audited); a revoked code no longer verifies.

create table public.certificates (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[A-Z0-9]{12}$'),
  user_id uuid not null references auth.users (id) on delete cascade,
  course_id uuid not null references public.courses (id) on delete cascade,
  academy_id uuid not null references public.academies (id) on delete cascade,
  recipient_name text not null check (char_length(recipient_name) between 2 and 120),
  course_title text not null,
  academy_name text not null,
  issued_at timestamptz not null default now(),
  revoked_at timestamptz,
  unique (user_id, course_id)
);
create index certificates_academy_idx on public.certificates (academy_id, issued_at desc);

alter table public.certificates enable row level security;
create policy certificates_read on public.certificates for select to authenticated
  using (user_id = auth.uid() or public.is_super_admin() or public.is_academy_staff(academy_id));
revoke all on public.certificates from anon, authenticated;
grant select on public.certificates to authenticated;

-- Where the caller stands: eligible, or the first thing still missing. Also says whether they already hold one.
create function public.certificate_status(p_course uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_total integer; v_done integer; v_quizzes integer; v_passed integer; v_cert public.certificates%rowtype; v_reason text;
begin
  if auth.uid() is null then return null; end if;
  select * into v_cert from public.certificates where user_id = auth.uid() and course_id = p_course and revoked_at is null;
  if found then return jsonb_build_object('eligible', true, 'issued', true, 'code', v_cert.code, 'reason', null); end if;
  if not public.is_enrolled(p_course) then return jsonb_build_object('eligible', false, 'issued', false, 'code', null, 'reason', 'Enroll in this course first'); end if;
  select count(*) into v_total from public.lessons where course_id = p_course;
  select count(*) into v_done from public.lesson_progress lp join public.lessons l on l.id = lp.lesson_id
    where lp.user_id = auth.uid() and lp.course_id = p_course and lp.completed_at is not null;
  select count(*) into v_quizzes from public.quizzes z join public.lessons l on l.id = z.lesson_id where l.course_id = p_course;
  select count(*) into v_passed from public.quizzes z join public.lessons l on l.id = z.lesson_id
    where l.course_id = p_course and exists (select 1 from public.quiz_attempts a where a.quiz_id = z.id and a.user_id = auth.uid() and a.passed);
  if v_total = 0 or v_done < v_total then v_reason := 'Complete every lesson first';
  elsif v_passed < v_quizzes then v_reason := 'Pass every quiz first';
  end if;
  return jsonb_build_object('eligible', v_reason is null, 'issued', false, 'code', null, 'reason', v_reason);
end $$;

create function public.claim_certificate(p_course uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare v_status jsonb; v_name text; v_course public.courses%rowtype; v_academy text; v_code text;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  v_status := public.certificate_status(p_course);
  if (v_status ->> 'issued')::boolean then return v_status ->> 'code'; end if;
  if not (v_status ->> 'eligible')::boolean then raise exception '%', v_status ->> 'reason' using errcode = '42501'; end if;
  if exists (select 1 from public.certificates where user_id = auth.uid() and course_id = p_course) then
    raise exception 'This certificate has been withdrawn' using errcode = '42501';
  end if;
  select nullif(btrim(coalesce(full_name, '')), '') into v_name from public.profiles where id = auth.uid();
  if v_name is null or char_length(v_name) < 2 then raise exception 'Add your full name in your account so it can appear on the certificate' using errcode = '22023'; end if;
  select * into v_course from public.courses where id = p_course;
  select name into v_academy from public.academies where id = v_course.academy_id;
  v_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12));
  insert into public.certificates (code, user_id, course_id, academy_id, recipient_name, course_title, academy_name)
  values (v_code, auth.uid(), p_course, v_course.academy_id, left(v_name, 120), v_course.title, v_academy);
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, details)
  values (auth.uid(), 'certificate.issued', 'course', p_course::text, jsonb_build_object('code', v_code));
  return v_code;
end $$;

-- Public check. Returns null for an unknown or revoked code, and nothing but the printed facts otherwise.
create function public.verify_certificate(p_code text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('name', recipient_name, 'course', course_title, 'academy', academy_name, 'issued_at', issued_at, 'code', code)
  from public.certificates where code = upper(btrim(coalesce(p_code, ''))) and revoked_at is null;
$$;

create function public.revoke_certificate(p_code text, p_reason text) returns void
language plpgsql security definer set search_path = '' as $$
declare c public.certificates%rowtype; v_reason text := btrim(coalesce(p_reason, ''));
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  select * into c from public.certificates where code = upper(btrim(coalesce(p_code, '')));
  if not found or not (public.is_super_admin() or public.is_academy_staff(c.academy_id)) then raise exception 'Not found' using errcode = 'P0002'; end if;
  if char_length(v_reason) < 3 then raise exception 'Give a reason for withdrawing the certificate' using errcode = '22023'; end if;
  update public.certificates set revoked_at = coalesce(revoked_at, now()) where id = c.id;
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, details)
  values (auth.uid(), 'certificate.revoked', 'certificate', c.id::text, jsonb_build_object('code', c.code, 'reason', left(v_reason, 300)));
end $$;

revoke execute on function public.certificate_status(uuid), public.claim_certificate(uuid), public.verify_certificate(text), public.revoke_certificate(text, text) from public, anon, authenticated;
grant execute on function public.certificate_status(uuid), public.claim_certificate(uuid), public.revoke_certificate(text, text) to authenticated;
grant execute on function public.verify_certificate(text) to anon, authenticated;
