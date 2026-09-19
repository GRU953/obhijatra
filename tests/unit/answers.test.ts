// Proves the privacy promise the owner chose on 19 September 2026: an answer the
// worker then hides is DELETED, not kept quietly in the record.
//
// The case this exists for: a worker types "has children: yes", fills in three
// children's names, then corrects it to "no". Without this, the record would
// hold three children's names in a file that says the household has none -- a
// real privacy problem, and a hard one to explain to a regulator or a donor.
import { describe, it, expect } from 'vitest'
import { prepareForSaving, checkAnswers } from '../../src/forms/answers'
import type { FormDefinition } from '../../src/forms/definition'

const t = (s: string) => ({ bn: s, en: s })

const household: FormDefinition = {
  formId: 'household', edition: 1, title: t('Household'),
  questions: [
    { id: 'hasChildren', type: 'yes-no', label: t('Has children'), required: true },
    { id: 'childOne',   type: 'short-text', label: t('Child 1'), required: false,
      showIf: { question: 'hasChildren', operator: 'is', value: true } },
    { id: 'childTwo',   type: 'short-text', label: t('Child 2'), required: false,
      showIf: { question: 'hasChildren', operator: 'is', value: true } },
    { id: 'village',    type: 'short-text', label: t('Village'), required: true },
  ],
}

describe('an answer the worker then hides is deleted', () => {
  it('removes answers to questions that are no longer shown', () => {
    const { answers } = prepareForSaving(household, {
      hasChildren: false, childOne: 'Rahima', childTwo: 'Karim', village: 'Shibganj',
    })
    expect(answers).toEqual({ hasChildren: false, village: 'Shibganj' })
    expect(JSON.stringify(answers)).not.toContain('Rahima')
    expect(JSON.stringify(answers)).not.toContain('Karim')
  })

  it('keeps them while the question is still shown', () => {
    const { answers } = prepareForSaving(household, {
      hasChildren: true, childOne: 'Rahima', village: 'Shibganj',
    })
    expect(answers['childOne']).toBe('Rahima')
  })

  it('removes an answer hidden because the question it depended on was itself hidden', () => {
    // A question can be hidden by a chain. Everything downstream must go too.
    const chained: FormDefinition = { ...household, questions: [
      { id: 'a', type: 'yes-no', label: t('A'), required: false },
      { id: 'b', type: 'yes-no', label: t('B'), required: false,
        showIf: { question: 'a', operator: 'is', value: true } },
      { id: 'c', type: 'short-text', label: t('C'), required: false,
        showIf: { question: 'b', operator: 'is', value: true } },
    ] }
    const { answers } = prepareForSaving(chained, { a: false, b: true, c: 'secret' })
    expect(answers).toEqual({ a: false })
    expect(JSON.stringify(answers)).not.toContain('secret')
  })

  it('drops an answer to a question that is not in this edition at all', () => {
    const { answers } = prepareForSaving(household, { village: 'Shibganj', strayField: 'x' })
    expect(answers['strayField']).toBeUndefined()
  })

  it('reports which questions were shown, so a report can be honest about the denominator', () => {
    const { shown } = prepareForSaving(household, { hasChildren: false, village: 'Shibganj' })
    expect(shown).toEqual(['hasChildren', 'village'])
  })
})

describe('required answers', () => {
  it('complains about a blank required question that IS shown', () => {
    expect(checkAnswers(household, { hasChildren: true, village: '' }).problems.length).toBeGreaterThan(0)
  })
  it('does NOT complain about a required question that is hidden', () => {
    // A worker cannot answer what they were never shown.
    const withRequiredChild: FormDefinition = { ...household, questions: household.questions.map(
      q => q.id === 'childOne' ? { ...q, required: true } : q) }
    expect(checkAnswers(withRequiredChild, { hasChildren: false, village: 'Shibganj' }).problems).toEqual([])
  })
  it('is happy when everything shown is answered', () => {
    expect(checkAnswers(household, { hasChildren: false, village: 'Shibganj' }).problems).toEqual([])
  })
})

describe('checks on an answer', () => {
  const withChecks: FormDefinition = {
    formId: 'f', edition: 1, title: t('F'),
    questions: [
      { id: 'age', type: 'whole-number', label: t('Age'), required: false,
        checks: [{ type: 'smallest', value: 0, message: t('Cannot be negative') },
                 { type: 'largest', value: 120, message: t('Too large') }] },
      { id: 'phone', type: 'mobile-number', label: t('Phone'), required: false,
        checks: [{ type: 'matches', pattern: 'bangladeshi-mobile', message: t('Not a mobile number') }] },
    ],
  }
  it('accepts a value inside the range', () => {
    expect(checkAnswers(withChecks, { age: 30 }).problems).toEqual([])
  })
  it('refuses a value below the smallest, and says which question', () => {
    const { problems } = checkAnswers(withChecks, { age: -1 })
    expect(problems.join(' ')).toContain('Cannot be negative')
  })
  it('refuses a value above the largest', () => {
    expect(checkAnswers(withChecks, { age: 200 }).problems.length).toBeGreaterThan(0)
  })
  it('applies a named pattern', () => {
    expect(checkAnswers(withChecks, { phone: '01712345678' }).problems).toEqual([])
    expect(checkAnswers(withChecks, { phone: '12345' }).problems.length).toBeGreaterThan(0)
  })
  it('does NOT apply a check to a blank answer — only "required" forbids blank', () => {
    // Borrowed from XLSForm, where twenty years of field use settled it.
    expect(checkAnswers(withChecks, { age: '', phone: '' }).problems).toEqual([])
  })
  it('does not check an answer to a hidden question', () => {
    const hidden: FormDefinition = { ...withChecks, questions: [
      { id: 'gate', type: 'yes-no', label: t('Gate'), required: false },
      { ...withChecks.questions[0]!, showIf: { question: 'gate', operator: 'is', value: true } },
    ] }
    expect(checkAnswers(hidden, { gate: false, age: -999 }).problems).toEqual([])
  })
})
