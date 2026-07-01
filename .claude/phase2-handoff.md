# Phase 2 Handoff — Core Loop

## What was just shipped (Phase 1)

Auth + Onboarding flow is fully working locally end-to-end:

- **Screen 2a** `/auth` — phone number entry, Firebase Phone Auth via Auth Emulator in dev
- **Screen 2b** `/auth/otp` — 6-digit OTP entry, auto-submit, resend with countdown
- **Screen 3a** `/onboarding` — name + photo upload to Supabase Storage (`Avatars` bucket, public)
- **Screen 3b** `/onboarding/invite` — referral link share via Web Share API

### API routes wired up
- `POST /api/auth/verify` — Firebase ID token → upserts user in Supabase → sets `mooves-token` cookie
- `GET /api/auth/supabase-token` — reads mooves-token → returns short-lived Supabase JWT for client-side Storage
- `GET/PATCH /api/users/me` — profile read/update

### Key infra decisions made
- **Firebase Auth Emulator** for local dev (`connectAuthEmulator` in `src/lib/firebase/client.ts`, only fires when `NODE_ENV=development`)
- Run emulator with: `npx firebase-tools emulators:start --only auth --project mooves-beac5`
- Dev server: `npm run dev` (port 3000 now, 3000 was clear after killing stale process)
- **mooves-token**: HS256 JWT signed with `SUPABASE_JWT_SECRET`, httpOnly cookie, 30 days
- **Supabase users table**: `id` has `DEFAULT gen_random_uuid()` — was missing on live DB, was fixed by running `ALTER TABLE public.users ALTER COLUMN id SET DEFAULT gen_random_uuid();` + dropping stale `users_id_fkey` FK to auth.users (we use Firebase, not Supabase Auth)

---

## Phase 2 — What to build next

**Goal**: working core loop. With one manually-seeded friendship in the DB, the app is fully usable.

### Screen 4 — Home Feed (`/feed`)
- `GET /api/feed` — returns the authed user's friends who are currently available (`is_available = true`), ordered by `status_set_at DESC`. Also return all friends for "grey" (unavailable) section below fold.
- **Realtime**: Supabase Realtime subscription on `public.users` filtered to `id = ANY(friendIds)` — updates the feed live when a friend flips status without page refresh
- Each friend card needs: `display_name`, `avatar_url`, `status_note`, `phone` (for Screen 6 tap-to-SMS)
- States: empty (no friends yet → seed one to test), friends available, friends all grey

### Screen 5 — Go Green / Grey (`PATCH /api/status`)
- `PATCH /api/status` — updates `is_available`, `status_note`, `status_set_at` on the authed user's row
- UI: a bottom sheet or toggle on the feed screen (per mockup). Green = available, Grey = unavailable.
- When user goes green they can optionally add a `status_note` (max 60 chars per DB constraint)

### Screen 6 — Friend tap → SMS
- Tapping a friend card on the feed opens the native SMS app pre-filled
- One line: `window.open(\`sms:${friend.phone}\`, '_self')`
- Depends on feed rendering `phone` field per friend card — make sure `GET /api/feed` returns it

---

## To manually seed a test friendship (required to see the feed work)

Run in Supabase SQL Editor — replace the UUIDs with real user IDs from your `users` table:

```sql
INSERT INTO public.friendships (user_id, friend_id) VALUES
  ('<your-user-id>', '<friend-user-id>'),
  ('<friend-user-id>', '<your-user-id>');

-- Also make the friend available so they appear in the green feed:
UPDATE public.users SET is_available = true, status_note = 'Down to hang' WHERE id = '<friend-user-id>';
```

---

## Local dev setup reminder

1. `npx firebase-tools emulators:start --only auth --project mooves-beac5` (terminal 1)
2. `npm run dev` (terminal 2)
3. App at `http://localhost:3000`
4. Emulator UI at `http://127.0.0.1:4000/auth` (shows OTP codes)

Env vars that matter:
- `FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099` — in `.env.local`, tells firebase-admin to trust emulator tokens
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID=mooves-beac5` — must match `--project` flag on emulator
