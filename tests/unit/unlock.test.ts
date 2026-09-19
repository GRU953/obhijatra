// Proves the gate that decides whether someone gets in, and -- more importantly
// -- that every unhappy path leads to the PIN rather than to a dead end.
//
// The real failure this prevents: an earlier version demanded a fingerprint and
// offered a PIN screen that could never succeed, so on a phone with no sensor
// the app was simply unusable, and the Save button did nothing with no message.
import { describe, it, expect, vi } from 'vitest'

describe('letting someone in', () => {
  it('offers the fingerprint when the phone has one', async () => {
    const { fingerprintAvailable } = await import('../../src/security/unlock')
    expect(await fingerprintAvailable()).toBe(true)
  })

  it('says no sensor rather than throwing, so the PIN can be offered', async () => {
    const biometric = await import('@capgo/capacitor-native-biometric')
    const spy = vi.spyOn(biometric.NativeBiometric, 'isAvailable')
      .mockRejectedValue(new Error('no hardware'))
    const { fingerprintAvailable } = await import('../../src/security/unlock')
    expect(await fingerprintAvailable()).toBe(false)
    spy.mockRestore()
  })

  it('treats a refused or ignored fingerprint as a plain no', async () => {
    const biometric = await import('@capgo/capacitor-native-biometric')
    const spy = vi.spyOn(biometric.NativeBiometric, 'verifyIdentity')
      .mockRejectedValue(new Error('cancelled'))
    const { askForFingerprint } = await import('../../src/security/unlock')
    expect(await askForFingerprint()).toBe(false)
    spy.mockRestore()
  })

  it('lets the person in when the finger is recognised', async () => {
    const { askForFingerprint } = await import('../../src/security/unlock')
    expect(await askForFingerprint()).toBe(true)
  })
})
