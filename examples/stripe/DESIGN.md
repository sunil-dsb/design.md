<!-- Generated: 2026-04-05 | Source: https://stripe.com | Pages: 1 | Framework: none -->
<!-- This is not the official design system. Colors, fonts, and spacing may not be 100% accurate. -->

# Design System: Stripe

## 1. Visual Theme & Atmosphere

Stripe's website is the gold standard of fintech design -- a system that manages to feel simultaneously technical and luxurious, precise and warm. The page opens on a white canvas (`#ffffff`) with deep navy headings (`#061b31`) and a signature purple (`#533afd`) that functions as both brand anchor and interactive accent. This is not the cold, clinical purple of enterprise software; it is a rich, saturated violet that reads as confident and financially authoritative. The overall impression is of a financial institution redesigned by a world-class type foundry.

The custom `sohne-var` variable font is the defining element of Stripe's visual identity. Every text element enables the OpenType `"ss01"` stylistic set, which modifies character shapes for a distinctly geometric feel. At display sizes (44px-56px), `sohne-var` runs at weight 300 -- an extraordinarily light weight for headlines that creates an ethereal, almost whispered authority. This is the opposite of the bold hero headline convention; Stripe's headlines do not need to shout. The negative letter-spacing (-1.4px at 56px, -0.96px at 48px) tightens the text into dense, engineered blocks.

What truly distinguishes Stripe is its shadow system. Rather than flat or single-layer shadows, Stripe uses blue-tinted shadows: the signature `rgba(50,50,93,0.12)` creates depth with a cool, atmospheric quality -- like elements floating in a twilight sky. The blue-gray undertone of `rgb(50,50,93)` ties directly to the navy-purple brand palette, making even elevation feel on-brand.

**Key Characteristics:**
- `sohne-var` with OpenType `"ss01"` on all text -- a custom stylistic set that defines the brand's letterforms
- Weight 300 as the signature headline weight -- light, confident, anti-convention
- Negative letter-spacing at display sizes (-1.4px at 56px, -0.96px at 48px, -0.64px at 32px) -- progressive relaxation downward
- Blue-tinted shadows using `rgba(50,50,93,0.12)` -- elevation that feels brand-colored
- Deep navy (`#061b31`) headings instead of black -- warm, financial-grade text hierarchy
- Conservative border-radius (4px-8px, workhorse at 4px with 55 occurrences) -- nothing pill-shaped, nothing harsh
- Slate body text (`#64748d`) with blue-gray undertone -- not neutral gray, but brand-tinted secondary text
- `"tnum"` tabular numerals for financial data display at 14px and 11px -- separate OpenType mode for numbers
- `SourceCodePro` at weight 500 as the monospace companion for code and technical labels
- Purple gradient system using `#533afd` through `#7f7dfc` to `#f44bcc` -- violet-to-magenta decorative range

## 2. Color Palette & Roles

### Primary
- **Stripe Purple** (`#533afd`): Primary brand color, CTA backgrounds, link text, interactive highlights. A saturated blue-violet at frequency 2782 that anchors the entire system. Used as text color (808), background (7), border (1960), and gradient (5).
- **Deep Navy** (`#061b31`): Primary heading color at frequency 899. Not black, not gray -- a very dark blue that adds warmth and depth to text. The decision to avoid pure black is what gives Stripe text its distinctive premium feel.
- **Pure White** (`#ffffff`): Page background, card surfaces, button text on dark backgrounds. Frequency 504 across text (133), backgrounds (37), and borders (317).

### Neutral Scale
- **Slate Blue** (`#50617a`): Secondary body text at frequency 1029. A cool blue-gray that sits between heading navy and body slate in the luminance hierarchy.
- **Body Slate** (`#64748d`): Tertiary text, descriptions, captions at frequency 494. The blue undertone prevents the flat, lifeless quality of pure gray body text.
- **Dark Slate** (`#273951`): Form labels, secondary headings at frequency 113. Sits between heading navy and body text in the hierarchy.
- **Mid Slate** (`#3c4f69`): Supplementary text and icon color at frequency 127. Another step in Stripe's unusually granular text-color ladder.
- **Light Slate** (`#7d8ba4`): Muted metadata and tertiary labels at frequency 49.

