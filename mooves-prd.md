# Mooves -- Product Requirements Document

> **How to use this doc:** Each screen is spec'd in order. No code is written until the screen's spec AND mockup are approved. Approved sections are marked ✅. Sections in draft are marked 🔄.

**Last updated:** 2026-06-29 (Auth layer changed from Supabase Auth + Twilio OTP to Firebase Phone Auth — no A2P/carrier registration required for individuals)
**Stack:** Next.js (App Router) · Supabase · Firebase Auth · Tailwind CSS · Vercel · Twilio (inbound SMS only)
**Domain:** makemooves.app
**Brand ref:** mooves-brand-brief.md · mooves-brand-concept.html

---

## Screen Index

| # | Screen | Status |
|---|---|---|
| 1 | Invite Link Landing Page | ✅ Approved · ✅ Coded |
| 2 | Auth -- Phone + OTP | ✅ Approved · ✅ Coded |
| 3 | Onboarding | ✅ Approved · ✅ Coded |
| 4 | Home Feed | ✅ Approved — see Amendment A for status control UI · ✅ Coded |
| 5 | Go Green Sheet | ✅ Approved — see Amendment B for group selector UI · ✅ Coded |
| 6 | Friend Tap → SMS Handoff (non-screen) | ✅ Approved · ✅ Coded |
| 7 | ~~Friend Connection Confirmation~~ | ❌ Removed — web flow already covered by Screen 1 + feed toast |
| 8 | Friends List | ✅ Approved · ✅ Coded |
| 9 | Groups Management | ✅ Approved · ✅ Coded |
| 10 | Settings / Profile Edit | ✅ Approved · ✅ Coded |
| 11 | SMS Feed Check (non-screen, Twilio flow) | ✅ Approved · ✅ Coded (deferred — A2P registration pending) |
| 12 | Invite Link Deep-Link Flow (non-screen, technical) | ✅ Approved · ✅ Coded |
| — | Spec Amendments (A/B/C) | ✅ Approved — overrides noted above |
| 13 | Canonical Data Model | ✅ Approved |
| 14 | Auth Integration (Firebase → Supabase) | ✅ Approved |
| 15 | API Routes | ✅ Approved |
| 16 | Next.js File Structure | ✅ Approved |
| 17 | Supabase Setup (RLS, Storage, Realtime) | ✅ Approved |
| 18 | Middleware | ✅ Approved |
| 19 | Environment Variables | ✅ Approved |
| — | Post-MVP Roadmap (Phases 8–15) | 🔮 Definitions finalized 2026-07-16 — needs spec + mockup per phase |

---

## Screen 1: Invite Link Landing Page 🔄

### Purpose

The primary entry point for new users. When a Mooves user shares their unique invite link, the recipient lands here. This page must do three things in sequence:

1. Establish immediate trust and context ("oh, [friend] uses this")
2. Communicate the value of Mooves in under 5 seconds
3. Get the person to sign up AND auto-connect them with the friend who invited them

This screen is the engine of organic growth. Friction here kills network effects.

---

### URL Structure

```
makemooves.app/join/[referral_code]
```

- `referral_code` is a short unique string (8 alphanumeric chars) assigned to each user at signup
- Stored in the `users` table: `referral_code VARCHAR(8) UNIQUE NOT NULL`
- Codes do not expire (or expire after 1 year -- TBD)
- Each user has exactly one referral code; sharing that same link multiple times is fine and expected

---

### User States

| State | Condition | Behavior |
|---|---|---|
| **A. New user** | No Mooves account | Full signup flow with auto-connect at end |
| **B. Existing user, not yet friends** | Has account, not connected to inviter | Skip signup, show "Connect with [Name]" CTA |
| **C. Existing user, already friends** | Has account, already connected | Redirect to home feed with toast |
| **D. Invalid/expired code** | Code not found in DB | Show generic landing page, standard signup |

---

### Page Content (State A -- New User, Primary Case)

**Header**
- Mooves wordmark (logo mark + "Mooves" in Plus Jakarta Sans 800)
- Positioned top-center with generous padding

**Hero**
- Inviter's avatar (circular, 80px, fetched via referral code lookup)
- A soft purple glow ring around the avatar
- Below avatar: `[First name] invited you to Mooves`
- Subtext (one line max): `"See when your friends are free -- without having to ask."`

**CTA Block** (pinned to bottom, above safe area)
- Primary button: `Join Mooves` (full-width, Mooves Purple, Plus Jakarta Sans 700)
- Below button (small, secondary text): `Takes about 2 minutes. No password needed.`

**Background**
- Full-screen purple gradient: `#7C5CDB` → `#9B7FE8` (top to bottom)
- Light abstract visual texture or the two status dots (large, blurred) as background element
- White text throughout

---

### Page Content (State B -- Existing User, Not Yet Friends)

