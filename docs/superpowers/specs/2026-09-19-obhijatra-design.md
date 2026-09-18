# Obhijatra — Design

**Version:** 1.0 · **Date:** 19 September 2026
**Owner, sole developer and contributor:** Aninda S Howlader (GitHub: GRU953)

---

## 1. What Obhijatra is

A free platform that lets a nonprofit organisation run its work from one app: teach and
test its staff and volunteers, register and follow the people it serves, collect data in
the field with no internet, manage its tasks, events and projects, and see all of it in a
live dashboard.

It runs on cheap Android phones offline, and in a web browser for office staff. Everything
— forms, roles, reports, dashboards, translations — is built through the screen, with no
coding.

---

## 2. Every decision, and why

Fifteen decisions were made across five interview rounds on 19 September 2026, informed by
twelve expert panels researching 2026 primary sources, and by three adversarial reviews
that returned "needs rework" and forced four of the panels' own recommendations to be
reversed.

### Scope

| # | Decision | Reasoning |
|---|---|---|
| 1 | **Many organisations, built in from day one** | Every record carries its owning organisation from the first commit. Retrofitting this touches every table and every query. |
| 2 | **Thin end-to-end slice first** | Prove offline sync and no-code forms work before building anything on top of them. |
| 3 | **Bangla + English from the first screen** | Script, font, date and numeral handling break when retrofitted. |
| 4 | **Build our own, not a front door on existing tools** | DHIS2, ODK and Kolibri each solve part of this free — but running two or three servers you cannot repair is beyond a solo non-technical owner, and breaks the near-zero cost goal. We copy their proven patterns, not their infrastructure. |

### Foundations

| # | Decision | Reasoning |
|---|---|---|
| 5 | **Build our own sync — no sync vendor** | Verified: PowerSync's free tier caps at **50 concurrent clients** and its first paid step is **$49/month**. One nonprofit with 60 staff syncing at day's end breaks it immediately. Its Capacitor SDK also states plainly that *"Encryption for native mobile platforms is not yet supported"* — so it could not deliver the locked phone database at all. Dropping it also removes a `BYPASSRLS` database role that bypasses the wall between organisations, removes a fourth company holding a continuously updated readable copy of every beneficiary record, and makes the ten-year portability promise literally true. |
| 6 | **TypeScript + React, wrapped by Capacitor** | One codebase that *is* the website directly and also becomes a real Play Store app with a locked SQLite database and fingerprint unlock. Written in the language Claude handles most reliably, which matters more than anything else when the owner cannot read code. |

### Data

| # | Decision | Reasoning |
|---|---|---|
| 7 | **Store each answer separately; assemble one row per person on demand** | PostgreSQL has a hard ceiling of **1,600 columns** that no setting can raise, and deleted columns still count — so merely experimenting with forms permanently burns capacity. SQLite warns its query planner slows with the *square* of the column count. DHIS2, CommCare, OpenMRS and OpenSRP all store answers separately and assemble the wide view for reports. The owner gets the single line per person on every screen, dashboard and export. |
| 8 | **Configurable over a fixed set of record types** | Forms, fields, validation rules, roles, permissions, reports, dashboards, translations and workflows are all editable on screen — over people, submissions, tasks, events, courses and organisations. Salesforce, the largest no-code platform in existence, deliberately refuses to create real database structure at runtime; there is no safe way to push a structure change to a phone switched off in a village holding unsent work. |
| 9 | **Fourteen question types plus logic** | Text, number, date, time, single choice, multiple choice, searchable list, photo, location, signature, barcode, rating, note, calculation — plus skip logic, validation, repeating sections, two-language labels and a scored quiz mode. ODK has had a funded team since **2008** and still scores **0%** on its own published chart for the group containing offline use, drafts and submission encryption. Full parity guarantees an unfinished product. |

### Protecting people

| # | Decision | Reasoning |
|---|---|---|
| 10 | **Authenticator codes for office roles; phone locks for field workers** | Supabase's SMS second step is **$75/month** (~BDT 110,000/year) before a single message is sent; authenticator codes are free on every plan. Field evidence (Microsoft Research India, ACM COMPASS 2022, 30 participants) found **23 of 30** could not create an account unaided — so an authenticator app is beyond a first-time smartphone user. The extra step goes where the danger is: someone signing in from a laptop anywhere in the world. |
| 11 | **A separate locked space per person on shared phones** | Android's fingerprint system returns only pass or fail — **the app is never told which enrolled finger matched**. Without separate spaces, a supervisor signing in once leaves their wider access on a junior's handset permanently, and "who saw this record?" has no answer. |
| 12 | **Retention: a set period, adjustable per dataset** | Default ~3 years after last contact. Bangladesh's Act grants a right to erasure and to withdraw consent. Backups run on a rolling window so a deletion genuinely completes rather than surviving forever in copies. |

