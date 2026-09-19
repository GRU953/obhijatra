// WHAT THIS FILE IS FOR
//   The shape of a form. A form is ORDINARY INFORMATION, not code: a list of
//   questions with labels and rules. That is what lets a form travel to a phone
//   through the sync that already works, instead of being a change to the
//   database that a phone switched off in a village could never receive.
//
// THE RULE BEHIND ALL OF THIS
//   Publishing is printing. You can print edition 4, but you can never change
//   the copies already handed out. Every answer records its edition, so an
//   answer given three years ago still means exactly what it meant on the day.

/** Every word a person reads exists in both languages. Half a translation is a broken screen. */
export type Text = { readonly bn: string; readonly en: string }

/** The eleven types, plus Note which shows text and takes no answer. */
export type QuestionType =
  | 'short-text' | 'paragraph' | 'whole-number' | 'decimal-number'
  | 'yes-no' | 'choose-one' | 'choose-several' | 'date' | 'time'
  | 'mobile-number' | 'location' | 'note'

/** Types that may carry a list of options. Anything else may not. */
export const TYPES_WITH_CHOICES: readonly QuestionType[] = ['choose-one', 'choose-several']

export type Choice = {
  readonly value: string
  readonly label: Text
  /** Used only by the scored-quiz mode. A total is worked out when shown, never stored. */
  readonly points?: number
}

/**
 * Patterns are OURS. An author-written one can freeze a cheap phone solid
 * mid-interview with no error message at all, because some patterns take
 * exponentially long to fail. That is the same silent-failure class that has
 * already cost this project a shipped bug, so authors choose from this list.
 */
export const NAMED_PATTERNS = {
  'bangladeshi-mobile': /^(?:\+?880|0)1[3-9]\d{8}$/,
  'digits-only': /^\d+$/,
  'letters-only': /^[\p{L} ]+$/u,
  'email': /^[^@\s]+@[^@\s]+\.[^@\s]+$/,
} as const
export type PatternName = keyof typeof NAMED_PATTERNS

/** The ten comparisons. A closed list: there is nothing else an author may ask for. */
export type Comparison =
  | 'is' | 'is-not'
  | 'more-than' | 'at-least' | 'less-than' | 'at-most'
  | 'was-answered' | 'was-left-blank'
  | 'includes' | 'matches'

export const COMPARISONS: readonly Comparison[] = [
  'is', 'is-not', 'more-than', 'at-least', 'less-than', 'at-most',
  'was-answered', 'was-left-blank', 'includes', 'matches',
]

export type Condition = {
  readonly question: string
  readonly operator: Comparison
  readonly value?: string | number | boolean
  /** Only for `matches`, and only ever one of our named patterns. */
  readonly pattern?: PatternName
}

/**
 * A rule is information the app READS, never code it runs. There is no text to
 * interpret, so there is nothing to escape and nothing to break into.
 * Three ways to combine: ALL, ANY, NOT.
 */
export type Rule =
  | Condition
  | { readonly all: readonly Rule[] }
  | { readonly any: readonly Rule[] }
  | { readonly not: Rule }

/** The fixed menu of checks. Each carries its own message, in both languages. */
export type Check =
  | { readonly type: 'smallest' | 'largest'; readonly value: number; readonly message: Text }
  | { readonly type: 'shortest' | 'longest'; readonly value: number; readonly message: Text }
  | { readonly type: 'before-today' | 'after-today'; readonly message: Text }
  | { readonly type: 'matches'; readonly pattern: string; readonly message: Text }

export type Question = {
  readonly id: string
  readonly type: QuestionType
  readonly label: Text
  readonly required: boolean
  readonly choices?: readonly Choice[]
  /** A long list is shown with a search box. A display setting, not a type. */
  readonly searchable?: boolean
  /** Shown only when this rule holds. May name only EARLIER questions. */
  readonly showIf?: Rule
  readonly checks?: readonly Check[]
}

export type FormDefinition = {
  readonly formId: string
  readonly edition: number
  readonly title: Text
  readonly questions: readonly Question[]
}

/**
 * The most a single edition may weigh. Refused by the database too, so a form
 * that would strain a cheap phone is stopped on a laptop, on a good connection,
 * in front of the person who caused it -- never in a village.
 *
 * ponytail: a 5,000-village list will not fit. When a real organisation needs
 * one, answer lists move to their own versioned table. Nothing published before
 * then needs changing, because frozen editions keep their own lists forever.
 */
export const MAX_DEFINITION_BYTES = 256 * 1024