Same layout as State A, except:
- CTA button label: `Connect with [Name]`
- No "Takes about 2 minutes" copy (they're already a user)
- On tap: auto-creates friendship, redirect to home feed with toast

---

### Page Content (State D -- Invalid Code)

- No inviter avatar or name shown
- Hero copy: `You've been invited to Mooves`
- Subtext: `"See when your friends are free -- without having to ask."`
- CTA: `Join Mooves`
- Otherwise identical layout

---

### User Flow -- State A (New User, Primary)

```
1. User taps invite link
2. Page loads → referral_code extracted from URL
3. API call: GET /api/invite/[code] → returns { display_name, avatar_url }
4. referral_code stored in sessionStorage (persists through auth redirect)
5. User sees landing page with inviter's name + photo
6. User taps "Join Mooves"
7. → Navigate to Screen 2 (Auth / Phone Entry)
8. [Auth completes, onboarding completes]
9. API call: POST /api/friendships { referral_code: sessionStorage.get('invite_code') }
   → Creates mutual friendship between new user and inviter
   → Clears sessionStorage invite_code
10. → Navigate to Screen 4 (Home Feed)
11. Toast displayed: "[Name] is now your Mooves friend! 🟢"
```

---

### User Flow -- State B (Existing User, Not Yet Friends)

```
1. User taps invite link
2. Page loads → Supabase session detected (existing user)
3. API call: GET /api/invite/[code] → returns inviter profile
4. Cross-check: are they already friends? No.
5. Page shows "Connect with [Name]" CTA
6. User taps button
7. API call: POST /api/friendships { referral_code }
8. → Redirect to home feed with toast: "[Name] is now your Mooves friend! 🟢"
```

---

### User Flow -- State C (Already Friends)

```
1. User taps invite link
2. Page loads → session detected + friendship already exists
3. Redirect immediately to home feed
4. Toast: "You're already connected with [Name]!"
```

---

### Technical Notes

**Referral code lookup (public endpoint, no auth required):**
```
GET /api/invite/[code]
Response: { display_name: string, avatar_url: string | null }
Returns 404 if code not found (triggers State D)
```
Note: Only returns display name and avatar -- no other user data exposed.

**Friendship creation (auth required):**
```
POST /api/friendships
Body: { referral_code: string }
Creates two rows in friendships table (A→B and B→A) -- mutual by design
Returns 409 if friendship already exists (handles State C gracefully)
```

**Referral code persistence:**
- Stored in `sessionStorage` under key `mooves_invite_code` immediately on page load
- Cleared after friendship is successfully created
- If the user opens the link in a new tab after signup, sessionStorage is fresh -- they'd need to tap the link again (acceptable edge case)

**Existing session detection:**
- On page load, check Supabase `getSession()` before rendering
- If session exists, skip to State B/C logic
- If no session, render State A

---

### Copy (Final)

| Element | Copy |
|---|---|
| Inviter hero line (State A) | `[First name] invited you to Mooves` |
| Value prop subtext (States A, D) | `See when your friends are free, without having to ask.` |
| CTA (new user, State A) | `Join` |
| Inviter hero line (State B) | `[First name] wants to see you on Mooves` |
| CTA (existing user, State B) | `Let's Go` |
| Toast (new connect, after signup) | `[Name] is now your Mooves friend! 🟢` |
| Toast (already friends, State C) | `You can already see [Name] on Mooves!` |
| Invalid code hero (State D) | `You've been invited to Mooves` |
| CTA (invalid code, State D) | `Join` |

---

### Edge Cases

| Scenario | Handling |
|---|---|
| Slow network on avatar load | Show avatar placeholder (initials in purple circle) while loading |
| Inviter deleted their account | Code returns 404 → State D (generic landing) |
| User on desktop browser | Page works fine; add subtle note: "Made for mobile -- works best in your phone's browser" |
| User taps link twice | Idempotent: second POST /api/friendships returns 409, no duplicate created |
| Referral code in URL after signup (session exists, different user) | Should not occur -- code is stored in sessionStorage at link-tap time |

---

### Resolved Decisions

- **Referral codes never expire.** A link shared years ago should still work.
- **Track invite click-through rate and conversion.** Fire analytics events on: (1) page load with valid code, (2) CTA tap, (3) successful signup + friend connection. **Analytics tool: PostHog** (generous free tier, excellent funnel/conversion tracking, feature flags available for future use, self-hostable if needed).
- **Desktop "best on mobile" banner is dismissable.** Show once per session; user can X it away. Do not re-show on the same session.

---

### Mockup Status

✅ `mooves-screen1-invite-landing.html` -- approved

---

## Screen 2: Auth -- Phone + OTP ✅

### Purpose

Verify the user's identity using their phone number. No passwords, ever. The phone number becomes the user's permanent identity in Supabase. This screen is used at two moments: first signup (followed by onboarding) and returning login (followed by home feed).

---

### Sub-screens

| # | Sub-screen | Trigger |
|---|---|---|
| 2a | Phone number entry | Entry point from Screen 1 or any unauthenticated route |
| 2b | OTP code entry | After phone is submitted and SMS is sent |

---

### Technical Foundation

- **Firebase Phone Auth** handles OTP. Google manages all carrier relationships — no A2P/10DLC registration required.
- Client SDK: `signInWithPhoneNumber(auth, phoneNumber, appVerifier)` triggers the SMS. `appVerifier` is a Firebase `RecaptchaVerifier` (invisible reCAPTCHA — users never see it).
- OTP confirmation: `confirmationResult.confirm(code)` verifies the 6-digit code. Returns a Firebase `UserCredential`.
- After confirmation, the client sends the Firebase ID token to `POST /api/auth/verify` (our server route).
- Server: Firebase Admin SDK verifies the token and extracts `phone_number`. Looks up or creates a row in the Supabase `users` table. Returns a signed Supabase-compatible JWT stored as an httpOnly cookie (`mooves-token`).
- All subsequent Supabase queries (client and server) use this JWT — RLS policies still work via `auth.uid()`.
- OTP codes expire after **10 minutes** (Firebase default, not configurable).
- **New user detection:** After `/api/auth/verify`, the server checks if a `users` row exists for that phone. Response includes `{ isNewUser: boolean }` so the client knows where to navigate.
- **Twilio is NOT used for auth OTP.** Twilio's only role in Mooves is owning the inbound phone number for the SMS feed check (Screen 11).

---

### Screen 2a: Phone Number Entry

**Layout (top to bottom)**

- Back chevron (top-left) -- navigates back to invite landing if present, or to root
- Mooves wordmark (small, centered) -- reassures user they're in the right place
- Heading: `What's your number?`
- Subtext: `We'll text you a code to verify it's you.`
- Phone input field:
  - Prefix label: `🇺🇸 +1` (non-interactive; US only in MVP)
  - Input: auto-formats as `(XXX) XXX-XXXX` as user types
  - Large, prominent, single field
  - Keyboard: numeric (`inputmode="tel"`)
  - Purple focus ring on active
- CTA button: `Send code` (full-width, Mooves Purple, disabled until 10 digits entered)

**Validation**
- Button stays disabled until exactly 10 digits entered (US format)
- On submit: strip formatting → prepend `+1` → pass to Supabase
- If Supabase returns a rate-limit error: inline message `Too many attempts, try again in a few minutes.`

---

### Screen 2b: OTP Code Entry

**Layout (top to bottom)**

- Back link: `← Wrong number?` (top-left) -- navigates back to 2a, pre-fills the number
- Heading: `Check your texts`
- Subtext: `We sent a 6-digit code to (XXX) XXX-XXXX` (shows the number they entered)
- 6 individual digit boxes, evenly spaced:
  - Each box: square, rounded corners, large type
  - Active box: purple border
  - Filled box: dark text, light purple background
  - Auto-advance focus to next box on digit entry
  - Backspace on empty box moves focus to previous
  - **Auto-submits** when 6th digit is entered (no button tap required)
- Resend link: `Resend code` -- grayed out for first 30 seconds, then active
- No explicit submit button (auto-submit handles it)

**States**

| State | Trigger | Behavior |
|---|---|---|
| Clean | Arrived from 2a | 6 empty boxes, cursor in box 1 |
| Filling | User typing | Boxes fill left to right, focus advances |
| Verifying | 6th digit entered | Brief loading state, boxes pulse |
| Error | Wrong code | Boxes shake animation, turn red, message below: `That code isn't right, try again.` Cleared automatically so user can re-enter. |
| Expired | Code > 10 min old | `That code expired, we've sent a new one.` Auto-triggers resend. |
| Rate limited | Too many wrong attempts | `Too many attempts, try again in a few minutes.` Resend disabled. |
| Success (new user) | Code verified, no user row | → Screen 3 (Onboarding) |
| Success (returning) | Code verified, user row exists | → Screen 4 (Home Feed) |

---

### User Flows

**New user (arriving from invite landing)**
```
1. Screen 1: User taps "Join" → navigate to Screen 2a
   (invite referral_code already in sessionStorage)
2. Screen 2a: Enter phone → tap "Send code"
   → Firebase signInWithPhoneNumber(auth, '+1XXXXXXXXXX', recaptchaVerifier)
   → Returns confirmationResult, stored in component state
   → Navigate to Screen 2b
3. Screen 2b: Enter 6-digit code → auto-submit
   → Firebase confirmationResult.confirm(code)
   → Returns userCredential; get idToken via userCredential.user.getIdToken()
   → POST /api/auth/verify { idToken }
   → Server verifies token, creates users row, returns { isNewUser: true }
   → Server sets mooves-token cookie
   → Navigate to Screen 3 (Onboarding)
```

**Returning user (direct visit to makemooves.app)**
```
1. User visits makemooves.app → no mooves-token cookie → Navigate to Screen 2a
2-3. Same as above
   → POST /api/auth/verify → { isNewUser: false }
   → Navigate to Screen 4 (Home Feed)
```

**Returning user (active session exists)**
```
1. User visits makemooves.app → valid mooves-token cookie present
   → Middleware validates JWT → Skip auth → Navigate to Screen 4 (Home Feed)
```

---

### Copy

| Element | Copy |
|---|---|
| 2a heading | `What's your number?` |
| 2a subtext | `We'll text you a code to verify it's you.` |
| 2a CTA button | `Send code` |
| 2a rate limit error | `Too many attempts, try again in a few minutes.` |
| 2b back link | `← Wrong number?` |
| 2b heading | `Check your texts` |
| 2b subtext | `We sent a 6-digit code to [formatted number]` |
| 2b resend link (inactive) | `Resend code` (muted, countdown: `Resend in 0:28`) |
| 2b resend link (active) | `Resend code` (purple, tappable) |
| 2b wrong code error | `That code isn't right, try again.` |
| 2b expired error | `That code expired, we've sent a new one.` |
| 2b rate limit error | `Too many attempts, try again in a few minutes.` |

---

### Edge Cases

| Scenario | Handling |
|---|---|
| User goes back from 2b to 2a | Pre-fill their phone number, let them edit and resend |
| User pastes OTP from SMS (iOS auto-fill) | Should work natively -- `autocomplete="one-time-code"` on the input |
| User has no cell signal | Cannot receive SMS -- no in-app handling, user tries again |
| International number entered | For MVP, only +1 numbers accepted; show `US numbers only for now.` if non-US format detected |
| User closes browser mid-OTP | Returns to 2a; old code may still be valid for up to 10 min |

---

### PostHog Events (Screen 2)

| Event | When |
|---|---|
| `auth_phone_submitted` | User taps "Send code" |
| `auth_otp_submitted` | Auto-submit fires on 6th digit |
| `auth_otp_error` | Wrong code entered |
| `auth_otp_resend` | User taps "Resend code" |
| `auth_success_new_user` | OTP verified, no existing user row |
| `auth_success_returning` | OTP verified, existing user row found |

---

### Resolved Decisions

- **ToS / Privacy Policy link on 2a:** Yes. Display small footer text below the CTA: "By continuing, you agree to our Terms and Privacy Policy." Links TBD (placeholder for MVP). Required for legal compliance when collecting phone numbers.
- **Max wrong OTP attempts before lockout:** Firebase enforces its own rate limiting automatically. After too many wrong attempts, Firebase returns an `auth/too-many-requests` error — show "Too many attempts, try again in a few minutes." and disable input.

---

### Mockup Status

✅ `mooves-screen2-auth.html` -- approved

---

## Screen 3: Onboarding ✅

### Purpose

Transform a verified phone number into a real Mooves profile, then get the user to invite their first friend. Two steps, minimal friction. The user should feel set up and ready, not processed.

This screen fires exactly once per user -- after OTP verification when no row exists in the `users` table.

---

### Sub-screens

| # | Sub-screen | Trigger |
|---|---|---|
| 3a | Profile setup | Entry from Screen 2 (new user detected) |
| 3b | Invite nudge | After 3a is submitted |

Both sub-screens show a 2-dot step indicator at the top (dot 1 = 3a, dot 2 = 3b).

---

### Technical Foundation

- **User row creation:** On OTP verification (Screen 2), Supabase Auth creates a row in `auth.users`. Immediately after, create a corresponding row in the public `users` table with `phone` and `onboarding_complete = FALSE`.
- **Referral code:** Generated at user row creation (8-char alphanumeric, unique). Assigned before the user reaches 3a.
- **Profile write:** On 3a completion, `UPDATE users SET display_name = ?, onboarding_complete = FALSE` (not marked complete yet -- user still on step 3b).
- **Photo upload:** To Supabase Storage at `avatars/[user_id].[ext]`. Update `users.avatar_url` on success. Photo is optional; if skipped, `avatar_url` stays null and initials are used everywhere.
- **Onboarding completion:** On 3b (whether shared or skipped), `UPDATE users SET onboarding_complete = TRUE`. Then navigate to Home Feed.
- **Resume logic:** If user closes the app mid-onboarding, detect `onboarding_complete = FALSE` on next session open and route back to the appropriate step. If `display_name` is already set, skip to 3b.

---

### Screen 3a: Profile Setup

**Layout (top to bottom)**

- Step dots: 2 dots, first filled (Mooves Purple), second empty
- Heading: `What should we call you?`
- Subtext: `This is how your friends will see you.`
- Photo upload:
  - Circular placeholder (80px) showing initials in Mooves Purple if no photo
  - Tap to open action sheet: "Take a photo" / "Choose from library"
  - After selection: show circular crop UI, confirm, upload to Supabase Storage
  - Small label below: `Add a photo` (tappable, same as tapping the circle)
  - Once photo is set: label changes to `Change photo`
- Name input:
  - Label: `Your name`
  - Large text input, single line
  - Placeholder: `e.g. Jackson`
  - Max length: 30 characters
  - Auto-capitalizes first letter
  - No special validation beyond: at least 1 non-whitespace character
- CTA: `Continue` (full-width, Mooves Purple, disabled until name is filled)
- Below CTA: no "skip" -- name is required

**Photo skip path:**
- No explicit "skip photo" on the screen itself -- the photo is simply optional. User can tap `Continue` without adding one.
- If no photo added, initials are used as avatar throughout the app.

---

### Screen 3b: Invite Nudge

**Layout (top to bottom)**

- Step dots: 2 dots, both filled (Mooves Purple)
- Heading: `Bring your friends.`
- Subtext: `Mooves is only as good as the people on it.`
- Visual: a small preview of their referral link -- `makemooves.app/join/[code]` -- displayed in a muted pill/chip, non-interactive (for context)
- CTA: `Share your link` (full-width, Mooves Purple) -- triggers native Web Share API (`navigator.share`) with:
  - `title`: `Join me on Mooves`
  - `text`: `See when your friends are free, without having to ask.`
  - `url`: `https://makemooves.app/join/[referral_code]`
- Below CTA: `Skip for now` (small, secondary text, tappable) -- navigates to Home Feed

**Fallback:** If `navigator.share` is not available (desktop), show a "Copy link" button that copies the URL to clipboard and shows a brief "Copied!" confirmation.

---

### User Flow

```
1. OTP verifies (Screen 2)
   → Check users table: no display_name → new user
   → Create users row: { phone, referral_code, onboarding_complete: false }
   → Navigate to Screen 3a

2. Screen 3a: User enters name, optionally adds photo
   → Tap "Continue"
   → UPDATE users SET display_name = ?, avatar_url = ? (if photo)
   → Navigate to Screen 3b

3. Screen 3b: User sees invite nudge
   → Tap "Share your link" → Web Share API sheet appears
     → On share: fire PostHog event, navigate to Home Feed
   → OR tap "Skip for now" → navigate to Home Feed

4. Home Feed
   → UPDATE users SET onboarding_complete = true (on arrival)
   → Empty feed state shown (no friends yet)
   → Persistent invite nudge visible in feed
```

---

### Copy

| Element | Copy |
|---|---|
| 3a heading | `What should we call you?` |
| 3a subtext | `This is how your friends will see you.` |
| 3a photo label (no photo) | `Add a photo` |
| 3a photo label (photo set) | `Change photo` |
| 3a name input placeholder | `e.g. Jackson` |
| 3a CTA | `Continue` |
| 3b heading | `Bring your friends.` |
| 3b subtext | `Mooves is only as good as the people on it.` |
| 3b CTA | `Share your link` |
| 3b skip link | `Skip for now` |
| Web Share title | `Join me on Mooves` |
| Web Share body | `See when your friends are free, without having to ask.` |
| Clipboard fallback CTA | `Copy link` |
| Clipboard confirmation | `Copied!` |

---

### Edge Cases

| Scenario | Handling |
|---|---|
| User closes app after 3a, before 3b | On next open: session exists, `display_name` set but `onboarding_complete = false` → resume at 3b |
| User closes app mid-3a (name not saved) | On next open: `display_name` null, `onboarding_complete = false` → resume at 3a |
| Photo upload fails | Show inline error: "Couldn't upload photo, try again." Retry button. Allow continuing without photo. |
| Name is only whitespace | "Continue" stays disabled (validate on change, trim before check) |
| Web Share not supported | Show "Copy link" button with clipboard fallback |
| User taps share sheet but dismisses without sharing | No event fired, stay on 3b. User can share again or skip. |
| User already has `onboarding_complete = true` | Should never reach Screen 3. Auth flow routes returning users to Home Feed directly. |

---

### PostHog Events (Screen 3)

| Event | When |
|---|---|
| `onboarding_name_entered` | User taps Continue on 3a |
| `onboarding_photo_added` | Photo successfully uploaded |
| `onboarding_photo_skipped` | User taps Continue on 3a with no photo |
| `onboarding_invite_tapped` | User taps "Share your link" |
| `onboarding_invite_shared` | Web Share API resolves successfully (user completed a share) |
| `onboarding_invite_skipped` | User taps "Skip for now" |
| `onboarding_completed` | User arrives at Home Feed from onboarding |

---

### Mockup Status

✅ `mooves-screen3-onboarding.html` -- approved

---

## Screen 4: Home Feed ✅

### Purpose

The heart of the app. Shows who's free right now. The feed is signal-only: only green friends appear. Grey friends are invisible until they go green. This keeps the feed high-value and noise-free.

The user's own status is always visible and always one tap away from changing.

---

### Layout Overview

```
┌─────────────────────────────┐
│  MOOVES wordmark   [avatar●] │  ← Header
├─────────────────────────────┤
│                             │
│  Free right now             │  ← Section label (or empty state)
│  ┌─────────────────────┐   │
│  │ 🟢 Jake M.          │   │  ← Friend card
│  │    up for anything  │   │
│  └─────────────────────┘   │
│  ┌─────────────────────┐   │
│  │ 🟢 Mia T.           │   │
│  └─────────────────────┘   │
│                             │
└─────────────────────────────┘
```

---

### Header

**Left:** Mooves wordmark (Plus Jakarta Sans 800, text primary color, with status dot OO treatment)

**Right:** Combined own-status indicator — a single tappable element containing:
- User's avatar (circular, 34px) with a status dot (green or grey, 10px) pinned bottom-right
- A small status pill immediately to the left of the avatar: `I'm free` (green bg, white text) or `Not free` (grey bg, muted text)
- Tapping either the pill or the avatar opens the Go Green sheet (Screen 5) if currently grey, or opens a "go grey" confirmation / the sheet if currently green

This keeps own-status visible at a glance without dominating the header.

---

### Friend Cards

Each green friend appears as a card in the list.

**Card anatomy (left to right):**
- Avatar (44px circular, photo or initials in Mooves Purple) with green status dot pinned bottom-right
- Name (Plus Jakarta Sans 700, 15px, text primary)
- Status note if present (Inter 400, 13px, text secondary) — shown as a second line below the name; omitted entirely if no note set
- No timestamp shown (time-since-green not displayed)

Cards are sorted by most-recently-green first.

Tapping a card navigates to Screen 6 (Friend Profile Tap).

---

### Feed States

| State | Condition | What's shown |
|---|---|---|
| **Active** | ≥1 friend is green | Section label "Free right now" + friend cards |
| **Quiet** | Friends exist, none green | Empty state message, no cards |
| **New user** | No friends yet | Invite nudge empty state |

---

### Empty State: Quiet (Friends Exist, None Green)

- No section label
- Centered in the feed area:
  - Copy: `Nobody's free yet.`
  - Sub-copy: `You could change that.` (tappable — opens Go Green sheet)
- No grey friend cards shown

---

### Empty State: New User (No Friends)

- Centered in the feed area:
  - Cow face illustration (small, ~80px)
  - Copy: `Your friends aren't here yet.`
  - Sub-copy: `They should be.`
  - CTA button: `Invite your friends` (full-width, Mooves Purple) — triggers native share sheet with referral link

This state persists until at least one mutual friendship exists.

---

### Realtime Updates

The feed subscribes to the `users` table via Supabase Realtime, filtering on friends of the current user. When a friend's `is_available` flips to `true`, their card animates into the feed. When it flips to `false`, their card slides out. No manual refresh required.

---

### Groups and the Feed

Groups are **not** visible on the feed. The feed always shows all green friends regardless of groups.

Groups exist to control **who can see you when you go green** — they are a broadcast targeting tool, configured on the Go Green sheet (Screen 5). The feed is always the full picture.

---

### Navigation

No bottom navigation bar in MVP. The header is the only persistent chrome. All other screens are accessed contextually:
- Own status → header avatar/pill (→ Screen 5)
- Friend tap → friend card (→ Screen 6)
- Friends list → accessible from Settings (Screen 10) in MVP; can promote later
- Settings → accessible via long-press or future nav addition (MVP: TBD)

---

### Copy

| Element | Copy |
|---|---|
| Section label (active feed) | `Free right now` |
| Own status pill (green) | `I'm free` |
| Own status pill (grey) | `Not free` |
| Quiet empty state headline | `Nobody's free yet.` |
| Quiet empty state sub | `You could change that.` |
| New user empty state headline | `Your friends aren't here yet.` |
| New user empty state sub | `They should be.` |
| New user empty state CTA | `Invite your friends` |

---

### Edge Cases

| Scenario | Handling |
|---|---|
| User's own status is green and they open the feed | Their avatar shows green dot; pill shows "I'm free" |
| Friend goes green while user is on feed | Card animates in via Realtime subscription |
| Friend goes grey while user is on feed | Card animates out |
| No internet connection | Show last known state; subtle "You're offline" banner |
| Friend has no status note | Name only on card; no second line |
| More friends than fit on screen | Scrollable list, no pagination (reasonable friend list sizes for MVP) |

---

### PostHog Events (Screen 4)

| Event | When |
|---|---|
| `feed_viewed` | Feed screen mounts |
| `feed_friend_tapped` | User taps a friend card |
| `feed_status_toggle_tapped` | User taps own avatar/pill in header |
| `feed_invite_tapped` | User taps "Invite your friends" on new-user empty state |
| `feed_go_green_nudge_tapped` | User taps "You could change that." on quiet empty state |

---

### Mockup Status

✅ `mooves-screen4-feed.html` -- approved

**Locked UI decisions (from mockup iteration):**
- Header: purple gradient, Mooves wordmark only (centered), no status control in header
- Status control: full-width button pinned above "Free right now" section label — "Not free" (outlined, muted) / "I'm free" (solid green)
- Friend cards: pale green tint background + subtle green border — no status dot
- Navigation: bottom nav bar with 3 tabs — Home, People, Settings (active tab in Mooves Purple)

---

## Screen 5: Go Green Sheet ✅

### Purpose

The core interaction of Mooves. Tapping "Not free" opens a minimal bottom sheet where the user signals availability and optionally adds context. Tapping "I'm free" when already green triggers a confirmation before going grey.

This sheet is deliberately minimal — get in, confirm, get out. The anti-engagement principle applies here too.

---

### Trigger Points

| Trigger | Action |
|---|---|
| Tap "Not free" button on feed | Opens Go Green sheet |
| Tap "I'm free" button on feed | Opens Go Grey action sheet confirmation |

---

### Go Green Sheet

**Presentation:** Slides up from the bottom as a modal sheet. Background feed is dimmed. Dismiss by tapping outside or the drag handle.

**Layout (top to bottom):**

- Drag handle (centered, 4×36px pill, muted)
- Section label: `What's the vibe?`
- Status note input:
  - Single-line text field, soft border
  - Placeholder: `up for anything, drinks?, etc.`
  - Max 60 characters
  - Optional — sheet can be submitted with no note
  - Keyboard appears automatically on sheet open
- Group selector (only shown if user has ≥1 group set up):
  - Section label: `Who can see you?`
  - Horizontally scrollable chip row
  - First chip: `Everyone` (default, pre-selected)
  - Subsequent chips: one per group (e.g. `Work`, `College`)
  - Multi-select: user can pick one or more groups instead of Everyone
  - If `Everyone` is selected and user taps a group chip, `Everyone` deselects automatically
- CTA: `I'm free` (full-width, solid green, large)

**Behavior:**
- Submitting with `Everyone` selected → `is_available = true`, `visible_to = null` (null means all friends)
- Submitting with specific groups → `is_available = true`, `visible_to = [group_id, ...]`
- Status note stored in `users.status_note`, cleared when going grey
- On confirm: sheet dismisses, feed button flips to "I'm free" (green), real-time update broadcasts to visible friends

---

### Go Grey Action Sheet

Triggered by tapping "I'm free" on the feed when already green.

**Style:** Native iOS-style action sheet from the bottom.

**Contents:**
- Title text: `You're going dark and won't be visible`
- Destructive button: `Go grey` (red text)
- Cancel button

**Behavior:**
- "Go grey" → `UPDATE users SET is_available = false, status_note = null, visible_to = null`
- Cancel → dismiss, no change
- On confirm: feed button flips back to "Not free"

---

### User Flows

**Going green:**
```
1. User taps "Not free" on feed
2. Go Green sheet slides up
3. (Optional) Type a status note
4. (Optional) Select specific groups instead of Everyone
5. Tap "I'm free"
6. → users.is_available = true, status_note saved, visible_to saved
7. Sheet dismisses, feed button → "I'm free" (green)
8. Real-time: friends who can see user receive update, user's card appears in their feed
```

**Going grey:**
```
1. User taps "I'm free" on feed
2. Action sheet: "You're going dark and won't be visible" / "Go grey" / "Cancel"
3. Tap "Go grey"
4. → users.is_available = false, status_note = null, visible_to = null
5. Feed button → "Not free"
6. Real-time: user's card removed from friends' feeds
```

**Editing while green (future):**
Going green again while already green is not handled in MVP — the "I'm free" button goes directly to the go-grey confirmation. Editing note/groups while green is a Phase 2 feature.

---

### Data Changes

```sql
-- Going green
UPDATE users SET
  is_available = true,
  status_note = '[text or null]',
  visible_to = '[{group_id,...} or null]',  -- null = everyone
  status_set_at = NOW()
WHERE id = auth.uid();

-- Going grey
UPDATE users SET
  is_available = false,
  status_note = null,
  visible_to = null,
  status_set_at = NOW()
WHERE id = auth.uid();
```

Note: `visible_to` requires a `jsonb` or array column on `users`. Add `visible_to UUID[] DEFAULT NULL` to the schema. Null means all friends can see; an array of group IDs means only members of those groups.

---

### Copy

| Element | Copy |
|---|---|
| Sheet note label | `What's the vibe?` |
| Note placeholder | `up for anything, drinks?, etc.` |
| Group label | `Who can see you?` |
| Default group chip | `Everyone` |
| Sheet CTA | `I'm free` |
| Action sheet title | `You're going dark and won't be visible` |
| Action sheet destructive | `Go grey` |
| Action sheet cancel | `Cancel` |

---

### Edge Cases

| Scenario | Handling |
|---|---|
| User submits note with only whitespace | Trim; treat as no note (store null) |
| User has no groups | Group selector hidden entirely |
| User selects specific groups then re-selects Everyone | Deselect all group chips, Everyone re-selects |
| Network error on green submit | Show inline error: "Couldn't update, try again." Keep sheet open. |
| User already green, re-opens app | Feed shows "I'm free" button, Supabase session maintains state |

---

### PostHog Events (Screen 5)

| Event | When |
|---|---|
| `go_green_sheet_opened` | Sheet slides up |
| `go_green_confirmed` | User taps "I'm free" |
| `go_green_with_note` | Confirmed with a non-empty status note |
| `go_green_with_groups` | Confirmed with specific groups (not Everyone) |
| `go_grey_sheet_opened` | Go grey action sheet appears |
| `go_grey_confirmed` | User taps "Go grey" |
| `go_grey_cancelled` | User taps Cancel |

---

### Mockup Status

✅ `mooves-screen5-gogreen.html` -- approved

**Locked UI decisions:** Vertical checkbox list for group selector (not chips). Go grey action sheet title: "You're going dark and won't be visible".

---

## Screen 6: Friend Tap → SMS Handoff ✅

### Purpose

When a user taps a green friend's card in the feed, they go directly to the native Messages app to text that friend. No profile screen, no intermediate step. This is the most important anti-engagement decision in the product: Mooves gets out of the way and puts you in a real conversation immediately.

---

### Behavior (No UI)

This is not a screen. It is a single action fired on card tap.

```
User taps friend card
→ window.location.href = `sms:${friend.phone}`
→ Native SMS/iMessage app opens with a blank thread to that number
→ Mooves goes to background
```

No pre-filled message text. No confirmation step. No animation beyond the native OS transition.

---

### Technical Implementation

- Friend's phone number is available from the `users` table (fetched as part of the friends query on feed load)
- Use the `sms:` URL scheme, which works on both iOS and Android
- On iOS: opens iMessage if available, falls back to SMS
- On Android: opens default messaging app
- No fallback needed — all Mooves users have a verified phone number by definition

**Feed query must include phone:**
```sql
SELECT u.id, u.display_name, u.avatar_url, u.status_note, u.phone
FROM users u
JOIN friendships f ON f.friend_id = u.id
WHERE f.user_id = auth.uid()
  AND u.is_available = true
ORDER BY u.status_set_at DESC
```

**On tap (Next.js):**
```ts
window.location.href = `sms:${friend.phone}`
```

---

### Privacy Note

By becoming mutual friends on Mooves, both users implicitly share their phone numbers with each other (since phone is the identity layer). This is by design and consistent with how phone-number-based social apps (WhatsApp, Signal, etc.) work. No additional consent screen needed.

---

### PostHog Event

| Event | When |
|---|---|
| `friend_tap_sms_opened` | Card tapped, sms: URL fired |

---

### Mockup Status

No mockup — this is a native OS handoff, not a Mooves UI screen.

---

## Screen 8: Friends List 🔄

### Purpose

A simple, read-only directory of all your Mooves connections — green and grey alike. The feed only shows who's free right now; the Friends List is the complete picture. It also surfaces the invite action persistently, since growing your network directly improves the value of the feed.

---

### Access

"People" tab in the bottom nav bar (second tab, locked from Screen 4 mockup).

---

### Layout Overview

```
┌─────────────────────────────┐
│  Friends                    │  ← Screen heading
│  ┌─────────────────────┐   │
│  │ 🔍 Search friends   │   │  ← Search bar (always visible)
│  └─────────────────────┘   │
│                             │
│  ┌─────────────────────┐   │
│  │ [avatar] Alex B.    │   │  ← Friend row
│  └─────────────────────┘   │
│  ┌─────────────────────┐   │
│  │ [avatar] Jamie T.   │   │
│  └─────────────────────┘   │
│  ┌─────────────────────┐   │
│  │ [avatar] Mia L.     │   │
│  └─────────────────────┘   │
│                             │
│  [ Invite friends ]         │  ← Sticky CTA, above bottom nav
├─────────────────────────────┤
│  🏠  👥  ⚙️                │  ← Bottom nav (People active)
└─────────────────────────────┘
```

---

### Screen Heading

- `Friends` — Plus Jakarta Sans 700, text primary, standard screen-top placement
- Friend count shown as secondary text: `12 friends` (Inter 400, text secondary)

---

### Search Bar

- Always visible below the heading; not collapsible
- Placeholder: `Search friends`
- Filters the list client-side as the user types (no debounce needed at MVP friend list sizes)
- Clearing the input restores the full alphabetical list
- If no results match the query: show inline empty state (see below)

---

### Friend Rows

Each friend is a single row:

- **Avatar** (36px circular, photo or initials in Mooves Purple) — left-aligned
- **Display name** (Inter 500, 15px, text primary) — single line, truncated with ellipsis if long
- No status dot, no status note, no timestamp — this list is intentionally status-blind

Rows are sorted **alphabetically by display name**, always. No grouping by status.

**Tap behavior:** None — rows are not tappable. The Friends List is display-only.

---

### Remove Friend (Swipe Gesture)

Swiping a row left reveals a destructive action:

- Swipe left on any row → red `Remove` button appears on the right edge
- Tapping `Remove` opens a confirmation sheet:
  - Title: `Remove [Name]?`
  - Body: `They won't be able to see you on Mooves, and you won't see them.`
  - Destructive button: `Remove`
  - Cancel button: `Cancel`
- On confirm:
  - Both friendship rows deleted (`user_id → friend_id` and `friend_id → user_id`)
  - Row animates out of the list
  - Friend count decrements
- On cancel: row snaps back, no change

---

### Sticky Invite Button

- Pinned above the bottom nav bar, full-width (with standard horizontal padding)
- Label: `Invite friends`
- Style: Mooves Purple fill, white text, Inter 600
- Behavior: triggers native Web Share API with user's referral link (same as Screen 3b)
  - `title`: `Join me on Mooves`
  - `text`: `See when your friends are free, without having to ask.`
  - `url`: `https://makemooves.app/join/[referral_code]`
- Desktop fallback: copies link to clipboard, brief `Copied!` confirmation on the button

---

### Screen States

| State | Condition | What's shown |
|---|---|---|
| **Friends present** | ≥1 mutual friendship | Search bar + alphabetical list + sticky invite button |
| **Empty (no friends)** | 0 mutual friendships | Empty state message + sticky invite button |
| **Search — results** | Query matches ≥1 friend | Filtered list |
| **Search — no results** | Query matches 0 friends | Inline empty state below search bar |

---

### Empty State: No Friends

Centered in the list area (above the sticky invite button):

- Cow face illustration (~72px)
- Headline: `Nobody here yet.`
- Sub-copy: `Invite your people, and they'll show up here.`

The sticky `Invite friends` button is still present and is the primary CTA.

---

### Empty State: Search — No Results

Inline, directly below the search bar:

- Copy: `No friends named "[query]"`
- No illustration — keep it compact

---

### Technical Notes

**Friends query:**
```sql
SELECT u.id, u.display_name, u.avatar_url
FROM users u
JOIN friendships f ON f.friend_id = u.id
WHERE f.user_id = auth.uid()
ORDER BY u.display_name ASC
```

**Remove friendship:**
```sql
DELETE FROM friendships
WHERE (user_id = auth.uid() AND friend_id = :friend_id)
   OR (user_id = :friend_id AND friend_id = auth.uid());
```

**Search:** Client-side filter on `display_name` using `String.toLowerCase().includes(query.toLowerCase())`. No server round-trip needed at MVP scale.

**Friend count:** Derived from the query result length — no separate count query needed.

---

### Copy

| Element | Copy |
|---|---|
| Screen heading | `Friends` |
| Friend count | `[N] friend` / `[N] friends` (singular/plural) |
| Search placeholder | `Search friends` |
| Swipe action | `Remove` |
| Confirm sheet title | `Remove [Name]?` |
| Confirm sheet body | `They won't be able to see you on Mooves, and you won't see them.` |
| Confirm destructive | `Remove` |
| Confirm cancel | `Cancel` |
| Sticky CTA | `Invite friends` |
| Empty state headline | `Nobody here yet.` |
| Empty state sub | `Invite your people, and they'll show up here.` |
| Search no-results | `No friends named "[query]"` |

---

### Edge Cases

| Scenario | Handling |
|---|---|
| Display name is very long | Truncate with ellipsis at row width; full name visible in confirm sheet |
| User has 0 friends | Show empty state; sticky invite button is the primary action |
| User removes last friend | List transitions to empty state |
| Network error on remove | Show inline error toast: "Couldn't remove [Name], try again." Row snaps back. |
| User tries to search with only spaces | Treat as empty query; show full list |
| Realtime: a friendship is created while on this screen | Row appears and list re-sorts alphabetically |

---

### PostHog Events (Screen 8)

| Event | When |
|---|---|
| `friends_list_viewed` | People tab mounted |
| `friends_list_search_used` | User types in search bar (fire once per session open, not per keystroke) |
| `friends_remove_initiated` | Swipe-to-remove action opened |
| `friends_remove_confirmed` | Remove confirmed |
| `friends_remove_cancelled` | Remove cancelled |
| `friends_invite_tapped` | Sticky invite button tapped |

---

### Mockup Status

✅ `mooves-screen8-friends-list.html` — approved

**Locked UI decisions (from mockup):**
- Screen heading: "Friends" + friend count as subtitle
- Sort: alphabetical always, no status grouping
- Row content: avatar + name only (no status dot, no note)
- Row tap: no action — list is display-only
- Remove: swipe left → red "Remove" button → confirmation sheet
- Sticky "Invite friends" button pinned above bottom nav
- Empty state: cow illustration + "Nobody here yet." + "Invite your people, and they'll show up here."
- Groups integration: deferred to Screen 9 — People tab layout (sub-tabs vs. single scroll) resolved there

---

## Screen 9: Groups Management 🔄

### Purpose

Groups let users target their availability signal: instead of going green for everyone, they can broadcast to a specific group (e.g. "College friends", "Work crew"). This screen is where users create, edit, and delete those groups. It lives alongside the Friends list in the People tab, accessed via a "Groups" sub-tab.

---

### People Tab Layout Update (from Screen 8)

The People tab now has two sub-tabs at the top:

```
[ Friends ]  [ Groups ]
```

- Sub-tab bar sits directly below the status bar area, above the tab-specific content
- Active sub-tab: Mooves Purple text, solid underline indicator
- Inactive sub-tab: text-secondary, no indicator
- The Friends sub-tab shows the Screen 8 content exactly as approved (search bar + friend list + invite button)
- The Groups sub-tab shows Screen 9 content

A create-group control appears in the top-right corner of the header **only when the Groups sub-tab is active**. Tapping it navigates to the Create Group screen. *(Phase 8 §8.2 upgrades this from an unlabeled `+` icon to an always-visible **labeled** control.)*

---

### Groups Sub-tab: List View

**Layout (top to bottom):**

- Sub-tab bar (Friends | Groups — Groups active)
- `+` button in top-right of header
- Scrollable list of groups

**Group rows** — each row contains:
- **Emoji icon** (42px rounded square, purple-tint background) — shows the group's chosen emoji
- **Group name** (Inter 600, 15px, text-primary)
- **Member count** below: `[N] friends` (Inter 400, 13px, text-secondary)
- Chevron `›` on the right — row is tappable

**Tap behavior:** Opens the Edit Group screen for that group.

**Sort order:** Creation order (oldest first). No alphabetical sort — users will likely keep a small number of named groups.

**Swipe left to delete:** Same pattern as friends list — swipe reveals a red `Delete` button. Tapping opens a confirmation sheet (see below).

---

### Groups Sub-tab: Empty State

When the user has no groups:

- Centered in the list area:
  - Headline: `No groups yet.`
  - Sub-copy: `Groups let you choose who sees you when you go green.`
  - CTA button: `Create a group` (Mooves Purple, full-width) — same action as the `+` button

---

### Delete Group Confirmation Sheet

Triggered by: swipe left → tap `Delete`, **or** Delete button inside the Edit Group screen.

- Title: `Delete [Group name]?`
- Body: `Your friends won't be affected, this just removes the group.`
- Destructive button: `Delete`
- Cancel button: `Cancel`

---

### Create Group Screen

A full screen pushed on top of the People tab. Not a sheet — full navigation push.

**Header:**
- Back button (`←`) top-left — discards changes and pops back
- Title: `New group` (centered, Plus Jakarta Sans 700)
- `Done` button top-right — disabled until name is non-empty AND at least 1 member is selected; tapping saves and pops back

**Body (top to bottom):**

1. **Emoji + name row** (single combined row)
   - Left: emoji tap target (50px rounded square, purple-tint background)
     - Default emoji on create: 👥
     - Small edit badge (pencil icon) pinned bottom-right of the square
     - Tapping opens the Emoji Picker sheet (see below)
   - Right: two-line stack
     - Label: `Group name` (small caps, text-secondary)
     - Text input below, single line, `e.g. College friends` placeholder
   - Max name length: 40 characters

2. **Friends section**
   - Section label: `Add friends` (with `[N] selected` count shown on the right when ≥1 checked)
   - **Search bar** directly below the label — filters the friend checklist as the user types, client-side
     - Placeholder: `Search friends`
     - Clears to show all friends when emptied
   - Full scrollable checklist of all the user's friends (filtered by search query)
   - Each row: avatar (36px) + display name + circular checkbox on the right
   - Checkbox style: unchecked = empty circle; checked = Mooves Purple fill with white checkmark
   - Tapping anywhere on the row toggles the checkbox
   - Friends sorted alphabetically

3. **Empty friends warning** (only if user has 0 friends): `Add some friends first, then you can create a group.` — no checklist shown.

**Emoji Picker sheet:**
- Slides up as a bottom sheet over the create/edit screen
- Title: `Pick an emoji`
- Curated grid of ~21 emoji (7 per row, 3 rows) covering common group vibes: 🤝 👥 ⭐ 🎓 💼 🏠 🏋️ 🎉 🍕 🎮 🎸 ✈️ 🏄 🌙 🔥 💯 🐶 🌿 ☕ 🎨 📍
- Selected emoji has a purple-tint background + purple outline
- Tapping an emoji: updates the group icon, dismisses the sheet
- No "save" button needed — selection is immediate

**Save behavior:**
- On `Done`: `INSERT INTO groups (owner_id, name) + INSERT INTO group_members` for each selected friend
- Pop back to Groups tab; new group appears at bottom of list

---

### Edit Group Screen

Same layout as Create Group, with these differences:

**Header:**
- Title: group name (editable — tapping the name field focuses it)
- `Done` button: saves any changes made (name or members)

**Body:**
- Name field pre-filled with current group name
- Friend checklist with current members pre-checked
- Adding/removing checks adjusts membership on save

**Bottom of screen (below the friend list):**
- `Delete group` — red text button, centered, with adequate tap target
- Tapping opens the Delete confirmation sheet

**Save behavior (on `Done`):**
- Update `groups.name` if changed
- Diff member list: `INSERT` new members, `DELETE` removed members
- Pop back to Groups tab

---

### Technical Notes

**Schema:**
```sql
groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  emoji TEXT NOT NULL DEFAULT '👥',  -- single emoji character
  created_at TIMESTAMPTZ DEFAULT NOW()
)

group_members (
  group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (group_id, user_id)
)
```

**Groups query (for Groups tab list):**
```sql
SELECT g.id, g.name, COUNT(gm.user_id) AS member_count
FROM groups g
LEFT JOIN group_members gm ON gm.group_id = g.id
WHERE g.owner_id = auth.uid()
GROUP BY g.id
ORDER BY g.created_at ASC
```

**Delete group:** `DELETE FROM groups WHERE id = :group_id AND owner_id = auth.uid()` — cascades to `group_members` via FK.

**Go Green integration (Screen 5):** The group selector on the Go Green sheet pulls from `groups` where `owner_id = auth.uid()`. Groups with 0 members are valid but won't broadcast to anyone — acceptable edge case, no special handling.

---

### Copy

| Element | Copy |
|---|---|
| Sub-tab: friends | `Friends` |
| Sub-tab: groups | `Groups` |
| Empty headline | `No groups yet.` |
| Empty sub | `Groups let you choose who sees you when you go green.` |
| Empty CTA | `Create a group` |
| Swipe action | `Delete` |
| Delete sheet title | `Delete [Group name]?` |
| Delete sheet body | `Your friends won't be affected, this just removes the group.` |
| Delete sheet destructive | `Delete` |
| Delete sheet cancel | `Cancel` |
| Create screen title | `New group` |
| Create name placeholder | `e.g. College friends` |
| Create friends label | `Add friends` |
| Create done button | `Done` |
| Edit delete button | `Delete group` |
| Zero friends warning | `Add some friends first, then you can create a group.` |

---

### Edge Cases

| Scenario | Handling |
|---|---|
| User creates a group with 0 members | Not possible — `Done` stays disabled until ≥1 member selected |
| User removes all members while editing | `Done` becomes disabled; user must re-add or cancel |
| Group name is only whitespace | Trim; `Done` stays disabled |
| User has no friends | Checklist shows "Add some friends first" — can't create a group |
| Group deleted while user is on the Go Green sheet | Group chip disappears from sheet on next open; no crash |
| Two groups with same name | Allowed — no uniqueness constraint on name |
| Network error on save | Inline error banner: "Couldn't save, try again." Stay on create/edit screen. |

---

### PostHog Events (Screen 9)

| Event | When |
|---|---|
| `groups_tab_viewed` | Groups sub-tab tapped |
| `group_create_started` | + button or empty state CTA tapped |
| `group_create_completed` | Done tapped, group saved successfully |
| `group_edit_opened` | Group row tapped |
| `group_edit_saved` | Done tapped on edit screen |
| `group_delete_initiated` | Swipe or delete button tapped |
| `group_delete_confirmed` | Delete confirmed in sheet |
| `group_delete_cancelled` | Delete cancelled |

---

### Mockup Status

✅ `mooves-screen9-groups.html` — approved

**Locked UI decisions (from mockup iteration):**
- Group rows: emoji in a 42px purple-tint rounded square + group name + member count + chevron
- Emoji picker: bottom sheet, curated grid of 21 emoji, immediate selection on tap
- Create/edit layout: emoji tap target + name field in a single combined row at top
- Friend checklist has a search bar for filtering — essential for large friend lists
- Selected count shown inline ("3 selected") when editing
- Delete group: both swipe-left on list row AND button at bottom of edit screen

---

## Screen 10: Settings / Profile Edit 🔄

### Purpose

A minimal settings screen covering the three things a user might genuinely need: updating their profile, logging out, and deleting their account. No feature bloat — every item here has a clear reason to exist in MVP.

---

### Access

Settings tab (third tab) in the bottom nav bar.

---

### Layout Overview

The screen is a single scrollable view — no sub-navigation. Profile edits happen inline.

```
┌─────────────────────────────┐
│  Settings                   │  ← Screen heading
├─────────────────────────────┤
│         [avatar 80px]       │  ← Tappable, opens photo action sheet
│         Jackson             │  ← Tappable name field
│     +1 (555) 123-4567       │  ← Read-only phone, muted
├─────────────────────────────┤
│  Log out                    │  ← Tappable row
├─────────────────────────────┤
│  Delete account             │  ← Tappable row (red text)
└─────────────────────────────┘
```

---

### Profile Section

**Avatar**
- 80px circular, centered at top of the profile area
- User's photo or initials in Mooves Purple (same as everywhere else)
- Small camera badge (📷 icon, 26px, white bg, purple icon) pinned bottom-right
- Tapping anywhere on the avatar opens a native action sheet:
  - `Take a photo`
  - `Choose from library`
  - `Remove photo` (only shown if user currently has a photo)
  - `Cancel`
- On photo selection: circular crop UI → confirm → upload to Supabase Storage → `users.avatar_url` updated
- Auto-saves on crop confirm — no separate Save button

**Display name**
- Shown below the avatar, centered
- Font: Plus Jakarta Sans 700, 20px, text-primary
- Tapping the name makes it editable inline (becomes an input field, keyboard appears)
- Small edit icon (pencil) appears beside the name when not in edit mode as a tap hint
- Auto-saves on blur (field loses focus) — trims whitespace, rejects empty value
- If user clears and blurs with an empty field: revert to previous name, no save
- Max 30 characters (same as onboarding)

**Phone number**
- Shown below the name, centered
- Font: Inter 400, 14px, text-secondary
- Formatted: `+1 (555) 123-4567`
- Non-interactive — no tap target, no edit
- A small lock icon (🔒) or muted styling makes clear it's read-only

---

### Account Section

Two centered pill buttons, not full-width, with appropriate horizontal padding. Centered on the page.

**Log out**
- Button: `Log out` — purple-tint background, Mooves Purple text, pill shape (border-radius: 100px)
- Tapping opens a confirmation sheet:
  - Title: `Log out?`
  - Body: `You'll need to verify your number again to get back in.`
  - Button: `Log out` (purple fill)
  - Cancel button
- On confirm: Supabase `signOut()` → clears session → redirect to Screen 2 (phone entry)

**Delete account**
- Button: `Delete account` — red-tint background, red text (`#E8405A`), pill shape
- Tapping opens a type-to-confirm sheet:
  - Title: `Delete your account?`
  - Body: `This permanently removes your profile, friendships, and groups. Type DELETE to confirm.`
  - Text input: placeholder `Type DELETE`
  - Destructive button: `Delete account` — disabled until input exactly equals `DELETE` (case-sensitive)
  - Cancel button
- On confirm:
  - Hard-delete `users` row (cascades via FK to friendships, groups, group_members)
  - Supabase `signOut()`
  - Redirect to Screen 1 (invite landing / root)

---

### Screen States

| State | Condition | What's shown |
|---|---|---|
| **Default** | Normal view | Profile area + account rows |
| **Name editing** | User tapped name | Name becomes input field, keyboard up, field has purple border |
| **Log out confirm** | Log out row tapped | Confirmation sheet overlay |
| **Delete confirm** | Delete account row tapped | Type-to-confirm sheet overlay |

---

### Technical Notes

**Profile updates (auto-save on blur):**
```sql
UPDATE users SET display_name = :name WHERE id = auth.uid();
```

**Photo update:**
- Upload to Supabase Storage: `avatars/[user_id].[ext]`
- `UPDATE users SET avatar_url = :url WHERE id = auth.uid()`
- Use `upsert` so re-uploading replaces the old file

**Photo removal:**
- Delete from Storage
- `UPDATE users SET avatar_url = NULL WHERE id = auth.uid()`

**Account deletion (hard delete):**
```sql
-- FK cascades handle friendships, groups, group_members
DELETE FROM users WHERE id = auth.uid();
-- Then call Supabase Admin API to delete auth.users row
```
Note: Deleting from `auth.users` requires the Supabase Admin API (service role key), called from a secure server function — not directly from the client.

**Log out:**
```ts
await supabase.auth.signOut()
// Clears session cookie; redirect to /
```

---

### Copy

| Element | Copy |
|---|---|
| Screen heading | `Settings` |
| Avatar action: take photo | `Take a photo` |
| Avatar action: choose library | `Choose from library` |
| Avatar action: remove | `Remove photo` |
| Phone row label | Formatted number only — no label |
| Log out row | `Log out` |
| Log out sheet title | `Log out?` |
| Log out sheet body | `You'll need to verify your number again to get back in.` |
| Log out sheet CTA | `Log out` |
| Log out sheet cancel | `Cancel` |
| Delete row | `Delete account` |
| Delete sheet title | `Delete your account?` |
| Delete sheet body | `This permanently removes your profile, friendships, and groups. Type DELETE to confirm.` |
| Delete input placeholder | `Type DELETE` |
| Delete sheet CTA (disabled) | `Delete account` |
| Delete sheet CTA (enabled) | `Delete account` |
| Delete sheet cancel | `Cancel` |

---

### Edge Cases

| Scenario | Handling |
|---|---|
| User clears name field and blurs | Revert to previous name silently — no error shown |
| Name is only whitespace on blur | Trim → treat as empty → revert |
| Photo upload fails | Brief error toast: "Couldn't update photo, try again." Revert to previous avatar. |
| User types "delete" (lowercase) in delete confirm | Button stays disabled — must be exact uppercase `DELETE` |
| Session expired before log out | `signOut()` still clears local state — redirect to auth |
| Account deletion fails | Error toast: "Something went wrong, try again." Account not deleted. |

---

### PostHog Events (Screen 10)

| Event | When |
|---|---|
| `settings_viewed` | Settings tab mounted |
| `settings_name_updated` | Name auto-saved on blur |
| `settings_photo_updated` | Photo successfully uploaded |
| `settings_photo_removed` | Photo removed |
| `settings_logout_initiated` | Log out row tapped |
| `settings_logout_confirmed` | Log out confirmed |
| `settings_delete_initiated` | Delete account row tapped |
| `settings_delete_confirmed` | Delete confirmed (after typing DELETE) |

---

### Mockup Status

✅ `mooves-screen10-settings.html` — approved

**Locked UI decisions (from mockup iteration):**
- Profile edits inline — no sub-navigation
- Avatar: 80px centered, camera badge pinned bottom-right, auto-saves on crop confirm
- Name: tappable with pencil hint icon, editable inline, auto-saves on blur
- Phone: read-only with lock icon, muted styling
- Log out + Delete account: centered pill buttons (not full-width), tinted backgrounds
- Confirmation sheets: centered pill buttons (not full-width), min-width 200px
- Delete account: type-to-confirm "DELETE" (case-sensitive) before button enables

---

## Screen 11: SMS Feed Check (Twilio Flow) ✅

### Purpose

A zero-friction way to check who's free without opening the app. The user texts the Mooves Twilio number — any message triggers it — and gets back a list of their green friends. Useful for low-intent moments: glancing at the phone, not wanting to open an app.

No mockup — this is a backend/Twilio flow, not a UI screen.

---

### How It Works

```
1. User sends any SMS to the Mooves Twilio number
2. Twilio receives the inbound message → fires webhook to POST /api/sms/inbound
3. Server looks up the sender's phone number in the users table
4. Server queries that user's green friends
5. Server composes a reply and returns it as TwiML
6. Twilio sends the reply SMS back to the user
```

---

### Inbound Trigger

**Any inbound message triggers the feed check.** No keyword required. The content of the inbound message is ignored entirely. This maximizes accessibility — users don't need to remember a command.

---

### Reply Format

**1+ friends green:**
```
Jake M. (up for anything) and Mia T. are free right now.
```
- Friends listed by first name + last initial
- Status note in parentheses immediately after the name — omitted if no note set
- If 1 friend: `[Name] is free right now.`
- If 2 friends: `[Name] and [Name] are free right now.`
- If 3–4 friends: `[Name], [Name], and [Name] are free right now.`
- If 5+ friends: `[Name], [Name], [Name], and [N] others are free right now.` (cap at 3 named, remainder as count)

**No friends green:**
```
Nobody's free right now. You could be first — open Mooves to go green.
```

**User has no friends yet:**
```
You haven't connected with anyone on Mooves yet. Open the app to invite some friends.
```

**Number not found in users table (not a Mooves user):**
```
Hey! Looks like you're not on Mooves yet. Join at makemooves.app
```

---

### Technical Implementation

**Twilio webhook endpoint:**
```
POST /api/sms/inbound
```

Twilio sends a form-encoded POST with `From` (sender's phone in E.164 format) and `Body` (message content, ignored).

**Handler logic:**
```ts
export async function POST(req: Request) {
  const body = await req.formData()
  const from = body.get('From') as string  // e.g. '+15551234567'

  // 1. Look up sender in users table
  const { data: sender } = await supabase
    .from('users')
    .select('id, display_name')
    .eq('phone', from)
    .single()

  if (!sender) {
    return twimlResponse("Hey! Looks like you're not on Mooves yet. Join at makemooves.app")
  }

  // 2. Query green friends (respecting visible_to)
  const { data: greenFriends } = await supabase
    .from('users')
    .select('display_name, status_note, visible_to')
    .in('id', /* friend IDs from friendships table */)
    .eq('is_available', true)

  // 3. Filter: only friends whose visible_to includes sender (or is null)
  const visible = greenFriends.filter(f =>
    f.visible_to === null || f.visible_to.includes(sender.id)
  )

  // 4. Compose reply
  const reply = composeReply(visible)
  return twimlResponse(reply)
}

function twimlResponse(message: string) {
  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${message}</Message></Response>`,
    { headers: { 'Content-Type': 'text/xml' } }
  )
}
```

**Visibility filter:** The SMS check must respect the `visible_to` field — if a friend went green for a specific group that doesn't include the SMS-checking user, they should not appear in the reply.

**Twilio configuration:**
- Inbound webhook URL: `https://makemooves.app/api/sms/inbound`
- HTTP method: POST
- Twilio number: the dedicated Mooves toll-free number (separate from auth OTP number)

