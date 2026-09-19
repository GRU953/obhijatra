// WHAT THIS FILE IS FOR
//   Opens the locked database on the phone, in the right order: wait for the
//   fingerprint first, then ask for the key, then open.
import { CapacitorSQLite, SQLiteConnection, type SQLiteDBConnection } from '@capacitor-community/sqlite'
import { Capacitor } from '@capacitor/core'
import { DATABASE_NAME, ensureDatabaseKeyExists, waitForUnlock, type UnlockOutcome } from '../../security/databaseKey'

let open: SQLiteDBConnection | null = null

export class LockedOutError extends Error {
  constructor(public readonly outcome: Extract<UnlockOutcome, { unlocked: false }>) {
    super(outcome.message)
    this.name = 'LockedOutError'
  }
}

export async function openEncryptedDatabase(): Promise<SQLiteDBConnection> {
  if (open) return open
  if (Capacitor.getPlatform() === 'web') {
    // A browser has no security chip, so it cannot hold a key safely and cannot
    // limit guessing. This is why the website is the online tool for office
    // roles, and the Android app is what carries offline work.
    throw new Error('The locked database exists only in the Android app, not in a browser.')
  }

  const outcome = await waitForUnlock()        // must come first
  if (!outcome.unlocked) throw new LockedOutError(outcome)

  await ensureDatabaseKeyExists()
  const connection = new SQLiteConnection(CapacitorSQLite)
  const database = await connection.createConnection(DATABASE_NAME, true, 'secret', 1, false)
  await database.open()
  open = database
  return database
}

/** What the screen shows about the lock, in words a field worker understands. */
export async function describeLock(): Promise<string> {
  if (Capacitor.getPlatform() === 'web') return 'Website: nothing is stored on this computer.'
  const connection = new SQLiteConnection(CapacitorSQLite)
  const encrypted = (await connection.isInConfigEncryption()).result
  const biometric = (await connection.isInConfigBiometricAuth()).result
  return `database locked: ${encrypted ? 'yes' : 'NO'} · fingerprint unlock: ${biometric ? 'yes' : 'no'}`
}
