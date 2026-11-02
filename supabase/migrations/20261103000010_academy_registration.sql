-- Migration 10: academy registration hardening and platform review.
-- Adds academies.status_note, replaces register_academy and academies_guard in place (same signatures), adds review_academy.
-- No DROP, no data deleted.

alter table public.academies add column status_note text check (status_note is null or char_length(status_note) <= 500);

-- Staff may edit name/description but never the review outcome: status, owner and the reviewer's note are platform-only.
create or replace function public.academies_guard() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is not null and not public.is_super_admin() then
    if new.status is distinct from old.status or new.owner_id is distinct from old.owner_id
       or new.status_note is distinct from old.status_note or new.slug is distinct from old.slug then
      raise exception 'Only a platform administrator can change academy status, owner or web address' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;

-- Registration: validated here too (not only in the form), capped per person, audited. Always starts pending.
create or replace function public.register_academy(p_name text, p_slug text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_id uuid; v_name text := trim(coalesce(p_name, '')); v_slug text := lower(trim(coalesce(p_slug, '')));
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  if char_length(v_name) not between 2 and 120 then raise exception 'Enter an academy name of 2 to 120 characters' using errcode = '22023'; end if;
  if v_slug !~ '^[a-z0-9]([a-z0-9-]{1,38})[a-z0-9]$' then
    raise exception 'The web address needs 3 to 40 lowercase letters, numbers or hyphens' using errcode = '22023';
  end if;
  if v_slug in ('admin', 'api', 'auth', 'academy', 'academies', 'account', 'library', 'books', 'pricing', 'checkout', 'login', 'signup',
                'ilm', 'ilm-academy', 'support', 'help', 'www') then
    raise exception 'That web address is reserved' using errcode = '22023';
  end if;
  if (select count(*) from public.academies where owner_id = auth.uid() and deleted_at is null and status in ('pending', 'needs_info', 'active')) >= 3 then
    raise exception 'You already have the maximum number of academies awaiting review or active' using errcode = '53400';
  end if;
  insert into public.academies (name, slug, owner_id, status) values (v_name, v_slug, auth.uid(), 'pending') returning id into v_id;
  insert into public.memberships (academy_id, user_id, role, status) values (v_id, auth.uid(), 'academy_owner', 'active');
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, details)
  values (auth.uid(), 'academy.registered', 'academy', v_id::text, jsonb_build_object('name', v_name, 'slug', v_slug));
  return v_id;
end $$;

-- Platform review. Anything other than 'active' needs a note the academy will see.
create function public.review_academy(p_academy uuid, p_status public.academy_status, p_note text default null) returns void
language plpgsql security definer set search_path = '' as $$
declare a public.academies%rowtype; v_note text := nullif(trim(coalesce(p_note, '')), '');
begin
  if not public.is_super_admin() then raise exception 'Not allowed' using errcode = '42501'; end if;
  select * into a from public.academies where id = p_academy and deleted_at is null for update;
  if not found then raise exception 'Academy not found' using errcode = 'P0002'; end if;
  if p_status = 'pending' then raise exception 'An academy cannot be moved back to pending' using errcode = '22023'; end if;
  if p_status <> 'active' and (v_note is null or char_length(v_note) < 3) then
    raise exception 'Give a short note so the academy knows why' using errcode = '22023';
  end if;
  if v_note is not null and char_length(v_note) > 500 then raise exception 'Keep the note under 500 characters' using errcode = '22023'; end if;
  if a.status = p_status and a.status_note is not distinct from v_note then return; end if;
  update public.academies set status = p_status, status_note = v_note where id = p_academy;
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, details)
  values (auth.uid(), 'academy.reviewed', 'academy', p_academy::text,
          jsonb_build_object('from', a.status, 'to', p_status, 'note', v_note, 'slug', a.slug));
end $$;
revoke execute on function public.review_academy(uuid, public.academy_status, text) from public, anon;
grant execute on function public.review_academy(uuid, public.academy_status, text) to authenticated;
