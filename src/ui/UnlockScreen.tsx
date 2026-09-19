// WHAT THIS FILE IS FOR
//   The way in. Tries the fingerprint first, because it is the easiest thing
//   for someone who cannot read. If there is no sensor, or nobody touches it,
//   a large PIN keypad appears instead — every button at least 48 across, which
//   is the smallest an adult finger reliably hits.
import { useState } from 'react'
import { tokens } from './tokens'
import { text, both } from './text'
import { setPin, verifyPin, attemptsRemaining, isPinSet, MIN_PIN_LENGTH } from '../security/pin'

export function UnlockScreen({ onUnlocked, reason }: { onUnlocked: () => void; reason: string }) {
  const [entered, setEntered] = useState('')
  const [message, setMessage] = useState(reason)
  const [needsNewPin, setNeedsNewPin] = useState<boolean | null>(null)

  void (async () => { if (needsNewPin === null) setNeedsNewPin(!(await isPinSet())) })()

  const press = (digit: string) => setEntered((v) => (v.length < 13 ? v + digit : v))
  const rub   = () => setEntered((v) => v.slice(0, -1))

  const submit = async () => {
    if (needsNewPin) {
      if (entered.length < MIN_PIN_LENGTH) { setMessage(both('pinTooShort')); return }
      await setPin(entered)
      onUnlocked()
      return
    }
    if (await verifyPin(entered)) { onUnlocked(); return }
    const left = await attemptsRemaining()
    setMessage(`${both('pinWrong')} — ${left} ${text.attemptsLeft.en}`)
    setEntered('')
  }

  const key = (label: string, action: () => void) => (
    <button key={label} onClick={action} style={{
      minWidth: tokens.space.minTapTarget * 1.5, minHeight: tokens.space.minTapTarget * 1.3,
      fontSize: tokens.text.title.size, borderRadius: tokens.radius.md,
      border: `1px solid ${tokens.color.outline}`, background: tokens.color.surface,
      color: tokens.color.onSurface, margin: tokens.space.xs,
    }}>{label}</button>
  )

  return (
    <section style={{ padding: tokens.space.lg }}>
      <h2 style={{ fontSize: tokens.text.title.size }}>
        {needsNewPin ? both('createPin') : both('enterPin')}
      </h2>
      <p style={{ color: tokens.color.error, minHeight: tokens.space.lg }}>{message}</p>
      <div aria-label="PIN" style={{
        fontSize: tokens.text.title.size, letterSpacing: 8, minHeight: tokens.space.xl,
        padding: tokens.space.sm, border: `1px solid ${tokens.color.outline}`,
        borderRadius: tokens.radius.sm, marginBottom: tokens.space.md,
      }}>{'•'.repeat(entered.length)}</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', maxWidth: 320 }}>
        {['1','2','3','4','5','6','7','8','9'].map((d) => key(d, () => press(d)))}
        {key('←', rub)}
        {key('0', () => press('0'))}
        {key('✓', () => { void submit() })}
      </div>
      <p style={{ marginTop: tokens.space.lg, fontSize: tokens.text.label.size, color: tokens.color.outline }}>
        {both('touchSensor')}
      </p>
    </section>
  )
}
