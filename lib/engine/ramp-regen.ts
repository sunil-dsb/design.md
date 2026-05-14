// Ramp regeneration  the wedge differentiator (plan-v1.md §2).
//
// Most competitors emit raw observed colors as the brand palette. We
// regenerate a clean 12-stop ramp anchored on the brand's seed: hold the
// hue, walk a canonical lightness curve, taper chroma at the extremes
// (because saturated colors don't exist near pure white or pure black in
// sRGB), and gamut-clamp every stop. The result is a coherent system the
// user can build UI from  without it, downstream emitters (Tailwind /
// shadcn) ship the observed colors and look indistinguishable from
// designlang.
//
// Algorithm (dna.md §3.6, plan-v1.md §8 Weekend 6a):
//   For each lightness stop L_i in LIGHTNESS_STOPS:
//     t = 1 - |0.5 - i/(N-1)| × 2      // 0 at extremes, 1 at midpoint
//     c = seed.chroma × (0.6 + 0.4 × t)   // taper near L=0.99 and L=0.13
//     stop = oklch(L_i, c, seed.hue)
//     hex  = gamut-clamp to sRGB via culori.toGamut('rgb')
//
// Brand ramp uses the role-named "primary" color as seed. Neutral ramp
// uses the same hue at very low chroma (slightly-tinted greys, matching
// the Tailwind v4 / Radix convention), or pure grey if the brand itself
// is near-monochrome.
//
// Pure function  same inputs → same outputs. Scoreboard-safe.

import * as fs from 'fs';
import * as path from 'path';
import type { DesignTokens } from './types';
import { assignColorRoles, type NamedColor } from './role-namer';
// @ts-expect-error culori has no bundled declarations in this setup
import * as culori from 'culori';

//  Constants 

/** 12 lightness stops from dna.md §3.6  dense at the extremes, sparser in the middle. */
export const LIGHTNESS_STOPS = [
  0.99, 0.97, 0.94, 0.90, 0.83, 0.74, 0.63, 0.52, 0.42, 0.32, 0.22, 0.13,
] as const;

/** Tailwind-extended stop names, 1:1 with LIGHTNESS_STOPS by index. */
export const STOP_NAMES = [25, 50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950] as const;

/** Chroma threshold below which a "brand" is treated as monochrome. */
export const CHROMATIC_THRESHOLD = 0.04;

/** Chroma to use for tinted neutrals when the brand is chromatic. */
export const NEUTRAL_TINT_CHROMA = 0.005;

//  Types 

export interface OKLCH {
  l: number;
  c: number;
  h: number;
}

export interface RampStop {
  /** Stop name (Tailwind-style: 25, 50, ..., 950). */
  name: number;
  /** 6-digit lowercase hex, gamut-clamped to sRGB. */
  hex: string;
  /** OKLCH coordinates of the stop (for downstream wide-gamut tooling). */
  oklch: OKLCH;
}

export interface Ramp {
  /** The hex this ramp was anchored on (lowercase). */
  seedHex: string;
  /** Seed in OKLCH space. */
  seedOklch: OKLCH;
  /** Algorithm identifier  only `"oklch-lightness-curve"` today. */
  algorithm: 'oklch-lightness-curve';
  /** 12 stops, lightest first. */
  stops: RampStop[];
}

export interface RegeneratedRamps {
  /**
   * Brand ramp anchored on the role-named primary. Null when the
   * extraction has no role-classified primary (no chromatic candidates).
   */
  brand: Ramp | null;
  /**
   * Neutral ramp  tinted with brand hue at NEUTRAL_TINT_CHROMA when the
   * brand is chromatic, otherwise pure grey.
   */
  neutral: Ramp;
  /** ISO timestamp the ramps were generated at. */
  generatedAt: string;
}

//  culori helpers (typed wrappers, since culori ships no .d.ts here) 

interface CuloriRgbLike { mode: 'rgb'; r: number; g: number; b: number; alpha?: number }
interface CuloriOklchLike { mode: 'oklch'; l: number; c: number; h: number; alpha?: number }

