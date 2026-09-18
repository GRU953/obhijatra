// Proves the guard that stops a password ever being saved into the project.
import { describe, it, expect } from 'vitest'
import { scanForSecrets, shouldScan } from '../../scripts/check-secrets.mjs'

describe('scanForSecrets', () => {
  it('flags a signed token such as a Supabase service role key', () => {
    expect(scanForSecrets('KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.abcdefghij.klmnopqrst').length).toBeGreaterThan(0)
  })
  it('flags a private key block', () => {
    expect(scanForSecrets('-----BEGIN PRIVATE KEY-----')).not.toEqual([])
  })
  it('flags a GitHub token', () => {
    expect(scanForSecrets('ghp_0123456789abcdefghijklmnopqrstuvwxyz')).not.toEqual([])
  })
  it('flags a database connection string carrying a password', () => {
    expect(scanForSecrets('postgresql://postgres:SomeRealPassword1@db.example.supabase.co:5432/postgres')).not.toEqual([])
  })
  it('flags a Cloudflare API token', () => {
    expect(scanForSecrets('CLOUDFLARE_API_TOKEN=cfut_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa')).not.toEqual([])
  })
  it('passes ordinary code', () => {
    expect(scanForSecrets('const greeting = "hello"')).toEqual([])
  })
  it('passes an example file placeholder', () => {
    expect(scanForSecrets('SUPABASE_URL=your-project-url-here')).toEqual([])
  })
  it('passes a reference to a secret by name, which is how workflows use them', () => {
    expect(scanForSecrets('pg_dump "${{ secrets.SUPABASE_DB_URL }}"')).toEqual([])
  })
})

describe('shouldScan', () => {
  // Documentation about secrets, and the tests proving this scanner works, will
  // ALWAYS contain secret-shaped text. Scanning them blocks every commit forever.
  // Found the hard way: the first version refused the commit of its own plan.
  it('skips documentation', () => {
    expect(shouldScan('docs/superpowers/plans/phase-0.md')).toBe(false)
  })
  it('skips deliberately fake test fixtures', () => {
    expect(shouldScan('tests/fixtures/sample-dump.sql')).toBe(false)
  })
  it("skips this scanner's own tests", () => {
    expect(shouldScan('tests/unit/check-secrets.test.ts')).toBe(false)
  })
  it('still scans real source code', () => {
    expect(shouldScan('src/data/remote/supabase.ts')).toBe(true)
  })
  it('still scans configuration, where real secrets get pasted by mistake', () => {
    expect(shouldScan('capacitor.config.ts')).toBe(true)
    expect(shouldScan('.github/workflows/backup.yml')).toBe(true)
  })
})
