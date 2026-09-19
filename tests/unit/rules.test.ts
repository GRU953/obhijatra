// Proves the part an attacker would aim at. A rule is INFORMATION the app reads,
// never code it runs -- because anything executing inside the phone's browser
// view can call the database plugin exactly as our own code does. It would not
// need to steal the encryption key; it could simply ask for the data.
import { describe, it, expect } from 'vitest'
import { ruleHolds } from '../../src/forms/rules'
import type { Rule } from '../../src/forms/definition'

const holds = (rule: Rule, answers: Record<string, unknown>) => ruleHolds(rule, answers)

describe('a rule is read, never run', () => {
  it('compares a string of code as a STRING and never executes it', () => {
    const rule: Rule = { question: 'a', operator: 'is', value: 'process.exit(1)' }
    expect(holds(rule, { a: 'process.exit(1)' })).toBe(true)
    expect(holds(rule, { a: 'something else' })).toBe(false)
  })
  it('treats an unknown comparison as false rather than guessing', () => {
    const rule = { question: 'a', operator: 'delete-everything', value: 1 } as unknown as Rule
    expect(holds(rule, { a: 1 })).toBe(false)
  })
})

describe('a blank answer behaves one written-down way', () => {
  // Comparisons involving a blank are ALWAYS false -- never true, never an
  // error. Borrowed from XLSForm, where twenty years of field use settled it.
  it.each([
    ['is', 5], ['is-not', 5], ['more-than', 5], ['at-least', 5],
    ['less-than', 5], ['at-most', 5], ['includes', 'x'],
  ])('is false when the answer is missing: %s', (operator, value) => {
    expect(holds({ question: 'a', operator, value } as Rule, {})).toBe(false)
  })
  it.each([[''], [null], [undefined], [[]]])('treats %p as blank', (blank) => {
    expect(holds({ question: 'a', operator: 'was-left-blank' }, { a: blank })).toBe(true)
    expect(holds({ question: 'a', operator: 'was-answered' }, { a: blank })).toBe(false)
  })
  it('counts a real answer as answered', () => {
    expect(holds({ question: 'a', operator: 'was-answered' }, { a: 'Rahima' })).toBe(true)
    expect(holds({ question: 'a', operator: 'was-answered' }, { a: 0 })).toBe(true)
    expect(holds({ question: 'a', operator: 'was-answered' }, { a: false })).toBe(true)
  })
})

describe('the comparisons', () => {
  it('is / is not', () => {
    expect(holds({ question: 'a', operator: 'is', value: true }, { a: true })).toBe(true)
    expect(holds({ question: 'a', operator: 'is-not', value: true }, { a: false })).toBe(true)
  })
  it('compares numbers as numbers, not as text', () => {
    // '9' > '10' as text, which is how home-made builders get this wrong.
    expect(holds({ question: 'a', operator: 'more-than', value: 10 }, { a: 9 })).toBe(false)
    expect(holds({ question: 'a', operator: 'more-than', value: 9 }, { a: 10 })).toBe(true)
    expect(holds({ question: 'a', operator: 'at-least', value: 10 }, { a: 10 })).toBe(true)
    expect(holds({ question: 'a', operator: 'less-than', value: 10 }, { a: 9 })).toBe(true)
    expect(holds({ question: 'a', operator: 'at-most', value: 10 }, { a: 10 })).toBe(true)
  })
  it('compares dates in order, not alphabetically', () => {
    expect(holds({ question: 'd', operator: 'more-than', value: '2026-01-05' }, { d: '2026-01-10' })).toBe(true)
    expect(holds({ question: 'd', operator: 'less-than', value: '2026-01-05' }, { d: '2026-01-10' })).toBe(false)
  })
  it('includes, for a choose-several answer', () => {
    expect(holds({ question: 'a', operator: 'includes', value: 'rice' }, { a: ['rice', 'oil'] })).toBe(true)
    expect(holds({ question: 'a', operator: 'includes', value: 'salt' }, { a: ['rice', 'oil'] })).toBe(false)
  })
  it('matches, using only our named patterns', () => {
    const rule: Rule = { question: 'p', operator: 'matches', pattern: 'bangladeshi-mobile' }
    expect(holds(rule, { p: '01712345678' })).toBe(true)
    expect(holds(rule, { p: '12345' })).toBe(false)
  })
  it('refuses a pattern that is not one of ours, rather than compiling it', () => {
    const rule = { question: 'p', operator: 'matches', pattern: '^(a+)+$' } as unknown as Rule
    expect(holds(rule, { p: 'aaaa' })).toBe(false)
  })
})

describe('combining rules', () => {
  it('ALL needs every part', () => {
    const rule: Rule = { all: [
      { question: 'a', operator: 'is', value: true },
      { question: 'b', operator: 'more-than', value: 5 },
    ] }
    expect(holds(rule, { a: true, b: 6 })).toBe(true)
    expect(holds(rule, { a: true, b: 4 })).toBe(false)
  })
  it('ANY needs one part', () => {
    const rule: Rule = { any: [
      { question: 'a', operator: 'is', value: true },
      { question: 'b', operator: 'more-than', value: 5 },
    ] }
    expect(holds(rule, { a: false, b: 6 })).toBe(true)
    expect(holds(rule, { a: false, b: 4 })).toBe(false)
  })
  it('NOT turns it around', () => {
    expect(holds({ not: { question: 'a', operator: 'is', value: true } }, { a: false })).toBe(true)
  })
  it('handles rules inside rules', () => {
    const rule: Rule = { all: [
      { question: 'a', operator: 'is', value: true },
      { any: [{ question: 'b', operator: 'is', value: 1 }, { question: 'c', operator: 'is', value: 2 }] },
    ] }
    expect(holds(rule, { a: true, c: 2 })).toBe(true)
    expect(holds(rule, { a: true, b: 9, c: 9 })).toBe(false)
  })
  it('an empty ALL holds, an empty ANY does not — stated, not accidental', () => {
    expect(holds({ all: [] }, {})).toBe(true)
    expect(holds({ any: [] }, {})).toBe(false)
  })
})

describe('deciding which questions a worker actually sees', () => {
  it('hides a question whose rule does not hold, and shows one with no rule', () => {
    const questions = [
      { id: 'pregnant', showIf: undefined },
      { id: 'months', showIf: { question: 'pregnant', operator: 'is', value: true } as Rule },
    ]
    expect(questions.filter(q => !q.showIf || holds(q.showIf, { pregnant: false })).map(q => q.id))
      .toEqual(['pregnant'])
    expect(questions.filter(q => !q.showIf || holds(q.showIf, { pregnant: true })).map(q => q.id))
      .toEqual(['pregnant', 'months'])
  })
})
