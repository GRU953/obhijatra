// WHAT THIS FILE IS FOR
//   Asking the server which form editions exist, and fetching the ones this
//   phone does not yet hold.
//
//   Listing is deliberately separate from fetching. The list is a few hundred
//   bytes -- a name, a number and a short code per form -- so a phone on a weak
//   connection can find out what it is missing without downloading anything it
//   already has.
import { getSupabase } from './supabase'
import type { FormDefinition } from '../../forms/definition'
import type { EditionSource, EditionSummary } from '../sync/formDownload'

export const serverEditions: EditionSource = {
  async listEditions(): Promise<EditionSummary[]> {
    const { data, error } = await getSupabase()
      .from('form_versions')
      .select('form_id, edition, fingerprint')
    if (error) throw new Error(error.message)
    return (data ?? []) as EditionSummary[]
  },

  async fetchEdition(formId: string, edition: number) {
    const { data, error } = await getSupabase()
      .from('form_versions')
      .select('definition, fingerprint')
      .eq('form_id', formId).eq('edition', edition)
      .single()
    if (error) throw new Error(error.message)
    const row = data as { definition: FormDefinition; fingerprint: string }
    return { definition: row.definition, fingerprint: row.fingerprint }
  },
}
