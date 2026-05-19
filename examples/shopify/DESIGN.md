# Design System: Shopify

## 0. Brand Context

_Skipped by the deterministic emitter  Brand Context requires world knowledge about the company, audience, and personality that no extraction can produce reliably._

For a complete, agent-written Brand Context section, paste `prompts/universal.md` (downloadable from the SPA result panel) into Claude Code / Claude.ai / ChatGPT / Cursor.

## 1. Visual Theme & Atmosphere

_Skipped by the deterministic emitter  Visual Theme requires aesthetic judgement ("could this describe 3 other sites?") that no extraction can produce reliably._

For a complete, agent-written Visual Theme section, paste `prompts/universal.md` into an AI agent.

## 2. Color Palette & Roles

Permanent palette (L1 infrastructure + L2 system): 19 tokens. 10 campaign-level tokens are listed separately below; 7 content-level tokens are excluded per the 4-layer stability classification.

### Brand Colors

- **Primary** (`#36f4a4`): frequency 55. Used as (text 34, border 21). (layer: infrastructure)
- **Accent** (`#95bf47`): frequency 20. Used as (text 10, bg 1, border 9). (layer: infrastructure)
- **Brand Dark** (`#11352d`): frequency 9. Used as (border 8, gradient 1). (layer: system)
- **Dark Surface** (`#061a1c`): frequency 56. Used as (bg 28, border 8, gradient 20). (layer: infrastructure)
- **Blue Tone** (`#1e2c31`): frequency 29. Used as (border 20, gradient 9). (layer: system)
- **Dark Surface** (`#02090a`): frequency 28. Used as (bg 22, gradient 6). (layer: system)
- **Green Tone** (`#99b3ad`): frequency 13. Used as (text 10, border 3). (layer: system)
- **Dark Surface** (`#000a1e`): frequency 12. Used as (bg 4, shadow 2, gradient 6). (layer: system)
- **Violet Tone** (`#751be9`): frequency 10. Used as (border 10). (layer: system)
- **Blue Tone** (`#3f3f4b`): frequency 9. Used as (text 2, border 1, shadow 1, gradient 5). (layer: infrastructure)
- **Violet Tone** (`#7126ff`): frequency 5. Used as (text 2, border 1, gradient 1, icon 1). (layer: system)

### Structural Colors

- **Ink** (`#000000`): frequency 3096. Used as (text 1809, bg 9, border 1219, shadow 55, gradient 3, icon 1). (layer: infrastructure)
- **Canvas** (`#ffffff`): frequency 4248. Used as (text 2626, bg 76, border 1521, shadow 23, gradient 1, icon 1). (layer: infrastructure)
- **Muted** (`#71717a`): frequency 40. Used as (text 36, border 4). (layer: infrastructure)
- **Hairline** (`#e5e7eb`): frequency 9164. Used as (text 24, border 9140). (layer: infrastructure)
- **Mid Neutral** (`#a1a1aa`): frequency 464. Used as (text 312, border 152). (layer: infrastructure)
- **Mid Neutral** (`#9797a2`): frequency 32. Used as (text 22, border 10). (layer: system)
- **Mid Neutral** (`#bdbdca`): frequency 12. Used as (text 10, border 2). (layer: system)
- **Dark Neutral** (`#52525b`): frequency 6. Used as (text 4, border 2). (layer: system)

### Color Boundary Rules

- Infrastructure (L1) and System (L2) colors form the permanent palette. Use them anywhere.
- Campaign (L3) colors are launch-specific and will change. See the Campaign Colours table below; do not adopt them as permanent tokens.
- Content (L4) colors appear inside product imagery and are NOT part of the design system. Excluded from this document.
- Permanent chromatic colors at frequency < 5 may be decorative. Verify intent before adopting them as system tokens.

### Current Campaign Colors

> Extracted 2026-05-18. These colors are campaign-level (L3) and will change with the next product launch.

| Hex | Frequency | Used as | CSS Variable |
|-----|-----------|---------|--------------|
| `#102620` | 6 | bg 6 | — |
| `#f4f4f5` | 6 | bg 6 | — |
| `#f4c2ff` | 8 | gradient 8 | — |
| `#c6adff` | 8 | gradient 8 | — |
| `#244749` | 8 | gradient 8 | — |
| `#157076` | 8 | gradient 8 | — |
| `#ffd8b7` | 6 | gradient 6 | — |
| `#a0cbff` | 6 | gradient 6 | — |
| `#d4d4d8` | 1 | shadow 1 | — |
| `#1c004f` | 1 | icon 1 | — |

