-- Migration 9: (a) platform Premium covers platform-owned resources only; (b) append-only double-entry ledger,
-- written by approve_payment. Additive except for replacing two functions in place (CREATE OR REPLACE, same signatures).
-- No DROP, no data deleted.

-- ------------------------------------------------------------------ (a) premium scope
-- Before: a platform Premium entitlement opened premium books of every academy.
-- Now: platform Premium opens only platform-owned books (academy_id is null). An academy's premium books need a
-- resource entitlement or an academy-scoped entitlement, so an academy is paid for what it sells.
create or replace function public.can_access_resource(p_resource uuid, p_purpose text) returns boolean
language plpgsql stable security definer set search_path = '' as $$
declare
  r public.resources%rowtype;
  v_uid uuid := auth.uid();
  v_academy_active boolean := true;
begin
  select * into r from public.resources where id = p_resource and deleted_at is null;
  if not found then return false; end if;

  if p_purpose = 'review' then
    return v_uid is not null and (public.is_super_admin() or (r.academy_id is not null and public.is_academy_staff(r.academy_id)));
  end if;
  if p_purpose not in ('view', 'download') then return false; end if;

  if r.status <> 'published' then return false; end if;
  if r.academy_id is not null then
    select (a.status = 'active' and a.deleted_at is null) into v_academy_active from public.academies a where a.id = r.academy_id;
    if not coalesce(v_academy_active, false) then return false; end if;
  end if;

  -- Legal gate first: no tier or purchase can override it.
  if not public.resource_legally_allows(p_resource, p_purpose) then return false; end if;

  -- Every file requires a signed-in account (free accounts included).
  if v_uid is null then return false; end if;

  case r.access_tier
    when 'free' then return true;
    when 'premium' then
      return (r.academy_id is null and public.has_entitlement(v_uid, 'platform', null))
          or public.has_entitlement(v_uid, 'resource', r.id)
          or (r.academy_id is not null and public.has_entitlement(v_uid, 'academy', r.academy_id));
    when 'academy' then
      return r.academy_id is not null and (
        public.has_academy_role(r.academy_id, array['academy_owner','academy_admin','instructor','student']::public.membership_role[])
        or public.has_entitlement(v_uid, 'academy', r.academy_id));
  end case;
  return false;
end $$;

-- ------------------------------------------------------------------ (b) ledger
create type public.ledger_account_kind as enum ('asset', 'liability', 'revenue', 'expense');

create table public.ledger_accounts (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  kind public.ledger_account_kind not null,
  academy_id uuid references public.academies (id) on delete restrict, -- null = platform account
  created_at timestamptz not null default now()
);

-- Signed integer paisa: debit positive, credit negative. Every transaction group (txn_id) sums to zero.
create table public.ledger_entries (
  id bigint generated always as identity primary key,
  txn_id uuid not null,
  account_id uuid not null references public.ledger_accounts (id) on delete restrict,
  amount_paisa bigint not null check (amount_paisa <> 0),
  currency text not null default 'PKR' check (currency = 'PKR'),
  entry_type text not null check (entry_type in ('payment_received')),
  payment_id uuid references public.payments (id) on delete restrict,
  description text,
  created_by uuid references auth.users (id) on delete restrict,
  created_at timestamptz not null default now()
);
create index ledger_entries_txn_idx on public.ledger_entries (txn_id);
create index ledger_entries_account_idx on public.ledger_entries (account_id, created_at);
-- A payment can be recorded once per account and type, so a retried approval can never double-count.
create unique index ledger_entries_payment_uniq on public.ledger_entries (payment_id, account_id, entry_type) where payment_id is not null;

-- Insert-only, enforced even against the table owner and the service role.
create function public.ledger_immutable() returns trigger language plpgsql set search_path = '' as $$
begin
  raise exception 'Ledger rows cannot be changed or deleted; post a correcting entry instead' using errcode = '55000';
end $$;
create trigger ledger_entries_no_update before update or delete on public.ledger_entries
  for each row execute function public.ledger_immutable();