### Longevity

| # | Decision | Reasoning |
|---|---|---|
| 13 | **Personal Google Play account** | Owner's decision. Consequence: before public listing, **12 testers on 12 phones, opted in continuously for 14 days**, then a review. The clock restarts if a tester drops out. Private testing reaches 100 phones immediately, so the pilot is unaffected. Tester recruitment is scheduled ahead of launch, not discovered at the end. |
| 14 | **Open source from the start** | The cheapest available insurance against the project dying with its author, plus unlimited free build minutes. Requires an automatic check that refuses any commit containing a password. |
| 15 | **Helper-led setup, then self-serve** | The same field research says recall fails after any gap in use. Redirects ~60–100 hours from tutorials that forgetting defeats into a flow matching how nonprofits already work. First screen asks: *"Setting up your own phone, or helping someone?"* |

### Settled on evidence, without troubling the owner

- **Server data at rest is encrypted** — Supabase applies AES-256 always, on every plan, with no switch to disable it. Requirement 6's "unencrypted on the server" was never actually available; what it meant in practice — *readable by our own queries so dashboards work* — is exactly what we get.
- **National ID numbers are never collected.** Sending them abroad requires government approval under Bangladesh's Act. An internal participant code is used instead; if a funder demands de-duplication, a salted hash, never the number, and never synced to phones.
- **Protection, GBV and health programmes are walled off by default**, not as an option.
- **Phones lock after 14 days** without checking in — an administrator-adjustable setting, unsent work exempt, counted on a clock a thief cannot wind back by changing the date.
- **An access log** records who exported or bulk-viewed which records. It cannot be reconstructed later, so it is built in Phase 3.
- **Backups begin in week one**, not at the end. The free plan keeps none.
- **A keep-alive job** pings the server twice weekly. Free Supabase projects pause after **7 days** of inactivity — an entire class of phantom failure removed for about an hour's work.

---

## 3. How it is built, in plain language

**One set of screens, two homes.** The screens are written once, in TypeScript and React.
Opened in a browser, they *are* the website. Wrapped by Capacitor, the same screens become
a real Android app with a locked database and fingerprint unlock.

**The phone holds an ordinary, locked SQLite database.** Ordinary means any tool could open
it in 2036. Locked means SQLCipher, with the key generated at random, held in the phone's
own security chip, and released by a fingerprint or PIN. **The PIN never becomes the key** —
six digits is a million possibilities, which a laptop tries in seconds once the file is
copied off the phone. The phone's security chip is what makes a 6-digit PIN safe, and that
protection does not travel with a copied file.

**The server is an ordinary PostgreSQL database.** Ordinary means it can be lifted to any
other host on any weekend. This, not any supplier's promise, is what actually delivers the
ten-year requirement.

**Sync is ours, and it is simple because the data is simple.** Almost everything is form
answers, and a submitted answer never changes — that is how ODK and KoboToolbox work. So
sync is three small flows, not a general-purpose engine:

1. **Submissions go up.** The phone holds a queue of what has not been sent. It sends them,
   the server confirms, the phone marks them done. Nothing to reconcile, because nothing changes.
2. **Settings come down.** Forms, roles and translations travel to phones as ordinary
   information, never as changes to the database's shape. A phone offline for six weeks
   needs no repair when it returns.
3. **The few things that do change** — a person's phone number, a task's status — merge
   field by field with a timestamp, so two workers editing different facts about the same
   person cannot erase each other.

**Files** — photos, lesson audio — go to Cloudflare R2, the one mainstream option where a
course becoming popular does not produce a bill.

**Design** follows Material 3's published rules, written down once by us as a short list of
colours, text sizes, spacing and corner shapes that both the app and the website read.
Google's own web implementation of Material has been **unmaintained since June 2024**, so it
cannot be depended on; our own copy of the values cannot be discontinued out from under us.

---

## 4. The single row per person

The owner's requirement, delivered exactly — as the thing you see, not as the storage shape.