**Supabase service role:** The SMS handler runs server-side and uses the Supabase service role key (not the anon key) to query across user data securely.

---

### Reply Composition Logic

```ts
function composeReply(friends: GreenFriend[]): string {
  if (friends.length === 0) {
    return "Nobody's free right now. You could be first — open Mooves to go green."
  }

  const format = (f: GreenFriend) =>
    f.status_note ? `${f.display_name} (${f.status_note})` : f.display_name

  if (friends.length <= 4) {
    const names = friends.map(format)
    const list = names.length === 1
      ? names[0]
      : names.slice(0, -1).join(', ') + ' and ' + names[names.length - 1]
    const verb = friends.length === 1 ? 'is' : 'are'
    return `${list} ${verb} free right now.`
  }

  // 5+ friends: name first 3, count the rest
  const named = friends.slice(0, 3).map(format).join(', ')
  const rest = friends.length - 3
  return `${named}, and ${rest} others are free right now.`
}
```

---

### Copy

| State | Reply |
|---|---|
| 1 friend green | `[Name (note)] is free right now.` |
| 2–4 friends green | `[Name], [Name], and [Name] are free right now.` |
| 5+ friends green | `[Name], [Name], [Name], and [N] others are free right now.` |
| No friends green | `Nobody's free right now. You could be first — open Mooves to go green.` |
| No friends at all | `You haven't connected with anyone on Mooves yet. Open the app to invite some friends.` |
| Unknown number | `Hey! Looks like you're not on Mooves yet. Join at makemooves.app` |

---

### Edge Cases

| Scenario | Handling |
|---|---|
| User texts from a number not on file | "not on Mooves yet" reply — no user lookup error exposed |
| Friend's status note contains special XML chars (`<`, `>`, `&`) | Escape before inserting into TwiML |
| Twilio fires duplicate webhooks | Idempotent handler — same query, same reply, no side effects |
| User has friends but all are hidden (visible_to excludes sender) | Treat as "nobody's free" — don't reveal existence of hidden green friends |
| SMS longer than 160 chars (multiple segments) | Twilio handles multi-part SMS automatically — no action needed |

---

### PostHog Event

| Event | When |
|---|---|
| `sms_feed_check` | Inbound SMS received from a known Mooves user |

Fired server-side via PostHog's Node SDK before returning the TwiML response.

---

## Screen 12: Invite Deep-Link Flow (Technical) ✅

### Purpose

Specifies the complete technical implementation of the `/join/[code]` invite link — from Next.js route setup through link preview metadata, referral code persistence across auth, and friendship creation. The user-facing states (A/B/C/D) are fully covered in Screen 1. This document covers what a developer needs to implement it correctly.

No mockup — this is a technical implementation spec.

---

### Next.js Route Structure

```
app/
  join/
    [code]/
      page.tsx       ← main invite landing page (Screen 1)
      opengraph-image.tsx  ← dynamic OG image for link previews
```

**`app/join/[code]/page.tsx`** is a Server Component. It runs `generateMetadata` and the initial inviter lookup server-side so the page is pre-rendered with the right content for crawlers and link previewers.

```ts
// app/join/[code]/page.tsx

export async function generateMetadata({ params }: { params: { code: string } }) {
  const inviter = await getInviterByCode(params.code)

  if (!inviter) {
    return {
      title: 'Join Mooves',
      description: 'See when your friends are free, without having to ask.',
      openGraph: {
        title: 'Join Mooves',
        description: 'See when your friends are free, without having to ask.',
        url: 'https://makemooves.app',
        siteName: 'Mooves',
      }
    }
  }

  return {
    title: `${inviter.display_name} invited you to Mooves`,
    description: 'See when your friends are free, without having to ask.',
    openGraph: {
      title: `${inviter.display_name} invited you to Mooves`,
      description: 'See when your friends are free, without having to ask.',
      url: `https://makemooves.app/join/${params.code}`,
      siteName: 'Mooves',
      images: [{ url: `/join/${params.code}/opengraph-image` }],
    }
  }
}
```

**Why server-side:** iMessage, WhatsApp, and Twitter fetch OG tags server-side when the link is first shared. If the page were client-rendered, crawlers would see an empty shell and the preview would show no inviter name or image.

---

### Dynamic OG Image

`app/join/[code]/opengraph-image.tsx` uses Next.js's built-in `ImageResponse` to generate a 1200×630 image on the fly:

- Mooves wordmark
- Inviter's avatar (fetched from Supabase Storage URL)
- Copy: `[Name] invited you to Mooves`
- Purple gradient background

This image appears when the link is pasted into iMessage, Slack, Twitter, etc. It's a meaningful conversion driver — a friend's face in the preview is far more compelling than a generic link.

```ts
// app/join/[code]/opengraph-image.tsx
import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const size = { width: 1200, height: 630 }

export default async function OGImage({ params }: { params: { code: string } }) {
  const inviter = await getInviterByCode(params.code)
  // render JSX → PNG via ImageResponse
}
```

---

### Referral Code Persistence

The referral code must survive the auth redirect (Screen 2) so it's available after OTP verification to auto-create the friendship.

**Primary method: `sessionStorage`**
```ts
// On invite page load (client-side, in a useEffect)
sessionStorage.setItem('mooves_invite_code', params.code)
```

**Fallback: URL search parameter**
If `sessionStorage` is unavailable (iOS private browsing, some in-app browsers), fall back to passing the code as a query parameter through the auth flow:

```ts
// When navigating to auth from the invite page:
router.push(`/auth?invite=${params.code}`)

// In the auth flow, before redirecting post-OTP:
const inviteCode = searchParams.get('invite') ?? sessionStorage.getItem('mooves_invite_code')
```

The auth screen reads the `invite` query param and carries it forward through the OTP flow so it's available at the point of friendship creation regardless of sessionStorage support.

**Clearing the code:**
Once the friendship is successfully created (POST /api/friendships succeeds), clear both storage locations:
```ts
sessionStorage.removeItem('mooves_invite_code')
// URL param naturally disappears as the user navigates to the feed
```

---

### Full Referral Chain

```
1. User taps makemooves.app/join/[code]
   → sessionStorage.setItem('mooves_invite_code', code)
   → Server renders page with inviter name/photo

2. User taps CTA → navigate to /auth?invite=[code]
   → Auth screen reads `invite` param, passes it through OTP flow

3. OTP verified → Supabase session created
   → Check users table:
     a. No row → new user → Onboarding (Screen 3) → Home Feed
     b. Row exists, not friends → skip onboarding → Home Feed

4. On arrival at Home Feed:
   → Resolve invite code (sessionStorage ?? URL param)
   → POST /api/friendships { referral_code: code }
   → 201: friendship created → toast "[Name] is now your Mooves friend!"
   → 409: already friends → toast "You can already see [Name] on Mooves!"
   → Clear invite code from sessionStorage

5. PostHog funnel events fire at each step (see below)
```

---

### API Endpoints (Consolidated)

**Inviter lookup (public, no auth):**
```
GET /api/invite/[code]
→ 200: { display_name: string, avatar_url: string | null }
→ 404: code not found (triggers State D — generic landing)
```
Called both server-side (in `generateMetadata`) and client-side (to render the page). Cache with `next: { revalidate: 3600 }` — inviter profile rarely changes.

**Friendship creation (auth required):**
```
POST /api/friendships
Body: { referral_code: string }
→ 201: friendship created (both rows inserted)
→ 409: friendship already exists
→ 404: referral code not found
→ 401: not authenticated
```

---

### PostHog Funnel (Complete)

| Event | When | Properties |
|---|---|---|
| `invite_page_viewed` | `/join/[code]` loads | `{ code, inviter_name, is_valid_code }` |
| `invite_cta_tapped` | CTA button tapped | `{ code, is_new_user }` |
| `invite_auth_started` | Navigate to /auth from invite | `{ code }` |
| `invite_signup_completed` | OTP verified, new user | `{ code }` |
| `invite_friendship_created` | POST /api/friendships → 201 | `{ code }` |
| `invite_already_friends` | POST /api/friendships → 409 | `{ code }` |

These events form the invite funnel in PostHog:
`invite_page_viewed → invite_cta_tapped → invite_signup_completed → invite_friendship_created`

Conversion rate at each step is the primary growth metric for MVP.

---

### Edge Cases

| Scenario | Handling |
|---|---|
| User opens invite link in private/incognito mode | sessionStorage unavailable → fall back to `?invite=` URL param carried through auth |
| User opens link on desktop, completes auth on mobile | sessionStorage lost (different browser) → user must re-tap the link on mobile. Acceptable edge case — document in onboarding. |
| Referral code in URL after user is already authenticated | Skip auth, go straight to friendship creation (State B logic from Screen 1) |
| OG image fetch fails (inviter deleted their account) | `getInviterByCode` returns null → fall back to generic OG metadata and State D landing |
| Two simultaneous POST /api/friendships for same pair | Postgres unique constraint on `(user_id, friend_id)` → second insert fails gracefully, return 409 |

---

## Spec Amendments

### Amendment A: Screen 4 — Feed Status Control (overrides locked-UI note)

**Approved treatment (from prototype):**

**Not-free state:** A single tappable "avail-row" — white bg, `#E8E4F5` 1.5px border, 16px radius. Left: grey status dot + `Not now` (Plus Jakarta Sans 700, 15px). Right: inline `Go free` pill (green-tint bg, green border, `#15803d` text, pulsing green dot). Tapping anywhere on the row opens the Go Green sheet.

**Free state:** Full-width `I'm free` button — solid `#2ECC71`, white text, Plus Jakarta Sans 800, subtle glow animation. Tapping opens Go Grey confirmation.

**Copy corrections:**
- Not-free row text: `Not now` (not "Not free")
- Not-free CTA pill: `Go free`
- Free button: `I'm free`

**Overrides:** "full-width button pinned above 'Free right now' section label — 'Not free' (outlined, muted) / 'I'm free' (solid green)" in Screen 4 locked UI decisions.

---

### Amendment B: Screen 5 — Group Selector (overrides locked-UI note)

**Approved treatment (from prototype):** Horizontally scrollable **chips**, not a vertical checkbox list.

Chip behavior:
- Default: `All friends` chip selected (Mooves Purple bg/border/text)
- Tapping a group chip: deselects `All friends`, selects that chip (multi-select allowed)
- Tapping `All friends` while groups are selected: deselects all group chips, re-selects `All friends`
- If all group chips manually deselected: `All friends` re-selects automatically

**Overrides:** "Vertical checkbox list for group selector (not chips)" in Screen 5 locked UI decisions.

---

### Amendment C: Push Notifications — Removed from MVP

Push notifications (go green → notify friends) were listed in `mooves-project-instructions.md` under MVP scope. **Removed.** Mooves is web-first; Web Push on iOS Safari is too experimental for MVP. Friends see status changes the next time they open the app or via SMS feed check (Screen 11). Revisit in Phase 2 alongside the Expo native app.

---

## Section 13: Canonical Data Model

This is the authoritative schema. All migrations derive from this.

```sql
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE users (
  id                  UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  phone               TEXT         UNIQUE NOT NULL,       -- E.164 format: +15551234567
  display_name        TEXT,                               -- null until onboarding 3a
  avatar_url          TEXT,                               -- Supabase Storage public URL
  referral_code       VARCHAR(8)   UNIQUE NOT NULL,       -- generated at user creation
  is_available        BOOLEAN      NOT NULL DEFAULT FALSE,
  status_note         TEXT,                               -- null when not available
  visible_to          UUID[],                             -- null = all friends; array of group IDs owned by this user
  status_set_at       TIMESTAMPTZ,
  onboarding_complete BOOLEAN      NOT NULL DEFAULT FALSE,
  created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE friendships (
  user_id    UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  friend_id  UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, friend_id)
);
CREATE INDEX friendships_friend_id_idx ON friendships(friend_id);

CREATE TABLE groups (
  id         UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id   UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name       TEXT         NOT NULL,
  emoji      TEXT         NOT NULL DEFAULT '👥',
  created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE group_members (
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (group_id, user_id)
);
```

### Referral code generation

```ts
const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // no ambiguous chars (0/O, 1/I/L)
function generateReferralCode(): string {
  return Array.from({ length: 8 }, () =>
    CHARS[Math.floor(Math.random() * CHARS.length)]
  ).join('')
}
// Retry on unique constraint violation (collision probability negligible at MVP scale)
```

### Key queries

```sql
-- Feed: green friends who have included the current user in their visible audience
SELECT u.id, u.display_name, u.avatar_url, u.status_note, u.phone, u.status_set_at
FROM users u
JOIN friendships f ON f.friend_id = u.id AND f.user_id = :me
WHERE u.is_available = true
  AND (
    u.visible_to IS NULL
    OR EXISTS (
      SELECT 1 FROM group_members gm
      WHERE gm.group_id = ANY(u.visible_to)
        AND gm.user_id = :me
    )
  )
ORDER BY u.status_set_at DESC NULLS LAST;

-- Friends list (alphabetical, all statuses)
SELECT u.id, u.display_name, u.avatar_url
FROM users u
JOIN friendships f ON f.friend_id = u.id AND f.user_id = :me
ORDER BY u.display_name ASC;

-- Groups with member count
SELECT g.id, g.name, g.emoji, COUNT(gm.user_id) AS member_count
FROM groups g
LEFT JOIN group_members gm ON gm.group_id = g.id
WHERE g.owner_id = :me
GROUP BY g.id
ORDER BY g.created_at ASC;

-- Check if two users are already friends
SELECT 1 FROM friendships
WHERE user_id = :me AND friend_id = :them;

-- Mutual friendship delete
DELETE FROM friendships
WHERE (user_id = :me AND friend_id = :them)
   OR (user_id = :them AND friend_id = :me);
```

### visible_to semantics

`visible_to` on the `users` table contains group IDs **owned by the green user**. When user A goes green with `visible_to = [group_id_1]`, only users who are members of group_id_1 (as recorded in `group_members`) will see A in their feed. The feed query joins `group_members` to enforce this. `visible_to = null` means all mutual friends can see them.

---

## Section 14: Auth Integration (Firebase → Supabase)

### Architecture

Firebase handles all OTP delivery and phone verification. Our server issues a custom session token. All data queries go through Next.js API routes using the Supabase service role key — Supabase Auth is not used.

```
Client                        Server                         Supabase (service role)
  │                              │                                 │
  │── Firebase OTP ──────────▶  Firebase                          │
  │◀── idToken ─────────────────│                                 │
  │                              │                                 │
  │── POST /api/auth/verify ──▶  │── verifyIdToken (Firebase Admin)│
  │   { idToken }               │── upsert user ───────────────▶  │
  │                              │◀── { id, isNewUser } ──────────│
  │◀── Set-Cookie: mooves-token  │                                 │
  │    { isNewUser,              │                                 │
  │      onboardingComplete }    │                                 │
  │                              │                                 │
  │── GET /api/auth/supabase-token ▶ (issues short-lived Supabase JWT)
  │◀── { token }                │                                 │
  │                              │                                 │
  │── Supabase Realtime ─────── (uses Supabase JWT for RLS) ────▶  │
```

### Session token (`mooves-token`)

A HS256 JWT signed with `SESSION_SECRET`:

```ts
interface SessionPayload {
  sub: string    // users.id (UUID)
  iat: number
  exp: number    // iat + 30 days
}
```

Cookie attributes: `httpOnly`, `Secure`, `SameSite=Lax`, `Path=/`, `Max-Age=2592000` (30 days).

### Supabase-compatible JWT (for Realtime only)

Since `mooves-token` is httpOnly, the browser Supabase client cannot read it. For Realtime subscriptions, the client fetches a short-lived Supabase-compatible JWT via `GET /api/auth/supabase-token`. This JWT is stored in memory (not persisted) and refreshed as needed.

```ts
// Supabase JWT payload (signed with SUPABASE_JWT_SECRET)
{
  sub: userId,            // users.id — becomes auth.uid() in RLS
  role: 'authenticated',
  aud: 'authenticated',
  iss: `${SUPABASE_URL}/auth/v1`,
  iat: now,
  exp: now + 3600         // 1 hour
}
```

### `POST /api/auth/verify` — implementation spec

```
Body:     { idToken: string }
Response: { isNewUser: boolean, onboardingComplete: boolean, userId: string }

1. Verify idToken with Firebase Admin SDK → extract phone_number (E.164)
   On failure → 401

2. SELECT id, onboarding_complete FROM users WHERE phone = $1
   → found:     { userId: row.id, isNewUser: false, onboardingComplete: row.onboarding_complete }
   → not found: INSERT INTO users (phone, referral_code) VALUES ($1, generateReferralCode())
                RETURNING id
                → { userId: newId, isNewUser: true, onboardingComplete: false }

3. Sign mooves-token: { sub: userId, iat, exp: +30d }

4. Set-Cookie: mooves-token=<jwt>; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=2592000

5. Return: { isNewUser, onboardingComplete, userId }
```

### Client navigation after verify

```
isNewUser: true                    → /onboarding
isNewUser: false, onboardingComplete: false, display_name null → /onboarding
isNewUser: false, onboardingComplete: false, display_name set → /onboarding/invite
isNewUser: false, onboardingComplete: true                    → /feed
```

### `GET /api/auth/supabase-token`

Auth: mooves-token cookie required.

```
Response: { token: string }   // 1-hour Supabase-compatible JWT
```

Client usage:
```ts
const { token } = await fetch('/api/auth/supabase-token').then(r => r.json())
const supabase = createClient(url, anonKey, {
  global: { headers: { Authorization: `Bearer ${token}` } },
  auth: { persistSession: false }
})
// Use this client ONLY for Realtime subscriptions
// Refresh token before expiry (e.g. on re-focus after 50+ minutes)
```

---

## Section 15: API Routes

All routes live under `app/api/`. All routes except those listed as public require a valid `mooves-token` cookie. Middleware validates the cookie and sets `x-user-id` header. Route handlers read `userId` from `req.headers.get('x-user-id')`.

**Public routes (no auth):**
- `GET /api/invite/[code]`
- `POST /api/auth/verify`
- `POST /api/sms/inbound` (validated via Twilio signature header instead)

---

### `GET /api/invite/[code]`

