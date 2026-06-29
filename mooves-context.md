# Mooves — Living Context Doc

> Quick-reference for all locked decisions, current status, and file inventory. Updated as the project progresses.

**Last updated:** 2026-06-28

---

## Locked Decisions

### Domain
- **makemooves.app** (mooves.app was taken)

### Platform
- Web-first (Next.js), not native. Same rationale as Partiful — invite link → web app → zero friction. Native (Expo) comes in Phase 2 with the same Supabase backend.

### Backend
- **Supabase** for everything: Postgres, Auth (SMS OTP), Realtime, Storage. Chosen over AWS for MVP velocity. Clean migration path to AWS later if needed.

### Auth
- SMS OTP only. No passwords, ever. US phone numbers only for MVP.
- Supabase `signInWithOtp({ phone })` + `verifyOtp({ phone, token, type: 'sms' })`
- OTP codes expire after 10 minutes
- Max 5 wrong attempts before lockout
- New user detection: check `users` table after OTP verify. Row exists → returning user. No row → new user.

### Referral / Invite System
- Each user gets one `referral_code VARCHAR(8) UNIQUE` at signup
- Codes never expire
- Stored in `sessionStorage` as `mooves_invite_code` during auth flow
- Auto-creates mutual friendship post-onboarding
- Invite URL: `makemooves.app/join/[code]`

### Friending Model
- Mutual only. Both sides must connect.
- Two rows in `friendships` table per connection: A→B and B→A.
- `POST /api/friendships` is idempotent (returns 409 on duplicate, no error shown to user).

### Analytics
- **PostHog** — locked. Generous free tier, excellent funnel/conversion tracking, feature flags available, self-hostable.

### Copy Standard
- Commas to connect thoughts, never dashes. "See when your friends are free, without having to ask."
- Never: em dashes (—), double dashes (--)
- Second person throughout. Short and warm.

### ToS on Auth Screen
- Yes. "By continuing, you agree to our Terms and Privacy Policy." — small text below CTA on Screen 2a. Links TBD for MVP.

---

## File Inventory

| File | Location | Status | Notes |
|---|---|---|---|
| `mooves-project-instructions.md` | `C:\Users\jacks\Projects\Mooves\` | ✅ | Claude project system prompt |
| `mooves-context.md` | `C:\Users\jacks\Projects\Mooves\` | ✅ | This file — living context doc |
| `mooves-prd.md` | `C:\Users\jacks\Projects\Mooves\` | 🔄 Active | Master PRD, grows screen by screen |
| `mooves-screen1-invite-landing.html` | `C:\Users\jacks\Projects\Mooves\` | ✅ Approved | Interactive mockup, 4 states (A/B/C/D) |
| `mooves-screen2-auth.html` | `C:\Users\jacks\Projects\Mooves\` | ✅ Approved | Interactive mockup, 3 states (2a / 2b / 2b error) |
| `mooves-brand-brief.md` | outputs folder | ✅ Locked | Full written brand guidance |
| `mooves-brand-concept.html` | outputs folder | ✅ Locked | Visual brand presentation (colors, type, logo, mockups) |

---

## Screen Progress

| # | Screen | Spec | Mockup | Approved | Code |
|---|---|---|---|---|---|
| 1 | Invite Link Landing | ✅ | ✅ | ✅ | — |
| 2 | Auth — Phone + OTP | ✅ | ✅ | ✅ | — |
| 3 | Onboarding | ✅ | ✅ | ✅ | — |
| 4 | Home Feed | ✅ | ✅ | ✅ | — |
| 5 | Go Green Sheet | ✅ | ✅ | ✅ | — |
| 6 | Friend Tap → SMS Handoff (non-screen) | ✅ | n/a | ✅ | — |
| 7 | Friend Connection Confirmation | — | — | — | — |
| 8 | Friends List | — | — | — | — |
| 9 | Groups Management | — | — | — | — |
| 10 | Settings / Profile Edit | — | — | — | — |
| 11 | SMS Feed Check (Twilio, non-screen) | — | — | — | — |
| 12 | Invite Deep-Link Flow (technical) | — | — | — | — |

---

## Screen 1: Resolved Decisions

- Referral codes never expire
- ToS/Privacy banner is dismissable (once per session)
- Track: invite_link_viewed, invite_cta_tapped, invite_signup_completed (PostHog)
- Desktop users see "Made for mobile" dismissable banner
- State C (already friends) → redirect to feed with toast, no separate landing

**Copy (final):**
- State A hero: "Sarah R. invited you to Mooves"
- State A subtext: "See when your friends are free, without having to ask."
- State A CTA: "Join"
- State B hero: "Sarah R. wants to see you on Mooves"
- State B CTA: "Let's Go"
- State C toast: "You can already see [Name] on Mooves!"
- State D hero: "You've been invited to Mooves"
- State D CTA: "Join"

---

## Screen 2: Resolved Decisions

- ToS link on 2a: Yes. "By continuing, you agree to our Terms and Privacy Policy."
- Max OTP attempts: 5 before lockout
- US only for MVP; international → "US numbers only for now."
- Back link on 2b: "← Wrong number?" — pre-fills phone number on return to 2a
- Auto-submit on 6th digit (no button tap required)
- iOS auto-fill: `autocomplete="one-time-code"` on OTP input
- Resend locked for first 30 seconds, then active

**PostHog events:** auth_phone_submitted, auth_otp_submitted, auth_otp_error, auth_otp_resend, auth_success_new_user, auth_success_returning

---

## Next Up

1. **Screen 3: Onboarding** — spec in progress
2. **Screen 4: Home Feed** — pending

---

## Product Principles (Anti-Patterns to Protect)

1. No in-app messaging, ever
2. No streaks, unread counts, red dots, or engagement bait
3. Status is ephemeral — going green is a moment, not a trait
4. Mutual friending only — no one sees you without your consent
5. Invite-only growth — the link is the only door in
