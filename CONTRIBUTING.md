# Contributing to Obhijatra

Obhijatra holds data about vulnerable people. These rules exist because of that,
not because of taste.

## The rules that are never bent

1. **Plain English in every file.** Each file opens with a comment a non-coder
   can read: what it is for, what it needs, what it gives back. Reviewed.
2. **Every table carries `organisation_id`.** One nonprofit must never be able
   to read another's records. There is a test that proves this; it must pass.
3. **Never collect national ID numbers.** Sending them outside Bangladesh
   requires government approval. Use the internal participant code.
4. **Administrator-written text renders as text, never as markup.** Skip logic
   is a rule the app reads, never code the app runs. Enforced automatically —
   `npm run lint` will refuse the change.
5. **The PIN never becomes the database key.** One strong random key lives in
   the phone's security chip; the PIN or fingerprint only releases it.
6. **No secret ever enters this repository.** A check refuses the commit. Put
   secrets in GitHub repository secrets and refer to them by name.

## Before you commit

```bash
npm run check    # types, safety rules and tests, all three
```

Tests come before the code that makes them pass. A change without a test that
would have failed before it is not finished.

## Commit messages

Say what changed and why, in plain sentences. No trailers, no attribution lines.
