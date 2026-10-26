import { PGlite } from "@electric-sql/pglite";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

const MIGRATIONS = path.resolve(__dirname, "../../supabase/migrations");

// Minimal stand-ins for the parts of Supabase our migrations depend on.
const SUPABASE_STUBS = `
  create role anon nologin;
  create role authenticated nologin;
  create schema auth;
  create table auth.users (
    id uuid primary key default gen_random_uuid(),
    raw_user_meta_data jsonb default '{}'::jsonb
  );
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
  $$;
  create schema storage;
  create table storage.buckets (
    id text primary key, name text, public boolean default false,
    file_size_limit bigint, allowed_mime_types text[]
  );
  create table storage.objects (
    id uuid primary key default gen_random_uuid(), bucket_id text, name text
  );
  alter table storage.objects enable row level security;
  create function storage.foldername(name text) returns text[] language sql immutable as $$
    select string_to_array(name, '/')
  $$;
  grant usage on schema auth, storage to anon, authenticated;
  grant execute on function auth.uid() to anon, authenticated;
  grant execute on function storage.foldername(text) to anon, authenticated;
  grant select, insert, update, delete on storage.objects to authenticated;
  grant select on storage.buckets to authenticated;
`;

export async function createTestDb() {
  const db = new PGlite({ extensions: { pg_trgm } });
  await db.exec("create extension if not exists pgcrypto;").catch(() => {});
  await db.exec(SUPABASE_STUBS);
  const files = readdirSync(MIGRATIONS).filter((f) => f.endsWith(".sql")).sort();
  for (const f of files) {
    await db.exec(readFileSync(path.join(MIGRATIONS, f), "utf8"));
    if (f.startsWith("0001")) {
      // Supabase grants table privileges to API roles by default; RLS does the filtering.
      await db.exec(`
        grant usage on schema public to anon, authenticated;
        grant select, insert, update, delete on all tables in schema public to authenticated;
        grant usage, select on all sequences in schema public to authenticated;
        grant execute on all functions in schema public to authenticated;
        revoke execute on function public.consume_ai_quota(text, integer) from public, anon;
      `);
    }
  }
  return db;
}

export async function createUser(db: PGlite, name = "Test User") {
  const r = await db.query<{ id: string }>(
    `insert into auth.users (raw_user_meta_data) values ($1::jsonb) returning id`,
    [JSON.stringify({ full_name: name })],
  );
  return r.rows[0].id;
}

/** Run `fn` as an authenticated end user (RLS applies), then restore the superuser. */
export async function asUser<T>(db: PGlite, userId: string, fn: () => Promise<T>): Promise<T> {
  await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub', '${userId}', false);`);
  try {
    return await fn();
  } finally {
    await db.exec(`reset role; select set_config('request.jwt.claim.sub', '', false);`);
  }
}