Returns inviter's public profile for the invite landing page.

```
Response 200: { displayName: string, avatarUrl: string | null }
Response 404: code not found → client renders State D (generic landing)
```

Cache: `next: { revalidate: 3600 }`.

---

### `GET /api/auth/supabase-token`

Returns a short-lived Supabase-compatible JWT for client-side Realtime.

```
Response 200: { token: string }   // 1-hour JWT
```

---

### `GET /api/users/me`

Returns the current user's full profile.

```ts
// Response 200:
{
  id: string
  phone: string
  displayName: string | null
  avatarUrl: string | null
  referralCode: string
  isAvailable: boolean
  statusNote: string | null
  visibleTo: string[] | null
  onboardingComplete: boolean
}
```

---

### `PATCH /api/users/me`

Partial update of profile fields.

```ts
// Request body (all optional):
{
  displayName?: string         // trimmed; min 1 non-whitespace char; max 30 chars
  avatarUrl?: string | null    // null removes the photo
  onboardingComplete?: boolean
}

// Response 200: updated user (same shape as GET /api/users/me)
// Response 400: { error: string }
```

---

### `DELETE /api/users/me`

Hard-deletes the account. FK cascades handle friendships, groups, group_members. Server also deletes the avatar from Supabase Storage and calls Supabase Admin API to remove the auth record if one exists.

```
Response 204: no content
Response 500: deletion failed (client shows error toast; does not log out)
```

---

### `PATCH /api/status`

Updates availability (go green or go grey).

```ts
// Request body:
{
  isAvailable: boolean
  statusNote?: string | null    // trimmed; whitespace-only stored as null; max 60 chars
  visibleTo?: string[] | null   // group IDs; null = all friends
}

// On isAvailable: false → server ignores statusNote/visibleTo,
// forces: status_note = null, visible_to = null, status_set_at = NOW()

// On isAvailable: true → sets status_note, visible_to, status_set_at = NOW()

// Response 200: { isAvailable: boolean, statusNote: string | null }
// Response 400: { error: string }
```

---

### `POST /api/friendships`

Creates a mutual friendship via referral code.

```ts
// Request body: { referralCode: string }

// Flow:
// 1. Look up inviter by referral_code → 404 if not found
// 2. If inviter.id === me → 400 "Can't add yourself"
// 3. Check existing friendship → 409 if already friends
// 4. INSERT (me → inviter) and (inviter → me) in a single transaction

// Response 201: { friendId: string, displayName: string, avatarUrl: string | null }
// Response 400: self-add
// Response 404: code not found
// Response 409: already friends
```

---

### `DELETE /api/friendships/[friendId]`

Removes mutual friendship (both rows).

```
Response 204: no content
Response 404: friendship not found
```

---

### `GET /api/feed`

Returns green friends visible to the current user (visibility-filtered server-side).

```ts
// Response 200:
{
  friends: Array<{
    id: string
    displayName: string
    avatarUrl: string | null
    statusNote: string | null
    phone: string          // for sms: URL on card tap
    statusSetAt: string    // ISO timestamp
  }>
}
```

Uses the feed query from Section 13.

---

### `GET /api/friends`

Returns all mutual friends (for People screen).

```ts
// Response 200:
{
  friends: Array<{
    id: string
    displayName: string
    avatarUrl: string | null
  }>
}
```

---

### `GET /api/groups`

Returns current user's groups with member counts and member IDs.

```ts
// Response 200:
{
  groups: Array<{
    id: string
    name: string
    emoji: string
    memberCount: number
    memberIds: string[]   // included so edit group screen can pre-check members
  }>
}
```

---

### `POST /api/groups`

Creates a new group.

```ts
// Request body:
{
  name: string          // trimmed; max 40 chars; min 1 non-whitespace
  emoji: string         // single emoji character
  memberIds: string[]   // UUIDs; min 1; all must be mutual friends of caller
}

// Flow:
// 1. Validate name, emoji, memberIds (verify each is a mutual friend)
// 2. INSERT into groups → get new group ID
// 3. INSERT all (groupId, memberId) rows into group_members

// Response 201: { id, name, emoji, memberCount, memberIds }
// Response 400: { error: string }
```

---

### `PATCH /api/groups/[id]`

Updates group. All fields optional; `memberIds` is a full replacement.

```ts
// Request body (all optional):
{
  name?: string
  emoji?: string
  memberIds?: string[]   // full replacement — server diffs and INSERT/DELETE accordingly
}

// Response 200: { id, name, emoji, memberCount, memberIds }
// Response 403: caller doesn't own this group
// Response 404: group not found
```

---

### `DELETE /api/groups/[id]`

Deletes group (cascades to group_members).

```
Response 204: no content
Response 403: caller doesn't own this group
Response 404: not found
```

---

### `POST /api/sms/inbound`

Twilio webhook — see Screen 11 spec for full implementation. Validates via Twilio signature header (not mooves-token).

```ts
// Twilio signature validation (must run before any processing):
import twilio from 'twilio'
const valid = twilio.validateRequest(
  process.env.TWILIO_AUTH_TOKEN!,
  req.headers.get('x-twilio-signature')!,
  `${process.env.NEXT_PUBLIC_APP_URL}/api/sms/inbound`,
  Object.fromEntries(formData)
)
if (!valid) return new Response('Forbidden', { status: 403 })
```

---

## Section 16: Next.js File Structure

```
app/
  layout.tsx                      ← root layout: fonts, PostHog provider
  page.tsx                        ← root redirect: → /feed (authed) or /auth (not)

  auth/
    page.tsx                      ← Screen 2a: phone number entry
    otp/
      page.tsx                    ← Screen 2b: OTP entry

  join/
    [code]/
      page.tsx                    ← Screen 1: invite landing (Server Component + generateMetadata)
      opengraph-image.tsx         ← dynamic OG image (Next.js ImageResponse)

  onboarding/
    page.tsx                      ← Screen 3a: profile setup
    invite/
      page.tsx                    ← Screen 3b: invite nudge

  feed/
    page.tsx                      ← Screen 4: home feed

  people/
    page.tsx                      ← Screens 8+9: People tab (Friends | Groups sub-tabs)
    groups/
      new/
        page.tsx                  ← Screen 9: create group
      [id]/
        page.tsx                  ← Screen 9: edit group

  settings/
    page.tsx                      ← Screen 10: settings / profile edit

  api/
    invite/[code]/route.ts
    auth/
      verify/route.ts
      supabase-token/route.ts
    users/
      me/route.ts
    status/route.ts
    friendships/
      route.ts
      [friendId]/route.ts
    groups/
      route.ts
      [id]/route.ts
    feed/route.ts
    friends/route.ts
    sms/
      inbound/route.ts

middleware.ts

lib/
  supabase/
    client.ts                     ← browser Supabase client (Realtime only)
    server.ts                     ← server Supabase client (service role)
  firebase/
    client.ts                     ← browser Firebase app + auth
    admin.ts                      ← server Firebase Admin SDK (lazy-initialized)
  auth/
    session.ts                    ← signSessionToken(), verifySessionToken()
    supabase-jwt.ts               ← signSupabaseJwt() for /api/auth/supabase-token
  referral.ts                     ← generateReferralCode()
  twilio.ts                       ← validateTwilioSignature(), twimlResponse()
  posthog.ts                      ← server-side PostHog Node SDK client

components/
  ui/
    Avatar.tsx                    ← circular avatar with initials fallback
    StatusDot.tsx                 ← green or grey dot
    BottomNav.tsx                 ← 3-tab nav bar (Home / People / Settings)
    Sheet.tsx                     ← bottom sheet wrapper with drag handle + overlay
    Toast.tsx                     ← ephemeral toast notification
    CowIllustration.tsx           ← SVG cow for empty states
  feed/
    FeedScreen.tsx
    AvailRow.tsx                  ← "Not now / Go free" avail-row (Amendment A)
    FriendCard.tsx                ← green friend card with SMS tap
  go-green/
    GoGreenSheet.tsx
    GoGreyConfirm.tsx
    VisibilityChips.tsx           ← chip row for group selector (Amendment B)
  people/
    FriendsList.tsx
    GroupsList.tsx
    FriendRow.tsx
    GroupRow.tsx
  groups/
    GroupForm.tsx                 ← shared create/edit form
    EmojiPicker.tsx               ← bottom sheet with curated 21-emoji grid
    FriendChecklist.tsx           ← searchable checklist with checkboxes
  settings/
    ProfileCard.tsx
    LogoutSheet.tsx
    DeleteSheet.tsx               ← type-to-confirm DELETE sheet
```

### Route protection summary

| Path prefix | Auth required | If no valid token |
|---|---|---|
| `/join/[code]` | No | Render normally |
| `/auth`, `/auth/otp` | No | Render (redirect to /feed if already authed) |
| `/api/invite/[code]` | No | Render |
| `/api/auth/verify` | No | Render |
| `/api/sms/inbound` | No (Twilio sig) | Render |
| `/api/*` (all others) | Yes | 401 JSON |
| All page routes (all others) | Yes | 302 → `/auth` |

---

## Section 17: Supabase Setup

### RLS Policies

All server-side queries use the service role key (bypasses RLS). The Supabase-compatible JWT is used only for client-side Realtime — those must pass RLS.

```sql
ALTER TABLE users        ENABLE ROW LEVEL SECURITY;
ALTER TABLE friendships  ENABLE ROW LEVEL SECURITY;
ALTER TABLE groups       ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_members ENABLE ROW LEVEL SECURITY;

-- users: read self and mutual friends; write only self
CREATE POLICY "users_select" ON users FOR SELECT USING (
  id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM friendships
    WHERE user_id = auth.uid() AND friend_id = users.id
  )
);
CREATE POLICY "users_update" ON users FOR UPDATE USING (id = auth.uid());
CREATE POLICY "users_delete" ON users FOR DELETE USING (id = auth.uid());

-- friendships: read own rows; insert as user_id; delete own rows
CREATE POLICY "friendships_select" ON friendships FOR SELECT
  USING (user_id = auth.uid() OR friend_id = auth.uid());
CREATE POLICY "friendships_insert" ON friendships FOR INSERT
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "friendships_delete" ON friendships FOR DELETE
  USING (user_id = auth.uid() OR friend_id = auth.uid());

-- groups: owner has full access
CREATE POLICY "groups_all" ON groups FOR ALL USING (owner_id = auth.uid());

-- group_members: owner of the group controls writes; members can read their own rows
CREATE POLICY "group_members_select" ON group_members FOR SELECT USING (
  user_id = auth.uid()
  OR EXISTS (SELECT 1 FROM groups WHERE id = group_id AND owner_id = auth.uid())
);
CREATE POLICY "group_members_write" ON group_members FOR ALL USING (
  EXISTS (SELECT 1 FROM groups WHERE id = group_id AND owner_id = auth.uid())
);
```

### Realtime

Enable Realtime on the `users` table: Supabase dashboard → Database → Replication → add `users` to the publication.

Client-side subscription (initialized after fetching Supabase JWT):

```ts
const channel = supabase
  .channel('feed-updates')
  .on('postgres_changes', {
    event: 'UPDATE',
    schema: 'public',
    table: 'users'
  }, (payload) => {
    const updated = payload.new as UserRow
    // RLS ensures only rows the user can see are delivered
    // Check if updated.id is in the local friendIds set
    // If yes: update local feed state (add/remove/update card)
  })
  .subscribe()

// Cleanup on unmount:
return () => { supabase.removeChannel(channel) }
```

### Storage

Bucket: `avatars` — public read, authenticated write.

```sql
-- Via Supabase dashboard SQL editor:
CREATE POLICY "avatars_public_read" ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');

CREATE POLICY "avatars_owner_write" ON storage.objects FOR ALL
  USING (
    bucket_id = 'avatars'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
```

File path convention: `avatars/{userId}.jpg` (always use `upsert: true` on upload to overwrite on re-upload). On avatar removal: delete the file and set `users.avatar_url = null`.

---

## Section 18: Middleware

```ts
// middleware.ts
import { NextRequest, NextResponse } from 'next/server'
import { verifySessionToken } from '@/lib/auth/session'

const PUBLIC_PREFIXES = [
  '/join/',
  '/auth',
  '/api/invite/',
  '/api/auth/verify',
  '/api/sms/inbound',
  '/_next/',
  '/favicon',
]

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  if (PUBLIC_PREFIXES.some(p => pathname.startsWith(p))) {
    return NextResponse.next()
  }

  const token = req.cookies.get('mooves-token')?.value

  if (!token) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.redirect(new URL('/auth', req.url))
  }

  const payload = await verifySessionToken(token)

  if (!payload) {
    const res = pathname.startsWith('/api/')
      ? NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      : NextResponse.redirect(new URL('/auth', req.url))
    res.cookies.delete('mooves-token')
    return res
  }

  const headers = new Headers(req.headers)
  headers.set('x-user-id', payload.sub)
  return NextResponse.next({ request: { headers } })
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
```

**Onboarding guard (per-page, not middleware):**

The `/feed` server component checks `onboardingComplete` for the current user. If false, it redirects to `/onboarding`. This prevents middleware from creating a redirect loop on the onboarding routes themselves.

---

## Section 19: Environment Variables

```bash
# .env.local

# Firebase (client-side)
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=

# Firebase Admin (server-side only)
FIREBASE_ADMIN_PROJECT_ID=
FIREBASE_ADMIN_CLIENT_EMAIL=
FIREBASE_ADMIN_PRIVATE_KEY=       # include \n: "-----BEGIN PRIVATE KEY-----\n..."

# Supabase (client-side)
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=

# Supabase (server-side only)
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_JWT_SECRET=              # Supabase dashboard → Settings → API → JWT Secret

# Session signing (our own secret, independent of Supabase)
SESSION_SECRET=                   # 32+ random bytes, base64-encoded

# Twilio (server-side only)
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_PHONE_NUMBER=              # E.164: +18005551234

# PostHog
NEXT_PUBLIC_POSTHOG_KEY=
NEXT_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com

# App
NEXT_PUBLIC_APP_URL=https://makemooves.app
```

**Vercel setup:** All `NEXT_PUBLIC_` vars are exposed to the browser. All others are server-only. Add every variable to Vercel project settings for Production, Preview, and Development environments separately. `FIREBASE_ADMIN_PRIVATE_KEY` must have literal `\n` characters — paste as-is; Vercel preserves them.

---

## Post-MVP Roadmap (Phases 8–14)

Screens 1–12 (the core loop) are built and deployed. This section captures the next wave of work, parsed from Jackson's collected feedback and a long-form idea dump (2026-07-14). Phases are sequenced by dependency and value, not locked scope — each still needs a spec pass (via `mooves-spec-writer`) and mockup before build. The design principles below are guardrails that gate every phase.

### Design principles (guardrails)

1. **Kill the micro-rejection.** Passive availability signaling exists so a first move isn't a text that can get denied. No feature should add a new place to be rejected.
2. **Stay lightweight — never an event page or calendar app.** Time/plan details are outsourced to text/SMS. This is the line that separates Mooves from Partiful/Facebook Events.
3. **No subscribing to individual people.** Group-level subscriptions only. Per-person "tell me when they're free" is out of bounds (creepy / Find-My-Friends).
4. **Sponsored = "the good version of advertising."** Opt-in by interest; feels like a neighbor's run club, not a banner ad.

### Design System v1 (adopted 2026-07-16)

