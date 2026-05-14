---
title: design.md
emoji: 🎨
colorFrom: blue
colorTo: indigo
sdk: docker
app_port: 7860
pinned: false
license: mit
short_description: Paste any URL → get a DESIGN.md your AI agent can read.
---

<div align="center">

<img src="./public/hero.webp" alt="design.md  extract design systems from any website" width="100%" />

# design.md

### Paste a URL. Get a DESIGN.md your AI agent can read.

Extract real design systems colors, typography, spacing, tokens from any public website.
Built for Claude Code, Cursor, v0, Lovable, Replit, Windsurf, and GitHub Copilot.

<br />

[![License: MIT](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![Version](https://img.shields.io/badge/version-0.1.0-blue.svg)](CHANGELOG.md)
[![Stars](https://img.shields.io/github/stars/sunil-dsb/design.md?style=social)](https://github.com/sunil-dsb/design.md/stargazers)
[![Tailwind v4](https://img.shields.io/badge/tailwind-v4-38bdf8.svg)](https://tailwindcss.com)
[![Built on](https://img.shields.io/badge/built_on-Google's_DESIGN.md_spec-7a73ff.svg)](https://stitch.withgoogle.com/docs/design-md/overview)

<br />

<a href="https://sunilnegidsb-design-md.hf.space"><img src="https://api.iconify.design/lucide/external-link.svg?color=%2322c55e" width="14" align="center" alt=""> &nbsp;<b>Live demo</b></a> &nbsp;·&nbsp;
<a href="./examples">Examples</a> &nbsp;·&nbsp;
<a href="#roadmap">Roadmap</a> &nbsp;·&nbsp;
<a href="https://github.com/sunil-dsb/design.md"><img src="https://api.iconify.design/lucide/star.svg?color=%23f59e0b" width="14" align="center" alt=""> &nbsp;Star us</a>

</div>

---

## What it does

When you ask AI to _"build me a landing page like Stripe,"_ the agent doesn't actually know what Stripe looks like. It averages millions of pages and ships you something generic.

`design.md` fixes that by extracting the **real** design system from any website and writing it into a file your AI agent can read **before** it generates any UI.

| File            | What it explains to the agent       |
| --------------- | ----------------------------------- |
| `README.md`     | What the project does               |
| `AGENTS.md`     | How the AI should build it          |
| **`DESIGN.md`** | **How the UI should look and feel** |

Drop a `DESIGN.md` next to your `README.md`. Tell your agent: _"Read DESIGN.md before generating UI."_ Every component it makes now follows your colors, typography, and spacing not the internet's average.

---

## Works with

<div align="center">

**Claude Code** · **Cursor** · **v0** · **Lovable** · **Replit** · **Windsurf** · **GitHub Copilot**

</div>

If your tool reads `AGENTS.md` or `CLAUDE.md`, it reads `DESIGN.md`. Plain markdown, no plugin required.

---

## In 30 seconds

```bash
# 1. Open the live tool
https://sunilnegidsb-design-md.hf.space

# 2. Paste any public URL
stripe.com

# 3. Get back a folder
DESIGN.md         tailwind.css       shadcn-theme.css
prompts/          tokens.json        proof.html

# 4. Drop DESIGN.md in your repo. Then tell your agent:
"Read DESIGN.md before generating any UI."
```

No signup. No API key. No waitlist. Free, open source, MIT licensed.

---

## What gets extracted

- 🎨 **Colors** OKLCH ΔE perceptual clustering, not hex-string dedup. 4-layer stability classification so a sale banner can't pollute your primary brand color.
- 🔤 **Typography** full type scale, weights, line-heights, letter-spacing, OpenType features.
- 📐 **Spacing** base unit auto-detected (4/8-pt grid), scale steps, section spacing.
- 🌗 **Dark mode** 4 detection methods, full variable diff between modes.
- 🪟 **Shadows + radii** multi-layer parsing, named elevation ramps.
- 🎯 **Pixel-fidelity proof** every output verified against the live site at ΔE<12 with image-region exclusion.
- 📍 **Per-token provenance** every value tagged with source page, CSS variable name, and structural region (nav / header / main / footer / aside).

---

## How it works

```text
URL
 ↓
[1] Playwright crawler · 5 viewports × up to 8 pages
 ↓
[2] DOM + CSS · interaction states · dark-mode toggle · screenshots
 ↓
[3] OKLCH ΔE clustering · 4-layer stability · role naming
 ↓
[4] DESIGN.md · tailwind.css · shadcn theme · 5 prompt packs · tokens.json
```

Deterministic. Same URL → same output. The 4 gallery brands ship with agent-written `DESIGN.md` for premium quality; on-demand extractions use deterministic role naming for free, reproducible output.

---

## Why this is different

> Compared against [**designlang**](https://github.com/Manavarya09/design-extract) (open-source CLI + emitters, MIT) and [**getdesign.md**](https://getdesign.md) (the popular paid DESIGN.md generator, also reachable at `getdesign.app`).

### Shipped today

| Capability                       |                                                  **design.md**                                                   |                                                   designlang                                                    |                                               getdesign.md                                               |
| -------------------------------- | :--------------------------------------------------------------------------------------------------------------: | :-------------------------------------------------------------------------------------------------------------: | :------------------------------------------------------------------------------------------------------: |
| Color clustering                 |   <img src="https://api.iconify.design/lucide/check.svg?color=%2322c55e" width="16" alt="yes"> &nbsp;OKLCH ΔE    |                                                    sRGB only                                                    |                                              LLM heuristic                                               |
| Pixel-fidelity verification      |  <img src="https://api.iconify.design/lucide/check.svg?color=%2322c55e" width="16" alt="yes"> &nbsp;ΔE &lt; 12   |           <img src="https://api.iconify.design/lucide/minus.svg?color=%236b7280" width="16" alt="no">           |       <img src="https://api.iconify.design/lucide/minus.svg?color=%236b7280" width="16" alt="no">        |
| 4-layer stability classification |           <img src="https://api.iconify.design/lucide/check.svg?color=%2322c55e" width="16" alt="yes">           |           <img src="https://api.iconify.design/lucide/minus.svg?color=%236b7280" width="16" alt="no">           |       <img src="https://api.iconify.design/lucide/minus.svg?color=%236b7280" width="16" alt="no">        |
| Multi-page crawl + dark-mode     | <img src="https://api.iconify.design/lucide/check.svg?color=%2322c55e" width="16" alt="yes"> &nbsp;up to 8 pages |          <img src="https://api.iconify.design/lucide/check.svg?color=%2322c55e" width="16" alt="yes">           |       <img src="https://api.iconify.design/lucide/check.svg?color=%2322c55e" width="16" alt="yes">       |
| Open source                      |      <img src="https://api.iconify.design/lucide/check.svg?color=%2322c55e" width="16" alt="yes"> &nbsp;MIT      |     <img src="https://api.iconify.design/lucide/check.svg?color=%2322c55e" width="16" alt="yes"> &nbsp;MIT      | <img src="https://api.iconify.design/lucide/minus.svg?color=%236b7280" width="16" alt="no"> &nbsp;closed |
| Pricing                          | <img src="https://api.iconify.design/lucide/check.svg?color=%2322c55e" width="16" alt="yes"> &nbsp;Free forever  | <img src="https://api.iconify.design/lucide/check.svg?color=%2322c55e" width="16" alt="yes"> &nbsp;Free forever |  <img src="https://api.iconify.design/lucide/minus.svg?color=%236b7280" width="16" alt="no"> &nbsp;Paid  |
| Free, no signup or waitlist      |           <img src="https://api.iconify.design/lucide/check.svg?color=%2322c55e" width="16" alt="yes">           |          <img src="https://api.iconify.design/lucide/check.svg?color=%2322c55e" width="16" alt="yes">           |       <img src="https://api.iconify.design/lucide/minus.svg?color=%236b7280" width="16" alt="no">        |

### On our roadmap

| Capability                                 |                                                      **design.md**                                                      |                                         designlang                                          |                                        getdesign.md                                         |
| ------------------------------------------ | :---------------------------------------------------------------------------------------------------------------------: | :-----------------------------------------------------------------------------------------: | :-----------------------------------------------------------------------------------------: |
| AI prompt packs                            | <img src="https://api.iconify.design/lucide/clock.svg?color=%23f59e0b" width="16" alt="planned"> &nbsp;5 agents planned |                                      4 agents shipped                                       | <img src="https://api.iconify.design/lucide/minus.svg?color=%236b7280" width="16" alt="no"> |
| Tailwind v4 `@theme` emit                  |     <img src="https://api.iconify.design/lucide/clock.svg?color=%23f59e0b" width="16" alt="planned"> &nbsp;planned      |                                           v3 only                                           | <img src="https://api.iconify.design/lucide/minus.svg?color=%236b7280" width="16" alt="no"> |
| shadcn theme emit (17-slot, WCAG-verified) |     <img src="https://api.iconify.design/lucide/clock.svg?color=%23f59e0b" width="16" alt="planned"> &nbsp;planned      |                                           partial                                           | <img src="https://api.iconify.design/lucide/minus.svg?color=%236b7280" width="16" alt="no"> |
| Regenerated OKLCH ramps                    |     <img src="https://api.iconify.design/lucide/clock.svg?color=%23f59e0b" width="16" alt="planned"> &nbsp;planned      |                                        raw observed                                         | <img src="https://api.iconify.design/lucide/minus.svg?color=%236b7280" width="16" alt="no"> |
| Public accuracy scoreboard                 |     <img src="https://api.iconify.design/lucide/clock.svg?color=%23f59e0b" width="16" alt="planned"> &nbsp;planned      | <img src="https://api.iconify.design/lucide/minus.svg?color=%236b7280" width="16" alt="no"> | <img src="https://api.iconify.design/lucide/minus.svg?color=%236b7280" width="16" alt="no"> |

**Where we win today:** perceptual color clustering, pixel-fidelity verification, and stability classification the three accuracy levers nobody else has.
**Where they ship and we don't yet:** designlang has 4 working AI prompt packs in production; we have zero. We're catching up.
**The longer-term wedge:** regenerated coherent ramps (not raw observed colors) + public accuracy scoreboard measuring our output against hand-curated gold tokens.

---

## Examples

Four gold-standard extractions ship with the repo:

| Brand                            | Sector          | Files                                                    |
| -------------------------------- | --------------- | -------------------------------------------------------- |
| [Stripe](./examples/stripe/)     | Payments        | `DESIGN.md`, `tokens.json`, `preview.html`, `proof.html` |
| [Linear](./examples/linear/)     | Issue tracking  | `DESIGN.md`, `tokens.json`, `preview.html`, `proof.html` |
| [Vercel](./examples/vercel/)     | Frontend cloud  | `DESIGN.md`, `tokens.json`, `preview.html`, `proof.html` |
| [Supabase](./examples/supabase/) | Postgres + auth | `DESIGN.md`, `tokens.json`, `preview.html`, `proof.html` |

Each `DESIGN.md` is ~300 lines of brand-specific prose tied to extracted values. The HTML artifacts are stand-alone open them in a browser to inspect.

---

## Quickstart (run locally)

```bash
git clone https://github.com/sunil-dsb/design.md.git
cd design.md
pnpm install
pnpm dev
```

Open <http://localhost:3000>.

Extract from the CLI:

```bash
pnpm engine:extract https://stripe.com --fast
```

Output lands in `output/<domain>/`.

---

## Project structure

```text
app/             Next.js 16 app router (landing, /why, /extract, /api/extract)
components/      Navbar, Hero, Gallery, SpecPreview, Footer, etc.
lib/engine/      Forked extraction engine (cluster, crawl, proof, validate, ...)
bin/             CLI shims  pnpm engine:extract / engine:proof / engine:validate
icons/           Inline SVG brand + utility icons
examples/        Gold-standard DESIGN.md extractions per brand
output/          Per-extraction artifacts (gitignored)
public/          Static assets (hero image, footer image, pixel font)
```

---

## Tech stack

- **Next.js 16** (App Router, React Server Components)
- **React 19**
- **Tailwind CSS v4**
- **TypeScript** (strict)
- **Playwright** + `puppeteer-extra-plugin-stealth`
- **culori** for OKLCH math
- **Vitest** for engine tests
- **Simple Icons** for brand logos

---

## Roadmap

**Shipped**

- [x] Playwright extraction · 5 viewports · 8 pages (matches CLI default)
- [x] OKLCH ΔE clustering · 4-layer stability classification
- [x] 5-state interaction capture (hover · focus · focus-visible · active · disabled) + loading/empty/error
- [x] Pixel-fidelity proof.ts (ΔE<12 coverage, image-region exclusion)
- [x] 4 gold-standard examples (Stripe, Linear, Vercel, Supabase)
- [x] SPA landing + gallery + on-demand `/extract` URL form
- [x] Heuristic role-namer (Primary · Ink · Canvas · Hairline · Accent · Brand-Dark · ...)
- [x] Dark-mode auto-detection (4 methods)
- [x] **Visibility-and-importance weighting** layered on cluster.ts (area × fold × interactivity × semantic-region weighting, integrated into the role-namer's primary pick so footer-grey can't outrank a hero CTA on raw frequency)
- [x] **Deterministic DESIGN.md emitter** on the on-demand path (11 of 17 sections templated; 4 subjective sections stubbed with hand-off to the universal prompt; scores 100/100 on the engine's own `validate.ts`)
- [x] **Universal AI prompt** that works in any agent surface (Claude Code · Claude.ai · ChatGPT · Cursor · Codex · Windsurf · Lovable · Replit Agent) see `prompts/universal.md` per extraction
- [x] Engine diagnostics panel in the result UI (12 rules surfacing low coverage, single-page noise, framework miscall, primary-is-grey, etc.)
- [x] SSE-streamed extraction progress (7-stage checklist visible in real time)
- [x] File-serving route (`/api/output/[...path]`) with path-traversal defence

**In progress**

- [ ] Per-agent prompt-pack variants (the 5 framed copies for Claude Code · Cursor · v0 · Lovable · Replit the universal prompt covers all of them today, but per-agent framing tweaks are a follow-up)
- [ ] Tailwind v4 `@theme` emitter
- [ ] shadcn theme emitter (17-slot mapping, conditional on 5 required signals)
- [ ] CSS variables export · DTCG token export
- [ ] Regenerated color ramps (Leonardo or OKLCH lightness curve + hue rotation)
- [ ] Public accuracy scoreboard (`eval/gold/` fixtures + scoring script)
- [ ] Vercel deploy + R2 / Vercel Blob storage for the runtime `output/` directory

---

## Built on

- [**Google Stitch's DESIGN.md spec**](https://stitch.withgoogle.com/docs/design-md/overview) introduced the format
- [**jasonhnd/design-md-generator**](https://github.com/jasonhnd/design-md-generator) the engine we forked (MIT)
- [**Project Wallace**](https://www.projectwallace.com/) DTCG conversion patterns we mirror

---

## Contributing

PRs welcome. For larger changes, open an issue first so we can align on direction.

```bash
git checkout -b feature/your-thing
# do the thing
git commit -m "feat: your thing"
git push origin feature/your-thing
```

Tests must pass (`pnpm test`) and TypeScript must be clean (`pnpm exec tsc --noEmit`).

---

## Disclaimer

Generated outputs are **not** official design systems from the referenced brands. All trademarks, brand names, and design assets belong to their respective owners.

This project extracts publicly observable design patterns for educational, research, and development workflows. **Do not represent generated outputs as official brand assets.**

---

## License

[MIT](LICENSE)

---

<div align="center">

<img src="./public/footer.webp" alt="" width="100%" />

### Built for AI agents that generate UI.

<a href="https://github.com/sunil-dsb/design.md"><img src="https://api.iconify.design/lucide/star.svg?color=%23f59e0b" width="14" align="center" alt=""> &nbsp;<b>Star this repo</b></a>
&nbsp;·&nbsp;
<a href="https://sunilnegidsb-design-md.hf.space"><img src="https://api.iconify.design/lucide/external-link.svg?color=%2322c55e" width="14" align="center" alt=""> &nbsp;<b>Try the live demo</b></a>
&nbsp;·&nbsp;
<a href="https://stitch.withgoogle.com/docs/design-md/overview"><img src="https://api.iconify.design/lucide/book-open.svg?color=%237a73ff" width="14" align="center" alt=""> &nbsp;<b>Read the spec</b></a>

</div>
