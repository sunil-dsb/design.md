// Visibility-and-importance weighting — the wedge accuracy lift.
//
// dna.md §11.1 calls this *"the single biggest accuracy multiplier."* The
// upstream engine ranks tokens by frequency of element observations. That
// works on uniform sites but fails on real ones: a 1px footer border on
// every page beats a 600×400 hero CTA in raw count. Visibility weighting
// applies a per-element multiplier so hero / above-the-fold / interactive
// elements dominate the ranking.
//
// Formula (dna.md §11.1):
//   weight = visibility × area × semanticBoost × interactiveBoost × foldBoost
//
//   visibility       = 0 if display:none / opacity:0 / 0-area, else 1
//   area             = sqrt(rect.w × rect.h) / sqrt(viewport.area), capped at 2
//   semanticBoost    = 2.0 (h1), 1.6 (h2), 1.4 (h3), 1.2 (h4/h5/h6);
//                      times 1.2 if in nav/main/header region,
//                      times 0.8 if in footer/aside region
//   interactiveBoost = 1.5 for <a>, <button>, <input>, <select>, <textarea>,
//                      or role in [button, link, textbox, combobox]
//   foldBoost        = 2.0 if rect.y < viewport.height (above fold), else 1.0
//
// Pipeline: extract.ts produces tokens.json + returns pageExtractions; the
// API route hands the per-page element arrays directly to
// applyVisibilityWeighting (in-memory — no disk sidecar), which aggregates
// weights per token cluster via the same OKLCH ΔE distance cluster.ts uses,
// adds a `visibilityScore` field to each ColorToken, and re-sorts
// colorTokens by score descending. Tokens with zero weighted observations
// fall to the bottom (likely hidden / phantom / footer-only).
//
// Engine modules untouched. See MIRROR.md Part 2.13 for the small
// extract.ts signature change that makes this possible.

import * as fs from 'fs';
import { parseColor, deltaE, type OKLCH } from './cluster';
import type { ColorToken, ElementStyle } from './types';
// @ts-expect-error culori has no bundled declarations in this setup
import * as culori from 'culori';

export interface Viewport {
  width: number;
  height: number;
}

/**
 * Default viewport matches extract.ts's per-page newContext call
 * (1440×900). If your call site uses a different viewport, pass it through.
 */
export const DEFAULT_VIEWPORT: Viewport = { width: 1440, height: 900 };

/** Tags that get an interactive boost (1.5×). */
const INTERACTIVE_TAGS = new Set(['a', 'button', 'input', 'select', 'textarea']);

/** Roles that get an interactive boost regardless of underlying tag. */
const INTERACTIVE_ROLES = new Set(['button', 'link', 'textbox', 'combobox', 'menuitem', 'tab', 'switch']);

/** ElementStyle color fields we attribute weight to. */
const COLOR_FIELDS: ReadonlyArray<keyof ElementStyle> = [
  'color',
  'backgroundColor',
  'borderTopColor',
  'borderRightColor',
  'borderBottomColor',
  'borderLeftColor',
  'outlineColor',
  'textDecorationColor',
] as const;

/**
 * Compute a single element's visibility-and-importance weight per dna.md §11.1.
 *
 * Pure function. Returns 0 for elements that should not contribute to the
 * token ranking at all (invisible, zero-area, etc.). Otherwise returns the
 * product of all multipliers.
 */
