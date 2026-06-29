# Mooves — Project Context & Locked Decisions

> **Living document.** Update this file as decisions are made, reversed, or refined. This is the source of truth for the project — for product, design, and engineering.

---

## What Is Mooves?

A mobile-optimized web app that solves one simple problem: **knowing when your friends are available and interested in hanging out, without having to ask them individually.**

Think of it as a social version of the status dot in Slack or MS Teams. Green = I'm open to hanging out. Grey = I'm not. You open the app intentionally, see a feed of friends who are "green," and text them to make a plan. The goal is to get you **off the app and into real life** as fast as possible.

**Core philosophy:** Anti-engagement. We do not optimize for time-in-app. Value is delivered when a real-world hangout happens. Every design and product decision should be filtered through this lens.

---

## Name & Brand

**Name: Mooves**
- "What's the move?" is the cultural phrase the target demographic uses
- Cow motif — absurd, memorable, not dumb
- Green status indicator maps naturally onto the brand
- Brand direction: fun, colorful, slightly irreverent, clean. Not corporate. Not dark. Not minimal-beige. Something that feels alive.

---

## Locked Decisions

### Platform
**Mobile-first web app (Next.js), native mobile later.**

Rationale:
- Primary growth mechanic is the **invite link** — web-first means the link opens directly into the experience with zero friction. No App Store redirect, no download.
- Partiful precedent: ran web-only for years, built real traction, added native apps later.
- Core UX loop ("open app intentionally to check who's green") does not require background push notifications in the MVP.
- Faster iteration: no App Store approval delay. Ship, learn, change.
- Native app (Expo/React Native, same Supabase backend) is a Phase 2 milestone, not an MVP requirement.

### Tech Stack

| Layer | Choice | Rationale |
|---|---|---|
| Frontend | Next.js (App Router), TypeScript | Web-first, excellent DX, Claude handles it well |
| Styling | Tailwind CSS | Fast, consistent, scales well |
| Backend / DB | Supabase | Managed Postgres + auth + realtime + storage in one. Free tier handles early scale. Supabase IS Postgres — migration to AWS RDS is a clean pg_dump if/when needed. |
| Auth | Supabase Auth, SMS OTP | No passwords. Phone number = identity. Magic code texted to phone. |
| Realtime | Supabase Realtime | Live feed updates when friends go green |
| File storage | Supabase Storage | Profile photos |
| Deployment | Vercel | GitHub integration, automatic deploys, free tier, ideal for Next.js |
| Marketing page | Framer | Design-first, polished output, no code required |
| Payments (roadmap) | Stripe | Tipping, sponsorships |
| Push notifications (roadmap) | Web Push API (iOS 16.4+) | Available when/if needed; not MVP |
| Native app (roadmap) | Expo / React Native | Same Supabase backend, add when traction is proven |

### Backend / Infra Philosophy
Start with Supabase. AWS (RDS + Cognito + S3 + etc.) is the right destination at scale, but it's 6+ services vs. Supabase's 1, with significant setup cost. Migration is straightforward when the time comes. Don't let premature scaling concerns slow the build.

---

## MVP Feature Scope

### In MVP
1. **Auth** — SMS OTP via Supabase. Phone number is the identity. No passwords.
2. **Onboarding**
   - Phone number
   - Display name
   - Profile photo
   - Zip code
   - Contacts permission prompt (for suggesting who to invite)
3. **Home feed** — List of friends who are currently "green," sorted by recency. Each shows: photo, name, how long they've been green, and their vibe message (if any).
4. **Go Green** — Tap to toggle your status on. Optional short "vibe message" (e.g., "drinks somewhere lowkey," "up for anything," "sports bar?"). Choose who can see it: All friends, or specific groups.
5. **Green status auto-expiry** — Default 8 hours. Option to set shorter (e.g., "just tonight," "next 2 hours"). Status clears automatically. No one forgets they're green.
6. **Tap a friend in the feed** — Opens their contact in the native Messages app. That's it. The app hands you off to SMS. No in-app messaging, ever.
7. **Friend linking via unique invite link** — Each user has a unique link. Sharing it: (1) brings the recipient to sign up for the app, and (2) automatically connects them as friends. This is the primary growth mechanic.
8. **Friend list view** — See, search, and manage all friends you're linked with.
9. **Friend groups** — Create named groups (e.g., "college friends," "work pals," "IM basketball"). Add/remove friends from groups. Control which groups see your green status when you go green.
10. **Visibility control** — When going green, choose "All friends" or specific groups. Prevents the awkward scenario of someone you don't want to hang with seeing you available.
11. **Friending model** — Mutual. Both sides must be connected. Consistent with visibility/trust model.

