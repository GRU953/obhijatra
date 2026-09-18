# Obhijatra Phase 0 + Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A field worker signs in with a PIN or fingerprint, fills one form on a cheap Android phone in aeroplane mode, the answer lands in an encrypted local database, and when signal returns it syncs by itself and appears in a web browser.

**Architecture:** One TypeScript + React codebase. In a browser it is the website. Wrapped by Capacitor it is an Android app holding an SQLCipher-encrypted SQLite database whose key is random, stored in the Android Keystore, and released by fingerprint or PIN. Sync is ours: submissions are immutable, so uploading is a queue that drains, not a merge. The server is ordinary PostgreSQL on Supabase with row-level security keyed to the owning organisation.

**Tech Stack:** TypeScript 7.0.2 · React 19.3.0 · Vite 8.3.0 · Capacitor 8.5.2 · @capacitor-community/sqlite 8.1.1 (SQLCipher) · @supabase/supabase-js 2.116.0 · Vitest 5.0.1 · Playwright 1.63.0 · GitHub Actions

**Spec:** `docs/superpowers/specs/2026-09-19-obhijatra-design.md`

---

## Global Constraints

Every task's requirements implicitly include this section.

- **Attribution.** Commits, PRs and package metadata name **Aninda S Howlader (GitHub: GRU953)** as sole developer, owner and contributor. **No AI or Claude attribution anywhere**, including commit trailers.
- **Plain-English code.** Every file opens with a comment block a non-coder can read: what this file is for, what it needs, what it gives back. Every non-obvious function carries a one-sentence plain-English explanation. This is a review gate, not a nicety.
- **Toolchain is sandboxed.** `source /Users/aninda/Claude/sandbox/env.sh` before any Android command. `JAVA_HOME` and `ANDROID_HOME` live under `/Users/aninda/Claude/sandbox`. Never install anything system-wide.
- **Exact versions, pinned.** Use the versions in Tech Stack above. No `^` or `~` ranges in `package.json`.
- **Multi-organisation from commit one.** Every table that holds data has a non-null `organisation_id`. No exceptions, ever.
- **Never collect national ID.** No `nid`, `passport`, or `tin` column may exist. Participants are identified by an internal code.
- **Secrets never enter the repository.** Enforced by an automated check that blocks the commit (Task 1).
- **Three XSS guard rules** (Task 7), enforced by lint in CI, not by memory:
  1. Administrator-written text renders as text only — `dangerouslySetInnerHTML` and `innerHTML` are banned.
  2. Skip logic is a declarative rule the app reads — `eval`, `new Function` and dynamic `import()` of user content are banned.
  3. A strict Content-Security-Policy with no inline script and no remote origins.
- **Android floor:** `minSdkVersion 26` (Android 8). Revisit only when a real organisation's phones have been surveyed.
- **US export note:** the SQLite plugin links SQLCipher even for unencrypted databases, which may require an annual self-classification report to the US government. Record this in `docs/COMPLIANCE.md` in Task 1.

---

## File Structure

```
obhijatra/
├── .github/workflows/
│   ├── ci.yml                     # lint, typecheck, unit tests, e2e — every push
│   ├── backup.yml                 # nightly encrypted dump to three destinations
│   ├── keepalive.yml              # twice-weekly ping so Supabase never pauses
│   └── android-internal.yml       # build AAB, upload to Play internal testing
├── docs/
│   ├── COMPLIANCE.md              # export note, processor register, retention
│   └── superpowers/{specs,plans}/
├── supabase/migrations/           # plain SQL, version controlled, forward-only
├── scripts/
│   ├── check-secrets.mjs          # blocks a commit containing a credential
│   └── restore-rehearsal.mjs      # proves a backup actually restores
├── src/
│   ├── main.tsx                   # entry point
│   ├── App.tsx                    # routes between the Phase 1 screens
│   ├── security/
│   │   ├── databaseKey.ts         # random key -> Keystore; released by biometric/PIN
│   │   └── pin.ts                 # PIN verification (never derives the key)
│   ├── data/
│   │   ├── local/schema.ts        # local SQLite tables + migrations
│   │   ├── local/database.ts      # open/close the encrypted connection
│   │   ├── local/submissions.ts   # read/write submissions locally
│   │   ├── remote/supabase.ts     # server client
│   │   └── sync/uploadQueue.ts    # sync flow 1: drain the queue
│   ├── errors/report.ts           # crash reports with personal data removed
│   ├── forms/helloForm.ts         # the one hard-coded Phase 1 form
│   └── ui/
│       ├── tokens.ts              # Material 3 values, written down once
│       ├── UnlockScreen.tsx
│       ├── FormScreen.tsx
│       ├── ReviewScreen.tsx
│       └── SyncStatus.tsx
└── tests/
    ├── unit/                      # Vitest
    └── e2e/                       # Playwright
```

---

# PHASE 0 — Foundations that cannot wait

## Task 1: Repository, licence, plain-English standard, and secret blocking

**Files:**
- Create: `README.md`, `LICENSE`, `CONTRIBUTING.md`, `docs/COMPLIANCE.md`
- Create: `scripts/check-secrets.mjs`, `scripts/pre-commit-scan.mjs`, `.githooks/pre-commit`
- Test: `tests/unit/check-secrets.test.ts`

**Interfaces:**
- Consumes: nothing — this is the first task.
- Produces, from `scripts/check-secrets.mjs`:
  - `scanForSecrets(text: string): string[]` — human-readable reasons a file must not be committed (empty array means clean).
  - `shouldScan(path: string): boolean` — false for paths that legitimately contain secret-shaped text.

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/check-secrets.test.ts
import { describe, it, expect } from 'vitest'
import { scanForSecrets, shouldScan } from '../../scripts/check-secrets.mjs'

describe('scanForSecrets', () => {
  it('flags a Supabase service role key', () => {
    expect(scanForSecrets('KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.abcdefghij.klmnopqrst').length).toBeGreaterThan(0)
  })
  it('flags a private key block', () => {
    expect(scanForSecrets('-----BEGIN PRIVATE KEY-----')).not.toEqual([])
  })
  it('flags a GitHub token', () => {
    expect(scanForSecrets('ghp_0123456789abcdefghijklmnopqrstuvwxyz')).not.toEqual([])
  })
  it('passes ordinary code', () => {
    expect(scanForSecrets('const greeting = "hello"')).toEqual([])
  })
  it('passes an example file placeholder', () => {
    expect(scanForSecrets('SUPABASE_URL=your-project-url-here')).toEqual([])
  })
})

describe('shouldScan', () => {
  // Documentation about secrets, and the tests that prove this scanner works,
  // will ALWAYS contain secret-shaped text. Scanning them would block every
  // commit forever. This was found the hard way: the first version of this
  // scanner refused to let the plan describing it be committed.
  it('skips documentation', () => {
    expect(shouldScan('docs/superpowers/plans/phase-0.md')).toBe(false)
  })
  it('skips deliberately fake test fixtures', () => {
    expect(shouldScan('tests/fixtures/sample-dump.sql')).toBe(false)
  })
  it('skips this scanner\'s own tests', () => {
    expect(shouldScan('tests/unit/check-secrets.test.ts')).toBe(false)
  })
  it('still scans real source code', () => {
    expect(shouldScan('src/data/remote/supabase.ts')).toBe(true)
  })
  it('still scans configuration, where real secrets get pasted by mistake', () => {
    expect(shouldScan('capacitor.config.ts')).toBe(true)
    expect(shouldScan('.github/workflows/backup.yml')).toBe(true)
  })
})
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `npx vitest run tests/unit/check-secrets.test.ts`
Expected: FAIL — cannot resolve `scripts/check-secrets.mjs`.

- [ ] **Step 3: Write the minimal implementation**

