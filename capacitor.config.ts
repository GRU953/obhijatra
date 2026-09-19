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
      androidIsEncryption: true,
      androidBiometric: {
        biometricAuth: true,
        biometricTitle: 'Unlock Obhijatra',
        biometricSubTitle: 'Use your fingerprint to open your work',
      },
    },
  },
}
export default config
