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
--   password from a stored secret so it is never typed into a log.
--
-- EXPECTS: :email, :display_name, :organisation_name, :password

do $$
declare
  new_user uuid := gen_random_uuid();
  the_email text := :'email';
  the_password text := :'password';
begin
  if exists (select 1 from auth.users where email = the_email) then
    raise notice 'SKIPPED: % already exists. Nothing changed.', the_email;
    return;
  end if;

  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at,
    raw_app_meta_data, raw_user_meta_data
  ) values (
    '00000000-0000-0000-0000-000000000000',
    new_user, 'authenticated', 'authenticated', the_email,
    -- crypt() lives in the extensions schema on Supabase.
    extensions.crypt(the_password, extensions.gen_salt('bf')),
    -- Marked as confirmed on creation. A supervisor vouching for a colleague in
    -- person is a stronger check than a link in an inbox nobody reads.
    now(), now(), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('display_name', :'display_name', 'organisation_name', :'organisation_name')
  );

  -- Sign-in also needs a matching identity record, or the password is ignored.
  insert into auth.identities (
    id, user_id, identity_data, provider, provider_id, created_at, updated_at, last_sign_in_at
  ) values (
    gen_random_uuid(), new_user,
    jsonb_build_object('sub', new_user::text, 'email', the_email),
    'email', the_email, now(), now(), now()
  );

  raise notice 'CREATED: % can now sign in. An organisation and profile were made for them automatically.', the_email;
end $$;

-- Show the result, so the run proves what it did.
select u.email,
       p.display_name,
       o.name as organisation,
       (u.email_confirmed_at is not null) as can_sign_in_immediately
  from auth.users u
  join profiles p on p.id = u.id
  join organisations o on o.id = p.organisation_id
 order by u.created_at desc
 limit 5;
