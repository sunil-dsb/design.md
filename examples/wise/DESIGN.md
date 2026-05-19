---
version: alpha
name: Wise
description: International money platform — bright-green, sharp-cornered, trust-focused fintech design extracted from wise.com.
colors:
  primary: "#9fe870"
  primary-dark: "#008026"
  ink: "#163300"
  ink-soft: "#0e0f0c"
  surface: "#ffffff"
  canvas-soft: "#edefeb"
  hairline: "#e8ebe6"
  pure-black: "#000000"
  muted: "#454745"
  mid-neutral: "#808080"
  dark-neutral: "#6a6c6a"
  accent-blue: "#0b4c72"
  accent-cyan: "#a0e1e1"
typography:
  display-xxl:
    fontFamily: Wise Sans
    fontSize: 105px
    fontWeight: 900
    lineHeight: 0.85
    letterSpacing: -0.02em
  display-xl:
    fontFamily: Wise Sans
    fontSize: 89px
    fontWeight: 900
    lineHeight: 0.85
  display-lg:
    fontFamily: Wise Sans
    fontSize: 59px
    fontWeight: 900
    lineHeight: 0.85
  h1:
    fontFamily: Inter
    fontSize: 45px
    fontWeight: 600
    lineHeight: 1.27
  h2:
    fontFamily: Inter
    fontSize: 25px
    fontWeight: 600
    lineHeight: 1.28
  h3:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: 600
    lineHeight: 1.4
  body-lg:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: 400
    lineHeight: 1.4
  body-md:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: 400
    lineHeight: 1.44
  label-md:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: 600
    lineHeight: 1.44
spacing:
  base: 4px
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 48px
  xxl: 80px
rounded:
  none: 0px
  sm: 2px
  md: 8px
  lg: 16px
  full: 9999px
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.ink}"
    rounded: "{rounded.full}"
    padding: 16px
    typography: "{typography.label-md}"
  button-primary-hover:
    backgroundColor: "{colors.primary-dark}"
    textColor: "{colors.surface}"
  button-inverted:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.primary}"
    rounded: "{rounded.full}"
    padding: 16px
    typography: "{typography.label-md}"
  button-outline:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.full}"
    padding: 16px
    typography: "{typography.label-md}"
  button-icon:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.ink}"
    rounded: "{rounded.full}"
    padding: 0
    size: 48px
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: 12px
    typography: "{typography.body-md}"
  card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: 24px
  link:
    textColor: "{colors.primary-dark}"
    typography: "{typography.body-md}"
---

# Design System: Wise

## Overview

Wise (formerly TransferWise) is the world's most-used international money-transfer platform, serving 16 million+ customers across more than 170 countries. The brand commits hard to a single bright, optimistic green (`#9fe870`) as its primary color — a saturated lime that reads as alive and confident, paired with deep forest-green text (`#163300`) on a white canvas. The result is fintech that does not look like a bank: trustworthy without being cold, modern without performing.

The visual system is **monochromatic by intent** — one brand color, one neutral ramp, one type pairing (Wise Sans for display + Inter for everything else), one workhorse corner radius. Restraint is the message: when the brand color says "trust" instead of "fun," every other element gets out of its way. Buttons are sharp-cornered (2px), shadows are barely there (only two captured levels), and headlines run at confident weights without shouting.

**Audience.** International workers, expats, digital nomads, and small-to-mid market businesses with cross-border payment needs. People who have personally felt the friction of moving money between currencies and want a tool that respects their intelligence.

**Personality.** Direct, plainly written, never institutional. Radically transparent about pricing — Wise will literally show competitor fees on landing pages. Optimistic but not naive; money is serious, and Wise makes it less stressful.

**Foundational rules:**

- Use the bright-green primary on every primary CTA, every focus state, every progress indicator. The green is the brand.
- Keep elevation flat — borders and color contrast carry the hierarchy; shadows are subtle, not decorative.
- Stick to a 2px workhorse radius for buttons, inputs, and most cards. Wise's silhouette is sharp, not rounded.
- Plain English for all microcopy. No banking-ese, no exclamation marks, no marketing intensifiers.

## Colors

