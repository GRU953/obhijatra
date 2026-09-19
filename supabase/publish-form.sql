-- WHAT THIS DOES
--   Publishes a form file as a new sealed edition.
--
-- WHY IT PRETENDS TO BE THE SUPERVISOR
--   It would be easy to write the row directly as the database owner. That
--   would go AROUND the permission rules instead of through them, and the
--   rule that only a supervisor may publish would then be untested in the one
--   place it is actually used. So this signs in as the named supervisor and
--   calls the same function their phone would call. If they are not a
--   supervisor, this fails -- which is the correct outcome.
--
-- EXPECTS: :supervisor_email, :form_id, :definition, :fingerprint

create temporary table _publish on commit drop as
select :'supervisor_email'::text as email,
       :'form_id'::text          as form_id,
       :'definition'::jsonb      as definition,
       :'fingerprint'::text      as fingerprint;

do $$
declare
  who        uuid;
  their_org  uuid;
  new_edition int;
  i record;
begin
  select * into i from _publish;

  select id into who from auth.users where email = i.email;
  if who is null then
    raise exception 'No account with the address %. Create it first with the "Create a user" action.', i.email;
  end if;

  select organisation_id into their_org from profiles where id = who;

  -- Become that person, so the same rules apply as on their phone.
  perform set_config('request.jwt.claims',
                     json_build_object('sub', who::text, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';

  new_edition := publish_form_version(i.form_id, i.definition, i.fingerprint);

  reset role;
  raise notice 'PUBLISHED: % edition % for organisation %', i.form_id, new_edition, their_org;
end $$;

select form_id, edition, left(fingerprint, 12) as fingerprint, published_at
  from form_versions order by published_at desc limit 5;