- Each form answer is stored as its own small record, tagged with who, which programme,
  which form version, and when.
- Every screen, dashboard, download and Excel export **assembles one complete line per
  person per programme on demand**, with a second sheet one click away for session-by-session detail.
- The column order in exports never shifts between runs.
- There is **no ceiling** on how long a person's journey grows, and adding a question never
  changes the database shape on any phone.

---

## 5. What it costs — verified, not estimated

| Item | Verified price | Year 1 |
|---|---|---|
| Supabase — Free plan | $0 · 500 MB database · pauses after 7 days idle · **no backups** · max 2 projects | **BDT 0** |
| Cloudflare R2 — files | 10 GB free, no charge for downloads | **BDT 0** |
| Backblaze B2 — second backup | 10 GB free | **BDT 0** |
| GitHub Actions | Unlimited for open projects | **BDT 0** |
| Google Play | **$25 once**, ever | **~BDT 3,050** |
| Domain name (optional) | ~$12/year | ~BDT 1,500 |
| **Total year one** | | **~BDT 3,000–4,600** |
| **Total year two onward** | | **BDT 0–1,500** |

**When this stops being free.** Supabase's free database is 500 MB. A form submission is
roughly 2 KB, so that is on the order of **250,000 submissions** — around two years for one
organisation of 200 staff. After that, Supabase Pro at **$25/month (~BDT 36,600/year)**.

For comparison, the stack the panels originally recommended would have cost roughly
**BDT 109,000/year** from the first real organisation, because PowerSync's free tier breaks
at 50 concurrent clients. Building sync ourselves is the single decision that keeps
requirement 8 honest.

**The unavoidable annual chore:** Google Play requires every app to target a newer Android
version each year. At least one release a year is mandatory, forever. Budget 15–25 hours
each July.

---

## 6. Build phases

**Confirmed 19 September 2026: the owner will give 25–40 hours a week.** At that rate,
phases 0–5 complete in roughly **5–7 months**. The figure is recorded rather than assumed
because the research on nonprofit technology is blunt that the biggest risk is not a broken
framework — it is the one person driving it stopping, and a plan built on an unstated
assumption is how that happens quietly.

### Phase 0 — Foundations that cannot wait *(1 week)*
Sandbox toolchain **(done — Java 21 LTS, Android SDK 36, adb, 853 MB, nothing system-wide)**.
Public repository with licence, plain-English code standard, and an automatic check that
**refuses any commit containing a password**. Supabase project with a twice-weekly keep-alive
job. **Nightly encrypted backups to three independent places from day one.** Crash reporting.
A release pipeline that puts every build one tap from a real phone.

> *Moved here from Phase 5 on the adversarial reviewer's finding: phases 1–4 would otherwise
> run 21–31 weeks with no backups at all, and a three-month gap in the owner's life would
> destroy everything built.*

### Phase 1 — Walking skeleton *(4–6 weeks)*
One worker signs in with a PIN and fingerprint, opens one hard-coded form, fills it on a
real cheap Android phone **in aeroplane mode**, and the answer lands in a genuinely locked
database. Signal returns; it syncs itself; the same record appears in a browser.

Also in Phase 1, because they are cheap now and expensive later:
- **Two organisations and a deliberate attempt to read across them, which must fail.**
- **One automated end-to-end test on every save** — sign in, fill offline, sync, see the row.
- **The three guard rules enforced by a robot, not by memory:** every administrator-written
  word renders as plain text only; skip logic is a described rule the app reads, never code
  the app runs; and a strict content policy on the app's browser view. This closes the one
  real weakness of the chosen toolkit — a hostile form label reaching the phone's data —
  by making it impossible to breach by accident.

**Exit criterion:** it works on a real phone in a real village with one real worker. If it
does not, we switch to Flutter having lost weeks, not years — every other decision here is
unchanged either way.

### Phase 2 — Form builder and form versions *(6–10 weeks)*
The no-code designer: fourteen question types, skip logic, validation, repeating sections,
searchable choice lists, two-language labels, scored quizzes. Every published form frozen as
a numbered version, every answer recording which version it was collected under — because
without that, an administrator deleting a question silently erases years of evidence.

### Phase 3 — People, roles, device safety, access log *(6–8 weeks)*
Staff and participant register. A "possible same person" review queue. Six ready-made roles.
One written list of who-sees-what that generates both the permission rules and what each
phone downloads, so they cannot drift apart. The separate locked space per person on shared
phones. The 14-day lock. The append-only access log.

