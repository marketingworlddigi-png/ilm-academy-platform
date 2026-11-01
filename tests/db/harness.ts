// Runs the real migrations in an in-process Postgres (PGlite) with a minimal stand-in for Supabase's
// auth/storage schemas and roles. Lets us test RLS and access rules without any Supabase project.
import { PGlite } from "@electric-sql/pglite";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

const MIGRATIONS = path.resolve(__dirname, "../../supabase/migrations");

const SUPABASE_SHIM = `
create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
create schema auth; create schema storage;
grant usage on schema public, auth, storage to anon, authenticated, service_role;
create table auth.users (id uuid primary key default gen_random_uuid(), raw_user_meta_data jsonb default '{}');
create function auth.uid() returns uuid language sql stable as
  $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
create table storage.buckets (id text primary key, name text, public boolean default false, file_size_limit bigint, allowed_mime_types text[]);
create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text references storage.buckets(id), name text, owner uuid);
alter table storage.objects enable row level security;
grant all on storage.buckets, storage.objects to anon, authenticated, service_role;
create function storage.foldername(name text) returns text[] language sql immutable as $$ select string_to_array(name, '/') $$;
`;

export async function createDb() {
  const db = new PGlite();
  await db.exec(SUPABASE_SHIM);
  const files = readdirSync(MIGRATIONS).filter((f) => f.endsWith(".sql")).sort();
  for (const f of files) await db.exec(readFileSync(path.join(MIGRATIONS, f), "utf8"));
  return db;
}

export type Db = PGlite;

/** Run fn as a signed-in user (RLS applies) or anonymous (null). Always resets afterwards. */
export async function as<T>(db: Db, userId: string | null, fn: () => Promise<T>): Promise<T> {
  await db.exec(userId ? `set role authenticated; set request.jwt.claim.sub = '${userId}'` : `set role anon; set request.jwt.claim.sub = ''`);
  try {
    return await fn();
  } finally {
    await db.exec(`reset role; set request.jwt.claim.sub = ''`);
  }
}

/** Expect a statement to fail (permission denied / RLS / trigger exception). */
export async function denied(db: Db, userId: string | null, sql: string): Promise<boolean> {
  try {
    await as(db, userId, async () => {
      await db.exec(sql);
    });
    return false;
  } catch {
    return true;
  }
}

export async function newUser(db: Db, name: string): Promise<string> {
  const r = await db.query<{ id: string }>(
    `insert into auth.users (raw_user_meta_data) values ($1::jsonb) returning id`,
    [JSON.stringify({ full_name: name })],
  );
  return r.rows[0].id;
}
