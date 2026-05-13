#!/usr/bin/env node
// Usage: pnpm engine:score <brand> [tokensPath]
//
// Scores the given brand's extraction against the hand-curated gold file
// at eval/gold/<brand>.json. Prints a compact summary to stdout and exits
// 0 if composite ≥ 80, 1 otherwise (composable with `&&` in CI).
//
// Examples:
//   pnpm engine:score stripe
//   pnpm engine:score stripe output/stripe.com/tokens.json
import { scoreTokens, goldPathFor } from '../eval/score';
import { assignColorRoles, assignTypeRoles } from '../lib/engine/role-namer';
import type { DesignTokens } from '../lib/engine/types';
import type { GoldTokens } from '../eval/gold/types';
import * as fs from 'fs';
import * as path from 'path';

const [, , brand, customTokensPath] = process.argv;
if (!brand) {
  console.error('Usage: pnpm engine:score <brand> [tokensPath]');
  console.error('  brand          slug matching eval/gold/<brand>.json');
  console.error('  tokensPath     optional path to tokens.json (defaults to output/<brand>.com/tokens.json,');
  console.error('                 then examples/<brand>/tokens.json as fallback)');
  process.exit(1);
}

// Resolve the tokens.json path: explicit > output/<brand>.com > examples/<brand>.
function resolveTokensPath(): string | null {
  if (customTokensPath) {
    return customTokensPath;
  }
  const candidates = [
    path.join('output', `${brand}.com`, 'tokens.json'),
    path.join('output', brand, 'tokens.json'),
    path.join('examples', brand, 'tokens.json'),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return null;
}

const tokensPath = resolveTokensPath();
if (!tokensPath) {
  console.error(`No tokens.json found for "${brand}". Tried:`);
  console.error(`  output/${brand}.com/tokens.json`);
  console.error(`  output/${brand}/tokens.json`);
  console.error(`  examples/${brand}/tokens.json`);
  process.exit(1);
}

const goldPath = goldPathFor(brand);
if (!fs.existsSync(goldPath)) {
  console.error(`No gold file found at ${goldPath}`);
  process.exit(1);
}

// Apply role-namer in-memory so the primary-pick scoring sees a `role`
// field on each ColorToken. Persisted tokens.json may or may not have it
// depending on whether the SPA's API route wrote it back. No temp files —
// scoreTokens takes the parsed in-memory objects directly.
const tokens = JSON.parse(fs.readFileSync(tokensPath, 'utf-8')) as DesignTokens;
if (Array.isArray(tokens.colorTokens)) tokens.colorTokens = assignColorRoles(tokens.colorTokens);
if (Array.isArray(tokens.typographyLevels)) tokens.typographyLevels = assignTypeRoles(tokens.typographyLevels);
const gold = JSON.parse(fs.readFileSync(goldPath, 'utf-8')) as GoldTokens;

{
  const result = scoreTokens(tokens, gold);
  const c = result.colors;
  const t = result.typography;
  const s = result.spacing;

  console.log('');
  console.log(`  Scoreboard · ${result.brand}`);
  console.log(`  ${result.url}`);
  console.log('  ' + '─'.repeat(60));
  console.log('');
  console.log(`  COMPOSITE                                       ${result.composite}/100`);
  console.log('');
  console.log('  Colors');
  console.log(`    Primary       ${c.primary.extracted ?? '—'}  vs  ${c.primary.gold}      ΔE ${c.primary.deltaE.toFixed(2)}  ${c.primary.pass ? '✓' : '✗'}`);
  console.log(`    Palette F1    ${(c.palette.f1 * 100).toFixed(1)}%   (P ${(c.palette.precision * 100).toFixed(1)}% · R ${(c.palette.recall * 100).toFixed(1)}%)`);
  console.log(`                  matched ${c.palette.matched}/${c.palette.goldCount} gold colors in ${c.palette.extractedCount} extracted`);
  console.log('');
  console.log('  Typography');
  console.log(`    Display       ${t.display.extracted ?? '—'}  vs  ${t.display.gold}        ${t.display.pass ? '✓' : '✗'}`);
  console.log(`    Body          ${t.body.extracted ?? '—'}  vs  ${t.body.gold}        ${t.body.pass ? '✓' : '✗'}`);
  console.log('');
  console.log('  Spacing');
  console.log(`    Base unit     ${s.baseUnit.extracted ?? '—'}px  vs  ${s.baseUnit.gold}px        ${s.baseUnit.pass ? '✓' : '✗'}`);
  console.log(`    Scale recall  ${(s.scaleRecall * 100).toFixed(1)}%  (MAE ${s.scaleMae === Infinity ? '—' : s.scaleMae.toFixed(2) + 'px'})`);
  console.log('');

  process.exit(result.composite >= 80 ? 0 : 1);
}
