// WHAT THIS FILE IS FOR
//   Tells the Android wrapper how to behave. Two settings here are the whole
//   reason Phase 1 exists:
//     androidIsEncryption       - the database on the phone is locked
//     androidBiometric          - the key is released by a fingerprint
//   If either is off, a stolen phone is a readable list of vulnerable people.
import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'org.obhijatra.app',
  appName: 'Obhijatra',
  webDir: 'dist',
  plugins: {
    CapacitorSQLite: {
      // The database stays encrypted. What changed is WHO asks for the
      // fingerprint.
      androidIsEncryption: true,
      // Deliberately off. The plugin's own fingerprint gate is all-or-nothing:
      // with it on, a phone with no fingerprint sensor can never open its
      // database at all, and the PIN fallback this project requires cannot
      // work. The app now asks for the fingerprint itself, and falls back to a
      // PIN when there is no sensor, no enrolled finger, or nobody touches it.
      androidBiometric: { biometricAuth: false },
    },
  },
}
export default config
