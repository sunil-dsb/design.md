#!/usr/bin/env node
// Thin CLI around lib/engine/extract.ts. parseArgs() owns the flag surface
// (--fast / --with-interaction / --max-pages / --merge-with / etc.).
import { extract, parseArgs } from '../lib/engine/extract';

(async () => {
  const opts = parseArgs(process.argv);
  await extract(opts);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
