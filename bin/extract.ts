#!/usr/bin/env node
// Thin CLI around lib/engine/extract.ts. parseArgs() in the engine module
// owns the flag parsing (--fast / --with-interaction / --max-pages /
// --merge-with / etc.). We intercept --help here so the printed usage
// reflects OUR CLI shape (`pnpm engine:extract`) rather than upstream's
// `npx ts-node scripts/extract.ts ...`  the engine's printUsage stays
// byte-identical to upstream for mirror cleanliness (see MIRROR.md).
import * as path from 'path';
import { extract, parseArgs } from '../lib/engine/extract';
import { stripDarkScreenshotsOnDisk } from '../lib/engine/strip-dark-screenshots';
import { applyButtonClustering } from '../lib/engine/button-cluster';

const HELP_TEXT = `
Usage: pnpm engine:extract <url1> [url2] [url3] ...

Options:
  --output <dir>         Output directory (default: output/<domain>/)
  --concurrency <n>      Playwright concurrency (default: 5)
  --max-pages <n>        Max pages to crawl (default: 8)
  --extra-urls <file>    File with additional URLs (one per line)
  --wait-for <strategy>  Wait strategy: networkidle (default), css, selector:<css>
  --merge-with <path>    Merge with existing tokens.json (incremental extraction)
  --no-dark-mode         Skip dark mode detection
  --no-interaction       Skip interaction state capture (default: skipped)
  --with-interaction     Enable interaction state capture (hover/focus/active)
  --fast                 Fast mode: maxPages=5, noInteraction, concurrency=8
  --verbose              Detailed logging
  --help, -h             Show this help

Examples:
  pnpm engine:extract https://stripe.com --fast
  pnpm engine:extract https://example.com --with-interaction --max-pages 10
  pnpm engine:extract https://example.com --output ./custom-output --wait-for css
`;

(async () => {
  // Intercept --help before the engine's parseArgs sees it. The engine's
  // printUsage text references upstream's scripts/ path; we replace it
  // with our pnpm-script-shaped equivalent.
  const argv = process.argv.slice(2);
  if (argv.length === 0 || argv.includes('--help') || argv.includes('-h')) {
    console.log(HELP_TEXT);
    process.exit(argv.length === 0 ? 1 : 0);
  }

  const opts = parseArgs(process.argv);
  const pageExtractions = await extract(opts);
  const tokensPath = path.join(opts.output, 'tokens.json');

  // Strip the dark-mode screenshot Buffers that the engine attaches to
  // tokens.json (see lib/engine/strip-dark-screenshots.ts). The SPA route
  // does the same — keeping both consumers consistent prevents a 173 MB
  // tokens.json on dark-mode-capable sites like Stripe and Vercel.
  try {
    stripDarkScreenshotsOnDisk(tokensPath);
  } catch {
    // Non-fatal — extraction succeeded, the only cost is a larger file.
  }

  // Re-cluster button variants in-place. cluster.ts produces a 4-bucket
  // luminance-classified components[Button] entry; we replace it with the
  // OKLCH-ΔE-clustered, role-tied, visibility-picked version that matches
  // the SPA's API route output. See lib/engine/button-cluster.ts.
  try {
    applyButtonClustering(
      tokensPath,
      pageExtractions.map((pe) => ({
        url: pe.url,
        elements: pe.dom.elements,
        interactions: pe.interactions,
      })),
    );
  } catch {
    // Non-fatal — cluster.ts's original output stays in tokens.json on
    // failure; we just don't get the improved variants.
  }
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
