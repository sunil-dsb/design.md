#!/usr/bin/env node
// Usage: pnpm engine:proof <URL> <tokensPath> <outputDir> [previewPath]
import { runProof } from '../lib/engine/proof';

const [, , url, tokensPath, outputDir, previewPath] = process.argv;
if (!url || !tokensPath || !outputDir) {
  console.error('Usage: pnpm engine:proof <URL> <tokensPath> <outputDir> [previewPath]');
  process.exit(1);
}

runProof(url, tokensPath, outputDir, previewPath).catch((err) => {
  console.error(err);
  process.exit(1);
});
