// WHAT THIS FILE IS FOR
//   Bringing published form editions down to a phone, and refusing any that
//   cannot be trusted.
//
// WHY THE PHONE CHECKS AGAIN
//   Every rule about what makes a valid form is enforced when it is written.
//   That protects nobody on its own: those checks run on the form author's own
//   computer, and anyone holding a supervisor's password could send the server
//   whatever they liked. So the phone checks a second time, for itself, before
//   writing anything into its locked database. Five lines, and it holds against
//   a bad server, a stolen password and a future bug in publishing alike.
//
// WHY ONE BAD FORM DOES NOT STOP THE REST
//   A worker with four forms must not lose all four because a fifth is broken.
//   Each edition is judged on its own and refusals are reported together.
import type { FormDefinition } from '../../forms/definition'
import { validateFormDefinition } from '../../forms/validate'
import { fingerprintOf } from '../../forms/fingerprint'

export type EditionSummary = { form_id: string; edition: number; fingerprint: string }

/** What the server can be asked. Kept narrow so it is easy to stand in for. */
export type EditionSource = {
  listEditions: () => Promise<EditionSummary[]>
  fetchEdition: (formId: string, edition: number) => Promise<{ definition: FormDefinition; fingerprint: string }>
}

/** Where editions are kept on the phone. */
export type EditionStore = {
  listHeld: () => Promise<EditionSummary[]>
  save: (definition: FormDefinition, fingerprint: string) => Promise<void>
}

export type DownloadResult = { received: number; refused: string[]; alreadyHeld: number }

export async function downloadEditions(
  source: EditionSource, store: EditionStore,
): Promise<DownloadResult> {
  const offered = await source.listEditions()
  const held = new Map((await store.listHeld()).map((h) => [`${h.form_id}@${h.edition}`, h.fingerprint]))

  let received = 0
  let alreadyHeld = 0
  const refused: string[] = []

  for (const summary of offered) {
    const key = `${summary.form_id}@${summary.edition}`
    const heldFingerprint = held.get(key)

    if (heldFingerprint !== undefined) {
      if (heldFingerprint === summary.fingerprint) { alreadyHeld++; continue }
      // A sealed edition can never change. The phone keeps what it had.
      refused.push(
        `${summary.form_id} edition ${summary.edition} has changed on the server since this phone ` +
        `received it. A published form is never supposed to change. Keeping the copy already on this phone.`)
      continue
    }

    try {
      const { definition, fingerprint } = await source.fetchEdition(summary.form_id, summary.edition)

      const actual = await fingerprintOf(definition)
      if (actual !== fingerprint) {
        refused.push(
          `${summary.form_id} edition ${summary.edition} did not arrive intact: its fingerprint ` +
          `does not match its contents. Not saved.`)
        continue
      }

      // The same check the author's computer ran, run again here, for ourselves.
      const { problems } = validateFormDefinition(definition)
      if (problems.length > 0) {
        refused.push(`${summary.form_id} edition ${summary.edition} is not a valid form: ${problems[0]}`)
        continue
      }

      await store.save(definition, fingerprint)
      received++
    } catch (error) {
      // One form failing must never cost a worker the other four.
      refused.push(
        `${summary.form_id} edition ${summary.edition} could not be collected: ` +
        `${error instanceof Error ? error.message : String(error)}`)
    }
  }

  return { received, refused, alreadyHeld }
}
