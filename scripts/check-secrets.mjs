// WHAT THIS FILE IS FOR
//   Stops a password, key or token from ever being saved into the project.
//   Once a secret is published it is public forever, so this refuses the save
//   rather than trusting anyone to remember.
// WHAT IT NEEDS : the text of a file, and the file's path.
// WHAT IT GIVES : a list of plain-English reasons not to save it. Empty = safe.

const RULES = [
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----/,                                    'a private key'],
  [/ghp_[A-Za-z0-9]{36}/,                                                   'a GitHub personal access token'],
  [/gho_[A-Za-z0-9]{36}/,                                                   'a GitHub OAuth token'],
  [/eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/,         'a signed token (JWT), such as a Supabase service role key'],
  [/AKIA[0-9A-Z]{16}/,                                                      'an AWS access key'],
  [/sk-[A-Za-z0-9]{32,}/,                                                   'an API secret key'],
  [/cfut_[A-Za-z0-9]{20,}/,                                                 'a Cloudflare API token'],
  [/postgres(ql)?:\/\/[^:/\s]+:[^@\s]+@/,                                   'a database address with the password inside it'],
  [/(password|passwd|secret|api[_-]?key)\s*[:=]\s*['"][^'"\s]{8,}['"]/i,    'a hard-coded password or key'],
]

// Text that only LOOKS like a secret: examples, placeholders, and the way a
// workflow legitimately refers to a stored secret by name.
const NOT_A_SECRET = [
  /your-[a-z-]+-here/i,
  /REPLACE_ME/,
  /xxxxxxxx/i,
  /<[a-z-]+>/i,
  /\$\{\{\s*secrets\./,
]

export function scanForSecrets(text) {
  if (NOT_A_SECRET.some(p => p.test(text))) return []
  return RULES.filter(([pattern]) => pattern.test(text)).map(([, reason]) => reason)
}

// A file may declare that its credential-shaped text is deliberate, by carrying
// the marker below. Every exemption is then greppable — `grep -rn "secrets-scan:
// contains-examples"` lists all of them — rather than being an invisible rule
// buried in this file. A file claiming it must say why, in a comment beside it.
const DECLARES_EXAMPLES = /secrets-scan:\s*contains-examples/

// Two kinds of file legitimately contain text that LOOKS like a secret:
// documentation explaining what a secret looks like, and the test fixtures
// that prove this very scanner works. Scanning them blocks every commit
// forever. Nothing under src/ and no config file is ever skipped, because
// that is where a real secret actually gets pasted by mistake.
const NEVER_SCAN = [
  /^docs\//,
  /^tests\/fixtures\//,
  /^tests\/unit\/check-secrets\.test\.ts$/,
  /\.example$/,
  /^package-lock\.json$/,
]

/** Whether a file should be checked at all, by its path. */
export function shouldScan(path) {
  return !NEVER_SCAN.some(pattern => pattern.test(path))
}

/** Whether a file has explicitly declared that its secret-shaped text is example data. */
export function declaresExamples(text) {
  return DECLARES_EXAMPLES.test(text)
}
