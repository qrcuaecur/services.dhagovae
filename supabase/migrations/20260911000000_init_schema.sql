-- =========================================================
-- QR Document Management System - initial schema
-- Run this once against a fresh Supabase project.
-- =========================================================

-- Supabase keeps extensions out of public. gen_random_uuid() below is
-- deliberately left unqualified: it is core Postgres (pg_catalog) since 13,
-- not pgcrypto, so it needs no schema prefix.
create extension if not exists pg_trgm with schema extensions;

-- ---------------------------------------------------------
-- profiles: one row per portal user, carries the role
-- ---------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  role text not null default 'viewer'
    check (role in ('admin', 'super_admin', 'editor', 'viewer')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 'viewer' is the deliberately powerless default: it has no policies anywhere,
-- so an auth user only gains access when explicitly promoted to 'admin'.
comment on table public.profiles is
  'Portal users. role drives RLS. Only admin is used in v1; other values reserved for future roles.';

-- ---------------------------------------------------------
-- documents
-- ---------------------------------------------------------
create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(btrim(title)) between 1 and 300),
  description text not null default '',
  document_number text,
  category text,
  tags text[] not null default '{}',
  version text,
  file_name text not null,
  file_path text not null,
  file_type text not null,
  file_size bigint not null check (file_size > 0),
  storage_bucket text not null default 'documents',
  status text not null default 'active'
    check (status in ('active', 'archived', 'expired')),
  expires_at timestamptz,
  deleted_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- The QR code encodes /document/{id}. Regenerating an id invalidates every
-- printed code that points at it, so ids are permanent once issued.
comment on column public.documents.id is
  'Stable public identifier encoded in the QR code. Never reassign.';
comment on column public.documents.deleted_at is
  'Soft-delete marker. Kept separate from status so archived and deleted stay distinct.';

-- ---------------------------------------------------------
-- document_access_logs: reserved for future scan analytics.
-- Created and secured now; nothing writes to it in v1.
-- ---------------------------------------------------------
create table if not exists public.document_access_logs (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents(id) on delete cascade,
  accessed_at timestamptz not null default now(),
  user_agent text,
  device_type text,
  country text
);

-- ---------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------
create index if not exists idx_documents_status on public.documents (status);
create index if not exists idx_documents_category on public.documents (category);
create index if not exists idx_documents_created_at on public.documents (created_at desc);
create index if not exists idx_documents_live on public.documents (created_at desc)
  where deleted_at is null;
create index if not exists idx_documents_tags on public.documents using gin (tags);
-- Operator classes are schema-qualified so these don't depend on the
-- running role's search_path including `extensions`.
create index if not exists idx_documents_title_trgm
  on public.documents using gin (title extensions.gin_trgm_ops);
create index if not exists idx_documents_number_trgm
  on public.documents using gin (document_number extensions.gin_trgm_ops);
create index if not exists idx_documents_file_name_trgm
  on public.documents using gin (file_name extensions.gin_trgm_ops);

create index if not exists idx_access_logs_document on public.document_access_logs (document_id);
create index if not exists idx_access_logs_time on public.document_access_logs (accessed_at desc);

-- ---------------------------------------------------------
-- updated_at maintenance
-- ---------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

drop trigger if exists documents_set_updated_at on public.documents;
create trigger documents_set_updated_at
  before update on public.documents
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------
-- is_admin(): security definer so policies on profiles can call it
-- without recursing through profiles' own RLS.
-- ---------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

-- ---------------------------------------------------------
-- Every auth user gets a profile row automatically, at the
-- powerless default role. Prevents the "logged in but no profile
-- row, silently broken" state without granting anything.
-- ---------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, role)
  values (new.id, new.email, 'viewer')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------
-- Row Level Security
--
-- anon gets NO policies on any of these tables. The public document
-- page reads through a service-role server client instead, which lets
-- it tell "not found" from "archived" from "expired" (a row-filtering
-- policy can only make rows vanish, which collapses all three into an
-- empty result). Leaving anon with zero policies means a future
-- mistake -- wiring a public page to the anon client -- returns
-- nothing rather than leaking rows.
-- ---------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.documents enable row level security;
alter table public.document_access_logs enable row level security;

drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.is_admin());

drop policy if exists profiles_admin_update on public.profiles;
create policy profiles_admin_update on public.profiles
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- No insert/delete policy on profiles: rows are created by
-- handle_new_user (security definer) and removed by auth.users cascade.

drop policy if exists documents_admin_select on public.documents;
create policy documents_admin_select on public.documents
  for select to authenticated using (public.is_admin());

drop policy if exists documents_admin_insert on public.documents;
create policy documents_admin_insert on public.documents
  for insert to authenticated with check (public.is_admin());

drop policy if exists documents_admin_update on public.documents;
create policy documents_admin_update on public.documents
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- No delete policy: removal is a soft delete (update deleted_at).

drop policy if exists access_logs_admin_select on public.document_access_logs;
create policy access_logs_admin_select on public.document_access_logs
  for select to authenticated using (public.is_admin());

-- ---------------------------------------------------------
-- Storage: private bucket. Anonymous visitors never read from it
-- directly -- the server mints short-lived signed URLs instead.
-- ---------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'documents',
  'documents',
  false,
  52428800,
  array[
    'application/pdf',
    'image/png',
    'image/jpeg',
    'image/webp',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation'
  ]
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Some projects don't grant the SQL editor ownership of storage.objects. If
-- that's the case here, the rest of this migration still applies and the
-- notice below explains the one manual step left.
do $$
begin
  begin
    drop policy if exists documents_bucket_admin_all on storage.objects;

    create policy documents_bucket_admin_all on storage.objects
      for all to authenticated
      using (bucket_id = 'documents' and public.is_admin())
      with check (bucket_id = 'documents' and public.is_admin());

    raise notice 'Storage policy created.';
  exception
    -- Only a permissions failure is tolerated, and only because some projects
    -- don't grant the SQL editor ownership of storage.objects. Any other error
    -- is a real problem and is allowed to abort the migration rather than
    -- leaving it looking successful.
    when insufficient_privilege then
      raise notice 'No permission to create the storage policy (%). Add it by hand: Storage -> documents -> Policies -> New policy, for role "authenticated", ALL operations, using and with check: bucket_id = ''documents'' and public.is_admin()', sqlerrm;
  end;
end
$$;

-- ---------------------------------------------------------
-- Verification. Every row below should report 'ok'.
-- ---------------------------------------------------------
select 'tables' as check,
       case when count(*) = 3 then 'ok' else 'MISSING: expected 3, found ' || count(*) end as result
from information_schema.tables
where table_schema = 'public'
  and table_name in ('profiles', 'documents', 'document_access_logs')

union all
select 'rls enabled',
       -- coalesce covers the zero-rows case, where bool_and returns null.
       case when coalesce(bool_and(rowsecurity), false) then 'ok' else 'MISSING: RLS is off or a table is absent' end
from pg_tables
where schemaname = 'public'
  and tablename in ('profiles', 'documents', 'document_access_logs')

union all
select 'no anon policies',
       case when count(*) = 0 then 'ok' else 'WARNING: ' || count(*) || ' policy grants anon access' end
from pg_policies
where schemaname = 'public'
  and tablename in ('profiles', 'documents', 'document_access_logs')
  and 'anon' = any(roles)

union all
select 'private bucket',
       case when exists (select 1 from storage.buckets where id = 'documents' and public = false)
            then 'ok' else 'MISSING: documents bucket is absent or public' end

union all
select 'storage policy',
       case when exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects'
                           and policyname = 'documents_bucket_admin_all')
            then 'ok' else 'ADD BY HAND: see the notice above' end

union all
select 'is_admin function',
       case when exists (select 1 from pg_proc where proname = 'is_admin') then 'ok' else 'MISSING' end

union all
select 'new-user trigger',
       case when exists (select 1 from pg_trigger where tgname = 'on_auth_user_created') then 'ok' else 'MISSING' end;
