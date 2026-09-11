# Community Mooves — the seeding routine (Phase 24.9, R33)

Runs as a **scheduled Claude Code cloud routine**, **hourly at :07**, on the
existing subscription. **No metered Anthropic API.** That is a hard constraint,
not a preference — the whole design below follows from it.

**Hourly is the tick, not the pull rate.** Each metro is still pulled **once per
UTC day**; `/api/ingest/metros` hands back only the metros that are actually due,
so 23 of every 24 runs get an empty list and stop immediately. The hourly tick
exists for one reason: metros now create themselves when a user sets an area
(R33), and a brand-new metro should not wait up to 24 hours for its first
content. See **The queue** below.

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
> **If `metros` is empty, you are done. Stop and report "nothing due".** This is
> the normal outcome of most runs and it is not a failure — the endpoint returns
> only metros that have not already been pulled today. Do not search anyway, and
> do not go looking for metros by other means.
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

**Incremental window.** Day one needs seven days. After that, most of the window
is already covered, so a run searches `RESCAN_DAYS + 1` near days plus the single
day that just entered the horizon.

⚠ **Earlier versions of this file claimed a "six-sevenths" saving. That was
wrong.** At `RESCAN_DAYS = 2` a run covered four days out of seven — about 43%.
It is now **1**, so three days out of seven, roughly a 57% saving. The number was
repeated in three commit messages before anyone checked the endpoint's actual
output.

**Cadence is the bigger dial, and it is why this runs once a day.** At 3× daily,
runs two and three searched the same window as run one against a `known` list
that had just grown, and reliably found nothing. Events are not announced on an
eight-hour cycle. Once daily also makes the incremental design *correct* rather
than merely cheaper: exactly one new day enters the horizon per day, so
`newlyEnteredDay` now lines up one-to-one with runs.

**A missed run costs more now.** The newly-entered day is only offered on the day
it enters, so a failed run leaves a hole no later incremental window goes back
for. `FULL_RESCAN_MS` therefore dropped from 7 days to **3**: one missed run
self-heals within a couple of days instead of sitting there most of a week.

**Fingerprints, not descriptions.** `known` is title + venue only — enough to
recognise, cheap enough to send. Without it the routine re-discovers every
recurring Thursday trivia night, every day, forever.

**Metros, not zips.** 60647 and 60622 are two miles apart and share the same
inventory. The job scales with cities (tens), not users (thousands) — but it
*does* scale with cities. Each metro is one search and one write per day, so the
daily cost is linear in the number of metros that exist. That is the number to
watch, and it is why the answer to "seed the whole country" is no: there are
31,575 distinct city/state pairs in `zip_codes`, and even the ~380 real MSAs
would be roughly 95× today's spend to serve, at the time of writing, eleven
people.

## The queue (R33)

`/api/ingest/metros` used to return **every** metro on **every** run. Its header
comment had claimed "staleness + the on-demand queue" since 24.9 and no such
filter existed. It now returns a metro only when:

- it has **not** pulled successfully since the start of the current **UTC day**, and
- it was not handed out in the last **2 hours** (`RETRY_AFTER_MS`)

Being handed out stamps `metros.last_attempted_pull`; completing the POST stamps
`last_successful_pull`. Two columns, because one cannot answer both questions: a
run that takes the work list and then dies never stamps success, and without the
attempt stamp it would be re-handed the same metro every tick — 24 searches a
day for the metro that is already failing.

**Why the UTC day and not a rolling 24 hours.** The incremental window offers
`newlyEnteredDay` exactly once, on the day that day enters the horizon, so the
whole scheme is only correct if pulls land one per calendar day. A rolling
interval does not give you that — at 24h the pull time walks an hour later each
run until it crosses midnight and a day is offered twice; at 23h it walks earlier
and a day is skipped. Calendar anchoring makes "one new day per run" true by
construction.

## Metros create themselves (R33)

`POST /api/users/area` calls `ensure_metro_for_zip(zip)` after writing
`users.area_zip`. If nothing covers that zip, it creates the metro from the zip's
own city/state/centroid and claims every zip within 30 miles — one function, one
transaction, so a half-created metro is not a reachable state.

This replaces running `scripts/seed-metros.mjs` by hand, which is what everyone
had been relying on and which went **five weeks** un-run (2026-08-03 → 09-11).
Every user who set an area in that window sat in an uncovered zip with a
permanently empty Discover feed, and nothing anywhere reported it:
`last_successful_pull` was green the whole time for all four metros that existed,
because the failure was in the metros that *did not exist*. No timestamp can go
stale on a row nobody inserted.

The script remains, as the bulk-repair tool — it is still the only thing that
re-derives the whole list from scratch or widens an existing metro's claim after
a radius change.

**New metros are exempt from the thin alarm** until their first successful pull.
They are born with zero upcoming moves by definition, and an alarm that fires on
every creation is an alarm people write a filter for.

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
  console shows it. Staleness is visible without alerting infrastructure — and at
  3 days of staleness the next run widens to a full seven-day scan by itself.
- ~~**Nothing goes live unreviewed.**~~ **No longer true, and deliberately so.**
  R27 inverted this: a seeded row that clears every check in the ingest route
  publishes immediately with `reviewed_at = NULL`, which lands it in the admin
  console's audit list — live, but flagged as never looked at. The review gate
  went unstaffed from 2026-08-04, 386 rows piled up, every metro ran dark for
  fifteen days, and nothing errored, because an empty queue and an ignored queue
  look identical from outside. An unstaffed gate does not filter bad content, it
  filters *all* content. Sponsor-authored moves keep the real gate; `origin` is
  the boundary.

## Review

There is **no new review UI**. Since R27, seeded moves publish on arrival and
appear in the admin console's audit list as `reviewed_at = NULL` — live, flagged
as never looked at. The human pass still happens; it just stopped being the thing
standing between a real event and the feed. At 5–10 per metro per day against the
quality bar above, that is a few minutes daily. If it ever feels like a queue,
the prompt's filter is too loose — do not fix it by reviewing faster.
