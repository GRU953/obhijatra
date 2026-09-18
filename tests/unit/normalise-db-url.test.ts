// secrets-scan: contains-examples
//   WHY: this file must contain connection addresses to test them. Every value
//   below is invented — 'example.supabase.co' does not exist and the passwords
//   are nonsense. The scanner is told explicitly rather than being weakened.
//
// Proves a password containing symbols does not silently break the connection.
// This was a real failure: a password containing @ made the server name
// unreadable, and the error blamed the host rather than the password.
import { describe, it, expect } from 'vitest'
import { execFileSync } from 'node:child_process'

const run = (url: string) =>
  execFileSync('node', ['scripts/normalise-db-url.mjs', url], { encoding: 'utf8' })

describe('connection address', () => {
  it('encodes an @ inside the password', () => {
    const out = run('postgresql://postgres:Some@Pass1@db.example.supabase.co:5432/postgres')
    expect(out).toBe('postgresql://postgres:Some%40Pass1@db.example.supabase.co:5432/postgres')
  })
  it('encodes other awkward symbols', () => {
    expect(run('postgresql://postgres:a#b/c?d@db.example.co:5432/postgres'))
      .toBe('postgresql://postgres:a%23b%2Fc%3Fd@db.example.co:5432/postgres')
  })
  it('leaves an ordinary password alone', () => {
    const url = 'postgresql://postgres:plainpassword@db.example.co:5432/postgres'
    expect(run(url)).toBe(url)
  })
  it('keeps the server name and database intact', () => {
    expect(run('postgresql://postgres:x@y@db.abc.supabase.co:5432/postgres'))
      .toContain('@db.abc.supabase.co:5432/postgres')
  })
})
