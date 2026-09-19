// WHAT THIS FILE IS FOR
//   Opens the locked database on the phone, once, and hands the same open
//   connection to everything that asks for it afterwards.
//
// A BUG THIS PREVENTS
//   An earlier version started a fresh opening for every caller. When the first
//   one was still waiting, each tap of Save started another, and every one of
//   them eventually failed -- invisibly. Openings now share one attempt.
import { CapacitorSQLite, SQLiteConnection, type SQLiteDBConnection } from '@capacitor-community/sqlite'
import { Capacitor } from '@capacitor/core'
import { DATABASE_NAME, ensureDatabaseKeyExists } from '../../security/databaseKey'

let open: SQLiteDBConnection | null = null
let opening: Promise<SQLiteDBConnection> | null = null

export class LockedOutError extends Error {
  constructor(message: string) { super(message); this.name = 'LockedOutError' }
}

async function reallyOpen(): Promise<SQLiteDBConnection> {
  await ensureDatabaseKeyExists()
  const connection = new SQLiteConnection(CapacitorSQLite)
  const database = await connection.createConnection(DATABASE_NAME, true, 'secret', 1, false)
  await database.open()
  open = database
  return database
}

/**
 * Opens the locked database. Call this only after the person has been let in
 * by src/security/unlock.ts -- this function does no checking of its own.
 */
export async function openEncryptedDatabase(): Promise<SQLiteDBConnection> {
  if (open) return open
  if (Capacitor.getPlatform() === 'web') {
    // A browser has no protected storage and cannot limit guessing, which is
    // why the website is the online tool for office roles.
    throw new LockedOutError('The locked database exists only in the Android app, not in a browser.')
  }
  // If an opening is already under way, wait for that one rather than starting
  // a second. This is what stopped repeated taps from piling up.
  opening ??= reallyOpen().finally(() => { opening = null })
  return opening
}

/** What the screen shows about the lock, in words a field worker understands. */
export async function describeLock(): Promise<string> {
  if (Capacitor.getPlatform() === 'web') return 'Website: nothing is stored on this computer.'
  const connection = new SQLiteConnection(CapacitorSQLite)
  const encrypted = (await connection.isInConfigEncryption()).result
  return `database locked: ${encrypted ? 'yes' : 'NO'}`
}
