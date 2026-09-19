// WHAT THIS FILE IS FOR
//   Tests run on a computer, not a phone. This stands in for the phone-only
//   parts — but NOT by faking the database. The local database here is a real
//   SQLite one held in memory, using the copy built into Node, so the actual
//   SQL is genuinely exercised. Only the fingerprint and the key store are
//   pretended, because a laptop has neither.
import { vi } from 'vitest'
import { DatabaseSync } from 'node:sqlite'

vi.mock('@capacitor/core', () => ({
  Capacitor: { getPlatform: () => 'android' },
  registerPlugin: () => ({}),
}))

vi.mock('@capacitor/preferences', () => {
  const store = new Map<string, string>()
  return {
    Preferences: {
      get: async ({ key }: { key: string }) => ({ value: store.get(key) ?? null }),
      set: async ({ key, value }: { key: string; value: string }) => { store.set(key, value) },
      remove: async ({ key }: { key: string }) => { store.delete(key) },
    },
  }
})

vi.mock('@capacitor-community/sqlite', () => {
  // One real in-memory database, shared the way a phone shares one file.
  let memory = new DatabaseSync(':memory:')
  let secretStored = false
  // How the pretend sensor behaves. 'succeed' is a touched finger, 'silent' is
  // a person who walks away, 'refuse' is an unrecognised finger. All three
  // happen in the field, so all three are testable.
  let sensor: 'succeed' | 'silent' | 'refuse' = 'succeed'

  const wrap = () => ({
    open: async () => {},
    close: async () => {},
    execute: async (sql: string) => { memory.exec(sql); return { changes: { changes: 0 } } },
    run: async (sql: string, values: unknown[] = []) => {
      const info = memory.prepare(sql).run(...(values as never[]))
      return { changes: { changes: Number(info.changes) } }
    },
    query: async (sql: string, values: unknown[] = []) => ({
      values: memory.prepare(sql).all(...(values as never[])),
    }),
  })

  class SQLiteConnection {
    async isInConfigBiometricAuth() { return { result: true } }
    async isInConfigEncryption() { return { result: true } }
    async isSecretStored() { return { result: secretStored } }
    async setEncryptionSecret() { secretStored = true }
    async createConnection() { return wrap() }
    async closeConnection() {}
  }

  return {
    CapacitorSQLite: {
      // A laptop has no fingerprint sensor, so we answer the way a phone does
      // when someone touches one: success, on the next tick. Without this the
      // code correctly waits thirty seconds for a finger that never arrives.
      addListener: async (
        _event: string,
        listener: (e: { result: boolean; message: string }) => void,
      ) => {
        if (sensor === 'succeed') queueMicrotask(() => listener({ result: true, message: '' }))
        if (sensor === 'refuse') queueMicrotask(() => listener({ result: false, message: 'Not recognised.' }))
        // 'silent' deliberately never answers.
        return { remove: async () => {} }
      },
    },
    SQLiteConnection,
    // Let a test start from a clean phone, or change how the sensor behaves.
    __resetPhone: () => { memory = new DatabaseSync(':memory:'); secretStored = false },
    __setSensor: (behaviour: 'succeed' | 'silent' | 'refuse') => { sensor = behaviour },
  }
})
