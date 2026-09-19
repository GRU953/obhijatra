// WHAT THIS FILE IS FOR
//   Shows a form and saves the answers onto the phone. The form is drawn from
//   ordinary information, never from code written for one particular form —
//   which is what makes the no-code form builder possible in the next phase.
//
// SAFETY
//   Every label is put on screen as TEXT. Never as markup. An administrator
//   writes these labels, and on a phone the browser view holds the database
//   key, so a label that could run as code would be a way into the data.
//   An automatic check refuses any change that breaks this rule.
import { useState } from 'react'
import { tokens } from './tokens'
import { text, both } from './text'
import type { Form } from '../forms/helloForm'
import { saveSubmission } from '../data/local/submissions'

export function FormScreen({ form, organisationId, collectedBy, deviceId, onSaved }: {
  form: Form; organisationId: string; collectedBy: string; deviceId: string; onSaved: () => void
}) {
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [missing, setMissing] = useState<string[]>([])
  const [note, setNote] = useState('')

  const save = async () => {
    const blank = form.questions.filter(q => q.required && !(answers[q.id] ?? '').trim()).map(q => q.id)
    setMissing(blank)
    if (blank.length > 0) return
    await saveSubmission({
      organisationId, collectedBy, deviceId,
      formId: form.id, formVersion: form.version, answers,
    })
    setAnswers({}); setNote(both('saved')); onSaved()
  }

  return (
    <section style={{ padding: tokens.space.lg }}>
      <h2 style={{ fontSize: tokens.text.title.size }}>
        {form.title.bn} · {form.title.en}
      </h2>
      {form.questions.map((q) => (
        <label key={q.id} style={{ display: 'block', marginBottom: tokens.space.md }}>
          <span style={{ display: 'block', marginBottom: tokens.space.xs }}>
            {q.label.bn} · {q.label.en}
          </span>
          <input
            value={answers[q.id] ?? ''}
            onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })}
            style={{
              width: '100%', minHeight: tokens.space.minTapTarget,
              fontSize: tokens.text.body.size, padding: tokens.space.sm,
              borderRadius: tokens.radius.sm, boxSizing: 'border-box',
              border: `1px solid ${missing.includes(q.id) ? tokens.color.error : tokens.color.outline}`,
            }}
          />
          {missing.includes(q.id) && (
            <span style={{ color: tokens.color.error, fontSize: tokens.text.label.size }}>
              {both('required')}
            </span>
          )}
        </label>
      ))}
      <button onClick={() => { void save() }} style={{
        minHeight: tokens.space.minTapTarget, width: '100%',
        fontSize: tokens.text.body.size, borderRadius: tokens.radius.full, border: 'none',
        background: tokens.color.primary, color: tokens.color.onPrimary,
      }}>{both('save')}</button>
      <p style={{ color: tokens.color.primary, minHeight: tokens.space.lg }}>{note}</p>
      <p style={{ fontSize: tokens.text.label.size, color: tokens.color.outline }}>
        {text.appName.bn} · {form.id} v{form.version}
      </p>
    </section>
  )
}
