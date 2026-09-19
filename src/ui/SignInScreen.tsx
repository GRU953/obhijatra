// WHAT THIS FILE IS FOR
//   Signing in. Kept deliberately plain for this first version: the helper-led
//   setup flow, where a supervisor sets up a new person in under ten minutes,
//   arrives in a later phase. The field evidence is clear that a first-time
//   smartphone user cannot create an account unaided, so this screen is for
//   office staff and supervisors, not for a field worker on their own.
import { useState } from 'react'
import { tokens } from './tokens'
import { signIn, signUp } from '../data/remote/session'

export function SignInScreen({ onSignedIn }: { onSignedIn: () => void }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [problem, setProblem] = useState('')
  const [busy, setBusy] = useState(false)

  const attempt = async (which: 'in' | 'up') => {
    setBusy(true); setProblem('')
    const error = which === 'in' ? await signIn(email, password) : await signUp(email, password)
    setBusy(false)
    if (error) { setProblem(error); return }
    onSignedIn()
  }

  const field = (label: string, value: string, set: (v: string) => void, type: string) => (
    <label style={{ display: 'block', marginBottom: tokens.space.md }}>
      <span style={{ display: 'block', marginBottom: tokens.space.xs }}>{label}</span>
      <input type={type} value={value} onChange={(e) => set(e.target.value)}
        autoCapitalize="none" autoCorrect="off"
        style={{
          width: '100%', minHeight: tokens.space.minTapTarget, boxSizing: 'border-box',
          fontSize: tokens.text.body.size, padding: tokens.space.sm,
          borderRadius: tokens.radius.sm, border: `1px solid ${tokens.color.outline}`,
        }} />
    </label>
  )

  const button = (label: string, filled: boolean, action: () => void) => (
    <button onClick={action} disabled={busy} style={{
      minHeight: tokens.space.minTapTarget, width: '100%', marginBottom: tokens.space.sm,
      fontSize: tokens.text.body.size, borderRadius: tokens.radius.full,
      border: filled ? 'none' : `1px solid ${tokens.color.primary}`,
      background: filled ? tokens.color.primary : tokens.color.surface,
      color: filled ? tokens.color.onPrimary : tokens.color.primary,
      opacity: busy ? 0.5 : 1,
    }}>{label}</button>
  )

  return (
    <section style={{ padding: tokens.space.lg }}>
      <h2 style={{ fontSize: tokens.text.title.size }}>সাইন ইন · Sign in</h2>
      {field('ইমেল · Email', email, setEmail, 'email')}
      {field('পাসওয়ার্ড · Password', password, setPassword, 'password')}
      {button('সাইন ইন · Sign in', true, () => { void attempt('in') })}
      {button('নতুন অ্যাকাউন্ট · Create an account', false, () => { void attempt('up') })}
      <p style={{ color: tokens.color.error, minHeight: tokens.space.lg }}>{problem}</p>
    </section>
  )
}
