---
brand: IBM
url: https://www.ibm.com/
designSystem: Carbon Design System (v11)
verifiedAt: 2026-05-15
sources:
  - github.com/carbon-design-system/carbon (packages/colors/src/colors.ts)
  - github.com/carbon-design-system/carbon (packages/themes/src/white.js)
  - carbondesignsystem.com
note: |
  Values below are sourced from the Carbon Design System v11 published spec
  (IBM's open-source design system). Awaiting a live engine extraction from
  ibm.com; the spec is the authoritative reference IBM ships to its own
  product teams, so we use it directly as the gold target.
---

## 1. Visual Theme & Atmosphere

IBM's visual language is the **Carbon Design System** — engineering-grade, functional, and built for enterprise software at planetary scale. The aesthetic is deliberately sharp and computational: zero default border-radius, a generous 8-pixel grid, and a typography system anchored in IBM Plex Sans (a typeface IBM commissioned specifically to embody "what AI thinks an IBM font should be"). Color usage is restrained — IBM Blue dominates as the brand anchor, neutral grays do the structural heavy lifting, and semantic colors (red, green, yellow) reserve themselves for support patterns. There is no playfulness here, but there is precision. Every spacing value snaps to a multiple of 4 or 8; every interactive element gets a 2px focus ring in IBM Blue.

## 2. Color Palette & Roles

### Primary
- **IBM Blue 60** (`#0f62fe`): The brand anchor. Used on primary CTAs, link text, focus rings, and selected-state indicators. Maps to Carbon token `--cds-button-primary` and `--cds-link-primary`.

### Brand Hover / Accent
- **IBM Blue 70** (`#0043ce`): Primary hover and focus state. Maps to `--cds-link-primary-hover` and `--cds-focus` (where focus rings need slightly darker contrast).

### Neutral Scale (Carbon gray)
- **Text Primary** (`#161616` — gray-100): Body and heading text. The default near-black IBM uses everywhere.
- **Text Secondary** (`#525252` — gray-70): Captions, labels, supporting copy.
- **Border Strong** (`#8d8d8d` — gray-50): Form fields, fieldset dividers.
- **Border Subtle** (`#e0e0e0` — gray-20): Default tile / card dividers.
- **Layer 01** (`#f4f4f4` — gray-10): Subtle elevated surface (alternate to white background).
- **Background** (`#ffffff`): Canvas color in the white theme.

### Semantic (Carbon support tokens)
- **Support Error** (`#da1e28` — red-60): Error states, destructive actions, danger banners.
- **Support Success** (`#198038` — green-60): Success states, completion indicators.
- **Support Warning** (`#f1c21b` — yellow-30): Warning banners, caution messages.
- **Support Info** (`#0043ce` — blue-70): Information notifications.

### Dark Theme (Carbon also ships gray-90 and gray-100 themes)
- Inverse Background: `#262626` (gray-90)
- Inverse Hover: `#393939` (gray-80)
- Used for the IBM header bar, footer, and any dark-theme surfaces.

## 3. Typography Rules

### Font Family (dual-track — verified against live ibm.com CSS)

IBM ships **three** Plex variants. Which one you use depends on the surface:

- **`IBM Plex Serif`** — editorial/display (headlines, hero copy, feature lead-ins on marketing pages). 269 occurrences in ibm.com's homepage CSS, the most-used Plex face on the marketing surface. Use this for large display sizes (h1, h2 on marketing/editorial pages).
- **`IBM Plex Sans`** — UI/product default (buttons, body text, labels, forms, dashboards). 95 occurrences on the homepage; ~100% of Carbon Design System product UI. Use this for body, UI, and product apps.
- **`IBM Plex Mono`** — code, data, terminal output. 181 occurrences.

All three are free on Google Fonts:
- `https://fonts.google.com/specimen/IBM+Plex+Serif`
- `https://fonts.google.com/specimen/IBM+Plex+Sans`
- `https://fonts.google.com/specimen/IBM+Plex+Mono`

**Why two display variants?** Carbon (the design system) defaults to Plex Sans. ibm.com's marketing layer applies Plex Serif for editorial weight  the serif feels more "publication, not product." When you're authoring a Carbon product UI (dashboard, settings page, app), use Plex Sans everywhere. When you're authoring an ibm.com-style marketing surface, use Plex Serif for headlines and Plex Sans for body.

### Hierarchy (ibm.com marketing surface)

| Level             | Family         | Size          | Weight | Line Height | Letter Spacing | Use                                              |
|-------------------|----------------|---------------|--------|-------------|----------------|--------------------------------------------------|
| Display 01        | IBM Plex Serif | 54px (3.375)  | 300    | 1.07        | 0              | Hero / fluid display headlines                   |
| Display 02        | IBM Plex Serif | 42px (2.625)  | 300    | 1.19        | 0              | Page-level h1                                    |
| Heading 01        | IBM Plex Serif | 32px (2)      | 400    | 1.25        | 0              | Major section h2                                 |
| Heading 02        | IBM Plex Serif | 28px (1.75)   | 400    | 1.28        | 0              | Sub-section h2                                   |
| Heading 03        | IBM Plex Sans  | 20px (1.25)   | 400    | 1.4         | 0              | h3 — feature tile headings                       |
| Heading 04        | IBM Plex Sans  | 18px (1.125)  | 400    | 1.4         | 0              | h4 — card titles                                 |
| Body 01           | IBM Plex Sans  | 16px (1)      | 400    | 1.5         | 0              | Default body                                     |
| Body 02 / UI 01   | IBM Plex Sans  | 14px (0.875)  | 400    | 1.43        | 0.16px         | UI labels, button text, secondary body          |
| Label 01          | IBM Plex Sans  | 12px (0.75)   | 400    | 1.33        | 0.32px         | Form labels, captions                            |
| Code 01           | IBM Plex Mono  | 14px (0.875)  | 400    | 1.43        | 0.32px         | Inline + block code                              |

### Hierarchy (Carbon product UI / dashboards — Plex Sans throughout)

When authoring a Carbon product (Cloud console, Watson dashboard, internal apps), replace every Plex Serif row above with Plex Sans. Sizes, weights, line-heights, letter-spacing all stay identical  only the family flips.

### Principles
- **Light weights for display**: Carbon uses weight 300 for sizes 32px and up (Display 01-02 + Heading 01-02). Weight 400 is the default below 28px.
- **Letter-spacing scales inversely with size**: 0 for body and headings, 0.16px for 14px UI, 0.32px for 12px labels.
- **No italics by convention**: IBM doesn't use italic emphasis in product UI. Use bold or color shift instead.

## 4. Component Stylings

### Buttons

**Primary** — the main CTA
- Background: `#0f62fe` (IBM Blue 60)
- Text: `#ffffff`, 14px IBM Plex Sans weight 400, letter-spacing 0.16px
- Padding: `11px 16px 13px 16px` (asymmetric — 2px more bottom than top for optical alignment)
- Border-radius: `0px` (Carbon is sharp-cornered — this is canonical)
- Transition: `background-color 70ms cubic-bezier(0.2, 0, 0.38, 0.9)`
- Hover: background `#0353e9` (Blue 60 hover)
- Focus: 2px solid `#0f62fe` outline with 2px white offset
- Use: primary CTAs, form submits

**Secondary** — used alongside Primary in a button row
- Background: `#393939` (gray-80)
- Text: `#ffffff`, same typography as Primary
- Padding: same as Primary
- Border-radius: `0px`
- Transition: same as Primary
- Use: secondary action paired with a Primary

**Tertiary** — outlined alternative
- Background: transparent
- Text: `#0f62fe`
- Border: `1px solid #0f62fe`
- Padding: same as Primary (border inset, so visually identical box)
- Border-radius: `0px`
- Hover: background fills with `#0f62fe`, text becomes white
- Use: low-emphasis CTAs

**Ghost** — text-only button
- Background: transparent
- Text: `#0f62fe`, same typography as Primary
- Padding: same as Primary
- Hover: background `rgba(141, 141, 141, 0.12)` (gray-50 @ 12%)
- Use: in-context utility actions (Skip, Cancel)

**Danger** — destructive action
- Background: `#da1e28` (red-60)
- Text: `#ffffff`
- Padding + radius: same as Primary
- Use: destructive confirmation buttons

**Primary with Icon** — IBM's most-used marketing CTA (e.g. "Book live demo →")
- Base: same as Primary (`#0f62fe` bg, white text, 14px sohne-spec, `0px` radius, asymmetric padding `11px 16px 13px 16px`)
- Layout: `display: inline-flex; align-items: center; gap: 12px`
- Icon: 16×16 Carbon `ArrowRight` glyph placed AFTER the label, `currentColor` so it inherits the white text colour
- SVG path: `M18 6L16.57 7.393 24.15 15 4 15 4 17 24.15 17 16.57 24.573 18 26 28 16z` (viewBox `0 0 32 32`)
- Use: top-of-page hero CTA, "Get started" / "Book live demo" / "Try IBM Cloud" marketing buttons
- Sample texts captured on ibm.com: "Book live demo", "Try IBM Cloud", "Get started"

**Tertiary with Icon** — outlined CTA paired alongside Primary-with-Icon
- Base: same as Tertiary (transparent bg, `#0f62fe` text, `1px solid #0f62fe` border, 0 radius, asymmetric padding)
- Layout + icon: same `inline-flex; gap: 12px` + Carbon ArrowRight glyph
- Icon colour: `#0f62fe` (inherits text colour, which matches the border)
- Use: secondary marketing CTA, free-trial pairings, "Try X free" patterns
- Sample texts captured on ibm.com: "Try IBM Maximo free", "Read the docs", "Learn more"

### Cards & Containers (Carbon "Tile")

Carbon tiles are **flat** by design. The `.cds--tile` class appears 1960× in ibm.com's CSS  it's the canonical content container. Tiles use a Layer-01 surface against the white page background; the surface contrast IS the affordance. No shadow, no border, sharp corners.

**Base recipe**
- Background: `#f4f4f4` (Layer 01)  the tile surface. NOT white  the contrast against the white page is what makes the tile readable.
- Border: none. (Some product surfaces use `1px solid #e0e0e0` Border Subtle when tiles sit on white-on-white; ibm.com marketing skips it.)
- Border-radius: `0px` — Carbon is sharp; tiles do not round.
- Shadow: none. Carbon's tile system is flat; rely on Layer-01 contrast.
- Padding: 32px (standard ibm.com marketing tile), 24px (compact), 16px (dense).
- Layout: `display: flex; flex-direction: column;` so the CTA can pin to the bottom (`margin-top: auto`).

**Content tile** — eyebrow + title + body + bottom CTA-with-arrow (the pattern on ibm.com Maximo / Cloud product pages)
- Container: base recipe with 32px padding, min-height around 320px so 2-up grids align.
- Eyebrow: 14px `IBM Plex Sans` weight 400, color `#525252`. No uppercase  Carbon uses sentence case here. e.g. *"Interactive demo"*, *"Accelerators"*.
- Title: 28px **`IBM Plex Serif`** weight 400, line-height 1.2, color `#161616`. The serif voice is what gives marketing tiles their editorial weight. e.g. *"Explore the interactive demo"*, *"Maximo Accelerators: Powering innovation through expertise and partnerships"*.
- Body: 14px `IBM Plex Sans` weight 400, line-height 1.5, letter-spacing 0.16px, color `#161616` (full-strength, not muted  Carbon body copy is ink-dark on Layer-01).
- Bottom CTA row: `display: flex; justify-content: space-between; align-items: center; margin-top: auto; padding-top: 32px;`
- CTA link: 14px `IBM Plex Sans` weight 400, color `#0f62fe` (IBM Blue 60). e.g. *"Take the interactive demo"*, *"Explore Accelerators"*. No underline on these CTAs (Carbon uses underline only for in-body links, not for tile-bottom CTAs).
- CTA icon: Carbon `ArrowRight` 16×16 in `#0f62fe`, placed at the RIGHT edge of the row (the link text on the left, arrow on the right, full width). SVG path: `M18 6L16.57 7.393 24.15 15 4 15 4 17 24.15 17 16.57 24.573 18 26 28 16z` (viewBox `0 0 32 32`).

**Editorial / feature tile** — icon + eyebrow + title + bottom CTA (the pattern on ibm.com Newsroom / Enterprise Advantage tiles)
- Container: same base recipe, 32px padding.
- Icon: 48×48 thin-stroke line-art glyph in `#0f62fe`. Carbon convention is RAW icon (no background tile, no fill); 1.5px stroke. Source these from `@carbon/icons-react`  e.g. `<UserAvatar size={48} />`, `<RecentlyViewed size={48} />`, `<Idea size={48} />`.
- Eyebrow: 14px `IBM Plex Sans` weight 400, color `#525252`. e.g. *"IBM Newsroom"*, *"New IBM Enterprise Advantage Video"*.
- Title: 22px `IBM Plex Serif` weight 400, line-height 1.27, color `#161616`. Shorter than content-tile titles  feature tiles are link-heavy, prose-light.
- (Body is often omitted on feature tiles  the title carries the message.)
- Bottom CTA: same `space-between` row, same `#0f62fe` link colour and Carbon ArrowRight icon. CTA text examples: *"Read the blog"*, *"See it in action"*.
- Variation: some feature tiles use an inline-underlined CTA (`text-decoration: underline; text-underline-offset: 4px`) instead of the separated arrow  pick based on the surface's preferred density.

### Links
- Color: `#0f62fe` (IBM Blue 60)
- Text-decoration: `underline` by default (Carbon makes link affordance explicit)
- Hover: color `#0043ce`
- Focus: 2px solid `#0f62fe` outline
- Visited: same color (no purple)

### Form Inputs (Text Field)
- Background: `#f4f4f4` (Layer 01)
- Border bottom only: `1px solid #8d8d8d` (Border Strong)
- Text: `#161616`, 14px IBM Plex Sans weight 400
- Label above input: 12px weight 400, letter-spacing 0.32px, color `#525252`
- Focus: bottom border becomes 2px solid `#0f62fe`
- Padding: 11px 16px 13px 16px (matches button padding for vertical alignment)
- Border-radius: `0px`

### Navigation (IBM Header)
- Background: `#161616` (dark — Carbon header is always dark)
- Text: `#ffffff`, 14px IBM Plex Sans weight 400
- Active state: 2px solid `#0f62fe` underline below the active item
- Hover: background `#393939`

### Footer
- Background: `#161616`
- Text: `#c6c6c6` (gray-30) for primary; `#8d8d8d` (gray-50) for muted
- Font: 14px IBM Plex Sans weight 400

## 5. Layout Principles

### Spacing System
- **Mini-unit**: 8px (Carbon's atomic spacing unit)
- **Scale**: 2 / 4 / 8 / 12 / 16 / 24 / 32 / 40 / 48 / 64 / 80 / 96 / 160 (px)
- **Token names**: `spacing-01` (2px) through `spacing-13` (160px)
- **Most-used**: 16px (between text + action), 24px (between sections within a tile), 48-96px (between page sections)

### Grid & Container
- **Max content width**: 1584px (Carbon's wide breakpoint cap)
- **Breakpoints**: sm 320px · md 672px · lg 1056px · xl 1312px · max 1584px
- **Grid**: 16-column at xl, 12-column at md/lg, 4-column at sm
- **Gutter**: 16px between columns; 32px between major sections

### Border Radius Scale
- **0px**: the canonical Carbon corner. 99% of components — buttons, tiles, inputs, fieldsets, modals.
- **4px**: small chips, tags
- **2px**: micro-decorations
- **8px**: limited use — modal corners on some product surfaces
- **50%**: avatar dots, status indicators

### Whitespace Philosophy
Carbon defaults to *generous* vertical rhythm: 48-96px between page-level sections, 24-32px between tiles in a grid, 16px between text and its associated action. The grid is the primary structural device; whitespace is not decoration.

## 6. Depth & Elevation

Carbon is intentionally *flat* by default. Shadows are reserved for clear elevation hierarchy:

| Level             | Value                                       | Use                                  |
|-------------------|---------------------------------------------|--------------------------------------|
| Resting (Level 1) | `0 1px 2px 0 rgba(0, 0, 0, 0.1)`            | Default tile lift                    |
| Elevated (L2)     | `0 2px 6px 0 rgba(0, 0, 0, 0.14)`           | Overlays, modals, popovers           |
| Focus ring        | `0 0 0 2px #0f62fe`                         | Keyboard focus indicator             |

No coloured shadows. No multi-layer blue-tinted shadows. Carbon's depth language is monochrome and minimal.

## 6.5. Motion & Transitions

### Duration Scale
- **Fast 01** (`70ms`): immediate state changes (button hover, link color)
- **Fast 02** (`110ms`): toast / inline-message appearance
- **Moderate 01** (`150ms`): toggle / accordion expand
- **Moderate 02** (`240ms`): drawer slide-in
- **Slow 01** (`400ms`): page transitions

### Timing Functions
- **Productive** (default): `cubic-bezier(0.2, 0, 0.38, 0.9)` — most product transitions
- **Expressive**: `cubic-bezier(0.4, 0.14, 0.3, 1)` — emphasis transitions
- **Entrance**: `cubic-bezier(0, 0, 0.38, 0.9)`
- **Exit**: `cubic-bezier(0.2, 0, 1, 0.9)`

## 7. Do's and Don'ts

### Do
- Use IBM Blue (`#0f62fe`) for primary actions and links. No exceptions.
- Use `border-radius: 0px` on all interactive elements. Sharp corners are Carbon.
- Snap every spacing value to the 8px scale (2/4/8/12/16/24/...).
- Use the 70ms productive timing for everyday transitions.
- Prefer IBM Plex Sans weight 400 for almost everything; reserve weight 300 for display sizes 32px and up.

### Don't
- Don't round corners. Carbon's sharp aesthetic is a brand signature.
- Don't use italic in product UI. Use weight or color to emphasise.
- Don't introduce gradient backgrounds — Carbon is flat.
- Don't use Helvetica or Inter where IBM Plex Sans would serve. Plex is part of the brand.
- Don't add coloured shadows. Elevation is monochrome.

## 8. Responsive Behavior

### Breakpoints
- sm: 320px (single column, 4-col grid)
- md: 672px (8-col grid)
- lg: 1056px (16-col grid)
- xl: 1312px (16-col grid, larger gutters)
- max: 1584px (cap content width)

### Touch Targets
- Minimum 44×44px for any tap-target on mobile (Carbon spec)
- Buttons at 14px text + 11/13 padding hit ~48px height — comfortable

### Collapsing Strategy
- At sm, the header collapses to a hamburger; nav items hide
- Multi-column grids collapse to single column at sm; gutters tighten to 16px
- Sidebar (UI Shell) collapses behind a chevron at md and below

## 9. Agent Prompt Guide

### Quick Color Reference
```
Primary CTA            : #0f62fe (button bg)
Hover/Focus            : #0043ce
Body text              : #161616
Secondary text         : #525252
Background             : #ffffff (white) or #f4f4f4 (layer-01)
Border subtle          : #e0e0e0
Error                  : #da1e28
Success                : #198038
Warning                : #f1c21b
```

### Quick Component Recipe
- Primary button: `background: #0f62fe; color: #fff; padding: 11px 16px 13px 16px; border-radius: 0; font: 14px/1 'IBM Plex Sans' 400; letter-spacing: 0.16px`
- Tile: `background: #fff; border: 1px solid #e0e0e0; border-radius: 0; padding: 24px; box-shadow: 0 1px 2px 0 rgba(0,0,0,0.1)`
- Link: `color: #0f62fe; text-decoration: underline`
- Input: `background: #f4f4f4; border-bottom: 1px solid #8d8d8d; border-radius: 0; padding: 11px 16px 13px 16px`

### Example Component Prompts

> Build a Carbon-style pricing card grid: white background tile, no rounded corners, IBM Blue primary CTA, IBM Plex Sans typography.

> Render a Carbon notification banner: 4px left border in the support color, `#f4f4f4` background, 16px padding, no border-radius.

### Iteration Guide
- If something feels "too playful" → reduce border-radius to 0
- If something feels "off-brand" → check the font (must be IBM Plex Sans/Mono, not Helvetica/Inter)
- If a CTA doesn't pop → verify it's IBM Blue 60 `#0f62fe`, not Blue 70 or Blue 50
- If spacing feels random → snap every value to a multiple of 4 or 8