const toOklch = (culori as { converter: (m: string) => (x: unknown) => unknown }).converter('oklch');
const toGamutSrgb = (culori as { toGamut: (target: string) => (x: unknown) => unknown }).toGamut('rgb');
const formatHex = (culori as { formatHex: (x: unknown) => string }).formatHex;
const parse = (culori as { parse: (x: string) => unknown }).parse;

/**
 * Parse a hex string into OKLCH coordinates. Returns null when the input
 * is unparseable. Pure black and pure white return c=0 and an arbitrary
 * (typically 0) hue  callers that need a meaningful hue for those should
 * substitute a sensible default.
 */
export function hexToOklch(hex: string): OKLCH | null {
  try {
    const parsed = parse(hex);
    if (!parsed) return null;
    const ok = toOklch(parsed) as { l?: number; c?: number; h?: number } | null;
    if (!ok || typeof ok.l !== 'number') return null;
    return {
      l: ok.l,
      c: ok.c ?? 0,
      // OKLCH hue is undefined for pure greys (any hue produces the same color).
      // culori returns NaN or undefined in that case; collapse to 0.
      h: Number.isFinite(ok.h) ? (ok.h as number) : 0,
    };
  } catch {
    return null;
  }
}

/**
 * Chroma taper multiplier for stop index `i` in a ramp of length `N`.
 * Returns 0.6 at the extremes (i=0, i=N-1), 1.0 at the midpoint, smoothly
 * interpolating between.
 */
export function chromaTaper(i: number, N: number): number {
  if (N <= 1) return 1.0;
  const t = 1 - Math.abs(0.5 - i / (N - 1)) * 2;
  return 0.6 + 0.4 * t;
}

//  Core ramp builder 

/**
 * Build a 12-stop ramp from an OKLCH seed. Internal  public callers use
 * `regenerateRamp(hex)` or `regenerateRampsFromTokens(tokens)`.
 */
function buildRamp(
  seedHex: string,
  seedOklch: OKLCH,
  baseChroma: number,
  hue: number,
  taperChroma: boolean,
): Ramp {
  const stops: RampStop[] = LIGHTNESS_STOPS.map((l, i) => {
    const requestedC = taperChroma
      ? baseChroma * chromaTaper(i, LIGHTNESS_STOPS.length)
      : baseChroma;
    // Synthesise the requested coordinates, gamut-clamp to sRGB, read
    // the post-clamp coordinates back. For most stops the clamp preserves
    // lightness and hue exactly and reduces chroma; for very light or
    // very dark stops with saturated seed hues, the achievable chroma
    // can be much lower than requested (e.g. on a Stripe-purple seed the
    // 25-stop requests c≈0.14 but only c≈0.01 fits sRGB at that
    // lightness).
    //
    // What we store in `stop.oklch`:
    //   l ← canonical LIGHTNESS_STOPS[i]. The algorithm's claim is "stop i
    //     has lightness LIGHTNESS_STOPS[i]"; toGamut occasionally drifts
    //     lightness by ~0.005 in extreme cases but that drift is sub-
    //     perceptual numerical noise, not an algorithmic decision. Storing
    //     the canonical value matches the algorithm name
    //     ("oklch-lightness-curve") and what users see in documentation.
    //   c ← actual post-clamp chroma. This is the load-bearing accuracy
    //     field  for any stop where the requested chroma exceeded sRGB
    //     gamut, `stop.oklch.c` now matches what `stop.hex` actually is.
    //   h ← synthesis hue. The algorithm's claim is "every stop shares the
    //     seed hue"; toGamut introduces ~1° drift in the chromatic stops
    //     and turns the hue into noise in near-grey stops (where the
    //     coordinate is mathematically meaningless). Storing the synthesis
    //     hue keeps the documentation property "ramp preserves hue" true.
    const clamped = toGamutSrgb({
      mode: 'oklch',
      l,
      c: requestedC,
      h: hue,
    } as CuloriOklchLike) as CuloriRgbLike;
    const hex = formatHex(clamped).toLowerCase();
    const actual = toOklch(clamped) as { l?: number; c?: number; h?: number } | null;
    const oklch: OKLCH = {
      l,
      c: typeof actual?.c === 'number' && Number.isFinite(actual.c) ? actual.c : 0,
      h: hue,
    };
    return { name: STOP_NAMES[i], hex, oklch };
  });

  return {
    seedHex: seedHex.toLowerCase(),
    seedOklch,
    algorithm: 'oklch-lightness-curve',
    stops,
  };
}

