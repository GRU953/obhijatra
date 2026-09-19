// WHAT THIS FILE IS FOR
//   Sends work collected offline up to the server when a connection appears.
//   This is the whole of "sync" for form answers, and it is short because a
//   submitted answer never changes -- so there is nothing to merge, and two
//   workers in different villages cannot overwrite each other.
//
// THE RULE THAT MATTERS
//   Nothing is ever marked as sent until the server has confirmed it. If the
//   connection dies halfway, the work stays on the phone and is tried again.
//   A field worker losing a day's work is the worst thing this app could do.
import { getSupabase } from '../remote/supabase'
import { listUnsent, markSent, countWaiting, type Submission } from '../local/submissions'

/** Small enough to succeed on a weak rural connection, big enough to be quick. */
export const BATCH_SIZE = 50

export type DrainResult = { sent: number; failed: number; stillWaiting: number }

function toServerRow(s: Submission) {
  return {
    // The phone's own identity is used as the server's identity, so sending the
    // same submission twice cannot create two records.
    id: s.id,
    organisation_id: s.organisationId,
    form_id: s.formId,
    form_version: s.formVersion,
    collected_by: s.collectedBy,
    collected_at: s.collectedAt,
    device_id: s.deviceId,
    answers: s.answers,
  }
}

export async function drainQueue(): Promise<DrainResult> {
  const waiting = await listUnsent()
  if (waiting.length === 0) return { sent: 0, failed: 0, stillWaiting: 0 }

  const supabase = getSupabase()
  let sent = 0
  let failed = 0

  for (let i = 0; i < waiting.length; i += BATCH_SIZE) {
    const batch = waiting.slice(i, i + BATCH_SIZE)
    try {
      const { error } = await supabase
        .from('submissions')
        .upsert(batch.map(toServerRow), { onConflict: 'id', ignoreDuplicates: true })

      if (error) { failed += batch.length; continue }
      await markSent(batch.map(s => s.id))   // only after the server confirmed
      sent += batch.length
    } catch {
      // No connection, or it dropped mid-request. Leave everything exactly as
      // it is. It will be tried again next time, and nothing is lost.
      failed += batch.length
    }
  }

  return { sent, failed, stillWaiting: await countWaiting() }
}
