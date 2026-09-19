-- WHAT THIS DOES
--   Creates a person who can sign in, WITHOUT sending any email.
--
-- WHY IT EXISTS
--   Obhijatra is for nonprofits whose field workers largely do not have email
--   addresses. Asking them to confirm one is not a small inconvenience -- it is
--   a wall. So accounts are made for people by a supervisor, which is how these
--   organisations already work, and no message is ever sent to anybody.
--
--   It is also simply necessary: the free plan's built-in mail allows only a
--   couple of messages an hour, which cannot onboard a team of two hundred.
--
-- HOW IT IS RUN
--   Never by hand. The "Create a user" action on GitHub runs it, taking the
--   password from a stored secret so it never appears in a log.
--
-- A TRAP WORTH KNOWING
--   psql does NOT substitute :variables inside a $$ ... $$ block -- they stay
--   as literal text and the statement fails with "syntax error at or near :".
--   So the values are read into a temporary table FIRST, in plain statements,
--   and the block below reads them from there.
--
-- EXPECTS: :email, :display_name, :organisation_name, :password

create temporary table _input on commit drop as
select :'email'::text             as email,
       :'display_name'::text      as display_name,
       :'organisation_name'::text as organisation_name,
       :'password'::text          as password;

do $$
declare
  new_user uuid := gen_random_uuid();
  i record;
begin
  select * into i from _input;

  if exists (select 1 from auth.users where email = i.email) then
    raise notice 'SKIPPED: % already exists. Nothing was changed.', i.email;
    return;
  end if;

  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at,
    raw_app_meta_data, raw_user_meta_data
  ) values (
    '00000000-0000-0000-0000-000000000000',
    new_user, 'authenticated', 'authenticated', i.email,
    -- crypt() lives in the extensions schema on Supabase.
    extensions.crypt(i.password, extensions.gen_salt('bf')),
    -- Marked confirmed on creation. A supervisor vouching for a colleague in
    -- person is a stronger check than a link in an inbox nobody reads.
    now(), now(), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('display_name', i.display_name, 'organisation_name', i.organisation_name)
  );

  -- Signing in also needs a matching identity record, or the password is ignored.
  insert into auth.identities (
    id, user_id, identity_data, provider, provider_id, created_at, updated_at, last_sign_in_at
  ) values (
    gen_random_uuid(), new_user,
    jsonb_build_object('sub', new_user::text, 'email', i.email),
    'email', i.email, now(), now(), now()
  );

  raise notice 'CREATED: % can now sign in. An organisation and profile were made automatically.', i.email;
end $$;

-- Show the result, so the run proves what it actually did.
select u.email,
       p.display_name,
       o.name as organisation,
       (u.email_confirmed_at is not null) as can_sign_in_now
  from auth.users u
  join profiles p      on p.id = u.id
  join organisations o on o.id = p.organisation_id
 order by u.created_at desc
 limit 5;
