// WHAT THIS FILE IS FOR
//   The single list of colours, sizes and spacings the whole app uses.
//   Google's own web version of Material Design has been unmaintained since
//   June 2024, so we write the values down ourselves. Nobody can discontinue
//   a file that lives in our own project.
// WHAT IT GIVES : `tokens`, read by every screen. Never write a colour anywhere else.

export const tokens = {
  color: {
    primary:   '#1F6E43',  // Obhijatra green
    onPrimary: '#FFFFFF',
    surface:   '#FDFCF7',
    onSurface: '#1A1C19',
    error:     '#B3261E',
    onError:   '#FFFFFF',
    outline:   '#71796F',
  },
  space:  { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, minTapTarget: 48 },
  text:   { body: { size: 16, weight: 400 }, title: { size: 22, weight: 500 }, label: { size: 14, weight: 500 } },
  radius: { sm: 8, md: 12, lg: 16, full: 999 },
} as const

/** Relative luminance of an #rrggbb colour, per WCAG 2.2. */
function luminance(hex: string): number {
  const channel = (i: number) => {
    const v = parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16) / 255
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)
  }
  return 0.2126 * channel(0) + 0.7152 * channel(1) + 0.0722 * channel(2)
}

/** How readable one colour is on another. WCAG AA wants 4.5 or more for body text. */
export function contrastRatio(foreground: string, background: string): number {
  const [lighter, darker] = [luminance(foreground), luminance(background)].sort((a, b) => b - a) as [number, number]
  return (lighter + 0.05) / (darker + 0.05)
}
