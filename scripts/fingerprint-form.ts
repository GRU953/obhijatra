// WHAT THIS FILE IS FOR
//   Works out the short code for a form file, using exactly the same function
//   the phone uses. That is the point: if publishing and the phone worked it out
//   differently, every download would be refused and nobody would know why.
//
// USE: npx tsx scripts/fingerprint-form.ts forms/household.json
import { readFileSync } from 'node:fs'
import { fingerprintOf } from '../src/forms/fingerprint'

const path = process.argv[2]
if (!path) {
  console.error('Give it a form file, for example: forms/household.json')
  process.exit(1)
}

const definition = JSON.parse(readFileSync(path, 'utf8')) as { formId?: string }
const fingerprint = await fingerprintOf(definition)

// Printed as name=value lines so an automatic action can read them directly.
console.log(`formId=${definition.formId}`)
console.log(`fingerprint=${fingerprint}`)
