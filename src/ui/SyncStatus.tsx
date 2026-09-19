// WHAT THIS FILE IS FOR
//   Tells the worker in one plain sentence what is happening to their work, and
//   lets them send it now rather than waiting.
//
//   Never a spinning circle with no words. Someone who has walked an hour to
//   collect ten forms needs to know those forms are safe, and a button that
//   appears to do nothing is the failure this project has already shipped once.
import { useState } from 'react'
import { tokens } from './tokens'
import { both } from './text'
import { drainQueue } from '../data/sync/uploadQueue'
import { downloadEditions } from '../data/sync/formDownload'
import { runSyncRound } from '../data/sync/syncRound'
import { serverEditions } from '../data/remote/editions'
import { localEditions } from '../data/local/formStore'

export function SyncStatus({ waiting, onChanged }: { waiting: number; onChanged: () => void }) {
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [refusals, setRefusals] = useState<string[]>([])

  const sync = async () => {
    setBusy(true); setMessage(both('sending')); setRefusals([])
    // Work goes UP first. Getting a worker's day off the phone is the higher
    // duty, so a slow or hanging forms download can never stand in front of it.
    const round = await runSyncRound({
      upload: () => drainQueue(),
      download: () => downloadEditions(serverEditions, localEditions),
    })
    setMessage(round.message)
    setRefusals(round.download.refused)
    setBusy(false)
    onChanged()
  }

  return (
    <section style={{
      padding: tokens.space.md, margin: tokens.space.lg,
      borderRadius: tokens.radius.md, border: `1px solid ${tokens.color.outline}`,
    }}>
      <p style={{ margin: 0 }}>
        {waiting === 0 ? both('allSent') : `${waiting} ${'টি ফর্ম পাঠানোর অপেক্ষায় · form(s) waiting to send'}`}
      </p>
      {message && <p style={{ fontSize: tokens.text.label.size, color: tokens.color.outline }}>{message}</p>}
      {refusals.map((r, i) => (
        <p key={i} style={{ fontSize: tokens.text.label.size, color: tokens.color.error }}>{r}</p>
      ))}
      <button onClick={() => { void sync() }} disabled={busy} style={{
        minHeight: tokens.space.minTapTarget, width: '100%', marginTop: tokens.space.sm,
        fontSize: tokens.text.body.size, borderRadius: tokens.radius.full,
        border: `1px solid ${tokens.color.primary}`, background: tokens.color.surface,
        color: tokens.color.primary, opacity: busy ? 0.5 : 1,
      }}>{busy ? '…' : both('sendNow')}</button>
    </section>
  )
}
