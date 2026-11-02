-- Migration 8: manual payments (bank transfer, JazzCash, Easypaisa). No gateway, no webhook.
-- Non-destructive: new objects, plus one nullable column on entitlements.
-- Money is integer paisa. Clients can only READ payments; every write goes through the security-definer functions below,
-- which compute the price from the plans table, so a browser can never choose its own amount.

create type public.payment_status as enum
  ('pending', 'submitted', 'under_review', 'approved', 'rejected', 'refunded', 'cancelled', 'expired');

-- ------------------------------------------------------------------------ plans (admin-editable)
create table public.plans (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[a-z0-9-]{2,40}$'),
  name text not null check (char_length(name) between 2 and 80),
  description text check (description is null or char_length(description) <= 500),
  duration_months integer not null check (duration_months between 1 and 36),
  price_paisa integer not null check (price_paisa > 0),
  currency text not null default 'PKR' check (currency = 'PKR'),
  is_active boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger plans_touch before update on public.plans for each row execute function public.touch_updated_at();

-- Seeded INACTIVE: the placeholder prices are not real. An admin sets the price and activates the plan.
insert into public.plans (code, name, description, duration_months, price_paisa, is_active, sort_order) values
  ('premium-monthly', 'Premium monthly', 'Full access to premium books and notes for one month.', 1, 100000, false, 1),
  ('premium-yearly', 'Premium yearly', 'Full access to premium books and notes for twelve months.', 12, 1000000, false, 2);

-- ------------------------------------------------------------------------ payment methods (admin-editable instructions)
create table public.payment_methods (
  code text primary key check (code in ('bank_transfer', 'jazzcash', 'easypaisa')),
  label text not null,
  account_title text check (account_title is null or char_length(account_title) <= 120),
  account_number text check (account_number is null or char_length(account_number) <= 80),
  instructions text check (instructions is null or char_length(instructions) <= 1500),
  is_active boolean not null default false,
  sort_order integer not null default 0,
  updated_at timestamptz not null default now()
);
create trigger payment_methods_touch before update on public.payment_methods for each row execute function public.touch_updated_at();

-- Seeded INACTIVE and empty: no account details are invented. An admin fills them in and switches a method on.
insert into public.payment_methods (code, label, sort_order) values
  ('bank_transfer', 'Bank transfer', 1), ('jazzcash', 'JazzCash', 2), ('easypaisa', 'Easypaisa', 3);

-- ------------------------------------------------------------------------ payments
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  code text not null unique default ('ILM-' || upper(substr(md5(gen_random_uuid()::text), 1, 8))), -- shown to the payer to quote in the transfer
  user_id uuid not null references auth.users (id) on delete restrict,
  plan_id uuid not null references public.plans (id),
  plan_name text not null,            -- snapshots: later plan edits never change what this payment bought
  duration_months integer not null,
  method_code text not null references public.payment_methods (code),
  amount_paisa integer not null check (amount_paisa > 0),
  currency text not null default 'PKR',
  status public.payment_status not null default 'pending',
  reference text,                     -- transaction ID as the payer typed it
  reference_norm text,                -- upper-case letters and digits only; what duplicate detection compares
  proof_path text,                    -- object name in the private payment-proofs bucket
  payer_note text check (payer_note is null or char_length(payer_note) <= 500),
  submitted_at timestamptz,
  reviewed_by uuid references auth.users (id),
  reviewed_at timestamptz,
  review_note text check (review_note is null or char_length(review_note) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint payment_submitted_has_evidence check (
    status in ('pending', 'cancelled', 'expired') or (reference_norm is not null and proof_path is not null))
);
create trigger payments_touch before update on public.payments for each row execute function public.touch_updated_at();
create index payments_user_idx on public.payments (user_id, created_at desc);
create index payments_queue_idx on public.payments (status, submitted_at);
-- A transaction ID can back only one live payment. Rejected and cancelled ones free it up so a payer can correct a mistake.
create unique index payments_reference_uniq on public.payments (reference_norm)
  where reference_norm is not null and status in ('submitted', 'under_review', 'approved', 'refunded');

-- One entitlement per payment, enforced by the database.
alter table public.entitlements add column payment_id uuid references public.payments (id);
create unique index entitlements_payment_uniq on public.entitlements (payment_id) where payment_id is not null;

-- ------------------------------------------------------------------------ RLS
alter table public.plans enable row level security;
alter table public.payment_methods enable row level security;
alter table public.payments enable row level security;

create policy plans_read on public.plans for select to anon, authenticated using (is_active or public.is_super_admin());
create policy plans_admin_write on public.plans for all to authenticated
  using (public.is_super_admin()) with check (public.is_super_admin());
create policy payment_methods_read on public.payment_methods for select to authenticated using (is_active or public.is_super_admin());
create policy payment_methods_admin_write on public.payment_methods for all to authenticated
  using (public.is_super_admin()) with check (public.is_super_admin());
create policy payments_read on public.payments for select to authenticated using (user_id = auth.uid() or public.is_super_admin());

revoke all on public.plans, public.payment_methods, public.payments from anon, authenticated;
grant select on public.plans to anon;
grant select, insert, update, delete on public.plans, public.payment_methods to authenticated;
grant select on public.payments to authenticated; -- writes only through the functions below

-- Price and availability changes are audited.
create function public.audit_plan_change() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.price_paisa is distinct from old.price_paisa or new.is_active is distinct from old.is_active
     or new.duration_months is distinct from old.duration_months then
    insert into public.audit_logs (actor_id, action, entity_type, entity_id, details)
    values (auth.uid(), 'plan.updated', 'plan', new.id::text, jsonb_build_object('code', new.code,
      'price_from', old.price_paisa, 'price_to', new.price_paisa, 'active_from', old.is_active, 'active_to', new.is_active,
      'months_from', old.duration_months, 'months_to', new.duration_months));
  end if;
  return new;
end $$;
create trigger plans_audit after update on public.plans for each row execute function public.audit_plan_change();

-- ------------------------------------------------------------------------ storage: private proof screenshots
-- Object names are <user_id>/<payment_id>/<file>. The owner uploads while the payment is still pending; the owner and
-- super admins read. Nobody else can see or guess a proof, and the bucket is not public.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('payment-proofs', 'payment-proofs', false, 5242880, array['image/png', 'image/jpeg', 'image/webp', 'application/pdf'])
on conflict (id) do nothing;

create policy proofs_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'payment-proofs' and (storage.foldername(name))[1] = auth.uid()::text
    and exists (select 1 from public.payments p
                where p.id::text = (storage.foldername(name))[2] and p.user_id = auth.uid() and p.status = 'pending'));
