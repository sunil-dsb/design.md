#!/usr/bin/env node
// Usage: pnpm engine:preview <tokensPath> <outputDir>
import { generatePreview } from '../lib/engine/preview-gen';

const [, , tokensPath, outputDir] = process.argv;
if (!tokensPath || !outputDir) {
  console.error('Usage: pnpm engine:preview <tokensPath> <outputDir>');
  process.exit(1);
}

generatePreview(tokensPath, outputDir);
