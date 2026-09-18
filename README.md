# Obhijatra

**A free, all-in-one platform for nonprofit organisations.** Learning, records,
forms, tasks and reporting — in one app that works with no internet, on cheap
Android phones, in Bangla and English.

Built and maintained by **Aninda S Howlader** ([@GRU953](https://github.com/GRU953)).

---

## What it does

- **Collect data in the field with no signal.** Fill in forms offline for days;
  everything syncs by itself when a connection appears.
- **Follow a person's whole journey.** Every screen and every export shows one
  complete line per person per programme.
- **Build forms without coding.** Fourteen question types, skip logic,
  validation, repeating sections, two languages, and scored quizzes.
- **See it live.** Real-time reports and dashboards for managers.
- **Keep it safe.** The database on the phone is locked with 256-bit encryption
  and opened by a fingerprint or PIN.

## What it costs to run

**Nothing, for a small organisation.** Google Play charges US$25 once, ever.
Everything else runs on free tiers. Around 250,000 stored form submissions —
roughly two years for an organisation of 200 staff — the server plan moves to
about US$25 a month.

## Running it on your own machine

This project keeps its tools in a sandbox so nothing is installed system-wide.

```bash
source /Users/aninda/Claude/sandbox/env.sh   # Java and the Android tools
npm install
npm run check                                 # types, safety rules, tests
npm run dev                                   # open the website locally
```

To build and install the Android app on a phone plugged in by USB:

```bash
source /Users/aninda/Claude/sandbox/env.sh
npm run build && npx cap sync android
cd android && ./gradlew installDebug
adb shell am start -n org.obhijatra.app/.MainActivity
```

## If something stops working

**Check this first.** The free database service pauses a project after **7 days
without use**. If the app suddenly cannot reach the server, that is by far the
most likely cause — far more likely than a bug. Open the Supabase dashboard and
press **Restore**. An automatic job pings it twice a week to prevent this, so it
should not happen, but it is always the first thing to check.

To see what an Android phone is actually reporting:

```bash
source /Users/aninda/Claude/sandbox/env.sh
adb logcat | grep -i obhijatra
```

## How the code is written

Every file starts with a plain-English comment explaining what it is for, what
it needs, and what it gives back — readable by someone who does not code. This
is a rule, not a courtesy: it is checked in review.

## Licence

[AGPL-3.0](LICENSE). You may use, change and share this freely. If you run a
changed version as a service for others, you must share your changes too — so
that improvements to a tool for nonprofits stay available to nonprofits.