## 2.5. Dark Mode System

### Detection Method

**Trigger:** `media-query`

### Color Mapping Table

_No CSS variable differences captured. The site likely uses JavaScript-based theming (className swap with hard-coded values) rather than CSS variables. Manual review required for full dark-mode documentation._

## 3. Typography Rules

### Font Families

- `NeueHaasGrotesk`
- `Inter-Variable`
- `ui-monospace`

### Hierarchy

| Role | Font | Size | Weight | Line Height | Letter Spacing | OpenType | Frequency | Typical Tags |
|------|------|------|--------|-------------|----------------|----------|-----------|--------------|
| Display XXL | `NeueHaasGrotesk` | `96px` | `400` | `96px` | `normal` | `"ss03"` | 27 | h1, div, span |
| Display XXL | `NeueHaasGrotesk` | `96px` | `330` | `92px` | `normal` | `"ss03"` | 2 | p |
| Display XXL | `Inter-Variable` | `96px` | `300` | `103.68px` | `-2.4px` | `"ss03"` | 114 | p, span |
| Display XXL | `NeueHaasGrotesk` | `70px` | `330` | `70px` | `normal` | `"ss03"` | 1 | h2 |
| Display XXL | `Inter-Variable` | `64px` | `330` | `69.12px` | `-1.28px` | `"ss03"` | 1 | h1 |
| Display XXL | `Inter-Variable` | `56px` | `330` | `60.48px` | `-0.56px` | `"ss03"` | 1 | h2 |
| Display XL | `NeueHaasGrotesk` | `55px` | `330` | `64px` | `normal` | `"ss03"` | 13 | div, span, h2, h3 |
| Display XL | `NeueHaasGrotesk` | `48px` | `330` | `54.72px` | `normal` | `"ss03"` | 7 | h3, p, span |
| Display MD | `Inter-Variable` | `34px` | `330` | `38.76px` | `normal` | `"ss03"` | 2 | blockquote, h2 |
| Display MD | `NeueHaasGrotesk` | `28px` | `500` | `35.84px` | `0.42px` | `"ss03"` | 3 | span |
| Body LG | `NeueHaasGrotesk` | `24px` | `400` | `27.36px` | `0.36px` | `"ss03"` | 1 | p |
| Heading LG | `Inter-Variable` | `24px` | `400` | `31.2px` | `-0.24px` | `"ss03"` | 34 | h2, thead, tr, th |
| Body LG | `Inter-Variable` | `24px` | `600` | `20px` | `-0.6px` | `"ss03"` | 1 | div |
| Body LG | `Inter-Variable` | `24px` | `700` | `31.2px` | `-0.24px` | `"ss03"` | 8 | th, div |
| Heading MD | `NeueHaasGrotesk` | `20px` | `400` | `28px` | `0.3px` | `"ss03"` | 10 | h4, h3, span |
| Body LG | `NeueHaasGrotesk` | `20px` | `500` | `28px` | `0.3px` | `"ss03"` | 6 | p, a |
| Heading MD | `Inter-Variable` | `20px` | `450` | `26px` | `normal` | `"ss03"` | 24 | h3, div, p, span |
| Body LG | `Inter-Variable` | `20px` | `400` | `28px` | `normal` | `"ss03"` | 2 | div |
| Body LG | `Inter-Variable` | `18px` | `550` | `28px` | `normal` | `"ss03"` | 6 | a, button, span |
| Body LG | `NeueHaasGrotesk` | `18px` | `500` | `22.56px` | `0.72px` | `"ss03"` | 24 | p, a, span |
| Body LG | `NeueHaasGrotesk` | `18px` | `600` | `22.56px` | `0.72px` | `"ss03"` | 3 | strong |
| Body LG | `Inter-Variable` | `18px` | `600` | `25.2px` | `-0.45px` | `"ss03"` | 2 | p |
| Body LG | `Inter-Variable` | `18px` | `400` | `25.2px` | `normal` | `"ss03"` | 3 | p, div |
| Body MD | `Inter-Variable` | `16px` | `400` | `24px` | `normal` | `"ss03"` | 525 | html, header, div, nav |
| Body MD | `NeueHaasGrotesk` | `16px` | `400` | `24px` | `normal` | `"ss03"` | 172 | body, div, main, section |
| Body MD | `Inter-Variable` | `16px` | `550` | `24px` | `normal` | `"ss03"` | 14 | a |
| Body MD | `Inter-Variable` | `16px` | `420` | `24px` | `normal` | `"ss03"` | 4 | span |
| Overline | `ui-monospace` | `16px` | `400` | `24px` | `normal` | `"ss03"` | 2 | div |
| Body MD | `Inter-Variable` | `16px` | `700` | `24px` | `normal` | `"ss03"` | 64 | th |
| Body MD | `Inter-Variable` | `16px` | `450` | `22.4px` | `normal` | `"ss03"` | 67 | span |
| Body SM | `Inter-Variable` | `14px` | `400` | `20px` | `normal` | `"ss03"` | 266 | div, li, a, p |
| Body SM | `NeueHaasGrotesk` | `14px` | `500` | `20.8px` | `0.28px` | `"ss03"` | 25 | div, span |
| Body SM | `NeueHaasGrotesk` | `14px` | `550` | `20.8px` | `0.28px` | `"ss03"` | 6 | span |
| Body SM | `Inter-Variable` | `14px` | `420` | `18.2px` | `normal` | `"ss03"` | 23 | p, h3, li, td |
| Body SM | `Inter-Variable` | `14px` | `600` | `18.2px` | `normal` | `"ss03"` | 1 | p |
| Overline | `Inter-Variable` | `12px` | `400` | `14.4px` | `0.72px` | `"ss03"` | 10 | p |
| Overline | `ui-monospace` | `12px` | `400` | `16px` | `normal` | `"ss03"` | 2 | p |
| Caption | `Inter-Variable` | `12px` | `450` | `16px` | `normal` | `"ss03"` | 7 | small, span |
| Overline | `Inter-Variable` | `12px` | `550` | `12px` | `normal` | `"ss03"` | 1 | p |
| Caption | `Inter-Variable` | `11px` | `420` | `18.2px` | `normal` | `"ss03"` | 1 | small |

