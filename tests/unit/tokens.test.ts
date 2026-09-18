// Proves the app's colours and sizes are readable and reachable before any
// screen is built on them. A failing test here means the design is wrong,
// not the test.
import { describe, it, expect } from 'vitest'
import { tokens, contrastRatio } from '../../src/ui/tokens'

describe('design tokens', () => {
  it('body text on the background meets WCAG AA (4.5:1)', () => {
    expect(contrastRatio(tokens.color.onSurface, tokens.color.surface)).toBeGreaterThanOrEqual(4.5)
  })
  it('primary button text meets WCAG AA against the primary colour', () => {
    expect(contrastRatio(tokens.color.onPrimary, tokens.color.primary)).toBeGreaterThanOrEqual(4.5)
  })
  it('error text meets WCAG AA, because that is when reading matters most', () => {
    expect(contrastRatio(tokens.color.onError, tokens.color.error)).toBeGreaterThanOrEqual(4.5)
  })
  it('the smallest tap target is at least 48dp, per Android guidance', () => {
    expect(tokens.space.minTapTarget).toBeGreaterThanOrEqual(48)
  })
  it('body text is at least 16px, which is legible on a cheap phone in sunlight', () => {
    expect(tokens.text.body.size).toBeGreaterThanOrEqual(16)
  })
})
