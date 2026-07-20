# Mooves — Session Handoff (Phases 8, 9, 10 shipped)

**Date:** 2026-07-17
**Purpose:** Bring a fresh Claude Code session fully up to speed. This session took Phases 8, 9, and 10 from spec → mockup → shipped (merged + deploying), plus two Phase-10 follow-up fixes, and **CUT Phase 11 entirely**. **Next up is Phase 12** (Geolocation & Discovery: Substrate). See [§7 Status of the phases](#7-phase-status--phase-11-cut--phase-12-next).

> **Phase-10 follow-up fixes (after the phase merged):** (1) **`fix/group-invite-on-create`** — MERGED. Group creation now needs only a name (friends optional; empty groups allowed), and on create you land on the group with the invite-link sheet auto-open (`?share=1`). (2) **`fix/member-sees-joined-groups`** — PR pushed, pending merge. `/api/groups` now returns groups you own OR are a member of; non-owners get a read-only `GroupMemberView` (roster + "Leave group"); new `POST /api/groups/[id]/leave`. Sync `main` before branching Phase 12 so you have both.

> Memory note: `MEMORY.md` + `memory/project-state.md` (auto-loaded each session) already carry the running state. This file is the richer narrative. `mooves-prd.md` is the behavior SSOT; `docs/design-system.md` is the design SSOT.

---

## 1. What Mooves is (one paragraph)

A mobile-web app that kills the friction of making plans: you passively "go green" to signal you're free, friends see it in a feed and reach out, and the actual plan happens over text/SMS. Mooves is the *signal*, not an event page. **Stack:** Next.js App Router + TypeScript + Tailwind, Supabase (Postgres + Realtime + Storage), Firebase Phone Auth, Vercel. Mobile-first (design at 375px). Deployed to **makemooves.app**.

**Design principles (don't violate):** kill the micro-rejection · stay lightweight (no event pages/calendars) · group-level only (no per-person tracking) · "good ads" only (Phase 13).

---

## 2. The workflow we've perfected (follow this exactly)

Three project skills, run in order, with two human gates:

1. **`mooves-spec-writer`** → drafts/append screen specs to `mooves-prd.md`. (Phases 8–15 are ALREADY spec'd, so usually skip.)
2. **`mooves-mockup-builder`** → builds a single self-contained interactive HTML mockup with toggle states covering every spec state. Iterate on Jackson's feedback. **Human gate: Jackson says "approved"** → lock it (mark Mockup ✅ in the PRD + record design decisions).
3. **`mooves-build-loop`** → implements in Next.js. Reads spec + mockup + existing code, **states a plan and waits for go-ahead** (Step 2 — this is where you raise DB dependencies + architecture decisions), implements, runs `tsc --noEmit` + `next build`. **Human gate: Jackson says "ship it"** → mark Code ✅, then commit + push.

**Cross-cutting phases** (8, 9, 10 were all cross-cutting, not single numbered screens): the mockup is named `mooves-phaseN-<name>.html` and approval/code status is recorded in that phase's spec section (a `### Mockup Status` / `### Code Status` block) + the roadmap entry line, since there's no numbered row in the Screen Index.

**Mockup conventions (locked):** dark `#1C1730` bg around a 320px phone frame (44px radius), toggle buttons per state, Plus Jakarta Sans 800 for headings + Inter for body (Google Fonts), purple gradient only for invite/auth screens, screen label at bottom. Copy: commas not em dashes, second person, warm, ≤1 exclamation per screen, no "seamless/effortless/streaks/FOMO".

**Build-loop rules that don't bend:** TS strict (no `any`/`@ts-ignore`), Tailwind only (no inline `style={{}}` — use imperative `ref.style` for dynamic values like drag transforms), handle every state, correct Supabase table/column names, no in-app messaging ever, no engagement patterns (unread counts/red dots/streaks), Supabase Realtime not polling.

---

## 3. Git & deploy process (important quirks)

- **Branch per phase** off `main`: `feat/phaseN-<name>`. Never commit to `main` directly.
- **Commit only when Jackson says so** ("ship it" / "push it"). End commit messages with `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.
- **PRs are opened + merged by Jackson via the GitHub UI.** The `gh` CLI is authed as `jrviccora`, who is **NOT a collaborator**, so it can't create PRs. `git push` works via the remote's embedded PAT. After you push, give Jackson the `.../pull/new/<branch>` URL.
- Merging to `main` auto-deploys to makemooves.app via Vercel.
- **`NEXT_PUBLIC_*` env vars are baked at build time.** (Historical footgun: `NEXT_PUBLIC_SUPABASE_URL` must be the BARE project URL, no `/rest/v1` suffix.)
- **Shipped history:** Phase 8 = PR #6, Phase 9 = PR #7, Phase 10 = PR #8. All merged to `main` and deploying.

---

## 4. This session's work

### Phase 8 — Polish (PR #6, merged + deployed)
Three cross-cutting items. Mockup: `mooves-phase8-polish.html`.
- **8.1 Header cow mark** — new `src/components/ui/CowMark.tsx` (transparent cow, app-icon geometry, no cream tile). `Wordmark.tsx` gained a `withCow` prop → cow + **enlarged** wordmark lockup (dark 16→22px, light 20→24px). Applied to **Feed, People, Settings, Auth** headers (Jackson chose all four; spec only named Feed+People).
- **8.2 Create-group control** — `PeopleScreen.tsx`: icon-only "+" → labeled **"New"** purple pill (DS primary, 44px tap target), hidden on the Friends sub-tab; empty-state "Create a group" CTA retained.
- **8.3 reCAPTCHA** — `globals.css` hides `.grecaptcha-badge` globally; `auth/page.tsx` adds Google's required attribution in the phone-entry footer only. reCAPTCHA still executes.
- Migrated legacy Tailwind tokens → DS scale in every touched file.
- **Open follow-ups:** cream cow reads faint on white headers (optional outline/shadow); Feed header top padding was tightened to match the centered mockup — may want `safe-area-inset` top pad for installed-PWA notches (Phase 15-adjacent).

### Phase 9 — Deepen the Core Loop (PR #7, merged + deploying)
Mockup: `mooves-phase9-coreloop.html`. Feed (Screen 4) + go-green flow.
- **9.1 Time chip** — coarse `now`/`tonight`/`weekend` on go-green (`TimeChips.tsx`), cleared on go-grey.
- **9.2 Presence & "I'm in"** — new `move_joins` table; "I'm in" (purple) / "You're in ✓" (green-700) toggle on friends' cards; joins visible to everyone, realtime; 2+ gate.
- **9.3 Group-chat blast** — at 2+ joins the mover's card shows **"Start a group chat"** → native SMS composer pre-addressed to the joiners with an **empty body** (`lib/blast.ts`; iOS `sms:/open?addresses=` vs Android `sms:n1,n2`).
- **9.4 Post-blast prompt** — "Plan's set?" → keep green / go grey (non-blocking).
- **Amendments locked (A1–A4 in the PRD Phase 9 spec):** A1 **swipe-to-go-green** folded in (home-feed top control is a swipe that opens the go-green sheet; sheet CTA stays a tap button; has an a11y tap/keyboard fallback). A2 **visibility control retained** on go-green (reverses DS "green is global"). A3 copy/colors. A4 **no prefilled blast text**.
- Key files: `SwipeToGoGreen`, `MyMoveCard`, `Joiners`, `TimeChips`; `api/moves/join` (POST/DELETE), `lib/blast.ts`; modified `api/status`, `api/feed`, `api/users/me`, `GoGreenSheet`, `FriendCard`, `FeedScreen`. `AvailRow.tsx` retired. Presence realtime = `move_joins`+`users` subscription → debounced `/api/feed` refetch.
- **Still needs Jackson's on-device test:** two-account join/blast realtime + whether iOS keeps the group text in ONE thread (the `sms:` POC).

### Phase 10 — Cold Start & Growth (PR #8, merged + deploying)
Mockup: `mooves-phase10-coldstart.html`. Feed grey-state + group invite links.
- **10.1 Grey-feed ambient signals** — when a viewer has friends but none are green, show **one aggregate, never-named signal at a time**: "N friends around now" (foregrounded in last 15 min) OR "N friends were green this week", each suppressed below 3, else a warm no-number fallback ("People want to hang out."). The **pulse is grey** (activity, not availability). New `AmbientTier.tsx` replaces the old "Nobody's free yet" state.
- **10.2 Group invite links — built as OPTION A (owner-scoped)** — each group gets one persistent `invite_code` the **owner** manages (share/reset). Joining via `/g/[code]` adds you to the group AND **auto-friends the owner + all current members**. Landing states: consent / already-member / dead-link; the join completes on the feed after auth (`resolveGroupInvite`, mirrors the friend-invite flow).
- Key files: `api/presence` (heartbeat → `last_active_at`), `api/groups/[id]/invite` (get/reset), `api/group-invite/[code]` (public resolve), `api/group-invite/[code]/join` (join + auto-friend-all), `app/g/[code]/page.tsx`, `GroupJoinLanding`, `InviteLinkSheet`, `AmbientTier`; modified `api/status` (`last_green_at`), `api/feed` (ambient counts), `FeedScreen`, `GroupForm`+EditGroupPage (Invite link affordance), **`middleware.ts` (added `/g/` to `PUBLIC_PREFIXES`)**, `globals.css` (`ambient-pulse` keyframe).
- **Mockup deviation:** consent landing shows member *count*, not an avatar cluster (privacy — member identities kept off the public page).
- **Still needs Jackson's multi-account test:** ambient signals lighting up, invite share/reset, and the 2-account join → auto-friend flow.

---

## 5. DB migrations already applied (by Jackson, in Supabase dashboard)

Schema changes are applied by Jackson manually (not via code migrations). These are LIVE:

```sql
-- Phase 9
ALTER TABLE users ADD COLUMN status_time TEXT CHECK (status_time IN ('now','tonight','weekend'));
CREATE TABLE move_joins (
  mover_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  joiner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (mover_id, joiner_id)
);
CREATE INDEX move_joins_mover_id_idx ON move_joins(mover_id);
CREATE INDEX move_joins_joiner_id_idx ON move_joins(joiner_id);
ALTER PUBLICATION supabase_realtime ADD TABLE move_joins;
ALTER TABLE move_joins ENABLE ROW LEVEL SECURITY;
CREATE POLICY move_joins_select ON move_joins FOR SELECT USING (true);

-- Phase 10
ALTER TABLE users  ADD COLUMN last_green_at  TIMESTAMPTZ;   -- set on go-green only
ALTER TABLE users  ADD COLUMN last_active_at TIMESTAMPTZ;   -- set on app foreground
ALTER TABLE groups ADD COLUMN invite_code    VARCHAR(8) UNIQUE;
```

`src/types/database.ts` mirrors these. **Important:** that file was originally **UTF-16**; this session converted it to **UTF-8** so it's editable with normal tools. Keep it UTF-8. When adding tables/columns there, follow the existing generated-types shape (Row/Insert/Update + Relationships).

---

## 6. Key technical context (architecture you'll rely on)

- **Auth:** Firebase Phone OTP on the client → `POST /api/auth/verify` → `mooves-token` httpOnly cookie (30d). The cookie **IS a Supabase-compatible JWT** signed with `SUPABASE_JWT_SECRET`. Supabase Auth is NOT used.
- **API auth:** `middleware.ts` validates `mooves-token`, injects `x-user-id` header; every protected route reads `req.headers.get('x-user-id')`. Public routes are listed in `PUBLIC_PREFIXES` (currently `/join/`, `/g/`, `/auth`, `/api/invite/`, `/api/auth/verify`, `/api/sms/inbound`, `/_next/`, `/favicon`). **New public pages/APIs must be added there** or they redirect to /auth (this bit us with `/g/` in Phase 10).
- **Server Supabase:** always `createServiceClient()` in API routes (bypasses RLS). Client `createClient(token)` is Realtime-only.
- **Realtime pattern:** subscribe to table changes → **debounced `/api/feed` refetch** (server resolves authoritative data). Used for `users` + `move_joins`.
- **Design system:** DS scale is canonical in `tailwind.config.ts` — `green {100,500,700}`, `purple {50,100,500,700}`, `ink {900,500}`, `grey {100,300}`, `red {tint,500}` + `display-*`/`body-*` type. **A11y rule that matters: `green-500` is DECORATIVE ONLY (white text on it fails AA); use `green-700` (#167A43) for any green fill carrying text/icons or any green CTA.** Status = dot + label + color, never color alone. Tap targets ≥44px. Legacy token aliases (`mooves-purple`, `status-green`, etc.) still exist; migrate opportunistically as you touch a component. Border-radius/shadow DS scale is NOT in config (collides) — use arbitrary values like `rounded-[20px]`.
- **Analytics:** PostHog, `posthog.capture('snake_case_event')` client-side.
- **Deferred / known:** Phase 7 SMS inbound is A2P-registration-blocked (deferred). Real-SMS delivery is fine for clean numbers (Jackson's own number was rate-limited from heavy testing — use Firebase test numbers to unblock app testing).

---

## 7. Phase status — Phase 11 CUT · Phase 12 next

**Phase 11 (Groups as Channels) was CUT 2026-07-17** and its mockup deleted. Why: once you apply the intuitive rule "**picking a group when you go green means only that group sees the green**," Phase 11 collapses into the **`visible_to` group-scoping already shipped in Phase 9 (amendment A2)**. The only distinct Phase 11 idea was "global green + an additive group *label*," which is confusing UX and clutters the go-green sheet + feed — dropped. So there is **no group tag, no feed labels, no per-group mute, no member channel surface, no new data model**. The PRD's Phase 11 sections are marked ❌ CUT (that's the uncommitted `mooves-prd.md` diff in the tree — it's correct, keep it). Group-scoping a green ships today via the go-green visibility control. Phase 15 (push) will trigger off `visible_to` group-scoped greens, not a tag.

**Consequence:** the "reconcile the groups model" blocker this doc used to flag is **resolved by omission** — the current model (owner-scoped groups; members can *see + leave* a group they joined; greens scoped via `visible_to`) is the accepted final state. No refactor pending.

**NEXT: Phase 12 — Geolocation & Discovery: Substrate.** Spec is in `mooves-prd.md` (`## Phase 12 — Geolocation & Discovery: Substrate (Spec)`). Heads-up: it's mostly **invisible plumbing** — a Settings "Your area" control (coarse zip; precise coords never stored) + coarse-zip/nearby-zip radius matching. It's the **substrate for Phase 13** and has little standalone user-visible payoff (12 & 13 are tightly coupled). The roadmap also flags **Phase 15 (push/PWA)** as high strategic value; Jackson chose 12. Worth confirming scope with Jackson at the start (substrate-only vs pair with some of 13).

**Other parked follow-ups:** Phase 8 cow contrast on white headers + Feed `safe-area-inset`; Phase 9 iOS single-thread `sms:` POC; Phase 10 consent-landing avatar cluster (currently count-only) + multi-account testing.

---

## 8. Pending human tests (Jackson, on device / multi-account)
- Phase 9: two-account join → 2+ → group chat; iOS single-thread behavior.
- Phase 10: ambient signals lighting up; invite share → 2nd account join → auto-friend; link reset kills old link.

---

## 9. Where things live
- **Behavior SSOT:** `mooves-prd.md` (Phase specs near the end; Screen Index at top; Section 13 = data model).
- **Design SSOT:** `docs/design-system.md` + `docs/design/`.
- **Approved mockups:** `mooves-screen*.html` (Screens 1–10) + `mooves-phase8-polish.html`, `mooves-phase9-coreloop.html`, `mooves-phase10-coldstart.html`.
- **Memory:** `memory/MEMORY.md` (index) + `memory/project-state.md`, `tech-decisions.md`, `design-system.md`, etc.