## 4. Component Stylings

_Partial template: extracted variant styles are documented below, but the "Use:" lines and state-change rationale are subjective and best filled in by an AI agent. See `prompts/universal.md` for the agent-written version._

### Link

#### Default

- **Count:** 183
- **Style:**
  - `backgroundColor`: `rgba(0, 0, 0, 0)`
  - `color`: `rgb(255, 255, 255)`
  - `fontSize`: `14px`
  - `fontWeight`: `400`
  - `borderRadius`: `0px`
  - `padding`: `0px 0px 0px 0px`
- **On focus-visible:** 2 property change(s).
- **Transition:** `all`

### Button

#### Ghost sm

- **Count:** 6
- **Style:**
  - `backgroundColor`: `rgba(0, 0, 0, 0)`
  - `color`: `rgb(255, 255, 255)`
  - `fontSize`: `14px`
  - `fontWeight`: `400`
  - `borderRadius`: `0px`
  - `padding`: `0px 0px 0px 24px`
- **Transition:** `all`

#### Ghost md

- **Count:** 9
- **Style:**
  - `backgroundColor`: `rgba(0, 0, 0, 0)`
  - `color`: `rgb(255, 255, 255)`
  - `fontSize`: `16px`
  - `fontWeight`: `400`
  - `borderRadius`: `0px`
  - `padding`: `0px 0px 0px 0px`
- **Transition:** `all`

#### Secondary sm

- **Count:** 4
- **Style:**
  - `backgroundColor`: `rgb(255, 255, 255)`
  - `color`: `rgb(0, 0, 0)`
  - `fontSize`: `16px`
  - `fontWeight`: `550`
  - `borderRadius`: `9999px`
  - `padding`: `8px 20px 8px 20px`
  - `borderWidth`: `2px`
  - `borderColor`: `rgba(0, 0, 0, 0)`
  - `borderStyle`: `solid`
- **On focus-visible:** 2 property change(s).
- **Transition:** `transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), translate 0.3s cubic-bezier(0.4, 0, 0.2, 1), scale 0.3s cubic-bezier(0.4, 0, 0.2, 1), rotate 0.3s cubic-bezier(0.4, 0, 0.2, 1)`

