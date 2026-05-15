# Multi-stage build. Both stages use Microsoft's Playwright base image
# (~1.3 GB) because Chromium is needed at both build time (Next.js NFT
# tracing follows the import graph through `playwright`) and runtime
# (the API route launches Chromium for every extraction). What multi-stage
# DOES save: dev dependencies (vitest, typescript, eslint, @types/*) and
# source files not needed at runtime get pruned from the final image,
# trimming ~150-200 MB.
#
# If the build ever breaks on a host that's strict about NFT tracing
# (Vercel, Cloud Run), the simplest revert is to fold both stages back
# into a single FROM block — see git history for the previous single-stage
# version, or just remove the `FROM ... AS builder` line and copy
# directly. Nothing in the build pipeline is multi-stage-specific.

# ─── Stage 1: builder ─────────────────────────────────────────────────
# Installs ALL deps (dev + prod), runs `pnpm build`, then prunes to
# production-only deps so the runtime stage can copy a slim node_modules.
FROM mcr.microsoft.com/playwright:v1.59.1-noble AS builder

RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

WORKDIR /app

# Install deps first — this layer caches as long as the manifests don't
# change, so source-only edits don't trigger reinstall.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

# Build the Next.js app. The .next/ output bundles app/api/extract,
# lib/engine/*, and components/* into .next/server/* and .next/static/*.
COPY . .
RUN pnpm build

# Strip dev deps now that the build artifacts exist. Keeps the runtime
# node_modules to just what's needed at request-time (playwright,
# playwright-extra, puppeteer-extra-plugin-stealth, css-tree, culori,
# next, react, react-dom, plus their transitive prod deps).
RUN pnpm prune --prod

# ─── Stage 2: runtime ─────────────────────────────────────────────────
# Same Playwright base image for the Chromium binary + system libs that
# the API route needs to launch headless browsers.
FROM mcr.microsoft.com/playwright:v1.59.1-noble AS runtime

# pnpm needed only because `pnpm start` is the documented entry point.
# Could swap to `node node_modules/next/dist/bin/next start` to drop
# pnpm from runtime, but that's brittle to Next.js's internal layout.
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

WORKDIR /app

# Bring across the minimum set Next.js's `next start` needs at runtime:
#   .next/         — built output (server bundles + static assets)
#   node_modules/  — pruned prod-only deps
#   package.json   — Next.js reads `name`, `version`, scripts
#   next.config.ts — Next.js loads on every server start
#   public/        — static files served as-is
# Source folders (lib/, app/, components/) are NOT copied — their code
# is already inside .next/. Tests, eval/, examples/, output/ are
# explicitly excluded.
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/pnpm-lock.yaml ./pnpm-lock.yaml
COPY --from=builder /app/pnpm-workspace.yaml ./pnpm-workspace.yaml
COPY --from=builder /app/next.config.ts ./next.config.ts
COPY --from=builder /app/public ./public

# Writable output dir for extraction artifacts. Each request creates
# output/<slug>/{tokens.json,screenshots/,DESIGN.md,preview.html,...}.
RUN mkdir -p /app/output && chmod 777 /app/output

ENV NODE_ENV=production
# Cloud Run injects PORT=8080 at runtime and routes to it. We set a default
# here so the same image also runs on hosts that don't inject one
# (e.g. plain `docker run`). HuggingFace Spaces wants 7860 — if redeploying
# there in the future, override with `docker run -e PORT=7860`.
ENV PORT=8080
ENV HOSTNAME=0.0.0.0

EXPOSE 8080

CMD ["pnpm", "start"]
