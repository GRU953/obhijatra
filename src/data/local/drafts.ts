// WHAT THIS FILE IS FOR
//   Holding an interview that is still being filled in.
//
// WHY IT EXISTS AT ALL
//   The app saves as the worker goes, so ten minutes of walking is not lost when
//   Android kills the app on a 3.7 GB phone. That saving has to go SOMEWHERE,
//   and the one place it must never go is the table the uploader drains.
//
//   A submission is immutable by deliberate design: the server has no update
//   policy and no delete policy. So a half-filled interview that reached that
//   table would be uploaded as a final record and could never be completed,
//   corrected or withdrawn by anyone, at any price -- a household register
//   saying a family has no children, uploaded while the worker was still
//   correcting it, sitting on the server for ever.
//
//   It also protects the owner's privacy decision. Deleting an answer the worker
//   hid only means anything if the answer never left the phone. Hiding happens
//   at the moment a draft becomes a submission, before anything is uploadable.
import { openEncryptedDatabase } from './database'
import { LOCAL_SCHEMA } from './schema'
import { canWorkOffline } from './submissions'

export type Draft = {
  id: string
  organisationId: string
  formId: string
  formVersion: number
  collectedBy: string
  deviceId: string
  answers: Record<string, unknown>
  startedAt: string
  updatedAt: string
}

export type DraftInput = Omit<Draft, 'id' | 'startedAt' | 'updatedAt'> & { id?: string }

async function db() {
  const connection = await openEncryptedDatabase()
  await connection.execute(LOCAL_SCHEMA)
  return connection
}

type Row = {
  id: string; organisation_id: string; form_id: string; form_version: number
  collected_by: string; device_id: string; answers_json: string
  started_at: string; updated_at: string
}

const toDraft = (row: Row): Draft => ({
  id: row.id, organisationId: row.organisation_id, formId: row.form_id,
  formVersion: row.form_version, collectedBy: row.collected_by, deviceId: row.device_id,
  answers: JSON.parse(row.answers_json) as Record<string, unknown>,
  startedAt: row.started_at, updatedAt: row.updated_at,
})

/**
 * Writes what has been answered so far. Called as the worker moves between
 * questions, so nothing depends on them reaching the Save button.
 * Returns the draft's identity; pass it back to keep updating the same one.
 */
export async function saveDraft(input: DraftInput): Promise<string> {
  if (!canWorkOffline()) throw new Error('Drafts are kept on the phone. The website saves straight to the server.')
  const id = input.id ?? crypto.randomUUID()
  const now = new Date().toISOString()
  const connection = await db()
  const existing = await connection.query('SELECT started_at FROM drafts WHERE id = ?', [id])
  const startedAt = (existing.values?.[0] as { started_at?: string } | undefined)?.started_at ?? now

  await connection.run(
    `INSERT INTO drafts (id, organisation_id, form_id, form_version, collected_by, device_id, answers_json, started_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?)
     ON CONFLICT(id) DO UPDATE SET answers_json = excluded.answers_json, updated_at = excluded.updated_at`,
    [id, input.organisationId, input.formId, input.formVersion, input.collectedBy,
     input.deviceId, JSON.stringify(input.answers), startedAt, now])
  return id
}

export async function loadDraft(id: string): Promise<Draft | null> {
  const connection = await db()
  const result = await connection.query('SELECT * FROM drafts WHERE id = ?', [id])
  const row = result.values?.[0] as Row | undefined
  return row ? toDraft(row) : null
}

export async function listDrafts(): Promise<Draft[]> {
  const connection = await db()
  const result = await connection.query('SELECT * FROM drafts ORDER BY updated_at DESC')
  return ((result.values ?? []) as Row[]).map(toDraft)
}

export async function discardDraft(id: string): Promise<void> {
  const connection = await db()
  await connection.run('DELETE FROM drafts WHERE id = ?', [id])
}

/**
 * The moment an interview stops being unfinished. The draft becomes a
 * submission and the draft is removed, both together -- so there is no instant
 * at which the same interview exists twice, and none at which it exists nowhere.
 */
export async function finishDraft(id: string): Promise<string> {
  const draft = await loadDraft(id)
  if (!draft) throw new Error('That unfinished form is no longer on this phone, so it cannot be completed.')

  const connection = await db()
  const submissionId = crypto.randomUUID()
  await connection.execute('BEGIN')
  try {
    await connection.run(
      `INSERT INTO submissions
         (id, organisation_id, form_id, form_version, collected_by, collected_at, device_id, answers_json, sent_at)
       VALUES (?,?,?,?,?,?,?,?,NULL)`,
      [submissionId, draft.organisationId, draft.formId, draft.formVersion, draft.collectedBy,
       new Date().toISOString(), draft.deviceId, JSON.stringify(draft.answers)])
    await connection.run('DELETE FROM drafts WHERE id = ?', [id])
    await connection.execute('COMMIT')
  } catch (error) {
    await connection.execute('ROLLBACK')
    throw error
  }
  return submissionId
}

/** Only for tests. */
export async function resetDraftsForTest(): Promise<void> {
  const connection = await db()
  await connection.execute('DELETE FROM drafts;')
}
