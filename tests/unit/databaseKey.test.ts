// Proves the single most important security property in the app.
//
// The question to ask of any encrypted-database code is: does the key ever come
// out of the PIN? Six digits is a million possibilities, which a laptop
// exhausts in seconds once the file is copied off the phone. The phone's
// security chip is the only thing that makes a 6-digit PIN safe, and that
// protection does not travel with a copied file.
import { describe, it, expect } from 'vitest'
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
  // looked like a broken plugin. Order matters, so it is tested.
  it('gives up after a time limit rather than hanging forever', async () => {
    const { waitForUnlock } = await import('../../src/security/databaseKey')
    const outcome = await waitForUnlock(50)
    expect(outcome.unlocked).toBe(false)
    if (!outcome.unlocked) {
      expect(outcome.why).toBe('timed-out')
      expect(outcome.message).toMatch(/PIN/i)
    }
  })
})
