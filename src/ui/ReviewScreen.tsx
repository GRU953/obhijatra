// WHAT THIS FILE IS FOR
//   Shows what actually reached the server, so a worker can see their work
//   arrived rather than being asked to trust it.
//
// SAFETY
//   Everything here is put on screen as TEXT, never as markup, because these
//   values were typed by people. A test exists that fills a form with something
//   that looks like code and checks it appears as plain visible characters.
import { useEffect, useState } from 'react'
import { tokens } from './tokens'
import { both } from './text'
import { getSupabase } from '../data/remote/supabase'

type Row = { id: string; collected_at: string; answers: Record<string, unknown> }

export function ReviewScreen({ onBack }: { onBack: () => void }) {
  const [rows, setRows] = useState<Row[] | null>(null)
  const [problem, setProblem] = useState('')

  useEffect(() => {
    void (async () => {
      const { data, error } = await getSupabase()
        .from('submissions').select('id, collected_at, answers')
        .order('server_seq', { ascending: false }).limit(50)
      if (error) { setProblem(error.message); return }
      setRows((data ?? []) as Row[])
    })()
  }, [])

  return (
    <section style={{ padding: tokens.space.lg }}>
      <button onClick={onBack} style={{
        minHeight: tokens.space.minTapTarget, fontSize: tokens.text.body.size,
        borderRadius: tokens.radius.full, border: `1px solid ${tokens.color.outline}`,
        background: tokens.color.surface, color: tokens.color.onSurface,
        padding: `0 ${tokens.space.md}px`, marginBottom: tokens.space.md,
      }}>{both('back')}</button>

      {problem && <p style={{ color: tokens.color.error }}>{problem}</p>}
      {rows === null && <p>…</p>}
      {rows?.length === 0 && <p>{both('nothingYet')}</p>}

      {rows?.map((row) => (
        <article key={row.id} style={{
          padding: tokens.space.md, marginBottom: tokens.space.sm,
          borderRadius: tokens.radius.md, border: `1px solid ${tokens.color.outline}`,
        }}>
          {Object.entries(row.answers).map(([field, value]) => (
            <div key={field}>
              <strong>{field}: </strong>{String(value)}
            </div>
          ))}
          <div style={{ fontSize: tokens.text.label.size, color: tokens.color.outline }}>
            {new Date(row.collected_at).toLocaleString('en-GB')}
          </div>
        </article>
      ))}
    </section>
  )
}
