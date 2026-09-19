-- WHAT THIS DOES
--   When someone signs up, they need an organisation to belong to and a profile
--   saying which one -- otherwise every permission rule sees them as belonging
--   nowhere and they can do nothing at all.
--
--   For this first version each new person gets their own organisation. Phase 3
--   replaces this with being invited into an existing one, which is how a real
--   nonprofit works.

create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare new_org uuid;
begin
  insert into organisations (name)
  values (coalesce(new.raw_user_meta_data->>'organisation_name', 'My organisation'))
  returning id into new_org;

  insert into profiles (id, organisation_id, display_name)
  values (new.id, new_org, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)));

  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();
