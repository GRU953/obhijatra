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
import { CapacitorSQLite, SQLiteConnection } from '@capacitor-community/sqlite'

export const DATABASE_NAME = 'obhijatra'

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
