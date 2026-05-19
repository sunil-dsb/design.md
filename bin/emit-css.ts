#!/usr/bin/env node
// Regenerate tailwind.css + shadcn-theme.css for every committed gallery
// brand under examples/. Reads each brand's tokens.json and re-runs the
// pure-derivation CSS emitters  no web crawl, no Playwright. Fast (~2s
// for the full set) and idempotent.
//
// Use cases:
//   1. Adding the CSS download artifacts retroactively to brands that
//      were extracted before the emitters existed.
//   2. Re-running after the tailwind-emit / shadcn-emit logic changes,
//      so committed examples stay in sync with the current emit
//      contract without re-crawling.
//
// Usage: pnpm engine:emit-css                (default: examples/)
//        pnpm engine:emit-css output/foo     (explicit dir)

import * as fs from 'fs';
import * as path from 'path';
import { generateAndWriteRamps } from '../lib/engine/ramp-regen';
import { generateAndWriteTailwindCss } from '../lib/engine/tailwind-emit';
import { generateAndWriteShadcnCss } from '../lib/engine/shadcn-emit';
import type { DesignTokens } from '../lib/engine/types';

const [, , maybeRoot] = process.argv;
const root = path.resolve(
  process.cwd(),
  maybeRoot ?? 'examples',
);

if (!fs.existsSync(root)) {
  console.error(`emit-css: directory not found: ${root}`);
  process.exit(1);
}

const entries = fs
  .readdirSync(root, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name)
  .sort();

let okCount = 0;
let skipCount = 0;
for (const brand of entries) {
  const dir = path.join(root, brand);
  const tokensPath = path.join(dir, 'tokens.json');
  if (!fs.existsSync(tokensPath)) {
    console.log(`emit-css: ${brand}  skip (no tokens.json)`);
    skipCount++;
    continue;
  }
  const tokens = JSON.parse(
    fs.readFileSync(tokensPath, 'utf-8'),
  ) as DesignTokens;
  const url = tokens.meta?.sourceUrls?.[0] ?? `https://${brand}.com`;

  // Ramps must run FIRST  both tailwind-emit and shadcn-emit read
  // regenerated-ramp.json when present. Without it shadcn cannot
  // emit at all (every shadcn slot maps onto a ramp) and tailwind
  // falls back to a no-ramp profile.
  const ramps = generateAndWriteRamps(tokensPath, dir);
  const twPath = generateAndWriteTailwindCss(tokensPath, dir, url);
  const sh = generateAndWriteShadcnCss(tokensPath, dir, url);
  console.log(
    `emit-css: ${brand}  ramps=${ramps ? 'ok' : 'fail'}, tailwind=${twPath ? 'ok' : 'fail'}, shadcn=${sh.wrote ?? 'fail'}`,
  );
  okCount++;
}

console.log(`\nemit-css: ${okCount} brand(s) processed, ${skipCount} skipped.`);
