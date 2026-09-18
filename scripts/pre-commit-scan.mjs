// Reads every file about to be committed and refuses if any carries a secret.
// Runs automatically before each commit, and again in the cloud on every push,
// so a mistake cannot slip through by someone skipping the local check.
import { execSync } from 'node:child_process'
import { readFileSync, existsSync } from 'node:fs'
import { scanForSecrets, shouldScan, declaresExamples } from './check-secrets.mjs'

const files = process.argv[2] === '--all'
  ? execSync('git ls-files', { encoding: 'utf8' }).split('\n').filter(Boolean)
  : execSync('git diff --cached --name-only --diff-filter=ACM', { encoding: 'utf8' }).split('\n').filter(Boolean)

let blocked = false
for (const file of files) {
  if (!existsSync(file) || !shouldScan(file)) continue
  const text = readFileSync(file, 'utf8')
  if (declaresExamples(text)) { console.log(`(skipping ${file}: declares it contains examples)`); continue }
  const reasons = scanForSecrets(text)
  if (reasons.length) {
    blocked = true
    console.error(`\nREFUSED: ${file} appears to contain ${reasons.join(', ')}.`)
    console.error('Put it in a GitHub repository secret instead, and refer to it by name.')
  }
}
if (!blocked) console.log(`No secrets found in ${files.length} file(s).`)
process.exit(blocked ? 1 : 0)
