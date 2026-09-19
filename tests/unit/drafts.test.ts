// Proves the worst outcome in this phase cannot happen.
//
// A worker is halfway through a household interview. The app saves as they go,
// so ten minutes of walking is not lost if Android kills the app. Then the
// uploader runs. Without a separate place for unfinished work, that half-filled
// record -- "this family has no children", typed a moment before the worker
// corrected it -- is uploaded as final. Submissions are immutable by design:
// there is no update policy and no delete policy. So it could never be
// completed, corrected or withdrawn by anyone, at any price.
import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  saveDraft, loadDraft, finishDraft, listDrafts, discardDraft, resetDraftsForTest,
} from '../../src/data/local/drafts'
import { listUnsent, countWaiting, resetLocalForTest } from '../../src/data/local/submissions'
import { drainQueue } from '../../src/data/sync/uploadQueue'

const upsert = vi.fn()
vi.mock('../../src/data/remote/supabase', () => ({
  getSupabase: () => ({ from: () => ({ upsert }) }),
}))

const who = { organisationId: 'org-a', collectedBy: 'w1', deviceId: 'p1' }

describe('unfinished work is kept apart from finished work', () => {
  beforeEach(async () => {
    await resetLocalForTest(); await resetDraftsForTest()
    upsert.mockReset(); upsert.mockResolvedValue({ error: null })
  })

  it('THE IMPORTANT ONE: the uploader never sends a half-finished interview', async () => {
    await saveDraft({ ...who, formId: 'household', formVersion: 1, answers: { hasChildren: false } })
    const result = await drainQueue()
    expect(result.sent).toBe(0)
    expect(upsert).not.toHaveBeenCalled()
    expect((await listDrafts()).length).toBe(1)   // and it is still there
  })

  it('saves as the worker goes, so an app being killed costs nothing', async () => {
    const id = await saveDraft({ ...who, formId: 'household', formVersion: 1, answers: { name: 'Rahima' } })
    await saveDraft({ ...who, id, formId: 'household', formVersion: 1, answers: { name: 'Rahima', village: 'Shibganj' } })
    const draft = await loadDraft(id)
    expect(draft?.answers).toEqual({ name: 'Rahima', village: 'Shibganj' })
    expect((await listDrafts()).length).toBe(1)   // updated, not duplicated
  })

  it('finishing moves it across exactly once', async () => {
    const id = await saveDraft({ ...who, formId: 'household', formVersion: 1, answers: { name: 'Rahima' } })
    await finishDraft(id)
    expect(await countWaiting()).toBe(1)
    expect((await listDrafts()).length).toBe(0)
    expect((await listUnsent())[0]!.answers['name']).toBe('Rahima')
  })

  it('a finished form uploads; the draft it came from cannot be uploaded again', async () => {
    const id = await saveDraft({ ...who, formId: 'household', formVersion: 1, answers: { name: 'Rahima' } })
    await finishDraft(id)
    expect((await drainQueue()).sent).toBe(1)
    expect((await drainQueue()).sent).toBe(0)
  })

  it('records which edition of the form the draft was started under', async () => {
    const id = await saveDraft({ ...who, formId: 'household', formVersion: 3, answers: {} })
    expect((await loadDraft(id))?.formVersion).toBe(3)
    await finishDraft(id)
    expect((await listUnsent())[0]!.formVersion).toBe(3)
  })

  it('a worker can abandon a draft, and nothing of it remains', async () => {
    const id = await saveDraft({ ...who, formId: 'household', formVersion: 1, answers: { name: 'Rahima' } })
    await discardDraft(id)
    expect(await loadDraft(id)).toBeNull()
    expect(await countWaiting()).toBe(0)
  })

  it('refuses to finish a draft that is not there, rather than inventing a blank record', async () => {
    await expect(finishDraft('no-such-draft')).rejects.toThrow()
    expect(await countWaiting()).toBe(0)
  })

  it('keeps several interviews on the go at once', async () => {
    await saveDraft({ ...who, formId: 'household',  formVersion: 1, answers: { name: 'A' } })
    await saveDraft({ ...who, formId: 'attendance', formVersion: 1, answers: { name: 'B' } })
    expect((await listDrafts()).length).toBe(2)
  })
})