/**
 * Regenerate a 12-stop ramp anchored on `seedHex`. Holds the seed's hue,
 * walks the canonical lightness curve, tapers chroma at the extremes,
 * gamut-clamps each stop to sRGB.
 *
 * Returns null when the seed hex is unparseable.
 */
export function regenerateRamp(seedHex: string): Ramp | null {
  const seedOk = hexToOklch(seedHex);
  if (!seedOk) return null;
  return buildRamp(seedHex, seedOk, seedOk.c, seedOk.h, true);
}

/**
 * Regenerate brand + neutral ramps from an extracted tokens object.
 *
 * - Brand ramp: anchored on the role-named "primary" color from
 *   `tokens.colorTokens`. Returns null brand when no chromatic primary
 *   can be classified.
 * - Neutral ramp: tinted with the brand hue at NEUTRAL_TINT_CHROMA when
 *   the brand is chromatic (>= CHROMATIC_THRESHOLD), otherwise pure grey
 *   (chroma 0). Always returns a valid ramp.
 *
 * Pure function. role-namer is applied in-memory; the input tokens are
 * not mutated.
 */
export function regenerateRampsFromTokens(tokens: DesignTokens): RegeneratedRamps {
  const colors = Array.isArray(tokens.colorTokens) ? tokens.colorTokens : [];
  const named: NamedColor[] = assignColorRoles(colors);
  const primary = named.find((c) => c.role === 'primary');

  let brand: Ramp | null = null;
  let neutralHue = 0;
  let neutralChroma = 0;

  if (primary) {
    brand = regenerateRamp(primary.hex);
    if (brand) {
      neutralHue = brand.seedOklch.h;
      // Tinted neutrals iff brand is chromatic; otherwise pure greys.
      neutralChroma =
        brand.seedOklch.c >= CHROMATIC_THRESHOLD ? NEUTRAL_TINT_CHROMA : 0;
    }
  }

  // Neutral ramp: flat chroma across all stops (tapering at chroma 0.005
  // produces ~0.003 at extremes  invisibly small; not worth the math).
  const neutralSeed: OKLCH = { l: 0.5, c: neutralChroma, h: neutralHue };
  const neutralSeedClamped = toGamutSrgb({
    mode: 'oklch',
    l: 0.5,
    c: neutralChroma,
    h: neutralHue,
  } as CuloriOklchLike) as CuloriRgbLike;
  const neutralSeedHex = formatHex(neutralSeedClamped).toLowerCase();
  const neutral = buildRamp(neutralSeedHex, neutralSeed, neutralChroma, neutralHue, false);

  return {
    brand,
    neutral,
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Read tokens.json, regenerate ramps, write `regenerated-ramp.json` to
 * the same output directory. Disk wrapper called from the API route.
 *
 * Returns the ramps object on success, null when tokens.json is missing.
 */
export function generateAndWriteRamps(
  tokensPath: string,
  outputDir: string,
): RegeneratedRamps | null {
  if (!fs.existsSync(tokensPath)) return null;
  const tokens: DesignTokens = JSON.parse(fs.readFileSync(tokensPath, 'utf-8'));
  const ramps = regenerateRampsFromTokens(tokens);
  fs.writeFileSync(
    path.join(outputDir, 'regenerated-ramp.json'),
    JSON.stringify(ramps, null, 2),
  );
  return ramps;
}
