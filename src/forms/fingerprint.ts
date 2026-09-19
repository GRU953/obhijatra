// WHAT THIS FILE IS FOR
//   A short code worked out from a form's contents. If one letter of one label
//   changes, the code changes.
//
// WHAT IT IS ACTUALLY GOOD FOR
//   Not secrecy -- anyone can work out the code for a form they can see. Its one
//   real job is this: a sealed edition can never change, so if the server ever
//   offers a DIFFERENT code for an edition the phone already holds, something is
//   wrong. Either the server is mistaken or someone has tampered with it. Either
//   way the phone keeps what it had and says so.
//
//   This is the wall that still stands when the database's own owner is the
//   problem, because a determined owner can disable a database trigger but
//   cannot change what a phone already holds.

/**
 * Writes a value as text with the keys always in the same order.
 *
 * Without this, two machines that mean the same thing produce different text --
 * and therefore different codes -- purely because they happened to write the
 * keys in a different order. That would make the check fire at random, which is
 * worse than no check at all, because people learn to ignore it.
 */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null'
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(',')}}`
}

/** The code for a form's contents. The same form always gives the same code. */
export async function fingerprintOf(definition: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(canonicalJson(definition))
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}
