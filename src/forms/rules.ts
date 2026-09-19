// WHAT THIS FILE IS FOR
//   Deciding whether a question should be shown, by READING a rule.
//
// THE ABSOLUTE CONSTRAINT
//   A rule is information, never code. This file contains no eval, no Function,
//   no expression parser and no author-supplied pattern -- only a switch over a
//   closed list of comparisons. That is not caution for its own sake: anything
//   executing inside the phone's browser view can call the database plugin
//   exactly as our own code does. It would not need to find the encryption key,
//   it could simply ask the plugin for the data, or change the key and lock an
//   organisation out of its own records permanently.
//
// HOW BLANKS BEHAVE, WRITTEN DOWN ONCE
//   Any comparison involving a blank is FALSE. Never true, never an error.
//   Only `was-answered` and `was-left-blank` treat a blank as information.
//   Borrowed from XLSForm, where twenty years of field use settled it.
import { NAMED_PATTERNS, type Condition, type Rule } from './definition'

const isCondition = (rule: Rule): rule is Condition => 'question' in rule

/** An answer counts as blank if it is missing, empty text, or an empty list. */
function isBlank(answer: unknown): boolean {
  if (answer === null || answer === undefined) return true
  if (typeof answer === 'string') return answer.trim() === ''
  if (Array.isArray(answer)) return answer.length === 0
  return false
}

/**
 * Puts two answers on the same footing so they can be ordered.
 * Numbers compare as numbers ('9' is not more than '10'), and dates compare in
 * date order rather than alphabetically. Returns null when they cannot be
 * meaningfully ordered, which the caller treats as false.
 */
function asOrderable(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (typeof value === 'string') {
    const asNumber = Number(value)
    if (value.trim() !== '' && Number.isFinite(asNumber)) return asNumber
    const asDate = Date.parse(value)
    return Number.isNaN(asDate) ? null : asDate
  }
  return null
}

function compare(condition: Condition, answer: unknown): boolean {
  switch (condition.operator) {
    case 'was-answered':   return !isBlank(answer)
    case 'was-left-blank': return isBlank(answer)
    default: break
  }

  // Every other comparison is false against a blank. Stated once, here.
  if (isBlank(answer)) return false

  switch (condition.operator) {
    case 'is':     return answer === condition.value
    case 'is-not': return answer !== condition.value

    case 'more-than':
    case 'at-least':
    case 'less-than':
    case 'at-most': {
      const left = asOrderable(answer)
      const right = asOrderable(condition.value)
      if (left === null || right === null) return false
      if (condition.operator === 'more-than') return left > right
      if (condition.operator === 'at-least')  return left >= right
      if (condition.operator === 'less-than') return left < right
      return left <= right
    }

    case 'includes':
      return Array.isArray(answer) && answer.includes(condition.value)

    case 'matches': {
      // Only ever one of OUR patterns, looked up by name. An author-supplied
      // pattern is never compiled, because some take exponentially long to fail
      // and would freeze a cheap phone mid-interview with no error at all.
      const pattern = condition.pattern ? NAMED_PATTERNS[condition.pattern] : undefined
      return pattern ? pattern.test(String(answer)) : false
    }

    default:
      // An operator we do not recognise is false, never an error and never a
      // guess. A form carrying one is refused by the validator long before here.
      return false
  }
}

/** Whether a rule holds, given the answers so far. */
export function ruleHolds(rule: Rule, answers: Record<string, unknown>): boolean {
  if (isCondition(rule)) return compare(rule, answers[rule.question])
  if ('all' in rule) return rule.all.every((part) => ruleHolds(part, answers))
  if ('any' in rule) return rule.any.some((part) => ruleHolds(part, answers))
  return !ruleHolds(rule.not, answers)
}

/** The questions a worker should actually see, given what they have answered. */
export function visibleQuestions<T extends { id: string; showIf?: Rule }>(
  questions: readonly T[], answers: Record<string, unknown>,
): T[] {
  return questions.filter((q) => !q.showIf || ruleHolds(q.showIf, answers))
}
