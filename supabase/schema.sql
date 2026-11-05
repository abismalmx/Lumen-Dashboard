-- Lumen: schema for the optional Supabase backend.
-- Run once in the Supabase SQL editor (or `supabase db push`).
-- Every row belongs to the user who created it; Row Level Security makes the
-- database enforce that, so the browser can hold the public anon key safely.

create table if not exists public.customers (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name        text not null check (char_length(name) between 1 and 120),
  email       text not null check (char_length(email) between 3 and 254),
  plan        text not null check (plan in ('starter', 'pro', 'enterprise')),
  status      text not null check (status in ('active', 'trialing', 'past_due', 'churned')),
  seats       integer not null default 1 check (seats between 0 and 100000),
  tokens      integer not null default 0 check (tokens >= 0),
  joined      date not null,
  last_active date not null,
  location    text not null default '—',
  tint        text not null default 'bg-stone-400/15 text-stone-200',
  invoices    jsonb not null default '[]'::jsonb,
  created_at  timestamptz not null default now()
);

create index if not exists customers_owner_created_idx
  on public.customers (owner_id, created_at desc);

-- One customer per email per account; also lets the first-login seed be idempotent.
create unique index if not exists customers_owner_email_key
  on public.customers (owner_id, email);

alter table public.customers enable row level security;

-- Explicit privileges, so the table works whether or not the project auto-exposes new tables.
-- Anonymous visitors get nothing; signed-in users get exactly CRUD (no TRUNCATE, which RLS cannot restrict),
-- narrowed to their own rows by the policies below.
revoke all on public.customers from anon, authenticated;
grant select, insert, update, delete on public.customers to authenticated;

-- (select auth.uid()) is evaluated once per statement instead of once per row.
drop policy if exists "own rows: read" on public.customers;
create policy "own rows: read" on public.customers for select to authenticated
  using (owner_id = (select auth.uid()));
drop policy if exists "own rows: insert" on public.customers;
create policy "own rows: insert" on public.customers for insert to authenticated
  with check (owner_id = (select auth.uid()));
drop policy if exists "own rows: update" on public.customers;
create policy "own rows: update" on public.customers for update to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
drop policy if exists "own rows: delete" on public.customers;
create policy "own rows: delete" on public.customers for delete to authenticated
  using (owner_id = (select auth.uid()));
