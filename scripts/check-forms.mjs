// WHAT THIS FILE IS FOR
//   Checks every form in the forms/ folder, on every save.
//
//   This is what replaces the builder screen for now. The author gets exactly
//   the same refusals, in exactly the same plain words, at exactly the same
//   moment -- with no screen to build, and nothing extra that can break.
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const { validateFormDefinition } = await import('../dist-check/validate.js')
  .catch(() => import('../src/forms/validate.ts'))

const folder = 'forms'
const files = readdirSync(folder).filter((f) => f.endsWith('.json'))

let bad = 0
for (const file of files) {
  let definition
  try {
    definition = JSON.parse(readFileSync(join(folder, file), 'utf8'))
  } catch (error) {
    console.error(`\n${file} is not readable: ${error.message}`)
    bad++
    continue
  }
  const { problems } = validateFormDefinition(definition)
  if (problems.length === 0) {
    console.log(`OK       ${file}  (${definition.questions?.length ?? 0} questions, edition ${definition.edition})`)
  } else {
    bad++
    console.error(`\nREFUSED  ${file}`)
    for (const problem of problems) console.error(`         - ${problem}`)
  }
}

if (files.length === 0) console.log('No forms to check yet.')
if (bad > 0) {
  console.error(`\n${bad} form(s) refused. Fix them and save again.`)
  process.exit(1)
}
console.log(`\nAll ${files.length} form(s) are sound.`)
