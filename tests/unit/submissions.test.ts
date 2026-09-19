// Proves a form filled in with no signal is genuinely saved, and stays saved.
// Backed by a real in-memory SQLite database, so the SQL is actually exercised.
import { describe, it, expect, beforeEach } from 'vitest'
import { saveSubmission, listUnsent, markSent, countWaiting, resetLocalForTest }
  from '../../src/data/local/submissions'

const base = {
  formId: 'hello', formVersion: 1, organisationId: 'org-a',
  collectedBy: 'worker-1', deviceId: 'phone-1',
}

describe('saving a form with no internet', () => {
  beforeEach(async () => { await resetLocalForTest() })

  it('saves an answer and reports it as not yet sent', async () => {
    await saveSubmission({ ...base, answers: { name: 'Rahima', village: 'Shibganj' } })
    const waiting = await listUnsent()
    expect(waiting).toHaveLength(1)
    expect(waiting[0]!.answers['name']).toBe('Rahima')
  })

  it('keeps every submission — an answer is evidence, never edited', async () => {
    await saveSubmission({ ...base, answers: { name: 'A' } })
    await saveSubmission({ ...base, answers: { name: 'B' } })
    expect(await countWaiting()).toBe(2)
  })

  it('gives each submission its own identity', async () => {
    const first = await saveSubmission({ ...base, answers: { name: 'A' } })
    const second = await saveSubmission({ ...base, answers: { name: 'A' } })
    expect(first).not.toBe(second)
  })

  it('stops listing a submission once the server has confirmed it', async () => {
    const id = await saveSubmission({ ...base, answers: { name: 'C' } })
    await markSent([id])
    expect(await countWaiting()).toBe(0)
  })

  it('always records which organisation the answer belongs to', async () => {
    await saveSubmission({ ...base, answers: {} })
    expect((await listUnsent())[0]!.organisationId).toBe('org-a')
  })

  it('records which version of the form was used', async () => {
    // Without this, an administrator deleting a question later would silently
    // erase years of evidence from every report.
    await saveSubmission({ ...base, answers: {} })
    expect((await listUnsent())[0]!.formVersion).toBe(1)
  })

  it('survives text that would break careless code', async () => {
    const nasty = `O'Brien "quoted" <script>alert(1)</script> — ৯৯% ✓`
    await saveSubmission({ ...base, answers: { name: nasty } })
    expect((await listUnsent())[0]!.answers['name']).toBe(nasty)
  })

  it('sends the oldest work first, so nothing is left behind', async () => {
    await saveSubmission({ ...base, answers: { name: 'first' } })
    await new Promise(r => setTimeout(r, 5))
    await saveSubmission({ ...base, answers: { name: 'second' } })
    const order = (await listUnsent()).map(s => s.answers['name'])
    expect(order).toEqual(['first', 'second'])
  })

  it('does nothing harmful when told to mark an empty list as sent', async () => {
    await expect(markSent([])).resolves.toBeUndefined()
  })
})
