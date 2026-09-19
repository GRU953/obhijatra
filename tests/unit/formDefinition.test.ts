// Proves a broken form is refused on a laptop, in front of the person who made
// it -- never discovered in a village. Every rule here exists because breaking
// it would cost a field worker their day, or cost a programme its evidence.
import { describe, it, expect } from 'vitest'
import { validateFormDefinition } from '../../src/forms/validate'
import type { FormDefinition } from '../../src/forms/definition'

const bothLangs = (bn: string, en: string) => ({ bn, en })

const form = (questions: FormDefinition['questions']): FormDefinition => ({
  formId: 'household',
  edition: 1,
  title: bothLangs('পরিবার', 'Household'),
  questions,
})

const text = (id: string, extra: Record<string, unknown> = {}) => ({
  id, type: 'short-text' as const, label: bothLangs(id, id), required: false, ...extra,
})

describe('a form definition is accepted when it is sound', () => {
  it('accepts the simplest possible form', () => {
    expect(validateFormDefinition(form([text('name')])).problems).toEqual([])
  })
  it('accepts a rule that points at an earlier question', () => {
    const f = form([
      { id: 'pregnant', type: 'yes-no', label: bothLangs('গর্ভবতী', 'Pregnant'), required: true },
      text('months', { showIf: { question: 'pregnant', operator: 'is', value: true } }),
    ])
    expect(validateFormDefinition(f).problems).toEqual([])
  })
})

describe('rules may only point backwards', () => {
  // THE rule that makes loops structurally impossible. No cycle detection, no
  // graph algorithm, and no chance of the app spinning until Android kills it.
  it('refuses a rule pointing at a LATER question', () => {
    const f = form([
      text('months', { showIf: { question: 'pregnant', operator: 'is', value: true } }),
      { id: 'pregnant', type: 'yes-no', label: bothLangs('গর্ভবতী', 'Pregnant'), required: true },
    ])
    const { problems } = validateFormDefinition(f)
    // Assert the BEHAVIOUR -- that it complained about this rule and this
    // question -- not the exact English. Tests that pin prose break every time
    // a message is improved, which teaches people to stop improving messages.
    expect(problems.join(' ')).toContain('months')
    expect(problems.join(' ')).toContain('pregnant')
  })
  it('refuses a rule pointing at itself', () => {
    const f = form([text('a', { showIf: { question: 'a', operator: 'was-answered' } })])
    expect(validateFormDefinition(f).problems.length).toBeGreaterThan(0)
  })
  it('refuses a rule naming a question that does not exist', () => {
    const f = form([text('a', { showIf: { question: 'ghost', operator: 'was-answered' } })])
    expect(validateFormDefinition(f).problems.join(' ')).toMatch(/ghost/)
  })
  it('checks rules nested inside ALL and ANY too', () => {
    const f = form([
      text('a'),
      text('b', { showIf: { all: [{ question: 'a', operator: 'was-answered' },
                                  { question: 'ghost', operator: 'was-answered' }] } }),
    ])
    expect(validateFormDefinition(f).problems.join(' ')).toMatch(/ghost/)
  })
})

describe('identity and labels', () => {
  it('refuses two questions with the same name', () => {
    const { problems } = validateFormDefinition(form([text('a'), text('a')]))
    expect(problems.length).toBeGreaterThan(0)
    expect(problems.join(' ')).toContain('"a"')
  })
  it('refuses a question with no name', () => {
    expect(validateFormDefinition(form([text('')])).problems.length).toBeGreaterThan(0)
  })
  it('refuses a missing Bangla label, because half a translation is a broken screen', () => {
    const f = form([{ id: 'a', type: 'short-text', label: { bn: '', en: 'Name' }, required: false }])
    expect(validateFormDefinition(f).problems.join(' ')).toMatch(/bangla|bn/i)
  })
  it('refuses a missing English label', () => {
    const f = form([{ id: 'a', type: 'short-text', label: { bn: 'নাম', en: '' }, required: false }])
    expect(validateFormDefinition(f).problems.join(' ')).toMatch(/english|en/i)
  })
})

describe('choices', () => {
  it('refuses a choose-one with no options', () => {
    const f = form([{ id: 'a', type: 'choose-one', label: bothLangs('ক', 'A'), required: false }])
    expect(validateFormDefinition(f).problems.join(' ')).toMatch(/option/i)
  })
  it('refuses options with the same value', () => {
    const f = form([{ id: 'a', type: 'choose-one', label: bothLangs('ক', 'A'), required: false,
      choices: [{ value: 'x', label: bothLangs('এক', 'One') }, { value: 'x', label: bothLangs('দুই', 'Two') }] }])
    expect(validateFormDefinition(f).problems.length).toBeGreaterThan(0)
  })
  it('refuses options on a type that cannot have them', () => {
    expect(validateFormDefinition(form([text('a', { choices: [{ value: 'x', label: bothLangs('এক', 'One') }] })]))
      .problems.join(' ')).toMatch(/option/i)
  })
})

describe('patterns are ours, never the author’s', () => {
  // A clumsy author-written pattern can freeze a cheap phone solid mid-interview
  // with no error at all -- the exact silent-failure class that already cost
  // this project a shipped bug.
  it('accepts one of our named patterns', () => {
    const f = form([{ id: 'phone', type: 'mobile-number', label: bothLangs('ফোন', 'Phone'), required: false,
      checks: [{ type: 'matches', pattern: 'bangladeshi-mobile', message: bothLangs('ভুল', 'Wrong') }] }])
    expect(validateFormDefinition(f).problems).toEqual([])
  })
  it('refuses a pattern the author invented', () => {
    const f = form([{ id: 'phone', type: 'mobile-number', label: bothLangs('ফোন', 'Phone'), required: false,
      checks: [{ type: 'matches', pattern: '^(a+)+$', message: bothLangs('ভুল', 'Wrong') }] }])
    expect(validateFormDefinition(f).problems.join(' ')).toMatch(/pattern/i)
  })
})

describe('size', () => {
  it('refuses a definition larger than 256 KB, and says how big it was', () => {
    const many = Array.from({ length: 4000 }, (_, i) =>
      ({ id: `q${i}`, type: 'choose-one' as const, label: bothLangs('ক'.repeat(40), 'A'.repeat(40)), required: false,
         choices: Array.from({ length: 10 }, (_, j) => ({ value: `v${j}`, label: bothLangs('খ'.repeat(20), 'B'.repeat(20)) })) }))
    const { problems } = validateFormDefinition(form(many))
    expect(problems.join(' ')).toMatch(/256|KB|too large/i)
    expect(problems.join(' ')).toMatch(/[0-9]/)   // must state the real size
  })
})
