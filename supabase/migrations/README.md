# Supabase migrations

Two artifacts, two jobs:

- **`../schema.sql`** — a human-readable snapshot of the *current* database state
  (tables, RLS, functions index, realtime). Reconstructed 2026-07-22; if you ever
  run `supabase db dump --schema public -f supabase/schema.sql`, prefer that output.
- **`migrations/NNNN_*.sql`** — the forward-only history of changes, in order.
  Replaying 0000 → 0005 on an empty project reproduces the database. Each file is
  idempotent (guards / `if exists`) so re-running is safe.

## Workflow

1. Write a new `NNNN_description.sql` here.
2. Review it, apply it to the DB (Supabase SQL Editor).
3. Update `../schema.sql` so the snapshot stays truthful.

## History

- `0000_baseline.sql` — RECONSTRUCTED pre-existing state (all 11 original tables,
  original RLS on the first four, realtime publication). Inferred details are
  flagged inline. Never "applied" — it documents what already existed.
- `0001_rls_hardening.sql` — ✅ applied. RLS on the 7 previously-unprotected tables
  (6 default-deny; `move_joins` gets a realtime SELECT policy) + Avatars storage
  write-scoping (storage schema — not covered by a `--schema public` dump).
- `0002a_counter_rpcs.sql` — ✅ applied. Atomic event-counter RPCs
  (impressions / clicks / brought-over).
- `0002b_interested_trigger.sql` — ✅ applied. Trigger + reconcile so
  `interested_count` always mirrors `move_interested`.
- `0003_zip_codes.sql` — ✅ applied. zip_codes table + earth index +
  nearby_zips / nearest_zip; seeded via `scripts/seed-zipcodes.mjs` (~42k rows).
- `0004_rate_limits.sql` — ✅ applied. rate_limits table + rate_limit_hit RPC
  (fixed-window, fails open in app code).
- `0005_get_feed.sql` — ✅ applied. get_feed(viewer) returns the entire /api/feed
  payload in one query; parity-verified against the old route logic
  (`scripts/check-feed-parity.mjs`, 0 diffs).
