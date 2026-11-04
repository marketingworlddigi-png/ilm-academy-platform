
-- ===== 20261104000011_resubmit_academy.sql =====
-- Migration 11: an academy that was sent back (needs_info) or not approved (rejected) can be resubmitted by its owner.
-- Adds one function and replaces academies_guard in place so that this function (and only it) may move
-- needs_info/rejected back to pending. No DROP, no data deleted.
create or replace function public.academies_guard() returns trigger language plpgsql security definer set search_path = '' as $g$
begin
  if auth.uid() is not null and not public.is_super_admin() then
    -- resubmit_academy() sets a transaction-local flag; it is not reachable from a client request.
    if current_setting('app.academy_resubmit', true) = 'on' and old.status in ('needs_info', 'rejected') and new.status = 'pending'
       and new.owner_id is not distinct from old.owner_id and new.status_note is not distinct from old.status_note and new.slug is not distinct from old.slug then
      return new;
    end if;
    if new.status is distinct from old.status or new.owner_id is distinct from old.owner_id
       or new.status_note is distinct from old.status_note or new.slug is distinct from old.slug then
      raise exception 'Only a platform administrator can change academy status, owner or web address' using errcode = '42501';
    end if;
  end if;
  return new;
end $g$;

create function public.resubmit_academy(p_academy uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare a public.academies%rowtype;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  select * into a from public.academies where id = p_academy and deleted_at is null for update;
  -- Same answer for "does not exist" and "not yours", so ids cannot be probed.
  if not found or not public.has_academy_role(p_academy, array['academy_owner']::public.membership_role[]) then
    raise exception 'Academy not found' using errcode = 'P0002';
  end if;
  if a.status = 'pending' then return; end if; -- already waiting: idempotent
  if a.status not in ('needs_info', 'rejected') then
    raise exception 'Only an academy that was sent back or not approved can be resubmitted' using errcode = '55000';
  end if;
  if (select count(*) from public.academies where owner_id = a.owner_id and deleted_at is null and status in ('pending', 'needs_info', 'active')) >= 3 then
    raise exception 'You already have the maximum number of academies awaiting review or active' using errcode = '53400';
  end if;
  -- The reviewer's note stays visible until the next decision, so the reviewer can see what was asked.
  perform set_config('app.academy_resubmit', 'on', true);
  update public.academies set status = 'pending' where id = p_academy;
  perform set_config('app.academy_resubmit', 'off', true);
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, details)
  values (auth.uid(), 'academy.resubmitted', 'academy', p_academy::text, jsonb_build_object('from', a.status, 'slug', a.slug));
end $$;
revoke execute on function public.resubmit_academy(uuid) from public, anon;
grant execute on function public.resubmit_academy(uuid) to authenticated;

-- ===== 20261104000012_courses.sql =====
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

-- ===== 20261105000013_official_source_url.sql =====
-- Migration 13: optional link to the publisher's or author's official page for a resource. Additive only: one nullable column.
-- The book page shows a "Read on official website" button when the resource has no file readable on this site.
-- The database accepts only absolute http(s) links without spaces, so a stored value can never be a javascript: or data: URL.

alter table public.resources add column official_source_url text
  check (official_source_url is null or (char_length(official_source_url) <= 500 and official_source_url ~* '^https?://[^\s/]+[^\s]*$'));

-- ===== 20261105000014_plan_purchase_rules.sql =====
-- Migration 14: plan purchase rules, enforced in SQL.
-- Replaces two functions in place (CREATE OR REPLACE, same signatures): create_payment and approve_payment.
-- Adds two functions. No table changes: the plan an entitlement came from is already recorded through
-- entitlements.payment_id -> payments.plan_id (migration 8).
--
-- Rules:
--  1. A user whose Premium came from plan X cannot start a payment for X until the last 7 days before it ends.
--  2. A different plan can be bought at any time; on approval it starts when the current period ends.
--  3. A payment that is submitted or under review blocks any new payment. An unpaid 'pending' payment for the same plan
--     is reused; an unpaid one for another plan is cancelled so the switch can go ahead.

