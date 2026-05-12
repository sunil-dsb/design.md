<div align="center">

<img src="./public/hero.webp" alt="design.md" width="100%" />

# design.md

### Extract AI-ready design systems from any website.

DESIGN.md · Tailwind v4 · CSS Variables · DTCG · Prompt Packs

Built for modern AI coding agents.

<br />

[![Version](https://img.shields.io/badge/version-0.0.1-blue.svg)](CHANGELOG.md)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Open Source](https://img.shields.io/badge/open-source-brightgreen.svg)]()
[![Tailwind v4](https://img.shields.io/badge/Tailwind-v4-38bdf8.svg)]()
[![DESIGN.md](https://img.shields.io/badge/format-DESIGN.md-purple.svg)]()

<br />

[Live Demo](https://designmd.dev) ·
[Examples](./examples) ·
[Why DESIGN.md?](./app/why/page.tsx) ·
[Spec](https://github.com/VoltAgent/awesome-design-md)

</div>

---

## What is this?

`design.md` extracts structured design systems from real websites and converts them into formats AI agents can understand.

Instead of prompting:

> “Make it look like Stripe.”

You give the agent actual design context:
- colors
- typography
- spacing
- radii
- shadows
- component patterns
- interaction styles
- design tokens

The result:
AI-generated UI becomes consistent instead of generic.

---

## Example

### Input

```txt
https://stripe.com
```

### Output

```txt
DESIGN.md
tailwind.theme.css
variables.css
tokens.json
cursor-prompt.md
claude-prompt.md
v0-prompt.md
```

---

## Why `DESIGN.md` exists

AI coding tools can generate interfaces fast.

But without design context, every generated UI converges toward the same patterns:
- generic gradients
- inconsistent spacing
- random typography
- copied aesthetics without system thinking

Screenshots help with visuals.
Prompts help with instructions.

Neither gives agents an actual design system.

`DESIGN.md` gives AI agents a structured design reference they can follow while generating UI.

Think of it as the design equivalent of `AGENTS.md`.

| File | Purpose |
|---|---|
| `README.md` | Explains the project |
| `AGENTS.md` | Explains how AI should build |
| `DESIGN.md` | Explains how UI should look and feel |

---

## What you get

- 🌐 Extract design systems from any public website
- 🎨 Colors, typography, spacing, shadows, radii, and component styles
- 🧠 AI-ready outputs for Cursor, Claude, v0, Lovable, Replit, and more
- 🪶 Tiny portable artifacts that live directly inside repositories
- 📄 Multiple export formats:
  - `DESIGN.md`
  - Tailwind v4 `@theme`
  - CSS variables
  - DTCG design tokens
- 🎯 Visual fidelity validation
- 🧩 Regenerated color ramps
- 🔓 Fully open source

---

## Why this project is different

Most extraction tools dump raw styles.

`design.md` reconstructs coherent design systems using:
- perceptual color clustering
- token extraction
- visual weighting
- design token normalization
- regenerated ramps
- structured outputs for AI agents

The goal is not:

> “extract random colors from a page.”

The goal is:

> “extract a usable design system.”

---

## Architecture

```txt
URL
 ↓
Playwright crawler
 ↓
Style extraction
 ↓
Token clustering
 ↓
Design system reconstruction
 ↓
DESIGN.md + themes + prompts
```

---

## How it works

1. Paste any public URL
2. The crawler captures styles, layout patterns, and design tokens
3. Tokens are clustered and normalized
4. The system generates:
   - `DESIGN.md`
   - Tailwind theme
   - CSS variables
   - DTCG tokens
   - AI prompt packs
5. Drop the generated files into your repository
6. Tell your AI agent:

```txt
Read DESIGN.md before generating UI.
```

---

## Quick start

```bash
git clone https://github.com/your-username/design.md.git

cd design.md

pnpm install

pnpm dev
```

Open:

```txt
http://localhost:3000
```

---

## Scripts

| Command | Description |
|---|---|
| `pnpm dev` | Start development server |
| `pnpm build` | Production build |
| `pnpm start` | Start production server |
| `pnpm lint` | Run ESLint |

---

## Tech stack

- Next.js 16
- Tailwind CSS v4
- TypeScript
- Playwright
- React 19

---

## Project structure

```txt
app/            Next.js App Router
components/     Reusable UI components
public/         Static assets
examples/       Example DESIGN.md files
scripts/        Extraction pipeline
workers/        Background extraction workers
```

---

## Roadmap

- [x] DESIGN.md generation
- [x] Tailwind v4 export
- [x] CSS variable export
- [x] DTCG tokens
- [x] AI prompt packs
- [ ] shadcn theme generation
- [ ] visual fidelity scoring
- [ ] design drift detection
- [ ] Chrome extension
- [ ] multi-page extraction
- [ ] authenticated site extraction

---

## Open source philosophy

Design extraction quality should be:
- inspectable
- measurable
- reproducible

This project is open source so the community can:
- audit extraction quality
- improve token accuracy
- reproduce evaluations
- build better AI design tooling together

We believe AI-native design infrastructure should evolve in the open.

---

## Contributing

Contributions are welcome.

If you're planning a large change, please open an issue first so we can discuss direction before implementation.

### Setup

```bash
git checkout -b feature/my-feature
```

### Commit

```bash
git commit -m "feat: add something"
```

### Push

```bash
git push origin feature/my-feature
```

Then open a Pull Request.

---

## Acknowledgments

- Google Stitch for introducing the `DESIGN.md` concept
- The open-source design tooling ecosystem
- The brands whose public interfaces help advance design-system research

---

## Disclaimer

Generated outputs are not official design systems from the referenced brands.

All trademarks, brand names, and design assets belong to their respective owners.

This project extracts publicly observable design patterns for:
- educational purposes
- research
- development workflows
- AI-assisted design systems

Do not represent generated outputs as official brand assets.

---

## License

MIT

---

<div align="center">

<img src="./public/footer.webp" alt="" width="100%" />

### Built for AI agents that generate UI.

</div>