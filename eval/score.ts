// Scoreboard  pure scoring functions over (extraction, gold) → score.
//
// Inputs are deliberately narrow: an extraction's tokens.json shape and a
// gold-token JSON file. Outputs are deterministic numerical scores so the
// scoreboard is reproducible  same inputs → same scores, every time.
//
// Mirror discipline: this module lives outside lib/engine/. It imports
// the engine's color math (deltaE, parseColor) so OKLCH ΔE distance is
// computed identically to how cluster.ts does it. No engine modifications.

import * as fs from 'fs';
import * as path from 'path';
import { parseColor, deltaE, type OKLCH } from '../lib/engine/cluster';
import type { ColorToken, DesignTokens, TypographyLevel } from '../lib/engine/types';
import type { GoldTokens } from './gold/types';
// @ts-expect-error culori has no bundled declarations in this setup
import * as culori from 'culori';

//  Thresholds 
// Defaults from dna.md §3.3 + plan-v1.md §8 Weekend 5b's scoring rules.

/** ΔE2000 threshold under which two colors count as the same token. */
export const DELTA_E_MATCH = 5;

/** ΔE2000 threshold under which the primary pick counts as "correct enough". */
export const PRIMARY_PASS_DELTA_E = 5;

//  Output shapes 

export interface PrimaryScore {
  /** What the extractor picked as Primary (after role-namer). Null if none. */
  extracted: string | null;
  /** The canonical gold Primary. */
  gold: string;
  /** OKLCH ΔE2000 distance between extracted and gold. Lower is better. */
  deltaE: number;
  /** True when deltaE ≤ PRIMARY_PASS_DELTA_E. */
  pass: boolean;
}

export interface PaletteScore {
  /** Of N extracted colors, how many match a gold color within ΔE? */
  matched: number;
  /** Of M gold colors, how many were found in the extracted palette? */
  recall: number;
  /** Of N extracted colors, how many match a gold? Capped at 1. */
  precision: number;
  /** 2 × P × R / (P + R). */
  f1: number;
  extractedCount: number;
  goldCount: number;
}

export interface ColorScore {
  primary: PrimaryScore;
  palette: PaletteScore;
}

export interface TypographyScore {
  display: {
    extracted: string | null;
    gold: string;
    pass: boolean;
  };
  body: {
    extracted: string | null;
    gold: string;
    pass: boolean;
  };
}

export interface SpacingScore {
  baseUnit: {
    extracted: number | null;
    gold: number;
    pass: boolean;
  };
  /** Fraction of gold scale steps present in the extracted scale (0..1). */
  scaleRecall: number;
  /** Mean absolute error in px between matched extracted/gold steps. */
  scaleMae: number;
}

export interface OverallScore {
  brand: string;
  url: string;
  scoredAt: string;
  colors: ColorScore;
  typography: TypographyScore;
  spacing: SpacingScore;
  /**
   * Composite score 0..100, weighted across sub-scores. The weights are
   * documented inline in `computeComposite`. Composite is for at-a-glance
   * ranking on the scoreboard; individual sub-scores tell the real story.
   */
  composite: number;
}

//  Helpers 

function lowercaseHex(hex: string): string {
  return hex.trim().toLowerCase();
}

function hexToOklch(hex: string): OKLCH | null {
  const parsed = parseColor(hex);
  if (!parsed) return null;
  const toOklch = (culori as { converter: (m: string) => (x: unknown) => unknown }).converter('oklch');
  const ok = toOklch({ mode: 'rgb', r: parsed.r / 255, g: parsed.g / 255, b: parsed.b / 255 }) as
    | { l?: number; c?: number; h?: number }
    | null;
  if (!ok) return null;
  return { l: ok.l ?? 0, c: ok.c ?? 0, h: ok.h ?? 0 };
}

