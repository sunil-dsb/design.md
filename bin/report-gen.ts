#!/usr/bin/env node
// Usage: pnpm engine:report <tokensPath> <outputDir> [designMdPath]
// If designMdPath is provided, the generated report.html will embed validation.
import { generateReport } from '../lib/engine/report-gen';

const [, , tokensPath, outputDir, designMdPath] = process.argv;
if (!tokensPath || !outputDir) {
  console.error('Usage: pnpm engine:report <tokensPath> <outputDir> [designMdPath]');
  process.exit(1);
}

generateReport(tokensPath, outputDir, designMdPath);
