-- WHAT THIS DOES
--   Closes a hole in the protection that migration 0003 described as absolute.
--
-- THE HOLE, STATED ACCURATELY
--   0003 put a trigger on form_versions refusing any change to a row, and the
--   tests prove it binds even the database's own owner. But PostgreSQL fires row
--   triggers for UPDATE and DELETE only, never for a statement-level clear.
--
--   A review claimed one command would therefore empty every published form.
--   Running it showed that is not quite true: a plain clear is already refused,
--   because answers point at editions through a foreign key and PostgreSQL will
--   not empty a table something else depends on. The claim was overstated, and
--   the test caught it.
--
--   What IS true, and is the reason this migration exists: the cascading form of
--   that command ignores the foreign-key check and would take every answer with
--   it. And the incidental protection disappears entirely for any table nothing
--   points at -- which is exactly the case for the access log Phase 3 is about
--   to build. Relying on a foreign key that happens to exist is not a design.
--
--   This is the kind of gap that gets copied forward: the access log Phase 3 is
--   about to build needs the same protection, and would have inherited the same
--   hole from the same pattern.
--
--   Honest limit, restated: a determined owner can still switch a trigger off.
--   This is a strong lock against its own owner, not a wall. The real wall
--   remains on the phone, which refuses an edition whose fingerprint has changed
--   since it last held it.

create or replace function refuse_emptying_a_sealed_table() returns trigger
language plpgsql as $$
begin
  raise exception
    'Table % holds sealed records and cannot be emptied. Individual rows cannot be changed or removed either.',
    tg_table_name;
end $$;

drop trigger if exists form_versions_cannot_be_emptied on form_versions;
create trigger form_versions_cannot_be_emptied
  before truncate on form_versions
  for each statement execute function refuse_emptying_a_sealed_table();
