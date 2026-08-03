# Community Mooves — the daily seeding routine (Phase 24.9)

Runs as a **scheduled Claude Code cloud routine**, 3× daily, on the existing
subscription. **No metered Anthropic API.** That is a hard constraint, not a
preference — the whole design below follows from it.

The routine **never touches the database**. It searches, structures, and POSTs.
Validation, dedupe and persistence live in the app (`/api/ingest/*`), so the
logic stays versioned and testable and a half-finished run leaves nothing
broken.

## Setup (one time)

Set `INGEST_TOKEN` in Vercel **and** wherever the routine runs. Both routes
refuse outright (503) when it is unset, so nothing can be written by accident
before it is configured.

## The prompt

> You are seeding Community Mooves for the Mooves app.
>
> **1.** `GET {APP_URL}/api/ingest/metros` with `Authorization: Bearer {INGEST_TOKEN}`.
> You get back a list of metros, each with a `window` and a `known` array.
>
> **2.** For each metro, use web search to find real, public events inside that
> metro's window. `window.full` means search the whole 7 days; otherwise search
> only the next `toDays` days plus day `newlyEnteredDay`.
>
> **Skip anything already in `known`.** That list is title + venue for what we
> already have. Re-finding those costs tokens twice and produces rows that get
> thrown away.
>
> **3.** Every event must clear all five bars. Reject anything that misses one:
> - a fixed start date and time (not "open daily", not "check our socials")
> - a physical venue with a neighbourhood
> - open to the public, no membership or invite required
> - a **source URL** that actually lists it
> - **something you would plausibly bring three friends to**
>
> That last one is the Mooves-specific filter and it is the most important.
> Exclude solo activities, date-night things, and passive attendance. They are
> all fine events and all useless here.
>
> **4.** Return **5–10 per metro, at most**. **Returning zero is a correct
> answer.** If a city has a quiet week, say so. Do not pad to reach a number —
> filler goes straight into a human review queue and costs someone real time.
>
> **5.** `POST {APP_URL}/api/ingest/community-moves` per metro, same bearer:
>
> ```json
> {
>   "metroId": "<from step 1>",
>   "moves": [{
>     "title": "Trivia night at Emporium",
>     "description": "One line. Teams of up to six, no signup.",
>     "category": "nightlife",
>     "startAt": "2026-08-06T20:00:00-05:00",
>     "locationText": "Emporium Arcade Bar, 2363 N Milwaukee Ave",
>     "neighborhood": "Logan Square",
>     "priceText": "Free",
>     "isFree": true,
>     "sourceUrl": "https://emporiumchicago.com/events",
>     "imageUrl": null
>   }]
> }
> ```
>
> **6.** Report per metro: inserted, duplicates, and every rejection with its
> reason. If a metro returns zero rows two runs in a row, say so plainly — that
> usually means the search is failing, not that the city is empty.

## Why it is shaped like this

**Incremental window.** Day one needs seven days. Day two, six of those are
already covered and only the newly-entered day is new. A full re-scan runs when
a metro has gone a week without a successful pull. Roughly a six-sevenths saving
in steady state, and it is what makes running 3× a day affordable at all.

**Fingerprints, not descriptions.** `known` is title + venue only — enough to
recognise, cheap enough to send. Without it the routine re-discovers every
recurring Thursday trivia night, every day, forever.

**Metros, not zips.** 60647 and 60622 are two miles apart and share the same
inventory. The job scales with cities (tens), not users (thousands).

**Zero is valid, and it is stated twice.** Models pad to hit a number. If the
prompt implies 5–10 is expected you will get 5–10 regardless of whether the city
had anything on.

## Reliability, honestly

This gives up the retry and alerting semantics a real cron would have. Three
things stand in:

- **The ingest route is idempotent.** `dedupe_key` is UNIQUE and inserts ignore
  conflicts, so a double-run, a retry, or two overlapping schedules are no-ops.
- **`metros.last_successful_pull`** only moves when a run actually reached the
  database. If a metro stops pulling, that timestamp stops moving and the admin
  console shows it. Staleness is visible without alerting infrastructure.
- **Nothing goes live unreviewed.** Everything lands `pending` in the existing
  admin queue, so the worst a bad run can do is waste a minute of review.

## Review

There is **no new review UI**. Seeded moves are `sponsored_moves` rows with
`status='pending'`, so they appear in the existing desktop admin console
alongside sponsor submissions. At 5–10 per metro per day against the quality bar
above, that is a few minutes daily. If it ever feels like a queue, the prompt's
filter is too loose — do not fix it by reviewing faster.