create policy proofs_update on storage.objects for update to authenticated
  using (bucket_id = 'payment-proofs' and (storage.foldername(name))[1] = auth.uid()::text
    and exists (select 1 from public.payments p
                where p.id::text = (storage.foldername(name))[2] and p.user_id = auth.uid() and p.status = 'pending'));
create policy proofs_read on storage.objects for select to authenticated
  using (bucket_id = 'payment-proofs' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_super_admin()));

-- ------------------------------------------------------------------------ functions
-- Error codes used (the app maps them to messages): 42501 not allowed, P0002 not found, 22023 invalid input,
-- 55000 wrong state, 23505 duplicate transaction ID.

-- Starts a payment for a plan. The amount comes from the plans table, never from the caller.
create function public.create_payment(p_plan uuid, p_method text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid(); v_plan public.plans%rowtype; v_id uuid;
begin
  if v_uid is null then raise exception 'Sign in to continue' using errcode = '42501'; end if;
  select * into v_plan from public.plans where id = p_plan and is_active;
  if not found then raise exception 'That plan is not available' using errcode = 'P0002'; end if;
  if not exists (select 1 from public.payment_methods where code = p_method and is_active) then
    raise exception 'That payment method is not available' using errcode = 'P0002';
  end if;
  -- Reuse an unfinished payment for the same plan and method instead of piling up rows.
  select id into v_id from public.payments
    where user_id = v_uid and plan_id = p_plan and method_code = p_method and status = 'pending'
    order by created_at desc limit 1;
  if found then return v_id; end if;
  if (select count(*) from public.payments where user_id = v_uid and status = 'pending') >= 5 then
    raise exception 'You have several unfinished payments. Complete one of them first' using errcode = '55000';
  end if;
  insert into public.payments (user_id, plan_id, plan_name, duration_months, method_code, amount_paisa, currency)
  values (v_uid, v_plan.id, v_plan.name, v_plan.duration_months, p_method, v_plan.price_paisa, v_plan.currency)
  returning id into v_id;
  return v_id;
end $$;

-- The payer submits the transaction ID and proof. Rejects a transaction ID that already backs another live payment.
create function public.submit_payment(p_payment uuid, p_reference text, p_proof_path text, p_note text default null) returns void
language plpgsql security definer set search_path = '' as $$
declare v public.payments%rowtype; v_norm text;
begin
  select * into v from public.payments where id = p_payment for update;
  if not found or v.user_id is distinct from auth.uid() then raise exception 'Payment not found' using errcode = 'P0002'; end if;
  if v.status <> 'pending' then raise exception 'This payment has already been submitted' using errcode = '55000'; end if;
  v_norm := upper(regexp_replace(coalesce(p_reference, ''), '[^A-Za-z0-9]', '', 'g'));
  if char_length(trim(coalesce(p_reference, ''))) > 64 or char_length(v_norm) < 6 then
    raise exception 'Enter the transaction ID exactly as shown on your receipt (at least 6 letters or digits)' using errcode = '22023';
  end if;
  if p_proof_path is null or left(p_proof_path, char_length(v.user_id::text || '/' || v.id::text || '/')) <> v.user_id::text || '/' || v.id::text || '/'
     or p_proof_path like '%..%' then
    raise exception 'Upload a screenshot or receipt of your payment' using errcode = '22023';
  end if;
  if not exists (select 1 from storage.objects where bucket_id = 'payment-proofs' and name = p_proof_path) then
    raise exception 'Upload a screenshot or receipt of your payment' using errcode = '22023';
  end if;
  if exists (select 1 from public.payments
             where reference_norm = v_norm and id <> p_payment and status in ('submitted', 'under_review', 'approved', 'refunded')) then
    raise exception 'That transaction ID has already been submitted. Check it, or contact support if it is yours' using errcode = '23505';
  end if;
  update public.payments set status = 'submitted', reference = trim(p_reference), reference_norm = v_norm,
    proof_path = p_proof_path, payer_note = nullif(trim(coalesce(p_note, '')), ''), submitted_at = now()
  where id = p_payment;
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, details)
  values (auth.uid(), 'payment.submitted', 'payment', p_payment::text,
          jsonb_build_object('code', v.code, 'amount_paisa', v.amount_paisa, 'method', v.method_code));