### Explicitly Not In MVP
- In-app messaging (never, philosophically)
- Future plan creation ("hang out Thursday night")
- User interest profiles
- Push notifications for friend-goes-green events
- Payment / tipping
- Sponsored plans / local advertising
- Native iOS / Android apps

---

## Product Roadmap (Post-MVP)

### Phase 2 — Social Graph & Engagement Depth
- Push notifications (web push API, iOS 16.4+) for social graph events: friend request accepted, someone joined your plan
- Native app (Expo) — same Supabase backend, wrap and ship to App Store once web traction is proven

### Phase 3 — Future Plans
- "I want to hang Thursday night" — post a plan up to 2 weeks out with a general activity idea / vibe
- Feed shows both real-time green statuses AND upcoming plans from friends
- React to / join a plan
- NOT full event planning (Partiful territory) — intentionally lightweight

### Phase 4 — Monetization
- Stripe tipping / appreciation for the app
- User interest profiles (non-creepy: "early 30s, Chicago, likes sports and trivia")
- Sponsored plans — local businesses/events pay to appear in relevant users' feeds (clearly marked). Includes reporting dashboard and ROI data for sponsors.

---

## Development Methodology

**Spec-driven development.** In order:

1. **Interview + spec** — Discuss requirements, edge cases, open questions. Write a detailed written spec for the feature or screen. No code written yet.
2. **HTML mockup / Claude artifact** — Build a low-cost visual mockup in HTML/CSS (or a Claude artifact) to validate the look, feel, and UX. This is fast and cheap to iterate.
3. **Review and revise** — Iterate on the mockup until it's approved. All design decisions locked before touching the real codebase.
4. **Write code** — Only after mockup approval and spec is complete. Code must be grounded in the existing codebase: connections, dependencies, and existing patterns accounted for before writing a line.

**Why this matters:** Prevents expensive rework. UI/UX decisions discovered during coding = waste. Discovering them in an HTML mockup = cheap. Discovering them after coding = very expensive.

---

## Key Product Principles

1. **Get off the app.** Every screen should help users connect in real life faster, not keep them in Mooves longer.
2. **Simplicity over features.** When in doubt, cut it from MVP. Add it in Phase 2 with real user signal.
3. **Privacy by default.** Visibility control is a first-class feature, not an afterthought. No one should ever see your green status unless you intended them to.
4. **No passwords, ever.** SMS OTP only. If we add other auth methods, they should be similarly frictionless (magic link, Sign in with Apple, etc.).
5. **The invite link is the product's immune system.** Friction in the sign-up / friend-linking flow kills network effects. This flow must be as smooth as anything in the app.
6. **Mutual friendship model.** Green status is trust-sensitive. One-sided follow would break the privacy model.

---

## Open Questions (To Be Resolved)

- [ ] What does the green status card look like exactly in the feed? Just a dot? A colored card? A glow?
- [ ] What happens when you tap "Go Green" and you're already green — instant toggle off, or confirmation?
- [ ] What is the exact onboarding flow order? (Phone → OTP → Name → Photo → Zip → Contacts? Or different?)
- [ ] How are friend groups created during onboarding vs. later?
- [ ] What does the empty state look like when no friends are green? (This is a critical first-run / retention moment)
- [ ] How does the contacts permission / invite suggestion flow work on web (vs. native)?
- [ ] What is the URL/domain for Mooves? (needed for Vercel, invite links, Framer landing page)
- [ ] App Store submission: when, how, and under what developer account?

---

## Build Order (Current Plan)

1. **Brand brief** — lock visual identity: color palette, typography, logo/icon direction
2. **PRD** — full product spec, screen by screen, for the web MVP
3. **Data model** — Supabase schema (tables, relationships, RLS policies)
4. **Mockups** — HTML artifacts for each screen, approved before coding
5. **Build** — Next.js + Supabase + Vercel, screen by screen, spec-grounded

---

*Last updated: 2026-06-28*
*Owner: Jackson Viccora — jackson.viccora@vantagepoint-inc.com*