### Phase 4 — Reports, the one-line-per-person view, dashboards *(5–7 weeks)*
The assembling step that delivers requirement 14 as you asked to see it. Prepared reports
with filters. Excel and CSV export with a stable column order. Indicator definitions with
targets, defined once so the manager's dashboard and the funder's report can never disagree.

### Phase 5 — Pilot hardening and first release *(3–4 weeks)*
The helper-led setup flow. Read-aloud audio — but **only after testing whether the free
built-in Bangla voice actually exists on three real entry-level handsets (Symphony, Walton,
Redmi)**, because committing 15–25 hours of recording to an untested assumption is how
budgets disappear. Accessibility pass with a real screen reader. Tester recruitment for the
12-person, 14-day Play requirement.

### Phase 6 — The second module, and only what the pilot asked for *(8–12 weeks, or far less)*
Whichever of learning, activity, event or project management was not built first — assembled
from the form engine and people register already in place. Plus deferred extras (photos,
live polling, certificates, ODK import) **only where a real pilot organisation asked**, in
the order they asked. That log, not the original requirements, is the specification.

---

## 7. What we are deliberately not building

Applying requirement 15 (YAGNI) honestly:

- Users inventing brand-new record types.
- Full ODK / KoboToolbox / Slido feature parity.
- An offline-capable website. Browsers have no security chip, Safari's private mode cannot
  store a database at all, and Chrome's errors past 100 MB. The website is the online tool
  for office roles; the app carries offline.
- Pixel-identical layouts across a phone and a monitor. A phone layout on a manager's screen
  falls below both Android's 48 dp and WCAG's 24 px minimum tap targets — an accessibility
  failure, not a preference. Identical *design language, components, pictures and wording*;
  layouts adapt.
- iOS, until Android and web are real.
- Monitoring dashboards, staging environments, container setups — until something hurts.

---

## 8. Risks, stated honestly

| Risk | Honest assessment |
|---|---|
| **Sync bugs stall the project** | The most likely technical failure. Mitigated by keeping sync to three simple flows over immutable data, by `adb` giving readable errors in 60 seconds instead of blind 15-minute cycles, and by Claude being able to read every line — which would not be true of a vendor's engine. |
| **The owner stops** | The largest risk of all, per the development literature. Mitigated by open source from day one, backups two people can restore, plain-English explanations throughout, and ordinary PostgreSQL and SQLite that any developer could pick up. |
| **Free tiers change their terms** | Real and recent: Oracle halved its free compute in June 2026 without announcement; Xata and Fly.io removed free tiers entirely. Mitigated by owning nothing proprietary — ordinary Postgres, ordinary SQLite, settings as plain files, and a one-button export of everything in the first release. |
| **A leak harms a beneficiary** | Bangladesh's Section 24 grants a broad national-security override with no judicial test, and the regulator sits within the Prime Minister's Office. **This system cannot resist a lawful order**, and is designed accordingly: no national IDs, sensitive programmes walled off by default, and minimisation before encryption — because data never collected cannot be compelled. |
| **The calendar outruns the enthusiasm** | Phases 0–5 total **25–36 working weeks** to first release (Phase 6 is beyond that, and its length is set by what the pilot actually asks for). At the owner's confirmed 25–40 hours a week that is roughly **5–7 months**; at 10 hours a week it would be 14–20 months. The counter is that something real is in a real worker's hands at the end of **Phase 1** — around week 5–7 — not at the end of Phase 6. |

---

## 9. Status and the remaining open question

**Approved 19 September 2026.** Effort confirmed at 25–40 hours a week. Phase 0 begins.

**The one thing still open: no pilot organisation is formally agreed.** One is likely but
nothing is signed. This matters more than it looks, because Phase 6's specification is
defined here as *"a written log of what the pilot organisation actually asked for"* — and
without a real organisation there is no such log, so Phase 6 would be guesswork.

Two consequences, applied from now:

1. **Phase 1 is built to be demonstrable on a single phone**, so the owner has something
   real to show a prospective partner rather than a description of an idea.
2. **The oldest Android version supported stays undecided** until someone surveys what
   phones a real organisation's staff actually carry. The panels split three ways on this
   (as wide as possible / Android 10 / Android 8, the floor ODK Collect itself adopted in
   2026). It should be measured, not argued. Until then the build targets Android 8 and up
   and the question stays open.