### Interactive
- **Primary Purple** (`#533afd`): Primary link and CTA color. Active states, selected elements.
- **Periwinkle** (`#7389ff`): Secondary interactive accent at frequency 85. A lighter blue-violet for gradient transitions and secondary highlights.
- **Lavender Border** (`#b9b9f9`): Active/selected state borders on buttons and inputs at frequency 40. Used exclusively as border color.
- **Soft Purple Border** (`#d6d9fc`): Subtle purple-tinted borders for secondary elements at frequency 37.
- **Mid Purple** (`#7f7dfc`): Gradient transition color at frequency 27. Used in text (6), border (15), and gradient (6).

### Surface & Borders
- **Border Default** (`#e5edf5`): Standard border and divider color at frequency 111. Used as background (20), border (81), and gradient (10).
- **Soft Border** (`#d4dee9`): Secondary border color at frequency 2. Slightly warmer than the default border.
- **Lilac Surface** (`#e2e4ff`): Purple-tinted surface for card backgrounds and decorative fills at frequency 16.

### Accent Colors
- **Orange** (`#ff6118`): Warm accent at frequency 100 for icons and decorative elements.
- **Magenta** (`#f44bcc`): Vivid pink-purple at frequency 6, used exclusively in gradients. The far end of the purple-to-pink gradient range.
- **Violet Gradient** (`#da4bfe`): Rich purple at 0.8 opacity, frequency 3, gradient-only. Connects the primary purple to the magenta endpoint.
- **Green** (`#81b81a`): Status and success accent at frequency 15.

### Shadow Colors
- **Shadow Blue** (`rgba(50,50,93,0.12)`): The signature blue-tinted shadow at frequency 2. Deep blue-gray that echoes the brand's navy palette.
- **Shadow Ambient** (`rgba(23,23,23,0.08)`): Soft ambient shadow for subtle elevation at frequency 1.
- **Shadow Soft** (`rgba(23,23,23,0.06)`): Minimal ambient shadow for light lift at frequency 1.

## 3. Typography Rules

### Font Family
- **Primary**: `sohne-var`, variable font with weight range 1-1000
- **Monospace**: `SourceCodePro`, weight 500
- **OpenType Features**: `"ss01"` enabled globally on all `sohne-var` text; `"tnum"` for tabular numbers on financial data and pricing.

### Hierarchy

| Role | Font | Size | Weight | Line Height | Letter Spacing | Features | Notes |
|------|------|------|--------|-------------|----------------|----------|-------|
| Display Hero | sohne-var | 56px (3.50rem) | 300 | 1.03 (tight) | -1.4px | ss01 | Maximum size, whisper-weight authority |
| Display Large | sohne-var | 48px (3.00rem) | 300 | 1.03 (tight) | -0.96px | ss01 | Secondary hero headlines |
| Display Numeric | sohne-var | 48px (3.00rem) | 400 | 1.00 (tight) | -0.96px | ss01 | Large stat counters, metric displays |
| Hero Heading | sohne-var | 44px (2.75rem) | 300 | 1.15 | -0.88px | ss01 | Primary h1 hero headlines |
| Section Heading | sohne-var | 32px (2.00rem) | 300 | 1.10 (tight) | -0.64px | ss01 | Feature section titles |
| Sub-heading Large | sohne-var | 26px (1.63rem) | 300 | 1.12 (tight) | -0.26px | ss01 | Card headings, sub-sections |
| Sub-heading UI | sohne-var | 26px (1.63rem) | 400 | normal | normal | ss01 | Interactive sub-headings, financial labels |
| Sub-heading Small | sohne-var | 22px (1.38rem) | 300 | 1.10 (tight) | -0.22px | ss01 | Smaller section heads, testimonial titles |
| Body Large | sohne-var | 18px (1.13rem) | 300 | 1.40 | normal | ss01 | Feature descriptions, intro text |
| Body Large UI | sohne-var | 18px (1.13rem) | 400 | 1.40 | normal | ss01 | Attribution text, speaker names |
| Body | sohne-var | 16px (1.00rem) | 400 | normal | normal | ss01 | Standard reading text, navigation base |
| Body Light | sohne-var | 16px (1.00rem) | 300 | 1.25 | normal | ss01 | Secondary body, feature captions |
| Body CTA | sohne-var | 16px (1.00rem) | 600 | 1.00 (tight) | normal | ss01 | CTA links, bold labels |
| Nav Button | sohne-var | 14px (0.88rem) | 600 | 1.00 (tight) | normal | ss01 | Navigation buttons, primary CTAs |
| Caption Tabular | sohne-var | 14px (0.88rem) | 300 | normal | -0.42px | tnum | Financial percentages, live data |
| Caption | sohne-var | 12px (0.75rem) | 400 | normal | normal | ss01 | Small labels, order summaries |
| Caption Light | sohne-var | 12px (0.75rem) | 300 | 1.33 | 0.036px | ss01 | Fine print, billing labels |
| Pricing Tabular | sohne-var | 11px (0.69rem) | 300 | 1.45 | -0.33px | tnum | Pricing breakdowns, unit costs |
| Micro | sohne-var | 10px (0.63rem) | 300 | 1.15 (tight) | normal | ss01 | Checkout labels, tiny text |
| Micro UI | sohne-var | 10px (0.63rem) | 400 | 1.15 (tight) | 0.1px | ss01 | Product names, discount labels |
| Nano | sohne-var | 9px (0.56rem) | 300-400 | normal | normal | ss01 | URL text, product descriptions |
| Pico | sohne-var | 8px (0.50rem) | 300-400 | 1.07-1.12 | normal | ss01 | Form labels, separator text |

