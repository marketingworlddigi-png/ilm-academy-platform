-- Migration 4: storage buckets + policies, audit log.
-- Objects in "resources-private" are named <resource_id>/<filename>, so policies can resolve the resource.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('resources-private', 'resources-private', false, 52428800,
     array['application/pdf', 'image/png', 'image/jpeg', 'audio/mpeg', 'application/msword',
           'application/vnd.openxmlformats-officedocument.wordprocessingml.document']),
  ('copyright-evidence', 'copyright-evidence', false, 10485760, array['application/pdf', 'image/png', 'image/jpeg']),
  ('covers-public', 'covers-public', true, 2097152, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do nothing;

-- READ of protected files = the same decision function used by server code. Direct URLs cannot bypass it.
create policy resources_private_read on storage.objects for select to authenticated
  using (bucket_id = 'resources-private' and (
    public.can_access_resource(((storage.foldername(name))[1])::uuid, 'view')
    or public.can_access_resource(((storage.foldername(name))[1])::uuid, 'review')));

-- Upload/replace: super admin or the owning academy's staff.
create policy resources_private_write on storage.objects for insert to authenticated
  with check (bucket_id = 'resources-private' and public.can_access_resource(((storage.foldername(name))[1])::uuid, 'review'));
create policy resources_private_update on storage.objects for update to authenticated
  using (bucket_id = 'resources-private' and public.can_access_resource(((storage.foldername(name))[1])::uuid, 'review'));

-- Copyright evidence: staff upload, super admins read.
create policy evidence_write on storage.objects for insert to authenticated
  with check (bucket_id = 'copyright-evidence' and public.can_access_resource(((storage.foldername(name))[1])::uuid, 'review'));
create policy evidence_read on storage.objects for select to authenticated
  using (bucket_id = 'copyright-evidence' and public.can_access_resource(((storage.foldername(name))[1])::uuid, 'review'));

-- Public covers: anyone reads; only super admins write (academy cover upload added with academy branding in Phase 3).
create policy covers_read on storage.objects for select to anon, authenticated using (bucket_id = 'covers-public');
create policy covers_write on storage.objects for insert to authenticated
  with check (bucket_id = 'covers-public' and public.is_super_admin());

-- ------------------------------------------------------------------ audit log
create table public.audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid,
  academy_id uuid,
  action text not null,
  entity_type text not null,
  entity_id text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index audit_logs_entity_idx on public.audit_logs (entity_type, entity_id);
alter table public.audit_logs enable row level security;
create policy audit_read on public.audit_logs for select to authenticated
  using (public.is_super_admin() or (academy_id is not null and public.is_academy_staff(academy_id)));
-- Append-only: no insert/update/delete from clients; rows come from security-definer triggers.
revoke all on public.audit_logs from anon, authenticated;
grant select on public.audit_logs to authenticated;

create function public.audit_copyright_change() returns trigger language plpgsql security definer set search_path = '' as $$
declare v_academy uuid;
begin
  select academy_id into v_academy from public.resources where id = new.resource_id;
  insert into public.audit_logs (actor_id, academy_id, action, entity_type, entity_id, details)
  values (auth.uid(), v_academy, 'copyright.' || tg_op, 'resource', new.resource_id::text,
    jsonb_build_object('status', new.permission_status, 'license', new.license_type,
      'view', new.allow_online_view, 'download', new.allow_download, 'commercial', new.allow_commercial,
      'expires_at', new.expires_at));
  return new;
end $$;
create trigger copyright_audit after insert or update on public.copyright_permissions
  for each row execute function public.audit_copyright_change();

create function public.audit_academy_status() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.status is distinct from old.status then
    insert into public.audit_logs (actor_id, academy_id, action, entity_type, entity_id, details)
    values (auth.uid(), new.id, 'academy.status_changed', 'academy', new.id::text,
      jsonb_build_object('from', old.status, 'to', new.status));
  end if;
  return new;
end $$;
create trigger academy_status_audit after update on public.academies for each row execute function public.audit_academy_status();