A design-critique → design-system pass (Claude Design) delivered a v1 system at `Make Mooves app/design_handoff_mooves_design_system/` (`tokens/`, `component-anatomy.md`, `accessibility-report.md`, `assets/`, `screens/`; editable original is an external `.dc.html`). **Decisions:**
- **Tokens — adopt the scale naming and MIGRATE existing components** off the old semantic names (`mooves-purple`→`purple-500`, `status-green`→`green-500`, `surface-bg`→`purple-50`, `text-primary`→`ink-900`, etc.). Hex values are **identical** to the locked palette; the additions are `green-700` (#167A43 — AA-safe green that **fixes a real 2.1:1 white-on-green text-contrast failure**), `green-100`, `purple-700`, `grey-100`, `red`, and full type/radius/shadow scales. Route text-bearing greens to `green-700` (a real change, the a11y fix — not just a rename).
- **Go-green = swipe-to-go-green** (adopted), replacing the old tap+sheet flow. *(This DS pass proposed dropping the visibility chips for a "green stays global" model — later **reversed by Phase 9 amendment A2**, which retained the `visible_to` group-scoping chips. The Phase 11 that assumed global green was CUT 2026-07-17.)* Go-grey stays a lighter tap + confirm-sheet.
- **Status legibility:** dot + label + color, **never color alone** (feed cards = solid `green-100` + white "Free" chip with `green-700` text).
- **Empty feed:** an **ambient tier** (pulsing ring + aggregate social-proof copy + green CTA) — this directly implements Phase 10.
- **Brand mark:** cow app icon corrected to the real `CowIllustration.tsx` geometry, legible 180→29px; wordmark's status-dot metaphor taught once via a legend.

**The system covers the core loop + the four critique problems. It does NOT yet include these phase-specific components — draw them as EXTENSIONS on the same tokens when specing/mocking each phase:**
- Phase 9: coarse **time chip** on go-green · **"I'm in" join** + 2+ gate · **"Start group text" blast button**
- ~~Phase 11: group-tag affordance~~ — **CUT 2026-07-17** (Phase 11 scrapped; group-scoping already ships via the go-green `visible_to` chips)
- Phase 13: **sponsored-move card** (described in rationale, not drawn)
- Phase 15: **"Add to Home Screen" install nudge**

**Deferred:** dark-mode tokens (none yet); a certified colorblind pass (Stark / Sim Daltonism) before formally claiming "passes colorblind users."

### Phase 8 — Polish & Fixes *(small, ship-now)* — **FINALIZED 2026-07-16** · **SPEC'D 2026-07-16 (see "## Phase 8 — Polish (Spec)" near end of file)** · **MOCKUP APPROVED 2026-07-17 (`mooves-phase8-polish.html`)** · **✅ CODED + MERGED + DEPLOYED 2026-07-17** (PR #6)
- **Header icon + cow face** — enlarge the header icon **and** work a cow face into the **existing** mark, as one focused design task. Scope = refine/integrate, **not a rebrand** (a full cow-forward brand-mark exploration is deliberately out of this phase). Cow-face visual direction is a mockup-time decision.
- **People tab: flip sub-tab order** so Friends is default/left, Groups second. **⚠️ LIKELY ALREADY DONE (2026-07-16):** `PeopleScreen.tsx:19,51` already defaults to `friends` and renders `['friends','groups']` (Friends-first). The design critique caught this too. **Verify against live `makemooves.app`; if confirmed, DROP this item** and just update the stale Screen 9 spec "People Tab Layout Update" note (which still documents the old reversed order).
- **reCAPTCHA badge** — **suppress** the floating Firebase badge via the `badge` param, and add Google's **required attribution text** ("protected by reCAPTCHA — Privacy / Terms") on the auth screen instead. (Not repositioned — hidden + compliant.)
- **"+" create-group button** — a clear, **labeled control in the Groups sub-tab header** (always visible, obvious purpose). Not a FAB, not an empty-state-only CTA.

All four items are independent and parallelizable.

### Phase 9 — Deepen the core loop *(highest leverage — the next build after Phase 8)* — **FINALIZED 2026-07-16** · **SPEC'D 2026-07-16 (see "## Phase 9 — Deepen the Core Loop (Spec)" near end of file)** · **MOCKUP APPROVED 2026-07-17 (`mooves-phase9-coreloop.html`; +amendments A1–A4: swipe-to-go-green folded in, visibility retained, no blast prefill)** · **✅ CODED 2026-07-17** (needs DB migration — applied; two-account + `sms:` device testing pending)

**Goal:** make the green → plan handoff frictionless and add light social proof — without adding any new surface to be rejected, and without becoming an event/calendar app.

**The coherent loop:**
1. You go green — optionally tag a **coarse time chip** (*now / tonight / this weekend*; no picker, no calendar).
2. Friends see your green and tap **"I'm in"** → your join count ticks up. (Pure join signal — does *not* flip the joiner green.)
3. At **2+ joins**, a **"Start group text"** button appears on *your* status card.
4. Tap it → **native SMS deep-link** opens your own Messages app, pre-addressed to **exactly your joiners**, prefilled body. No Mooves number, no A2P.
5. Right after sending → **"Plan's set — go grey, or keep green for more?"**

**Sub-features & build order (this is a dependency chain, not the PRD's original "blast first"):**
1. **Presence ("party-full" lite)** — "I'm in" tap + join count on green cards. *Built first — it gates the blast.* Social proof, not an RSVP page; also attacks cold start.
2. **⭐ Group-chat / text-blast button (anchor feature)** — appears at 2+ joins, targets exactly the joiners via a native SMS deep-link (opens the user's own Messages app; no Mooves number, no A2P). The natural green → plan handoff and Jackson's most-wanted item.
3. **Smarter "go grey"** — post-blast prompt to drop green or keep it up for "the more the merrier." Addresses the awkward-social-dynamics failure mode.
4. **Coarse time chip** — optional intent tag on green (*now / tonight / this weekend*). Replaces the old "lightweight tonight signaling" sub-feature. *Independent — build in parallel anytime.*

**Resolved decisions:** delivery = native SMS deep-link (no A2P) · recipients = exactly the joiners · availability = binary green + coarse time chip, **no time picker** · "I'm in" = pure join signal (doesn't flip joiner green) · blast **gated at 2+ joins** so you never blast into silence — this is design principle #1 (kill the micro-rejection) falling straight out of the interaction.

**In scope:** presence count, "I'm in", gated blast button, native deep-link handoff, post-blast go-grey prompt, coarse time chip.
**Explicitly out:** RSVP/attendee management, time pickers/calendars, Mooves-brokered SMS, per-person subscriptions, adding non-joiners to the blast.

**Design-critique findings folded in (2026-07-16):**
- **The SMS handoff is the productized version of a current gap.** Today `FriendCard.handleTap` fires `window.location.href = sms:…` with **no confirmation and a blank body**, and nothing on the feed/empty states teaches a new user that *tapping a green friend = text them*. The Phase 9 blast should fix both: (a) it **resolves the "prefilled body" open question — currently the message opens empty**, so the blast must supply real prefilled copy; (b) give the handoff a clear affordance/discoverability cue so the core interaction is learnable unaided.
- **Fix the go-green entry-point weight while this phase touches the go-green flow (for the time chip).** The critique flagged two inconsistent entry points (`AvailRow`'s small off-state "Go free" chip vs. the on-state full-width CTA), with the *new-user* action under-weighted — resolve to one dominant, unmistakable go-green action per the design system.

**Flagged for spec time (open questions to resolve in `mooves-spec-writer`):**
- **iOS vs Android deep-link reality** — multi-recipient `sms:`/`smsto:` behavior differs by OS; iOS can be finicky about creating a *single group* thread. Real implementation risk to the "one group text" promise — needs a spec-time proof-of-concept.
- **Prefilled body copy** — what the message actually says.
- **Presence visibility** — do friends see *who* joined (names) or just a count? Does the count show feed-wide as social proof, or only to the mover?
- **"0 joins" watch-item** — seeing no one join your move is passive, but confirm it doesn't read as a soft rejection.
- **Coarse time chip** — exact preset values and whether/how it renders in the feed.

### Phase 10 — Cold start & growth flywheel — **FINALIZED 2026-07-16** · **SPEC'D 2026-07-16 (see "## Phase 10 — Cold Start & Growth Flywheel (Spec)" near end of file)** · **MOCKUP APPROVED 2026-07-17 (`mooves-phase10-coldstart.html`; one signal at a time, grey ambient pulse)** · **✅ CODED 2026-07-17** (Option A owner-scoped invite links; needs 2-account testing)

**Goal:** fix the *cold-feed* problem (established users bouncing off a grey feed) intrinsically, and give *new* users a fast path to a populated feed via leader-shared group links. The first-mover "OPEN DESIGN PROBLEM" from the idea dump is now resolved: it's the **cold-feed** problem (you have friends but nobody's green *right now*), solved **intrinsically** — not with streaks/points/notifications.

**Workstream A — First-mover incentive (cold feed), intrinsic.** Two signals, both **aggregate/anonymized**:
1. **Ambient demand signal** — when the feed is grey, show recent + habitual availability ("5 friends were green this week," "your Thursday crew is usually up now"). Proves the network is alive and green will be seen.
2. **"Friends active now" signal** — aggregate count of friends currently in-app / recently active ("4 friends around now"), so going green visibly lands on real eyes *before* you commit.
- **Guardrail (dictated):** counts only, **never named individuals** — naming a friend who's active / was green but didn't reach out is a brand-new micro-rejection (#1) and drifts toward Find-My-Friends creep (#3).
- **Boundary/dependency:** intrinsic work maximizes single-session value + builds the habit of opening at high-intent times. It **cannot reach dormant friends** — that's **Phase 15** push notifications. Phase 10 sets up; Phase 15 closes the loop.

**Workstream B — Growth flywheel (cold graph): leader-led group invite links.** (Leader-onboarding + invite-links collapsed into one feature — the link *is* the leader's mechanism; "leader onboarding" is its packaging.)
- One shareable **group invite link** per group; **any member can share** it (the leader is emergent, **no special role/tooling**).
- Tapping it **joins the group AND auto-friends all current members** → instantly populated feed. Justified by the trusted group-text context (members aren't strangers). *Caveat: revisit if groups ever become large/public in Phase 12–13.*
- Tech: group-scoped variant of `lib/referral.ts` / `/api/invite/[code]` (currently friend-scoped).

**Sequencing:** invite links first (concrete, partly specced, low-risk, unblocks new-user density) → then the grey-state ambient/active-now signals (harder design). Parallelizable.

**In scope:** aggregate ambient-demand signal, aggregate friends-active-now signal, grey-state feed rework, group invite links with auto-friend-all.
**Explicitly out:** streaks/points/gamification, named "active now"/last-seen, first-mover push notifications (→ Phase 15), any special leader role/tooling, per-person incentives.

**Design-critique findings folded in (2026-07-16):**
- **Independent corroboration of this phase's thesis.** The design critique flagged the empty/grey feed as *"the single highest-leverage screen in the app and currently the least designed"* — unprompted. Treat the grey state as a **hero state**, designed for the aggregate ambient signals ("5 friends were green this week", "4 friends around now"), not an afterthought empty state.
- **Feed-card status legibility (fix as part of the feed redesign).** `FriendCard` signals "free" by green tint alone (`bg-[#2ECC71]/[0.14]`) — no dot, no label — which fails colorblind/low-vision users and has borderline contrast for a *status* indicator. Add a non-color cue (status dot + "Free" label) and lock accessible contrast on the green hero color. (Design-system item; also see Phase 8's overall polish.)

**Flagged for spec time (open questions to resolve in `mooves-spec-writer`):**
- **Small-N de-anonymization (important):** with few friends, "1 friend active now" or "1 was green this week" trivially *identifies* the person — reintroducing the exact rejection/creepiness we designed out. Needs a suppression floor (hide counts below a threshold).
- **"Active now" definition** — what counts (app foreground? last N minutes?) and its recency window.
- **Ambient-signal thresholds/copy** — the "this week" window and habitual-pattern logic.
- **Auto-friend-all consent surface** — does the joiner see "this will connect you with 12 people" before confirming?
- **Invite-link hygiene** — expiry / revocation, abuse if a link spreads beyond the intended group.

> **Phases 11–15 — definitions FINALIZED 2026-07-16** (not yet specced/mocked/coded). They now carry resolved in/out scope like 8–10, but remain further out, and some items stay deliberately trigger-gated/directional: **WhatsApp gated on non-US demand** and the **tipping concept still loose** (payments path decided). Note **Phase 15 (Push/PWA)** is late-numbered but strategically belongs right after Phase 11 — it completes the cold-start loop. Phases 8–10 remain the near-term build commitments; revisit 11–15 ordering before building.

### Phase 11 — Groups as channels (in-app) — **❌ CUT 2026-07-17** (folded into shipped Phase 9 `visible_to`)

> **❌ CUT 2026-07-17 (Jackson's call).** Phase 11 is scrapped. Once you apply the intuitive rule — **selecting a group when you go green means only that group sees the green** — Phase 11 has nothing distinct left: "a green scoped to a group" is exactly the **`visible_to` group-scoping already shipped in Phase 9 (amendment A2)**. The only thing that ever made Phase 11 a separate feature was the "green stays global, group is just a *label*" premise (an additive context chip on a global green), and that premise is dead: it conflicts with shipped scoping, and as a UX it's confusing and clutters both the go-green sheet and the feed. So: **no group tag, no feed labels, no per-group mute, no member-side group surface, no new data model.** Group-scoping a green ships today via the go-green visibility control. See the CUT note on the "## Phase 11 …" spec section near end of file. **Downstream:** Phase 15 push retriggers off group-scoped greens (`visible_to`), not a Phase 11 tag — see Phase 15 below.

Guardrail unchanged: **group-level only, never per-person.**

### Phase 12 — Geolocation & discovery — **FINALIZED 2026-07-16** · **SPEC'D 2026-07-16 (see "## Phase 12 — Geolocation & Discovery: Substrate (Spec)" near end of file)** · **MOCKUP APPROVED 2026-07-20 (`mooves-phase12-geo-substrate.html`)** · **✅ CODED 2026-07-20** (branch `feat/phase12-geo-substrate`)

**Resolved: the area feed surfaces PUBLIC/sponsored moves, never strangers' green.** This keeps the private friend-graph intact and dodges stranger-creep + a new rejection surface (guardrail #3). **Consequence:** Phase 12 is largely the **substrate for Phase 13** — "moves in my area" has little to show until sponsored/public moves exist, so **12 and 13 are tightly coupled** (build 12 just before / together with 13).

- **Location: coarse, opt-in.** Zip / neighborhood level only — enough for area matching, no Find-My-Friends precision, minimal sensitive data held. **No live/precise GPS.**
- **Opt-in when it unlocks value.** Prompt for location at the moment it pays off ("see moves near you"), ideally once there's Phase 13 content to show — not an upfront onboarding demand, not Settings-only.
- **"Moves in my area" feed** = local public/sponsored moves filtered by the user's coarse area. Prerequisite for Phase 13.
- Guardrails: large/public groups introduced here must **not** inherit Phase 10's auto-friend-all; any user-facing area counts honor Phase 10 **small-N suppression**.

**In scope:** opt-in coarse-location capture, area-targeting infra, "moves in my area" feed of public/sponsored moves.
**Explicitly out:** surfacing individual strangers' green, precise/live GPS, mandatory location, per-person location (guardrail #3).

**Flagged for spec time (open questions):**
- Value-exchange copy for the location opt-in; exactly where/when it fires.
- How "area" is defined/matched (zip radius? city?) and how travel / changing location is handled.
- Whether an *aggregate* friend-area vibe ("lots free near you") layers on top (reusing Phase 10 ambient signals).
- Location data storage/retention & privacy.

### Phase 13 — Sponsored moves *(monetization — "good ads")* — **FINALIZED 2026-07-16** · **SPEC'D 2026-07-16 (see "## Phase 13 — Sponsored Moves (Spec)" near end of file)** · **SURFACE 1 (consumer Discover + 13.8 flywheel) MOCKUP APPROVED + ✅ CODED 2026-07-20 (`mooves-phase13-discover.html`; branch `feat/phase13-sponsored-moves`)** · **SURFACE 2 (admin/moderation console) MOCKUP APPROVED + ✅ CODED 2026-07-20 (`mooves-phase13-admin.html`)** · **SURFACE 3 (sponsor portal) MOCKUP APPROVED + ✅ CODED 2026-07-20 (`mooves-phase13-sponsor.html`)** · scope = build ALL of Phase 13 across 4 surfaces (consumer · admin/moderation · sponsor portal · MoR billing)

**Guardrail #4 holds:** sponsored moves are opt-in "good ads," never banner injection.

- **Placement: area feed only, opt-in by interest type.** Sponsored moves appear ONLY in the Phase 12 "moves in my area" feed, filtered to interest-types the user opted into (running, nightlife, markets…). **Never in the friend feed** — the friend feed stays sacred.
- **Creation: self-serve sponsor dashboard.** Sponsors sign up, post their own moves, and view analytics. **NOTE — the single heaviest build in the roadmap:** a whole second product surface (sponsor accounts/auth, move authoring, billing, moderation, analytics). Likely needs internal sub-phasing; a **curated/concierge pilot may still precede full self-serve** to validate demand (spec-time call). Carries a **payments dependency** shared with Phase 14 — **resolved:** use the Merchant-of-Record path decided in Phase 14 (Paddle/Lemon Squeezy; no LLC needed; money flows to Mooves, so no marketplace/KYC).
- **Interest subscriptions** — users opt into sponsored-move *types*, never injected. Preset categories.
- **Details delivery: in-app first.** "Interested" delivers move details + link **in-app immediately**. The sticky **SMS-back** from the Mooves number is a later enhancement **gated on A2P 10DLC registration** (the friction deferred in Phase 7 — unlike the Phase 9 blast, this is Mooves-brokered *outbound* SMS). Phase 13 ships without A2P.
- **Sponsor analytics:** impressions (feeds reached), clicks, "interested" counts. Honor Phase 10 **small-N suppression** on anything user-facing; no auto-friend-all on public feeds.

**In scope:** area-feed sponsored placement, interest-type opt-in, self-serve sponsor dashboard, in-app details delivery, sponsor analytics.
**Explicitly out (of v1):** friend-feed ad injection, SMS-back delivery (A2P-gated enhancement), any non-opt-in / injected ads.

**Flagged for spec time (open questions):**
- Pricing/billing model (CPM? flat? per-"interested"?) + the payments-infra blocker shared with Phase 14.
- Sponsor onboarding/verification & content moderation (trust/safety on a self-serve surface).
- Interest-type taxonomy — the preset categories.
- Whether a curated pilot precedes full self-serve.
- "Interested" semantics — does it notify the sponsor or reveal anything about the user? (guardrail: no per-person exposure.)

### Phase 14 — Scale & platform — **FINALIZED 2026-07-16** · **SPEC'D 2026-07-16 (see "## Phase 14 — Scale & Platform (Spec)" near end of file)**

**Payments (cross-cutting — gates Phase 13 sponsor billing AND tipping).** Both money flows go **TO Mooves** (sponsor payments; tips support the app), so there's **no marketplace/payouts, no user KYC, no money-transmission** complexity — the simple case. **You do NOT need to form an LLC to start.** Recommended path = a **Merchant-of-Record (Paddle or Lemon Squeezy)**: onboards you as an individual, remits global sales tax/VAT, and covers both Phase 13 billing (subscriptions/one-offs) and tipping from one integration. Trade-off: ~5%+ fees vs. Stripe's ~2.9%+30¢ — the premium buys **zero tax/compliance overhead** (the point when you don't want to run a business). *Lower-fee alternative:* Stripe or Square as your own merchant (sole prop, SSN/EIN, **no LLC**) if you'll handle sales-tax registration/remittance yourself. *Revisit:* the earlier "Stripe sole-prop blocker" may have been a verification snag rather than a wall, since tips-to-app is simple. *(General guidance, ~early-2026 knowledge — verify current terms; confirm tax/entity choice with an accountant.)*

- **Tipping ("cow tipping")** — tips flow **to Mooves**; rides on the shared payments infra above (lighter than sponsor billing). Concept still directional, but the payments path is now decided.
- **WhatsApp / international** — **trigger-gated on real non-US demand.** Stays directional, not committed scope; the Phase 9 native SMS deep-link already covers the US. Build only when there's international traction.
- **Landing page (makemooves.app)** — **PULLED FORWARD, decoupled from Phase 14.** No dependency on scale work; a standalone growth asset that can ship anytime (even alongside Phase 8/10). See future-ideas backlog.

**Net:** the "someday scale bucket" mostly dissolves — payments is decided (MoR), the landing page moves earlier, WhatsApp stays demand-gated. What remains uniquely "Phase 14" is thin.

**Flagged for spec time (open questions):**
- Pick the specific MoR (Paddle vs Lemon Squeezy) & integration; confirm current individual-onboarding terms + fees.
- Tipping UX/placement and whether it's pursued at all.
- Landing-page scope (explainer + signup CTA; SEO) — spec separately when pulled forward.

### Phase 15 — Push notifications & home-screen install (PWA) — **FINALIZED 2026-07-16** · **SPEC'D 2026-07-16 (see "## Phase 15 — Push Notifications & Home-Screen Install (Spec)" near end of file)**

**This is the phase that closes the cold-start loop.** It delivers the *dormant reach* Phase 10 deliberately punted: reaching friends who aren't currently in-app. Done as a **PWA + Web Push**, no native app.

**Sequencing note — number ≠ priority.** Despite sitting at 15, this **completes the Phase 10 cold-start loop** and should be **prioritized next, ahead of 12–14** (which are monetization/scale). It's late-numbered only because it was split out mid-planning. *(Phase 11 was CUT 2026-07-17 — its "group channels" are just the shipped `visible_to` group-scoping, which this phase reuses as its notification trigger.)*

**Components:**
1. **PWA foundations** — web manifest (name + **cow icons** + `display: standalone`), service worker, HTTPS (✅ already on Vercel). Consumes the cow mark from **Phase 8**.
2. **Home-screen (app) icon fix** — proper **`apple-touch-icon` (180×180, opaque)** + manifest icons so the installed app shows the **cow, not the fallback "M"** iOS currently renders (root cause: no icon declared today). *Cheap and independent — can be pulled forward as a quick win once the Phase 8 cow asset exists, even before push.*
3. **Web Push** — via the **existing Firebase / FCM** (no new vendor): permission UX, subscription storage, VAPID/FCM send. Triggers reuse the shipped **`visible_to` group-scoping** (when a member goes green **scoped to a group**, notify that group's members).
4. **"Add to Home Screen" nudge/guide** — a lightweight, well-timed prompt that teaches **iOS** users to install (Share → Add to Home Screen), because **iOS push only works for installed PWAs**. Don't nag; fire at a high-value moment. Android/desktop get a normal permission prompt (install optional).

**Platform reality (the ceiling to watch):**
- **Android / desktop:** web push from a permission prompt; install optional.
- **iOS 16.4+:** web push **only after Add-to-Home-Screen** — so iOS reach is capped by the **install rate**. That rate is the KPI for this phase; the install nudge exists to lift it.

**Guardrails on notifications:** group-level only, never per-person; aggregate-friendly copy; frequency/quiet controls; must not create a new rejection surface.

**In scope:** manifest + service worker, cow app icon (`apple-touch-icon` + manifest icons), FCM web push, permission + install-nudge UX, group-triggered notifications.
**Explicitly out:** native app, SMS/email as the push channel, per-person notifications.

**Dependencies:** Phase 8 (cow icon asset) · shipped Phase 9 `visible_to` group-scoping (= the notification trigger; Phase 11 that would have formalized this was CUT) · `group_members` (who to notify) · Firebase/FCM already in the stack.

**Flagged for spec time (open questions):**
- Install-nudge timing/copy; detecting "iOS + not installed" to show the right guidance.
- Notification trigger set + batching / quiet hours.
- Icon spec: exact sizes, Android maskable icons, opaque-background requirement for iOS.

### Open decisions
- ~~**Availability model (Phase 9):**~~ **RESOLVED 2026-07-16** — binary green + optional coarse time chip (*now / tonight / this weekend*), no time picker, no calendar. See Phase 9 above.

---

## Phase 8 — Polish (Spec) — *spec'd 2026-07-16*

*Cross-cutting polish, not a single screen. Touched elements adopt Design System v1 tokens as they're rebuilt (not a full re-skin). The original "flip sub-tab order" item is **dropped** — the app already ships Friends-first (code and the Screen 9 layout note both agree); the "reversed order" claim was the outdated part.*

### 8.1 — Header cow mark

**Purpose:** Make the in-app header carry the cow brand so the app matches its new home-screen icon.

**Entry points:** The persistent header on top-level screens that render the wordmark (Feed, People).

**States:** Single presentational element, no interaction.
- **On gradient/purple headers:** cow mark + light wordmark variant.
- **On white headers:** cow mark + dark wordmark variant.

**Behavior:** A cow mark (matching the app-icon geometry) sits beside the enlarged M[dot][dot]VES wordmark. The wordmark stays; the cow is added alongside — **not** a wordmark redesign or rebrand.

**Out of scope:** Redesigning the wordmark itself; animation; a full logo system.

**Acceptance:**
- [ ] Cow mark appears beside the wordmark in in-app headers, legible at header size on both light and dark backgrounds.
- [ ] Cow is visually consistent with the home-screen app icon.
- [ ] No overflow or layout shift at 375px width.

### 8.2 — Create-group control

**Purpose:** Make creating a group obvious and consistent from any state.

**Entry points:** Groups sub-tab header (always visible when Groups tab active); Groups empty-state CTA (retained).

**States:**
- **Groups tab, has groups:** an always-visible **labeled** create control ("New group") in the header top-right → Create Group screen.
- **Groups tab, empty:** the large empty-state "Create a group" CTA remains (primary for first-timers) **and** the labeled header control is also present.
- **Friends tab active:** create control hidden (Groups-specific).

**User flow:** Tap the labeled header control (or empty-state CTA) → Create Group screen.

**Data:** No new data. Both entry points fire the existing `group_create_started` event.

**Out of scope:** Redesigning the Create Group screen; changing creation logic.

**Acceptance:**
- [ ] Groups header shows an always-visible, clearly labeled create-group control when the Groups sub-tab is active.
- [ ] Control uses the DS primary treatment (purple fill + label) and meets ≥44px tap target.
- [ ] Empty-state "Create a group" CTA retained.
- [ ] Both entry points navigate to Create Group and fire `group_create_started`.
- [ ] Control hidden on the Friends sub-tab.

### 8.3 — reCAPTCHA badge suppression + disclosure

**Purpose:** Remove the intrusive floating reCAPTCHA badge while staying compliant with Google's attribution requirement.

**Entry points:** Phone-number entry screen (where reCAPTCHA fires on send-code).

**States:**
- **Phone-entry screen:** footer shows the attribution disclosure with working **Privacy** and **Terms** links.
- **Badge:** never visible, on any screen or state.

**Behavior:** Suppress the floating Google badge everywhere; show the required "protected by reCAPTCHA" attribution (with Google Privacy Policy + Terms links) in the **phone-entry screen footer only**. Suppression is presentation-only — reCAPTCHA must still execute.

**Copy:** Google's standard attribution (final wording at mockup, e.g. "This site is protected by reCAPTCHA and the Google Privacy Policy and Terms of Service apply.").

**Out of scope:** Changing the auth flow, OTP screen, or verification behavior.

**Acceptance:**
- [ ] Floating reCAPTCHA badge no longer visible anywhere.
- [ ] reCAPTCHA still executes — send-code and verify work with no regression.
- [ ] Phone-entry footer shows compliant attribution with working Privacy + Terms links.
- [ ] Disclosure appears only on the phone-entry screen.

### Open questions
None.

### Mockup Status
✅ Mockup approved 2026-07-17 · ✅ **Coded 2026-07-17 (Jackson: "ship it")** — `tsc --noEmit` + `next build` clean; auth screen verified live (cow mark, enlarged wordmark, reCAPTCHA attribution + badge suppression). Files: NEW `src/components/ui/CowMark.tsx`; `Wordmark.tsx` (`withCow` prop + enlarged lockup); `FeedScreen.tsx` / `PeopleScreen.tsx` / `SettingsScreen.tsx` / `auth/page.tsx` (headers opt into `withCow`); `PeopleScreen.tsx` labeled "New" pill (DS primary, 44px, hidden on Friends); `globals.css` `.grecaptcha-badge` hidden; `auth/page.tsx` footer attribution. Legacy tokens migrated → DS scale in all touched files. **Not yet committed/deployed** (awaiting Jackson's go on git). **Follow-ups noted:** (a) cream cow reads subtle on white headers — optional outline/shadow on the white-header variant; (b) Feed header top padding reduced to match centered mockup — consider `safe-area-inset` top pad if run as an installed PWA (Phase 15-adjacent).

`mooves-phase8-polish.html` — approved 2026-07-17. Cross-cutting mockup (not a single screen); toggle states cover 8.1 Feed header (light cow mark) + People header (dark cow mark), 8.2 Groups / Groups-empty / Friends-tab create-group control, and 8.3 phone-entry reCAPTCHA disclosure. **Design decisions locked at approval:** cow mark is the app-icon geometry rendered *transparent* (no cream tile/box) beside the enlarged wordmark; wordmark enlarged (dark 16→22px, light 20→24px); create-group control label is **"New"** (not "New group") as a purple DS-primary pill with a "+" glyph; reCAPTCHA attribution uses Google's standard copy in the phone-entry footer only. **Build watch-item:** the transparent cream cow face reads bold on the purple Feed header but faint on white headers (People/Auth) — revisit contrast (subtle outline/shadow on white-header variant) if it reads washed-out in-app.

---

## Phase 9 — Deepen the Core Loop (Spec) — *spec'd 2026-07-16*

*Core-loop deepening on the Feed (Screen 4) + the go-green flow. New components (time chip, "I'm in"/presence, blast, post-blast prompt) extend DS v1 on its existing tokens. Dependency chain: **presence → blast → go-grey**; the time chip is independent.*

**Shared model:** "Your move" = your current active green session. Presence joins, the time chip, and the note **attach to it and are ephemeral** — cleared when you go grey. Joins update in **realtime** on your card and for every friend viewing it.

### 9.1 — Coarse time chip (go-green intent)
**Purpose:** let "I'm free" optionally carry coarse intent, no time picker.
**Entry:** the go-green flow, alongside the existing optional note.
**Behavior:** optionally pick one chip — **now / tonight / this weekend** (single-select, skippable). Attaches to your green, shows on your status card and friends' feed cards, and carries into the blast body if set.
**Out of scope:** specific times/dates, calendars, multi-select, recurring.
**Acceptance:**
- [ ] Optional single-select chip (now / tonight / this weekend) offered when going green.
- [ ] Selected chip shows on the mover's card and friends' feed cards.
- [ ] Chip clears on go-grey. No picker/calendar anywhere.

### 9.2 — Presence & "I'm in" (joins on a move)
**Purpose:** social proof + gate the blast.
**Entry:** any friend's green card in the feed.
**Behavior:** a viewer taps **"I'm in"** to join (a **toggle** — tap again to leave). Joining does **not** flip the joiner green. Joins are **visible to everyone** viewing the card (names/avatars + count, e.g. "Jordan, Sam +1 in").
**States (mover's own card):** 0 joins → green + chip/note, no blast button, no pressure copy · 1 join → shows joiner, still no button · **2+ → blast button appears (9.3)**.
**Flow:** tap "I'm in" → added to joiners (realtime); tap again → removed.
**Data:** a join record links a friend to another friend's active green session; created/removed on toggle; cleared on the mover's go-grey.
**Out of scope:** RSVP yes/no/maybe, attendee management, per-person notifications, joining a grey friend.
**Acceptance:**
- [ ] Any friend viewing a green card can toggle "I'm in"; it doesn't change their own status.
- [ ] Joiner names + count visible to everyone on the card, realtime.
- [ ] No blast button / no pressure copy below 2 joins.
- [ ] Joins clear when the mover goes grey.

### 9.3 — Group-text blast (anchor)
**Purpose:** convert a move into a plan — the green→plan handoff.
**Entry:** the **"Start group text"** button on the mover's own card, visible only at **2+ joins**.
**Behavior:** opens the device's **native SMS composer**, pre-addressed to **exactly the current joiners**, body prefilled with the mover's name + vibe/time if set (e.g. "Jackson's free this weekend — who's in?"). No Mooves number/link, no A2P. More can join while green; re-blast targets the current joiner set.
**Flow:** at 2+ joins → tap → native composer opens addressed to joiners with prefilled body → mover sends in their SMS app (Mooves' role ends).
**Data:** reads joiners' phone numbers for the deep link; writes only an analytics event.
**Known risk (build POC):** multi-recipient `sms:`/`smsto:` group behavior differs by OS (iOS may split threads). Validate on iOS + Android during build.
**Out of scope:** Mooves-brokered/outbound SMS, in-app chat, event pages, delivery tracking.
**Acceptance:**
- [ ] Button appears only at 2+ joins.
- [ ] Opens native composer pre-addressed to exactly the current joiners.
- [ ] Body prefilled with name + time/vibe if set; no Mooves link/number.
- [ ] Re-blast works while green. Fires a blast analytics event.

### 9.4 — Smarter go-grey (post-blast prompt)
**Purpose:** nudge go-grey once a plan forms, without forcing it.
**Entry:** immediately after returning from a blast.
**Behavior:** prompt **"Plan's set — go grey, or keep green for more?"** Go-grey ends the move (clears joins + chip); keep-green leaves it open (more joins, re-blast).
**Out of scope:** auto-expiry/timeout of green, reminders.
**Acceptance:**
- [ ] Post-blast go-grey / keep-green prompt appears.
- [ ] Go-grey ends the move and clears joins + chip.
- [ ] Keep-green leaves the move open. Prompt is non-blocking; never auto-changes status.

### Open questions
- ~~Exact prefilled body wording (finalize at mockup).~~ **RESOLVED at mockup: no prefilled body — see amendment A4.**
- iOS group-thread deep-link behavior — POC in build.

### Mockup Status
✅ **Mockup approved 2026-07-17** — `mooves-phase9-coreloop.html`. Cross-cutting (Feed Screen 4 + go-green flow), not a single numbered screen. States: go-green sheet (note + time chip + visibility), friend feed w/ "I'm in" joins, your-move at 0 / 1 / 2+ joins, native group-text composer, post-blast "Plan's set" prompt.

### Code Status
✅ **Coded 2026-07-17 (Jackson: "ship it")** — `tsc --noEmit` + `next build` clean; dev server boots clean. **DB migration applied by Jackson in Supabase:** `users.status_time` (now/tonight/weekend) + `move_joins` table (mover_id, joiner_id) + realtime publication + RLS select policy. New: `api/moves/join` (POST/DELETE toggle), `lib/blast.ts` (native `sms:` deep link, no body), `SwipeToGoGreen`, `MyMoveCard`, `Joiners`, `TimeChips`. Modified: `types/database.ts` (+move_joins/+status_time, fully typed), `api/status` (time + clears joins on grey), `api/feed` (per-friend joiners + `myJoiners`), `api/users/me`, `GoGreenSheet` (time chips), `FriendCard` (I'm in/You're in + joiners), `FeedScreen` (swipe + MyMoveCard + joins realtime + blast + prompt). `AvailRow.tsx` retired. Presence realtime = `move_joins`+`users` subscription → debounced `/api/feed` refetch. **Build-time verification only** — the two-account join/blast flow + the multi-recipient `sms:` POC (iOS single-thread) need on-device testing by Jackson. **Not yet committed at time of this note** (committed + pushed immediately after).

### Amendments locked at mockup approval (2026-07-17) — override the spec above where noted
- **A1 — Swipe-to-go-green folded into Phase 9.** (Was an adopted-but-unscheduled DS v1 decision.) The **home-feed top status control becomes a swipe-to-go-free** control. Swiping opens the existing go-green sheet; the sheet's CTA stays a **tap "I'm free" button** (no second slide). Go-grey stays tap + confirm. **Build must include an accessible fallback** — a tappable confirm for screen readers / reduced-motion, so the slide is never the only path.
- **A2 — Visibility control RETAINED on go-green** (Everyone / scope to specific groups). This **reverses the DS v1 "green is global / drop visibility chips" assumption** — greens can be scoped. Matches the shipped `visible_to` model, so no data change.
- **A3 — Blast button copy = "Start a group chat"** (not "Start group text"). "I'm in" = **purple** (action color); once joined the chip reads **"You're in ✓"** in **green** (green-700, AA-safe). Time chips single-select; the "Your move" card uses a green tint + green-700 label (a11y — no solid-green-on-white text).
- **A4 — Group-chat blast carries NO prefilled/templatized text.** The native composer opens pre-addressed to exactly the current joiners with an **empty** message body; the user writes it. This **overrides 9.3's** "body prefilled with the mover's name + vibe/time."
- **✅ Cross-phase flag RESOLVED 2026-07-17:** A2 (visibility scoping stays) conflicted with Phase 11's "group tag = label, not scope" model. Resolution: **Phase 11 was CUT** — group-scoping a green already ships here via A2's `visible_to`, so there was no distinct Phase 11 feature left to build. Phase 15 push now triggers off this scoping.

---

## Phase 10 — Cold Start & Growth Flywheel (Spec) — *spec'd 2026-07-16*

*Two workstreams: intrinsic grey-feed signals (all aggregate, suppressed below 3) and group invite links. The grey-feed state uses the DS "ambient tier." Dormant-reach (notifications) is explicitly Phase 15, not here.*

### 10.1 — Grey-feed ambient signals (cold-feed fix)
**Purpose:** make the feed feel alive when a viewer has friends but none are green *right now*, so a first-mover believes they'll be seen.
**Entry:** the Feed, "has friends but none currently green" state (distinct from the zero-friends cold-start).
**Behavior:** show the DS ambient tier — two **aggregate, never-named** signals + a green CTA:
- **Recent-activity:** "N friends were green this week" (rolling ~7-day green count).
- **Friends-active-now:** "N friends around now" (friends who **foregrounded the app in the last ~15 min**).
- **CTA:** "Be the first — go free" (green-700).
Every signal is **suppressed when its count is < 3** → fall back to neutral encouragement copy with no number. Never any "nobody's free" negativity.
**States:** has friends / none green / a signal ≥3 → ambient tier with qualifying signal(s) + CTA · all signals <3 → neutral encouraging state (no numbers) + CTA · **zero friends → existing cold-start (cow + invite), unchanged/out of scope**.
**Data:** rolling recent-green count + last-~15-min app-open count, computed over the viewer's friends; both hidden if <3.
**Out of scope:** named/per-person signals; the daypart "usually livens up around 6pm" pattern (**deferred** to a follow-up); notifications/dormant reach (Phase 15).
**Acceptance:**
- [ ] Grey feed (has friends, none green) shows the ambient tier: recent-green count + active-now count + green CTA.
- [ ] All signals are aggregate counts, never names; any signal <3 is hidden (neutral fallback, no number).
- [ ] Active-now = friends who opened the app in the last ~15 min (window tunable).
- [ ] Recent-green = friends green in the last ~7 days (window tunable).
- [ ] Zero-friends cold-start unchanged; no negative framing anywhere.

### 10.2 — Group invite links (leader-led onboarding)
**Purpose:** let one member pull a whole group in fast — joining adds you to the group and auto-friends its members, instantly populating your feed.
**Entry:** one shareable link per group; any member can copy/share it (e.g. drop in a group text). Tapping opens a join landing.
**Behavior:**
- Each group has one **persistent** invite link; any member can share it, and any member can **revoke/regenerate** it (invalidating the old).
- Tapping → join landing with a **consent confirmation**: "Joining [Group] will connect you with its N members" → **Join / Cancel**.
- On Join: added to the group **and auto-friended with all current members**.
- Logged-out users auth first, then reach the confirmation.
**States:** valid link + logged in → consent landing · valid + logged out → auth then landing · already a member → "You're already in [Group]" · revoked/invalid → friendly "invite no longer active."
**Flow (join):** tap link → (auth if needed) → consent landing → Join → added to group + auto-friended → land in app.
**Data:** group-scoped invite code (variant of the existing friend-referral system); on join, create group membership + friendships with all current members; support revoke/regenerate.
**Out of scope:** per-person invites (already exist), large/public groups (small trusted groups only — Phase 12–13 caveat), joiner approval/moderation.
**Acceptance:**
- [ ] Each group has one shareable, persistent invite link any member can share.
- [ ] A member can revoke/regenerate the link; the old one stops working.
- [ ] A valid link shows a consent confirmation (group name + member count) before joining.
- [ ] Joining adds the user to the group AND auto-friends all current members.
- [ ] Logged-out users auth first, then reach the confirmation.
- [ ] Already-member and revoked/invalid states handled gracefully.

### Open questions
- Recent-green (~7d) and active-now (~15min) windows — final values tunable at build.
- Daypart "usually livens up around [time]" pattern — deferred; revisit once base signals ship.

### Mockup Status
✅ **Mockup approved 2026-07-17** — `mooves-phase10-coldstart.html`. Cross-cutting (Feed grey-state + group invite links), not a single numbered screen. States: grey-feed **around-now** + **this-week** ambient variants, neutral fallback; invite **share** sheet, join **consent**, **already-member**, **dead-link**.

### Design decisions locked at mockup approval (2026-07-17)
- **One signal at a time, not both.** The grey feed shows **either** "N friends around now" **or** "N friends were green this week" — never stacked. (Prefer active-now when ≥3, else recent-green ≥3, else neutral fallback.)
- **Ambient pulse + signal dots are GREY, not green** — the visual signals *activity*, not availability (also honors the DS "green = availability only, never decorative" rule). Green stays reserved for the swipe-to-go-free control (the green-700 CTA), which sits at the top of the grey feed (reused from Phase 9).
- **Copy locked:** ambient trailing line = "Go free to get in on the action."; neutral state headline = "People want to hang out." + "Be the first to go free and get in on the action." No "nobody's free" negativity; commas not em dashes.
- **Zero-friends cold-start unchanged** (cow + invite), per spec out-of-scope.
- **Invite links:** one persistent per-group link; "Reset link" revokes + regenerates; consent landing shows group + member count + avatar preview (aggregate, no per-person emphasis); logged-out routes through existing auth then to consent.

### Code Status
✅ **Coded 2026-07-17 (Jackson: "ship it")** — `tsc --noEmit` + `next build` clean; dev boots clean; `/g/[code]` dead-link landing verified live. **DB migration applied by Jackson:** `users.last_green_at`, `users.last_active_at`, `groups.invite_code` (unique). **10.2 built as Option A (owner-scoped)** — the invite link is owner-managed; joining adds you to the group + auto-friends the owner + all members. New: `api/presence`, `api/groups/[id]/invite` (get/reset), `api/group-invite/[code]` (public resolve), `api/group-invite/[code]/join` (join + auto-friend-all), `app/g/[code]` page + `GroupJoinLanding`, `InviteLinkSheet`, `feed/AmbientTier`. Modified: `api/status` (last_green_at), `api/feed` (ambient counts), `FeedScreen` (presence ping + ambient tier + group-invite resolve), `GroupForm`/EditGroupPage (invite affordance), `middleware` (`/g/` public), `types/database.ts` (+3 cols), `globals.css` (ambient-pulse keyframe). **Build-time verified only** — grey-feed ambient signals, the invite share/reset, and the two-account join→auto-friend flow need Jackson's on-device/multi-account test. **Deviation from mockup:** consent landing shows member *count* not avatar cluster (privacy). **Follow-up fix (2026-07-17, post-merge, branch `fix/group-invite-on-create`):** invite link's real use case is bootstrapping a NEW/empty group, but it was buried in the edit screen and group creation required ≥1 friend. Fixed — group creation now needs only a name (members optional; `/api/groups` POST + `/api/groups/[id]` PATCH allow 0 members), and on create you land on the group with the invite sheet auto-opened (`?share=1`). A zero-friends user can now create a group and grow it via the link. **⚠️ Still-open Phase 11 flag:** owner-scoped groups (Option A) + retained visibility scoping (Phase 9 A2) both need reconciling with Phase 11's "tag = label, symmetric groups" assumptions before Phase 11 is built.

---

## Phase 11 — Groups as Channels, In-App (Spec) — **❌ CUT 2026-07-17**

> **❌ CUT 2026-07-17 (Jackson's call).** This spec (and its 2026-07-17 reconciliation) is scrapped. The full rationale is in the roadmap block above ("### Phase 11 — Groups as channels … CUT"). Short version: applying the intuitive rule — **picking a group when you go green means only that group sees the green** — collapses Phase 11 into the **`visible_to` group-scoping already shipped in Phase 9 (A2)**. The only distinct idea was a "global green with an additive group *label*," which is confusing UX and clutters the go-green sheet + feed, so it's dropped. **Nothing to build:** no group tag, no feed labels, no per-group mute, no member-side group surface, no new columns/tables. Group-scoping a green already ships via the go-green visibility control. **Downstream:** Phase 15 push triggers off group-scoped greens (`visible_to`) — see Phase 15.

---

## Phase 12 — Geolocation & Discovery: Substrate (Spec) — *spec'd 2026-07-16*

*Pure substrate for Phase 13. Coarse location capture + storage + area-matching infra. **No visible "moves in my area" feed yet** — that, and its contextual "see moves near you" opt-in prompt, ship with Phase 13. Privacy: only coarse area is stored; precise coordinates are never persisted.*

### Mockup Status — ✅ APPROVED 2026-07-20 (`mooves-phase12-geo-substrate.html`)
Covers the Settings "Your area" control (no-area · method sheet · locating · area set · edit menu · manual zip) and the optional onboarding step (ask · enter zip · area added). Design decisions locked: control lives under a new Settings **"Discovery"** section; privacy line ("only your zip, never your exact location") foregrounded in every location-touching state; area-set uses a **top-right pencil → action sheet** (Change / Remove), not inline buttons; onboarding "Your area" is step 2 of 3 (after profile, before invite), skippable, never blocks signup.

### Code Status — ✅ CODED 2026-07-20 (branch `feat/phase12-geo-substrate`; `tsc` + `next build` clean)
**Migration applied:** `ALTER TABLE users ADD COLUMN area_zip TEXT;` (only coarse zip stored). **Dataset:** `zipcodes` npm package (MIT, bundled US zip centroids), server-only — no third-party geocoding API. New: `src/lib/geo/index.ts` (`coarsenToZip` nearest-centroid · `lookupZip` · `nearbyZips`/`resolveArea` = 12.2 radius match, `AREA_RADIUS_MILES=25` · Phase-13-ready), `src/lib/geo/client.ts`, `src/app/api/users/area/route.ts` (POST coords→coarsen→**discard**, or zip; DELETE), `src/components/settings/AreaControl.tsx`, `src/app/onboarding/area/page.tsx`, `src/types/zipcodes.d.ts`. Modified: `types/database.ts` (+`area_zip`), `api/users/me` GET (+`areaZip`/`areaCity`/`areaState`), `SettingsScreen` (Discovery section), `onboarding/page.tsx` + `onboarding/invite/page.tsx` (profile→area→invite, 3 step dots). **Privacy invariant enforced:** precise coords are used only in-memory for coarsening, never persisted or logged. **Build-time verified only** — geolocation grant/deny, the onboarding step, and the Settings edit/remove flow need Jackson's authenticated on-device test.

### 12.1 — Coarse location capture & storage
**Purpose:** capture the user's coarse area to power future "moves in my area."
**Entry (two):** (1) **Settings** — a "Your area" control to set/change/remove it anytime; (2) **Onboarding** — an optional, **skippable** step in the signup flow (added after profile setup, before the invite step), since signup is the highest-intent moment to capture area. Both paths use the same capture (device geolocation → coarsen, or manual zip) and write the same coarse-area field. (The contextual in-flow "see moves near you" prompt is still a **Phase 13** addition.)
**Behavior:**
- Capture via **one-time device geolocation, immediately reduced to zip/neighborhood with precise coordinates discarded**; **manual zip entry** as fallback (and for anyone who declines the permission).
- Fully **opt-in** — nothing captured without explicit user action; the onboarding step is skippable and never blocks signup.
- Stored as a **coarse area** on the profile; user can view, change, or remove it. **Precise coordinates never stored.**
**States:** no area (default, dormant) · permission granted → coarse area derived + stored · denied/manual → user enters zip · removed → back to no-area · **onboarding: ask (opt-in / skip) → same capture → continue**.
**Data:** coarse-area field on user profile; write on set/change, delete on remove; no precise coords.
**Out of scope:** continuous/live location, precise GPS storage, background location, the visible area feed + contextual prompt (Phase 13).
**Acceptance:**
- [ ] User can set their area via one-time geolocation (coarsened, coords discarded) OR manual zip entry.
- [ ] Nothing captured without explicit action; fully optional.
- [ ] Coarse area stored on profile; viewable/changeable/removable in Settings.
- [ ] Onboarding offers an optional "Your area" step (skippable, never blocks signup); uses the same capture + coarse-area field.
- [ ] Precise coordinates never persisted.

### 12.2 — Area-matching infrastructure
**Purpose:** define "my area" so Phase 13 can filter local moves.
**Behavior:** matching uses the user's coarse zip **plus nearby zips within a tunable radius**. Any future user-facing area counts honor Phase 10 small-N suppression.
**Data:** server-side matching over coarse zips (radius).
**Out of scope:** the consumer feed itself (Phase 13); precise distance.
**Acceptance:**
- [ ] "My area" resolves to the user's zip + nearby zips within a configurable radius.
- [ ] Matching relies only on coarse area (no precise coordinates).
- [ ] Guardrail hooks ready: no auto-friend-all for large/public groups; small-N suppression on future area counts.

### Open questions
- Radius default (miles / # of adjacent zips) — tune at build.
- Reverse-geocoding source for coarsening geolocation → zip — build decision.

---

## Phase 13 — Sponsored Moves (Spec) — *spec'd 2026-07-16*

*Two surfaces: the **consumer** discover experience and the self-serve **sponsor** dashboard. Guardrail #4 holds — opt-in by interest, area-feed only, never the friend feed. Payments via **Merchant-of-Record** (money to Mooves). **No per-person exposure** to sponsors.*

**Build scope (2026-07-20):** Jackson chose to build ALL of Phase 13, sequenced across **4 surfaces** with per-surface mockup/build gates: (1) consumer Discover + 13.8 flywheel [mobile], (2) internal admin/moderation console [desktop], (3) self-serve sponsor portal [desktop], (4) **billing via Stripe** (decided 2026-07-20, supersedes the MoR/Paddle/Lemon-Squeezy plan — see Surface 4 Spec; **spec ✅ + mockup ✅ `mooves-phase13-billing.html` + ✅ CODED 2026-07-20**). **PHASE 13 COMPLETE — all 4 surfaces coded.** **Sponsor auth = phone OTP** (Jackson's call 2026-07-20 — no password storage): reuses the same Firebase Phone Auth as consumers, but sponsors are a **separate `sponsors` entity with their own session cookie (`mooves-sponsor-token`)**, so a business identity is distinct from any personal consumer account on the same number.

### Surface 1 Mockup Status — ✅ APPROVED 2026-07-20 (`mooves-phase13-discover.html`)
Consumer Discover (13.1 opt-in area+interests · 13.2 feed · 13.3 sponsored card + Interested) **+ 13.8 flywheel** (Go with friends → pre-anchored go-green sheet → anchored card on the friend feed). Design locked: **Discover = a 4th bottom-nav tab**; header location chip; subtle uppercase "Sponsored · brand" disclosure; **"I'm interested"** reveals details in-app then a link out; **"Go with friends"** reuses the Phase 9 go-green sheet pre-anchored (time defaults to the move, visibility + note retained); friend-feed anchored card is compact (name · title · time) with details on tap + normal "I'm in" join. Interest taxonomy locked: Running & fitness · Nightlife · Live music · Food & drink · Markets & pop-ups · Outdoors · Arts & culture · Pickup sports · Wellness · Community.

### Surface 1 Code Status — ✅ CODED 2026-07-20 (branch `feat/phase13-sponsored-moves`; `tsc` + `next build` clean)
**Migration applied by Jackson:** `sponsored_moves` + `move_interested` tables (RLS enabled, no policies — all access via service client), `users.interests TEXT[]`, `users.status_move_id UUID`. **Dataset/area matching** reuses Phase 12 `resolveArea` (nearby-zip radius). **Interest slugs:** `running_fitness · nightlife · live_music · food_drink · markets_popups · outdoors · arts_culture · pickup_sports · wellness · community` (see `src/lib/interests.ts`). New: `discover/page.tsx` + `DiscoverScreen`, `SponsoredCard`, `InterestPicker`, `feed/AnchoredMoveCard`, `api/discover` (GET feed + records impressions), `api/discover/[id]` (GET anchor), `.../interested` (POST/DELETE), `.../click` (POST). Modified: `api/status` (statusMoveId + `brought_over_count`; cleared on grey), `api/feed` (resolves each friend's anchored move), `api/users/me` (interests + own anchored move), `GoGreenSheet` (anchor block + statusMoveId), `FeedScreen` (`?anchor=<id>` → pre-anchored sheet + renders anchors), `FriendCard`/`MyMoveCard` (anchor), `BottomNav` (Discover tab, 4 tabs), `SettingsScreen` (interests editor). **Aggregate-only counters** (impressions/clicks/interested/brought_over), no per-person exposure; move_interested is the interested source of truth. **Interpretation note:** coarse When chip can't encode a date, so the move's `time_text` is surfaced in the anchor + card and the user picks their own coarse chip. **Build-time verified only** — Discover setup→feed→Interested→Go-with-friends→anchored feed card + interests editing need Jackson's authed on-device test (seed `sponsored_moves` rows to populate). **Aggregate impressions are best-effort fire-and-forget** (move to atomic RPC / events table at scale). **Next: surface 2 (admin/moderation console).**

### Surface 2 Mockup Status — ✅ APPROVED 2026-07-20 (`mooves-phase13-admin.html`)
Internal admin/moderation console (**desktop**, Mooves staff only — deliberate break from the phone-frame convention). Covers 13.5 from the Mooves side: **moderation queue** (approve / reject-with-reason on pending sponsor submissions), **all-moves table** (status badges + aggregate impressions/interested/clicks/brought-over), **new-move authoring** (concierge: "Publish move" auto-approves since Mooves authored it; "Save as pending" holds for review), and an **empty-queue** state. Left-sidebar app shell (Moderation · All moves · New move) + ops identity. Status colors on-palette (pending=purple, approved=green-700, rejected=red-500). **Gating decision (proposed at build): an `is_admin` boolean on `users`** — only staff reach `/admin`.

### Surface 2 Code Status — ✅ CODED 2026-07-20 (branch `feat/phase13-sponsored-moves`; `tsc` + `next build` clean)
**Migration applied by Jackson:** `users.is_admin BOOLEAN NOT NULL DEFAULT false` (flip your own row: `UPDATE users SET is_admin=true WHERE phone='+1…'`). New: `src/lib/admin.ts` (`requireAdmin` — every `/api/admin/*` route 403s non-admins, never client-trusted), `app/admin/page.tsx` (checks `isAdmin` from /api/users/me, redirects others to /feed; **not in bottom nav, direct-URL only**), `components/admin/AdminConsole.tsx` (desktop: Moderation queue / All moves table / New move / Edit + reject modal), `MoveForm.tsx`, `RejectModal.tsx`, `api/admin/moves` (GET `?status=`, POST author — `publish:true`→approved else pending), `api/admin/moves/[id]` (PATCH approve/reject-with-reason/edit). Modified: `types/database.ts` (+`is_admin`), `api/users/me` (returns `isAdmin`). Concierge authoring publishes straight to approved (sponsor_id null); reject stores `reject_reason` (surfaced on Edit + to sponsor in surface 3). All-moves table shows aggregate counters for approved rows only. **Build-time verified only** — needs Jackson to set `is_admin=true` on his row + test `/admin` (author/approve/reject, non-admin bounce). **Next: surface 3 (self-serve sponsor portal).**

### Surface 3 Mockup Status — ✅ APPROVED 2026-07-20 (`mooves-phase13-sponsor.html`)
Self-serve sponsor portal (**desktop**, "Mooves for Business"). Covers 13.4 (accounts), 13.5 (authoring), 13.7 (analytics) + the 13.6 billing seam. **Auth = phone OTP** (revised from email/password — no passwords): sign in = phone → 6-digit code; sign up = business name + phone → code. Desktop sidebar app (My moves · New move · Analytics · Billing). **Move lifecycle:** author → **Submit for review** (free, lands as `pending` in the surface-2 queue — sponsors cannot self-publish) → In review → **Live** (auto-billed on publish against a payment method set up once in Billing; **no per-move manual pay** — Jackson's call) → or **Rejected** (reject reason shown inline + Edit & resubmit). Analytics view = aggregate stat tiles (Feeds reached / Interested / Clicks / **Brought to friend feeds** [13.8 flywheel, highlighted]) with small-N suppression ("counts under 5 hidden"). Empty state = "Post your first move." **Approved-but-unpaid intermediate state removed** — billing is auto-charge, not a per-move gate.

### Surface 3 Code Status — ✅ CODED 2026-07-20 (branch `feat/phase13-sponsored-moves`; `tsc` + `next build` clean)
**Migration applied by Jackson:** `sponsors` table (id, phone UNIQUE, business_name, created_at; RLS on, no policies) + FK `sponsored_moves.sponsor_id → sponsors(id) ON DELETE CASCADE`. **Sponsor auth = phone OTP** reusing Firebase, **separate realm**: `src/lib/auth/sponsor-session.ts` signs `mooves-sponsor-token` (`typ:'sponsor'`, sub=sponsorId, same SUPABASE_JWT_SECRET); `src/lib/sponsor.ts` `requireSponsor()` reads/verifies the cookie. **Middleware:** `/sponsor` + `/api/sponsor/` added to PUBLIC_PREFIXES (skip consumer-token gate) — each sponsor API self-gates via requireSponsor; the `/sponsor` page shows auth vs dashboard. New: `app/sponsor/page.tsx`, `components/sponsor/SponsorAuth.tsx` (Firebase phone OTP + business name), `SponsorDashboard.tsx` (My moves / New move / Analytics / Billing-stub), APIs `sponsor/auth/verify` (idToken→upsert sponsor→cookie), `sponsor/auth/logout`, `sponsor/me`, `sponsor/moves` GET(own+analytics)/POST(author→pending, brand defaults to business_name), `sponsor/moves/[id]` PATCH (edit/resubmit→pending). Reuses admin `MoveForm` via `submitLabel`/`footnote` props (sponsors submit-for-review, never self-publish). **Analytics small-N suppressed** server-side (0 shown, 1–4 → null→"<5", ≥5 shown); only `approved` (live) moves show counters. **First fully cross-surface loop works:** /sponsor author → /admin approve → Live in Discover → analytics in sponsor dashboard. **Build-time verified only** — needs Jackson's test (Firebase test number if his own is rate-limited). **Only surface 4 (billing) remains.**

### Surface 4 Spec — Billing via **Stripe** — *spec'd 2026-07-20 (supersedes the MoR plan)*
**Payments decision (2026-07-20):** **Stripe direct**, not a Merchant-of-Record. Mooves is the merchant (sole proprietor — EIN, no LLC needed; Stripe Tax for nexus monitoring). Rationale: US-first, advertising + tips are largely non-taxable, lowest fees (~2.9%+30¢ vs MoR ~5%+50¢), off-session auto-charge fits Stripe's model, and it dodges MoR acceptable-use risk on ads/tips. **This supersedes the Merchant-of-Record decision for BOTH Phase 13 sponsor billing AND Phase 14 tipping** (tipping reuses this Stripe integration). **Pricing model = flat fee per placement** (Jackson's call), one configurable price charged once at publish.

**Move lifecycle with billing:** submitted (`pending`) → moderation `approved` → **[auto-charge]** → **live**. A move is **live (shown in Discover) only when moderation-approved AND paid**. **Mooves-authored moves (`sponsor_id` null) skip billing** and go live on approval.

#### 13.6a — Payment method setup (sponsor portal Billing section)
Replace the Billing stub with a real card-on-file flow: **Stripe SetupIntent + Stripe Elements** to save a card to a **Stripe Customer** (one per sponsor). Show saved card (brand + last4); update / remove. No raw card data ever touches our servers (tokenized by Elements).
**Data:** `sponsors.stripe_customer_id`, `sponsors.default_payment_method_id`.
**Acceptance:** sponsor can add/update/remove a card; stored on their Stripe Customer; card details never hit our backend.

#### 13.6b — Auto-charge on publish
On moderation **approve** (surface 2), if the move has a `sponsor_id`, is unpaid, and the sponsor has a payment method → create an **off-session PaymentIntent** (amount = flat placement price, `confirm:true`) → on success set `paid_at` → move goes **live**. If the sponsor has **no** payment method → the move sits **"approved, awaiting payment"** (not live); when they add a card, the waiting approved moves are charged. Never charged for `pending`/`rejected`. **Webhook `/api/stripe/webhook`** (public, Stripe-signature-verified) handles `payment_intent.succeeded` (mark paid → live) and `payment_intent.payment_failed` (mark failed, surface to sponsor). **Discover query (surface 1) updated:** show only live = `status='approved' AND (sponsor_id IS NULL OR paid_at IS NOT NULL)`.
**Data:** `sponsored_moves.paid_at`, `stripe_payment_intent_id`, `price_cents` (snapshot).
**Acceptance:** approved move + card on file → auto-charges flat fee + goes live; approved move without a card → waits, then charges + goes live once a card is added; failed charge → surfaced to sponsor, move stays not-live; Discover shows only live moves; webhook reconciles state.

#### 13.6c — Billing states in the dashboard
"My moves" gains: **In review** (pending) · **Approved – add payment to go live** (approved, unpaid, no card) · **Payment failed – update card** (approved, charge failed) · **Live** (paid) · **Rejected**. Analytics only on Live.
**Acceptance:** each state renders with the right CTA.

#### Env / deps / notes
Env: `STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`, placement price (env, e.g. `STRIPE_PLACEMENT_PRICE_CENTS`). Deps: `stripe` (server), `@stripe/stripe-js` + `@stripe/react-stripe-js` (client Elements). `/api/stripe/webhook` added to `PUBLIC_PREFIXES` (Stripe calls it unauthenticated; gated by signature). Migration (Jackson applies at build): `sponsors` +`stripe_customer_id`,+`default_payment_method_id`; `sponsored_moves` +`paid_at`,+`stripe_payment_intent_id`,+`price_cents`. SCA/off-session `requires_action` is rare for US cards → treated as unpaid + prompt. No refunds needed (charge only at publish post-approval); manual via Stripe dashboard if ever required. **Build gated on Jackson's Stripe account + keys.**

### Surface 4 Mockup Status — ✅ APPROVED 2026-07-20 (`mooves-phase13-billing.html`)
Billing UI on the sponsor-portal shell. States: Billing — no card (explains model + placement fee), Add card (**Stripe Elements-style** card field + "tokenized, never touches our servers"), Card on file (saved card + Update/Remove), and My moves with all five billing-aware states (**Live** [paid, "billed $X on date"] · **Approved** [amber, "add payment to go live"] · **Payment failed** [red, "update card, we'll retry"] · **In review** · **Rejected**). Design locked: placement fee ($25 placeholder, configurable) surfaced everywhere; amber=action-needed / red=failed / green=live badge system; every non-live state reassures "you weren't/aren't charged."

### Surface 4 Code Status — ✅ CODED 2026-07-20 (branch `feat/phase13-sponsored-moves`; `tsc` + `next build` clean) — **PHASE 13 COMPLETE**
**Migration applied by Jackson:** `sponsors` +`stripe_customer_id`/`default_payment_method_id`; `sponsored_moves` +`paid_at`/`stripe_payment_intent_id`/`price_cents`. **Env (local + Vercel):** `STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PLACEMENT_PRICE_CENTS` (test keys for now). Deps: `stripe` (v22) + `@stripe/stripe-js` + `@stripe/react-stripe-js`. New: `lib/stripe.ts` (server client + `PLACEMENT_PRICE_CENTS`), `lib/stripe-client.ts` (browser loadStripe), `lib/billing.ts` (`chargeForPlacement` off-session PaymentIntent + `chargePendingForSponsor`), `components/sponsor/BillingSection.tsx` (SetupIntent + Elements card-on-file), `api/sponsor/billing` GET/DELETE, `.../setup-intent` POST, `.../payment-method` POST (save default + charge pending), `api/stripe/webhook` (signature-verified; `payment_intent.succeeded`→paid_at→live, `payment_intent.payment_failed`→record attempt; idempotent via `.is('paid_at', null)`). Modified: `types/database.ts` (+5 cols), `middleware.ts` (`/api/stripe/webhook` public), `api/admin/moves/[id]` (approve → `chargeForPlacement`), `api/discover` (live = `status='approved' AND (sponsor_id IS NULL OR paid_at NOT NULL)`), `api/sponsor/moves` (billing state: live/awaiting/failed), `SponsorDashboard` (real Billing section + 5 states). **Live = moderation-approved AND paid; Mooves-authored skip billing (charge returns 'skipped').** Happy path resolves synchronously on approve (off-session confirm); webhook is backup/reconcile. **Build-time verified only** — needs Jackson's device test with Stripe test cards (`4242…`=success, `4000…0002`=decline). **Phase 13 = all 4 surfaces mockup ✅ + code ✅.**

### — Consumer side —

### 13.1 — Location + interest opt-in
**Purpose:** unlock "moves in my area" by capturing area (Phase 12) + interests, exactly when the user opens discover.
**Entry:** first open of the discover / "moves in my area" feed.
**Behavior:** prompt to (a) set coarse area (Phase 12 capture) and (b) pick interest types from the **fixed curated set** (multi-select). Both skippable, editable later in Settings. Declining → gentle "set your area + interests to see moves near you" state.
**Acceptance:**
- [ ] First discover open prompts for area + interests (both skippable, editable in Settings).
- [ ] Interests are a fixed curated multi-select set.
- [ ] Declining shows a gentle setup prompt, not an error.

### 13.2 — "Moves in my area" feed
**Purpose:** surface local sponsored moves matching area + interests.
**Entry:** the discover feed (distinct from the friend Feed).
**Behavior:** shows **approved** sponsored moves filtered by coarse area (nearby-zip radius) **AND** opted-in interests. **Never** friend or stranger greens.
**States:** matches → sponsored cards · no matches → "no moves near you yet" · no area/interests → setup prompt (13.1).
**Data:** query approved live sponsored moves on area + interest; record aggregate impressions.
**Acceptance:**
- [ ] Discover shows only approved sponsored moves matching area + interests.
- [ ] Never shows friend/stranger greens. Empty + setup states handled. Impressions recorded (aggregate).

### 13.3 — Sponsored move card + "Interested"
**Behavior:** DS feed-card shell with a subtle **"Sponsored"** label (not a banner — guardrail #4). Tapping **"Interested"** reveals full details (description, link, lightweight time/place text) in-app **and** increments the sponsor's **aggregate** interested count — sponsor never sees who. A link/CTA opens the sponsor URL (aggregate click counted). *(SMS-back delivery = later A2P-gated enhancement, out of scope.)*
**Acceptance:**
- [ ] Subtle "Sponsored" label on the DS shell.
- [ ] "Interested" reveals details in-app + increments an aggregate count; no identity shared.
- [ ] Link/CTA opens sponsor URL; click counted in aggregate.

### 13.8 — Bring a sponsored move to your friends (the flywheel) — *added 2026-07-20*
**Purpose:** let a user turn a sponsored move they're interested in into **their own green** on the friend feed, rallying friends around it. Gives the user a concrete plan and gives sponsors **organic amplification** — the flywheel connecting Discover → friend feed → joins → group text. *(Consumer-side; extends 13.3 and reuses the Phase 9 go-green flow.)*
**Guardrail #4 resolution:** this **bends** "sponsored moves never appear in the friend feed," but it is **user-initiated, not injection** — a friend deliberately chose to make a plan around it, the way they'd share any event. The friend feed still never surfaces sponsored content on its own. **Disclosure is required:** the friend-facing card carries a **subtle "Sponsored" tag + brand** (honest "good ads," never deceptive).
**Entry:** from an **Interested** sponsored card (13.3), a **"Go with friends"** action.
**Behavior:**
- "Go with friends" opens the **existing go-green sheet** (Phase 9 swipe→sheet), **pre-anchored** to the sponsored move: the coarse **time chip defaults to the move's time/day**, the **visibility control** (`visible_to`: everyone / specific groups) is available, plus an optional note. Going green **attaches the move** to the user's status.
- The resulting green shows on friends' feeds **anchored to the move**: a **compact card** — "[Name] is free · [move title] · [time]" with a **subtle Sponsored tag + brand**; tapping reveals **full details + the sponsor link** (details on tap, not inline).
- Friends **"I'm in" / join** and start the **group text** exactly as in Phase 9 (blast stays no-prefill per A4; the move details live on the card).
- **Going grey clears** the anchored move, like any status.
**Data:** a nullable reference from the user's status to the sponsored move (e.g. `users.status_move_id`, cleared on go-grey) so the friend feed can render the anchor. Aggregate **`brought_over` count** + downstream friend-feed impressions per sponsored move (aggregate, small-N suppressed, no identities) — the sponsor-visible flywheel metric.
**Out of scope:** editing the sponsor's move content; anchoring more than one move at once; non-sponsored user "events" (this is sponsored-move-specific for now).
**States:** interested card → "Go with friends" · go-green sheet pre-anchored (time/visibility/note) · friend-feed card (anchored, sponsored-tagged, details on tap) · go-grey clears.
**Acceptance:**
- [ ] From an interested sponsored move, "Go with friends" opens the go-green sheet pre-anchored (time defaults to the move; visibility + note available).
- [ ] The green shows on friends' feeds anchored to the move: compact card (name · title · time) with a subtle Sponsored tag + brand; details + sponsor link on tap.
- [ ] Friends can join ("I'm in") and start the group text as in Phase 9; going grey clears the anchor.
- [ ] Aggregate `brought_over` + friend-feed impressions counted per move; no identities; small-N suppression.

### — Sponsor side (self-serve dashboard) —

### 13.4 — Sponsor accounts
**Behavior:** a **distinct sponsor portal**, separate from the consumer phone-auth app; sponsors sign up / log in via a business (email) account with a basic profile.
**Acceptance:**
- [ ] Sponsors can create and log into a business account, separate from consumer accounts.

### 13.5 — Move authoring + moderation
**Behavior:** author a move — title, short description, **one** interest category, area target (zip + radius), external link, optional image, optional lightweight time/day **text** (no calendar). Submissions enter a **moderation queue**; Mooves approves/rejects before go-live. Only approved moves appear.
**Acceptance:**
- [ ] Sponsors author a move with those fields.
- [ ] New/edited moves require Mooves approval before going live.
- [ ] Rejections return a reason to the sponsor.

### 13.6 — Billing (Merchant-of-Record)
**Behavior:** publishing a placement requires payment via the **MoR** (Paddle/Lemon Squeezy) — handles tax/payout, no LLC, money to Mooves. A move goes live only after **both** payment and moderation approval. Pricing model TBD (open questions).
**Acceptance:**
- [ ] Publishing requires successful MoR payment; money flows to Mooves (no user KYC / payouts).
- [ ] Move goes live only after payment + moderation approval.

### 13.7 — Sponsor analytics
**Behavior:** per move — impressions, clicks, "interested" counts, all **aggregate**, small-N suppressed; never individual identities.
**Acceptance:**
- [ ] Aggregate impressions / clicks / interested per move; no identities; small-N suppression applied.

### Open questions
- Pricing model (flat per-placement / per-window / CPM) — finalize with MoR setup.
- Moderation policy specifics + turnaround; sponsor account verification (anti-spam/impersonation).
- Exact interest-category list (lock at mockup); final sponsored-move field set (image? time-text limits).

---

## Phase 14 — Scale & Platform (Spec) — *spec'd 2026-07-16*

*Most of Phase 14 dissolved into earlier decisions: payments = MoR (Phase 13 infra, reused here), WhatsApp stays trigger-gated/directional (not spec'd). This spec covers **tipping** and the **landing page**.*

### 14.1 — Cow tipping
**Purpose:** let fans support Mooves with a small tip, at a positive moment.
**Entry:** a **tip jar at the very bottom of the home Feed**, rendered **only when the feed currently shows 3+ moves (greens)** — so it appears only when the feed is lively, never on a quiet/empty feed, and never pressures.
**Behavior:**
- Friendly "cow tip / support Mooves" prompt.
- Offers **preset one-time amounts** (e.g. $1 / $3 / $5) + a **custom** amount.
- Payment via the shared **Merchant-of-Record** (money to Mooves; same infra as Phase 13).
- Success → a **simple warm thank-you** (playful cow moment); **no badges, leaderboard, or status**.
**States:** feed <3 moves → hidden · feed ≥3 moves → visible at the bottom · tip flow: amount → MoR checkout → thank-you.
**Data:** tip transactions via MoR; aggregate totals only (no public per-user status).
**Out of scope:** recurring/membership tips, tipping other users (money → Mooves only), gamification/leaderboard/status, tip-gated features.
**Acceptance:**
- [ ] Tip jar appears at the bottom of the Feed only when 3+ moves are showing; hidden otherwise.
- [ ] Preset one-time amounts + custom amount.
- [ ] Payment via the MoR to Mooves. *(⚠️ superseded — see 14.1a: **Stripe direct**, not MoR.)*
- [ ] Success shows a simple warm thank-you; no badges/leaderboard/status.

#### 14.1a — Build detail (Stripe, settled 2026-07-20)
*Elaborates 14.1 into a build-ready spec. **PAYMENTS = STRIPE DIRECT, not a Merchant-of-Record** — the 14.1 "MoR" references above are superseded (same decision as Phase 13 surface 4; sole proprietor, no LLC). Reuses the shipped Phase 13 Stripe integration: `src/lib/stripe.ts` (server client), `src/lib/stripe-client.ts` (`loadStripe`), `@stripe/react-stripe-js` Elements, and the existing `/api/stripe/webhook`. Env already set (`STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`) — tips are variable-amount so **no placement-price env** is used. Built on branch `feat/phase14-tipping` off main (after landing merged).*

**Payer + flow.** The payer is an **authed consumer** (`mooves-token`) making a **one-time tip with no saved card** — distinct from Phase 13's card-on-file off-session auto-charge. **WALLET-ONLY (Jackson's call at mockup approval 2026-07-20): Apple Pay / Google Pay ONLY — no manual card-entry path.** So use the Stripe **Express Checkout Element** (renders just the wallet buttons), **not** the Payment Element (which renders a card form). Stays in-app for the warm cow thank-you; no `customer`, no saved payment method. If a device shows no wallet (Express Checkout Element renders empty), show a graceful "Apple Pay or Google Pay isn't available on this device" fallback message and no card option.
1. Feed shows **≥3 moves** → tip jar visible at the very bottom (see threshold below).
2. Tap a **preset ($1 / $3 / $5)** or enter a **custom** amount → tap the tip CTA.
3. `POST /api/tips/intent { amount_cents }` (protected route, reads `x-user-id`) → **server validates/clamps the amount** (integer; within `[TIP_MIN_CENTS, TIP_MAX_CENTS]`, e.g. 100–20000 = $1–$200 — never trust the client-displayed amount) → creates a PaymentIntent (`currency: 'usd'`, `automatic_payment_methods: { enabled: true }`, **`metadata: { type: 'tip', user_id }`**, **no `customer`**) → returns `client_secret`.
4. Mount the **Express Checkout Element** (in the sheet) with the `client_secret`; on the element's confirm event, `stripe.confirmPayment` with the wallet result. No card fields anywhere.
5. Success → **warm cow thank-you** in-app (no redirect, no totals, no badges/leaderboard/status). Failure → inline error + retry.

**Webhook.** Extend `/api/stripe/webhook` to **branch on `metadata`**: placement PIs carry `move_id` (existing path → `sponsored_moves`, untouched); **tip PIs carry `type:'tip'`** → insert a ledger row on `payment_intent.succeeded` (idempotent). No collision (placements have no `type`, tips have no `move_id`).

**Data model — NEW `tips` ledger table (Jackson applies the migration in Supabase):**
`id uuid pk default gen_random_uuid()` · `user_id uuid null references users(id)` (who tipped — **internal only, never displayed**) · `amount_cents int not null` · `stripe_payment_intent_id text unique not null` (idempotency; webhook insert `on conflict do nothing`) · `created_at timestamptz not null default now()`. **RLS enabled, NO policies** (deny-all to anon/authenticated; service client bypasses — matches `sponsored_moves`/`move_interested`). It's an **internal ledger for Stripe reconciliation only** — the consumer never sees totals, and the tip-jar's ≥3-moves visibility reads the **feed's current move count** (already in `FeedScreen`), so there is **no client read path** for tip aggregates.

**Threshold (confirm at mockup).** "3+ moves showing" = the count of green move cards currently rendered in the Feed (friends' greens; the viewer's own green, if shown, counts). Below 3 → tip jar hidden entirely.

**Invariants (must hold):** money → **Mooves only** (no destination/transfer/Connect) · **one-time only** (no recurring, no SetupIntent, no saved card) · **aggregate/internal-only** (no per-user status anywhere) · **never tip-gates** any feature · **no gamification**.

**Anticipated files (spec-level, not binding):** NEW `src/lib/tips.ts` (presets + `TIP_MIN_CENTS`/`TIP_MAX_CENTS` + server-side validation), `src/app/api/tips/intent/route.ts`, `src/components/feed/TipJar.tsx` (jar → amount select → Payment Element → thank-you/error states). MODIFY `src/app/api/stripe/webhook/route.ts` (tip branch), `src/components/feed/FeedScreen.tsx` (render `TipJar` at bottom when move count ≥3), `src/types/database.ts` (+`tips`).

**PostHog (aggregate only):** `tip_jar_shown`, `tip_amount_selected` {amount_cents}, `tip_started` {amount_cents}, `tip_succeeded` {amount_cents}, `tip_failed`.

**States for the mockup:** feed <3 moves → **hidden** · feed ≥3 → **visible jar** (collapsed prompt) · **amount select** (presets + custom) · **wallet payment** (Apple Pay / Google Pay, no card) · **thank-you** (cow) · **error** (payment failed → retry).

**Acceptance (build-detail additions):**
- [ ] Payment is a **one-time Stripe PaymentIntent** to Mooves (no MoR, no saved card, no recurring); amount validated server-side.
- [ ] Payment is **wallet-only** (Apple Pay / Google Pay via Express Checkout Element) — **no card-entry fields**; graceful message if no wallet is available.
- [ ] Webhook distinguishes tip PIs (`metadata.type='tip'`) from placement PIs; tips insert into the `tips` ledger idempotently.
- [ ] No per-user status/totals surfaced anywhere; no gamification; tipping never gates a feature.

### 14.1 Tipping — ✅ CODED 2026-07-20 (`feat/phase14-tipping`) · Mockup ✅ APPROVED (`mooves-phase14-tipping.html`)
**Build:** NEW `src/lib/tips.ts` (presets [100,300,500], $1–$200 range, `isValidTipAmount`/`formatTip`), `src/app/api/tips/intent/route.ts` (server-validated one-time PaymentIntent, `metadata.type='tip'`, no customer), `src/components/feed/TipJar.tsx` (jar → amount sheet → **Express Checkout Element** wallet-only → thank-you/error; no-wallet fallback; PostHog tip_jar_shown/tip_amount_selected/tip_started/tip_succeeded/tip_failed). MODIFIED `src/app/api/stripe/webhook/route.ts` (tip branch → upsert into `tips`, idempotent on unique PI id; placement branch untouched), `src/components/feed/FeedScreen.tsx` (`<TipJar visible={friends.length + (isAvailable?1:0) >= 3} />` at feed bottom), `src/types/database.ts` (+`tips`). **Migration Jackson applies:** `tips` table (id, user_id nullable FK users, amount_cents, stripe_payment_intent_id UNIQUE, created_at; RLS on, no policies). `tsc` + `next build` clean. **Build-time verified only** — jar needs authed feed w/ 3+ live moves; wallets (Apple/Google Pay) need deployed makemooves.app + Stripe Apple Pay domain registration; needs Jackson's device test. Test keys → live keys + live webhook when taking real money. **PHASE 14 COMPLETE (14.2 landing shipped + 14.1 tipping coded).**

Standard 320px phone-frame, **grounded in the real Feed** (gradient header + centered `Wordmark` cow lockup · "Slide to go free" control · "Free right now" green-tinted `FriendCard`s with "I'm in"/"You're in ✓" · real 4-tab line-icon `BottomNav`). States (toggle): (1) feed <3 → **jar hidden** · (2) feed ≥3 → **jar visible** at feed bottom (headline **"Cow Tipping"**, body "If it got you out today, consider tipping the cow.", round **$** purple button) · (3) **amount** sheet (presets $1/$3/$5, $3 default, + custom) · (4) **wallet payment** — **Apple Pay + Google Pay only, NO card entry** (Jackson's call) · (5) **thank-you** cow (no totals/badges) · (6) **error** retry. **Build via mooves-build-loop; use Stripe Express Checkout Element (wallet-only), the `tips` ledger migration, and the webhook `type:'tip'` branch.**

### 14.2 — Landing page (makemooves.app)
**Purpose:** explain Mooves to new visitors and drive them into the app.
**Entry:** makemooves.app (marketing site), decoupled from the app — ships anytime.
**Behavior:** a lightweight, mobile-first marketing page that explains the core loop (go green → friends see it → plan over text), uses the DS visual language + cow brand, and has a clear CTA into the app.
**Data:** none (static/marketing); optional analytics.
**Out of scope:** blog/docs, sponsor marketing (that's the Phase 13 portal), auth on the landing page.
**Acceptance:**
- [ ] Explains the core loop with a clear CTA into the app.
- [ ] Uses the DS visual language + cow brand; mobile-first/responsive.
- [ ] Decoupled — shippable independently of app releases.

#### 14.2a — Build detail (settled 2026-07-20, session kickoff)
*Elaborates 14.2 into a build-ready spec. Landing-first (before tipping) on branch `feat/phase14-landing`.*

**Routing — lives at `/` (the bare domain).** Today `src/app/page.tsx` is just `redirect('/auth')`, so a cold visitor to makemooves.app lands straight on the phone-entry screen — there's no marketing surface. Change:
- Make `/` **public** in `src/middleware.ts`. `PUBLIC_PREFIXES` uses `startsWith`, which `'/'` would match for *everything* — so add an **exact-match** allowance (`pathname === '/'`) rather than a prefix entry.
- The root **server component** reads the `mooves-token` cookie: **valid session → `redirect('/feed')`** (logged-in users never see marketing); **no/invalid token → render the landing page.** This keeps the "authed users skip the marketing page" behavior while exposing the page to logged-out visitors and search/share traffic.
- **Primary CTA → `/auth`** (the existing phone-entry flow). No auth logic on the landing page itself (out of scope, per 14.2).

**Layout convention — responsive full-width, NOT the 320px phone-frame.** Deliberate break from the mockup convention (same call as the Phase 13 admin/sponsor desktop mockups). The page is **mobile-first** (a centered single-column reading width, ~`max-w` ≈ 480–560px for content) that **widens gracefully on desktop** when a shared link is opened on a laptop. Never a locked phone frame.

**Visual language — DS SSOT.** `docs/design-system.md` tokens/brand: `purple-50` page bg, white cards, `purple-500`/`purple-700` brand, `green-500` decorative + **`green-700` for any green fill carrying text/CTA** (AA), `ink-900`/`ink-500` text, `display-*`/`body-*` type scale. Cow brand via `public/brand/` assets + `CowMark`/`Wordmark` lockup (Phase 8). Status treatments follow **dot + label + color** if any green/grey status chip is depicted.

**Content (single explainer page, top → bottom):**
1. **Hero** — cow + wordmark lockup, one-line value prop, primary CTA into the app (`/auth`).
2. **The core loop, 3 beats** — *go green → friends see it → plan over text.* Three simple steps (icon/illustration + short label each), the heart of the page.
3. **Why it's different** — short reassurance beats (no feeds to scroll / no pressure / a green just means "I'm free"). Kept light; exact copy in the mockup.
4. **Closing CTA** — repeat the CTA into the app; tiny footer (© / makemooves.app). **No** signup form, blog, docs, sponsor pitch, or auth on the page.

**Analytics (optional):** PostHog `landing_view` on load + `landing_cta_click` on the primary CTA. Aggregate only.

**Out of scope (reaffirmed):** no blog/docs, no sponsor marketing (that's the Phase 13 `/sponsor` portal), no auth/signup form on the page, no email capture.

**Acceptance (build-detail additions):**
- [ ] `/` renders the marketing page for logged-out visitors; a valid `mooves-token` redirects to `/feed`.
- [ ] `/` is a public route (exact-match) in middleware; no other route's protection changes.
- [ ] Primary CTA routes to `/auth`; no auth/signup logic on the page.
- [ ] Responsive (mobile-first → widens on desktop); DS tokens + cow brand; green CTAs use `green-700`.

### 14.2 Landing — ✅ CODED 2026-07-20 (`feat/phase14-landing`) · Mockup ✅ APPROVED (`mooves-phase14-landing.html`)
**Build:** NEW `src/components/landing/LandingScreen.tsx` (approved mockup in Tailwind + DS tokens; `CowMark`; `md:` responsive breakpoints; PostHog `landing_view`/`landing_cta_click`; ↓ scroll-to-loop). MODIFIED `src/app/page.tsx` (async server component: valid `mooves-token`→`redirect('/feed')`, else render landing; marketing `metadata`) + `src/middleware.ts` (`/` exact-match public). `tsc` + `next build` clean; `/` compiles dynamic; live render verified, no console errors. **No DB/migration** (static page). CTAs → `/auth`. **Build-time + live-render verified; Jackson's device pass optional. NEXT: Phase 14 surface 2 = cow tipping.**

Responsive marketing page (breaks the 320px phone-frame; Mobile/Desktop toggle in the mockup chrome). Sections: nav (cow+wordmark · "Open app") → hero (cow tile · "Green means you're free" eyebrow · headline "The easiest way to actually hang out." · sub ends "That's it." · **"Make Mooves"** CTA · round ↓ scroll button) → core loop 3 beats ("Three taps from bored to booked": Go green / Friends see it / Plan over text, each with a tiny visual) → why-it's-different dark band (No feed to scroll · No pressure · Just your people) → closing CTA ("Ready when you are" · "Make Mooves") → footer. **Primary CTA = purple-500** (green reserved for the availability metaphor); green text uses `green-700`. Both CTAs route to `/auth`. **Next: build via mooves-build-loop.**

### Deferred / directional (not spec'd)
- **WhatsApp / international** — trigger-gated on real non-US demand; remains directional, no committed scope.

### Open questions
- Exact preset tip amounts + copy (mockup).
- ~~Landing-page content/sections + routing (landing at `/` vs app routes)~~ — **RESOLVED 2026-07-20:** at `/` with authed→/feed redirect; responsive (not phone-frame); content plan in 14.2a.
- "3+ moves" tip-jar threshold — confirm/tune.

---

## Phase 15 — Push Notifications & Home-Screen Install (Spec) — *spec'd 2026-07-16*

*Web Push via PWA through Firebase/FCM (no native app, no A2P). Foundations (manifest `display: standalone` + cow icons) already shipped in the design-system-foundation PR. **Platform reality:** Android/desktop push from a permission prompt (install optional); iOS 16.4+ push **only after Add-to-Home-Screen** — install rate is the KPI. **Consequence of the group-scoped-only trigger:** push reaches dormant friends only when a mover **scopes their green to a group** (the shipped `visible_to` control); greens sent to everyone push no one — a deliberate group-level/no-per-person choice that only partially closes Phase 10's dormant-reach gap. (Phase 11, which would have formalized "group channels," was CUT 2026-07-17; this phase reuses the existing group-scoping directly.)*

### 15.1 — PWA foundations (service worker)
**Already shipped:** manifest (`display: standalone`) + cow app icons (foundation PR).
**Behavior:** add + register a **service worker** (required for Web Push / offline shell). HTTPS already in place.
**Acceptance:**
- [ ] Service worker registered and active in supported browsers.
- [ ] Manifest + icons confirmed; PWA is installable.

### 15.2 — Web push pipeline (FCM)
**Behavior:** on opt-in (15.4), request OS notification permission **contextually** (never on first load). On grant, obtain the FCM/VAPID token and store it per user; server sends pushes via FCM for qualifying triggers (15.3). Handle unsubscribe / token expiry / revocation.
**States:** not-opted-in · opted-in+granted (receiving) · denied (graceful, no nagging) · revoked/expired (stop, allow re-opt-in).
**Out of scope:** SMS/email channels; native push.
**Acceptance:**
- [ ] Permission requested only contextually on opt-in.
- [ ] Push tokens stored per user; pushes sent via FCM.
- [ ] Denied/revoked/expired handled gracefully (no repeat prompting).

### 15.3 — Notification triggers
**Behavior:** a push fires to a group's members (via `group_members`) when a member goes green **scoped to that group** (the shipped `visible_to` control). **Only** group-scoped greens trigger push — greens sent to everyone push no one; **no per-person** "friend X is green." Respects a **per-group notification mute** (defined in this phase), plus **quiet hours** and **rate-limiting/batching**. Copy is aggregate-friendly; never a rejection surface.
**Consequence (documented):** dormant friends reached only via group-scoped greens — the deliberate group-level choice.
**Out of scope:** per-person notifications, any-friend-green push, aggregate friend digests (considered, not chosen).
**Acceptance:**
- [ ] Push fires to a group's members when a member goes green scoped to that group.
- [ ] Greens sent to everyone (not group-scoped) trigger no push; no per-person notifications.
- [ ] Respects a per-group notification mute, quiet hours, and rate-limiting.

### 15.4 — "Add to Home Screen" install nudge
**Entry:** fires **after a value moment** (first join/blast, or when notifications would clearly help) — not on first load.
**Behavior:** detect platform/install state — **iOS + not installed** → Share → Add-to-Home-Screen guidance (iOS push requires the installed PWA); Android/desktop → standard install/permission path. Framed as "add Mooves to get notified when friends are free." Dismissible, limited re-prompts. Accepting leads into the contextual permission ask (15.2).
**Out of scope:** forcing install, blocking the app behind install.
**Acceptance:**
- [ ] Nudge fires after a value moment, not on first load.
- [ ] iOS-not-installed users get correct Add-to-Home-Screen guidance; others get the standard path.
- [ ] Dismissible with limited re-prompts; accepting leads to the contextual permission ask.

#### Surface A — Build detail (PWA foundations + install nudge, settled 2026-07-20)
*Phase 15 is split into two surfaces with per-surface mockup+build gates (like Phase 13). **Surface A = 15.1 (service worker) + 15.4 (install nudge). ZERO external deps — ships now.** Surface B = 15.2 + 15.3 (Web Push pipeline + triggers), gated on a Firebase **VAPID key**. Branch `feat/phase15-pwa-install` off main (after Phase 14 merged).*

**15.1 — Service worker.** Add a minimal static **`public/sw.js`** (served at `/sw.js`, root scope): `install` → `skipWaiting()`, `activate` → `clients.claim()`, no offline caching for v1. It exists to make the app a registrable/installable PWA and to be the host that **Surface B extends** with `push` + `notificationclick` handlers (kept out of Surface A — inert without a subscription). Register it client-side via a small **`ServiceWorkerRegister`** component (guarded `'serviceWorker' in navigator`), mounted app-wide in the root layout. Manifest (`display: standalone`) + cow icons already ship, so SW + manifest = installable.

**15.4 — Install nudge.**
- **Trigger = after the first join or blast** (the value moment Jackson picked), never on first load. FeedScreen's join (`handleToggleJoin`) and blast (`handleBlast`) handlers call a `markValueMoment()` helper (sets a localStorage flag + dispatches an event); the nudge shows on the *next* eligible check.
- **Platform detection (client):** already installed (`display-mode: standalone` or iOS `navigator.standalone`) → **never show.** **iOS Safari + not installed** → show **Share → Add to Home Screen** guidance (iOS has no `beforeinstallprompt`; teach the manual steps, show the iOS Share glyph). **Android/desktop Chromium** → capture `beforeinstallprompt` (preventDefault, stash it); nudge "Add" → call the stashed `prompt()` (native install).
- **Framing:** "Add Mooves to your home screen so you know the moment friends are free." Installing now is the prerequisite for Surface B push (mandatory on iOS). Accepting on iOS = shows the steps; on Android = native prompt. (The contextual **push-permission** ask is Surface B — Surface A stops at install.)
- **Dismissal / cadence:** dismissible; after a dismiss, suppress for a **7-day cooldown**; **cap at 3 total** shows, then only re-reachable from a future Settings entry (Surface B). Non-naggy.
- **Mocked states:** (1) iOS-not-installed → Share/Add-to-Home guidance sheet · (2) Android/desktop-not-installed → install nudge (Add / Not now) · (3) already-installed or capped → no nudge. The service worker is invisible plumbing (no mockup).
- **Data model:** none (install state is client-side: `display-mode` detection + localStorage flags `mooves_value_moment`, `mooves_install_nudge_dismissed_at`, `mooves_install_nudge_count`). **No migration.**
- **PostHog:** `install_nudge_shown` {platform}, `install_nudge_accepted` {platform}, `install_nudge_dismissed`, `pwa_installed` (from the `appinstalled` event).
- **Anticipated files:** NEW `src/lib/pwa.ts` (isStandalone/isIOS + value-moment & dismissal storage helpers), `public/sw.js`, `src/components/pwa/ServiceWorkerRegister.tsx`, `src/components/pwa/InstallNudge.tsx`. MODIFY root layout (mount both), `src/components/feed/FeedScreen.tsx` (call `markValueMoment()` in join/blast).

**On Jackson's end for Surface A: nothing to configure.** After it ships, device-test install (iOS: Share → Add to Home Screen shows the cow icon, not a fallback "M"; Android: the install prompt appears). **Heads-up for Surface B (do anytime, not blocking A):** generate the Web Push VAPID key — Firebase Console → Project Settings → Cloud Messaging → "Web Push certificates" → **Generate key pair** → put the public key in `NEXT_PUBLIC_FIREBASE_VAPID_KEY` (`.env.local` + Vercel).

**Surface A — ✅ CODED 2026-07-20 (`feat/phase15-pwa-install`)** · Mockup ✅ APPROVED (`mooves-phase15-install.html`)
**Build:** NEW `public/sw.js` (minimal SW: skipWaiting + clients.claim; Surface B extends w/ push handlers), `src/lib/pwa.ts` (isStandalone/isIOS + value-moment & dismissal/cooldown/cap helpers, BeforeInstallPromptEvent type), `src/components/pwa/ServiceWorkerRegister.tsx`, `src/components/pwa/InstallNudge.tsx` (iOS guidance vs Android native-prompt sheet, eligibility gating, PostHog install_nudge_shown/accepted/dismissed + pwa_installed). MODIFIED `src/app/layout.tsx` (mounts both app-wide), `src/components/feed/FeedScreen.tsx` (markValueMoment on join + blast), **`src/middleware.ts` (BUG FIX: `/sw.js`, `/manifest.webmanifest`, `/brand/`, `/icon`, `/apple-icon` added to PUBLIC_PREFIXES — SW registration rejects a redirected script, and manifest/icons must resolve for logged-out visitors to install).** `tsc` + `next build` clean; SW registers+activates live (scope /, served direct), manifest/icons serve direct, no console errors. **No DB/migration** (client-side localStorage + display-mode detection). **Build-time + partial-live verified** — the nudge itself needs Jackson's device test (join/blast on deployed HTTPS: iOS Share→Add-to-Home guidance, Android native prompt) + install shows cow icon. **Follow-up (not blocking): add 192/512 maskable PNG icons to the manifest.** **NEXT: Surface B = Web Push pipeline + triggers, gated on the VAPID key.**

**Surface A Mockup Status — ✅ APPROVED 2026-07-20 (`mooves-phase15-install.html`)**
Phone-frame over the real Feed. States (toggle): (1) **iOS not-installed** — teaching sheet ("Keep Mooves on your home screen / so you know the moment friends are free") with two numbered steps + real iOS glyphs (Share button, ⊕ Add to Home Screen) + note "On iPhone, notifications need the app added first" + "Maybe later"; (2) **Android/desktop not-installed** — simpler sheet, primary "Add to home screen" button (native prompt) + "Not now"; (3) **installed/capped** — plain feed, no nudge. Install-only (no push-permission ask — that's Surface B). Framed around the coming-push benefit. **Build via mooves-build-loop.**

**Surface A acceptance:**
- [ ] Service worker registers + is active; PWA is installable (manifest + icons + SW).
- [ ] Install nudge fires after the first join/blast, not on first load; never when already installed.
- [ ] Correct iOS (Share→Add-to-Home guidance) vs Android/desktop (native prompt) path.
- [ ] Dismissible with a cooldown + capped re-prompts; no push-permission ask in Surface A.

#### Surface B — Build detail (Web Push pipeline + triggers, settled 2026-07-20)
*Elaborates 15.2 + 15.3 into a build-ready spec. Branch `feat/phase15-push` off main (after Surface A merged, PR #16). Web Push via **FCM through the existing Firebase project** (firebase-admin ^13 already a dep — no new vendor). Extends Surface A's `public/sw.js` (one SW, no separate `firebase-messaging-sw.js`).*

**⚠️ Env dependency (Jackson).** The VAPID key alone isn't enough — the client Firebase config (`src/lib/firebase/client.ts`) has only apiKey/authDomain/projectId, but FCM `getToken()` also needs **`messagingSenderId`** (Console → Project Settings → Cloud Messaging → Sender ID) and **`appId`** (Project Settings → General → SDK config). Add `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` + `NEXT_PUBLIC_FIREBASE_APP_ID` (+ the already-set `NEXT_PUBLIC_FIREBASE_VAPID_KEY`) to `.env.local` + Vercel. **Server send needs nothing new** (firebase-admin uses the existing service account).

**15.2 — Web push pipeline.**
- **Permission = contextual opt-in only, never on load** (settled: **contextual card + Settings toggle**). A "Turn on notifications so you know when your group's free" card appears after a value moment / installed session (chained after the Surface A install nudge); the master control also lives in Settings → Notifications. Tapping enable → OS `Notification.requestPermission()` → on grant, a separate Firebase app + `getMessaging` + `getToken(messaging, { vapidKey, serviceWorkerRegistration })` (reuse Surface A's SW registration) → `POST /api/push/subscribe { fcmToken, platform }`.
- **States:** not-opted-in · granted (receiving) · denied (graceful, no re-prompt nag) · revoked/expired (server drops the token on FCM send failure; user can re-opt-in).
- **SW handlers (append to `public/sw.js`):** `push` → `self.registration.showNotification(title, { body, icon:/brand/icon-180.png, badge, data:{ url } })`; `notificationclick` → focus an open Mooves client or `clients.openWindow('/feed')`.

**15.3 — Notification triggers.**
- **Trigger point = `POST /api/status` go-green.** When `visible_to` is a **non-empty** array of group IDs (a group-scoped green), enqueue a push (fire-and-forget, like impressions — never block the status write). `visible_to = null` (everyone) → **no push**. No per-person "friend X is green."
- **Recipients:** `group_members` of those groups, **minus** the mover, **minus** users with a `group_notification_mutes` row for that group, **minus** users with no push subscription, **minus** groups inside the rate-limit floor.
- **Rate-limit:** a **60-minute per-group floor** via `groups.last_notified_at` — if a group was notified < 60 min ago, skip (prevents a burst of greens spamming the group). Update `last_notified_at` on send.
- **Copy:** aggregate-friendly, never names a person as a rejection surface. e.g. title "Someone in {group} is free" / body "Open Mooves to jump in." (final copy in build; no per-person identity).
- **Send:** `getMessaging(adminApp).sendEachForMulticast({ tokens, webpush: { notification, fcmOptions:{ link } } })`; on `messaging/registration-token-not-registered` errors, delete that `push_subscriptions` row (expiry/revocation cleanup).

**Data model (migrations Jackson applies in Supabase):**
- `push_subscriptions`: `id uuid pk default gen_random_uuid()` · `user_id uuid not null references users(id)` · `fcm_token text unique not null` · `platform text` · `created_at timestamptz default now()` · `last_seen_at timestamptz default now()`. RLS on, **no policies** (service client only).
- `group_notification_mutes`: `user_id uuid references users(id)` · `group_id uuid references groups(id)` · `created_at timestamptz default now()` · PK `(user_id, group_id)`. RLS on, no policies. Row present = muted.
- `groups`: `+ last_notified_at timestamptz` (rate-limit floor).

**Mocked surfaces (Surface B):** (1) **contextual notification opt-in card** (post-value-moment / installed); (2) **Settings → Notifications section** (master toggle only — **quiet hours CUT**); (3) **per-group mute toggle** on the group view. The FCM pipeline + SW handlers are invisible plumbing (no mockup).

**PostHog:** `push_optin_shown`, `push_optin_enabled`, `push_optin_denied`, `push_group_muted`/`push_group_unmuted`, `push_sent` (server, aggregate count only).

**Anticipated files:** NEW `src/lib/firebase/messaging.ts` (client getToken helper), `src/lib/push.ts` (server send + recipient filtering), `src/app/api/push/subscribe/route.ts` (POST store token) + `.../unsubscribe` (DELETE), `src/app/api/push/mute/route.ts` (group mute toggle) or fold into group routes, `src/components/pwa/NotificationOptIn.tsx`, `src/components/settings/NotificationSettings.tsx`. MODIFY `public/sw.js` (+push/notificationclick), `src/lib/firebase/client.ts` (+messagingSenderId/appId in config), `src/app/api/status/route.ts` (fire push on group-scoped green), group view (mute toggle), `SettingsScreen`, `src/types/database.ts` (+3 tables/cols).

**Surface B acceptance:**
- [ ] Permission requested only on contextual opt-in (card or Settings), never on load; token stored per user.
- [ ] Group-scoped green → push to that group's members (minus mover/muters/rate-limited); everyone-greens push no one; no per-person notifications.
- [ ] Per-group mute + 60-min per-group rate-limit respected; expired/revoked tokens cleaned up.
- [ ] SW shows the notification; tapping it opens the feed.

**Surface B — ✅ CODED 2026-07-20 (`feat/phase15-push`)** · Mockup ✅ APPROVED (`mooves-phase15-push.html`)
**Build:** NEW `src/lib/firebase/messaging.ts` (client enablePush → getToken), `src/lib/push.ts` (server sendGroupGreenPush: per-group recipients from group_members minus mover/muters, 60-min rate-limit via groups.last_notified_at, data-only FCM sendEachForMulticast, stale-token cleanup), `src/app/api/push/subscribe` (POST/DELETE token) + `api/push/mute` (GET/POST), `src/components/pwa/NotificationOptIn.tsx` (contextual card, value-moment gated, skips iOS-not-installed), `src/components/settings/NotificationSettings.tsx` (master toggle), `src/components/groups/GroupNotifyToggle.tsx` (per-group, member view), `src/components/ui/Toggle.tsx` (DS switch, 44px hit area). MODIFIED `public/sw.js` (+push/notificationclick, data-only → showNotification, click→focus/open /feed), `firebase/client.ts` (+messagingSenderId/appId, export firebaseApp), `firebase/admin.ts` (+firebaseMessaging), `api/status` (fire sendGroupGreenPush on group-scoped green, awaited in try/catch), `layout.tsx` (mount NotificationOptIn), `SettingsScreen` (Notifications section), `GroupMemberView`+group [id] page (toggle + groupId), `types/database.ts` (+push_subscriptions, +group_notification_mutes, +groups.last_notified_at). **Decisions:** mute on member view only (members=recipients, owners=senders since group_members excludes owners); data-only messages (SW builds notification, no dup); quiet hours CUT; push_sent server analytics deferred (no posthog-node). `tsc`+`next build` clean; SW push/notificationclick handlers verified live (active, no console errors). **Env Jackson adds: NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID + NEXT_PUBLIC_FIREBASE_APP_ID (VAPID already set). Migrations Jackson applies: push_subscriptions, group_notification_mutes, groups.last_notified_at.** **Build-time + SW verified only** — full flow (token mint, push delivery, opt-in/mute) needs env vars + deployed HTTPS + Jackson's device test (iOS push only for installed PWA). **PHASE 15 COMPLETE (Surface A install + Surface B push).**

**Surface B Mockup Status — ✅ APPROVED 2026-07-20 (`mooves-phase15-push.html`)**
Phone-frame, 3 surfaces (toggle): (1) **notification opt-in card** over the Feed — "Know when your group's free / get a heads up when someone in your group goes free, even when Mooves is closed. Only your groups, no noise." + "Turn on notifications"/"Not now" (the pre-permission card; tap → OS prompt); (2) **Settings → Notifications** (real Settings styling: white header, uppercase label, white card) — a single **Notifications master toggle** (**quiet hours CUT**) + an explainer that you're only notified for groups you're in; (3) **Group view** — a **"Notify me for this group"** toggle (on by default; off = "Muted, you won't be notified for this group"). Group control framed as notify-on (not a double-negative "mute"). **Build via mooves-build-loop.**

### Open questions
- ~~Quiet-hours window + rate-limit thresholds~~ — **RESOLVED 2026-07-20:** **quiet hours CUT entirely** (Jackson's call at mockup approval); 60-min per-group rate-limit floor kept.
- ~~Install-nudge exact trigger + copy; re-prompt cadence~~ — **RESOLVED 2026-07-20:** after first join/blast · 7-day cooldown, cap 3 · copy in Surface A detail + mockup.
- Whether to revisit an aggregate friend digest later if group-scoped-only under-delivers on dormant reach.

---

## Phase 16 — UX Feedback Round (polish on shipped screens)

16 UX items from live-app testing, triaged 2026-07-20 into 5 area-grouped units + 1 bug track. Polish, not new features. Loop per unit: mockup → approved → build → "ship it" → `feat/phase16-<area>` off freshly-synced main → merge via GitHub UI.

### Unit 1 — Hygiene batch — ✅ Mockup APPROVED + ✅ CODED 2026-07-20 (`mooves-phase16-hygiene.html`, branch `feat/phase16-hygiene`)
Five fixes, one PR (`feat/phase16-hygiene`), no per-item mockup beyond the shared hygiene mockup. `tsc --noEmit` clean; autofill logic + purple icon verified; #2/#8/#10 need Jackson's authed device test. **Flag:** `safe-area-pb` is undefined repo-wide — 6 bottom-sheets also ignore the inset; only the nav (#8) fixed this pass, sheets deferred to a follow-up.

- **#1 — iPhone autofill `+1` parsing (`auth`).** When iOS autofill/Contacts supplies a number that already includes the `+1` country code (or leading `1`), the national-number field must strip it so tap-to-fill lands a clean 10-digit value. Normalize on paste/autofill/change: drop a leading `+1`/`1` and non-digits before formatting. No visual change.
- **#2 — Groups first + default tab (`PeopleScreen.tsx`).** Flip sub-tab order to **Groups | Friends** and default `useState` to `'groups'`. Reverses the Phase 8 Friends-first decision (Jackson's call 2026-07-20). The "New" create-group pill is already Groups-bound, so it now shows on first load. No other People changes.
- **#8 — Bottom nav clearance (`BottomNav.tsx` / global).** Fixed bottom nav must stay above the iOS Safari toolbar via `env(safe-area-inset-bottom)` — always visible, never clipped, never floated so high it leaves dead space. Verify existing `safe-area-pb` util actually applies the inset; tune on-device.
- **#10 — No pre-auth push card (`NotificationOptIn.tsx`).** The opt-in card is mounted app-wide and can render on the logged-out `/g/[code]` invite landing. Gate it so it never appears pre-auth (no authenticated session) — only after login, still value-moment gated. Copy/design of the card unchanged. Runs through the bug-fix flow.
- **#16 — Purple app icon (`manifest.ts` + `public/brand/` icons).** Regenerate `apple-touch-icon` / `icon-180` (and 192/512 if added) on a brand-purple background (was off-white #F8F6FF cream tile); set manifest `background_color` to purple. Same cow geometry, purple tile behind it.

**Acceptance:**
- [ ] Autofilling a `+1…`-prefixed number leaves a clean 10-digit national value, no doubled country code.
- [ ] People opens on Groups by default; tab order is Groups | Friends; New pill visible on load.
- [ ] Bottom nav fully visible + tappable above iOS Safari chrome, no dead gap below.
- [ ] Push opt-in card never shows while logged out (incl. invite landing); still fires post-auth at a value moment.
- [ ] Home-screen icon shows the cow on a purple tile; splash `background_color` is purple.
- [ ] `tsc --noEmit` + `next build` clean.

### Unit 2 — Feed / core loop — ✅ Mockup APPROVED + ✅ CODED 2026-07-20 (`mooves-phase16-feed.html`, branch `feat/phase16-feed`)
`tsc --noEmit` clean; needs Jackson's authed device test. **Flag:** #12 Apple Pay requires registering `makemooves.app` as a Stripe payment domain (test + live) — dashboard action, not code.
Four items on Screen 4 (Feed) + the go-green/tip sheets, one PR (`feat/phase16-feed`):

- **#5 — "I'm in" opens the text in the same tap (`FriendCard.tsx`).** Today tapping "I'm in" only records the join; you must then tap the card body separately to open the 1:1 text. Change: tapping "I'm in" flips it to "You're in ✓" **and** immediately opens the native 1:1 SMS to that free friend (`sms:{phone}`), in one tap. Fires **on join only**, never on leave. The card-body tap-to-text stays; the group-blast 2+ gate is untouched (out of scope).
- **#6 — Confirm before leaving a Moove (`FriendCard.tsx` + confirm sheet).** Tapping "You're in ✓" currently drops the join silently. Add a quick confirmation ("Leave this Moove? You'll drop off {name}'s plan." · **Leave** / **Stay in**) before removing it; Cancel keeps you in. Mirrors the existing go-grey action-sheet pattern (`GoGreyConfirm.tsx`).
- **Card layout fix (mockup-approved, part of #5/#6 build):** move the FriendCard vibe note + time chip off the name row onto their **own full-width line below the name** (name + join button share the top row). Today the note shares the row with the button and gets clipped/unreadable when the button is present. New structure: top row = avatar · name · join button; sub-row (indented under the name) = time chip + vibe note, wraps if long.
- **#9 — Keyboard-aware Go Green sheet (`GoGreenSheet.tsx`).** The vibe input `autoFocus`es, so the iOS keyboard immediately covers the When / Who-can-see-you chips and the "I'm free" CTA. Fix: drop the auto-focus so the sheet renders fully first, and lay it out so the CTA stays reachable above the keyboard (pinned footer / scrollable body) when the vibe field is focused.
- **#12 — Tip jar separation + wallets (`TipJar.tsx`).** The jar is a full-width white card with a whole-card tap target, sitting flush under the last move — too easy to mistake for a move and mis-tap ("feels like a scam"). Fix: clearly separate it from the feed (divider + spacing, distinct non-move styling) and make the tap target an explicit button, not the whole card. Also **Apple Pay + Google Pay must render** in the pay step — today only Amazon Pay / Klarna / Link show. Uses Stripe Express Checkout Element; investigate config (Apple Pay domain registration for makemooves.app; Google Pay needs Chrome; wallet enablement in the Stripe payment-method set).

**Acceptance:**
- [ ] Tapping "I'm in" flips to "You're in ✓" and opens Messages to that friend in the same tap.
- [ ] Tapping "You're in ✓" asks to confirm before leaving; Cancel keeps the join.
- [ ] Go Green sheet: When / visibility / "I'm free" reachable with the keyboard open; no auto-keyboard cover on open.
- [ ] Tip jar visually separated from moves; only an explicit button opens it.
- [ ] Apple Pay + Google Pay appear in the tip pay step (device/browser-appropriate).
- [ ] `tsc --noEmit` + `next build` clean.

### Unit 3 — Discover — ✅ Mockup APPROVED + ✅ CODED 2026-07-20 (`mooves-phase16-discover.html`, branch `feat/phase16-discover`)
`tsc --noEmit` clean; needs Jackson's authed device test (Discover needs area + interests + a seeded/approved move).
Two items on the Discover sponsored-move card (`SponsoredCard.tsx`), one PR (`feat/phase16-discover`):

- **#4 — Card header collision.** The category pill (`interestLabel`, e.g. "Markets & pop-ups") and the "SPONSORED · {brand}" eyebrow share a single `justify-between` row and collide / overlap when both are long (especially on a 320px card). Fix: restructure the header so each has room — the subtle "SPONSORED · {brand}" eyebrow on its own line (full width, truncates if long), the category pill on its own line, then the title. No wrapping-collision or overlap.
- **#7 — Description before "I'm interested".** Today `move.description` only renders *after* tapping "I'm interested", so a user can't read what the move is before committing. Surface it up front: show `move.description` under the title/time, visible pre- and post-interested; remove the now-duplicate copy from the interested-only block. No new field (description already exists in `MoveForm` / `SponsoredCard`).

**Acceptance:**
- [ ] Category pill + sponsored label never overlap or wrap-collide, on a 320px card.
- [ ] Description blurb is visible before tapping "I'm interested".
- [ ] Interested state still shows ✓ Interested + Go with friends + Get details (minus the now-redundant description).
- [ ] `tsc --noEmit` + `next build` clean.

### Unit 4 — People / New Group — ✅ Mockup APPROVED + ✅ CODED 2026-07-20 (`mooves-phase16-people.html`, branch `feat/phase16-people`)
`tsc --noEmit` clean; needs Jackson's authed device test (People → Groups → New).
One item on the create-group form (`GroupForm.tsx`, create mode only), one PR (`feat/phase16-people`):

- **#3 — Prominent create CTA.** The create action is the quiet top-bar "Done" link, so it's unclear you must tap it to create the group and get its invite link. In **create mode** (`isCreate = !onShareInvite`), add a prominent **full-width primary "Create group" button** at the bottom of the form (disabled until a name is entered, keeping the existing "Add a group name to finish" reason), plus a short helper that you'll get an invite link to share. Drop the redundant top-right "Done" in create mode (leave the header's Back + title). **Edit mode is unchanged** (keeps the top-bar Done + Invite link + Delete buttons).

**Acceptance:**
- [ ] Create-group screen shows a prominent full-width primary Create button; creating no longer relies on the top-bar link.
- [ ] Button disabled until a name is entered, with the reason shown; enables once named.
- [ ] On create you still land on the group with the invite-link sheet (Phase 10 behavior) — copy sets that expectation.
- [ ] Edit mode unchanged (top Done + Invite link + Delete).
- [ ] `tsc --noEmit` + `next build` clean.

### Unit 5 (sponsor, DESKTOP) — SPLIT into 5a + 5b (A2P abandoned; #15 SMS→email)

#### Unit 5a — datetime picker + billing prompt — ✅ Mockup APPROVED + ✅ CODED 2026-07-20 (`mooves-phase16-sponsor.html`, branch `feat/phase16-sponsor`)
`tsc` clean. **Migration applied by Jackson:** `sponsored_moves.start_at TIMESTAMPTZ` + `location_text TEXT`. Denormalizes formatted display into `time_text` at write time so all read paths are unchanged. Needs Jackson's authed device test.
Desktop, one PR (`feat/phase16-sponsor`). No new vendor. Two items:

- **#13 — Date + time picker (`MoveForm.tsx`).** Replace the free-text "Time text" field with a real **date picker + time picker**, plus a short **Location / place** field (today's `time_text` combines datetime + place). Store a structured **`sponsored_moves.start_at TIMESTAMPTZ`** + **`location_text TEXT`**; keep legacy `time_text` as a render fallback for old rows. Discover `SponsoredCard` renders a formatted `start_at` (e.g. "Sun, Aug 3 · 10:00 AM") + location, falling back to `time_text` when `start_at` is null. Migration (Jackson applies): add `start_at`, `location_text`. Form validity requires a date.
- **#14 — Save-time billing disclosure (`SponsorDashboard` submit).** On "Submit for review", first check the card on file (`GET /api/sponsor/billing`): **no card →** a prompt modal ("Add a payment method — your card is charged {price} when a move is approved and goes live") with **Add card** (→ billing) and **Submit anyway** (still allowed; lands pending, shows the existing "awaiting" state after approval until a card is added). **Card on file →** a confirm modal ("Your {brand} ending {last4} is charged {price} when Mooves approves this and it goes live. You're not charged for anything under review or rejected.") with **Submit for review** / **Cancel**. Only gates the submit; the approve→auto-charge flow is unchanged.

**Acceptance (5a):**
- [ ] MoveForm has a date + time picker and a location field instead of free-text time; produces a structured `start_at`.
- [ ] Discover renders a formatted `start_at` (+ location), falling back to legacy `time_text`.
- [ ] Submitting with no card → add-card prompt; with a card → charge disclosure naming the card brand + last4 + price.
- [ ] Existing approve→auto-charge and awaiting/live/failed states unchanged.
- [ ] `tsc --noEmit` + `next build` clean.

#### Unit 5b — approval email (#15) — SPEC pending; gated on Jackson's Resend + DNS setup
Sponsor gets a transactional **email** when their Moove is approved & live (A2P SMS abandoned). Needs `sponsors.email` (+ collect in `SponsorAuth`), **Resend** + `RESEND_API_KEY`, verified `makemooves.app` sending domain (DNS); send on admin-approve (+paid) in the `api/admin/moves/[id]` approve path. Build after 5a and after Jackson provisions Resend.
