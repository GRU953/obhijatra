# Obhijatra Phase 2 — The Form Designer

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development or superpowers:executing-plans. Steps use `- [ ]` checkboxes.

**Goal:** A supervisor assembles a form from menus — never by typing formulas — presses Publish, and that form becomes a sealed numbered edition that reaches every phone in the organisation as ordinary data. Every answer records which edition produced it, permanently.

**Spec:** `docs/superpowers/specs/2026-09-19-obhijatra-design.md`

---

## The one idea everything rests on

**Publishing is printing.** You can print edition 4, but you can never change the copies already handed out. Every answer records its edition. Most of the machinery six panels proposed became unnecessary once that rule is genuinely enforced — separate answer-list tables, per-answer label copies, a change-number cursor, a retire button and a reachability checker were all solving problems that freezing the edition already solves.

## Decisions made by the owner, 19 September 2026

| Decision | Choice |
|---|---|
| Can a published form change? | **Sealed forever.** A fix means a new edition. |
| Photographs in Phase 2? | **No.** Eleven text-and-number types now. |
| An answer the worker then hides? | **Deleted**, as the ODK specification requires. |

---

## Honest note on schedule

The design document said Phases 0–5 would take 25–36 working weeks, and Phases 0–1 about 5–7 of them. **They took one day** — the git history shows every commit between 01:20 and 14:45 on 19 September 2026.

Those estimates assumed a person typing. They do not describe this project. **What actually paces Obhijatra is the owner's availability**: decisions, fingerprint taps on a real phone, accounts only he can create. On the day Phase 1 completed, three of the four blocking items were waiting for him, not for code.

**So this plan gives no hour estimates.** Each task states whether it is blocked on the owner or not. That is the only figure that has been observed to mean anything.

---

## Global constraints (in addition to the spec's)

- **Rules are information the app reads, never code it runs.** A rule is `{question, operator, value}`, joined by ALL or ANY. Thirteen operators, a closed list. No typed formulas, ever, for anyone — including head office. Anything executing inside the app's browser view can call the database plugin exactly as our own code does; it would not need to steal the key, it could simply ask for the data or change the key and lock an organisation out of its own records permanently.
- **Rules may only point backwards.** A rule may name only a question appearing earlier in the form. That single line makes loops structurally impossible — no cycle detection, no graph algorithm, no possibility of the app spinning until Android kills it.
- **Blank answers behave one written-down way.** Comparisons involving a blank are always false, never true and never an error. `was answered` and `was left blank` are the only operators treating blank as information. Checks are not applied to blank answers; only "required" forbids blank. Both borrowed from XLSForm, where twenty years of field use settled them.
- **Nothing is validated only on the author's laptop.** Every rule enforced at authoring time is enforced again by the phone on every downloaded edition.
- **256 KB per edition, refused by the database itself**, with the real size in the message. The refusal happens on a laptop, on a good connection, in front of the person who caused it — never in a village.

---

## The eleven question types

Short text · Paragraph · Whole number · Decimal number · Yes/No · Choose one · Choose several · Date · Time · Mobile number · Location (GPS) — plus **Note**, which displays text and takes no answer.

**Deliberately excluded, with reasons:**

- **Photograph** — owner's decision, and it carries a hidden cost the panels missed: files stored outside the encrypted database would be plaintext. On a stolen or repaired phone the locked database would hold nothing and the photo folder would hold beneficiaries' faces. If photographs return, they go *inside* the encrypted database.
- **Signature** — a photograph of a signed sheet does the same job; returns with photographs.
- **Worked-out value** — a quiz total is calculated when shown, from points on answer options. Storing it too would mean two facts that should agree, and one day will not.
- **Searchable list** is not a type; it is a display setting on Choose one / Choose several, exactly as ODK does it.
- **"Other, please specify"** is not a type; it is an option called Other plus a short-text question shown only when Other is picked.

**Named ceiling:** 256 KB will not hold a 5,000-village list, so a national village picker is not possible in Phase 2. When a real organisation needs one, answer lists move to their own versioned table then. Nothing published before that needs changing, because frozen editions keep their own lists forever.

---

## What the adversarial review changed

All three reviewers returned *needs rework*. Every fix below is folded into the tasks.

