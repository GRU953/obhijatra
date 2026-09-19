-- WHAT THIS DOES
--   Ties every answer to the sealed edition of the form that produced it, so
--   that an answer given three years ago still means exactly what it meant on
--   the day. Without this link, an administrator publishing a new edition would
--   silently change the meaning of every older answer in every report.
--
-- TWO TRAPS THIS MIGRATION HAS TO STEP AROUND, BOTH FOUND BEFORE RUNNING IT
--
--   1. Rows already exist. Two submissions were collected during Phase 1,
--      against a form that was written in code and never published. A foreign
--      key added without warning would be unsatisfiable for them, and the
--      migration would fail on the live database with an error that reads like
--      a bug. They are given a real edition below, marked plainly as one that
--      was reconstructed rather than published by a person.
--
--   2. Migration 0003 turned on FORCE ROW LEVEL SECURITY, which -- deliberately
--      -- binds the table's own owner as well. That is what makes a sealed
--      edition sealed against an accidental dashboard edit. It also means this
--      migration cannot write the backfill rows without standing the rule down
--      for the length of the backfill and putting it straight back.

-- ---------------------------------------------------------------------------
-- 1. Give every form that already has answers a real edition to point at.
-- ---------------------------------------------------------------------------
alter table form_versions no force row level security;

insert into form_versions (organisation_id, form_id, edition, definition, fingerprint, published_by, published_at)
select distinct on (s.organisation_id, s.form_id, s.form_version)
       s.organisation_id,
       s.form_id,
       s.form_version,
       jsonb_build_object(
         'formId',  s.form_id,
         'edition', s.form_version,
         'title',   jsonb_build_object('bn', s.form_id, 'en', s.form_id),
         'questions', '[]'::jsonb,
         -- Said plainly in the data itself, not only in this comment: nobody
         -- published this. It was reconstructed so that older answers have
         -- something honest to point at.
         'reconstructed', true,
         'reconstructedNote', 'Created automatically so answers collected before forms were publishable have an edition to point at. No person published this.'
       ),
       'reconstructed',
       s.collected_by,
       min(s.collected_at) over (partition by s.organisation_id, s.form_id, s.form_version)
  from submissions s
 where not exists (
   select 1 from form_versions v
    where v.organisation_id = s.organisation_id
      and v.form_id = s.form_id
      and v.edition = s.form_version)
on conflict do nothing;

alter table form_versions force row level security;

-- ---------------------------------------------------------------------------
-- 2. Now the link can be added, and nothing can be collected against a form
--    that was never published.
-- ---------------------------------------------------------------------------
alter table submissions drop constraint if exists submissions_point_at_an_edition;
alter table submissions add constraint submissions_point_at_an_edition
  foreign key (organisation_id, form_id, form_version)
  references form_versions (organisation_id, form_id, edition);