/** Strip quotes + comma-stack suffix from a font-family string. */
function canonicalFamily(family: string): string {
  return family
    .split(',')[0]
    .trim()
    .replace(/^["']|["']$/g, '')
    .toLowerCase();
}

//  Scoring functions 

/**
 * Score the extractor's Primary pick against the gold Primary. The
 * extractor's Primary is the colorTokens entry tagged role=primary
 * by role-namer. The OKLCH ΔE2000 distance to the gold is the metric.
 */
export function scorePrimary(
  extracted: ColorToken[] | undefined,
  gold: GoldTokens,
): PrimaryScore {
  const goldHex = lowercaseHex(gold.colors.primary.hex);
  const goldOk = hexToOklch(goldHex);
  if (!goldOk) {
    return { extracted: null, gold: goldHex, deltaE: Infinity, pass: false };
  }
  const primaryToken = (extracted ?? []).find(
    (c) => (c as ColorToken & { role?: string }).role === 'primary',
  );
  if (!primaryToken) {
    return { extracted: null, gold: goldHex, deltaE: Infinity, pass: false };
  }
  const extractedHex = lowercaseHex(primaryToken.hex);
  const extOk = hexToOklch(extractedHex);
  if (!extOk) {
    return { extracted: extractedHex, gold: goldHex, deltaE: Infinity, pass: false };
  }
  const distance = deltaE(extOk, goldOk);
  return {
    extracted: extractedHex,
    gold: goldHex,
    deltaE: distance,
    pass: distance <= PRIMARY_PASS_DELTA_E,
  };
}

/**
 * Score the full palette: precision / recall / F1 over ΔE-matched color
 * tokens vs the gold paletteHexes list.
 */
export function scorePalette(
  extracted: ColorToken[] | undefined,
  gold: GoldTokens,
): PaletteScore {
  const goldHexes = gold.colors.paletteHexes.map(lowercaseHex);
  const extractedHexes = (extracted ?? []).map((c) => lowercaseHex(c.hex));

  if (goldHexes.length === 0 || extractedHexes.length === 0) {
    return {
      matched: 0,
      recall: 0,
      precision: 0,
      f1: 0,
      extractedCount: extractedHexes.length,
      goldCount: goldHexes.length,
    };
  }

  // Pre-compute OKLCH for all colors on both sides.
  const goldOk = goldHexes.map((h) => ({ hex: h, ok: hexToOklch(h) }));
  const extOk = extractedHexes.map((h) => ({ hex: h, ok: hexToOklch(h) }));

  // For each gold color, find the nearest extracted within ΔE threshold.
  let goldHit = 0;
  for (const g of goldOk) {
    if (!g.ok) continue;
    const hit = extOk.some(
      (e) => e.ok !== null && deltaE(g.ok!, e.ok) <= DELTA_E_MATCH,
    );
    if (hit) goldHit++;
  }

  // For each extracted color, count those that match SOME gold color.
  let extHit = 0;
  for (const e of extOk) {
    if (!e.ok) continue;
    const hit = goldOk.some(
      (g) => g.ok !== null && deltaE(e.ok!, g.ok) <= DELTA_E_MATCH,
    );
    if (hit) extHit++;
  }

  const recall = goldHit / goldHexes.length;
  const precision = extHit / extractedHexes.length;
  const f1 = precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall);

  return {
    matched: goldHit,
    recall,
    precision,
    f1,
    extractedCount: extractedHexes.length,
    goldCount: goldHexes.length,
  };
}

/** Score typography: extracted display/body family vs gold. */
export function scoreTypography(
  extracted: TypographyLevel[] | undefined,
  gold: GoldTokens,
): TypographyScore {
  const goldDisplay = canonicalFamily(gold.typography.display.family);
  const goldBody = canonicalFamily(gold.typography.body.family);

  // Pick the extracted display: most-frequent typo level among heading tags.
  // Falls back to the highest-frequency level overall.
  const levels = extracted ?? [];
  const headingLevel = levels
    .slice()
    .sort((a, b) => b.frequency - a.frequency)
    .find((l) => (l.typicalTags ?? []).some((t) => /^h[1-3]$/i.test(t)));
  const bodyLevel = levels
    .slice()
    .sort((a, b) => b.frequency - a.frequency)
    .find((l) => (l.typicalTags ?? []).some((t) => /^(p|body|li|span)$/i.test(t)));

  const extractedDisplay = headingLevel
    ? canonicalFamily(headingLevel.fontFamily)
    : levels.length > 0
    ? canonicalFamily(levels[0].fontFamily)
    : null;
  const extractedBody = bodyLevel
    ? canonicalFamily(bodyLevel.fontFamily)
    : levels.length > 0
    ? canonicalFamily(levels[0].fontFamily)
    : null;

  return {
    display: {
      extracted: extractedDisplay,
      gold: goldDisplay,
      pass: extractedDisplay === goldDisplay,
    },
    body: {
      extracted: extractedBody,
      gold: goldBody,
      pass: extractedBody === goldBody,
    },
  };
}

/** Score the spacing system: base unit match + scale recall + MAE. */
export function scoreSpacing(
  extracted: DesignTokens['spacingSystem'] | undefined,
  gold: GoldTokens,
): SpacingScore {
  const goldBase = gold.spacing.baseUnit;
  const extractedBase = extracted?.baseUnit ?? null;
  const goldScale = gold.spacing.scale.slice().sort((a, b) => a - b);
  const extScale = (extracted?.scale ?? []).slice().sort((a, b) => a - b);

  // Recall: for each gold step, was a matching extracted step found (±1px)?
  let recallHits = 0;
  let totalErr = 0;
  for (const g of goldScale) {
    let bestErr = Infinity;
    for (const e of extScale) {
      const err = Math.abs(e - g);
      if (err < bestErr) bestErr = err;
    }
    if (bestErr <= 1) {
      recallHits++;
      totalErr += bestErr;
    }
  }
  const scaleRecall = goldScale.length === 0 ? 0 : recallHits / goldScale.length;
  const scaleMae = recallHits === 0 ? Infinity : totalErr / recallHits;

  return {
    baseUnit: {
      extracted: extractedBase,
      gold: goldBase,
      pass: extractedBase === goldBase,
    },
    scaleRecall,
    scaleMae,
  };
}

/**
 * Weighted composite score 0..100.
 *
 * Weights reflect plan-v1.md §2's wedge order  color accuracy is the
 * primary claim, typography matters but is more bimodal (right/wrong),
 * spacing is structural but less brand-defining.
 */
export function computeComposite(score: Omit<OverallScore, 'composite' | 'scoredAt' | 'brand' | 'url'>): number {
  // Primary correctness  30 points. Pass / partial / fail.
  const primaryPoints = score.colors.primary.pass
    ? 30
    : score.colors.primary.deltaE <= PRIMARY_PASS_DELTA_E * 2
    ? 15
    : 0;

  // Palette F1  25 points (continuous).
  const palettePoints = score.colors.palette.f1 * 25;

  // Typography  20 points (display + body, 10 each).
  const typoPoints =
    (score.typography.display.pass ? 10 : 0) +
    (score.typography.body.pass ? 10 : 0);

  // Spacing  15 points (baseUnit + scaleRecall).
  const spacingPoints =
    (score.spacing.baseUnit.pass ? 7 : 0) + score.spacing.scaleRecall * 8;

  // Coverage floor  10 points just for producing extracted data.
  const coveragePoints = score.colors.palette.extractedCount > 0 ? 10 : 0;

  const total = primaryPoints + palettePoints + typoPoints + spacingPoints + coveragePoints;
  return Math.max(0, Math.min(100, Math.round(total)));
}

/**
 * In-memory scoring. Takes the parsed tokens.json content (already with
 * role-namer applied) and the parsed gold tokens, returns the full score.
 *
 * Prefer this over scoreExtraction when the caller already has the data
 * in memory  it avoids temp-file round-tripping and is unit-testable
 * without filesystem stubs.
 */
export function scoreTokens(
  tokens: DesignTokens,
  gold: GoldTokens,
): OverallScore {
  const colors: ColorScore = {
    primary: scorePrimary(tokens.colorTokens, gold),
    palette: scorePalette(tokens.colorTokens, gold),
  };
  const typography = scoreTypography(tokens.typographyLevels, gold);
  const spacing = scoreSpacing(tokens.spacingSystem, gold);
  const partial = { colors, typography, spacing };

  return {
    brand: gold.brand,
    url: gold.url,
    scoredAt: new Date().toISOString(),
    composite: computeComposite(partial),
    ...partial,
  };
}

/**
 * File-reading wrapper around scoreTokens. Loads + parses both files
 * from disk and delegates. Used by the CLI; the SPA route uses
 * scoreTokens directly with role-namer applied in memory.
 */
export function scoreExtraction(
  tokensPath: string,
  goldPath: string,
): OverallScore {
  const tokens = JSON.parse(fs.readFileSync(tokensPath, 'utf-8')) as DesignTokens;
  const gold = JSON.parse(fs.readFileSync(goldPath, 'utf-8')) as GoldTokens;
  return scoreTokens(tokens, gold);
}

/** Resolve the canonical gold file path for a brand slug. */
export function goldPathFor(brand: string, root: string = process.cwd()): string {
  return path.join(root, 'eval', 'gold', `${brand}.json`);
}
