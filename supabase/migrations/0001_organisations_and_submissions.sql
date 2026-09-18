-- WHAT THIS DOES
--   Creates the three tables the first version needs, and the wall that stops
--   one nonprofit ever reading another's records. Every table that holds data
--   carries organisation_id, and every rule checks it.
--
-- Applied automatically by .github/workflows/migrate.yml. Never run by hand
-- from a laptop, so the database password never leaves GitHub.

create table if not exists organisations (
  id   uuid primary key default gen_random_uuid(),
  name text not null
);

create table if not exists profiles (
  id              uuid primary key references auth.users(id) on delete cascade,
  organisation_id uuid not null references organisations(id),
  display_name    text not null
);

create table if not exists submissions (
  id              uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references organisations(id),
  form_id         text not null,
  form_version    int  not null,
  collected_by    uuid not null,
  collected_at    timestamptz not null,
  device_id       text not null,
  answers         jsonb not null,
  -- The server decides the order, never the phone. A phone's clock can be wrong,
  -- and a thief can set it to anything at all.
  server_seq      bigserial not null,
  received_at     timestamptz not null default now()
);

create index if not exists submissions_org_seq on submissions (organisation_id, server_seq);

-- Which organisation is the person making this request in?
create or replace function current_organisation() returns uuid
language sql stable security definer set search_path = public as $$
  select organisation_id from profiles where id = auth.uid()
$$;

alter table organisations enable row level security;
alter table profiles      enable row level security;
alter table submissions   enable row level security;

drop policy if exists "see only your own organisation" on organisations;
create policy "see only your own organisation"
  on organisations for select using (id = current_organisation());

drop policy if exists "see only colleagues" on profiles;
create policy "see only colleagues"
  on profiles for select using (organisation_id = current_organisation());

drop policy if exists "read only your organisation submissions" on submissions;
create policy "read only your organisation submissions"
  on submissions for select using (organisation_id = current_organisation());

-- A phone may only write rows tagged with its own organisation, and only as the
-- person who is signed in. Both halves matter: without the second, any worker
-- could file a submission in a colleague's name.
drop policy if exists "write only your organisation submissions" on submissions;
create policy "write only your organisation submissions"
  on submissions for insert with check (
    organisation_id = current_organisation() and collected_by = auth.uid()
  );

-- Submissions are never changed or deleted by a phone. They are evidence.
-- No update or delete policy exists, so both are refused by default.
