// Proves the forms shipped in this repository are sound, and that a broken one
// would actually be caught. This is what stands in for a builder screen: the
// same refusals, at the same moment, with nothing extra to build.
import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { validateFormDefinition } from '../../src/forms/validate'
import { fingerprintOf } from '../../src/forms/fingerprint'
import type { FormDefinition } from '../../src/forms/definition'

const files = readdirSync('forms').filter((f) => f.endsWith('.json'))
const load = (f: string) => JSON.parse(readFileSync(join('forms', f), 'utf8')) as FormDefinition

describe('the forms in this repository', () => {
  it('there is at least one', () => {
    expect(files.length).toBeGreaterThan(0)
  })

  it.each(files)('%s is a form the validator accepts', (file) => {
    const { problems } = validateFormDefinition(load(file))
    expect(problems).toEqual([])
  })

  it.each(files)('%s has a settled fingerprint', async (file) => {
    const fingerprint = await fingerprintOf(load(file))
    expect(fingerprint).toMatch(/^[0-9a-f]{64}$/)
    // The same file always gives the same code, whatever machine reads it.
    expect(await fingerprintOf(load(file))).toBe(fingerprint)
  })

  it('a deliberately broken form WOULD be refused', () => {
    // Without this, the checks above only prove the good files are good.
    const broken = { ...load(files[0]!), questions: [
      { id: 'a', type: 'short-text', label: { bn: 'ক', en: 'A' }, required: false,
        showIf: { question: 'doesNotExist', operator: 'is', value: 1 } },
    ] } as FormDefinition
    expect(validateFormDefinition(broken).problems.length).toBeGreaterThan(0)
  })
})
