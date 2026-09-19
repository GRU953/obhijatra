// Proves the part that replaces a paid sync service. It is short because the
// data is simple: a submitted answer never changes, so there is nothing to
// merge and no conflict between two workers to resolve. Uploading is a queue
// that drains -- which is exactly what ODK and KoboToolbox do.
import { describe, it, expect, beforeEach, vi } from 'vitest'

const upsert = vi.fn()
vi.mock('../../src/data/remote/supabase', () => ({
  getSupabase: () => ({ from: () => ({ upsert }) }),
}))

import { drainQueue } from '../../src/data/sync/uploadQueue'
import { saveSubmission, countWaiting, resetLocalForTest } from '../../src/data/local/submissions'

const base = {
  formId: 'hello', formVersion: 1, organisationId: 'org-a',
  collectedBy: 'worker-1', deviceId: 'phone-1',
}

describe('draining the upload queue', () => {
  beforeEach(async () => {
    await resetLocalForTest()
    upsert.mockReset()
    upsert.mockResolvedValue({ error: null })
  })

  it('does nothing, cheerfully, when there is nothing waiting', async () => {
    expect(await drainQueue()).toEqual({ sent: 0, failed: 0, stillWaiting: 0 })
    expect(upsert).not.toHaveBeenCalled()
  })

  it('sends everything waiting and marks it done', async () => {
    await saveSubmission({ ...base, answers: { name: 'A' } })
    await saveSubmission({ ...base, answers: { name: 'B' } })
    const result = await drainQueue()
    expect(result.sent).toBe(2)
    expect(await countWaiting()).toBe(0)
  })

  it('KEEPS THE WORK when the server cannot be reached', async () => {
    // The most important test here. A field worker must never lose a day's
    // work because a connection dropped halfway through sending.
    await saveSubmission({ ...base, answers: { name: 'C' } })
    upsert.mockRejectedValue(new Error('no connection'))
    const result = await drainQueue()
    expect(result.sent).toBe(0)
    expect(await countWaiting()).toBe(1)
  })

  it('KEEPS THE WORK when the server refuses it', async () => {
    await saveSubmission({ ...base, answers: { name: 'D' } })
    upsert.mockResolvedValue({ error: { message: 'permission denied' } })
    const result = await drainQueue()
    expect(result.sent).toBe(0)
    expect(result.failed).toBe(1)
    expect(await countWaiting()).toBe(1)
  })

  it('does not send the same submission twice', async () => {
    await saveSubmission({ ...base, answers: { name: 'E' } })
    await drainQueue()
    expect((await drainQueue()).sent).toBe(0)
  })

  it('uses the phone-made identity as the server identity, so a repeat cannot duplicate', async () => {
    const id = await saveSubmission({ ...base, answers: { name: 'F' } })
    await drainQueue()
    const rows = upsert.mock.calls[0]![0] as Array<{ id: string }>
    expect(rows[0]!.id).toBe(id)
  })

  it('sends the organisation with every row, so the server can check it', async () => {
    await saveSubmission({ ...base, answers: { name: 'G' } })
    await drainQueue()
    const rows = upsert.mock.calls[0]![0] as Array<{ organisation_id: string }>
    expect(rows[0]!.organisation_id).toBe('org-a')
  })

  it('breaks a big backlog into batches a weak connection can manage', async () => {
    for (let i = 0; i < 120; i++) await saveSubmission({ ...base, answers: { n: i } })
    const result = await drainQueue()
    expect(result.sent).toBe(120)
    expect(upsert.mock.calls.length).toBeGreaterThan(1)   // not one giant request
  })

  it('keeps later work when an early batch fails partway', async () => {
    for (let i = 0; i < 120; i++) await saveSubmission({ ...base, answers: { n: i } })
    upsert.mockResolvedValueOnce({ error: { message: 'timeout' } })
    const result = await drainQueue()
    expect(result.failed).toBeGreaterThan(0)
    expect(result.sent).toBeGreaterThan(0)
    expect(await countWaiting()).toBe(result.failed)   // exactly the failures stay
  })
})
