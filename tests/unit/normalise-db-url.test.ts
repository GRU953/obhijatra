// secrets-scan: contains-examples
//   WHY: this file must contain connection addresses in order to test them.
//   Every value below is invented — none of these servers exist and the
//   passwords are nonsense. The scanner is told explicitly rather than weakened.
//
// Proves a password containing symbols does not silently break the connection,
// and that the address which build machines cannot reach is refused with a
// useful explanation. Both were real failures, not hypothetical ones.
import { describe, it, expect } from 'vitest'
import { execFileSync } from 'node:child_process'

const POOLER = 'aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres'

const run = (url: string) =>
  execFileSync('node', ['scripts/normalise-db-url.mjs', url], { encoding: 'utf8' })

describe('connection address', () => {
  it('encodes an @ inside the password', () => {
    expect(run(`postgresql://postgres.abc:Some@Pass1@${POOLER}`))
      .toBe(`postgresql://postgres.abc:Some%40Pass1@${POOLER}`)
  })
  it('encodes other awkward symbols', () => {
    expect(run(`postgresql://postgres.abc:a#b/c?d@${POOLER}`))
      .toBe(`postgresql://postgres.abc:a%23b%2Fc%3Fd@${POOLER}`)
  })
  it('leaves an ordinary password alone', () => {
    const url = `postgresql://postgres.abc:plainpassword@${POOLER}`
    expect(run(url)).toBe(url)
  })
  it('keeps the server name and database intact', () => {
    expect(run(`postgresql://postgres.abc:x@y@${POOLER}`)).toContain(`@${POOLER}`)
  })
})

describe('the direct address that build machines cannot reach', () => {
  it('refuses it with an explanation rather than letting it fail obscurely', () => {
    // This shape produced "Network is unreachable" in a real run, because
    // Supabase's direct address answers only on IPv6 and build machines have
    // none. A clear refusal saves an hour of confusion.
    let failed = false
    let message = ''
    try {
      execFileSync('node', ['scripts/normalise-db-url.mjs',
        'postgresql://postgres:pw@db.abcdefghijk.supabase.co:5432/postgres'],
        { encoding: 'utf8', stdio: 'pipe' })
    } catch (e: unknown) {
      failed = true
      message = String((e as { stderr?: string }).stderr ?? '')
    }
    expect(failed).toBe(true)
    expect(message).toMatch(/Session pooler/)
  })
})