#### Secondary md

- **Count:** 2
- **Style:**
  - `backgroundColor`: `rgb(255, 255, 255)`
  - `color`: `rgb(0, 0, 0)`
  - `fontSize`: `18px`
  - `fontWeight`: `550`
  - `borderRadius`: `9999px`
  - `padding`: `12px 24px 12px 24px`
  - `borderWidth`: `2px`
  - `borderColor`: `rgba(0, 0, 0, 0)`
  - `borderStyle`: `solid`
- **On focus-visible:** 2 property change(s).
- **Transition:** `0.15s cubic-bezier(0.4, 0, 0.2, 1)`

#### Tertiary

- **Count:** 3
- **Style:**
  - `backgroundColor`: `oklab(0.999994 0.0000455678 0.0000200868 / 0.2)`
  - `color`: `rgb(255, 255, 255)`
  - `fontSize`: `16px`
  - `fontWeight`: `400`
  - `borderRadius`: `4px`
  - `padding`: `12px 16px 12px 16px`
  - `boxShadow`: `rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(255, 255, 255, 0.05) 0px 1px 2px 0px, rgba(255, 255, 255, 0.04) 0px 1px 0px 0px inset`
- **Transition:** `all`

#### Outline

- **Count:** 1
- **Style:**
  - `backgroundColor`: `rgba(0, 0, 0, 0)`
  - `color`: `rgb(255, 255, 255)`
  - `fontSize`: `18px`
  - `fontWeight`: `550`
  - `borderRadius`: `9999px`
  - `padding`: `12px 26px 12px 16px`
  - `borderWidth`: `2px`
  - `borderColor`: `rgb(255, 255, 255)`
  - `borderStyle`: `solid`
- **Transition:** `0.15s cubic-bezier(0.4, 0, 0.2, 1)`

#### Variant-1

- **Count:** 1
- **Style:**
  - `backgroundColor`: `rgb(0, 0, 0)`
  - `color`: `rgb(255, 255, 255)`
  - `fontSize`: `18px`
  - `fontWeight`: `550`
  - `borderRadius`: `9999px`
  - `padding`: `12px 24px 12px 24px`
  - `borderWidth`: `2px`
  - `borderColor`: `rgba(0, 0, 0, 0)`
  - `borderStyle`: `solid`
- **Transition:** `0.15s cubic-bezier(0.4, 0, 0.2, 1)`

#### Ghost

- **Count:** 2
- **Style:**
  - `backgroundColor`: `rgba(0, 0, 0, 0)`
  - `color`: `rgb(224, 224, 224)`
  - `fontSize`: `16px`
  - `fontWeight`: `400`
  - `borderRadius`: `0px`
  - `padding`: `0px 0px 0px 0px`
- **Transition:** `all`

#### Variant-2

- **Count:** 1
- **Style:**
  - `backgroundColor`: `rgb(20, 26, 26)`
  - `color`: `rgb(255, 255, 255)`
  - `fontSize`: `16px`
  - `fontWeight`: `400`
  - `borderRadius`: `8px`
  - `padding`: `4px 4px 4px 4px`
  - `borderWidth`: `1px`
  - `borderColor`: `rgba(255, 255, 255, 0.1)`
  - `borderStyle`: `solid`
- **On focus-visible:** 1 property change(s).
- **Transition:** `background 0.2s`

### Footer

#### Default

- **Count:** 8
- **Style:**
  - `backgroundColor`: `rgb(0, 0, 0)`
  - `color`: `rgb(161, 161, 170)`
  - `fontSize`: `16px`
  - `fontWeight`: `400`
  - `borderRadius`: `0px`
  - `padding`: `80px 90px 80px 90px`
- **Transition:** `all`

### Navigation

#### Default

- **Count:** 7
- **Style:**
  - `backgroundColor`: `rgb(2, 9, 10)`
  - `color`: `rgb(0, 0, 0)`
  - `fontSize`: `16px`
  - `fontWeight`: `400`
  - `borderRadius`: `0px`
  - `padding`: `0px 0px 128px 0px`
- **Transition:** `all`

### Card

#### Filled

