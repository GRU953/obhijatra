// WHAT THIS FILE IS FOR
//   Keeping the sealed editions a phone has received.
//
//   They live inside the locked database like everything else. A form's wording
//   can itself be sensitive: the questions a programme asks reveal what that
//   programme is, and in some places that is enough to identify who is being
//   helped.
import { openEncryptedDatabase } from './database'
import { LOCAL_SCHEMA } from './schema'
import type { FormDefinition } from '../../forms/definition'
import type { EditionStore, EditionSummary } from '../sync/formDownload'

async function db() {
  const connection = await openEncryptedDatabase()
  await connection.execute(LOCAL_SCHEMA)
  return connection
}

export const localEditions: EditionStore = {
  async listHeld(): Promise<EditionSummary[]> {
    const connection = await db()
    const result = await connection.query('SELECT form_id, edition, fingerprint FROM form_editions')
    return (result.values ?? []) as EditionSummary[]
  },
  async save(definition: FormDefinition, fingerprint: string): Promise<void> {
    const connection = await db()
    await connection.run(
      `INSERT INTO form_editions (form_id, edition, definition_json, fingerprint, received_at)
       VALUES (?,?,?,?,?)
       ON CONFLICT(form_id, edition) DO NOTHING`,
      [definition.formId, definition.edition, JSON.stringify(definition), fingerprint, new Date().toISOString()])
  },
}

/** Every form this phone can currently be used to fill in, newest edition first. */
export async function formsAvailable(): Promise<FormDefinition[]> {
  const connection = await db()
  // Only the newest edition of each form is offered. Older ones are kept so
  // that answers collected under them still make sense, but nobody starts a
  // new interview on a superseded form.
  const result = await connection.query(
    `SELECT definition_json FROM form_editions f
      WHERE edition = (SELECT MAX(edition) FROM form_editions g WHERE g.form_id = f.form_id)
      ORDER BY form_id`)
  return ((result.values ?? []) as Array<{ definition_json: string }>)
    .map((row) => JSON.parse(row.definition_json) as FormDefinition)
}
