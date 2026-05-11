# design.md

> Paste a URL. Get a `DESIGN.md` — a plain-text design system that AI agents can read.

The design counterpart to `AGENTS.md`. Where `AGENTS.md` tells coding agents *how to build* a project, `DESIGN.md` tells design agents *how it should look and feel*.

---

## Features

- 🌐 **One URL in** — extracts colors, typography, spacing, and component patterns from any public website
- 📄 **Four formats out** — `DESIGN.md` (markdown), Tailwind v4 `@theme`, plain CSS variables, and DTCG (W3C Design Tokens)
- 🤖 **Agent-ready** — drop the file in your repo root and any agent (Claude Code, Cursor, Windsurf, Copilot) reads it before writing UI
- 🪶 **Tiny artifact** — one markdown file, ~200 lines, diffable and PR-able like code
- 🎨 **Gallery** — pre-extracted starting points for Stripe, Linear, Vercel, Supabase, and more

## How it works

1. Paste any public URL on the home page
2. The extractor crawls the live site (Playwright on the server) and reads its visual properties
3. Tokens are clustered, named, and emitted in four formats
4. Drop `DESIGN.md` in your repo root next to `README.md` and `AGENTS.md`
5. Tell your agent: *"read DESIGN.md before you write any UI"*

Your agent stops averaging and starts referencing.

## Quick start

```bash
git clone https://github.com/<your-fork>/design.md.git
cd design.md
pnpm install
pnpm dev
```

Open [localhost:3000](http://localhost:3000).

### Scripts

| Command       | Does                                  |
|---------------|---------------------------------------|
| `pnpm dev`    | Start the dev server                  |
| `pnpm build`  | Production build                      |
| `pnpm start`  | Run the production build              |
| `pnpm lint`   | Run ESLint                            |

## Tech stack

- **[Next.js 16](https://nextjs.org/)** (App Router) · **[React 19](https://react.dev/)**
- **[Tailwind CSS v4](https://tailwindcss.com/)**
- **TypeScript**
- **[Geist](https://vercel.com/font)** + a custom pixel font

## Routes

| Route             | Purpose                                                            |
|-------------------|--------------------------------------------------------------------|
| `/`               | Home — paste a URL                                                 |
| `/extract`        | Extraction result — colors, typography, generated files            |
| `/why`            | What DESIGN.md is and why it exists                                |
| `/api/extract`    | POST endpoint that runs the extractor                              |

## Project structure

```
app/            Next.js App Router routes (page.tsx + layout.tsx)
components/     Reusable React components (Navbar, Footer, BubbleButton, …)
icons/          Single-file SVG icon components
public/         Static assets — fonts, sprites, favicons
```

## Contributing

Contributions welcome. Open an issue first for anything more than a small fix so we can align on direction.

1. Fork the repo
2. Create a branch — `git checkout -b your-feature`
3. Commit — `git commit -m "feat: short summary"`
4. Push — `git push origin your-feature`
5. Open a Pull Request

## Acknowledgments

- The `DESIGN.md` format was introduced by **Google Stitch**.
- Inspiration from the [VoltAgent/awesome-design-md](https://github.com/VoltAgent/awesome-design-md) collection.

## License

MIT — see [LICENSE](./LICENSE).