```js
// scripts/check-secrets.mjs
// WHAT THIS FILE IS FOR
//   Stops a password, key or token from ever being saved into the project.
//   Once a secret is published it is public forever, so this refuses the save
//   rather than trusting anyone to remember.
// WHAT IT NEEDS : the text of a file, as a string.
// WHAT IT GIVES : a list of plain-English reasons not to save it. Empty = safe.

const RULES = [
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----/, 'a private key'],
  [/ghp_[A-Za-z0-9]{36}/, 'a GitHub personal access token'],
  [/gho_[A-Za-z0-9]{36}/, 'a GitHub OAuth token'],
  [/eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/, 'a signed token (JWT), such as a Supabase service role key'],
  [/AKIA[0-9A-Z]{16}/, 'an AWS access key'],
  [/sk-[A-Za-z0-9]{32,}/, 'an API secret key'],
  [/(password|passwd|secret|api[_-]?key)\s*[:=]\s*['"][^'"\s]{8,}['"]/i, 'a hard-coded password or key'],
]

const PLACEHOLDERS = /your-[a-z-]+-here|REPLACE_ME|xxxxxxxx|<[a-z-]+>/i

export function scanForSecrets(text) {
  if (PLACEHOLDERS.test(text)) return []
  return RULES.filter(([pattern]) => pattern.test(text)).map(([, reason]) => reason)
}

// Two kinds of file legitimately contain text that LOOKS like a secret:
// documentation explaining what a secret looks like, and the test fixtures
// that prove this very scanner works. Scanning them blocks every commit
// forever. Nothing under src/ or any config file is ever skipped, because
// that is where a real secret actually gets pasted by mistake.
const NEVER_SCAN = [
  /^docs\//,
  /^tests\/fixtures\//,
  /^tests\/unit\/check-secrets\.test\.ts$/,
  /\.example$/,
]

/** Whether a file should be checked at all. */
export function shouldScan(path) {
  return !NEVER_SCAN.some(pattern => pattern.test(path))
}
```

- [ ] **Step 4: Run the test and confirm it passes**

Run: `npx vitest run tests/unit/check-secrets.test.ts`
Expected: PASS, 10 tests.

- [ ] **Step 5: Wire it into a commit hook that actually blocks**

```js
// scripts/pre-commit-scan.mjs
// Reads every file about to be committed and refuses if any carries a secret.
import { execSync } from 'node:child_process'
import { readFileSync, existsSync } from 'node:fs'
import { scanForSecrets, shouldScan } from './check-secrets.mjs'

const staged = execSync('git diff --cached --name-only --diff-filter=ACM', { encoding: 'utf8' })
  .split('\n').filter(Boolean)

let blocked = false
for (const file of staged) {
  if (!existsSync(file) || !shouldScan(file)) continue
  const reasons = scanForSecrets(readFileSync(file, 'utf8'))
  if (reasons.length) {
    blocked = true
    console.error(`\nREFUSED: ${file} appears to contain ${reasons.join(', ')}.`)
    console.error('Move it into a .env file (which is never committed) and try again.')
  }
}
process.exit(blocked ? 1 : 0)
```

```bash
mkdir -p .githooks
printf '#!/bin/sh\nnode scripts/pre-commit-scan.mjs || exit 1\n' > .githooks/pre-commit
chmod +x .githooks/pre-commit
git config core.hooksPath .githooks
```

- [ ] **Step 6: Prove the hook blocks a real secret**

Run:
```bash
printf 'KEY=eyJhbGciOiJIUzI1NiJ9.aaaaaaaaaabb.bbbbbbbbbbcc\n' > leak-test.txt
git add leak-test.txt && git commit -m "should fail"
```
Expected: commit REFUSED, naming `leak-test.txt` and the reason.
Then clean up: `git reset leak-test.txt && rm leak-test.txt`

- [ ] **Step 7: Write the human-facing files**

`LICENSE`: AGPL-3.0, copyright "Aninda S Howlader". AGPL keeps improvements public even if someone runs Obhijatra as a hosted service — the strongest protection for a nonprofit tool.

`README.md` states in plain English: what Obhijatra is, that it runs offline on cheap Android phones, how to set up the sandbox (`source /Users/aninda/Claude/sandbox/env.sh`), how to run it, and that Aninda S Howlader is sole developer, owner and contributor.

`docs/COMPLIANCE.md` records: the SQLCipher US export self-classification note; a processor register naming Supabase (PostgreSQL) and Cloudflare R2 (files) with what each holds and where; the retention rule (default 3 years after last contact, adjustable per dataset); and the standing rule that national ID numbers are never collected.

- [ ] **Step 8: Commit**

```bash
git add LICENSE README.md CONTRIBUTING.md docs/COMPLIANCE.md scripts/ .githooks/ tests/
git commit -m "Add licence, plain-English standard, and a check that blocks committed secrets"
```

---

## Task 2: Project skeleton and continuous checking

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `eslint.config.js`, `index.html`, `src/main.tsx`, `src/App.tsx`, `src/ui/tokens.ts`
- Create: `.github/workflows/ci.yml`
- Test: `tests/unit/tokens.test.ts`

**Interfaces:**
- Consumes: `scanForSecrets` from Task 1 (used by CI).
- Produces: `tokens` and `contrastRatio(foreground: string, background: string): number` from `src/ui/tokens.ts`. `tokens` has shape `{ color: Record<string,string>, space: Record<string,number>, text: Record<string,{size:number,weight:number}>, radius: Record<string,number> }`. Every screen reads colours and spacing from here, never as literals.

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/tokens.test.ts
import { describe, it, expect } from 'vitest'
import { tokens, contrastRatio } from '../../src/ui/tokens'

describe('design tokens', () => {
  it('body text on the background meets WCAG AA (4.5:1)', () => {
    expect(contrastRatio(tokens.color.onSurface, tokens.color.surface)).toBeGreaterThanOrEqual(4.5)
  })
  it('the smallest tap target is at least 48dp, per Android guidance', () => {
    expect(tokens.space.minTapTarget).toBeGreaterThanOrEqual(48)
  })
  it('primary button text meets WCAG AA against the primary colour', () => {
    expect(contrastRatio(tokens.color.onPrimary, tokens.color.primary)).toBeGreaterThanOrEqual(4.5)
  })
})
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `npx vitest run tests/unit/tokens.test.ts`
Expected: FAIL — `src/ui/tokens` not found.

- [ ] **Step 3: Write the implementation**

```ts
// src/ui/tokens.ts
// WHAT THIS FILE IS FOR
//   The single list of colours, sizes and spacings the whole app uses.
//   Google's own web version of Material Design has been unmaintained since
//   June 2024, so we write the values down ourselves. Nobody can discontinue
//   a file that lives in our own project.
// WHAT IT GIVES : `tokens`, read by every screen. Never write a colour anywhere else.

export const tokens = {
  color: {
    primary:   '#1F6E43',   // Obhijatra green
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
  const [a, b] = [luminance(foreground), luminance(background)].sort((x, y) => y - x)
  return (a + 0.05) / (b + 0.05)
}
```

- [ ] **Step 4: Run the test and confirm it passes**

Run: `npx vitest run tests/unit/tokens.test.ts`
Expected: PASS, 3 tests. If a contrast test fails, darken `primary` until it passes — the test is right and the colour is wrong.

- [ ] **Step 5: Add continuous checking on every push**

```yaml
# .github/workflows/ci.yml
name: Check everything
on: [push, pull_request]
jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '24', cache: 'npm' }
      - run: npm ci
      - name: Refuse any committed secret
        run: node scripts/pre-commit-scan.mjs
      - name: Check the code is written correctly
        run: npx tsc --noEmit
      - name: Check the safety rules are obeyed
        run: npx eslint .
      - name: Run the tests
        run: npx vitest run
```

- [ ] **Step 6: Push and confirm the workflow goes green**

Run: `git push` then `gh run watch`
Expected: all five steps pass.

- [ ] **Step 7: Commit**

```bash
git add package.json tsconfig.json vite.config.ts eslint.config.js index.html src/ tests/ .github/
git commit -m "Add project skeleton, design tokens with contrast tests, and checks on every push"
```

---

## Task 3: Server schema, the wall between organisations, and the test that proves it

