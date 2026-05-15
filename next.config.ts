import type { NextConfig } from "next";
import { resolve } from "node:path";

// Pin Turbopack's workspace root to the directory `next dev`/`next build` is
// invoked from. Without this, Next.js auto-detects the root via lockfile
// presence and picks the WRONG folder when there's a stray pnpm-lock.yaml
// one level up (e.g. in `D:\design.md\` while the project lives in
// `D:\design.md\design.md\`). A wrong root breaks `@/*` alias resolution
// and module loading, which surfaces as random dev-server crashes.
//
// We use `path.resolve(".")` (= process.cwd()) instead of `import.meta.url`
// because Next.js 16's next.config.ts compiler emits CJS-style output
// (`exports.default = ...`) and rejects ESM-only constructs like
// `import.meta.url`. Since `next` always runs from the project root, this
// resolves to the same absolute path either way.
// See: https://nextjs.org/docs/app/api-reference/config/next-config-js/turbopack#root-directory
const projectRoot = resolve(".");

const nextConfig: NextConfig = {
  // Pin Turbopack to the project directory regardless of where pnpm-lock.yaml
  // files might exist in parent directories.
  turbopack: {
    root: projectRoot,
  },
  // `playwright` and `playwright-core` are already in Next.js's default
  // server-external opt-out list. Adding the three our engine uses that aren't:
  serverExternalPackages: [
    "playwright-extra",
    "puppeteer-extra-plugin-stealth",
    "css-tree",
  ],
};

export default nextConfig;
