// WHAT THIS FILE IS FOR
//   The tables inside the phone's locked database. Kept deliberately small: a
//   submitted answer never changes, so there is nothing to reconcile later and
//   no conflict between two workers to resolve.
export const LOCAL_SCHEMA = `
CREATE TABLE IF NOT EXISTS submissions (
  id              TEXT PRIMARY KEY NOT NULL,
  organisation_id TEXT NOT NULL,
  form_id         TEXT NOT NULL,
  form_version    INTEGER NOT NULL,
  collected_by    TEXT NOT NULL,
  collected_at    TEXT NOT NULL,
  device_id       TEXT NOT NULL,
  answers_json    TEXT NOT NULL,
  sent_at         TEXT
);
CREATE INDEX IF NOT EXISTS submissions_unsent
  ON submissions (collected_at) WHERE sent_at IS NULL;

-- Unfinished interviews live HERE, not in submissions, and the uploader never
-- looks in this table.
--
-- Why that separation is the most important line in this file: a submission is
-- immutable by deliberate design -- the server has no update policy and no
-- delete policy on it. If a half-filled interview could reach that table, it
-- would be uploaded as a final record and could never afterwards be completed,
-- corrected or withdrawn by anyone, at any price. A household register saying a
-- family has no children, uploaded while the worker was still correcting it,
-- would sit on the server for ever.
CREATE TABLE IF NOT EXISTS drafts (
  id              TEXT PRIMARY KEY NOT NULL,
  organisation_id TEXT NOT NULL,
  form_id         TEXT NOT NULL,
  form_version    INTEGER NOT NULL,
  collected_by    TEXT NOT NULL,
  device_id       TEXT NOT NULL,
  answers_json    TEXT NOT NULL,
  started_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL
);
`
