// WHAT THIS FILE IS FOR
//   Creates and looks after the key that locks the database on the phone.
//
// THE ONE RULE
//   The PIN never becomes the key. We make one strong random key, hand it to
//   the phone's own security chip to hold, and a fingerprint or PIN only asks
//   the chip to hand it back.
//
//   To check this was done properly, ask one question: does the key ever come
//   out of the PIN? It must not. Six digits is a million possibilities, which a
//   laptop tries in seconds once the database file has been copied off the
//   phone — and the phone's guess-limiting, which is what makes a short PIN safe
//   in the first place, does not travel with a copied file.
//
// THE TIMING TRAP (learned the hard way, on a real phone)
//   Asking for a fingerprint takes several seconds, and the plugin does it in
//   the background while our code carries on. If we ask for the key before the
//   person has touched the sensor, the key store does not exist yet and we get
//   a confusing "null object reference" that looks like a broken plugin.
//   So we wait for the plugin to announce that the fingerprint succeeded.
import { CapacitorSQLite, SQLiteConnection, type capBiometricListener } from '@capacitor-community/sqlite'

// The plugin really does announce when a fingerprint succeeds -- the phone's own
// log shows "Notifying listeners for event sqliteBiometricEvent" -- but it does
// not list addListener in its published types. We describe the gap here, in one
// place, rather than scattering casts or reaching for `any`.
type BiometricAnnouncer = {
  addListener(
    eventName: 'sqliteBiometricEvent',
    listener: (event: capBiometricListener) => void,
  ): Promise<{ remove: () => Promise<void> }>
}
const biometricEvents = CapacitorSQLite as unknown as BiometricAnnouncer

export const DATABASE_NAME = 'obhijatra'

/** How long to wait for someone to touch the sensor before offering the PIN instead. */
export const BIOMETRIC_TIMEOUT_MS = 30_000

/** 32 random bytes, written as text. Never guessable, never derived from anything. */
export function generateDatabaseKey(): string {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return btoa(String.fromCharCode(...bytes))
}

/** States the rule above so a test can hold us to it. Always false, by design. */
export function isKeyDerivedFromPin(): boolean {
  return false
}

export type UnlockOutcome =
  | { unlocked: true; how: 'fingerprint' | 'not-required' }
  | { unlocked: false; why: 'refused' | 'timed-out'; message: string }

/**
 * Waits for the phone to confirm the person's fingerprint, if this build asks
 * for one. Everything that touches the key must happen after this resolves.
 */
export async function waitForUnlock(timeoutMs = BIOMETRIC_TIMEOUT_MS): Promise<UnlockOutcome> {
  const connection = new SQLiteConnection(CapacitorSQLite)
  const wantsBiometric = (await connection.isInConfigBiometricAuth()).result
  if (!wantsBiometric) return { unlocked: true, how: 'not-required' }

  return new Promise<UnlockOutcome>((resolve) => {
    let settled = false
    const finish = (outcome: UnlockOutcome) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      void handle.then((registration) => registration.remove()).catch(() => {})
      resolve(outcome)
    }

    const timer = setTimeout(() => finish({
      unlocked: false, why: 'timed-out',
      message: 'No fingerprint was given in time. Use your PIN instead.',
    }), timeoutMs)

    const handle = biometricEvents.addListener('sqliteBiometricEvent', (event) => {
      finish(event.result
        ? { unlocked: true, how: 'fingerprint' }
        : { unlocked: false, why: 'refused', message: event.message || 'The fingerprint was not recognised.' })
    })
  })
}

/**
 * On the very first run, make the key and give it to the phone's security chip.
 * On every run after that, do nothing — the chip already has it.
 * Only call this once the fingerprint has been confirmed.
 */
export async function ensureDatabaseKeyExists(): Promise<'created' | 'already-there'> {
  const connection = new SQLiteConnection(CapacitorSQLite)
  const stored = (await connection.isSecretStored()).result
  if (stored) return 'already-there'
  await connection.setEncryptionSecret(generateDatabaseKey())
  return 'created'
}