### Principles
- **Light weight as signature**: Weight 300 at display sizes is Stripe's most distinctive typographic choice. Where others use 600-700 to command attention, Stripe uses lightness as luxury -- the text is so confident it does not need weight to be authoritative.
- **ss01 everywhere**: The `"ss01"` stylistic set is non-negotiable. It modifies specific glyphs to create a more geometric, contemporary feel across all `sohne-var` text. Every element from 56px heroes to 8px form labels carries this feature.
- **Two OpenType modes**: `"ss01"` for display and body text, `"tnum"` for tabular numerals in financial data. These never overlap -- a number in a paragraph uses `ss01`, a number in a pricing table uses `tnum`.
- **Progressive tracking**: Letter-spacing tightens proportionally with size: -1.4px at 56px, -0.96px at 48px, -0.88px at 44px, -0.64px at 32px, -0.26px at 26px, normal at 16px and below. The tracking at tabular sizes reverses: -0.42px at 14px and -0.33px at 11px for numeric density.
- **Three-weight discipline**: Primarily 300 (body and headings), 400 (UI and navigation base), 600 (CTAs and nav buttons). No weight 500 or 700 in the primary font.

## 4. Component Stylings

### Buttons

**Primary Purple**
- Background: `rgb(83,58,253)` / `#533afd`
- Text: `#ffffff`
- Padding: 11.5px 20px 14.5px 20px
- Radius: 4px
- Font: 14px `sohne-var` weight 600, `"ss01"`
- Transition: `background-color 0.3s cubic-bezier(0.25, 1, 0.5, 1)`
- Use: Primary CTA ("Start now", "Contact sales")

**Secondary / Outlined**
- Background: `rgba(255,255,255,0.65)`
- Text: `#533afd`
- Padding: 14.5px 24px 15.5px 24px
- Radius: 4px
- Border: `1px solid #b9b9f9`
- Font: 16px `sohne-var` weight 600, `"ss01"`
- Transition: `background-color 0.3s cubic-bezier(0.25, 1, 0.5, 1)`
- Use: Secondary actions ("Sign up with Google")

**Ghost Navigation**
- Background: transparent
- Text: `#061b31`
- Padding: 12px 0px
- Radius: 4px
- Font: 14px `sohne-var` weight 600, `"ss01"`
- Transition: `background-color 0.3s cubic-bezier(0.25, 1, 0.5, 1), color 0.3s cubic-bezier(0.25, 1, 0.5, 1)`
- Use: Navigation menu items

