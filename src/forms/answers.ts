// WHAT THIS FILE IS FOR
//   Two jobs, both done before an answer is ever saved:
//     1. Delete answers to questions the worker can no longer see.
//     2. Check the answers that remain.
//
// THE PRIVACY PROMISE THIS KEEPS
//   A worker types "has children: yes", fills in three children's names, then
//   corrects it to "no". The three questions disappear. Their answers are
//   DELETED, not kept quietly in the record.
//
//   Without this, a household register would hold three children's names in a
//   file saying the household has none -- personal details about people the
//   respondent was never actually asked about. That is a real privacy problem
//   and a hard one to explain to a regulator or a donor. It is also what the
//   ODK specification requires and what every mature tool in this sector does.
//
//   Nothing is lost for reporting. Because our rules are pure information, with
//   nothing random or time-dependent in them, replaying the frozen edition
//   against the answers reconstructs exactly which questions were hidden. A
//   report can still honestly say "40 of the 62 households we asked".
import { NAMED_PATTERNS, type Check, type FormDefinition, type Question } from './definition'
import { ruleHolds } from './rules'

function isBlank(answer: unknown): boolean {
  if (answer === null || answer === undefined) return true
  if (typeof answer === 'string') return answer.trim() === ''
  if (Array.isArray(answer)) return answer.length === 0
  return false
}

/**
 * Works out which questions the worker can actually see, in order.
 *
 * Questions are walked front to back, and each rule is judged against the
 * answers KEPT SO FAR rather than everything typed. That is what makes a chain
 * collapse properly: if A hides B, then C — which depends on B — disappears
 * too, and its answer goes with it.
 */
export function shownQuestions(
  definition: FormDefinition, answers: Record<string, unknown>,
): Question[] {
  const shown: Question[] = []
  const kept: Record<string, unknown> = {}
  for (const question of definition.questions) {
    if (question.showIf && !ruleHolds(question.showIf, kept)) continue
    shown.push(question)
    if (question.id in answers) kept[question.id] = answers[question.id]
  }
  return shown
}

/**
 * The answers as they should be stored: hidden ones removed, and anything not
 * belonging to this edition of the form dropped.
 * `shown` is the list of questions the worker actually saw.
 */
export function prepareForSaving(
  definition: FormDefinition, answers: Record<string, unknown>,
): { answers: Record<string, unknown>; shown: string[] } {
  const shown = shownQuestions(definition, answers)
  const kept: Record<string, unknown> = {}
  for (const question of shown) {
    if (question.type === 'note') continue          // a note takes no answer
    if (question.id in answers) kept[question.id] = answers[question.id]
  }
  return { answers: kept, shown: shown.map((q) => q.id) }
}

function checkFails(check: Check, answer: unknown): boolean {
  switch (check.type) {
    case 'smallest': return Number(answer) < check.value
    case 'largest':  return Number(answer) > check.value
    case 'shortest': return String(answer).length < check.value
    case 'longest':  return String(answer).length > check.value
    case 'before-today': return Date.parse(String(answer)) >= Date.now()
    case 'after-today':  return Date.parse(String(answer)) <= Date.now()
    case 'matches': {
      // Only ever one of our named patterns, looked up by name. An author
      // cannot supply one; the validator refuses a form that tries.
      const pattern = NAMED_PATTERNS[check.pattern as keyof typeof NAMED_PATTERNS]
      return pattern ? !pattern.test(String(answer)) : false
    }
    default: return false
  }
}

/** What is wrong with these answers, in the worker's own words. Empty means fine. */
export function checkAnswers(
  definition: FormDefinition, answers: Record<string, unknown>, language: 'bn' | 'en' = 'en',
): { problems: string[]; blankRequired: string[] } {
  const problems: string[] = []
  const blankRequired: string[] = []

  for (const question of shownQuestions(definition, answers)) {
    const answer = answers[question.id]

    if (question.required && question.type !== 'note' && isBlank(answer)) {
      blankRequired.push(question.id)
      problems.push(`${question.label[language]}: this must be filled in.`)
      continue
    }

    // A check is never applied to a blank answer. Only "required" forbids
    // blank, and it has its own message. Borrowed from XLSForm, where twenty
    // years of field use settled it.
    if (isBlank(answer)) continue

    for (const check of question.checks ?? []) {
      if (checkFails(check, answer)) problems.push(`${question.label[language]}: ${check.message[language]}`)
    }
  }

  return { problems, blankRequired }
}
