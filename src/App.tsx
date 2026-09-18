// WHAT THIS FILE IS FOR
//   Decides which screen to show. In this first version there is only one, so
//   it shows that the foundations are working: the design values load, the
//   colours are readable, and the app runs in a browser and on a phone.
import { tokens } from './ui/tokens'

export function App() {
  return (
    <main
      style={{
        background: tokens.color.surface,
        color: tokens.color.onSurface,
        fontSize: tokens.text.body.size,
        padding: tokens.space.lg,
        minHeight: '100vh',
      }}
    >
      <h1 style={{ fontSize: tokens.text.title.size, fontWeight: tokens.text.title.weight }}>
        অভিযাত্রা · Obhijatra
      </h1>
      <p>ভিত্তি প্রস্তুত। Foundations ready.</p>
    </main>
  )
}