-- When a newly approved platform period starts: now, or the end of the latest active one (stacking).
-- Used by approve_payment and by the previews, so what the screens show is what approval grants.
create function public.platform_period_start(p_user uuid) returns timestamptz
language sql stable security definer set search_path = '' as $$
  select case when coalesce(bool_or(expires_at is null), false) or max(expires_at) is null then now() else max(expires_at) end
  from public.entitlements
  where user_id = p_user and scope = 'platform' and revoked_at is null and (expires_at is null or expires_at > now());
$$;
revoke all on function public.platform_period_start(uuid) from public, anon, authenticated;

-- What buying p_plan would do for p_user: the plan they have now, whether this plan is blocked, and the dates
-- the new period would cover. p_months overrides the plan length (the admin screen passes the payment's own snapshot).
-- Callable for yourself, or for anyone by a super admin.
create function public.plan_purchase_preview(p_user uuid, p_plan uuid, p_months integer default null)
returns table (
  current_plan_id uuid, current_plan_name text, current_ends_at timestamptz,
  same_plan_ends_at timestamptz, renew_from timestamptz, blocked boolean,
  period_starts_at timestamptz, period_ends_at timestamptz
)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_months integer; v_cur_id uuid; v_cur_name text; v_cur_end timestamptz; v_same_end timestamptz; v_start timestamptz;
begin
  if auth.uid() is null or (p_user is distinct from auth.uid() and not public.is_super_admin()) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  v_months := coalesce(p_months, (select pl.duration_months from public.plans pl where pl.id = p_plan));
  if v_months is null then raise exception 'That plan is not available' using errcode = 'P0002'; end if;

  -- The plan whose entitlement is in effect right now (grants without a payment have no plan and are not listed).
  select p.plan_id, p.plan_name into v_cur_id, v_cur_name
  from public.entitlements e join public.payments p on p.id = e.payment_id
  where e.user_id = p_user and e.scope = 'platform' and e.revoked_at is null
    and e.starts_at <= now() and (e.expires_at is null or e.expires_at > now())
  order by e.expires_at desc nulls first limit 1;

  select max(e.expires_at) into v_cur_end
  from public.entitlements e join public.payments p on p.id = e.payment_id
  where v_cur_id is not null and p.plan_id = v_cur_id and e.user_id = p_user and e.scope = 'platform'
    and e.revoked_at is null and e.expires_at > now();

  select max(e.expires_at) into v_same_end
  from public.entitlements e join public.payments p on p.id = e.payment_id
  where p.plan_id = p_plan and e.user_id = p_user and e.scope = 'platform'
    and e.revoked_at is null and e.expires_at > now();

  v_start := public.platform_period_start(p_user);
  return query select v_cur_id, v_cur_name, v_cur_end, v_same_end,
    v_same_end - interval '7 days',
    v_same_end is not null and now() < v_same_end - interval '7 days',
    v_start, v_start + make_interval(months => v_months);
end $$;
revoke execute on function public.plan_purchase_preview(uuid, uuid, integer) from public, anon;
grant execute on function public.plan_purchase_preview(uuid, uuid, integer) to authenticated;

create or replace function public.create_payment(p_plan uuid, p_method text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid(); v_plan public.plans%rowtype; v_id uuid; v_busy public.payments%rowtype;
  v_same_end timestamptz; v_blocked boolean; v_renew timestamptz;
  fmt constant text := 'FMDD FMMonth YYYY';
begin
  if v_uid is null then raise exception 'Sign in to continue' using errcode = '42501'; end if;
  select * into v_plan from public.plans where id = p_plan and is_active;
  if not found then raise exception 'That plan is not available' using errcode = 'P0002'; end if;
  if not exists (select 1 from public.payment_methods where code = p_method and is_active) then
    raise exception 'That payment method is not available' using errcode = 'P0002';
  end if;
  -- One buyer, one decision at a time: two quick clicks cannot slip past the checks below.
  perform pg_advisory_xact_lock(hashtextextended(v_uid::text, 14));

  -- Rule 3: a payment already sent in blocks everything until it is checked.
  select * into v_busy from public.payments
    where user_id = v_uid and status in ('submitted', 'under_review') order by created_at limit 1;
  if found then
    raise exception 'You have a payment being reviewed (code %). Please wait for it to be checked.', v_busy.code using errcode = '55000';
  end if;

  -- Rule 1: the same plan cannot be bought again until the renewal window opens.
  select pv.same_plan_ends_at, pv.blocked, pv.renew_from into v_same_end, v_blocked, v_renew
    from public.plan_purchase_preview(v_uid, p_plan) pv;
  if v_blocked then
    raise exception 'You already have % until %. You can renew it from %.', v_plan.name,
      to_char(v_same_end at time zone 'Asia/Karachi', fmt), to_char(v_renew at time zone 'Asia/Karachi', fmt) using errcode = '55000';
  end if;

  -- Rule 3 exception: reuse the unpaid payment for the same plan (switching method if asked).
  select id into v_id from public.payments
    where user_id = v_uid and plan_id = p_plan and status = 'pending' order by created_at desc limit 1;
  if found then
    update public.payments set method_code = p_method where id = v_id and method_code <> p_method;
    return v_id;
  end if;

  -- Unpaid payments for another plan are dropped so a switch is never stuck behind them.
  with gone as (update public.payments set status = 'cancelled' where user_id = v_uid and status = 'pending' returning id, code)
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, details)
  select v_uid, 'payment.cancelled', 'payment', id::text, jsonb_build_object('code', code, 'reason', 'replaced by a new plan choice') from gone;

  insert into public.payments (user_id, plan_id, plan_name, duration_months, method_code, amount_paisa, currency)
  values (v_uid, v_plan.id, v_plan.name, v_plan.duration_months, p_method, v_plan.price_paisa, v_plan.currency)
  returning id into v_id;
  return v_id;
end $$;

-- approve_payment: unchanged except that the start date now comes from platform_period_start, the same function the previews use.
create or replace function public.approve_payment(p_payment uuid, p_note text default null) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v public.payments%rowtype; v_ent uuid; v_start timestamptz; v_end timestamptz;
begin
  if not public.is_super_admin() then raise exception 'Not allowed' using errcode = '42501'; end if;
  select * into v from public.payments where id = p_payment for update;
  if not found then raise exception 'Payment not found' using errcode = 'P0002'; end if;
  if v.user_id = auth.uid() then raise exception 'You cannot review your own payment' using errcode = '42501'; end if;
  if v.status = 'approved' then
    select id into v_ent from public.entitlements where payment_id = p_payment;
    return v_ent;
  end if;
  if v.status not in ('submitted', 'under_review') then
    raise exception 'Only a submitted payment can be approved' using errcode = '55000';
  end if;
  v_start := public.platform_period_start(v.user_id);
  v_end := v_start + make_interval(months => v.duration_months);
  insert into public.entitlements (user_id, scope, scope_id, source, starts_at, expires_at, granted_by, note, payment_id)
  values (v.user_id, 'platform', null, 'subscription', v_start, v_end, auth.uid(), 'Payment ' || v.code, p_payment)
  returning id into v_ent;
  update public.payments set status = 'approved', reviewed_by = auth.uid(), reviewed_at = now(),
    review_note = nullif(trim(coalesce(p_note, '')), '') where id = p_payment;
  perform public.post_payment_ledger(p_payment, auth.uid());
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, details)
  values (auth.uid(), 'payment.approved', 'payment', p_payment::text,
          jsonb_build_object('code', v.code, 'user_id', v.user_id, 'amount_paisa', v.amount_paisa, 'plan', v.plan_name,
                             'entitlement_id', v_ent, 'starts_at', v_start, 'expires_at', v_end));
  return v_ent;
end $$;

-- ===== 20261106000015_teachers_and_progress.sql =====
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