**Primary with Icon** — the canonical Stripe marketing CTA (`Start now ›`, `Request an invite ›`)
- Base: same as Primary Purple (`#533afd` bg, white text, 14px sohne-var weight 600, 4px radius, asymmetric padding `11.5px 20px 14.5px 20px`)
- Layout: `display: inline-flex; align-items: center; gap: 12px`
- Icon: **chevron-right `›`** placed AFTER the label (NOT a solid arrow  Stripe uses a thin chevron, distinct from Carbon's ArrowRight)
- Icon SVG: 14×14, `stroke: currentColor; stroke-width: 1.75; fill: none; stroke-linecap: round; stroke-linejoin: round`, path `M6 4l4 4-4 4` (viewBox `0 0 16 16`)
- Use: top-of-page hero CTA, "Start now" / "Request an invite" / "Get started" patterns
- Sample texts captured on stripe.com: "Start now", "Request an invite", "Get started"

**Outlined** — solid-white-background secondary (`Contact sales`)
- Background: `#ffffff` (true white, not the translucent `rgba(255,255,255,0.65)` used over hero gradients)
- Text: `#533afd` (Primary Purple)
- Border: `1px solid #b9b9f9` (Stripe Hairline)
- Padding: `11.5px 20px 14.5px 20px` (matches Primary so paired CTAs align)
- Radius: 4px
- Font: 14px `sohne-var` weight 600
- Use: secondary action paired beside Primary with Icon, e.g. `Start now ›  Contact sales`
- Sample text captured: "Contact sales"

**Outlined with Icon** — outlined with chevron (`Read the story ›`)
- Base: same as Outlined (white bg, purple text, hairline border, 4px radius, asymmetric padding)
- Layout + icon: same `inline-flex; gap: 12px` + the same Stripe chevron-right glyph
- Icon colour: `#533afd` (inherits text colour, matches the border)
- Use: editorial / story-card CTAs (`Read the story`, `Read the docs`, `Learn more`)
- Sample texts captured: "Read the story", "Read the docs", "Learn more"

### Cards & Containers

**Base recipe (apply to any Stripe-style card)**
- Background: `#ffffff` (Canvas)
- Border: `1px solid #e5edf5` (Canvas Alt as hairline)
- Radius: 4px (tight), 5px (standard), 6px (comfortable), 8px (featured)
- Shadow (standard): `rgba(50,50,93,0.12) 0px 16px 32px 0px`
- Shadow (ambient): `rgba(23,23,23,0.08) 0px 15px 35px 0px`
- Shadow (subtle): `rgba(23,23,23,0.06) 0px 3px 6px 0px`
- Padding: 24px (compact), 32px (standard), 48px (hero)
- Title color: `#061b31` (Deep Navy)
- Body color: `#50617a` (Muted slate)

**Content card** — canonical headline + body + CTA link pattern
- Container: base recipe with 24-32px padding
- Eyebrow tag: 11px `sohne-var` weight 600, `letter-spacing: 0.12em`, `text-transform: uppercase`, color `#533afd` (Primary)
- Title: 20px `sohne-var` weight 600, line-height 1.25, color `#061b31` (Ink/Deep Navy)
- Body: 14px `sohne-var` weight 400, line-height 1.5, color `#50617a` (Muted)
- Inline CTA link: 14px `sohne-var` weight 600, color `#533afd` (Primary), `text-decoration: underline`, `text-underline-offset: 3px`, `text-decoration-color: rgba(83,58,253,0.33)`
- CTA glyph: `→` after the link text
- Use: feature highlights, doc surfaces, product callouts

**Feature card** — icon + title + description pattern
- Container: base recipe with 24px padding
- Accent tile: 40×40px square, radius matches card, background `<accent>1f` (12% alpha of the accent colour), foreground `<accent>` at full opacity
  - For Stripe: tile background `rgba(255,97,24,0.12)` with Orange `#ff6118` icon
  - Or Primary-tinted: `rgba(83,58,253,0.12)` with `#533afd` icon
- Title: 18px `sohne-var` weight 600, line-height 1.3, color `#061b31`
- Description: 14px `sohne-var` weight 400, line-height 1.5, color `#50617a`
- Use: capability grids, product feature rows, three-up layouts

**Marketing feature block** — flat-on-white pattern Stripe ships across stripe.com (the value-prop grids on Platforms, Atlas, Connect, etc.)
- Container: **no border, no shadow** flat on the white page background. Padding 32px. No card surface differentiation; the icon tile is the visual anchor.
- Icon tile: 48×48 square with `border-radius: 4px`, background `rgba(83, 58, 253, 0.08)` (Primary at 8% alpha), foreground `#533afd` for the line-art icon. Stroke 1.75 on the icon path. Icon examples: `trending-up`, `grid-plus`, `shield`, `bolt`  thin geometric line-art.
- Title + body in ONE paragraph (Stripe convention): `<strong>Title.</strong>` (bold, ink-dark, **trailing period intentional**) followed by ` ` plus body text in muted slate `#50617a`. 16px `sohne-var` weight 400, line-height 1.5.
- CTA: 16px `sohne-var` weight 600, color `#533afd` (Primary), inline-flex with a `›` chevron icon (`gap: 6px`). No underline. Examples: `Read the guide ›`, `View services ›`, `Learn more ›`.
- Layout: vertical flex column, CTA pinned at the bottom via `margin-top: auto` so a grid of feature blocks aligns the CTA row across columns.
- Use: 3-up / 4-up feature grids on landing pages, Platforms / Connect / Atlas value-prop sections.

### Links
- Text: `#533afd`
- Font: 16px `sohne-var` weight 600, `"ss01"`
- Transition: `opacity 0.24s cubic-bezier(0.45, 0.05, 0.55, 0.95)`
- Use: Inline links, feature navigation arrows

### Navigation
- Background: transparent with 6px radius container
- Font: 16px `sohne-var` weight 400, `"ss01"`
- Padding: 10px 16px
- CTA: Purple button right-aligned (14px weight 600)
- Transition: `all` (general nav transitions)

### Footer
- Background: `rgb(248,250,253)` / near-white blue tint
- Text: `#000000`
- Font: 16px `sohne-var` weight 400
- Padding: 0px 16px

## 5. Layout Principles

### Spacing System
- Base unit: 4px
- Scale: 4, 8, 12, 16, 20, 24, 28, 32, 36, 40, 48, 52, 56, 60, 64, 72, 80, 96
- Most frequent values: 16px (181 occurrences), 8px (80), 24px (59), 4px (47)
- The scale is dense at the small end (every 4px from 4-40), reflecting Stripe's precision-oriented UI for financial data

### Grid & Container
- Max content width: 1266px
- Common column counts: 1, 2, 3, 4, 8, 12
- Hero: centered single-column with generous padding, lightweight headlines at 44px-56px
- Feature sections: 2-4 column grids for feature cards
- Full-width sections at section breaks

### Whitespace Philosophy
- **Precision spacing**: Unlike the vast emptiness of minimalist systems, Stripe uses measured, purposeful whitespace. Section spacing clusters at 48px, 60px, 64px, 71px, 80px, and 96px -- six distinct vertical rhythms rather than one uniform gap.
- **Dense data, generous chrome**: Financial data displays use tight 4px-8px internal spacing, but the UI chrome around them uses 16px-24px padding. This creates a sense of controlled density -- like a well-organized spreadsheet in a purposefully framed container.
- **Vertical cadence**: The 71px spacing value (24 occurrences) is unusual and likely tied to a specific section rhythm in the hero or stats area, creating a distinctive vertical beat that departs from standard 8px-grid multiples.

### Border Radius Scale
- Micro (2px-3px): Fine-grained elements, subtle rounding
- Standard (4px): Buttons, inputs, badges -- the workhorse at 55 occurrences
- Comfortable (5px): Standard card containers at 6 occurrences
- Relaxed (6px): Navigation, larger interactive elements at 31 occurrences
- Large (8px): Featured cards, hero elements at 4 occurrences
- Compound: `6px 6px 0px 0px` (top-rounded), `0px 0px 6px 6px` (bottom-rounded), `6px 0px 0px 6px` (left-rounded)

## 6. Depth & Elevation

### Captured "ambient" shadows (single-stop, from marketing surface)

| Level | Treatment | Use |
|-------|-----------|-----|
| Flat (Level 0) | No shadow | Page background, inline text |
| Subtle (Level 1) | `rgba(23,23,23,0.06) 0px 3px 6px 0px` | Light card lift, hover hints |
| Ambient (Level 2) | `rgba(23,23,23,0.08) 0px 15px 35px 0px` | Standard cards, content panels |
| Elevated (Level 3) | `rgba(50,50,93,0.12) 0px 16px 32px 0px` | Featured cards, dropdowns, popovers |
| Focus Ring | `2px solid #533afd` outline | Keyboard focus states |

### Canonical `--cardShadow` scale (multi-stop, from Stripe's published CSS variables)

Stripe ships a 4-tier `--cardShadow*` scale that's used throughout Stripe Elements, Checkout, and Dashboard product surfaces. Each value is a **two-layer** shadow: an ambient blue-tinted layer (`rgba(50,50,93,0.25)`) layered over a directional black layer (`rgba(0,0,0,0.3)`). Together they read as soft-edge depth, not flat outlines.

| Variable | Value | Use |
|-|-|-|
| `--cardShadowXSmall` | `0 2px 5px -1px rgba(50,50,93,0.25), 0 1px 3px -1px rgba(0,0,0,0.3)` | Tight lift  resting tiles, micro-cards |
| `--cardShadowSmall`  | `0 6px 12px -2px rgba(50,50,93,0.25), 0 3px 7px -3px rgba(0,0,0,0.3)` | Standard product cards, list rows |
| `--cardShadowMedium` | `0 13px 27px -5px rgba(50,50,93,0.25), 0 8px 16px -8px rgba(0,0,0,0.3)` | Hover-lifted cards, dropdowns, popovers |
| `--cardShadowLarge`  | `0 30px 60px -12px rgba(50,50,93,0.25), 0 18px 36px -18px rgba(0,0,0,0.3)` | Modals, focused panels, marketing hero callouts |

CSS-class wiring on stripe.com: `.Card--shadowXSmall` / `--shadowSmall` / `--shadowMedium` / `--shadowLarge` set `--cardShadow: var(--cardShadow*)` on the wrapping `.Card` element.

**Shadow Philosophy**: Stripe's shadow system is built on a principle of chromatic depth. Where most design systems use neutral gray or black shadows, Stripe's primary shadow color (`rgba(50,50,93,0.25)`) is a deep blue-gray that echoes the brand's navy palette. This creates shadows that do not just add depth -- they add brand atmosphere. The dual-system approach separates neutral ambient shadows (`rgba(23,23,23,...)`) for subtle marketing-page lift from the multi-layer blue-tinted `--cardShadow*` scale for product-surface elevation, creating a brand-colored depth hierarchy that distinguishes Stripe from every flat-shadow design system.

## 6.5. Motion & Transitions

### Duration Scale

| Token | Value | Frequency | Use |
|-------|-------|-----------|-----|
| micro | 1ms | 1 | Instant state changes |
| small | 150ms | 14 | Hover feedback, micro-interactions |
| medium | 300ms | 35 | Standard transitions, button state changes |
| large | 600ms | 19 | Section reveals, card expansions |
| xl | 2000ms | 7 | Hero animations, slow ambient motion |

### Timing Functions
- **Primary**: `ease` at 142 occurrences -- the system default
- **Expressive**: `cubic-bezier(0.25, 1, 0.5, 1)` at 21 occurrences -- used for button transitions, an overshoot-dampened curve
- **Smooth**: `cubic-bezier(0.4, 0, 0.2, 1)` at 4 occurrences -- Material-style standard easing
- **Sharp**: `cubic-bezier(0.16, 1, 0.3, 1)` at 4 occurrences -- fast entry, slow settle
- **Linear**: 8 occurrences -- constant-speed for progress indicators
- **Custom variables**: `--navigation-easing` (10), `--stats-section-transition-timing-function` (11), `--card-ease` (6) -- component-specific named curves

## 7. Do's and Don'ts

### Do
- Use `sohne-var` with `"ss01"` on every text element -- the stylistic set IS the brand's typographic DNA
- Use weight 300 for all headlines and body text -- lightness is the signature that distinguishes Stripe from every heavy-handed fintech
- Apply blue-tinted shadows (`rgba(50,50,93,0.12)`) for elevated elements -- chromatic depth over flat neutral gray
- Use `#061b31` (deep navy) for headings instead of `#000000` -- the warmth matters and prevents the harshness of pure black
- Keep border-radius at 4px for interactive elements and 6px for containers -- conservative rounding is intentional
- Use `"tnum"` for any tabular or financial number display -- `"ss01"` and `"tnum"` serve distinct purposes and never coexist on the same element
- Use the `cubic-bezier(0.25, 1, 0.5, 1)` curve for button transitions at 300ms -- this is the branded interactive feel
- Maintain the six-step text-color ladder: `#061b31` > `#273951` > `#3c4f69` > `#50617a` > `#64748d` > `#7d8ba4` -- each step has a specific role

### Don't
- Don't use weight 600-700 for `sohne-var` headlines -- weight 300 is the brand voice; 600 is reserved exclusively for CTA text and nav buttons
- Don't use large border-radius (12px+, pill shapes) on cards or buttons -- Stripe's maximum observed radius is 8px for featured elements, 16px appears only once
- Don't use neutral gray shadows -- always tint with blue (`rgba(50,50,93,...)`) for the primary elevation layer
- Don't skip `"ss01"` on any `sohne-var` text -- the alternate glyphs define the personality; removing them produces a visibly different font
- Don't use pure black (`#000000`) for headings -- always `#061b31` deep navy; the `#000000` in the token data is primarily a border/structural color (3869 border uses vs. 1592 text)
- Don't use warm accent colors (orange `#ff6118`, magenta `#f44bcc`) for interactive elements -- these are decorative and gradient-only; purple `#533afd` is the sole interactive color
- Don't apply positive letter-spacing at display sizes -- Stripe tracks tight: -1.4px at 56px, -0.96px at 48px, -0.88px at 44px
- Don't mix `"ss01"` and `"tnum"` on the same element -- `"ss01"` is for display and body, `"tnum"` is for financial data; each serves a separate mode
- Don't use `#b9b9f9` for backgrounds or text -- it is a border-only token (40 occurrences, all as `borderColor`)

## 8. Responsive Behavior

### Breakpoints
| Name | Width | Key Changes |
|------|-------|-------------|
| Mobile | <640px | Single column, reduced heading sizes, stacked cards |
| Tablet | 640-1024px | 2-column grids, moderate padding |
| Desktop | 1024-1266px | Full layout, 3-4 column feature grids |
| Large Desktop | >1266px | Centered content at max-width 1266px with generous margins |

### Touch Targets
- Primary buttons use generous padding (11.5px-14.5px vertical, 20px-24px horizontal)
- Navigation buttons have 12px vertical padding for comfortable tap targets
- Navigation container uses 10px 16px padding with 6px radius
- Ghost links rely on text size (14px-16px) and spacing for adequate touch area

### Collapsing Strategy
- Hero headline: 56px display -> 44px -> 32px across breakpoints, weight 300 maintained throughout
- Navigation: horizontal links + CTAs with 6px radius container -> hamburger toggle
- Feature cards: 4-column -> 3-column -> 2-column -> single column stacked
- Stats section: horizontal stat counters at 48px -> stacked at reduced sizes
- Financial data: tight tabular layouts with `"tnum"` at 11px-14px maintain density, may horizontally scroll
- Section spacing: 96px -> 64px -> 48px as viewport narrows
- Typography scale compresses while preserving the weight 300 signature at all sizes

### Image Behavior
- Dashboard/product screenshots maintain blue-tinted shadow treatment at all sizes
- Checkout UI previews at 8px-10px text sizes maintain `"ss01"` feature settings
- Card images maintain consistent 4px-6px border-radius
- Gradient decorative elements (purple-to-magenta) simplify on mobile

## 9. Agent Prompt Guide

### Quick Color Reference
- Primary CTA: Stripe Purple (`#533afd`)
- Background: Pure White (`#ffffff`)
- Heading text: Deep Navy (`#061b31`)
- Body text: Slate (`#64748d`)
- Secondary text: Slate Blue (`#50617a`)
- Label text: Dark Slate (`#273951`)
- Border: Soft Blue (`#e5edf5`)
- Link: Stripe Purple (`#533afd`)
- Active border: Lavender (`#b9b9f9`)
- Shadow primary: `rgba(50,50,93,0.12)`
- Shadow ambient: `rgba(23,23,23,0.08)`
- Accent decorative: Orange (`#ff6118`), Magenta (`#f44bcc`)

### Example Component Prompts
- "Create a hero section on white background. Headline at 44px sohne-var weight 300, line-height 1.15, letter-spacing -0.88px, color #061b31, font-feature-settings 'ss01'. Subtitle at 18px weight 300, line-height 1.40, color #64748d. Purple CTA button (#533afd background, white text, 4px radius, 14px weight 600, 11.5px 20px padding) with transition background-color 0.3s cubic-bezier(0.25, 1, 0.5, 1). Secondary outlined button (rgba(255,255,255,0.65) background, 1px solid #b9b9f9 border, #533afd text, 4px radius)."
- "Design a card: white background, 1px solid #e5edf5 border, 6px radius. Shadow: rgba(50,50,93,0.12) 0px 16px 32px 0px. Title at 22px sohne-var weight 300, letter-spacing -0.22px, color #061b31, font-feature-settings 'ss01'. Body at 16px weight 300, line-height 1.25, color #64748d, font-feature-settings 'ss01'."
- "Build a navigation bar: transparent background, 6px border-radius container, padding 10px 16px. Links at 14px sohne-var weight 600, color #061b31, font-feature-settings 'ss01'. Purple CTA button right-aligned (#533afd background, white text, 4px radius, 14px weight 600). Transition: background-color 0.3s cubic-bezier(0.25, 1, 0.5, 1)."
- "Create a stats display: 48px sohne-var weight 300 for large numbers, letter-spacing -0.96px, color #061b31, font-feature-settings 'ss01'. Label below at 16px weight 300, color #50617a. For tabular data, switch to 14px weight 300, letter-spacing -0.42px, font-feature-settings 'tnum' instead of 'ss01'."
- "Design a pricing component: card with white background, 1px solid #e5edf5 border, 5px radius. Price at 26px sohne-var weight 300, letter-spacing -0.26px, color #061b31, font-feature-settings 'ss01'. Unit cost at 11px weight 300, letter-spacing -0.33px, font-feature-settings 'tnum', color #50617a. CTA button at bottom: #533afd background, white text, 4px radius, 14px weight 600."
- "Build a footer section: background rgb(248,250,253), text #000000. Links at 16px sohne-var weight 400, font-feature-settings 'ss01'. Section titles at 16px weight 600. Padding 0px 16px. No border-radius. Transition: all."

### Iteration Guide
1. Always enable `font-feature-settings: "ss01"` on `sohne-var` text -- this is the brand's typographic DNA; removing it changes the visual identity
2. Weight 300 is the default for body and headings; use 400 for navigation base and UI labels; use 600 only for buttons, CTAs, and nav items
3. Shadow formula: `rgba(50,50,93,0.12) 0px 16px 32px 0px` for prominent elevation; `rgba(23,23,23,0.08) 0px 15px 35px 0px` for ambient lift
4. Heading color is `#061b31` (deep navy), body is `#64748d` (slate), labels are `#273951` (dark slate), secondary body is `#50617a` (slate blue)
5. Border-radius stays in the 4px-8px range -- 4px for buttons and inputs, 5px-6px for cards, 8px maximum for featured elements
6. Use `"tnum"` instead of `"ss01"` for any numbers in tables, charts, pricing, or financial displays -- these are mutually exclusive features
7. Button transitions use `cubic-bezier(0.25, 1, 0.5, 1)` at 300ms -- this curve has a slight overshoot-dampened feel
8. Max content width is 1266px -- wider than many systems, reflecting Stripe's information-dense layout philosophy
