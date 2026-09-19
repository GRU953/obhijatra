// WHAT THIS FILE IS FOR
//   Decides which screen to show, in this order:
//     1. open the locked database  (fingerprint, or a PIN if that fails)
//     2. sign in                   (nothing reaches the server without it)
//     3. fill forms and send them
//   Each step only happens once the one before it has genuinely succeeded.
import { useEffect, useState } from 'react'
import { tokens } from './ui/tokens'
import { both } from './ui/text'
import { openEncryptedDatabase, LockedOutError, describeLock } from './data/local/database'
import { countWaiting, canWorkOffline } from './data/local/submissions'
import { currentSession, signOut, type SignedIn } from './data/remote/session'
import { helloForm } from './forms/helloForm'
import { UnlockScreen } from './ui/UnlockScreen'
import { SignInScreen } from './ui/SignInScreen'
import { FormScreen } from './ui/FormScreen'
import { SyncStatus } from './ui/SyncStatus'
import { ReviewScreen } from './ui/ReviewScreen'

type Stage = 'opening' | 'locked' | 'signing-in' | 'working' | 'reviewing' | 'broken'

export function App() {
  const [stage, setStage] = useState<Stage>('opening')
  const [lockNote, setLockNote] = useState('')
  const [lockReason, setLockReason] = useState('')
  const [session, setSession] = useState<SignedIn | null>(null)
  const [waiting, setWaiting] = useState(0)

  const refreshWaiting = () => { void countWaiting().then(setWaiting) }

  const afterUnlock = async () => {
    setSession(await currentSession())
    refreshWaiting()
    setStage(await currentSession() ? 'working' : 'signing-in')
  }

  useEffect(() => {
    void (async () => {
      try {
        setLockNote(await describeLock())
        // The website has no locked database to open -- it is the online tool
        // for office roles, by design -- so it goes straight to signing in.
        if (canWorkOffline()) await openEncryptedDatabase()
        await afterUnlock()
      } catch (error) {
        if (error instanceof LockedOutError) { setLockReason(error.message); setStage('locked'); return }
        setLockNote(error instanceof Error ? error.message : String(error))
        setStage('broken')
      }
    })()
  }, [])

  const bar = (
    <header style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: tokens.space.md, background: tokens.color.primary, color: tokens.color.onPrimary,
    }}>
      <strong style={{ fontSize: tokens.text.title.size }}>অভিযাত্রা · Obhijatra</strong>
      {session && (
        <button onClick={() => { void signOut().then(() => setStage('signing-in')) }} style={{
          minHeight: tokens.space.minTapTarget, background: 'transparent',
          color: tokens.color.onPrimary, border: `1px solid ${tokens.color.onPrimary}`,
          borderRadius: tokens.radius.full, padding: `0 ${tokens.space.md}px`,
        }}>Sign out</button>
      )}
    </header>
  )

  return (
    <main style={{
      background: tokens.color.surface, color: tokens.color.onSurface,
      fontSize: tokens.text.body.size, minHeight: '100vh',
    }}>
      {bar}

      {stage === 'opening' && <p style={{ padding: tokens.space.lg }}>{both('unlocking')}</p>}

      {stage === 'locked' && (
        <UnlockScreen reason={lockReason} onUnlocked={() => { void afterUnlock() }} />
      )}

      {stage === 'signing-in' && (
        <SignInScreen onSignedIn={() => { void afterUnlock() }} />
      )}

      {stage === 'working' && session && (
        <>
          <SyncStatus waiting={waiting} onChanged={refreshWaiting} />
          <FormScreen
            form={helloForm}
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

      {stage === 'broken' && (
        <p style={{ padding: tokens.space.lg, color: tokens.color.error }}>{lockNote}</p>
      )}

      <p style={{ padding: tokens.space.lg, fontSize: tokens.text.label.size, color: tokens.color.outline }}>
        {lockNote}
      </p>
    </main>
  )
}
