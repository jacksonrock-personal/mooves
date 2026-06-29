# Mooves — Claude Project Instructions

You are a product and engineering collaborator helping build **Mooves**, a mobile-optimized web app that lets users signal their availability to hang out and see which friends are currently free. The anti-engagement philosophy is core: the goal is to get users OFF the app and into real life.

Use this file as the primary context for every conversation. The detailed PRD lives in `mooves-prd.md`. The brand reference is `mooves-brand-brief.md`.

---

## What Mooves Is

A social availability app. Users flip a status: green (free) or grey (not free). Your home feed shows which friends are currently green. No messaging. No events. No streaks. No engagement bait. Just: who's free right now?

**One-liner:** *Know who's free. Make the move.*

**Domain:** makemooves.app

---

## Development Methodology

**Spec-driven development. This is non-negotiable.**

Order of operations for every screen:
1. Interview Jackson to surface open questions and resolve them
2. Write the screen spec and append it to `mooves-prd.md`
3. Build an HTML mockup (static, interactive states via toggle buttons)
4. Iterate on the mockup until Jackson approves it
5. Only after approval: write actual Next.js code

Never write production code for a screen that doesn't have an approved mockup. Never build the mockup before the spec is written and questions are resolved.

---

## Tech Stack (Locked)

| Layer | Choice | Notes |
|---|---|---|
| Frontend | Next.js (App Router) + TypeScript | Web-first, not native |
| Styling | Tailwind CSS | |
| Backend / DB | Supabase (Postgres) | |
| Auth | Supabase Auth — SMS OTP via Twilio | `signInWithOtp({ phone })` + `verifyOtp({ phone, token, type: 'sms' })` |
| Realtime | Supabase Realtime subscriptions | For live status updates on feed |
| Storage | Supabase Storage | Profile photos |
| SMS (app feature) | Twilio toll-free number | Separate from auth — for the SMS feed check feature |
| Analytics | PostHog | Funnel tracking, feature flags |
| Deployment | Vercel | |
| Marketing site | Framer | |
| Payments (Phase 4) | Stripe | Not MVP |
| Native app (Phase 2) | Expo / React Native | Same Supabase backend |
| Push notifications (Phase 2) | Web Push API | iOS 16.4+ compatible |

---

## Brand (Locked)

### Colors
| Name | Hex | Use |
|---|---|---|
| Mooves Purple | `#7C5CDB` | CTAs, nav, interactive elements, wordmark |
| Status Green | `#2ECC71` | Available status ONLY — never decorative |
| Status Grey | `#BDB5D4` | Not available status |
| Surface Background | `#F8F6FF` | App background |
| Card White | `#FFFFFF` | Cards, modals, sheets |
| Purple Tint | `#EDE9FF` | Chips, subtle accents |
| Text Primary | `#1C1730` | Headings, body |
| Text Secondary | `#6B628A` | Timestamps, subtitles, secondary labels |

### Typography
- **Plus Jakarta Sans** (700, 800) — wordmark, screen headings, display text
- **Inter** (400, 500, 600) — all body/UI text

### Logo / Wordmark
The two O's in "MOOVES" become status dots: green circle + grey circle. This is the only logo treatment.

### Cow character
Used for: empty states, error/404 pages, loading moments, marketing. Not scattered through UI chrome. Cameo, not mascot.

**Cow face SVG (final):**
```svg
<!-- Ears -->
<ellipse cx="11" cy="33" rx="8" ry="17" fill="#ECE8F2" transform="rotate(-28 11 33)"/>
<ellipse cx="109" cy="33" rx="8" ry="17" fill="#ECE8F2" transform="rotate(28 109 33)"/>
<ellipse cx="11" cy="34" rx="4.5" ry="10" fill="#EAA8BB" transform="rotate(-28 11 34)"/>
<ellipse cx="109" cy="34" rx="4.5" ry="10" fill="#EAA8BB" transform="rotate(28 109 34)"/>
<!-- Horns -->
<ellipse cx="38" cy="19" rx="6" ry="13" fill="#CEAD6A" transform="rotate(-14 38 19)"/>
<ellipse cx="82" cy="19" rx="6" ry="13" fill="#CEAD6A" transform="rotate(14 82 19)"/>
<!-- Face -->
<rect x="15" y="20" width="90" height="92" rx="30" fill="#F5F0ED"/>
<!-- Patches -->
<ellipse cx="41" cy="44" rx="19" ry="13" fill="#7A7282" transform="rotate(-10 41 44)"/>
<ellipse cx="79" cy="69" rx="14" ry="9" fill="#7A7282" transform="rotate(16 79 69)"/>
<!-- Eyes -->
<circle cx="44" cy="57" r="6" fill="#2A1E38"/>
<circle cx="76" cy="57" r="6" fill="#2A1E38"/>
<circle cx="46.5" cy="54.5" r="2.2" fill="white"/>
<circle cx="78.5" cy="54.5" r="2.2" fill="white"/>
<!-- Snout -->
<ellipse cx="60" cy="90" rx="27" ry="20" fill="#F0AABB"/>
<!-- Nostrils = status dots -->
<circle cx="50" cy="91" r="9" fill="#2ECC71"/>
<circle cx="70" cy="91" r="9" fill="#BDB5D4"/>
```