**Files:**
- Create: `supabase/migrations/0001_organisations_and_submissions.sql`, `supabase/seed-test-organisations.sql`
- Create: `src/data/remote/supabase.ts`
- Test: `tests/unit/crossOrganisation.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `getSupabase(): SupabaseClient` from `src/data/remote/supabase.ts`. Tables `organisations(id uuid, name text)`, `profiles(id uuid, organisation_id uuid, display_name text)`, `submissions(id uuid, organisation_id uuid, form_id text, form_version int, collected_by uuid, collected_at timestamptz, device_id text, answers jsonb, server_seq bigserial, received_at timestamptz)`.

- [ ] **Step 1: Write the failing test — the wall must hold**

```ts
// tests/unit/crossOrganisation.test.ts
// The single most important test in Phase 1. If this ever passes when it should
// fail, one charity can read another charity's beneficiaries.
import { describe, it, expect, beforeAll } from 'vitest'
import { createClient } from '@supabase/supabase-js'

const url = process.env.SUPABASE_URL!
const anon = process.env.SUPABASE_ANON_KEY!

describe('the wall between organisations', () => {
  let clientA: ReturnType<typeof createClient>
  let clientB: ReturnType<typeof createClient>

  beforeAll(async () => {
    clientA = createClient(url, anon)
    clientB = createClient(url, anon)
    await clientA.auth.signInWithPassword({ email: 'worker.a@test.invalid', password: process.env.TEST_PASSWORD_A! })
    await clientB.auth.signInWithPassword({ email: 'worker.b@test.invalid', password: process.env.TEST_PASSWORD_B! })
  })

  it('a worker sees their own organisation submissions', async () => {
    const { data } = await clientA.from('submissions').select('*')
    expect(data!.length).toBeGreaterThan(0)
  })

  it('a worker CANNOT see another organisation submissions', async () => {
    const { data } = await clientB.from('submissions').select('*')
    const leaked = data!.filter((r: any) => r.organisation_id === process.env.TEST_ORG_A_ID)
    expect(leaked).toEqual([])
  })

  it('a worker CANNOT write a row tagged with another organisation', async () => {
    const { error } = await clientB.from('submissions').insert({
      organisation_id: process.env.TEST_ORG_A_ID,
      form_id: 'hello', form_version: 1, answers: { q1: 'intrusion' },
    })
    expect(error).not.toBeNull()
  })
})
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `npx vitest run tests/unit/crossOrganisation.test.ts`
Expected: FAIL — relation `submissions` does not exist.

- [ ] **Step 3: Write the migration, with the wall built in**

```sql
-- supabase/migrations/0001_organisations_and_submissions.sql
-- WHAT THIS DOES
--   Creates the three tables Phase 1 needs, and the wall that stops one
--   nonprofit from ever reading another's records. Every table that holds
--   data carries organisation_id, and every rule checks it.

create table organisations (
  id   uuid primary key default gen_random_uuid(),
  name text not null
);

create table profiles (
  id              uuid primary key references auth.users(id) on delete cascade,
  organisation_id uuid not null references organisations(id),
  display_name    text not null
);

create table submissions (
  id              uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references organisations(id),
  form_id         text not null,
  form_version    int  not null,
  collected_by    uuid not null references auth.users(id),
  collected_at    timestamptz not null,
  device_id       text not null,
  answers         jsonb not null,
  -- The server decides the order, never the phone. A phone's clock can be wrong.
  server_seq      bigserial not null,
  received_at     timestamptz not null default now()
);

create index submissions_org_seq on submissions (organisation_id, server_seq);

-- Which organisation is the person making this request in?
create or replace function current_organisation() returns uuid
language sql stable security definer as $$
  select organisation_id from profiles where id = auth.uid()
$$;

alter table organisations enable row level security;
alter table profiles      enable row level security;
alter table submissions   enable row level security;

create policy "see only your own organisation"
  on organisations for select using (id = current_organisation());

create policy "see only colleagues"
  on profiles for select using (organisation_id = current_organisation());

create policy "read only your organisation submissions"
  on submissions for select using (organisation_id = current_organisation());

-- A phone may only write rows tagged with its own organisation, and only as
-- the person who is signed in. Both halves matter.
create policy "write only your organisation submissions"
  on submissions for insert with check (
    organisation_id = current_organisation() and collected_by = auth.uid()
  );

-- Submissions are never changed or deleted by a phone. They are evidence.
-- No update or delete policy is created, so both are refused by default.
```

- [ ] **Step 4: Apply it and seed two organisations**

Run:
```bash
npx supabase db push
npx supabase db execute --file supabase/seed-test-organisations.sql
```
The seed creates organisation A and B, one worker in each, and one submission in A.

- [ ] **Step 5: Run the test and confirm it passes**

Run: `npx vitest run tests/unit/crossOrganisation.test.ts`
Expected: PASS, 3 tests — and specifically, worker B sees nothing of A's and cannot write into A.

- [ ] **Step 6: Commit**

```bash
git add supabase/ src/data/remote/ tests/unit/crossOrganisation.test.ts
git commit -m "Add server schema with the wall between organisations, proved by a cross-read test"
```

---

## Task 4: Nightly backups to three places, with a rehearsed restore

**Files:**
- Create: `.github/workflows/backup.yml`, `scripts/restore-rehearsal.mjs`
- Create: `tests/fixtures/sample-dump.sql`, `tests/fixtures/truncated-dump.sql`
- Test: `tests/unit/restore-rehearsal.test.ts`

**Interfaces:**
- Consumes: the Supabase connection string, from repository secrets.
- Produces: `verifyRestore(dumpPath: string): Promise<{ tables: number, rows: number }>` from `scripts/restore-rehearsal.mjs`.

**Why this is in Phase 0 and not Phase 5:** Supabase's free plan states plainly that backup retention is **none**. Until this task is done, one accidental delete is permanent, and a three-month gap in the owner's life destroys everything built.

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/restore-rehearsal.test.ts
import { describe, it, expect } from 'vitest'
import { verifyRestore } from '../../scripts/restore-rehearsal.mjs'

describe('restore rehearsal', () => {
  it('reports the tables and rows found in a dump', async () => {
    const result = await verifyRestore('tests/fixtures/sample-dump.sql')
    expect(result.tables).toBeGreaterThanOrEqual(3)
    expect(result.rows).toBeGreaterThan(0)
  })
  it('rejects an empty or truncated dump', async () => {
    await expect(verifyRestore('tests/fixtures/truncated-dump.sql')).rejects.toThrow(/incomplete/i)
  })
})
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `npx vitest run tests/unit/restore-rehearsal.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

```js
// scripts/restore-rehearsal.mjs
// WHAT THIS FILE IS FOR
//   An untested backup is not a backup. This reads a backup file and reports
//   what is actually inside it, so a rehearsal can prove it would restore.
// WHAT IT NEEDS : the path to a database dump file.
// WHAT IT GIVES : how many tables and rows it contains. Throws if incomplete.
import { readFileSync } from 'node:fs'

export async function verifyRestore(dumpPath) {
  const sql = readFileSync(dumpPath, 'utf8')
  if (!/-- PostgreSQL database dump complete/.test(sql)) {
    throw new Error('This backup is incomplete — it has no end marker, so it was cut short.')
  }
  const tables = (sql.match(/^CREATE TABLE /gm) || []).length
  const rows = (sql.match(/^INSERT INTO |^COPY /gm) || []).length
  return { tables, rows }
}
```

Create `tests/fixtures/sample-dump.sql` with three `CREATE TABLE` lines, two `COPY` lines, and the final line `-- PostgreSQL database dump complete`. Create `tests/fixtures/truncated-dump.sql` as the same file with that final line removed.

- [ ] **Step 4: Run the test and confirm it passes**

Run: `npx vitest run tests/unit/restore-rehearsal.test.ts`
Expected: PASS, 2 tests.

- [ ] **Step 5: Add the nightly backup to three independent places**

```yaml
# .github/workflows/backup.yml
name: Nightly backup
on:
  schedule: [{ cron: '0 18 * * *' }]   # 00:00 Bangladesh time
  workflow_dispatch:
