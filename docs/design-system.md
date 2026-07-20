# Mooves Design System v1

In-repo pointer + integration status for the design system delivered by Claude Design (2026-07-16). This is the **design SSOT** for mockups/build; `mooves-prd.md` remains the **behavior SSOT**.

## Source of truth
Full handoff (reference, not production code), vendored in-repo at `docs/design/`:
- `component-anatomy.md` — per-component specs (status toggle, status badge, feed card, buttons, tabs, empty states)
- `accessibility-report.md` — computed WCAG contrast ratios + tap targets
- `direction-and-rationale.md` — the "why", guardrail adherence, what's provisional
- `tokens/` — `tailwind.theme.js`, `tokens.css`, `tokens.json`
- `assets/`, `screens/` — brand assets + proof renders

Brand assets are committed in-repo at `public/brand/` (icons + wordmarks); app icons are wired via `src/app/icon.svg` + `src/app/apple-icon.png`; PWA manifest at `src/app/manifest.ts`.

## Token integration status — opportunistic bridge
The DS scale is now the **canonical** vocabulary in `tailwind.config.ts` (`green`, `purple`, `ink`, `grey`, `red` + `display-*`/`body-*`/`label-xs` type scale + `shadow-glow-green`). Hex values are identical to the old locked palette.

- **Legacy aliases** (`mooves-purple`, `status-green`, `surface-bg`, `card-white`, `purple-tint`, `text-primary`, `text-secondary`, `status-grey`) are **kept temporarily** so shipped screens don't break. **Retire each per-screen as it's rebuilt** in the redesign. Mapping: `mooves-purple`→`purple-500`, `status-green`→`green-500`, `surface-bg`→`purple-50`, `card-white`→white, `purple-tint`→`purple-100`, `text-primary`→`ink-900`, `text-secondary`→`ink-500`, `status-grey`→`grey-300`.
- **Not yet in config (collide with Tailwind defaults that shipped screens use):** the DS **borderRadius** scale (`sm 12 / md 16 / lg 20 / xl 28 / pill 9999`) and **boxShadow** `sm`/`md`. Use arbitrary values (e.g. `rounded-[20px]`) in new components until we reconcile these during the redesign build.

## Accessibility (must-follow)
- **`green-500` is decorative only** — white text on it is 2.1:1 (fails AA). Use **`green-700` (#167A43, 5.39:1)** for any green fill carrying text/icons or any green CTA.
- Status is **dot + label + color, never color alone** (grey dot alone is 1.96:1).
- Tap targets ≥ 44×44 (fixes People "+" and OTP boxes — see hygiene PR).
- Colorblind check so far is a CSS-filter approximation; do a certified pass (Stark / Sim Daltonism) before claiming "passes colorblind."

## Key adopted decisions
- **Go-green = swipe-to-go-green** (replaces the tap+sheet flow). *Note: this pass proposed dropping the visibility chips ("green stays global"); that was **reversed by Phase 9 A2** — the `visible_to` group-scoping chips are retained.* Go-grey stays a tap + confirm-sheet.
- **Empty feed = ambient tier** (pulsing ring + aggregate social-proof copy + green-700 CTA) — implements Phase 10.
- **Brand mark** = cow app icon matching `CowIllustration.tsx` geometry, legible 180→29px.

## Still to DRAW as extensions (same tokens) when specing/mocking each phase
- Phase 9: coarse **time chip** on go-green · **"I'm in" join** + 2+ gate · **"Start group text" blast button**
- ~~Phase 11: group-tag affordance~~ — **CUT 2026-07-17** (Phase 11 scrapped; group-scoping already ships via the go-green `visible_to` chips)
- Phase 13: **sponsored-move card** (described in rationale, not drawn)
- Phase 15: **install nudge** + 192/512 maskable icons

## Deferred
Dark-mode tokens (none yet).