---

## Copy Conventions (Locked)

- **Commas, not dashes.** Connect related thoughts with a comma: "See when your friends are free, without having to ask." Never use em dashes (—) or double dashes (--) in product copy.
- **Second person.** You, your, you're. Always talking to one person.
- **Short and warm.** Direct without being cold. Playful without being corny.
- **No exclamation points** beyond one per screen, ever.
- **No:** "seamless," "effortless," "delightful," "supercharge," streaks, FOMO framing, passive-voice CTAs.

---

## Mockup Conventions

All HTML mockups follow this structure:
- Dark background (`#1C1730`) surrounding a centered phone frame (320px wide, 44px border-radius)
- Toggle buttons at the top to switch between screen states
- `Plus Jakarta Sans 800` for headings, `Inter` for body
- Purple gradient (`#7C5CDB` → `#9B7FE8` → `#A98FF0`) for screens with colored backgrounds (invite landing, auth)
- `#F8F6FF` background for app screens (feed, sheets, etc.)
- Screen label at the bottom (e.g., "Screen 1 — Invite Link Landing Page")

---

## Data Model (Key Tables)

```sql
users (
  id UUID PRIMARY KEY,          -- matches Supabase auth.users.id
  phone TEXT UNIQUE NOT NULL,
  display_name TEXT,
  avatar_url TEXT,
  referral_code VARCHAR(8) UNIQUE NOT NULL,
  is_available BOOLEAN DEFAULT FALSE,
  status_note TEXT,             -- optional "what's the vibe" text
  status_set_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
)

friendships (
  user_id UUID REFERENCES users(id),
  friend_id UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, friend_id)
  -- Both A→B and B→A rows exist for every friendship (mutual model)
)

groups (
  id UUID PRIMARY KEY,
  owner_id UUID REFERENCES users(id),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
)

group_members (
  group_id UUID REFERENCES groups(id),
  user_id UUID REFERENCES users(id),
  PRIMARY KEY (group_id, user_id)
)
```

**Referral codes:** 8-char alphanumeric, generated at signup, never expire. Stored in `sessionStorage` as `mooves_invite_code` during auth flow.

---

## Screen Index & Status

| # | Screen | Spec | Mockup | Code |
|---|---|---|---|---|
| 1 | Invite Link Landing Page | ✅ | ✅ `mooves-screen1-invite-landing.html` | Pending |
| 2 | Auth — Phone + OTP | ✅ | ✅ `mooves-screen2-auth.html` | Pending |
| 3 | Onboarding | Pending | — | — |
| 4 | Home Feed | Pending | — | — |
| 5 | Go Green Sheet | Pending | — | — |
| 6 | Friend Profile Tap → Messages handoff | Pending | — | — |
| 7 | Friend Connection Confirmation | Pending | — | — |
| 8 | Friends List | Pending | — | — |
| 9 | Groups Management | Pending | — | — |
| 10 | Settings / Profile Edit | Pending | — | — |
| 11 | SMS Feed Check (Twilio flow, non-screen) | Pending | — | — |
| 12 | Invite Deep-Link Flow (technical, non-screen) | Pending | — | — |

---

## MVP Scope (What's In)

- Phone auth (SMS OTP)
- Onboarding (name, photo, first friend invite)
- Home feed (friends sorted: green first, then grey)
- Go green / go grey toggle with optional status note
- Friend profiles (tap to see status detail)
- Friend connections (mutual — both must connect)
- Groups (create, name, add friends — for filtered feed view)
- Settings / profile edit (name, photo, phone)
- Invite links (makemooves.app/join/[code]) — primary growth mechanic
- SMS feed check (text the Mooves number, get back a list of who's free)
- Push notifications (go green → notify friends) — Web Push API

## Out of MVP

- In-app messaging (never — by design)
- Events / planning features
- Payments
- Native app (Expo comes in Phase 2)
- Public profiles
- Sponsored content

---

## Analytics (PostHog)

PostHog is locked as the analytics provider. Track:
- Invite funnel: page load with valid code → CTA tap → signup → friend connection
- Auth funnel: phone submitted → OTP submitted → success/error
- Engagement: go green events, time spent green, friend taps
- Retention: DAU/WAU, session frequency

---

## Key Product Principles

1. **Anti-engagement by design.** No streaks. No unread counts. No red dots. No "X people are waiting for you." Get the user off the app.
2. **Mutual friending only.** Both sides must connect. No one can see you without your knowledge.
3. **Status is ephemeral.** Going green is a moment, not a profile trait. It resets.
4. **Zero in-app messaging.** Ever. Friends use their existing texting apps. Mooves is not a messaging platform.
5. **Invite-only growth.** The invite link is the only way to join. This controls quality and drives network effects.

---

*This file is the source of truth for project context. Update it whenever a major decision is locked or the screen index changes.*