Thirteen colors extracted from wise.com, grouped by intent: one saturated brand green, a clean neutral ramp, and two illustration-only accents. No secondary brand accent exists by design. The singular green is what makes Wise instantly recognizable.

**Brand**

- **Primary (`#9fe870`):** The signature bright green. Used liberally on primary CTAs, focus indicators, progress bars, and accent highlights. Frequency 98.
- **Primary Dark (`#008026`):** Deeper green for positive states, hover variants on buttons, and link text where the bright green would lack contrast. Frequency 28.

**Surface**

- **Surface (`#ffffff`):** Pure white canvas for cards and elevated panels. Frequency 27.
- **Canvas Soft (`#edefeb`):** Sage-tinted page background. White cards sit on this surface for elevation by contrast alone.
- **Hairline (`#e8ebe6`):** 1px borders and dividers. Frequency 85; the standard border for cards and inputs.
- **Pure Black (`#000000`):** Core contrast slot for highest-emphasis text and overlays. Frequency 86.

**Text**

- **Ink (`#163300`):** Forest-green default text and the foreground inside the primary CTA. Frequency 6,346; the most-used color on the site.
- **Ink Soft (`#0e0f0c`):** Near-black strong text and the dark-mode surface for promotional cards. Frequency 3,228 (916 text + 2,311 border uses).
- **Muted (`#454745`):** Secondary text and metadata. A deep neutral gray with a faint warm undertone. Frequency 5,563.
- **Mid Neutral (`#808080`):** Interactive secondary tone for icons and dimmed states. Frequency 16.
- **Dark Neutral (`#6a6c6a`):** Content tertiary text. Frequency 14.

**Accent**

- **Accent Blue (`#0b4c72`):** Reserved for celebratory states (success confirmations, milestone moments). Frequency 70; used sparingly, never as a competing brand color.
- **Accent Cyan (`#a0e1e1`):** Tertiary illustration tint. Appears only inside illustrative content; not used in chrome.

## Typography

Wise uses a **two-family pairing**: the custom **Wise Sans** for display-tier headlines (largest sizes, 900-weight, condensed feel), and **Inter** for everything else — h1 down to label and body text.

- **Display tiers (Wise Sans, weight 900).** Hero headlines at `105px`, `89px`, `59px`. Used only above the fold on marketing surfaces. Letter-spacing is slightly negative to tighten the silhouette.
- **Headings (Inter, weight 600).** `45px` h1, `25px` h2, `20px` h3. Geometric and clear; no display weight tricks at this scale.
- **Body (Inter, weight 400).** `20px` for large body / lead paragraphs, `18px` for default body copy. Line-height runs 1.4–1.44 for relaxed readability — financial content needs to breathe.
- **Labels (Inter, weight 600).** `18px`, same metrics as body-md but bolder. Used on button labels, field labels, and emphasised inline strings.

The captured family on the live site loads `Wise Sans Display` for the very largest sizes. When that font is unavailable, Inter is a graceful fallback — the entire system was designed so the fallback degradation is invisible.

## Layout

Wise uses a **fluid container model** with a 4px base spacing unit. All spacing values are multiples of the base, producing a strict 4 → 8 → 12 → 16 → 20 → 24 → 28 → 32 → 40 → 48 → 56 → 80 scale. Section spacing (gap between major content blocks) runs larger: 48, 56, 80, 94, 100, or 105px depending on density.

The page does not declare a hard max-width — content flows to fill the viewport with generous padding rather than locking to a centered column. Internal grids use a 12-column model at desktop widths, collapsing to single-column below 768px.

**Spacing intent:**

- `xs` (4px) — icon padding, inline gaps between tightly related elements.
- `sm` (8px) — gap between a label and its input.
- `md` (16px) — internal padding of buttons and inputs, gap between two related list rows.
- `lg` (24px) — internal padding of cards.
- `xl` (48px) — gap between content blocks within a section.
- `xxl` (80px) — gap between major page sections.

## Elevation & Depth

Wise's depth system is deliberately flat. Hierarchy comes from color, type weight, and whitespace — not from shadows.

Only **two box-shadow values** were captured across the site:

