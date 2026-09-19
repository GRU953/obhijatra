// WHAT THIS FILE IS FOR
//   Refusing a broken form BEFORE it can reach anybody's phone.
//
// WHERE THIS RUNS
//   Three places, deliberately: in the builder as the author types, in the
//   automatic checks on every save, and ON THE PHONE for every form it
//   downloads. The third matters most -- a check that runs only on the author's
//   own computer protects nobody, because anyone with a password could send the
//   server whatever they liked.
//
// WHAT IT GIVES
//   A list of problems in plain English. Empty means the form is sound.
import {
  COMPARISONS, MAX_DEFINITION_BYTES, NAMED_PATTERNS, TYPES_WITH_CHOICES,
  type Condition, type FormDefinition, type Question, type Rule,
} from './definition'

const isCondition = (rule: Rule): rule is Condition => 'question' in rule

/** Every question a rule depends on, however deeply it is nested. */
function questionsNamedBy(rule: Rule): string[] {
  if (isCondition(rule)) return [rule.question]
  if ('all' in rule) return rule.all.flatMap(questionsNamedBy)
  if ('any' in rule) return rule.any.flatMap(questionsNamedBy)
  return questionsNamedBy(rule.not)
}

function conditionsIn(rule: Rule): Condition[] {
  if (isCondition(rule)) return [rule]
  if ('all' in rule) return rule.all.flatMap(conditionsIn)
  if ('any' in rule) return rule.any.flatMap(conditionsIn)
  return conditionsIn(rule.not)
}

function checkQuestion(q: Question, position: number, earlier: Set<string>, problems: string[]) {
  const where = q.id ? `Question "${q.id}"` : `The question in position ${position + 1}`

  if (!q.id.trim()) problems.push(`${where} has no name. Every question needs one that never changes.`)
  if (!q.label?.bn?.trim()) problems.push(`${where} has no Bangla (bn) label.`)
  if (!q.label?.en?.trim()) problems.push(`${where} has no English (en) label.`)

  const mayHaveChoices = TYPES_WITH_CHOICES.includes(q.type)
  if (mayHaveChoices && (!q.choices || q.choices.length === 0)) {
    problems.push(`${where} is a choice question but has no options to choose from.`)
  }
  if (!mayHaveChoices && q.choices && q.choices.length > 0) {
    problems.push(`${where} is a "${q.type}" question, which cannot have options.`)
  }
  if (q.choices) {
    const seen = new Set<string>()
    for (const choice of q.choices) {
      if (seen.has(choice.value)) problems.push(`${where} lists the option "${choice.value}" twice.`)
      seen.add(choice.value)
      if (!choice.label?.bn?.trim() || !choice.label?.en?.trim()) {
        problems.push(`${where}: the option "${choice.value}" needs a label in both languages.`)
      }
    }
  }

  for (const check of q.checks ?? []) {
    if (check.type === 'matches' && !(check.pattern in NAMED_PATTERNS)) {
      problems.push(
        `${where} uses a pattern we do not recognise ("${check.pattern}"). ` +
        `Patterns must be one of: ${Object.keys(NAMED_PATTERNS).join(', ')}. ` +
        `Invented patterns can freeze a cheap phone with no error message, so they are not allowed.`)
    }
  }

  if (q.showIf) {
    for (const named of questionsNamedBy(q.showIf)) {
      if (named === q.id) {
        problems.push(`${where} has a rule that depends on itself, which can never be decided.`)
      } else if (!earlier.has(named)) {
        problems.push(
          `${where} has a rule about "${named}", which is not an earlier question. ` +
          `A rule may only look at questions that appear before it; that is what makes loops impossible.`)
      }
    }
    for (const condition of conditionsIn(q.showIf)) {
      if (!COMPARISONS.includes(condition.operator)) {
        problems.push(`${where} uses a comparison we do not recognise ("${condition.operator}").`)
      }
      if (condition.operator === 'matches' && !(condition.pattern && condition.pattern in NAMED_PATTERNS)) {
        problems.push(`${where} uses "matches" without one of our named patterns.`)
      }
    }
  }
}

export function validateFormDefinition(definition: FormDefinition): { problems: string[] } {
  const problems: string[] = []

  if (!definition.formId?.trim()) problems.push('The form has no name that never changes.')
  if (!Number.isInteger(definition.edition) || definition.edition < 1) {
    problems.push('The edition must be a whole number, 1 or more.')
  }
  if (!definition.title?.bn?.trim() || !definition.title?.en?.trim()) {
    problems.push('The form needs a title in both Bangla and English.')
  }
  if (!definition.questions || definition.questions.length === 0) {
    problems.push('The form has no questions.')
  }

  const earlier = new Set<string>()
  const seen = new Set<string>()
  ;(definition.questions ?? []).forEach((q, position) => {
    if (q.id && seen.has(q.id)) problems.push(`The name "${q.id}" is used by two questions. Names must be unique.`)
    seen.add(q.id)
    checkQuestion(q, position, earlier, problems)
    if (q.id) earlier.add(q.id)
  })

  // Measured the same way it will be stored and sent, so the number is honest.
  const bytes = new TextEncoder().encode(JSON.stringify(definition)).length
  if (bytes > MAX_DEFINITION_BYTES) {
    problems.push(
      `This form is ${Math.round(bytes / 1024)} KB, and the most allowed is ` +
      `${MAX_DEFINITION_BYTES / 1024} KB. Very large forms are slow and unreliable on a cheap phone.`)
  }

  return { problems }
}
