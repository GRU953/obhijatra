// Proves every one of the eleven types survives being saved and read back,
// including Bangla text and the characters that break careless code.
import { describe, it, expect, beforeEach } from 'vitest'
import { saveSubmission, listUnsent, resetLocalForTest } from '../../src/data/local/submissions'
import { prepareForSaving, checkAnswers } from '../../src/forms/answers'
import { validateFormDefinition } from '../../src/forms/validate'
import type { FormDefinition, QuestionType } from '../../src/forms/definition'

const t = (s: string) => ({ bn: s, en: s })

const everyType: FormDefinition = {
  formId: 'every-type', edition: 1, title: t('Every type'),
  questions: [
    { id: 'shortText',   type: 'short-text',     label: t('Short'),   required: false },
    { id: 'paragraph',   type: 'paragraph',      label: t('Long'),    required: false },
    { id: 'whole',       type: 'whole-number',   label: t('Whole'),   required: false },
    { id: 'decimal',     type: 'decimal-number', label: t('Decimal'), required: false },
    { id: 'yesNo',       type: 'yes-no',         label: t('Yes/No'),  required: false },
    { id: 'chooseOne',   type: 'choose-one',     label: t('One'),     required: false,
      choices: [{ value: 'a', label: t('A') }, { value: 'b', label: t('B') }] },
    { id: 'chooseMany',  type: 'choose-several', label: t('Many'),    required: false,
      choices: [{ value: 'rice', label: t('Rice') }, { value: 'oil', label: t('Oil') }] },
    { id: 'date',        type: 'date',           label: t('Date'),    required: false },
    { id: 'time',        type: 'time',           label: t('Time'),    required: false },
    { id: 'mobile',      type: 'mobile-number',  label: t('Mobile'),  required: false },
    { id: 'location',    type: 'location',       label: t('Where'),   required: false },
    { id: 'note',        type: 'note',           label: t('Read this'), required: false },
  ],
}

const answers = {
  shortText: 'রহিমা বেগম',
  paragraph: "Two lines\nand an O'Brien \"quote\" <script>alert(1)</script>",
  whole: 7,
  decimal: 3.25,
  yesNo: true,
  chooseOne: 'b',
  chooseMany: ['rice', 'oil'],
  date: '2026-09-19',
  time: '14:30',
  mobile: '01712345678',
  location: { latitude: 23.8103, longitude: 90.4125, accuracy: 12 },
}

describe('every question type', () => {
  beforeEach(async () => { await resetLocalForTest() })

  it('is a form the validator accepts', () => {
    expect(validateFormDefinition(everyType).problems).toEqual([])
  })

  it('covers all eleven types plus note', () => {
    const types = new Set<QuestionType>(everyType.questions.map(q => q.type))
    expect(types.size).toBe(12)
  })

  it('survives being saved and read back, unchanged', async () => {
    const { answers: toStore } = prepareForSaving(everyType, answers)
    await saveSubmission({
      organisationId: 'org-a', collectedBy: 'w1', deviceId: 'p1',
      formId: everyType.formId, formVersion: everyType.edition, answers: toStore,
    })
    const [saved] = await listUnsent()
    expect(saved!.answers).toEqual(answers)
  })

  it('keeps Bangla exactly as typed', async () => {
    await saveSubmission({
      organisationId: 'org-a', collectedBy: 'w1', deviceId: 'p1',
      formId: 'f', formVersion: 1, answers: { name: 'অভিযাত্রা ৯৯%' },
    })
    expect((await listUnsent())[0]!.answers['name']).toBe('অভিযাত্রা ৯৯%')
  })

  it('stores something that looks like code as ordinary text', async () => {
    const nasty = '<script>alert(1)</script>'
    await saveSubmission({
      organisationId: 'org-a', collectedBy: 'w1', deviceId: 'p1',
      formId: 'f', formVersion: 1, answers: { x: nasty },
    })
    expect((await listUnsent())[0]!.answers['x']).toBe(nasty)
  })

  it('does not store an answer against a note, because a note takes none', () => {
    const { answers: toStore } = prepareForSaving(everyType, { ...answers, note: 'should vanish' })
    expect(toStore['note']).toBeUndefined()
  })

  it('has nothing to complain about when every answer is sound', () => {
    expect(checkAnswers(everyType, answers).problems).toEqual([])
  })
})
