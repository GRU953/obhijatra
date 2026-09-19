// WHAT THIS FILE IS FOR
//   Decides which screen to show, in this order:
//     1. let the person in   -- fingerprint if the phone has one, else a PIN
//     2. open the locked database
//     3. sign in             -- nothing reaches the server without this
//     4. fill forms and send them
//   Each step happens only once the one before it has genuinely succeeded, and
//   any failure is shown rather than swallowed.
import { useCallback, useEffect, useState } from 'react'
import { tokens } from './ui/tokens'
import { both } from './ui/text'
import { openEncryptedDatabase, describeLock } from './data/local/database'
import { countWaiting, canWorkOffline } from './data/local/submissions'
import { fingerprintAvailable, askForFingerprint } from './security/unlock'
import { currentSession, signOut, type SignedIn } from './data/remote/session'
import { helloForm } from './forms/helloForm'
import { formsAvailable } from './data/local/formStore'
import type { FormDefinition } from './forms/definition'
import { UnlockScreen } from './ui/UnlockScreen'
import { SignInScreen } from './ui/SignInScreen'
import { FormScreen } from './ui/FormScreen'
import { SyncStatus } from './ui/SyncStatus'
import { ReviewScreen } from './ui/ReviewScreen'

type Stage = 'starting' | 'locked' | 'signing-in' | 'working' | 'reviewing' | 'broken'

export function App() {
  const [stage, setStage] = useState<Stage>('starting')
  const [lockNote, setLockNote] = useState('')
  const [lockReason, setLockReason] = useState('')
  const [problem, setProblem] = useState('')
  const [session, setSession] = useState<SignedIn | null>(null)
  const [waiting, setWaiting] = useState(0)
  // Forms this phone has actually received. Until one arrives, the built-in one
  // is offered so the app is never empty and unusable.
  const [forms, setForms] = useState<FormDefinition[]>([])
  const [chosen, setChosen] = useState<FormDefinition | null>(null)

  const refreshWaiting = useCallback(() => {
    void countWaiting().then(setWaiting).catch(() => {})
    void formsAvailable().then(setForms).catch(() => setForms([]))
  }, [])

  /** Runs once the person has been let in. Opens the database, THEN continues. */
  const afterUnlocked = useCallback(async () => {
    try {
      // This is the step an earlier version missed after a PIN unlock, which
      // left every later Save waiting for a database that was never opened.
      if (canWorkOffline()) await openEncryptedDatabase()
      const who = await currentSession()
      setSession(who)
      refreshWaiting()
      setStage(who ? 'working' : 'signing-in')
    } catch (error) {
      setProblem(error instanceof Error ? error.message : String(error))
      setStage('broken')
    }
  }, [refreshWaiting])

  useEffect(() => {
    void (async () => {
      try {
        setLockNote(await describeLock())
        if (!canWorkOffline()) { await afterUnlocked(); return }
        // Fingerprint first, because it is the easiest thing for someone who
        // cannot read. Every unhappy path -- no sensor, no enrolled finger,
        // nobody touches it -- simply offers the PIN instead.
        if (await fingerprintAvailable() && await askForFingerprint()) {
          await afterUnlocked()
          return
        }
        setLockReason(both('usePin'))
        setStage('locked')
      } catch (error) {
        setProblem(error instanceof Error ? error.message : String(error))
        setStage('broken')
      }
    })()
  }, [afterUnlocked])

  return (
    <main style={{
      background: tokens.color.surface, color: tokens.color.onSurface,
      fontSize: tokens.text.body.size, minHeight: '100vh',
    }}>
      <header style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: tokens.space.md, background: tokens.color.primary, color: tokens.color.onPrimary,
      }}>
        <strong style={{ fontSize: tokens.text.title.size }}>অভিযাত্রা · Obhijatra</strong>
        {session && (
          <button onClick={() => { void signOut().then(() => { setSession(null); setStage('signing-in') }) }} style={{
            minHeight: tokens.space.minTapTarget, background: 'transparent',
            color: tokens.color.onPrimary, border: `1px solid ${tokens.color.onPrimary}`,
            borderRadius: tokens.radius.full, padding: `0 ${tokens.space.md}px`,
          }}>Sign out</button>
        )}
      </header>

      {stage === 'starting' && <p style={{ padding: tokens.space.lg }}>{both('unlocking')}</p>}

      {stage === 'locked' && (
        <UnlockScreen reason={lockReason} onUnlocked={() => { void afterUnlocked() }} />
      )}

      {stage === 'signing-in' && <SignInScreen onSignedIn={() => { void afterUnlocked() }} />}

      {stage === 'working' && session && (
        <>
          <SyncStatus waiting={waiting} onChanged={refreshWaiting} />
          {forms.length > 0 && (
            <div style={{ padding: `0 ${tokens.space.lg}px` }}>
              <p style={{ fontSize: tokens.text.label.size, color: tokens.color.outline, margin: 0 }}>
                ফর্ম বেছে নিন · Choose a form
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: tokens.space.sm, marginTop: tokens.space.sm }}>
                {forms.map((f) => {
                  const active = (chosen ?? forms[0])?.formId === f.formId
                  return (
                    <button key={f.formId} onClick={() => setChosen(f)} style={{
                      minHeight: tokens.space.minTapTarget, padding: `0 ${tokens.space.md}px`,
                      fontSize: tokens.text.body.size, borderRadius: tokens.radius.full,
                      border: `1px solid ${tokens.color.primary}`,
                      background: active ? tokens.color.primary : tokens.color.surface,
                      color: active ? tokens.color.onPrimary : tokens.color.primary,
                    }}>{f.title.bn} · {f.title.en}</button>
                  )
                })}
              </div>
            </div>
          )}
          <FormScreen
            form={chosen ?? forms[0] ?? helloForm}
            organisationId={session.organisationId}
            collectedBy={session.userId}
            deviceId="phone-1"
            onSaved={refreshWaiting}
          />
          <div style={{ padding: `0 ${tokens.space.lg}px ${tokens.space.lg}px` }}>
            <button onClick={() => setStage('reviewing')} style={{
              minHeight: tokens.space.minTapTarget, width: '100%',
              fontSize: tokens.text.body.size, borderRadius: tokens.radius.full,
              border: `1px solid ${tokens.color.outline}`, background: tokens.color.surface,
              color: tokens.color.onSurface,
            }}>{both('viewSent')}</button>
          </div>
        </>
      )}

      {stage === 'reviewing' && <ReviewScreen onBack={() => setStage('working')} />}

      {stage === 'broken' && <p style={{ padding: tokens.space.lg, color: tokens.color.error }}>{problem}</p>}

      <p style={{ padding: tokens.space.lg, fontSize: tokens.text.label.size, color: tokens.color.outline }}>
        {lockNote}
      </p>
    </main>
  )
}
