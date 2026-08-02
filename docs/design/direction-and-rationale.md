# Direction & rationale

Full interactive version: `Mooves Design System.dc.html` (source of truth — this markdown + the PNGs in `screens/` are a snapshot of it for portability).

## The four signature problems this system solves

1. **The go-green moment.** Replaced AvailRow's two inconsistent entry points (a small off-state chip vs. a full on-state CTA) with **one control**. Going grey stays a lighter tap + confirm-sheet, deliberately, since ending your status should be easier to reverse than it was to start (never harder to undo than to commit to).
   - **Revised 2026-08-02 (R22): that control is your own tile in the rail, not a swipe.** The swipe is deleted. It had been justified as *"a deliberate physical gesture makes accidental green-status essentially impossible"* — which was never quite true of the shipped build: **the slide only ever opened the Go Green sheet, and the sheet's "I'm free" button was always the commit.** The protection was the sheet, not the drag, so replacing the drag with a tap costs nothing. What it buys: one surface at the top of the feed instead of two competing for it, and the same gesture teaching both objects (tap your own face to go free, tap the cow to plan a Moove).
   - Still strictly guardrail-#1-safe: no notification fires, no "seen" state, nothing publicly visible to reject.
   - *Closed flag*: the old "is a 280px track one-handed-reachable on a 375px screen" question dies with the track. The tile sits at the top-left of the rail, which is the hardest corner to reach one-handed — worth watching on device, though it is a 58px target rather than a drag.

2. **Status legibility.** Every "free" signal is dot + label + color together, never color alone. Verified: the grey dot alone is only 1.96:1 contrast against white (fails), which is precisely why the text label is mandatory, not decorative. Feed cards use a solid `green-100` tint (not the old translucent overlay, which risked borderline contrast) plus an explicit white "Free" chip with `green-700` text.

3. **The empty/grey feed.** Replaced dead silence with an **ambient tier**: a slow pulsing ring/dot plus aggregate social-proof copy ("5 friends went green this week · usually livens up around 6pm") and a green CTA to be first. This is a pattern statement, not a scheduled time — stays inside the "no calendar" guardrail.
   - *Open flag*: whether this framing reads as inviting vs. slightly sad to a user with very few friends needs a moderated test at low friend-count.

4. **The brand mark.** Corrected the app icon to the actual `CowIllustration.tsx` geometry (an earlier pass had invented a different face) — verified legible from 180px down to 29px. The wordmark's green/grey status-dot metaphor is taught explicitly once (an expanded "legend" shown on first onboarding + first empty feed), then the compact wordmark can serve as a callback without needing to re-teach itself every time.

## Guardrails honored throughout

- **#1 Kill the micro-rejection**: the toggle posts nothing to anyone, shows no seen/pending state.
- **#2 Stay lightweight**: no screen opens a detail/event page; every card either shows status or hands off to native SMS.
- **#3 No per-person tracking**: presence counts and group tags are aggregate by construction (no per-person timestamp slot exists in these components).
- **#4 Sponsored content stays a neighbor, not an ad**: sponsored-move cards are forced into the identical feed-card shell — same radius, padding, avatar-slot pattern, and a plain "Sponsored" label styled like the group tag, not a louder banner treatment.

## What's provisional / needs real-user validation
- Ambient empty-state tone at low friend-count (see flag above)
- Swipe track one-handed reachability (see flag above)
- Motion/haptic timing (150–200ms commit, 2.4s glow loop) is a designer's-ear estimate, not user-tested
- No dark-mode tokens exist yet — out of scope until asked for
