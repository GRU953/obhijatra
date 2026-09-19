-- THE MOST IMPORTANT TEST IN THE PROJECT
--   Proves one nonprofit cannot read or write another's records. If this ever
--   stops failing where it should fail, beneficiary data leaks between
--   organisations and cannot be recalled once it is on a phone in a village.
--
--   Tested at the database level rather than through the app, because the
--   database is where the rule actually lives. Runs on every push.

begin;

-- Two organisations, and one worker in each.
insert into organisations (id, name) values
  ('00000000-0000-0000-0000-0000000000a1', 'Test Organisation A'),
  ('00000000-0000-0000-0000-0000000000b1', 'Test Organisation B')
on conflict (id) do nothing;

-- profiles points at the sign-in table, so the two test people must exist there
-- first. We are testing the permission rules, not the sign-up screen, so the
-- bare minimum is enough. Everything is undone at the end.
insert into auth.users (id, email, instance_id, aud, role)
values ('00000000-0000-0000-0000-0000000000a2', 'worker.a@test.invalid',
        '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated'),
       ('00000000-0000-0000-0000-0000000000b2', 'worker.b@test.invalid',
        '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated')
on conflict (id) do nothing;

-- Creating a sign-in record now fires the trigger from migration 0002, which
-- gives that person their own brand-new organisation. For this test we want
-- them in the two specific organisations above, so we overwrite what the
-- trigger chose. (Without this the test fails with "worker A cannot see their
-- own submissions" -- which is correct, because the trigger had moved them.)
insert into profiles (id, organisation_id, display_name) values
  ('00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-0000000000a1', 'Worker A'),
  ('00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-0000000000b1', 'Worker B')
on conflict (id) do update
  set organisation_id = excluded.organisation_id,
      display_name    = excluded.display_name;

-- An answer may only point at an edition that exists, so one is published
-- first. This is the same order every real phone follows.
alter table form_versions no force row level security;
insert into form_versions (organisation_id, form_id, edition, definition, fingerprint, published_by)
values ('00000000-0000-0000-0000-0000000000a1', 'hello', 1,
        '{"formId":"hello","edition":1}'::jsonb, 'test', '00000000-0000-0000-0000-0000000000a2')
on conflict do nothing;
alter table form_versions force row level security;

insert into submissions (organisation_id, form_id, form_version, collected_by, collected_at, device_id, answers)
values ('00000000-0000-0000-0000-0000000000a1', 'hello', 1,
        '00000000-0000-0000-0000-0000000000a2', now(), 'phone-a', '{"name":"A only"}');

-- Roles are assigned BEFORE the session starts acting as a signed-in user.
-- A signed-in account must never be able to promote itself to supervisor, and
-- there is deliberately no update policy on profiles that would let it. Doing
-- this after the role switch silently changes nothing, which is correct.
update profiles set role = 'worker'     where id = '00000000-0000-0000-0000-0000000000a2';
update profiles set role = 'supervisor' where id = '00000000-0000-0000-0000-0000000000b2';

-- Prove that the wall just relied on is real, rather than assuming it.
do $$
declare changed int;
begin
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a2","role":"authenticated"}';
  update profiles set role = 'supervisor' where id = '00000000-0000-0000-0000-0000000000a2';
  get diagnostics changed = row_count;
  reset role;
  if changed > 0 then
    raise exception 'FAILED: a worker promoted themselves to supervisor';
  end if;
  raise notice 'PASS: a worker cannot promote themselves to supervisor';
end $$;

-- Become Worker A.
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a2","role":"authenticated"}';

do $$
declare n int;
begin
  select count(*) into n from submissions;
  if n < 1 then
    raise exception 'FAILED: worker A cannot see their own organisation submissions (saw %)', n;
  end if;
  raise notice 'PASS: worker A sees their own submissions (%)', n;
end $$;

-- Become Worker B, in the other organisation.
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000b2","role":"authenticated"}';

do $$
declare leaked int;
begin
  select count(*) into leaked from submissions
   where organisation_id = '00000000-0000-0000-0000-0000000000a1';
  if leaked > 0 then
    raise exception 'FAILED: worker B can see % row(s) belonging to organisation A', leaked;
  end if;
  raise notice 'PASS: worker B sees none of organisation A''s submissions';
end $$;

do $$
begin
  begin
    insert into submissions (organisation_id, form_id, form_version, collected_by, collected_at, device_id, answers)
    values ('00000000-0000-0000-0000-0000000000a1', 'hello', 1,
            '00000000-0000-0000-0000-0000000000b2', now(), 'phone-b', '{"name":"intrusion"}');
    raise exception 'FAILED: worker B was allowed to write into organisation A';
  exception when insufficient_privilege or check_violation then
    raise notice 'PASS: worker B was refused when writing into organisation A';
  end;
end $$;

-- ============================================================================
-- SEALED EDITIONS (added with migration 0003)
-- ============================================================================

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a2","role":"authenticated"}';
do $$
begin
  begin
    perform publish_form_version('household',
    '{"formId":"household","edition":1,"questions":[{"id":"name"}]}'::jsonb, 'abc');
    raise exception 'FAILED: a plain worker was allowed to publish a form';
  exception when others then
    if position('supervisor' in sqlerrm) = 0 then raise; end if;
    raise notice 'PASS: a plain worker was refused when publishing';
  end;
end $$;

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000b2","role":"authenticated"}';
do $$
declare made int;
begin
  -- A realistic form. The first version of this fixture had no questions at
  -- all, and the view correctly hid it from phones -- which failed the test and
  -- was the right answer. A form with no questions is not a form.
  made := publish_form_version('household',
    '{"formId":"household","edition":1,"title":{"bn":"পরিবার","en":"Household"},
      "questions":[{"id":"name","type":"short-text","required":true,
                    "label":{"bn":"নাম","en":"Name"}}]}'::jsonb, 'abc');
  if made <> 1 then raise exception 'FAILED: first edition should be numbered 1, got %', made; end if;
  raise notice 'PASS: a supervisor published edition %', made;
end $$;

-- A sealed edition is protected by TWO separate layers, so both are tested.
-- Layer 1: a signed-in account has no permission to update the table at all,
-- so it is stopped before anything else runs.
do $$
begin
  begin
    update form_versions set fingerprint = 'tampered'
     where organisation_id = '00000000-0000-0000-0000-0000000000b1';
    raise exception 'FAILED: a signed-in account altered a published edition';
  exception when insufficient_privilege then
    raise notice 'PASS: a signed-in account has no permission to alter a published edition';
  end;
end $$;

-- Layer 2: the trigger, which is the one that also binds the database owner and
-- any service script. Row permissions do not bind the owner; a trigger does.
-- This is the layer that catches an accidental edit from the Supabase dashboard.
do $$
begin
  reset role;
  begin
    update form_versions set fingerprint = 'tampered'
     where organisation_id = '00000000-0000-0000-0000-0000000000b1';
    raise exception 'FAILED: the owner altered a published edition';
  exception when others then
    if position('cannot be' in sqlerrm) = 0 then raise; end if;
    raise notice 'PASS: even the database owner is refused when altering a published edition';
  end;
  begin
    delete from form_versions where organisation_id = '00000000-0000-0000-0000-0000000000b1';
    raise exception 'FAILED: the owner deleted a published edition';
  exception when others then
    if position('cannot be' in sqlerrm) = 0 then raise; end if;
    raise notice 'PASS: even the database owner is refused when deleting a published edition';
  end;
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000b2","role":"authenticated"}';
end $$;

-- Sealed must also mean sealed against being emptied wholesale.
--
-- A plain clear is already refused, but only because answers point at editions
-- through a foreign key -- PostgreSQL will not empty a table something else
-- depends on. That protection is real but incidental: it disappears the moment
-- a table has nothing pointing at it, which is exactly the case for the access
-- log Phase 3 is about to build.
--
-- The genuinely dangerous command is the one that ignores that check and takes
-- every answer with it. That is what is tested here.
do $$
begin
  reset role;
  begin
    execute 'truncate form_versions cascade';
    raise exception 'FAILED: one command cleared every published form and every answer with it';
  exception when others then
    if position('cannot be emptied' in sqlerrm) = 0 then raise; end if;
    raise notice 'PASS: sealed editions cannot be emptied wholesale, even by the owner, even with cascade';
  end;
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000b2","role":"authenticated"}';
end $$;

-- A placeholder edition must never be offered to a phone.
do $$
declare offered int;
begin
  reset role;
  insert into form_versions (organisation_id, form_id, edition, definition, fingerprint, published_by)
  values ('00000000-0000-0000-0000-0000000000b1', 'placeholder', 1,
          '{"formId":"placeholder","edition":1,"questions":[],"reconstructed":true}'::jsonb,
          'reconstructed', '00000000-0000-0000-0000-0000000000b2')
  on conflict do nothing;
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000b2","role":"authenticated"}';

  select count(*) into offered from form_editions_for_collection where form_id = 'placeholder';
  if offered > 0 then
    raise exception 'FAILED: a placeholder edition was offered to phones';
  end if;
  raise notice 'PASS: a placeholder edition is not offered to phones';

  select count(*) into offered from form_editions_for_collection where form_id = 'household';
  if offered = 0 then
    raise exception 'FAILED: a real published form was hidden from phones';
  end if;
  raise notice 'PASS: a real published form is still offered to phones';
end $$;

do $$
begin
  begin
    insert into submissions (organisation_id, form_id, form_version, collected_by, collected_at, device_id, answers)
    values ('00000000-0000-0000-0000-0000000000b1', 'never-published', 1,
            '00000000-0000-0000-0000-0000000000b2', now(), 'phone-b', '{}');
    raise exception 'FAILED: an answer was accepted against a form nobody published';
  exception when foreign_key_violation then
    raise notice 'PASS: an answer against a form nobody published was refused';
  end;
end $$;

do $$
begin
  begin
    perform publish_form_version('huge', jsonb_build_object('pad', repeat('x', 300000)), 'abc');
    raise exception 'FAILED: a 300 KB definition was accepted';
  exception when check_violation then
    raise notice 'PASS: a definition larger than 256 KB was refused';
  end;
end $$;

rollback;   -- the test leaves nothing behind
