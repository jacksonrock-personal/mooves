# Accessibility proof

Computed via WCAG 2 relative-luminance contrast formula (not estimated). Targets: **4.5:1** normal text / **3:1** large text (≥18.66px bold) & non-text UI components.

| Pairing | Ratio | Target | Result |
|---|---|---|---|
| green-500 fill, white text (**old** CTA combo, e.g. today's "I'm free" button) | 2.10:1 | 4.5:1 | **Fail** — real, pre-existing defect, independent of any redesign |
| green-700 fill, white text (**corrected** CTA) | 5.39:1 | 4.5:1 | Pass |
| green-700 text/icon on white | 5.39:1 | 4.5:1 | Pass |
| green-700 badge text on green-100 tint | 4.88:1 | 4.5:1 | Pass |
| ink-900 primary text on white | 17.3:1 | 4.5:1 | Pass (AAA) |
| ink-500 secondary text on white | 5.61:1 | 4.5:1 | Pass |
| purple-500 fill, white label (existing CTA) | 4.76:1 | 4.5:1 | Pass — tight, don't darken bg further |
| grey-300 dot alone vs white (no label) | 1.96:1 | 3:1 | **Fails alone** — this is exactly why the status badge always pairs a text label with the dot |

**The fix, mechanically**: swap every text-bearing green fill from `green-500` to `green-700`. The hue still reads as "green" — it's the correct depth for surfaces carrying white text. `green-500` remains valid for purely decorative use (dots, glow, large tint backgrounds with no text sitting directly on the raw fill).

## Tap targets
- Status toggle track: 56px height (min)
- Icon buttons: 44×44px minimum (fixes People "+" button, previously 34×34)
- OTP digit boxes: widened to 44px minimum
- Primary/secondary buttons: 48–56px tall

## Color-blindness / grayscale check
Feed card (avatar + name + "Free" badge) was rendered in full color, grayscale, and a simulated deuteranopia (red-green colorblind) filter. In all three, the word "Free" remains legible — the dot is reinforcement, the text label is the actual source of truth, matching the "never color alone" rule.

**Caveat**: the deuteranopia simulation used here is a CSS filter approximation (`sepia + hue-rotate + saturate`), not a certified optical-color-vision-deficiency model. Recommend a real pass with Stark or Sim Daltonism before formally signing off on "passes colorblind users."
