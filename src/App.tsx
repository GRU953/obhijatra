// WHAT THIS FILE IS FOR
//   Decides which screen to show. In this first version there is one screen,
//   whose job is to prove the foundations work: it opens the locked database,
//   which makes the phone ask for a fingerprint, and then says plainly whether
//   the lock is real.
import { useEffect, useState } from 'react'
import { tokens } from './ui/tokens'
import { openEncryptedDatabase, describeLock } from './data/local/database'

export function App() {
  const [status, setStatus] = useState('Opening the locked database…')
  const [detail, setDetail] = useState('')
  const [ok, setOk] = useState<boolean | null>(null)

  useEffect(() => {
    void (async () => {
      try {
        setDetail(await describeLock())
        const database = await openEncryptedDatabase()
        await database.execute('CREATE TABLE IF NOT EXISTS proof (id INTEGER PRIMARY KEY, note TEXT);')
        await database.run('INSERT INTO proof (note) VALUES (?)', ['the lock opened'])
        const rows = await database.query('SELECT count(*) AS n FROM proof')
        setStatus(`Locked database opened. ${rows.values?.[0]?.['n'] ?? 0} record(s) inside.`)
        setOk(true)
      } catch (error) {
        setStatus(`Could not open it: ${error instanceof Error ? error.message : String(error)}`)
        setOk(false)
      }
    })()
  }, [])

  return (
    <main style={{
      background: tokens.color.surface, color: tokens.color.onSurface,
      fontSize: tokens.text.body.size, padding: tokens.space.lg, minHeight: '100vh',
    }}>
      <h1 style={{ fontSize: tokens.text.title.size, fontWeight: tokens.text.title.weight }}>
        অভিযাত্রা · Obhijatra
      </h1>
      <p style={{ color: ok === false ? tokens.color.error : tokens.color.onSurface }}>{status}</p>
      <p style={{ fontSize: tokens.text.label.size, color: tokens.color.outline }}>{detail}</p>
    </main>
  )
}