- **Count:** 4
- **Style:**
  - `backgroundColor`: `rgb(0, 0, 0)`
  - `color`: `rgb(255, 255, 255)`
  - `fontSize`: `16px`
  - `fontWeight`: `400`
  - `borderRadius`: `24px`
  - `padding`: `32px 32px 32px 32px`
- **Transition:** `all`

#### Outlined

- **Count:** 2
- **Style:**
  - `backgroundColor`: `rgba(255, 255, 255, 0.1)`
  - `color`: `rgb(255, 255, 255)`
  - `fontSize`: `16px`
  - `fontWeight`: `400`
  - `borderRadius`: `20px 0px 0px`
  - `padding`: `13px 13px 13px 13px`
  - `borderWidth`: `1px`
  - `borderColor`: `rgba(255, 255, 255, 0.1)`
  - `borderStyle`: `solid`
- **Transition:** `all`

### Input

#### Default

- **Count:** 1
- **Style:**
  - `backgroundColor`: `rgba(0, 0, 0, 0)`
  - `color`: `rgb(0, 0, 0)`
  - `fontSize`: `16px`
  - `fontWeight`: `400`
  - `borderRadius`: `0px`
  - `padding`: `24px 24px 8px 24px`
- **Transition:** `all`

## 5. Layout Principles

### Spacing System

- **Base unit:** `4px`
- **Scale:** `4px`, `8px`, `12px`, `16px`, `20px`, `24px`, `28px`, `32px`, `40px`, `48px`, `56px`, `64px`, `68px`, `72px`, `80px`, `100px`, `104px`, `128px`
- **Section spacing:** `48px`, `56px`, `64px`, `68px`, `71px`, `80px`, `90px`, `97px`, `100px`, `128px`, `131px`, `210px`, `374px`, `476px`
- **Max content width:** `100%`

### Grid & Container

- **Common column counts:** 1, 2, 3, 4, 5, 12, 13
- **Content alignment:** full-width
- **Max content width:** `100%`

### Border Radius Scale

| Value | Frequency | Typical Elements |
|-------|-----------|------------------|
| `12px` | 29 | picture, div |
| `3.35544e+07px` | 25 | span, div, a |
| `9999px` | 20 | a, button, div |
| `24px` | 19 | div, img |
| `4px` | 16 | div, a, p |
| `8px` | 10 | video, div, button |
| `340px` | 6 | div |
| `48px 48px 0px 0px` | 6 | section |
| `20px 20px 0px 0px` | 6 | div, span |
| `16px` | 5 | div, img |
| `5px` | 3 | div |
| `0px 0px 12px 12px` | 3 | div |
| `100%` | 3 | div |
| `12px 12px 0px 0px` | 2 | div |
| `20px 0px 0px` | 2 | div, span |
| `0px 0px 8px 8px` | 1 | img |
| `12px 0px 0px` | 1 | div |
| `6px` | 1 | span |

## 6. Depth & Elevation

### Shadow Scale

| Type | Value | Frequency | Typical Elements |
|------|-------|-----------|------------------|
| complex-stack | `rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(255, 255, 255, 0.08) 0px 0px 0px 1px, rgba(0, 0, 0, 0.3) 0px 1px 3px 0px, rgba(0, 0, 0, 0.2) 0px 5px 10px 0px` | 3 | div |
| complex-stack | `rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.1) 0px 8px 8px 0px, rgba(0, 0, 0, 0.1) 0px 4px 4px 0px, rgba(0, 0, 0, 0.1) 0px 2px 2px 0px, rgba(0, 0, 0, 0.1) 0px 0px 0px 1px, rgba(255, 255, 255, 0.03) 0px 1px 0px 0px inset` | 7 | div |
| complex-stack | `rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(255, 255, 255, 0.03) 0px 0.929px 0px 0px inset, rgba(0, 0, 0, 0.1) 0px 0px 0px 0.929px, rgba(0, 0, 0, 0.1) 0px 1.858px 1.858px 0px, rgba(0, 0, 0, 0.1) 0px 3.717px 3.717px 0px` | 6 | div |
| complex-stack | `rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.25) 0px 25px 50px -12px` | 1 | div |
| complex-stack | `rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.3) 0px 1.5px 9px 0px` | 1 | span |
| complex-stack | `rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(64, 71, 77, 0.4) 0px 1px 0px 0px inset, rgba(255, 255, 255, 0.08) 0px 1px 0px 0px` | 1 | div |
| complex-stack | `rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgb(7, 13, 23) 0px 16px 24px 0px` | 1 | a |
| complex-stack | `rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(255, 255, 255, 0.05) 0px 1px 2px 0px, rgba(255, 255, 255, 0.04) 0px 1px 0px 0px inset` | 3 | a |
| complex-stack | `rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(7, 13, 23, 0.1) 0px 16px 24px 0px` | 1 | a |
| elevation | `rgba(0, 0, 0, 0.1) 0px 1px 0px 0px` | 1 | thead |
| complex-stack | `rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgb(212, 212, 216) 0px 0px 0px 1px inset, rgba(0, 0, 0, 0) 0px 0px 0px 0px` | 1 | div |

