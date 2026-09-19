// Proves the phone checks a form BEFORE trusting it. An adversarial review found
// that every rule was enforced only on the form author's own laptop, and the
// server would have accepted any JSON at all -- so one password was enough to
// push a broken or hostile form to every phone in an organisation.
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { fingerprintOf, canonicalJson } from '../../src/forms/fingerprint'
import type { FormDefinition } from '../../src/forms/definition'

const t = (s: string) => ({ bn: s, en: s })
const sound: FormDefinition = {
  formId: 'household', edition: 1, title: t('Household'),
  questions: [{ id: 'name', type: 'short-text', label: t('Name'), required: true }],
}

describe('the fingerprint of an edition', () => {
  it('is the same for the same form, however the keys are ordered', async () => {
    const reordered = { questions: sound.questions, title: sound.title, edition: 1, formId: 'household' }
    expect(await fingerprintOf(sound)).toBe(await fingerprintOf(reordered as FormDefinition))
  })
  it('changes when a single letter of a label changes', async () => {
    const edited = { ...sound, questions: [{ ...sound.questions[0]!, label: t('Namé') }] }
    expect(await fingerprintOf(edited)).not.toBe(await fingerprintOf(sound))
  })
  it('changes when a question is removed', async () => {
    expect(await fingerprintOf({ ...sound, questions: [] })).not.toBe(await fingerprintOf(sound))
  })
  it('writes keys in a fixed order, so two machines agree', () => {
    expect(canonicalJson({ b: 1, a: 2 })).toBe('{"a":2,"b":1}')
    expect(canonicalJson({ a: { d: 1, c: 2 } })).toBe('{"a":{"c":2,"d":1}}')
    expect(canonicalJson([{ z: 1, y: 2 }])).toBe('[{"y":2,"z":1}]')
  })
})

describe('receiving editions from the server', () => {
  const held = new Map<string, { definition: FormDefinition; fingerprint: string }>()
  let fetched: FormDefinition[] = []

  beforeEach(() => { held.clear(); fetched = []; vi.clearAllMocks() })

  const server = (rows: Array<{ form_id: string; edition: number; definition: FormDefinition; fingerprint: string }>) => ({
    listEditions: async () => rows.map(r => ({ form_id: r.form_id, edition: r.edition, fingerprint: r.fingerprint })),
    fetchEdition: async (formId: string, edition: number) => {
      const row = rows.find(r => r.form_id === formId && r.edition === edition)
      if (!row) throw new Error('not found')
      fetched.push(row.definition)
      return { definition: row.definition, fingerprint: row.fingerprint }
    },
  })

  const store = {
    listHeld: async () => [...held.entries()].map(([key, v]) => {
      const [form_id, edition] = key.split('@')
      return { form_id: form_id!, edition: Number(edition), fingerprint: v.fingerprint }
    }),
    save: async (d: FormDefinition, fingerprint: string) => { held.set(`${d.formId}@${d.edition}`, { definition: d, fingerprint }) },
  }

  it('downloads an edition it does not yet hold', async () => {
    const { downloadEditions } = await import('../../src/data/sync/formDownload')
    const fp = await fingerprintOf(sound)
    const result = await downloadEditions(
      server([{ form_id: 'household', edition: 1, definition: sound, fingerprint: fp }]), store)
    expect(result.received).toBe(1)
    expect(held.size).toBe(1)
  })

  it('does not download one it already holds', async () => {
    const { downloadEditions } = await import('../../src/data/sync/formDownload')
    const fp = await fingerprintOf(sound)
    await store.save(sound, fp)
    const result = await downloadEditions(
      server([{ form_id: 'household', edition: 1, definition: sound, fingerprint: fp }]), store)
    expect(result.received).toBe(0)
    expect(fetched).toHaveLength(0)
  })

  it('REFUSES an edition whose fingerprint does not match its contents', async () => {
    const { downloadEditions } = await import('../../src/data/sync/formDownload')
    const result = await downloadEditions(
      server([{ form_id: 'household', edition: 1, definition: sound, fingerprint: 'not-the-real-one' }]), store)
    expect(result.received).toBe(0)
    expect(result.refused).toHaveLength(1)
    expect(result.refused[0]).toMatch(/fingerprint|does not match/i)
    expect(held.size).toBe(0)
  })

  it('REFUSES a form the validator rejects, even though the server sent it', async () => {
    // One password must not be enough to push a broken form to every phone.
    const broken: FormDefinition = { ...sound, questions: [
      { id: 'a', type: 'short-text', label: t('A'), required: false,
        showIf: { question: 'later', operator: 'is', value: 1 } },
      { id: 'later', type: 'whole-number', label: t('Later'), required: false },
    ] }
    const { downloadEditions } = await import('../../src/data/sync/formDownload')
    const result = await downloadEditions(
      server([{ form_id: 'household', edition: 1, definition: broken, fingerprint: await fingerprintOf(broken) }]), store)
    expect(result.received).toBe(0)
    expect(result.refused.join(' ')).toMatch(/later/)
    expect(held.size).toBe(0)
  })

  it('REFUSES an edition it already holds whose fingerprint has since changed', async () => {
    // A sealed edition can never change. If the server says it did, the server
    // is wrong or someone has tampered -- the phone keeps what it had.
    const { downloadEditions } = await import('../../src/data/sync/formDownload')
    await store.save(sound, await fingerprintOf(sound))
    const result = await downloadEditions(
      server([{ form_id: 'household', edition: 1, definition: sound, fingerprint: 'changed-since' }]), store)
    expect(result.refused.join(' ')).toMatch(/changed/i)
    expect(result.received).toBe(0)
  })

  it('keeps going when one edition is bad, so one broken form cannot block the rest', async () => {
    const other: FormDefinition = { ...sound, formId: 'attendance' }
    const { downloadEditions } = await import('../../src/data/sync/formDownload')
    const result = await downloadEditions(server([
      { form_id: 'household',  edition: 1, definition: sound, fingerprint: 'wrong' },
      { form_id: 'attendance', edition: 1, definition: other, fingerprint: await fingerprintOf(other) },
    ]), store)
    expect(result.received).toBe(1)
    expect(result.refused).toHaveLength(1)
  })
})
