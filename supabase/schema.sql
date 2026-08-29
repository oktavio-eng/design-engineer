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

-- Throttle (added 29/08/2026). The publishable key is public, so anyone can
-- call the insert endpoint in a loop; the CHECKs bound one row, this bounds
-- the rate so a script cannot fill the free-tier quota overnight. Global,
-- not per-IP (PostgREST does not hand the client IP to a trigger reliably):
-- more than 10 rows in the last minute or 200 in the last day → 429-ish
-- error, which mail.js reports as "Couldn't send" only if Web3Forms failed
-- too. SECURITY DEFINER because anon has no SELECT on the table and the
-- count needs one; search_path pinned as the definer-function rule requires.
create or replace function public.messages_throttle()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  last_minute integer;
  last_day integer;
begin
  select count(*) into last_minute from public.messages where created_at > now() - interval '1 minute';
  select count(*) into last_day from public.messages where created_at > now() - interval '1 day';
  if last_minute >= 10 or last_day >= 200 then
    raise exception 'too many messages, try again later' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

revoke all on function public.messages_throttle() from public;

drop trigger if exists messages_throttle on public.messages;
create trigger messages_throttle
  before insert on public.messages
  for each row execute function public.messages_throttle();
