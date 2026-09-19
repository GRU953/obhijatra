// WHAT THIS FILE IS FOR
//   Saves a filled-in form onto the phone, and keeps track of which ones have
//   not reached the server yet. Everything here works with no internet at all.
import { Capacitor } from '@capacitor/core'
import { openEncryptedDatabase } from './database'
import { LOCAL_SCHEMA } from './schema'
import { getSupabase } from '../remote/supabase'

/**
 * Whether this device can hold work safely while offline.
 * The phone can: it has a security chip and a locked database. A browser
 * cannot, so the website writes straight to the server and says so plainly.
 */
export function canWorkOffline(): boolean {
  return Capacitor.getPlatform() !== 'web'
}

export type Submission = {
  id: string
  organisationId: string
  formId: string
  formVersion: number
  collectedBy: string
  collectedAt: string
  deviceId: string
  answers: Record<string, unknown>
  sentAt: string | null
}

export type NewSubmission = Omit<Submission, 'id' | 'collectedAt' | 'sentAt'>

async function db() {
  const connection = await openEncryptedDatabase()
  await connection.execute(LOCAL_SCHEMA)
  return connection
}

type Row = {
  id: string; organisation_id: string; form_id: string; form_version: number
  collected_by: string; collected_at: string; device_id: string
  answers_json: string; sent_at: string | null
}

function toSubmission(row: Row): Submission {
  return {
    id: row.id,
    organisationId: row.organisation_id,
    formId: row.form_id,
    formVersion: row.form_version,
    collectedBy: row.collected_by,
    collectedAt: row.collected_at,
    deviceId: row.device_id,
    answers: JSON.parse(row.answers_json) as Record<string, unknown>,
    sentAt: row.sent_at,
  }
}

export async function saveSubmission(input: NewSubmission): Promise<string> {
  const id = crypto.randomUUID()

  if (!canWorkOffline()) {
    // Website: straight to the server. If there is no connection the person is
    // told immediately, rather than being promised their work is safe when a
    // browser cannot honestly make that promise.
    const { error } = await getSupabase().from('submissions').insert({
      id,
      organisation_id: input.organisationId,
      form_id: input.formId,
      form_version: input.formVersion,
      collected_by: input.collectedBy,
      collected_at: new Date().toISOString(),
      device_id: input.deviceId,
      answers: input.answers,
    })
    if (error) throw new Error(error.message)
    return id
  }

  const connection = await db()
  await connection.run(
    `INSERT INTO submissions
       (id, organisation_id, form_id, form_version, collected_by, collected_at, device_id, answers_json, sent_at)
     VALUES (?,?,?,?,?,?,?,?,NULL)`,
    [id, input.organisationId, input.formId, input.formVersion, input.collectedBy,
     new Date().toISOString(), input.deviceId, JSON.stringify(input.answers)])
  return id
}

/** Everything still waiting to reach the server, oldest first. */
export async function listUnsent(): Promise<Submission[]> {
  if (!canWorkOffline()) return []   // the website never queues
  const connection = await db()
  const result = await connection.query(
    `SELECT * FROM submissions WHERE sent_at IS NULL ORDER BY collected_at ASC, id ASC`)
  return ((result.values ?? []) as Row[]).map(toSubmission)
}

export async function countWaiting(): Promise<number> {
  if (!canWorkOffline()) return 0
  const connection = await db()
  const result = await connection.query(
    `SELECT count(*) AS n FROM submissions WHERE sent_at IS NULL`)
  return Number((result.values?.[0] as { n: number } | undefined)?.n ?? 0)
}

/** Called only after the server has confirmed it has them. */
export async function markSent(ids: string[]): Promise<void> {
  if (ids.length === 0) return
  const connection = await db()
  const places = ids.map(() => '?').join(',')
  await connection.run(
    `UPDATE submissions SET sent_at = ? WHERE id IN (${places})`,
    [new Date().toISOString(), ...ids])
}

/** Only for tests. */
export async function resetLocalForTest(): Promise<void> {
  const connection = await db()
  await connection.execute('DELETE FROM submissions;')
}