export function computeElementWeight(el: ElementStyle, viewport: Viewport): number {
  // ── Visibility gate ────────────────────────────────────────────────
  // Short-circuit BEFORE any boost math — invisible elements contribute 0.
  if (el.display === 'none') return 0;
  const opacity = parseFloat(el.opacity || '1');
  if (Number.isFinite(opacity) && opacity === 0) return 0;
  if (el.rect.width <= 0 || el.rect.height <= 0) return 0;

  // ── Area (sqrt-normalized; viewport-sized hero ≈ 1.0) ───────────────
  // Square-rooted on both sides so a 2× wider element is 2× weight, not
  // 4×. Capped at 2 so a single huge element can't dominate the entire
  // page (e.g., a full-bleed image background).
  const viewportArea = viewport.width * viewport.height;
  const area = Math.min(
    2,
    Math.sqrt(Math.max(0, el.rect.width * el.rect.height)) / Math.sqrt(viewportArea || 1),
  );

  // ── Semantic boost: heading hierarchy + structural region ──────────
  const tag = (el.tag || '').toLowerCase();
  let semanticBoost = 1.0;
  if (tag === 'h1') semanticBoost = 2.0;
  else if (tag === 'h2') semanticBoost = 1.6;
  else if (tag === 'h3') semanticBoost = 1.4;
  else if (tag === 'h4' || tag === 'h5' || tag === 'h6') semanticBoost = 1.2;

  // Region multiplier composes with the tag boost. An h1 inside <footer>
  // gets 2.0 × 0.8 = 1.6 (still meaningful but not main-content).
  const region = el.structuralRegion;
  if (region === 'nav' || region === 'main' || region === 'header') {
    semanticBoost *= 1.2;
  } else if (region === 'footer' || region === 'aside') {
    semanticBoost *= 0.8;
  }

  // ── Interactive boost: real interactive elements get +50% ─────────
  const role = (el.role || '').toLowerCase();
  const isInteractive = INTERACTIVE_TAGS.has(tag) || INTERACTIVE_ROLES.has(role);
  const interactiveBoost = isInteractive ? 1.5 : 1.0;

  // ── Fold boost: above the fold = 2.0 ──────────────────────────────
  // rect.y is the element's top edge in the captured viewport. Elements
  // entirely below viewport.height never fire foldBoost.
  const foldBoost = el.rect.y < viewport.height ? 2.0 : 1.0;

  return area * semanticBoost * interactiveBoost * foldBoost;
}

// ─── Internal helpers ────────────────────────────────────────────────────

interface TokenWithOklch {
  hex: string;
  oklch: OKLCH;
}

/**
 * Convert a color token's hex to OKLCH using the same culori path cluster.ts
 * uses. Returns null on parse failure (caller filters).
 */
function tokenToOklch(toOklch: (rgb: unknown) => unknown, hex: string): OKLCH | null {
  const parsed = parseColor(hex);
  if (!parsed) return null;
  const rgb = { mode: 'rgb' as const, r: parsed.r / 255, g: parsed.g / 255, b: parsed.b / 255 };
  const ok = toOklch(rgb) as { l?: number; c?: number; h?: number } | null;
  if (!ok) return null;
  return { l: ok.l ?? 0, c: ok.c ?? 0, h: ok.h ?? 0 };
}

/**
 * Walk all pages' elements, compute each element's weight, and attribute it
 * to the nearest color cluster (by OKLCH ΔE, threshold default 3 — same as
 * cluster.ts's clustering threshold). Returns a map of token-hex → total
 * accumulated visibility-weighted score.
 */
export function aggregateColorWeights(
  pages: Array<{ url: string; elements: ElementStyle[] }>,
  tokens: ColorToken[],
  viewport: Viewport,
  deltaEThreshold: number = 3,
): Map<string, number> {
  const weights = new Map<string, number>();
  if (tokens.length === 0) return weights;

  const toOklch = (culori as { converter: (m: string) => (rgb: unknown) => unknown }).converter('oklch');

  // Pre-compute OKLCH for each token cluster representative. Skip tokens
  // that fail to parse (rare but defensive).
  const tokenOklch: Array<TokenWithOklch | null> = tokens.map((t) => {
    const ok = tokenToOklch(toOklch, t.hex);
    return ok ? { hex: t.hex, oklch: ok } : null;
  });

  for (const page of pages) {
    for (const el of page.elements) {
      const weight = computeElementWeight(el, viewport);
      if (weight === 0) continue;

      // For each non-empty color attribute, attribute weight to nearest
      // cluster within ΔE threshold. If no cluster is within threshold,
      // the observation is silently dropped (won't influence ranking).
      for (const field of COLOR_FIELDS) {
        const raw = el[field];
        if (!raw || typeof raw !== 'string') continue;
        const parsed = parseColor(raw);
        if (!parsed || parsed.a === 0) continue;

        const obsOklch = tokenToOklch(toOklch, raw);
        if (!obsOklch) continue;

        let bestHex: string | null = null;
        let bestDist = Infinity;
        for (const t of tokenOklch) {
          if (!t) continue;
          const dist = deltaE(obsOklch, t.oklch);
          if (dist < bestDist) {
            bestDist = dist;
            bestHex = t.hex;
          }
        }
        if (bestHex !== null && bestDist <= deltaEThreshold) {
          weights.set(bestHex, (weights.get(bestHex) || 0) + weight);
        }
      }
    }
  }

  return weights;
}

