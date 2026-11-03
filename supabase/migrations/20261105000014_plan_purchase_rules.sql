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
