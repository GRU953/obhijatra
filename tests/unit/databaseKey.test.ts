// Proves the single most important security property in the app.
//
// The question to ask of any encrypted-database code is: does the key ever come
// out of the PIN? Six digits is a million possibilities, which a laptop
// exhausts in seconds once the file is copied off the phone. The phone's
// security chip is the only thing that makes a 6-digit PIN safe, and that
// protection does not travel with a copied file.
import { describe, it, expect, afterEach } from 'vitest'
import { generateDatabaseKey, isKeyDerivedFromPin } from '../../src/security/databaseKey'

describe('the database key', () => {
  it('is 32 bytes of randomness', () => {
    expect(Buffer.from(generateDatabaseKey(), 'base64').length).toBe(32)
  })
  it('is different every time', () => {
    expect(generateDatabaseKey()).not.toEqual(generateDatabaseKey())
  })
  it('does not repeat across many draws', () => {
    const seen = new Set(Array.from({ length: 200 }, () => generateDatabaseKey()))
    expect(seen.size).toBe(200)
  })
  it('is never derived from the PIN — the one question that matters', () => {
    expect(isKeyDerivedFromPin()).toBe(false)
  })
})

describe('waiting for the fingerprint', () => {
  // The real failure this prevents: the app asked for the key six seconds
  // before the person touched the sensor, and got a null-reference error that
  // looked like a broken plugin. Order matters, so all three outcomes are tested.
  const sqlite = () => import('@capacitor-community/sqlite') as unknown as
    Promise<{ __setSensor: (b: 'succeed' | 'silent' | 'refuse') => void }>

  afterEach(async () => { (await sqlite()).__setSensor('succeed') })

  it('unlocks when the finger is recognised', async () => {
    const { waitForUnlock } = await import('../../src/security/databaseKey')
    const outcome = await waitForUnlock(1000)
    expect(outcome.unlocked).toBe(true)
  })

  it('gives up after a time limit rather than hanging forever', async () => {
    // A worker who is interrupted and walks away must not leave the app frozen.
    (await sqlite()).__setSensor('silent')
    const { waitForUnlock } = await import('../../src/security/databaseKey')
    const outcome = await waitForUnlock(50)
    expect(outcome.unlocked).toBe(false)
    if (!outcome.unlocked) {
      expect(outcome.why).toBe('timed-out')
      expect(outcome.message).toMatch(/PIN/i)
    }
  })

  it('says so plainly when the finger is not recognised', async () => {
    (await sqlite()).__setSensor('refuse')
    const { waitForUnlock } = await import('../../src/security/databaseKey')
    const outcome = await waitForUnlock(1000)
    expect(outcome.unlocked).toBe(false)
    if (!outcome.unlocked) expect(outcome.why).toBe('refused')
  })
})
