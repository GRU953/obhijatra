// An untested backup is not a backup. This proves we can tell a complete
// backup from one that was cut short — which is how a backup silently becomes
// worthless without anyone noticing.
import { describe, it, expect } from 'vitest'
import { verifyRestore } from '../../scripts/restore-rehearsal.mjs'

describe('restore rehearsal', () => {
  it('reports the tables and rows found in a complete dump', async () => {
    const result = await verifyRestore('tests/fixtures/sample-dump.sql')
    expect(result.tables).toBeGreaterThanOrEqual(3)
    expect(result.rows).toBeGreaterThan(0)
  })
  it('refuses a dump that was cut short', async () => {
    await expect(verifyRestore('tests/fixtures/truncated-dump.sql')).rejects.toThrow(/incomplete/i)
  })
  it('refuses a file that does not exist rather than reporting zero', async () => {
    await expect(verifyRestore('tests/fixtures/nothing-here.sql')).rejects.toThrow()
  })
})