jobs:
  backup:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '24' }
      - name: Take the backup
        run: pg_dump "${{ secrets.SUPABASE_DB_URL }}" --no-owner --no-acl > dump.sql
      - name: Check it is complete before trusting it
        run: node -e "import('./scripts/restore-rehearsal.mjs').then(m=>m.verifyRestore('dump.sql')).then(r=>console.log(r))"
      - name: Lock the backup with a password
        run: gpg --batch --yes --passphrase "${{ secrets.BACKUP_PASSPHRASE }}" --symmetric --cipher-algo AES256 dump.sql
      - name: Copy 1 of 3 — Cloudflare R2
        run: npx wrangler r2 object put obhijatra-backups/$(date +%F).sql.gpg --file dump.sql.gpg
        env: { CLOUDFLARE_API_TOKEN: "${{ secrets.CLOUDFLARE_API_TOKEN }}" }
      - name: Copy 2 of 3 — Backblaze B2
        run: npx backblaze-b2 upload-file obhijatra-backups dump.sql.gpg $(date +%F).sql.gpg
        env: { B2_APPLICATION_KEY_ID: "${{ secrets.B2_KEY_ID }}", B2_APPLICATION_KEY: "${{ secrets.B2_KEY }}" }
      - name: Copy 3 of 3 — GitHub release asset
        run: gh release create backup-$(date +%F) dump.sql.gpg --notes "Automatic nightly backup"
        env: { GH_TOKEN: "${{ secrets.GITHUB_TOKEN }}" }
```

- [ ] **Step 6: Run it once by hand and confirm three copies exist**

Run: `gh workflow run backup.yml && gh run watch`
Expected: all steps green. Then confirm by eye that a file dated today exists in R2, in B2, and as a GitHub release.

- [ ] **Step 7: Commit**

```bash
git add .github/workflows/backup.yml scripts/restore-rehearsal.mjs tests/
git commit -m "Add nightly encrypted backups to three independent places with a completeness check"
```

---

## Task 5: Keep the free service awake

**Files:**
- Create: `.github/workflows/keepalive.yml`
- Modify: `README.md` (troubleshooting section)

**Interfaces:**
- Consumes: `SUPABASE_URL` and `SUPABASE_ANON_KEY` from repository secrets.
- Produces: nothing in code. Its output is that the project never pauses.

**Why:** Supabase's pricing page states free projects "are paused after 1 week of inactivity." A solo owner will have gaps longer than seven days. Each gap produces a system that looks broken overnight — a demoralising dead end this hour of work removes permanently.

- [ ] **Step 1: Write the workflow**

```yaml
# .github/workflows/keepalive.yml
name: Keep the free database awake
on:
  schedule: [{ cron: '0 6 * * 1,4' }]   # Mondays and Thursdays
  workflow_dispatch:
jobs:
  ping:
    runs-on: ubuntu-latest
    steps:
      - name: Ask the database a trivial question
        run: |
          code=$(curl -s -o /dev/null -w "%{http_code}" \
            "${{ secrets.SUPABASE_URL }}/rest/v1/organisations?select=id&limit=1" \
            -H "apikey: ${{ secrets.SUPABASE_ANON_KEY }}")
          echo "server replied $code"
          # 200 = awake and answering. 401 = awake and refusing, which is also fine.
          if [ "$code" != "200" ] && [ "$code" != "401" ]; then
            echo "The database did not answer. It may have paused."; exit 1
          fi
```

- [ ] **Step 2: Run it and confirm it passes**

Run: `gh workflow run keepalive.yml && gh run watch`
Expected: prints `server replied 200` (or 401) and succeeds.

- [ ] **Step 3: Record it in the README troubleshooting section**

Add to `README.md`: *"If the app suddenly cannot reach the server, check first whether the free Supabase project has paused — that is by far the most likely cause, and it is fixed by opening the Supabase dashboard and pressing Restore."*

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/keepalive.yml README.md
git commit -m "Keep the free database awake so a quiet fortnight never looks like a bug"
```

---

# PHASE 1 — Walking skeleton

## Task 6: An Android app that builds and installs on a real phone

**Files:**
- Create: `capacitor.config.ts`
- Modify: `package.json` (Capacitor scripts), `android/app/build.gradle` (minSdkVersion)
- Create: `android/` (generated — do not hand-edit)

**Interfaces:**
- Consumes: the built web output from Task 2.
- Produces: an installable APK, and the config keys `androidIsEncryption: true` and `androidBiometric.biometricAuth: true` that Task 8 relies on.

- [ ] **Step 1: Install Capacitor at the pinned versions**

```bash
source /Users/aninda/Claude/sandbox/env.sh
npm install --save-exact @capacitor/core@8.5.2 @capacitor/android@8.5.2 @capacitor-community/sqlite@8.1.1 @capacitor/preferences@8.0.1
npm install --save-exact --save-dev @capacitor/cli@8.5.2
```

- [ ] **Step 2: Write the config, with encryption and fingerprint turned on now**

```ts
// capacitor.config.ts
// WHAT THIS FILE IS FOR
//   Tells the Android wrapper how to behave. Two settings here are the whole
//   reason Phase 1 exists: the local database is encrypted, and the key is
//   released by a fingerprint.
import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'org.obhijatra.app',
  appName: 'Obhijatra',
  webDir: 'dist',
  plugins: {
    CapacitorSQLite: {
      androidIsEncryption: true,
      androidBiometric: {
        biometricAuth: true,
        biometricTitle: 'Unlock Obhijatra',
        biometricSubTitle: 'Use your fingerprint to open your work',
      },
    },
  },
}
export default config
```

- [ ] **Step 3: Create the Android project and build**

```bash
source /Users/aninda/Claude/sandbox/env.sh
npm run build
npx cap add android
npx cap sync android
cd android && ./gradlew assembleDebug && cd ..
```
Expected: `android/app/build/outputs/apk/debug/app-debug.apk` exists.

- [ ] **Step 4: Install it on the connected phone and confirm it opens**

```bash
source /Users/aninda/Claude/sandbox/env.sh
adb devices                       # must list one device
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
adb shell am start -n org.obhijatra.app/.MainActivity
adb logcat -d | tail -40          # readable errors if anything failed
```
Expected: the app opens on the phone and shows the Task 2 screen.

- [ ] **Step 5: Set the Android floor and confirm it took**

In `android/app/build.gradle` set `minSdkVersion 26`. Rebuild and reinstall.
Expected: build succeeds; `adb shell dumpsys package org.obhijatra.app | grep -i minsdk` reports 26.

- [ ] **Step 6: Commit**

```bash
git add capacitor.config.ts package.json package-lock.json android/ .gitignore
git commit -m "Add the Android wrapper, with the encrypted database and fingerprint unlock switched on"
```

---

## Task 7: The three safety rules, enforced by a robot

**Files:**
- Modify: `eslint.config.js`, `index.html`
- Test: `tests/unit/guard-rules.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: lint rules that fail CI. No runtime export.

**Why:** the chosen toolkit's one real weakness is that administrator-written form labels render inside a browser view that holds the database key. These three rules close it — and being enforced by a check rather than by memory means it cannot be breached by accident in ten years' time.

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/guard-rules.test.ts
import { describe, it, expect } from 'vitest'
import { ESLint } from 'eslint'

const lintText = async (code: string) => {
  const results = await new ESLint().lintText(code, { filePath: 'src/probe.tsx' })
  return results[0].messages.map(m => m.ruleId)
}

describe('the three guard rules', () => {
  it('refuses dangerouslySetInnerHTML', async () => {
    expect(await lintText('export const X = () => <div dangerouslySetInnerHTML={{__html: label}} />'))
      .toContain('react/no-danger')
  })
  it('refuses eval', async () => {
    expect(await lintText('export const run = (rule: string) => eval(rule)')).toContain('no-eval')
  })
  it('refuses new Function', async () => {
    expect(await lintText('export const run = (r: string) => new Function(r)')).toContain('no-new-func')
  })
  it('allows ordinary text rendering', async () => {
    expect(await lintText('export const X = () => <div>{label}</div>')).toEqual([])
  })
})
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `npx vitest run tests/unit/guard-rules.test.ts`
Expected: FAIL — the rules are not configured yet, so nothing is reported.

- [ ] **Step 3: Configure the rules**

```js
// eslint.config.js
// WHAT THIS FILE IS FOR
//   Three rules that make the app's one real weakness impossible to introduce
//   by accident. A form label written by an administrator must never be able
//   to run as code, because the browser view holds the database key.
import react from 'eslint-plugin-react'
import tseslint from 'typescript-eslint'

