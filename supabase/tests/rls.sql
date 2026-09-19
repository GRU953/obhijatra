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

insert into submissions (organisation_id, form_id, form_version, collected_by, collected_at, device_id, answers)
values ('00000000-0000-0000-0000-0000000000a1', 'hello', 1,
        '00000000-0000-0000-0000-0000000000a2', now(), 'phone-a', '{"name":"A only"}');

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

rollback;   -- the test leaves nothing behind
