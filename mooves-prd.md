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
| 1 | Invite Link Landing Page | ✅ Approved |
| 2 | Auth -- Phone + OTP | ✅ Approved · ✅ Coded |
| 3 | Onboarding | ✅ Approved · ✅ Coded |
| 4 | Home Feed | ✅ Approved — see Amendment A for status control UI |
| 5 | Go Green Sheet | ✅ Approved — see Amendment B for group selector UI |
| 6 | Friend Tap → SMS Handoff (non-screen) | ✅ Approved |
| 7 | ~~Friend Connection Confirmation~~ | ❌ Removed — web flow already covered by Screen 1 + feed toast |
| 8 | Friends List | ✅ Approved |
| 9 | Groups Management | ✅ Approved |
| 10 | Settings / Profile Edit | ✅ Approved |
| 11 | SMS Feed Check (non-screen, Twilio flow) | ✅ Approved |
| 12 | Invite Link Deep-Link Flow (non-screen, technical) | ✅ Approved |
| — | Spec Amendments (A/B/C) | ✅ Approved — overrides noted above |
| 13 | Canonical Data Model | ✅ Approved |
| 14 | Auth Integration (Firebase → Supabase) | ✅ Approved |
| 15 | API Routes | ✅ Approved |
| 16 | Next.js File Structure | ✅ Approved |
| 17 | Supabase Setup (RLS, Storage, Realtime) | ✅ Approved |
| 18 | Middleware | ✅ Approved |
| 19 | Environment Variables | ✅ Approved |

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

A `+` icon button appears in the top-right corner of the header **only when the Groups sub-tab is active**. Tapping it navigates to the Create Group screen.

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