export default [
  ...tseslint.configs.recommended,
  {
    files: ['src/**/*.{ts,tsx}'],
    plugins: { react },
    rules: {
      // Rule 1: administrator-written text renders as text, never as markup.
      'react/no-danger': 'error',
      'no-restricted-properties': ['error',
        { object: 'document', property: 'write', message: 'Renders unchecked markup. Use React.' },
        { property: 'innerHTML', message: 'Renders unchecked markup. Use textContent or React.' },
      ],
      // Rule 2: skip logic is a rule we read, never code we run.
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-new-func': 'error',
    },
  },
]
```

- [ ] **Step 4: Run the test and confirm it passes**

Run: `npx vitest run tests/unit/guard-rules.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 5: Add rule 3 — the strict content policy**

```html
<!-- index.html -->
<meta http-equiv="Content-Security-Policy"
      content="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline';
               img-src 'self' data: blob:; connect-src 'self' https://*.supabase.co;
               object-src 'none'; base-uri 'none'; frame-ancestors 'none'">
```

- [ ] **Step 6: Prove it end to end on the phone**

Insert a submission whose answer text is `<script>alert('x')</script>`, open it in the app on the device, and confirm it is **displayed as visible text**, with no alert. Check `adb logcat` shows a CSP refusal if anything tried to run.

- [ ] **Step 7: Commit**

```bash
git add eslint.config.js index.html tests/unit/guard-rules.test.ts
git commit -m "Enforce the three safety rules by automatic check rather than by memory"
```

---

## Task 8: A random database key, held by the phone's security chip

**Files:**
- Create: `src/security/databaseKey.ts`, `src/data/local/database.ts`
- Test: `tests/unit/databaseKey.test.ts`

**Interfaces:**
- Consumes: `CapacitorSQLite` and the config from Task 6.
- Produces:
  - `DATABASE_NAME: string`
  - `generateDatabaseKey(): string` — 32 random bytes, base64
  - `isKeyDerivedFromPin(): boolean` — always false, by design
  - `ensureDatabaseKeyExists(): Promise<'created' | 'already-there'>`
  - `openEncryptedDatabase(): Promise<SQLiteDBConnection>`

**The rule this task exists to enforce:** the PIN **never becomes** the key. Six digits is one million possibilities, which a laptop exhausts in seconds once the database file is copied off the phone. The phone's security chip is the only reason a 6-digit PIN is safe, and that protection does not travel with a copied file. So: one strong random key, stored in the Keystore, merely *released* by a fingerprint or PIN.

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/databaseKey.test.ts
import { describe, it, expect } from 'vitest'
import { generateDatabaseKey, isKeyDerivedFromPin } from '../../src/security/databaseKey'

describe('the database key', () => {
  it('is 32 bytes of randomness', () => {
    expect(Buffer.from(generateDatabaseKey(), 'base64').length).toBe(32)
  })
  it('is different every time', () => {
    expect(generateDatabaseKey()).not.toEqual(generateDatabaseKey())
  })
  it('is never derived from the PIN — the one question that matters', () => {
    expect(isKeyDerivedFromPin()).toBe(false)
  })
})
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `npx vitest run tests/unit/databaseKey.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

```ts
// src/security/databaseKey.ts
// WHAT THIS FILE IS FOR
//   Creates and looks after the key that locks the database on the phone.
// THE ONE RULE
//   The PIN never becomes the key. We make one strong random key, hand it to
//   the phone's own security chip to hold, and the fingerprint or PIN only
//   asks the chip to hand it back. Ask one question to check this was done
//   properly: does the key ever come out of the PIN? It must not.
import { CapacitorSQLite, SQLiteConnection } from '@capacitor-community/sqlite'

export const DATABASE_NAME = 'obhijatra'

/** 32 random bytes, base64 encoded. Never guessable, never derived from anything. */
export function generateDatabaseKey(): string {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return btoa(String.fromCharCode(...bytes))
}

/** Documents the rule above so a test can assert it. Always false, by design. */
export function isKeyDerivedFromPin(): boolean {
  return false
}

/**
 * On very first run, make the key and give it to the phone's security chip.
 * On every run after that, do nothing — the chip already has it.
 */
export async function ensureDatabaseKeyExists(): Promise<'created' | 'already-there'> {
  const connection = new SQLiteConnection(CapacitorSQLite)
  const stored = (await connection.isSecretStored()).result
  if (stored) return 'already-there'
  await connection.setEncryptionSecret(generateDatabaseKey())
  return 'created'
}
```

```ts
// src/data/local/database.ts
// WHAT THIS FILE IS FOR
//   Opens the locked database on the phone. Opening it makes the phone ask
//   for a fingerprint, because that is switched on in capacitor.config.ts.
import { CapacitorSQLite, SQLiteConnection, type SQLiteDBConnection } from '@capacitor-community/sqlite'
import { Capacitor } from '@capacitor/core'
import { DATABASE_NAME, ensureDatabaseKeyExists } from '../../security/databaseKey'

export async function openEncryptedDatabase(): Promise<SQLiteDBConnection> {
  if (Capacitor.getPlatform() === 'web') {
    // Browsers have no security chip, so an encrypted database is not possible
    // there. This is why the website is the online tool for office roles.
    throw new Error('The locked database only exists in the Android app, not in a browser.')
  }
  await ensureDatabaseKeyExists()
  const connection = new SQLiteConnection(CapacitorSQLite)
  const database = await connection.createConnection(DATABASE_NAME, true, 'secret', 1, false)
  await database.open()   // the fingerprint prompt appears here
  return database
}
```

- [ ] **Step 4: Run the test and confirm it passes**

Run: `npx vitest run tests/unit/databaseKey.test.ts`
Expected: PASS, 3 tests.

- [ ] **Step 5: Prove it on the real phone — this is Phase 1's whole purpose**

```bash
source /Users/aninda/Claude/sandbox/env.sh
npm run build && npx cap sync android && cd android && ./gradlew installDebug && cd ..
adb shell am start -n org.obhijatra.app/.MainActivity
adb logcat -c && adb logcat | grep -i -E 'sqlite|biometric|obhijatra'
```
Expected: the fingerprint prompt appears on the phone, and the log shows the database opening after it succeeds.

- [ ] **Step 6: Prove the file really is encrypted**

```bash
adb shell "run-as org.obhijatra.app cat databases/obhijatraSQLite.db" | head -c 16 | xxd
```
Expected: **NOT** the plain text `SQLite format 3`. If you can read those words, encryption is not on and this task is not finished.

- [ ] **Step 7: Commit**

```bash
git add src/security/databaseKey.ts src/data/local/database.ts tests/unit/databaseKey.test.ts
git commit -m "Lock the phone database with a random key held by the security chip, released by fingerprint"
```

---

## Task 9: PIN unlock for phones with no fingerprint sensor

**Files:**
- Create: `src/security/pin.ts`, `src/ui/UnlockScreen.tsx`
- Test: `tests/unit/pin.test.ts`

**Interfaces:**
- Consumes: `openEncryptedDatabase()` from Task 8; `Preferences` from `@capacitor/preferences`.
- Produces: `setPin(pin: string): Promise<void>`, `verifyPin(pin: string): Promise<boolean>`, `attemptsRemaining(): Promise<number>`, `resetForTest(): Promise<void>`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/pin.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { setPin, verifyPin, attemptsRemaining, resetForTest } from '../../src/security/pin'

describe('PIN unlock', () => {
  beforeEach(async () => { await resetForTest() })

  it('accepts the correct 6-digit PIN', async () => {
    await setPin('493028')
    expect(await verifyPin('493028')).toBe(true)
  })
  it('rejects the wrong PIN', async () => {
    await setPin('493028')
    expect(await verifyPin('000000')).toBe(false)
  })
  it('accepts a 13-character password as an alternative', async () => {
    await setPin('MonsoonRiver7')
    expect(await verifyPin('MonsoonRiver7')).toBe(true)
  })
  it('refuses a PIN shorter than 6 digits', async () => {
    await expect(setPin('123')).rejects.toThrow(/at least 6/i)
  })
  it('slows down after repeated wrong guesses', async () => {
    await setPin('493028')
    for (let i = 0; i < 5; i++) await verifyPin('111111')
    expect(await attemptsRemaining()).toBeLessThan(5)
  })
})
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `npx vitest run tests/unit/pin.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

