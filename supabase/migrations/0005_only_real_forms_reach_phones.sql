-- WHAT THIS DOES
--   Stops placeholder editions being offered to phones.
--
-- WHY IT IS NEEDED
--   Migration 0004 created an edition for each form that already had answers,
--   so those answers had something valid to point at. Those placeholders have
--   NO questions and carry the literal word 'reconstructed' where a real
--   fingerprint belongs. A phone quite rightly refused one and told the worker
--   "hello edition 1 did not arrive intact" -- the check doing precisely its
--   job, on a row that should never have been offered to it in the first place.
--
--   A placeholder is not a form. It is a gravestone for a form that was written
--   in code before publishing existed. Nobody should fill one in.
--
-- WHY A VIEW RATHER THAN A COLUMN
--   Published editions are sealed: a trigger refuses any update, deliberately,
--   including from the database owner. Marking existing rows would mean standing
--   that protection down. A view needs no row to change at all, so the seal is
--   never loosened -- which matters more than tidiness.

create or replace view form_editions_for_collection
with (security_invoker = true) as
  select organisation_id, form_id, edition, definition, fingerprint, published_at
    from form_versions
   where coalesce((definition->>'reconstructed')::boolean, false) = false
     and jsonb_array_length(coalesce(definition->'questions', '[]'::jsonb)) > 0;

comment on view form_editions_for_collection is
  'Editions a phone may collect answers against. Excludes placeholders created so that older answers had a valid edition to point at; those are not forms and have no questions.';

grant select on form_editions_for_collection to authenticated;
