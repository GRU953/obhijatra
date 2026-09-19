// WHAT THIS FILE IS FOR
//   Draws ONE question, whichever of the eleven types it is. Kept separate from
//   the form screen so each type can be reasoned about on its own.
//
// SAFETY, RESTATED HERE BECAUSE IT IS EASY TO FORGET IN A FILE LIKE THIS
//   Every label and every option comes from a form an administrator wrote. It
//   goes on screen as TEXT. React does that by default; what must never appear
//   here is dangerouslySetInnerHTML or innerHTML, and an automatic check refuses
//   any change that adds them.
import { useState } from 'react'
import { Geolocation } from '@capacitor/geolocation'
import { tokens } from './tokens'
import type { Question } from '../forms/definition'

type Props = {
  question: Question
  value: unknown
  wrong: boolean
  onChange: (value: unknown) => void
}

const boxStyle = (wrong: boolean) => ({
  width: '100%', minHeight: tokens.space.minTapTarget, boxSizing: 'border-box' as const,
  fontSize: tokens.text.body.size, padding: tokens.space.sm,
  borderRadius: tokens.radius.sm,
  border: `1px solid ${wrong ? tokens.color.error : tokens.color.outline}`,
})

const chipStyle = (chosen: boolean) => ({
  minHeight: tokens.space.minTapTarget, padding: `0 ${tokens.space.md}px`,
  fontSize: tokens.text.body.size, borderRadius: tokens.radius.full,
  border: `1px solid ${tokens.color.primary}`,
  background: chosen ? tokens.color.primary : tokens.color.surface,
  color: chosen ? tokens.color.onPrimary : tokens.color.primary,
})

export function QuestionField({ question, value, wrong, onChange }: Props) {
  const [search, setSearch] = useState('')
  const [findingPlace, setFindingPlace] = useState(false)
  const [placeProblem, setPlaceProblem] = useState('')

  const text = (type: string) => (
    <input type={type} inputMode={type === 'tel' ? 'numeric' : undefined}
      value={value === undefined || value === null ? '' : String(value)}
      onChange={(e) => onChange(e.target.value)} style={boxStyle(wrong)} />
  )

  switch (question.type) {
    case 'note':
      return null   // a note is its own label; it takes no answer

    case 'paragraph':
      return (
        <textarea rows={4} value={value === undefined || value === null ? '' : String(value)}
          onChange={(e) => onChange(e.target.value)} style={boxStyle(wrong)} />
      )

    case 'whole-number':
    case 'decimal-number':
      return (
        <input type="number" inputMode={question.type === 'whole-number' ? 'numeric' : 'decimal'}
          step={question.type === 'whole-number' ? 1 : 'any'}
          value={value === undefined || value === null ? '' : String(value)}
          onChange={(e) => onChange(e.target.value === '' ? '' : Number(e.target.value))}
          style={boxStyle(wrong)} />
      )

    case 'date': return text('date')
    case 'time': return text('time')
    case 'mobile-number': return text('tel')

    case 'yes-no':
      return (
        <div style={{ display: 'flex', gap: tokens.space.sm }}>
          {[true, false].map((choice) => (
            <button key={String(choice)} type="button" onClick={() => onChange(choice)}
              style={{ ...chipStyle(value === choice), flex: 1 }}>
              {choice ? 'হ্যাঁ · Yes' : 'না · No'}
            </button>
          ))}
        </div>
      )

    case 'choose-one':
    case 'choose-several': {
      const many = question.type === 'choose-several'
      const chosen: unknown[] = many ? (Array.isArray(value) ? value : []) : [value]
      const options = (question.choices ?? []).filter((c) =>
        !search.trim() ||
        c.label.bn.includes(search) ||
        c.label.en.toLowerCase().includes(search.toLowerCase()))

      return (
        <>
          {question.searchable && (
            <input value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="খুঁজুন · Search"
              style={{ ...boxStyle(false), marginBottom: tokens.space.sm }} />
          )}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: tokens.space.sm }}>
            {options.map((choice) => {
              const isChosen = chosen.includes(choice.value)
              return (
                <button key={choice.value} type="button" style={chipStyle(isChosen)}
                  onClick={() => {
                    if (!many) { onChange(isChosen ? undefined : choice.value); return }
                    const current = Array.isArray(value) ? [...value] : []
                    onChange(isChosen ? current.filter((v) => v !== choice.value)
                                      : [...current, choice.value])
                  }}>
                  {choice.label.bn} · {choice.label.en}
                </button>
              )
            })}
          </div>
        </>
      )
    }

    case 'location': {
      const place = value as { latitude?: number; longitude?: number } | undefined
      return (
        <>
          <button type="button" disabled={findingPlace} style={{ ...chipStyle(false), width: '100%' }}
            onClick={() => {
              setFindingPlace(true); setPlaceProblem('')
              void Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 20_000 })
                .then((p) => onChange({
                  latitude: p.coords.latitude, longitude: p.coords.longitude, accuracy: p.coords.accuracy,
                }))
                // Never silent: a worker under a tin roof must be told why,
                // not left looking at a button that did nothing.
                .catch((e: unknown) => setPlaceProblem(
                  e instanceof Error ? e.message : 'Could not find where you are. Try outdoors.'))
                .finally(() => setFindingPlace(false))
            }}>
            {findingPlace ? 'খোঁজা হচ্ছে…' : 'অবস্থান নিন · Take location'}
          </button>
          {place?.latitude !== undefined && (
            <p style={{ fontSize: tokens.text.label.size, color: tokens.color.outline, margin: tokens.space.xs }}>
              {place.latitude.toFixed(5)}, {place.longitude?.toFixed(5)}
            </p>
          )}
          {placeProblem && <p style={{ color: tokens.color.error }}>{placeProblem}</p>}
        </>
      )
    }

    default:
      return text('text')   // short-text, and anything a newer edition adds
  }
}
