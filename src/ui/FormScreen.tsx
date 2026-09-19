// WHAT THIS FILE IS FOR
//   Draws a form from its definition and saves the answers onto the phone.
//   It knows nothing about any particular form -- give it a different definition
//   and it draws that instead. That is what makes forms published by a
//   supervisor work without changing any code.
//
// TWO RULES THAT ARE NOT NEGOTIABLE
//   1. Every label is put on screen as TEXT, never as markup. Administrators
//      write these labels, and on a phone the browser view holds the database
//      key, so a label that could run as code would be a way into the data.
//      An automatic check refuses any change that breaks this.
//   2. A failure is always shown. An earlier version let saving fail silently
//      and the button simply did nothing, which is worse than any error message.
import { useState } from 'react'
import { tokens } from './tokens'
import { both } from './text'
import type { FormDefinition } from '../forms/definition'
import { shownQuestions, prepareForSaving, checkAnswers } from '../forms/answers'
import { saveSubmission } from '../data/local/submissions'

type Props = {
  form: FormDefinition
  organisationId: string
  collectedBy: string
  deviceId: string
  onSaved: () => void
}

export function FormScreen({ form, organisationId, collectedBy, deviceId, onSaved }: Props) {
  const [answers, setAnswers] = useState<Record<string, unknown>>({})
  const [problems, setProblems] = useState<string[]>([])
  const [blank, setBlank] = useState<string[]>([])
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)

  // Recomputed on every keystroke, so a question appears and disappears as the
  // worker answers. This is the same function used at saving time, so what is
  // on screen and what is stored can never disagree.
  const visible = shownQuestions(form, answers)

  const set = (id: string, value: unknown) => setAnswers((a) => ({ ...a, [id]: value }))

  const save = async () => {
    const found = checkAnswers(form, answers)
    setProblems(found.problems)
    setBlank(found.blankRequired)
    if (found.problems.length > 0) return

    setBusy(true); setNote('')
    try {
      // Hidden answers are deleted here, once, before anything is stored.
      const { answers: toStore } = prepareForSaving(form, answers)
      await saveSubmission({
        organisationId, collectedBy, deviceId,
        formId: form.formId, formVersion: form.edition, answers: toStore,
      })
      setAnswers({}); setNote(both('saved')); onSaved()
    } catch (error) {
      setProblems([error instanceof Error ? error.message : String(error)])
    } finally {
      setBusy(false)
    }
  }

  const field = (id: string, type: string, value: unknown, wrong: boolean) => (
    <input
      type={type}
      value={value === undefined || value === null ? '' : String(value)}
      onChange={(e) => set(id, type === 'number' ? e.target.valueAsNumber : e.target.value)}
      style={{
        width: '100%', minHeight: tokens.space.minTapTarget, boxSizing: 'border-box',
        fontSize: tokens.text.body.size, padding: tokens.space.sm,
        borderRadius: tokens.radius.sm,
        border: `1px solid ${wrong ? tokens.color.error : tokens.color.outline}`,
      }} />
  )

  return (
    <section style={{ padding: tokens.space.lg }}>
      <h2 style={{ fontSize: tokens.text.title.size }}>
        {form.title.bn} · {form.title.en}
      </h2>

      {visible.map((q) => {
        const wrong = blank.includes(q.id)
        return (
          <label key={q.id} style={{ display: 'block', marginBottom: tokens.space.md }}>
            <span style={{ display: 'block', marginBottom: tokens.space.xs }}>
              {q.label.bn} · {q.label.en}{q.required ? ' *' : ''}
            </span>

            {q.type === 'yes-no' ? (
              <div style={{ display: 'flex', gap: tokens.space.sm }}>
                {[true, false].map((choice) => (
                  <button key={String(choice)} type="button" onClick={() => set(q.id, choice)} style={{
                    flex: 1, minHeight: tokens.space.minTapTarget, fontSize: tokens.text.body.size,
                    borderRadius: tokens.radius.full,
                    border: `1px solid ${tokens.color.primary}`,
                    background: answers[q.id] === choice ? tokens.color.primary : tokens.color.surface,
                    color: answers[q.id] === choice ? tokens.color.onPrimary : tokens.color.primary,
                  }}>{choice ? 'হ্যাঁ · Yes' : 'না · No'}</button>
                ))}
              </div>
            ) : q.type === 'whole-number' || q.type === 'decimal-number' ? (
              field(q.id, 'number', answers[q.id], wrong)
            ) : q.type === 'note' ? null : (
              field(q.id, 'text', answers[q.id], wrong)
            )}
          </label>
        )
      })}

      <button onClick={() => { void save() }} disabled={busy} style={{
        minHeight: tokens.space.minTapTarget, width: '100%',
        fontSize: tokens.text.body.size, borderRadius: tokens.radius.full, border: 'none',
        background: tokens.color.primary, color: tokens.color.onPrimary,
        opacity: busy ? 0.5 : 1,
      }}>{busy ? '…' : both('save')}</button>

      <p style={{ color: tokens.color.primary, minHeight: tokens.space.lg }}>{note}</p>
      {problems.map((p, i) => (
        <p key={i} style={{ color: tokens.color.error, margin: 0 }}>{p}</p>
      ))}
      <p style={{ fontSize: tokens.text.label.size, color: tokens.color.outline }}>
        {form.formId} · edition {form.edition}
      </p>
    </section>
  )
}
