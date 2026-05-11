#!/usr/bin/env node
// Usage: pnpm engine:validate <designMdPath> <tokensPath>
// Exits 0 when score >= 80, 1 otherwise (so it composes with shell `&&`).
import * as fs from 'fs';
import { validateDesignMd } from '../lib/engine/validate';
import type { DesignTokens } from '../lib/engine/types';

const [, , designMdPath, tokensPath] = process.argv;
if (!designMdPath || !tokensPath) {
  console.error('Usage: pnpm engine:validate <designMdPath> <tokensPath>');
  process.exit(1);
}

const mdContent = fs.readFileSync(designMdPath, 'utf-8');
const tokens: DesignTokens = JSON.parse(fs.readFileSync(tokensPath, 'utf-8'));
const result = validateDesignMd(mdContent, tokens);

console.log(`\nValidation: ${result.score}/100`);
console.log(`  Passed:   ${result.passed.length}`);
console.log(`  Warnings: ${result.warnings.length}`);
console.log(`  Failures: ${result.failures.length}`);
for (const f of result.failures) console.log(`  [FAIL] ${f.type}: ${f.value} ${f.message}`);
for (const w of result.warnings) console.log(`  [WARN] ${w.type}: ${w.value} ${w.message}`);

process.exit(result.score >= 80 ? 0 : 1);