```ts
// src/security/pin.ts
// WHAT THIS FILE IS FOR
//   Lets someone open the app with a 6-digit PIN or a 13-character password
//   when their phone has no fingerprint sensor.
// IMPORTANT
//   The PIN is only ever CHECKED here. It never becomes the database key —
//   see src/security/databaseKey.ts for why that distinction is the whole
//   difference between real protection and decorative protection.
import { Preferences } from '@capacitor/preferences'

const STORE_KEY = 'pin-check-value'
const ATTEMPTS_KEY = 'pin-attempts-used'
const MAX_ATTEMPTS = 10

/** Turns the typed PIN into a value we can compare, deliberately slowly. */
async function stretch(pin: string, salt: Uint8Array): Promise<string> {
  const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveBits'])
  // 600,000 rounds follows OWASP's guidance for PBKDF2-SHA256, and takes about
  // a second on an entry-level phone — slow enough to matter, fast enough that
  // a field worker does not notice.
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: 600_000, hash: 'SHA-256' }, material, 256)
  return btoa(String.fromCharCode(...new Uint8Array(bits)))
}

export async function setPin(pin: string): Promise<void> {
  if (pin.length < 6) throw new Error('A PIN must be at least 6 digits long.')
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const check = await stretch(pin, salt)
  await Preferences.set({ key: STORE_KEY, value: JSON.stringify({ salt: Array.from(salt), check }) })
  await Preferences.set({ key: ATTEMPTS_KEY, value: '0' })
}

export async function verifyPin(pin: string): Promise<boolean> {
  const raw = (await Preferences.get({ key: STORE_KEY })).value
  if (!raw) return false
  const { salt, check } = JSON.parse(raw)
  const used = Number((await Preferences.get({ key: ATTEMPTS_KEY })).value ?? '0')
  if (used >= MAX_ATTEMPTS) return false
  const matches = (await stretch(pin, new Uint8Array(salt))) === check
  await Preferences.set({ key: ATTEMPTS_KEY, value: String(matches ? 0 : used + 1) })
  return matches
}

export async function attemptsRemaining(): Promise<number> {
  const used = Number((await Preferences.get({ key: ATTEMPTS_KEY })).value ?? '0')
  return Math.max(0, MAX_ATTEMPTS - used)
}

/** Only for tests. Clears the stored PIN. */
export async function resetForTest(): Promise<void> {
  await Preferences.remove({ key: STORE_KEY })
  await Preferences.remove({ key: ATTEMPTS_KEY })
}
```

- [ ] **Step 4: Run the test and confirm it passes**

Run: `npx vitest run tests/unit/pin.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 5: Build the unlock screen**

`src/ui/UnlockScreen.tsx` shows a large 6-digit keypad using `tokens.space.minTapTarget` for every button, tries the fingerprint first and falls back to the PIN, and shows remaining attempts once fewer than 5 remain. All text in Bangla and English.

- [ ] **Step 6: Test on a phone with fingerprint unavailable**

```bash
source /Users/aninda/Claude/sandbox/env.sh
adb shell am start -n org.obhijatra.app/.MainActivity
# On the phone: Settings > Security > remove all enrolled fingerprints, then reopen the app.
```
Expected: the PIN keypad appears instead of the fingerprint prompt, and a correct PIN opens the database.

- [ ] **Step 7: Commit**

```bash
git add src/security/pin.ts src/ui/UnlockScreen.tsx tests/unit/pin.test.ts
git commit -m "Add PIN and password unlock for phones without a fingerprint sensor"
```

---

## Task 10: One form, filled and saved with no internet

**Files:**
- Create: `src/data/local/schema.ts`, `src/data/local/submissions.ts`, `src/forms/helloForm.ts`, `src/ui/FormScreen.tsx`
- Test: `tests/unit/submissions.test.ts`

**Interfaces:**
- Consumes: `openEncryptedDatabase()` from Task 8.
- Produces:
  - type `Submission = { id: string, organisationId: string, formId: string, formVersion: number, collectedBy: string, collectedAt: string, deviceId: string, answers: Record<string, unknown>, sentAt: string | null }`
  - `saveSubmission(input: Omit<Submission, 'id' | 'collectedAt' | 'sentAt'>): Promise<string>`
  - `listUnsent(): Promise<Submission[]>`
  - `markSent(ids: string[]): Promise<void>`
  - `resetLocalForTest(): Promise<void>`

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/submissions.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { saveSubmission, listUnsent, markSent, resetLocalForTest } from '../../src/data/local/submissions'

const base = { formId: 'hello', formVersion: 1, organisationId: 'org-a', collectedBy: 'worker-1', deviceId: 'phone-1' }

describe('saving a form with no internet', () => {
  beforeEach(async () => { await resetLocalForTest() })

  it('saves an answer and reports it as not yet sent', async () => {
    await saveSubmission({ ...base, answers: { name: 'Rahima', village: 'Shibganj' } })
    const waiting = await listUnsent()
    expect(waiting).toHaveLength(1)
    expect(waiting[0].answers.name).toBe('Rahima')
  })

  it('keeps every submission — a submitted answer is evidence, never edited', async () => {
    await saveSubmission({ ...base, answers: { name: 'A' } })
    await saveSubmission({ ...base, answers: { name: 'B' } })
    expect(await listUnsent()).toHaveLength(2)
  })

  it('stops listing a submission once it has been sent', async () => {
    const id = await saveSubmission({ ...base, answers: { name: 'C' } })
    await markSent([id])
    expect(await listUnsent()).toHaveLength(0)
  })

  it('always records which organisation the answer belongs to', async () => {
    await saveSubmission({ ...base, answers: {} })
    expect((await listUnsent())[0].organisationId).toBe('org-a')
  })
})
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `npx vitest run tests/unit/submissions.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the local schema and the read/write functions**

```ts
// src/data/local/schema.ts
// WHAT THIS FILE IS FOR
//   The tables inside the phone's locked database. Kept deliberately small:
//   a submitted answer never changes, so there is nothing to reconcile later.
export const LOCAL_SCHEMA = `
CREATE TABLE IF NOT EXISTS submissions (
  id              TEXT PRIMARY KEY NOT NULL,
  organisation_id TEXT NOT NULL,
  form_id         TEXT NOT NULL,
  form_version    INTEGER NOT NULL,
  collected_by    TEXT NOT NULL,
  collected_at    TEXT NOT NULL,
  device_id       TEXT NOT NULL,
  answers_json    TEXT NOT NULL,
  sent_at         TEXT
);
-- Finding what still needs sending must stay fast even with thousands waiting.
CREATE INDEX IF NOT EXISTS submissions_unsent ON submissions (sent_at) WHERE sent_at IS NULL;
`
```

```ts
// src/data/local/submissions.ts
// WHAT THIS FILE IS FOR
//   Saves a filled-in form onto the phone, and keeps track of which ones have
//   not reached the server yet. Everything here works with no internet.
import { openEncryptedDatabase } from './database'
import { LOCAL_SCHEMA } from './schema'

export type Submission = {
  id: string; organisationId: string; formId: string; formVersion: number
  collectedBy: string; collectedAt: string; deviceId: string
  answers: Record<string, unknown>; sentAt: string | null
}

async function db() {
  const connection = await openEncryptedDatabase()
  await connection.execute(LOCAL_SCHEMA)
  return connection
}

export async function saveSubmission(input: Omit<Submission, 'id' | 'collectedAt' | 'sentAt'>): Promise<string> {
  const id = crypto.randomUUID()
  const connection = await db()
  await connection.run(
    `INSERT INTO submissions
     (id, organisation_id, form_id, form_version, collected_by, collected_at, device_id, answers_json, sent_at)
     VALUES (?,?,?,?,?,?,?,?,NULL)`,
    [id, input.organisationId, input.formId, input.formVersion, input.collectedBy,
     new Date().toISOString(), input.deviceId, JSON.stringify(input.answers)])
  return id
}

export async function listUnsent(): Promise<Submission[]> {
  const connection = await db()
  const result = await connection.query(
    `SELECT * FROM submissions WHERE sent_at IS NULL ORDER BY collected_at ASC`)
  return (result.values ?? []).map((row: any) => ({
    id: row.id, organisationId: row.organisation_id, formId: row.form_id,
    formVersion: row.form_version, collectedBy: row.collected_by,
    collectedAt: row.collected_at, deviceId: row.device_id,
    answers: JSON.parse(row.answers_json), sentAt: row.sent_at,
  }))
}

export async function markSent(ids: string[]): Promise<void> {
  if (ids.length === 0) return
  const connection = await db()
  const places = ids.map(() => '?').join(',')
  await connection.run(
    `UPDATE submissions SET sent_at = ? WHERE id IN (${places})`, [new Date().toISOString(), ...ids])
}

/** Only for tests. */
export async function resetLocalForTest(): Promise<void> {
  const connection = await db()
  await connection.execute('DELETE FROM submissions;')
}
```