create trigger ledger_entries_no_truncate before truncate on public.ledger_entries
  for each statement execute function public.ledger_immutable();

-- Each transaction group must balance to zero when the transaction commits.
create function public.ledger_check_balanced() returns trigger language plpgsql set search_path = '' as $$
begin
  if (select coalesce(sum(amount_paisa), 0) from public.ledger_entries where txn_id = new.txn_id) <> 0 then
    raise exception 'Ledger transaction % does not balance', new.txn_id using errcode = '23514';
  end if;
  return null;
end $$;
create constraint trigger ledger_entries_balanced after insert on public.ledger_entries
  deferrable initially deferred for each row execute function public.ledger_check_balanced();

alter table public.ledger_accounts enable row level security;
alter table public.ledger_entries enable row level security;
revoke all on public.ledger_accounts, public.ledger_entries from anon, authenticated;
grant select on public.ledger_accounts, public.ledger_entries to authenticated;
-- Platform accounts: super admins only. Academy accounts (later): that academy's owner/admins, and super admins.
create policy ledger_accounts_read on public.ledger_accounts for select to authenticated
  using (public.is_super_admin() or (academy_id is not null and public.is_academy_staff(academy_id)));
create policy ledger_entries_read on public.ledger_entries for select to authenticated
  using (public.is_super_admin() or exists (
    select 1 from public.ledger_accounts a where a.id = account_id and a.academy_id is not null and public.is_academy_staff(a.academy_id)));

insert into public.ledger_accounts (code, name, kind) values
  ('platform:receipts', 'Platform receipts (money received, awaiting settlement)', 'asset'),
  ('platform:subscription_revenue', 'Platform subscription revenue', 'revenue');

-- Posts one balanced payment_received transaction for a payment. Internal: not granted to any client role.
create function public.post_payment_ledger(p_payment uuid, p_actor uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v public.payments%rowtype; v_txn uuid := gen_random_uuid(); v_recv uuid; v_rev uuid;
begin
  select * into v from public.payments where id = p_payment;
  if not found then raise exception 'Payment not found' using errcode = 'P0002'; end if;
  if exists (select 1 from public.ledger_entries where payment_id = p_payment and entry_type = 'payment_received') then return; end if;
  select id into v_recv from public.ledger_accounts where code = 'platform:receipts';
  select id into v_rev from public.ledger_accounts where code = 'platform:subscription_revenue';
  insert into public.ledger_entries (txn_id, account_id, amount_paisa, entry_type, payment_id, description, created_by) values
    (v_txn, v_recv,  v.amount_paisa, 'payment_received', p_payment, 'Payment ' || v.code || ' received', p_actor),
    (v_txn, v_rev,  -v.amount_paisa, 'payment_received', p_payment, 'Payment ' || v.code || ' revenue',  p_actor);
end $$;
revoke all on function public.post_payment_ledger(uuid, uuid) from public, anon, authenticated;

-- approve_payment, now also writing the ledger in the same transaction. Otherwise unchanged from migration 8.
create or replace function public.approve_payment(p_payment uuid, p_note text default null) returns uuid
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
  perform public.post_payment_ledger(p_payment, auth.uid());
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, details)
  values (auth.uid(), 'payment.approved', 'payment', p_payment::text,
          jsonb_build_object('code', v.code, 'user_id', v.user_id, 'amount_paisa', v.amount_paisa, 'plan', v.plan_name,
                             'entitlement_id', v_ent, 'starts_at', v_start, 'expires_at', v_end));
  return v_ent;
end $$;
revoke execute on function public.approve_payment(uuid, text) from public, anon;
grant execute on function public.approve_payment(uuid, text) to authenticated;

-- Payments approved before this migration get their ledger entries once (no-op when there are none).
select public.post_payment_ledger(p.id, p.reviewed_by) from public.payments p
  where p.status = 'approved'
    and not exists (select 1 from public.ledger_entries e where e.payment_id = p.id and e.entry_type = 'payment_received');
