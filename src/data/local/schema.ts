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
`