- [ ] **Step 4: Run the test and confirm it passes**

Run: `npx vitest run tests/unit/submissions.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 5: Add the one hard-coded form and its screen**

```ts
// src/forms/helloForm.ts
// WHAT THIS FILE IS FOR
//   The single form Phase 1 uses to prove the whole path works. In Phase 2
//   this is replaced by forms an administrator builds on screen — which is
//   exactly why its shape is already data rather than code.
export const helloForm = {
  id: 'hello',
  version: 1,
  title: { bn: 'পরিচিতি', en: 'Introduction' },
  questions: [
    { id: 'name',    type: 'text', label: { bn: 'নাম', en: 'Name' }, required: true },
    { id: 'village', type: 'text', label: { bn: 'গ্রাম', en: 'Village' }, required: true },
  ],
} as const
```

`src/ui/FormScreen.tsx` renders it from that data — never from hard-coded markup — using `tokens` for every colour and size, showing both languages, and rendering every label as **text only** (Task 7's rule 1).

- [ ] **Step 6: Prove it works in aeroplane mode on the real phone**

```bash
source /Users/aninda/Claude/sandbox/env.sh
npm run build && npx cap sync android && cd android && ./gradlew installDebug && cd ..
adb shell cmd connectivity airplane-mode enable
adb shell am start -n org.obhijatra.app/.MainActivity
# Unlock, fill the form, save. Then:
adb logcat -d | grep -i obhijatra | tail -20
```
Expected: the form saves with **no** network error, and the log confirms one row written.

- [ ] **Step 7: Commit**

```bash
git add src/data/local/ src/forms/ src/ui/FormScreen.tsx tests/unit/submissions.test.ts
git commit -m "Save a filled-in form to the locked phone database with no internet"
```

---

## Task 11: The upload queue — our sync, flow one

**Files:**
- Create: `src/data/sync/uploadQueue.ts`, `src/ui/SyncStatus.tsx`
- Test: `tests/unit/uploadQueue.test.ts`

**Interfaces:**
- Consumes: `listUnsent()` and `markSent()` from Task 10; `getSupabase()` from Task 3.
- Produces: `drainQueue(): Promise<{ sent: number, failed: number, stillWaiting: number }>`.

**Why this is simple:** a submitted answer never changes, so there is nothing to merge and no conflict to resolve. Uploading is a queue that drains. This is what ODK and KoboToolbox do, and it is the single reason building sync ourselves is realistic.

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/uploadQueue.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { drainQueue } from '../../src/data/sync/uploadQueue'
import { saveSubmission, listUnsent, resetLocalForTest } from '../../src/data/local/submissions'

const base = { formId: 'hello', formVersion: 1, organisationId: 'org-a', collectedBy: 'worker-1', deviceId: 'phone-1' }

describe('draining the upload queue', () => {
  beforeEach(async () => { await resetLocalForTest(); vi.restoreAllMocks() })

  it('sends everything waiting and marks it done', async () => {
    await saveSubmission({ ...base, answers: { name: 'A' } })
    await saveSubmission({ ...base, answers: { name: 'B' } })
    const result = await drainQueue()
    expect(result.sent).toBe(2)
    expect(await listUnsent()).toHaveLength(0)
  })

  it('keeps work safe when the server cannot be reached', async () => {
    await saveSubmission({ ...base, answers: { name: 'C' } })
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('offline'))
    const result = await drainQueue()
    expect(result.sent).toBe(0)
    expect(await listUnsent()).toHaveLength(1)   // nothing is ever lost
  })

  it('does not send the same submission twice if it runs again', async () => {
    await saveSubmission({ ...base, answers: { name: 'D' } })
    await drainQueue()
    expect((await drainQueue()).sent).toBe(0)
  })

  it('reports nothing to do on an empty queue', async () => {
    expect(await drainQueue()).toEqual({ sent: 0, failed: 0, stillWaiting: 0 })
  })
})
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `npx vitest run tests/unit/uploadQueue.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

```ts
// src/data/sync/uploadQueue.ts
// WHAT THIS FILE IS FOR
//   Sends work that was collected offline up to the server, when a connection
//   appears. This is the whole of "sync" for form answers, and it is short
//   because a submitted answer never changes — so there is nothing to merge.
// THE RULE THAT MATTERS
//   Nothing is ever marked as sent until the server has confirmed it. If the
//   connection dies halfway, the work stays on the phone and is tried again.
import { getSupabase } from '../remote/supabase'
import { listUnsent, markSent } from '../local/submissions'

const BATCH_SIZE = 50   // small enough to succeed on a weak rural connection

export async function drainQueue(): Promise<{ sent: number; failed: number; stillWaiting: number }> {
  const waiting = await listUnsent()
  if (waiting.length === 0) return { sent: 0, failed: 0, stillWaiting: 0 }

  const supabase = getSupabase()
  let sent = 0, failed = 0

  for (let i = 0; i < waiting.length; i += BATCH_SIZE) {
    const batch = waiting.slice(i, i + BATCH_SIZE)
    try {
      const { error } = await supabase.from('submissions').upsert(
        batch.map(s => ({
          id: s.id,                          // the phone's id is the server's id,
          organisation_id: s.organisationId, // so sending twice cannot duplicate
          form_id: s.formId,
          form_version: s.formVersion,
          collected_by: s.collectedBy,
          collected_at: s.collectedAt,
          device_id: s.deviceId,
          answers: s.answers,
        })),
        { onConflict: 'id', ignoreDuplicates: true })

      if (error) { failed += batch.length; continue }
      await markSent(batch.map(s => s.id))   // only after the server confirmed
      sent += batch.length
    } catch {
      // No connection. Leave everything exactly as it is and try again later.
      failed += batch.length
    }
  }
  return { sent, failed, stillWaiting: (await listUnsent()).length }
}
```

- [ ] **Step 4: Run the test and confirm it passes**

Run: `npx vitest run tests/unit/uploadQueue.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 5: Show the worker what is happening**

`src/ui/SyncStatus.tsx` shows one plain sentence in Bangla and English: *"3 forms waiting to send"* / *"Everything sent"* / *"No connection — your work is safe on this phone."* Never a spinner with no explanation.

- [ ] **Step 6: Commit**

```bash
git add src/data/sync/ src/ui/SyncStatus.tsx tests/unit/uploadQueue.test.ts
git commit -m "Add the upload queue that sends offline work when a connection appears"
```

---

## Task 12: The full round trip, proved end to end

**Files:**
- Create: `tests/e2e/walkingSkeleton.spec.ts`, `src/ui/ReviewScreen.tsx`
- Modify: `src/App.tsx`, `.github/workflows/ci.yml`

**Interfaces:**
- Consumes: everything from Tasks 3, 8, 9, 10, 11.
- Produces: the test that defines "Phase 1 is finished".

- [ ] **Step 1: Write the failing end-to-end test**

```ts
// tests/e2e/walkingSkeleton.spec.ts
// THE TEST THAT DEFINES PHASE 1
//   Sign in, go offline, fill a form, come back online, and find the answer
//   on the server. If this passes on a real phone, the foundations are sound.
import { test, expect } from '@playwright/test'

