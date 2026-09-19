// Proves the ordering that decides whether a worker's day survives.
//
// An adversarial review found the forms download ran BEFORE the upload, with no
// deadline on any request. The rural failure is not a connection that refuses --
// it is one that is accepted and then goes nowhere: a handover between cells, a
// captive portal, a saturated tower. Such a request never rejects and never
// resolves. The download would hang, the upload would never be reached, and six
// weeks of collected work would stay on the phone while the worker watched a
// disabled button. Getting a worker's day OFF the phone is the higher duty, so
// it goes first rather than merely "is not blocked".
import { describe, it, expect } from 'vitest'
import { runSyncRound } from '../../src/data/sync/syncRound'

const never = () => new Promise<never>(() => {})           // accepted, goes nowhere
const slow = (ms: number) => new Promise((r) => setTimeout(r, ms))

describe('a round of syncing', () => {
  it('THE IMPORTANT ONE: a hanging forms download does not stop the upload', async () => {
    const order: string[] = []
    const result = await runSyncRound({
      upload: async () => { order.push('upload'); return { sent: 7, failed: 0, stillWaiting: 0 } },
      download: async () => { order.push('download'); return never() },
      deadlineMs: 100,
    })
    expect(result.upload.sent).toBe(7)
    expect(order[0]).toBe('upload')            // the higher duty came first
    expect(result.download.timedOut).toBe(true)
  })

  it('uploads first even when both would succeed', async () => {
    const order: string[] = []
    await runSyncRound({
      upload: async () => { order.push('upload'); await slow(10); return { sent: 1, failed: 0, stillWaiting: 0 } },
      download: async () => { order.push('download'); return { received: 1, refused: [], alreadyHeld: 0 } },
      deadlineMs: 1000,
    })
    expect(order).toEqual(['upload', 'download'])
  })

  it('gives up on a request that hangs rather than waiting for ever', async () => {
    const started = Date.now()
    const result = await runSyncRound({
      upload: async () => never(),
      download: async () => ({ received: 0, refused: [], alreadyHeld: 0 }),
      deadlineMs: 80,
    })
    expect(Date.now() - started).toBeLessThan(2000)
    expect(result.upload.timedOut).toBe(true)
  })

  it('still tries the download when the upload times out, because they are separate duties', async () => {
    const result = await runSyncRound({
      upload: async () => never(),
      download: async () => ({ received: 2, refused: [], alreadyHeld: 0 }),
      deadlineMs: 80,
    })
    expect(result.upload.timedOut).toBe(true)
    expect(result.download.received).toBe(2)
  })

  it('reports a refused form without treating it as a failure of the whole round', async () => {
    const result = await runSyncRound({
      upload: async () => ({ sent: 3, failed: 0, stillWaiting: 0 }),
      download: async () => ({ received: 1, refused: ['household edition 2 did not arrive intact'], alreadyHeld: 4 }),
      deadlineMs: 1000,
    })
    expect(result.ok).toBe(true)
    expect(result.download.refused).toHaveLength(1)
  })

  it('never throws, because a worker must always be told something', async () => {
    const result = await runSyncRound({
      upload: async () => { throw new Error('no connection') },
      download: async () => { throw new Error('no connection') },
      deadlineMs: 1000,
    })
    expect(result.ok).toBe(false)
    expect(result.message).toMatch(/connection|safe/i)
  })

  it('says the work is safe when there is no connection, rather than reporting an error', async () => {
    const result = await runSyncRound({
      upload: async () => { throw new Error('Failed to fetch') },
      download: async () => ({ received: 0, refused: [], alreadyHeld: 0 }),
      deadlineMs: 1000,
    })
    expect(result.message).toMatch(/safe on this phone/i)
  })
})

describe('telling a refused row from a dropped connection', () => {
  // The installed client returns a network failure as an ordinary error object,
  // not as a thrown exception -- verified, not assumed. Treating the two alike
  // would let a week of bad signal permanently kill good work.
  it('a server rejection is a rejection', async () => {
    const { classifyFailure } = await import('../../src/data/sync/syncRound')
    expect(classifyFailure({ message: 'new row violates row-level security policy' })).toBe('refused-by-server')
  })
  it.each([
    ['Failed to fetch'], ['NetworkError when attempting to fetch resource'],
    ['Load failed'], ['network timeout'], ['fetch failed'],
  ])('a dropped connection is not a rejection: %s', async (message) => {
    const { classifyFailure } = await import('../../src/data/sync/syncRound')
    expect(classifyFailure({ message })).toBe('connection-lost')
  })
  it('an unknown failure is treated as a lost connection, which is the safe guess', async () => {
    const { classifyFailure } = await import('../../src/data/sync/syncRound')
    // Guessing "rejected" would count a strike against work that is fine.
    expect(classifyFailure({ message: 'something nobody has seen before' })).toBe('connection-lost')
  })
})