- A subtle **complex-stack elevation** (`rgba(0,0,0,0.15) 0px 10px 32px, rgba(0,0,0,0.04) 0px 40px 40px`) reserved for floating panels and modals.
- A **border-shadow** (`rgba(22,51,0,0.12) 0px 0px 0px 1px`) used as a 1px outline replacement on focused interactive elements — sharper than a CSS border, fully on-brand because it inherits the forest-green hue.

Cards do not lift. They sit on the canvas with a 1px hairline border (`#e8ebe6`). When emphasis is needed, the surface color shifts (white card on a neutral page background) rather than introducing a shadow. Modals and dropdowns are the only elements that earn the full elevation shadow.

## Shapes

Wise's silhouette is **sharp**. The workhorse corner radius is `2px` (frequency 198), applied to nearly every interactive element. Cards and large surface panels use a slightly larger `8–16px`; pill-shaped chips and avatars use `9999px` (frequency 81) and `50%` (frequency 241) respectively for their specific roles.

The shape language is one of the brand's quietest but most consistent signals — competitor fintech leans toward heavily-rounded shapes ("friendly," "consumer-app"); Wise commits to a near-square silhouette that reads as engineered and trustworthy. Mixing pill-shaped buttons with sharp inputs would break the brand language; the system is intentionally one-radius-fits-most.

## Components

### Buttons

Primary buttons fill bright green (`#9fe870`) with forest-green text (`#163300`) — high contrast, instantly readable, on-brand. Hover state darkens to `#008026` with white text. Secondary buttons invert: white surface, forest-green text, hairline border. Both share the same 2px corner radius and 16px internal padding. Variants for size (sm / md / lg) adjust padding and font-size, never the radius or color.

### Inputs

Single-line text inputs use white surface, forest-green text, hairline 1px border, and 2px corner radius. Padding is 12px vertical, 16px horizontal. Focused state replaces the hairline border with the brand-tinted border-shadow (`rgba(22,51,0,0.12) 0px 0px 0px 1px`) for a sharper, more on-brand focus ring than a default browser outline. Labels sit above the field at `18px / 600 weight / 4px gap` — never as floating placeholders.

### Cards

Cards are white-on-white-page surfaces lifted by a hairline border instead of a shadow. The default corner radius is `8px` (slightly larger than buttons for visual hierarchy). Internal padding is `24px`. Cards never receive an elevation shadow unless they are floating modals or popovers.

### Links

Inline text links use the deeper green (`#008026`) instead of the bright primary — the primary green lacks sufficient contrast against white at body text sizes. Underline is on by default with a subtle 3px offset; on hover the underline goes solid. External links carry a small `↗` glyph.

## Do's and Don'ts

**Do:**

- Use the brand green liberally on primary CTAs, focus states, and progress indicators. The green is the brand — do not be shy with it.
- Pair bright green with deep forest-green text (`#9fe870` on `#163300` and vice versa) rather than mixing with pure black or pure white.
- Stick to a 2px corner radius on buttons, inputs, and most cards. Wise's silhouette is sharp.
- Use Inter (or Wise Sans at the largest display sizes) for everything. No display fonts, no decorative serifs, no script.
- Quote real numbers wherever possible — "Save up to 6x" / "$2.45 fee on a $1,000 transfer" — instead of generic claims.
- Use generous whitespace. Financial content reads better with breathing room.
- Make every fee visible in the UI — transparency about cost is the central brand promise.

**Don't:**

- Don't introduce a second accent color. Wise is monochromatic by intent; adding orange / pink / etc. dilutes the green signature.
- Don't use pill-shaped buttons or large radii on interactive elements. The 2px-radius silhouette is part of brand recognition.
- Don't lean on heavy shadows or 3D effects. Wise's elevation is flat; cards lift with hairline borders, not drop shadows.
- Don't apologise for being financial. Avoid trying to look like a consumer toy (Lottie everywhere, emoji headlines, rainbow gradients).
- Don't bury fees or use disclaimer-style microcopy. If your UI hides a fee, you are working against the brand.
- Don't write in passive voice or banking-ese. Verbs forward, plain English, no "kindly."