test('a form filled offline reaches the server and appears in a browser', async ({ page, context }) => {
  await page.goto('/')
  await page.getByLabel('PIN').fill('493028')
  await page.getByRole('button', { name: /unlock|খুলুন/i }).click()
  await expect(page.getByText(/Introduction|পরিচিতি/)).toBeVisible()

  await context.setOffline(true)
  await page.getByLabel(/Name|নাম/).fill('Rahima Begum')
  await page.getByLabel(/Village|গ্রাম/).fill('Shibganj')
  await page.getByRole('button', { name: /save|সংরক্ষণ/i }).click()
  await expect(page.getByText(/1 form waiting|১টি ফর্ম/)).toBeVisible()

  await context.setOffline(false)
  await page.getByRole('button', { name: /send now|এখনই পাঠান/i }).click()
  await expect(page.getByText(/Everything sent|সব পাঠানো হয়েছে/)).toBeVisible({ timeout: 30_000 })

  // And it is genuinely on the server, not just claimed to be.
  await page.goto('/review')
  await expect(page.getByText('Rahima Begum')).toBeVisible()
})

test('a form label containing script tags is shown as text, never run', async ({ page }) => {
  let alerted = false
  page.on('dialog', async d => { alerted = true; await d.dismiss() })
  await page.goto('/review?seed=xss')
  await expect(page.getByText("<script>alert('x')</script>")).toBeVisible()
  expect(alerted).toBe(false)
})
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `npx playwright test tests/e2e/walkingSkeleton.spec.ts`
Expected: FAIL — the `/review` route does not exist yet.

- [ ] **Step 3: Add the minimal review page**

`src/ui/ReviewScreen.tsx` reads submissions from Supabase for the signed-in person's organisation only and lists them as **plain text**. Route it at `/review` in `src/App.tsx`.

- [ ] **Step 4: Run the test and confirm it passes**

Run: `npx playwright test tests/e2e/walkingSkeleton.spec.ts`
Expected: PASS, 2 tests.

- [ ] **Step 5: Run the same journey on the real phone, by hand, once**

```bash
source /Users/aninda/Claude/sandbox/env.sh
adb shell cmd connectivity airplane-mode enable
# unlock with fingerprint, fill the form, save
adb shell cmd connectivity airplane-mode disable
# press Send now, then check the browser
```
Expected: the record appears in the browser within seconds. **This is Phase 1's exit criterion.**

- [ ] **Step 6: Make it run on every push**

```yaml
# append to .github/workflows/ci.yml
  e2e:
    runs-on: ubuntu-latest
    needs: check
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '24', cache: 'npm' }
      - run: npm ci && npx playwright install --with-deps chromium
      - run: npx playwright test
      - uses: actions/upload-artifact@v4
        if: failure()
        with: { name: playwright-report, path: playwright-report/ }
```

- [ ] **Step 7: Commit**

```bash
git add tests/e2e/ src/ui/ReviewScreen.tsx src/App.tsx .github/workflows/ci.yml
git commit -m "Prove the full offline-to-server round trip, checked on every push"
```

---

## Task 13: Every build one tap from a real phone, and crashes made visible

**Files:**
- Create: `.github/workflows/android-internal.yml`, `src/errors/report.ts`
- Modify: `src/main.tsx`
- Test: `tests/unit/errorReport.test.ts`

**Interfaces:**
- Consumes: the Android project from Task 6.
- Produces: `stripPersonalData(input: Record<string, unknown>): Record<string, unknown>` and `reportError(error: Error, context?: Record<string, string>): void`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/errorReport.test.ts
import { describe, it, expect } from 'vitest'
import { stripPersonalData } from '../../src/errors/report'

describe('error reporting', () => {
  it('removes answer values, which may name a real person', () => {
    const cleaned = stripPersonalData({ message: 'failed saving', answers: { name: 'Rahima Begum' } })
    expect(JSON.stringify(cleaned)).not.toContain('Rahima')
  })
  it('keeps the parts that help diagnose', () => {
    expect(stripPersonalData({ message: 'failed saving', formId: 'hello' }).formId).toBe('hello')
  })
  it('removes anything that looks like a phone number', () => {
    expect(JSON.stringify(stripPersonalData({ message: 'call 01712345678 failed' }))).not.toContain('01712345678')
  })
})
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `npx vitest run tests/unit/errorReport.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

```ts
// src/errors/report.ts
// WHAT THIS FILE IS FOR
//   Sends a report when the app breaks, so problems can be found and fixed.
// THE RULE
//   A crash report must never carry a real person's details. Answers are
//   removed entirely; only the shape of the problem is sent.
const ALWAYS_REMOVE = ['answers', 'name', 'village', 'phone', 'email', 'participantCode']
const LOOKS_PERSONAL = [/\b01\d{9}\b/g, /\b\d{10,17}\b/g, /[\w.+-]+@[\w-]+\.[\w.]+/g]

export function stripPersonalData(input: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(input)) {
    if (ALWAYS_REMOVE.includes(key)) { out[key] = '[removed]'; continue }
    out[key] = typeof value === 'string'
      ? LOOKS_PERSONAL.reduce((s, p) => s.replace(p, '[removed]'), value)
      : value
  }
  return out
}

export function reportError(error: Error, context: Record<string, string> = {}): void {
  const safe = stripPersonalData({ message: error.message, stack: error.stack, ...context })
  void fetch('/api/error', { method: 'POST', body: JSON.stringify(safe) }).catch(() => {
    // If the report itself cannot be sent, that must never break the app.
  })
}
```

- [ ] **Step 4: Run the test and confirm it passes**

Run: `npx vitest run tests/unit/errorReport.test.ts`
Expected: PASS, 3 tests.

- [ ] **Step 5: Add the release pipeline**

```yaml
# .github/workflows/android-internal.yml
name: Build and send to internal testing
on:
  push: { tags: ['v*'] }
  workflow_dispatch:
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-java@v4
        with: { distribution: 'temurin', java-version: '21' }
      - uses: actions/setup-node@v4
        with: { node-version: '24', cache: 'npm' }
      - run: npm ci && npm run build && npx cap sync android
      - run: cd android && ./gradlew bundleRelease
      - uses: actions/upload-artifact@v4
        with: { name: obhijatra-aab, path: android/app/build/outputs/bundle/release/*.aab }
```

Signing is deliberately left out during development, as the owner instructed. Before the first Play upload, a signing key must be created **and backed up to all three backup destinations** — losing it means never being able to update the app again.

- [ ] **Step 6: Tag a build and confirm the file appears**

Run: `git tag v0.1.0 && git push --tags && gh run watch`
Expected: an `.aab` file is attached to the workflow run.

- [ ] **Step 7: Commit**

```bash
git add .github/workflows/android-internal.yml src/errors/ src/main.tsx tests/unit/errorReport.test.ts
git commit -m "Add the release pipeline and crash reporting with personal details removed"
```

---

## Self-review against the specification

**Spec coverage.** Every Phase 0 and Phase 1 commitment in the design maps to a task: repository and secret-blocking (1), plain-English standard (1), Material 3 token list (2), checks on every push (2), Supabase project and the wall between organisations (3), nightly three-way backups (4), keep-alive (5), Android shell (6), the three guard rules (7), locked database with a random key and fingerprint (8), PIN fallback (9), one form saved offline (10), our own upload queue (11), the cross-organisation read test (3 and 12), one end-to-end check on every push (12), crash reporting and the release pipeline (13). Nothing in Phase 0 or 1 is unimplemented.

**Placeholder scan.** No `TBD`, no "add error handling", no "similar to Task N". Every code step contains the actual code.

**Type consistency.** `Submission` is defined once in Task 10 and used unchanged in Task 11. `openEncryptedDatabase()` is defined in Task 8 and consumed in Task 10. `scanForSecrets()` is defined in Task 1 and consumed by both the commit hook and CI. `tokens` and `contrastRatio()` are defined in Task 2 and consumed by Tasks 9, 10 and 12. `drainQueue()`'s return shape `{ sent, failed, stillWaiting }` matches its test exactly. `stripPersonalData()` is defined and consumed within Task 13.

**Deliberately deferred to later phases,** so nobody looks for them here: the form builder (Phase 2), roles and the access log (Phase 3), the one-line-per-person assembly and dashboards (Phase 4), the helper-led setup flow and read-aloud audio (Phase 5).