| Found | Change |
|---|---|
| Validation ran only on the author's laptop; the server accepted any JSON | The phone re-validates every downloaded edition and refuses loudly (Task 6) |
| **"There is no such thing as a supervisor"** — every worker's password could publish | `profiles.role`; publishing requires supervisor (Task 3) |
| One account could fill the shared database and make it read-only for *every* organisation | Per-organisation quota, refused at publish time (Task 3) |
| "The database cannot alter a published edition" was untrue for the owner role | `FORCE ROW LEVEL SECURITY` + a trigger that raises on UPDATE/DELETE, and the phone refuses an edition whose fingerprint changed (Tasks 3, 6) |
| Per-question autosave had nowhere to save — half-finished interviews would upload as **permanent, uneditable** records | A separate `drafts` table the uploader never sees (Task 7) |
| Forms downloaded *before* uploads, with no timeout — a hang would strand six weeks of work | **Upload first**, then download; every remote call gets a deadline (Task 8) |
| A five-strike block sat on a signal that cannot tell a refused row from a dropped connection | Distinguish them; **blocked is a display state, never terminal** (Task 8) |
| A planned test asserted something hard-coded true — it could never fail | Deleted. Replaced with a spy that can (Task 9) |
| Autosave had no automated test at any layer — the same method that let Phase 1's silent bug ship | An injectable save seam, tested without a device (Task 7) |
| The builder serves a user who does not exist yet | **Cut.** Forms are authored as files the validator checks in CI (Task 10) |
| `--single-transaction` missing on live schema changes | **Already fixed and pushed**, in its own commit |
| "No new dependencies needed" was false | Location needs a plugin; named in Task 5 |
| The content policy allowed *every* Supabase project on the internet | Narrowed to this project only (Task 3) |

---

## Tasks

Each ends with one test that fails if the thing breaks.

### Task 1 — What a form is, and refusing a bad one
Extend the shape already proven on the phone (`src/forms/helloForm.ts`) into a full definition, plus `validateFormDefinition()` — a pure function, no device, no server.
**Test:** a form whose rule points *forward* is refused; one pointing backwards is accepted. **Not blocked on the owner.**

### Task 2 — Reading a rule
The interpreter: thirteen operators, a plain switch, no text to interpret.
**Test:** a rule whose value is a string of code is compared as a *string* and never runs. **Not blocked on the owner.**

### Task 3 — The server side of sealing
`form_versions` table; `FORCE ROW LEVEL SECURITY`; a trigger raising on UPDATE and DELETE; `profiles.role`; publishing only through a `SECURITY DEFINER` function with `INSERT` revoked from everyone else; a 256 KB check; a per-organisation quota; narrowed content policy.
**Test:** `supabase/tests/rls.sql` gains three cases — a worker-role account is refused when publishing, an UPDATE on a published edition raises, and a 300 KB definition is refused.

### Task 4 — Answering against a definition
The form screen renders from a definition rather than hard-coded fields; hidden answers are deleted at save.
**Test:** answer three children's questions, set *has children* to no, save — the record contains no trace of them.

### Task 5 — The remaining question types
The eleven types. Location needs `@capacitor/geolocation` — the only new dependency, named rather than discovered.
**Test:** each type round-trips through save and reload unchanged, including Bangla text and awkward characters.

### Task 6 — Editions reaching a phone
The phone asks for a list of *(form, edition)* pairs, downloads only what it lacks, checks each fingerprint, **re-runs Task 1's validator**, and refuses loudly on mismatch.
**Test:** a tampered definition is refused and the refusal is visible on screen.

### Task 7 — Drafts, so a half-finished interview is never uploaded
A separate local `drafts` table. Finishing a form moves it into `submissions` in one transaction. The uploader never sees drafts.
**Test:** fill half a form, run the uploader, assert **nothing** reached the server and the draft survived the app being killed.

### Task 8 — Sync that puts the worker first
Upload runs **before** download. Every remote call has a deadline. Network failure is distinguished from server rejection. Blocked rows keep retrying.
**Test:** make the forms download *hang* rather than throw, and assert the upload still completed.

### Task 9 — Linking answers to editions, safely
The foreign key from `submissions` to `(form, edition)`, **with a backfill in the same migration** for rows that already exist, and `rls.sql` updated in the same commit.
**Test:** the migration applies to the live database and the wall test still passes, on the first push.

### Task 10 — Authoring without a builder
Forms are written as definition files in the repository. CI runs the validator over them, so the author gets the same refusals at the same moment — with no interface to build.
**Test:** CI refuses a deliberately broken definition file.

### Task 11 — Proving it on a real phone
One end-to-end run on the A03s: publish an edition, receive it offline, answer it, sync.

---

## Deliberately not building

The form builder interface · photographs and signatures · calculated fields stored as data · answer lists in their own table · typed formulas for anyone · a retire button · reachability analysis · importing ODK or Kobo files.

We borrow ODK's **names** for question types so importing stays possible later at no cost today. We do not adopt its file format: that is XML with a formula language, which means shipping a parser and an expression engine to a 3.7 GB phone.

---

## Process changes, from what Phases 0 and 1 cost

1. **A test that cannot fail is worse than no test.** Break it once deliberately, watch it go red, restore it, and date the file.
2. **Any behaviour that could lose a worker's work needs a test that runs without a device.** Phase 1's worst bug survived because the only check was a person tapping a button and believing what he saw.
3. **Never `command | tail && echo OK`.** It reports the exit code of `tail`. It printed OK over a genuine failure.
4. **A design that is all-or-nothing must be checked against the cheapest phone, not the test phone.** The fingerprint fault shipped because the A03s happens to have a sensor.
5. **Claims about scheduled jobs say "ran once on demand" until a schedule has actually fired.**
