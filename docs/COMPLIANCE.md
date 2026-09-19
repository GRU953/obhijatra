# Compliance notes

Last reviewed: 19 September 2026.

## Who processes what, and where

| Who | What they hold | Where |
|---|---|---|
| **Supabase** | The main database: people, submissions, forms, roles | Singapore |
| **Cloudflare R2** | Photos and lesson files; one backup copy | Global |
| **Backblaze B2** | A second backup copy | United States |
| **GitHub** | The code, and a third backup copy | United States |

This list must stay accurate. It belongs in any privacy notice an organisation
using Obhijatra publishes.

## Bangladesh data protection

The **Personal Data Protection (Amendment) Ordinance 2026** (Ordinance No. 23 of
2026, promulgated 5 February 2026) **narrowed** the data localisation rule. An
in-country copy is required for *restricted* personal data and for Critical
Information Infrastructure — **not** for general or confidential personal data
on foreign cloud services. On that basis Obhijatra does not require a
Bangladeshi server for the data it holds.

**However:** national ID, passport and TIN numbers, biometric and genetic data,
and criminal records are treated as sensitive for cross-border purposes, and
sending them outside Bangladesh needs government approval.

> **Standing rule: Obhijatra never collects national ID numbers.** Participants
> are identified by an internal participant code. If a funder requires
> de-duplication against national ID, store a salted hash — never the number —
> and never sync that field to phones.

Full enforcement machinery activates around 13 May 2027. Any organisation
running Obhijatra with genuinely sensitive programmes should take Bangladeshi
legal advice before a pilot, not before an audit.

## What this system cannot resist

Section 24 of the Ordinance permits authorities to override protections on
grounds of national security, public order or crime prevention, with no defined
necessity test and no judicial oversight, and the regulator sits within the
Prime Minister's Office.

**Obhijatra cannot resist a lawful order, and is designed accordingly.** The
defence is minimisation: data never collected cannot be compelled. Protection,
gender-based-violence and health programmes are walled off by default. Exact
location, phone numbers and free-text protection notes are not centralised
unless a specific programme genuinely needs them.

## How long data is kept

Default: **three years after a person's last contact** with a programme,
adjustable per dataset by an administrator. Backups run on a rolling window so
that a deletion completes everywhere rather than surviving forever in copies.

## Encryption export notice

The SQLite plugin links **SQLCipher** — even for databases that are not
encrypted. SQLCipher is subject to US Encryption Export Regulations, and
distributing an app that contains it **may require an annual self-classification
report to the US government**.

Action: check this before the first public Play Store release.
Reference: <https://discuss.zetetic.net/t/export-requirements-for-applications-using-sqlcipher/47>

## Web headers still to set

`frame-ancestors 'none'` cannot be delivered in a page's own markup — browsers
ignore it there and warn. It must be sent as an HTTP header by whatever serves
the website. Set it when the website is first deployed, alongside
`Strict-Transport-Security` and `X-Content-Type-Options: nosniff`.
