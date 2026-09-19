// Proves the way in for someone whose phone has no fingerprint sensor, which is
// common on the cheapest handsets. The PIN is only ever CHECKED here -- it never
// becomes the key that locks the database. See src/security/databaseKey.ts.
import { describe, it, expect, beforeEach } from 'vitest'
import { setPin, verifyPin, attemptsRemaining, isPinSet, resetPinForTest } from '../../src/security/pin'

describe('PIN unlock', () => {
  beforeEach(async () => { await resetPinForTest() })

  it('knows when no PIN has been set yet', async () => {
    expect(await isPinSet()).toBe(false)
  })
  it('accepts the correct 6-digit PIN', async () => {
    await setPin('493028')
    expect(await verifyPin('493028')).toBe(true)
  })
  it('rejects the wrong PIN', async () => {
    await setPin('493028')
    expect(await verifyPin('000000')).toBe(false)
  })
  it('accepts a 13-character password as an alternative', async () => {
    await setPin('MonsoonRiver7')
    expect(await verifyPin('MonsoonRiver7')).toBe(true)
  })
  it('refuses to set a PIN shorter than 6 digits', async () => {
    await expect(setPin('123')).rejects.toThrow(/at least 6/i)
  })
  it('stores no trace of the PIN itself', async () => {
    const { Preferences } = await import('@capacitor/preferences')
    await setPin('493028')
    const stored = (await Preferences.get({ key: 'pin-check-value' })).value ?? ''
    expect(stored).not.toContain('493028')
  })
  it('two people choosing the same PIN store different values', async () => {
    const { Preferences } = await import('@capacitor/preferences')
    await setPin('493028')
    const first = (await Preferences.get({ key: 'pin-check-value' })).value
    await resetPinForTest()
    await setPin('493028')
    expect((await Preferences.get({ key: 'pin-check-value' })).value).not.toBe(first)
  })
  it('counts down the attempts left after wrong guesses', async () => {
    await setPin('493028')
    for (let i = 0; i < 4; i++) await verifyPin('111111')
    expect(await attemptsRemaining()).toBe(6)
  })
  it('forgives the count once the right PIN is given', async () => {
    await setPin('493028')
    await verifyPin('111111')
    await verifyPin('493028')
    expect(await attemptsRemaining()).toBe(10)
  })
  it('stops accepting anything after too many wrong guesses', async () => {
    await setPin('493028')
    for (let i = 0; i < 10; i++) await verifyPin('111111')
    expect(await verifyPin('493028')).toBe(false)
  })
})
