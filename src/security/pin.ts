// WHAT THIS FILE IS FOR
//   Lets someone open the app with a 6-digit PIN or a longer password when
//   their phone has no fingerprint sensor — common on the cheapest handsets.
//
// IMPORTANT
//   The PIN is only ever CHECKED here. It never becomes the database key. See
//   src/security/databaseKey.ts for why that distinction is the whole difference
//   between real protection and decorative protection.
//
//   We never store the PIN. We store a scrambled value derived from it, with a
//   different random ingredient each time, so two people choosing the same PIN
//   leave different traces and neither can be worked backwards.
import { Preferences } from '@capacitor/preferences'

const STORE_KEY = 'pin-check-value'
const ATTEMPTS_KEY = 'pin-attempts-used'
export const MAX_ATTEMPTS = 10
export const MIN_PIN_LENGTH = 6

/** Turns the typed PIN into a value we can compare, deliberately slowly. */
async function stretch(pin: string, salt: Uint8Array): Promise<string> {
  const material = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveBits'])
  // 600,000 rounds follows OWASP's guidance for PBKDF2-SHA256. It takes about a
  // second on an entry-level phone: slow enough that guessing is hopeless, fast
  // enough that a field worker does not notice.
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: salt as BufferSource, iterations: 600_000, hash: 'SHA-256' }, material, 256)
  return btoa(String.fromCharCode(...new Uint8Array(bits)))
}

export async function isPinSet(): Promise<boolean> {
  return (await Preferences.get({ key: STORE_KEY })).value !== null
}

export async function setPin(pin: string): Promise<void> {
  if (pin.length < MIN_PIN_LENGTH) {
    throw new Error(`A PIN must be at least ${MIN_PIN_LENGTH} digits long.`)
  }
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const check = await stretch(pin, salt)
  await Preferences.set({ key: STORE_KEY, value: JSON.stringify({ salt: Array.from(salt), check }) })
  await Preferences.set({ key: ATTEMPTS_KEY, value: '0' })
}

export async function verifyPin(pin: string): Promise<boolean> {
  const raw = (await Preferences.get({ key: STORE_KEY })).value
  if (!raw) return false
  const { salt, check } = JSON.parse(raw) as { salt: number[]; check: string }
  const used = Number((await Preferences.get({ key: ATTEMPTS_KEY })).value ?? '0')
  if (used >= MAX_ATTEMPTS) return false
  const matches = (await stretch(pin, new Uint8Array(salt))) === check
  await Preferences.set({ key: ATTEMPTS_KEY, value: String(matches ? 0 : used + 1) })
  return matches
}

export async function attemptsRemaining(): Promise<number> {
  const used = Number((await Preferences.get({ key: ATTEMPTS_KEY })).value ?? '0')
  return Math.max(0, MAX_ATTEMPTS - used)
}

/** Only for tests. Forgets any PIN that was set. */
export async function resetPinForTest(): Promise<void> {
  await Preferences.remove({ key: STORE_KEY })
  await Preferences.remove({ key: ATTEMPTS_KEY })
}
