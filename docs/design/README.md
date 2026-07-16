# Handoff: Mooves Design System v1

## Overview
This bundle is the output of a design-critique → design-system pass for Mooves (mobile-web app, phone-first). It covers the four signature UX problems the critique surfaced (the go-green moment, status legibility, the empty/grey feed, the brand mark), plus portable tokens and component specs for Phase 8–15 new screens.

## About the design files
Everything here is a **design reference**, not production code. The full interactive version lives at the project root as `Mooves Design System.dc.html` — an HTML prototype for visual review, not something to copy into the app verbatim. The task for this handoff is: **recreate these patterns in the actual Next.js/TypeScript/Tailwind codebase**, following its existing conventions (see the current `FeedScreen.tsx`, `AvailRow.tsx`, `GoGreenSheet.tsx`, etc. for where each pattern currently lives).

## Fidelity
**High-fidelity.** Colors, type sizes, spacing, and radii are final values (not placeholders) — implement pixel-accurately using the tokens in `tokens/`. Motion timing and haptic notes are estimates flagged as provisional (see `direction-and-rationale.md`).

## Contents

- **`tokens/`** — drop-in design tokens
  - `tailwind.theme.js` — paste into `tailwind.config.ts`'s `theme.extend`
  - `tokens.css` — the same values as CSS custom properties, if needed outside Tailwind
  - `tokens.json` — framework-agnostic raw values
- **`component-anatomy.md`** — per-component specs: status toggle (all states), status badge, friend feed card, buttons, tabs, empty states. Dimensions, padding, colors, states.
- **`accessibility-report.md`** — actual computed WCAG contrast ratios, tap-target sizes, and the color-blindness check. Documents a real, pre-existing AA failure (white text on `green-500`, 2.1:1) and its fix (`green-700`, 5.39:1).
- **`assets/`**
  - `cow-icon.svg` — corrected app-icon mark (matches the real `CowIllustration.tsx` geometry)
  - `icon-180.png`, `icon-120.png`, `icon-60.png`, `icon-29.png` — rasterized app icons on an opaque background (iOS `apple-touch-icon` requirement) at the sizes iOS needs
  - `wordmark-dark.svg` / `wordmark-light.svg` — the M[green][grey]VES wordmark, dark (white-bg screens) and light (purple-header screens) variants
- **`screens/`** — PNG renders of the key proof screens: the status-toggle spec sheet, feed-at-iPhone-width next to the empty ambient state, the empty-states set, the icon at all four sizes, and the accessibility contrast table
- **`direction-and-rationale.md`** — the "why": how each pattern solves its target problem, which guardrails it protects, and what's still provisional pending real-user testing

## Guardrails (constrain every decision in this system — do not violate when extending)
1. Going green is low-stakes — never a public bid a friend can visibly reject.
2. Stay lightweight — no calendar, RSVP list, or time-picker, anywhere.
3. Visibility is group-level only — never per-person "tell me when they're free."
4. (Added this pass) Sponsored content must feel like a neighbor's post, not a banner ad.

## Known open flags (see `direction-and-rationale.md` for detail)
- Swipe-track one-handed reachability on a 375px screen — untested on-device.
- Ambient empty-state tone at very low friend-count — untested with real users.
- Motion/haptic timing is an estimate, not user-tested.
- No dark-mode tokens exist yet.

## Where this replaces existing code
`AvailRow.tsx` and `GoGreenSheet.tsx`'s toggle logic should be rebuilt around the swipe pattern in `component-anatomy.md`. `FriendCard.tsx` should adopt the status-badge pattern (dot+label+color) instead of relying on the translucent green tint alone. The People screen's "+" button and the OTP digit boxes need the tap-target fixes noted in `accessibility-report.md` regardless of visual changes. The app currently has no `manifest.json`/icon declaration — wire up `assets/icon-*.png` there.
