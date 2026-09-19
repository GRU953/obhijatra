// WHAT THIS FILE IS FOR
//   Tells the person in one plain sentence what is happening to their work.
//   Never a spinning circle with no explanation: someone who has walked an hour
//   to collect ten forms needs to know those forms are safe.
import { useState } from 'react'
import { tokens } from './tokens'
import { both, text } from './text'
import { drainQueue } from '../data/sync/uploadQueue'

export function SyncStatus({ waiting, onChanged }: { waiting: number; onChanged: () => void }) {
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState('')

  const send = async () => {
    setBusy(true); setNote(both('sending'))
    const result = await drainQueue()
    setNote(result.stillWaiting === 0 ? both('allSent')
          : result.sent > 0 ? `${result.stillWaiting} ${text.waitingToSend.en}`
          : both('noConnection'))
    setBusy(false); onChanged()
  }

  return (
    <section style={{
      padding: tokens.space.md, margin: tokens.space.lg,
      borderRadius: tokens.radius.md, border: `1px solid ${tokens.color.outline}`,
    }}>
      <p style={{ margin: 0 }}>
        {waiting === 0 ? both('allSent') : `${waiting} ${text.waitingToSend.bn} · ${waiting} ${text.waitingToSend.en}`}
      </p>
      {note && <p style={{ fontSize: tokens.text.label.size, color: tokens.color.outline }}>{note}</p>}
      <button onClick={() => { void send() }} disabled={busy || waiting === 0} style={{
        minHeight: tokens.space.minTapTarget, width: '100%', marginTop: tokens.space.sm,
        fontSize: tokens.text.body.size, borderRadius: tokens.radius.full,
        border: `1px solid ${tokens.color.primary}`, background: tokens.color.surface,
        color: tokens.color.primary, opacity: busy || waiting === 0 ? 0.5 : 1,
      }}>{both('sendNow')}</button>
    </section>
  )
}