## 6.5. Motion System

### Duration Scale

| Label | Value | Frequency |
|-------|-------|-----------|
| small | `120ms` | 1 |
| medium | `300ms` | 7 |
| large | `400ms` | 1 |
| xl | `9999000ms` | 10 |

### Easing

- **Primary:** `var(--tw-ease,var(--default-transition-timing-function))`
- **Other observed:**
  - `var(--tw-ease,var(--default-transition-timing-function))` (frequency 25)
  - `ease` (frequency 13)
  - `ease-in-out` (frequency 3)
  - `cubic-bezier(.66` (frequency 1)
  - `ease-in` (frequency 1)
  - `ease-out` (frequency 1)

### Keyframe Animations

| Name | Type | Duration | Properties |
|------|------|----------|------------|
| `pulse` | generic | `1.7s` | opacity |
| `loop` | generic | `8s` | offset-distance |
| `draw` | generic | `.3s` | stroke-dashoffset |
| `logo-group-marquee` | generic | `60s` | transform |
| `logo-group-marquee-reverse` | generic | `60s` | transform |
| `fade-in` | entrance | `0s` | opacity |
| `shimmer` | generic | `0s` | background-position |
| `scroll-x` | generic | `240s` | transform |

### Reduced Motion

- **Supported:** yes (CSS query observed)

## 7. Content & Voice

_Skipped by the deterministic emitter  Content & Voice requires reading microcopy and inferring brand voice, which no extraction can do reliably._

For a complete, agent-written Content & Voice section, paste `prompts/universal.md` into an AI agent.

## 8. Do's and Don'ts

_Skipped by the deterministic emitter  Do's and Don'ts are brand-specific judgement calls._

For a complete, agent-written Do's and Don'ts section, paste `prompts/universal.md` into an AI agent.

## 9. Accessibility Contract

### WCAG Target

- **Default:** WCAG 2.2 AA (4.5:1 normal text, 3:1 large text)

### Contrast Pairs

| Foreground | Background | Ratio | AA | AAA | Usage |
|------------|------------|-------|----|-----|-------|
| `rgb(255, 255, 255)` | `rgba(0, 0, 0, 0)` | 21.00:1 | ✓ | ✓ | 1206 |
| `rgb(0, 0, 0)` | `rgba(0, 0, 0, 0)` | 1.00:1 | ✗ | ✗ | 873 |
| `rgb(161, 161, 170)` | `rgba(0, 0, 0, 0)` | 8.19:1 | ✓ | ✓ | 144 |
| `rgb(0, 0, 0)` | `rgb(255, 255, 255)` | 21.00:1 | ✓ | ✓ | 18 |
| `rgb(54, 244, 164)` | `rgba(0, 0, 0, 0)` | 14.63:1 | ✓ | ✓ | 17 |
| `rgb(255, 255, 255)` | `rgb(2, 9, 10)` | 20.08:1 | ✓ | ✓ | 14 |
| `rgb(151, 151, 162)` | `rgba(0, 0, 0, 0)` | 7.26:1 | ✓ | ✓ | 11 |
| `rgb(255, 255, 255)` | `rgb(6, 26, 28)` | 17.91:1 | ✓ | ✓ | 10 |
| `rgb(157, 171, 173)` | `rgba(0, 0, 0, 0)` | 8.86:1 | ✓ | ✓ | 10 |
| `rgb(224, 224, 224)` | `rgba(0, 0, 0, 0)` | 15.91:1 | ✓ | ✓ | 10 |
| `rgb(255, 255, 255)` | `rgb(255, 255, 255)` | 1.00:1 | ✗ | ✗ | 8 |
| `rgb(255, 255, 255)` | `rgb(20, 26, 26)` | 17.61:1 | ✓ | ✓ | 8 |

