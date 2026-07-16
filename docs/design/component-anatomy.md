# Component anatomy specs

All values reference `tokens/tokens.css` / `tailwind.theme.js`. Colors given as token names — resolve hex from tokens files.

## Status toggle (primary interaction — swipe to go green)

**Shape**: pill track, `border-radius: pill (9999px in practice; spec drew 20-28px per screen density)`, full width of its container, `height: 56px` fixed (never resizes across states).

**Off / default**
- `background: purple-50`, `border: 1.5px solid #E8E4F5`
- Center label: "Swipe to go green →", `body-md` weight 700, color `ink-500`, centered absolutely (fades as thumb drags)
- Thumb: 48×48px circle, `background: purple-500`, `4px` inset from track edges, `box-shadow: 0 2px 8px rgba(0,0,0,0.15)`

**Mid-swipe (dragging)**
- Thumb translates horizontally with the drag (`transform: translateX(px)`, no transition while dragging)
- Thumb color interpolates to `green-700` once past 70% of track width (the commit threshold)
- Label opacity fades to 0 as thumb approaches ~60% progress

**Commit / on (free)**
- Track becomes solid `background: green-700`, `box-shadow: glow-green`, animates in with `transform 0.25s cubic-bezier(.2,.8,.2,1)`
- Content: dot (10px, white) + "You're free" (`display` 800 15px, white) left-aligned; "Tap to end" (body-sm 700, white/85%) right-aligned
- Glow pulses on a slow **2.4s loop** (ambient, never alert-cadence) — see `@keyframes glowPulse`

**Going grey (tap target, separate from swipe)**
- Tapping "Tap to end" opens a bottom confirm sheet (native iOS action-sheet pattern): message row + red "Go grey" action + "Cancel"
- `border-radius: lg (20px)` sheet, `1px solid #E8E4F5`, no backdrop blur required at spec level (implementation detail)

**Motion/haptics**: no haptic on go-green commit (keep it soft); a single light-impact haptic recommended on go-grey confirm only.

---

## Status badge

- Shape: pill, `padding: 5px 10px` (or `6px 12px` for standalone chip use)
- Dot: 7–8px circle + label, always both present (never color alone)
- **Free**: `background: green-100`, dot `green-500`, label `green-700` weight 700 `body-sm`
- **Not now**: `background: grey-100`, dot `grey-300`, label `ink-500` weight 700 `body-sm`
- Aggregate variant ("4 free now") uses the same Free styling, label swapped for a count string

---

## Friend feed card

- `border-radius: 18px`, `padding: 14px 16px`, `display:flex; align-items:center; gap:12px`
- **Free (individual)**: `background: green-100`, `border: 1.5px solid #BEEBD1`
- **Aggregate presence** ("4 friends free now"): `background: white`, `border: 1px solid #E8E4F5`, small icon-circle avatar slot instead of a photo
- Avatar: 46px circle, initials on `purple-500` fill, white `display` 800 16px
- Name: `display` 700 15px `ink-900`; status note (optional): `body-sm` `ink-500`
- Status badge sits right-aligned, `background: white` chip regardless of card bg (badge always has its own bg per the never-color-alone rule)
- Optional group-tag chip: `background: purple-100`, text `purple-700`, `body-sm`/700, sits directly under the name

---

## Buttons

| Variant | Fill | Text | Radius | Padding | Notes |
|---|---|---|---|---|---|
| Primary | `purple-500` | white, `display` 800 15px | `lg` (20px→ actual spec used 16px card corner, 20 for larger surfaces — use 16px for buttons) | `14px 24px` | 4.76:1 contrast — do not darken bg further |
| Secondary | white, `2px solid purple-500` | `purple-500`, `display` 800 15px | 16px | `12px 24px` | |
| Destructive | `red-tint` | `red-500`, `sans` 700 14px | 16px | `14px 24px` | |
| Icon button | `purple-500` circle | white icon | 50% (circle) | — | **min 44×44px** — fixes the People "+" bug (was 34×34) |
| Green CTA (e.g. empty-state "go free") | `green-700` (never `green-500`) | white, `display` 700 | 14–16px | `12–14px` | white-on-green-500 is only 2.1:1 — always use 700 |

---

## Segmented tabs

- `display:flex`, each tab `flex:1`, `text-align:center`
- Active: `border-bottom: 3px solid purple-500`, label `sans` 700 14px `purple-500`
- Inactive: `border-bottom: 3px solid transparent`, label `sans` 600 14px `ink-500`
- Order matters: put the tab with the highest early-lifecycle value first (e.g. Friends before Groups)

---

## Empty states

**Cold start** (zero friends)
- White bg, `border-radius: 24px`, `padding: 28px 20px`, `text-align:center`
- CowIllustration asset (see `assets/cow-icon.svg`, use the transparent/no-square version for in-card placement), 56–80px
- Headline `display` 800 16–20px, then Primary button

**Ambient / quiet** (friends exist, none free)
- Background: `linear-gradient(180deg, purple-50 0%, grey-100 100%)`
- Centered pulsing ring + dot: `grey-300` 2px ring animating `scale(0.9→1.6)` + fading opacity, 2.4s ease-out loop, `2px` solid dot at center
- Headline `display` 800 16–19px ("Quiet right now.")
- Aggregate copy line, `body-sm`/`body-md` `ink-500`: a count + a rough daypart pattern only — never a specific scheduled time
- CTA: `green-700` fill, white label ("Be the first — go free")

**Loading skeleton**
- Avatar circle + two text bars per row, all `background: grey-100`, no shimmer required at spec level (implementation detail)
