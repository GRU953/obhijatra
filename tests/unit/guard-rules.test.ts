// Proves the three rules that make the app's one real weakness impossible to
// introduce by accident: a form label written by an administrator must never
// be able to run as code, because the browser view holds the database key.
import { describe, it, expect } from 'vitest'
import { ESLint } from 'eslint'

const ruleIdsFor = async (code: string, filePath = 'src/probe.tsx') => {
  const results = await new ESLint().lintText(code, { filePath })
  return results[0]!.messages.map(m => m.ruleId)
}

describe('the three guard rules', () => {
  it('refuses dangerouslySetInnerHTML', async () => {
    expect(await ruleIdsFor('export const X = () => <div dangerouslySetInnerHTML={{__html: "x"}} />'))
      .toContain('no-restricted-syntax')
  })
  it('refuses eval', async () => {
    expect(await ruleIdsFor('export const run = (rule: string) => eval(rule)')).toContain('no-eval')
  })
  it('refuses new Function', async () => {
    expect(await ruleIdsFor('export const run = (r: string) => new Function(r)')).toContain('no-new-func')
  })
  it('refuses innerHTML', async () => {
    expect(await ruleIdsFor('export const set = (el: HTMLElement, s: string) => { el.innerHTML = s }'))
      .toContain('no-restricted-properties')
  })
  it('allows ordinary text rendering', async () => {
    expect(await ruleIdsFor('export const X = ({ label }: { label: string }) => <div>{label}</div>')).toEqual([])
  })
})
