// WHAT THIS FILE IS FOR
//   Deciding whether the person holding the phone is allowed in, before
//   anything opens the database.
//
// WHY THE APP DOES THIS ITSELF
//   The database plugin can demand a fingerprint on its own, but that setting
//   is all-or-nothing: with it on, a phone with no fingerprint sensor can never
//   open its database at all. Many of the cheapest handsets have no sensor, and
//   requirement 7 says fingerprint OR a 6-digit PIN OR a longer password. So
//   the app asks, and falls back honestly.
//
// WHAT THIS DOES AND DOES NOT PROTECT
//   The key itself is still made at random and kept by the phone's own
//   protected storage; it is never made from the PIN. What this decides is
//   whether the app will go and fetch it. A phone that is switched off, or
//   locked by its own screen lock, is protected by Android. This gate protects
//   an unlocked phone handed to the wrong person.
import { NativeBiometric } from '@capgo/capacitor-native-biometric'

export type UnlockRoute = 'fingerprint' | 'pin'

/** Whether this phone can offer a fingerprint at all. */
export async function fingerprintAvailable(): Promise<boolean> {
  try {
    const result = await NativeBiometric.isAvailable({ useFallback: false })
    return result.isAvailable === true
  } catch {
    return false   // no sensor, no enrolled finger, or the check itself failed
  }
}

/**
 * Asks for a fingerprint. Returns false for every unhappy path -- no sensor,
 * nobody touched it, wrong finger -- so the caller simply offers the PIN.
 */
export async function askForFingerprint(): Promise<boolean> {
  try {
    await NativeBiometric.verifyIdentity({
      reason: 'Open your work in Obhijatra',
      title: 'Unlock Obhijatra',
      subtitle: 'Use your fingerprint',
      description: 'Or press cancel to use your PIN instead',
      useFallback: false,
      maxAttempts: 3,
    })
    return true
  } catch {
    return false
  }
}