end $$;

-- Super admin picks a submitted payment up for review (idempotent).
create function public.claim_payment_review(p_payment uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare v public.payments%rowtype;
begin
  if not public.is_super_admin() then raise exception 'Not allowed' using errcode = '42501'; end if;
  select * into v from public.payments where id = p_payment for update;
  if not found then raise exception 'Payment not found' using errcode = 'P0002'; end if;
  if v.status = 'under_review' then return; end if;
  if v.status <> 'submitted' then raise exception 'Only a submitted payment can be taken for review' using errcode = '55000'; end if;
  update public.payments set status = 'under_review' where id = p_payment;
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, details)
  values (auth.uid(), 'payment.review_started', 'payment', p_payment::text, jsonb_build_object('code', v.code));
end $$;

-- Approves a payment and grants Premium. One transaction: the payment row is locked, so two admins clicking at once
-- (or one admin clicking twice) produce exactly one entitlement. Calling it again returns the same entitlement.
create function public.approve_payment(p_payment uuid, p_note text default null) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v public.payments%rowtype; v_ent uuid; v_latest timestamptz; v_open_ended boolean; v_start timestamptz; v_end timestamptz;
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
  -- A renewal starts when the current Premium ends, so paying early never wastes days.
  select max(expires_at), coalesce(bool_or(expires_at is null), false) into v_latest, v_open_ended
    from public.entitlements
    where user_id = v.user_id and scope = 'platform' and revoked_at is null and (expires_at is null or expires_at > now());
  v_start := case when v_open_ended or v_latest is null then now() else v_latest end;
  v_end := v_start + make_interval(months => v.duration_months);
  insert into public.entitlements (user_id, scope, scope_id, source, starts_at, expires_at, granted_by, note, payment_id)
  values (v.user_id, 'platform', null, 'subscription', v_start, v_end, auth.uid(), 'Payment ' || v.code, p_payment)
  returning id into v_ent;
  update public.payments set status = 'approved', reviewed_by = auth.uid(), reviewed_at = now(),
    review_note = nullif(trim(coalesce(p_note, '')), '') where id = p_payment;
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, details)
  values (auth.uid(), 'payment.approved', 'payment', p_payment::text,
          jsonb_build_object('code', v.code, 'user_id', v.user_id, 'amount_paisa', v.amount_paisa, 'plan', v.plan_name,
                             'entitlement_id', v_ent, 'starts_at', v_start, 'expires_at', v_end));
  return v_ent;
end $$;

-- Rejects a payment with a reason the payer will see. Idempotent; an approved payment cannot be rejected here.
create function public.reject_payment(p_payment uuid, p_reason text) returns void
language plpgsql security definer set search_path = '' as $$
declare v public.payments%rowtype;
begin
  if not public.is_super_admin() then raise exception 'Not allowed' using errcode = '42501'; end if;
  if char_length(trim(coalesce(p_reason, ''))) < 3 or char_length(p_reason) > 500 then
    raise exception 'Give a short reason (3 to 500 characters) so the payer knows what to fix' using errcode = '22023';
  end if;
  select * into v from public.payments where id = p_payment for update;
  if not found then raise exception 'Payment not found' using errcode = 'P0002'; end if;
  if v.user_id = auth.uid() then raise exception 'You cannot review your own payment' using errcode = '42501'; end if;
  if v.status = 'rejected' then return; end if;
  if v.status not in ('submitted', 'under_review') then
    raise exception 'Only a submitted payment can be rejected' using errcode = '55000';
  end if;
  update public.payments set status = 'rejected', reviewed_by = auth.uid(), reviewed_at = now(), review_note = trim(p_reason)
  where id = p_payment;
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, details)
  values (auth.uid(), 'payment.rejected', 'payment', p_payment::text,
          jsonb_build_object('code', v.code, 'user_id', v.user_id, 'reason', trim(p_reason)));
end $$;

revoke execute on function public.create_payment(uuid, text), public.submit_payment(uuid, text, text, text),
  public.claim_payment_review(uuid), public.approve_payment(uuid, text), public.reject_payment(uuid, text) from public, anon;
grant execute on function public.create_payment(uuid, text), public.submit_payment(uuid, text, text, text),
  public.claim_payment_review(uuid), public.approve_payment(uuid, text), public.reject_payment(uuid, text) to authenticated;