export interface ApplyVisibilityResult {
  /** Number of tokens that received a non-zero visibility score. */
  weightedCount: number;
  /** True if the highest-ranked token changed after re-sorting. */
  primaryChanged: boolean;
  /** The hex that ranked first before weighting (frequency-based). */
  previousTopHex: string | null;
  /** The hex that ranks first after weighting (visibility-based). */
  newTopHex: string | null;
  /** Total tokens processed. */
  totalTokens: number;
}

/**
 * The per-page element arrays handed to `applyVisibilityWeighting`. Matches
 * the shape extract.ts hands back on `pageExtractions[i].dom.elements`, but
 * slimmed: only `url` + `elements` are needed for weight attribution.
 */
export interface PageElements {
  url: string;
  elements: ElementStyle[];
}

/**
 * Compute per-token visibility scores from in-memory page element arrays,
 * mutate the on-disk tokens.json to add a `visibilityScore` field to each
 * ColorToken, re-sort `colorTokens` by score descending (tie-break on
 * frequency), and write the updated tokens.json back to disk.
 *
 * Returns a result summary the API route surfaces in the SSE stage event.
 *
 * Safe to call with an empty `pages` array or a missing tokens.json —
 * returns a no-op result and leaves disk state untouched.
 *
 * **No sidecar file on disk.** Earlier versions persisted `elements.json`
 * alongside tokens.json so this function could read it back; that was a
 * 5–20 MB disk round-trip for data we already had in memory. The caller
 * (route.ts) now passes the array directly.
 */
export function applyVisibilityWeighting(
  tokensPath: string,
  pages: PageElements[],
  viewport: Viewport = DEFAULT_VIEWPORT,
): ApplyVisibilityResult {
  if (!fs.existsSync(tokensPath) || !Array.isArray(pages) || pages.length === 0) {
    return { weightedCount: 0, primaryChanged: false, previousTopHex: null, newTopHex: null, totalTokens: 0 };
  }

  const tokens = JSON.parse(fs.readFileSync(tokensPath, 'utf-8'));

  const colorTokens: ColorToken[] = Array.isArray(tokens.colorTokens) ? tokens.colorTokens : [];
  if (colorTokens.length === 0) {
    return { weightedCount: 0, primaryChanged: false, previousTopHex: null, newTopHex: null, totalTokens: 0 };
  }

  const previousTopHex = colorTokens[0].hex;
  const weights = aggregateColorWeights(pages, colorTokens, viewport);

  let weightedCount = 0;
  for (const t of colorTokens) {
    const score = weights.get(t.hex) ?? 0;
    (t as ColorToken & { visibilityScore?: number }).visibilityScore = score;
    if (score > 0) weightedCount++;
  }

  // Re-sort: visibility-weighted score descending; tie-break on the
  // engine's existing frequency count (so two equally-weighted tokens
  // still get a stable, observation-grounded ordering).
  colorTokens.sort((a, b) => {
    const wa = (a as ColorToken & { visibilityScore?: number }).visibilityScore ?? 0;
    const wb = (b as ColorToken & { visibilityScore?: number }).visibilityScore ?? 0;
    if (wa !== wb) return wb - wa;
    return b.frequency - a.frequency;
  });

  const newTopHex = colorTokens[0].hex;
  fs.writeFileSync(tokensPath, JSON.stringify(tokens, null, 2));

  return {
    weightedCount,
    primaryChanged: newTopHex !== previousTopHex,
    previousTopHex,
    newTopHex,
    totalTokens: colorTokens.length,
  };
}