### Focus Indicator

- **Consistent across components:** no
  - `outline`: `rgb(117, 27, 233) solid 3px`
  - `outlineOffset`: `2px`

### Touch / Click Target

- **Minimum observed:** `33×20px`


## 10. Responsive Behavior

### Breakpoints

| Type | Value | Rules |
|------|-------|-------|
| other | `(width>=900px)` | 557 |
| other | `(width>=640px)` | 409 |
| other | `(width>=1200px)` | 541 |
| other | `(width>=1600px)` | 93 |
| prefers-reduced-motion | `reduce` | 67 |
| other | `screen and (width<=499px)` | 1 |
| other | `screen and (width>=500px) and (width<=899px)` | 1 |
| other | `screen and (width>=900px)` | 7 |
| other | `screen and (width>=430px) and (width<=499px)` | 1 |
| other | `screen and (width>=500px) and (width<=639px)` | 1 |
| other | `screen and (width>=640px) and (width<=759px)` | 2 |
| other | `screen and (width>=760px) and (width<=899px)` | 2 |
| other | `screen and (width>=900px) and (width<=1039px)` | 2 |
| other | `screen and (width>=1040px) and (width<=1199px)` | 2 |
| other | `screen and (width>=1200px) and (width<=1439px)` | 1 |
| other | `screen and (width>=1440px) and (width<=1599px)` | 1 |

## 11. State Matrix

| Component / Variant | default | hover | focus-visible | active | disabled |
|---------------------|---------|-------|---------------|--------|----------|
| Link · Default | ✓ |  | ✓ |  |  |
| Button · Ghost sm | ✓ |  |  |  |  |
| Button · Ghost md | ✓ |  |  |  |  |
| Button · Secondary sm | ✓ |  | ✓ |  |  |
| Button · Secondary md | ✓ |  | ✓ |  |  |
| Button · Tertiary | ✓ |  |  |  |  |
| Button · Outline | ✓ |  |  |  |  |
| Button · Variant-1 | ✓ |  |  |  |  |
| Button · Ghost | ✓ |  |  |  |  |
| Button · Variant-2 | ✓ |  | ✓ |  |  |
| Footer · Default | ✓ |  |  |  |  |
| Navigation · Default | ✓ |  |  |  |  |
| Card · Filled | ✓ |  |  |  |  |
| Card · Outlined | ✓ |  |  |  |  |
| Input · Default | ✓ |  |  |  |  |

## 12. Iconography

- **Library:** custom / unknown
- **Total icons observed:** 178
- **Color mode:** mixed
- **Sizes observed:** `0px`, `14px`, `20px`

## 13. Agent Prompt Guide

Quick reference for an AI coding agent generating UI from this design system.

### Quick Color Reference

- **Hairline**: `#e5e7eb`
- **Canvas**: `#ffffff`
- **Ink**: `#000000`
- **Muted**: `#71717a`
- **Primary**: `#36f4a4`
- **Accent**: `#95bf47`
- **Brand Dark**: `#11352d`
- **Canvas Alt**: `#f4f4f5`
- **Info**: `#1260ff`

### Self-Containment Checklist

When asking an AI to produce a component using this system, the prompt MUST inline:

- [ ] Font family, size, weight, line-height, letter-spacing
- [ ] All colors as 6-digit lowercase hex
- [ ] Padding, border-radius, shadow values
- [ ] OpenType features when the system uses them
- [ ] Hover, focus-visible, active values where the variant has them
- [ ] Transition value

### Where to go for the full premium guide

For agent-written prose covering Sections 0, 1, 4 (rationale), 7, 8, and the iteration guide, paste `prompts/universal.md` into Claude Code / Claude.ai / ChatGPT / Cursor / Codex / Windsurf / Lovable / Replit Agent.


<!-- Generated: 2026-05-18 | Source: https://shopify.com/ | Pages: 2 | Framework: Tailwind | Format: v2 -->
<!-- This is not the official design system. Colors, fonts, and spacing may not be 100% accurate. -->
<!-- Sections 0, 1, 7, 8 are skipped in the deterministic emitter  they require -->
<!-- brand judgement. Paste prompts/universal.md into an AI agent for full coverage. -->
