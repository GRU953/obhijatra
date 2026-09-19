-- WHAT THIS DOES
--   Makes "publishing is printing" a fact the database enforces, rather than a
--   promise people have to remember. You can print edition 4, but you can never
--   change the copies already handed out.
--
-- WHY IT IS BUILT THIS WAY
--   An adversarial review found that stating the guarantee was not the same as
--   having it. Four holes, all closed here:
--     1. Any signed-in account could publish. There was no such thing as a
--        supervisor, so every field worker's password carried full publishing
--        power -- on phones that may be shared.
--     2. Validation ran only on the form author's own laptop. The server would
--        have accepted any JSON at all.
--     3. "The database cannot alter a published edition" was untrue for the
--        owner role, which is the very credential assumed to be compromised.
--     4. One account could fill the shared free database and put EVERY
--        organisation into read-only mode.

-- 1. There is now such a thing as a supervisor.
alter table profiles add column if not exists role text not null default 'worker';
alter table profiles drop constraint if exists profiles_role_known;
alter table profiles add constraint profiles_role_known check (role in ('worker', 'supervisor'));

create or replace function current_role_name() returns text
language sql stable security definer set search_path = public as $$
  select role from profiles where id = auth.uid()
$$;

-- 2. A sealed edition of a form.
create table if not exists form_versions (
  organisation_id uuid not null references organisations(id),
  form_id         text not null,
  edition         int  not null check (edition >= 1),
  definition      jsonb not null,
  -- A short code worked out from the contents. The phone refuses an edition
  -- whose code does not match, which is the one job this is genuinely good at.
  fingerprint     text not null,
  published_by    uuid not null,
  published_at    timestamptz not null default now(),
  primary key (organisation_id, form_id, edition),
  -- Refused by the database itself, on a laptop, in front of the person who
  -- caused it -- never discovered in a village.
  constraint definition_not_too_large check (octet_length(definition::text) <= 262144)
);

create index if not exists form_versions_by_org on form_versions (organisation_id, form_id, edition desc);

alter table form_versions enable row level security;
-- FORCE matters: without it the table owner bypasses its own rules.
alter table form_versions force row level security;

drop policy if exists "read your own organisation editions" on form_versions;
create policy "read your own organisation editions"
  on form_versions for select using (organisation_id = current_organisation());

-- Nobody inserts directly. Publishing goes through the function below, which is
-- the only route in, so a hand-made request has nowhere to land.
revoke insert, update, delete on form_versions from authenticated;

-- 3. A sealed edition is sealed against everyone, including the owner.
--    A trigger fires for the owner and for service scripts; row-level rules do
--    not. Honest limitation: an owner determined to do so can still disable a
--    trigger. The database is a strong lock against its own owner, not a wall.
--    The real wall is on the phone, which refuses an edition whose fingerprint
--    has changed since it last saw it.
create or replace function refuse_changing_a_published_edition() returns trigger
language plpgsql as $$
begin
  raise exception
    'A published edition cannot be % . Publish a new edition instead. (form %, edition %)',
    lower(tg_op), coalesce(old.form_id, '?'), coalesce(old.edition, -1);
end $$;

drop trigger if exists form_versions_are_sealed on form_versions;
create trigger form_versions_are_sealed
  before update or delete on form_versions
  for each row execute function refuse_changing_a_published_edition();

-- 4. Publishing: the only way in, and it counts the cost.
create or replace function publish_form_version(
  p_form_id     text,
  p_definition  jsonb,
  p_fingerprint text
) returns int
language plpgsql security definer set search_path = public as $$
declare
  the_org      uuid := current_organisation();
  next_edition int;
  editions_now int;
  bytes_now    bigint;
begin
  if the_org is null then
    raise exception 'You are not part of an organisation, so you cannot publish.';
  end if;
  if current_role_name() is distinct from 'supervisor' then
    raise exception 'Only a supervisor can publish a form. Ask your supervisor to publish it for you.';
  end if;

  -- One organisation must not be able to fill the shared database and put every
  -- other organisation into read-only mode. Refused here, with real numbers.
  select count(*), coalesce(sum(octet_length(definition::text)), 0)
    into editions_now, bytes_now
    from form_versions where organisation_id = the_org;

  if editions_now >= 200 then
    raise exception
      'Your organisation already has % published editions, and the limit is 200. Contact support before publishing more.',
      editions_now;
  end if;
  if bytes_now + octet_length(p_definition::text) > 20971520 then
    raise exception
      'Your organisation''s forms would total more than 20 MB (currently % MB). Contact support before publishing more.',
      round(bytes_now / 1048576.0, 1);
  end if;

  select coalesce(max(edition), 0) + 1 into next_edition
    from form_versions where organisation_id = the_org and form_id = p_form_id;

  insert into form_versions (organisation_id, form_id, edition, definition, fingerprint, published_by)
  values (the_org, p_form_id, next_edition, p_definition, p_fingerprint, auth.uid());

  return next_edition;
end $$;

revoke all on function publish_form_version(text, jsonb, text) from public;
grant execute on function publish_form_version(text, jsonb, text) to authenticated;
