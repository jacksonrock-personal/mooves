# Supabase migrations

Two artifacts, two jobs:

- **`../schema.sql`** — a human-readable snapshot of the *current* database state
  (tables, RLS, functions index, realtime). Reconstructed 2026-07-22; if you ever
  run `supabase db dump --schema public -f supabase/schema.sql`, prefer that output.
- **`migrations/<timestamp>_*.sql`** — the forward-only history of changes, in order.
  Each file is idempotent (guards / `if exists`) so re-running is safe.

## Workflow

Migrations go through the CLI, from tracked files. Do not paste SQL into the
Supabase SQL Editor — that applies a change without recording it in the migration
history, which is how the database and this directory drift apart.

```bash
npm run db:new  add_some_thing   # scaffold a timestamped file
npm run db:list                  # show local vs remote, confirm what's pending
npm run db:push                  # apply everything not yet applied
```

No database password is needed: `supabase link` caches an IPv4 pooler URL and the
CLI provisions a temporary login role from your access token. If commands start
failing, re-run the link and they should recover:

```bash
npx supabase link --project-ref ugsyqmsmmbcuafmtyknj
```

Two failure modes worth recognising, both hit during setup on 2026-07-27:

- **"Cannot find project ref. Have you run supabase link?"** — `.temp/project-ref`
  is missing. That is the file the CLI reads; `.temp/linked-project.json` is
  written by the MCP server and the CLI ignores it.
- **"failed to parse environment file: .env.local"** — the CLI auto-loads
  `.env.local`, and a UTF-8 BOM at the top breaks it. PowerShell's `>`, `>>`, and
  `Out-File` add one by default. Write env files with `-Encoding utf8NoBOM`, or
  strip it with `tail -c +4`.

Then update `../schema.sql` so the snapshot stays truthful.

### One-time bootstrap (2026-07-27)

The remote history table only ever recorded two migrations, because everything
else was applied by hand through the SQL Editor. Every already-applied migration
is marked as such — without re-running any of it — with:

```bash
npx supabase migration repair --linked --status applied 20260722112420 20260722112424 20260722112425 20260722112426 20260722114128 20260722114556 20260722120643 20260722222736 20260723182409 20260723234150 20260727140000
```

After that, `npm run db:list` should show every migration applied on both sides
and `npm run db:push` should report nothing pending. Once that's true, the CLI is
the only path that needs to be used again.

### Why this matters

`CREATE OR REPLACE FUNCTION` **overwrites — it does not merge.** If you rebuild a
function from an older copy of its body, every change made in between is silently
reverted, and nothing errors. That is exactly what happened to `get_feed`:
0008 rebuilt it from 0005's body to add the `wave` field and dropped the expiry
filter 0006 had added, so expired greens rendered on the feed for five days.

Before redefining an existing function, diff against what is actually deployed:

```bash
# source of truth — not the newest migration file, the live database
psql "$DATABASE_URL" -c "\sf public.get_feed"
```

## Version numbering

Filenames are `YYYYMMDDHHmmss_name.sql` — the format the CLI requires. Files were
renamed from an earlier `NNNN_` scheme on 2026-07-27; `../schema.sql` still refers
to migrations by those short numbers, so the mapping is:

| was     | is now                                        | status |
| ------- | --------------------------------------------- | ------ |
| `0000`  | `20260722112420_baseline.sql`                 | never applied — documents pre-existing state |
| `0001`  | `20260722112424_rls_hardening.sql`            | ✅ applied |
| `0002a` | `20260722112425_counter_rpcs.sql`             | ✅ applied |
| `0002b` | `20260722112426_interested_trigger.sql`       | ✅ applied |
| `0003`  | `20260722114128_zip_codes.sql`                | ✅ applied |
| `0004`  | `20260722114556_rate_limits.sql`              | ✅ applied |
| `0005`  | `20260722120643_get_feed.sql`                 | ✅ applied |
| `0006`  | `20260722222736_green_expiry.sql`             | ✅ applied |
| `0007`  | `20260723182409_green_wave.sql`               | ✅ applied |
| `0008`  | `20260723234150_green_wave_refine.sql`        | ✅ applied |
| `0009`  | `20260727140000_get_feed_expiry_restore.sql`  | ✅ applied |

Timestamps come from each file's first commit, nudged by seconds where commits
collided or landed out of order. The 0006 and 0008 timestamps are exact: they are
the versions those migrations already carry in the remote history table.

## History

- `baseline` — RECONSTRUCTED pre-existing state (all 11 original tables,
  original RLS on the first four, realtime publication). Inferred details are
  flagged inline. Never "applied" — it documents what already existed.
- `rls_hardening` — RLS on the 7 previously-unprotected tables
  (6 default-deny; `move_joins` gets a realtime SELECT policy) + Avatars storage
  write-scoping (storage schema — not covered by a `--schema public` dump).
- `counter_rpcs` — Atomic event-counter RPCs (impressions / clicks / brought-over).
- `interested_trigger` — Trigger + reconcile so `interested_count` always mirrors
  `move_interested`.
- `zip_codes` — zip_codes table + earth index + nearby_zips / nearest_zip;
  seeded via `scripts/seed-zipcodes.mjs` (~42k rows).
- `rate_limits` — rate_limits table + rate_limit_hit RPC (fixed-window, fails open
  in app code).
- `get_feed` — get_feed(viewer) returns the entire /api/feed payload in one query;
  parity-verified against the old route logic (`scripts/check-feed-parity.mjs`, 0 diffs).
- `green_expiry` — users.status_expires_at + get_feed hides expired greens (9.5 Part A).
- `green_wave` — green_wave_candidates for the wave push path.
- `green_wave_refine` — wave_group_for_viewer + `wave` field on get_feed.
  ⚠ Also silently reverted `green_expiry`'s filter — see *Why this matters*.
- `get_feed_expiry_restore` — restores that filter. Any future redefinition of
  `get_feed` must carry it forward.
