# Supabase migrations

Two artifacts, two jobs:

- **`../schema.sql`** — a full snapshot of the *current* database state. Regenerate it
  from the live DB with `supabase db dump` whenever the schema changes. This is what
  you'd use to understand or reprovision the whole schema at a glance.
- **`migrations/NNNN_*.sql`** — the forward-only history of individual changes, in order.
  Each file is idempotent (guards / `if exists`) so re-running is safe.

## Workflow

1. Write a new `NNNN_description.sql` here.
2. Review it, apply it to the DB (SQL editor or `supabase db push`).
3. Regenerate `../schema.sql` so the snapshot stays truthful:
   ```
   supabase db dump --schema public -f supabase/schema.sql
   ```

## Applied so far

- `0001_rls_hardening.sql` — ✅ applied. RLS on the 7 previously-unprotected tables
  (6 default-deny, `move_joins` gets a realtime SELECT policy) + `Avatars` storage
  write-scoping. Storage policies live in the `storage` schema, so they're recorded
  here rather than in the `--schema public` snapshot.
- `0002a_counter_rpcs.sql` — pending. Atomic event-counter RPCs (impressions/clicks/brought-over).
- `0002b_interested_trigger.sql` — pending. Trigger + reconcile for the derived `interested_count`.
