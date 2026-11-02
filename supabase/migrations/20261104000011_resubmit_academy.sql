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
