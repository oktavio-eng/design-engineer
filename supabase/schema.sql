-- Messages archive for the mail composer (mail.js), added 29/08/2026.
-- Run once in the Supabase dashboard: SQL Editor → New query → paste → Run.
-- Idempotent: safe to run again.
--
-- Shape: one row per send. The browser inserts with the public anon key,
-- so RLS is what keeps that key harmless — anon may INSERT and nothing
-- else. Reading happens in the dashboard (Table Editor) or with the
-- service role key, never from the site. See docs/messages.md.

create extension if not exists pgcrypto;

create table if not exists public.messages (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  email       text not null,
  message     text not null,
  page        text,
  -- Same rule as EMAIL_RE in mail.js: WHATWG input[type=email], plus at
  -- least one dot in the domain. The browser check is UX; this is the law.
  constraint messages_email_format check (
    email ~ '^[A-Za-z0-9.!#$%&''*+/=?^_`{|}~-]+@[A-Za-z0-9]([A-Za-z0-9-]{0,61}[A-Za-z0-9])?(\.[A-Za-z0-9]([A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+$'
  ),
  constraint messages_email_length  check (char_length(email) <= 254),
  constraint messages_body_length   check (char_length(btrim(message)) between 1 and 5000),
  constraint messages_page_length   check (page is null or char_length(page) <= 200)
);

comment on table public.messages is
  'Messages sent through the site composer (mail.js). Inserted by anon via REST; read only from the dashboard.';

alter table public.messages enable row level security;

-- Anonymous visitors may add a row. No select/update/delete policy exists,
-- so the anon key cannot read anything back — PostgREST answers 201 with an
-- empty body (mail.js sends `Prefer: return=minimal` for exactly that).
drop policy if exists "anon can insert messages" on public.messages;
create policy "anon can insert messages"
  on public.messages
  for insert
  to anon
  with check (true);

-- Belt and braces: the anon role only ever needs INSERT on this table.
revoke all on public.messages from anon;
grant insert on public.messages to anon;

-- Newest first is the only query the dashboard runs.
create index if not exists messages_created_at_idx
  on public.messages (created_at desc);
