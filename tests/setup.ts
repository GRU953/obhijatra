// Tests run on a computer, not a phone, so the phone-only parts are stood in
// for. Anything that would touch real hardware answers the way a phone with
// fingerprint switched on would, minus the actual sensor.
import { vi } from 'vitest'

vi.mock('@capacitor/core', () => ({
  Capacitor: { getPlatform: () => 'android' },
  registerPlugin: () => ({}),
}))

vi.mock('@capacitor-community/sqlite', () => {
  const plugin = {
    addListener: () => Promise.resolve({ remove: () => Promise.resolve() }),
  }
  class SQLiteConnection {
    async isInConfigBiometricAuth() { return { result: true } }
    async isInConfigEncryption() { return { result: true } }
    async isSecretStored() { return { result: false } }
    async setEncryptionSecret() { return }
  }
  return { CapacitorSQLite: plugin, SQLiteConnection }
})
