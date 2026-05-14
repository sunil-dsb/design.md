// Button clustering — replaces the buggy bucketed button extraction in
// cluster.ts with a visual-signature clustering approach.
//
// Why this exists: cluster.ts identifies buttons (any <button>, role=button,
// or styled <a>) and then classifies each into one of FOUR hardcoded
// variant names (Primary / Secondary / Ghost / Destructive) using just
// background luminance + text luminance + redness. The output picks
// `data.elements[0]` as the canonical example — whichever the DOM walker
// happened to see first.
//
// That's not good enough. Real button systems have 6–10 variants
// (Outline / Brand Dark / Filled-Tonal / Text-Link / size tiers) and
// real sites differ on whether the brand color is "dark" (Stripe purple)
// or "mid" (teal CTAs that the luminance check misses).
//
// The replacement pipeline:
//   Phase 1. Identification — tag-based PLUS interaction-state signal
//            (anything with a hover diff IS interactive, near-zero FPs)
//   Phase 2. Clustering — OKLCH ΔE2000 on the (bg, text, border) tuple,
//            with categorical splits for transparent/has-border/has-shadow
//   Phase 3. Variant naming — tied to the role-named color palette
//            (Primary = bg matches `primary`; Outline = transparent + border;
//             Ghost = transparent + no border; Destructive = bg matches
//             `error`; etc). Unnamed clusters get visibility-ordered
//             Secondary / Tertiary / Variant-N fallbacks.
//   Phase 4. Representative pick — by visibility score (reused from
//            visibility-weight.ts), not array position.
//   Phase 5. Size tiers — sub-cluster within each variant by
//            (fontSize, paddingY) to detect sm/md/lg.
//   Phase 6. State merge — for each variant, merge hover/focus/active
//            diffs from interaction-capture across all cluster members.
//
// Mirror discipline: this is an ADD-layer module, sits at lib/engine/
// alongside role-namer / visibility-weight / diagnostics. cluster.ts is
// untouched. We REPLACE the `components[type === 'Button']` entry of the
// on-disk tokens.json with the corrected output; shape stays identical so
// Phase 3 readers (preview-gen, report-gen, prompt-pack, design-md-emit)
// don't need to change.

import * as fs from 'fs';
import { parseColor, parsePxValue, deltaE, type OKLCH } from './cluster';
import { computeElementWeight, type Viewport, DEFAULT_VIEWPORT } from './visibility-weight';
import { assignColorRoles, type ColorRole } from './role-namer';
import type {
  ColorToken,
  ComponentGroup,
  ComponentVariant,
  ElementStyle,
  InteractionCapture,
  InteractionData,
} from './types';
// @ts-expect-error culori has no bundled declarations in this setup
import * as culori from 'culori';

// Re-export viewport so call sites can use the same defaults as weighting.
export { DEFAULT_VIEWPORT, type Viewport };

// ─── Public API ────────────────────────────────────────────────────────────

/** Per-page element + interaction data the clusterer reads. */
export interface PageButtonInput {
  url: string;
  elements: ElementStyle[];
  interactions?: InteractionData;
}

export interface ButtonClusterOptions {
  /** OKLCH ΔE threshold for "same variant" on bg/text/border colours. Default 5. */
  deltaEThreshold?: number;
  /** Tolerance (px) for "same radius". Default 4. */
  radiusTolerancePx?: number;
  /** Tolerance (px) for "same font size". Default 1. */
  fontSizeTolerancePx?: number;
  /** Tolerance (px) for "same vertical padding". Default 4. */
  paddingTolerancePx?: number;
  /** Minimum buttons per cluster to keep. Default 1 (no minimum). */
  minClusterSize?: number;
  /** Pass through a different viewport (matches what extract used). */
  viewport?: Viewport;
}

export interface ButtonClusterResult {
  /** Number of button candidates the identifier accepted across all pages. */
  candidateCount: number;
  /** Number of clusters emitted. */
  variantCount: number;
  /** Tokens.json was mutated. False if no buttons or path was unwritable. */
  mutated: boolean;
}

/**
 * Apply the clustering pipeline to on-disk tokens.json, replacing the
 * `components[type === 'Button']` entry with the improved version.
 *
 * Safe to call when tokens.json is missing, malformed, or has no buttons —
 * leaves disk state untouched and returns a no-op result.
 */
export function applyButtonClustering(
  tokensPath: string,
  pages: PageButtonInput[],
  options: ButtonClusterOptions = {},
): ButtonClusterResult {
  const noop: ButtonClusterResult = { candidateCount: 0, variantCount: 0, mutated: false };
  if (!fs.existsSync(tokensPath) || !Array.isArray(pages) || pages.length === 0) {
    return noop;
  }

  let tokens: {
    colorTokens?: ColorToken[];
    components?: ComponentGroup[];
    [k: string]: unknown;
  };
  try {
    tokens = JSON.parse(fs.readFileSync(tokensPath, 'utf-8'));
  } catch {
    return noop;
  }

  const variants = clusterButtons(pages, tokens.colorTokens ?? [], options);
  const candidateCount = variants.reduce((sum, v) => sum + v.count, 0);

  if (variants.length === 0) return { ...noop, candidateCount };

  // Find or create the Button component group and replace its variants.
  const components = Array.isArray(tokens.components) ? tokens.components : [];
  const idx = components.findIndex((c) => c.type === 'Button');
  const buttonGroup: ComponentGroup = { type: 'Button', variants };
  if (idx >= 0) {
    components[idx] = { ...components[idx], type: 'Button', variants };
  } else {
    components.unshift(buttonGroup);
  }
  tokens.components = components;
  fs.writeFileSync(tokensPath, JSON.stringify(tokens, null, 2));

  return { candidateCount, variantCount: variants.length, mutated: true };
}

/**
 * Pure version — runs the pipeline on in-memory data, returns the variant
 * list without touching disk. Useful in tests and from callers that want to
 * inspect the output before writing.
 */
export function clusterButtons(
  pages: PageButtonInput[],
  colorTokens: ColorToken[],
  options: ButtonClusterOptions = {},
): ComponentVariant[] {
  const opts = {
    deltaEThreshold: 5,
    radiusTolerancePx: 4,
    fontSizeTolerancePx: 1,
    paddingTolerancePx: 4,
    minClusterSize: 1,
    viewport: DEFAULT_VIEWPORT,
    ...options,
  };

  // ── Phase 1: identification ─────────────────────────────────────────
  const interactionLookup = buildInteractionLookup(pages);
  const candidates: ButtonFeature[] = [];
  for (const page of pages) {
    for (const el of page.elements) {
      if (isButtonCandidate(el, interactionLookup)) {
        const feature = featurize(el, page.url, opts.viewport);
        if (feature) candidates.push(feature);
      }
    }
  }

  if (candidates.length === 0) return [];

  // ── Phase 2: cluster on visual signature ────────────────────────────
  const clusters = clusterByVisualSignature(candidates, opts.deltaEThreshold, opts.radiusTolerancePx);

  // Drop clusters smaller than the minimum threshold.
  const kept = clusters.filter((c) => c.length >= opts.minClusterSize);

  // ── Phase 3: name variants via role-tied palette ─────────────────────
  const namedColors = assignColorRoles(colorTokens);
  const roleByHex = new Map<string, ColorRole>();
  for (const c of namedColors) {
    if (c.role) roleByHex.set(c.hex, c.role);
  }

  // Sort clusters by total visibility descending so the most-prominent
  // unnamed cluster gets "Secondary" rather than "Variant-3".
  kept.sort((a, b) => sumVisibility(b) - sumVisibility(a));

  const variants: ComponentVariant[] = [];
  let unnamedIndex = 0;
  const usedNames = new Set<string>();

  for (const cluster of kept) {
    const rep = pickRepresentative(cluster);
    const variantName = nameVariant(rep, namedColors, roleByHex, opts.deltaEThreshold, unnamedIndex, usedNames);
    usedNames.add(variantName);
    if (variantName.startsWith('Variant-') || variantName === 'Secondary' || variantName === 'Tertiary') {
      unnamedIndex++;
    }

    // ── Phase 5: size tiers ─────────────────────────────────────────
    const tiers = detectSizeTiers(cluster, opts.fontSizeTolerancePx, opts.paddingTolerancePx);

    if (tiers.length <= 1) {
      variants.push(buildVariant(variantName, cluster, rep, pages));
    } else {
      const tierLabels = labelTiers(tiers);
      for (let i = 0; i < tiers.length; i++) {
        const tierName = `${variantName} ${tierLabels[i]}`;
        const tierRep = pickRepresentative(tiers[i]);
        variants.push(buildVariant(tierName, tiers[i], tierRep, pages));
      }
    }
  }

  return variants;
}

// ─── Phase 1: identification helpers ───────────────────────────────────────

/** Key shape interaction-capture uses to identify an element. */
function elementKey(el: { tag: string; className?: string; classes?: string }): string {
  const cls = ('className' in el ? el.className : el.classes) ?? '';
  return `${el.tag}|${cls}`;
}

function buildInteractionLookup(pages: PageButtonInput[]): Map<string, InteractionCapture> {
  const map = new Map<string, InteractionCapture>();
  for (const page of pages) {
    const captures = page.interactions?.captures ?? [];
    for (const c of captures) {
      map.set(elementKey(c.element), c);
    }
  }
  return map;
}

function isButtonCandidate(
  el: ElementStyle,
  interactionLookup: Map<string, InteractionCapture>,
): boolean {
  // Tag/role — 95%+ reliable.
  if (el.tag === 'button') return true;
  if (el.role === 'button') return true;

  // Geometry & style features used by the soft signals below.
  const paddingSum =
    (parsePxValue(el.paddingTop) ?? 0) +
    (parsePxValue(el.paddingRight) ?? 0) +
    (parsePxValue(el.paddingBottom) ?? 0) +
    (parsePxValue(el.paddingLeft) ?? 0);
  const radius = parsePxValue(el.borderRadius) ?? 0;
  const bg = parseColor(el.backgroundColor);
  const hasBg = bg !== null && bg.a > 0.05;
  const hasInteraction = interactionLookup.has(elementKey(el));

  // Interactive anchor — strong signal.
  if (el.tag === 'a' && hasInteraction && paddingSum >= 16) return true;

  // Styled anchor without observed interaction (e.g., headless extraction):
  // require bg + radius + padding combined to keep nav-link false-positives out.
  if (el.tag === 'a' && hasBg && radius > 0 && paddingSum >= 16) return true;

  // Interactive div/span — common in React component libraries.
  if ((el.tag === 'div' || el.tag === 'span') && hasInteraction && paddingSum >= 16) {
    return true;
  }

  return false;
}

// ─── Feature vectors ───────────────────────────────────────────────────────

interface ColorChannel {
  hex: string;
  oklch: OKLCH | null;
  alpha: number;
}

interface ButtonFeature {
  el: ElementStyle;
  pageUrl: string;
  bg: ColorChannel | null;
  text: ColorChannel;
  border: { width: number; color: ColorChannel } | null;
  radius: number;
  hasShadow: boolean;
  fontSize: number;
  fontWeight: number;
  paddingX: number;
  paddingY: number;
  visibilityScore: number;
}

function toHex(r: number, g: number, b: number): string {
  return (
    '#' +
    [r, g, b]
      .map((c) => Math.max(0, Math.min(255, Math.round(c))).toString(16).padStart(2, '0'))
      .join('')
  );
}

function toOklch(hex: string): OKLCH | null {
  try {
    const parsed = culori.parse(hex);
    if (!parsed) return null;
    const o = culori.converter('oklch')(parsed);
    if (!o) return null;
    return { l: o.l ?? 0, c: o.c ?? 0, h: o.h ?? 0 };
  } catch {
    return null;
  }
}

function channelFromCss(css: string): ColorChannel | null {
  const rgba = parseColor(css);
  if (!rgba) return null;
  const hex = toHex(rgba.r, rgba.g, rgba.b);
  return { hex, oklch: toOklch(hex), alpha: rgba.a };
}

function featurize(el: ElementStyle, pageUrl: string, viewport: Viewport): ButtonFeature | null {
  const text = channelFromCss(el.color);
  if (!text) return null; // missing text colour — not really a button we can model

  const bgChannel = channelFromCss(el.backgroundColor);
  // Treat low-alpha bg as "no fill" for clustering.
  const bg: ColorChannel | null = bgChannel && bgChannel.alpha >= 0.05 ? bgChannel : null;

  const borderWidth = parsePxValue(el.borderTopWidth) ?? 0;
  const borderColor =
    borderWidth > 0 && el.borderStyle !== 'none' ? channelFromCss(el.borderTopColor) : null;
  const border = borderWidth > 0 && borderColor ? { width: borderWidth, color: borderColor } : null;

  const radius = parsePxValue(el.borderRadius) ?? 0;
  const hasShadow = el.boxShadow !== '' && el.boxShadow !== 'none';

  const fontSize = parsePxValue(el.fontSize) ?? 0;
  const fontWeight = parseInt(el.fontWeight, 10) || 400;
  const paddingX = ((parsePxValue(el.paddingLeft) ?? 0) + (parsePxValue(el.paddingRight) ?? 0)) / 2;
  const paddingY = ((parsePxValue(el.paddingTop) ?? 0) + (parsePxValue(el.paddingBottom) ?? 0)) / 2;

  const visibilityScore = computeElementWeight(el, viewport);

  return {
    el,
    pageUrl,
    bg,
    text,
    border,
    radius,
    hasShadow,
    fontSize,
    fontWeight,
    paddingX,
    paddingY,
    visibilityScore,
  };
}

// ─── Phase 2: clustering ───────────────────────────────────────────────────

function clusterByVisualSignature(
  features: ButtonFeature[],
  deltaEThreshold: number,
  radiusTolerancePx: number,
): ButtonFeature[][] {
  const clusters: ButtonFeature[][] = [];
  for (const f of features) {
    let placed = false;
    for (const cluster of clusters) {
      if (sameVariant(f, cluster[0], deltaEThreshold, radiusTolerancePx)) {
        cluster.push(f);
        placed = true;
        break;
      }
    }
    if (!placed) clusters.push([f]);
  }
  return clusters;
}

function sameVariant(
  a: ButtonFeature,
  b: ButtonFeature,
  deltaEThreshold: number,
  radiusTolerancePx: number,
): boolean {
  // Categorical splits — force separation even if colors are close.
  if ((a.bg === null) !== (b.bg === null)) return false;
  if ((a.border === null) !== (b.border === null)) return false;
  if (a.hasShadow !== b.hasShadow) return false;

  // Background OKLCH ΔE (skip when both transparent).
  if (a.bg && b.bg) {
    if (!a.bg.oklch || !b.bg.oklch) return false;
    if (deltaE(a.bg.oklch, b.bg.oklch) > deltaEThreshold) return false;
  }

  // Text OKLCH ΔE.
  if (!a.text.oklch || !b.text.oklch) return false;
  if (deltaE(a.text.oklch, b.text.oklch) > deltaEThreshold) return false;

  // Border OKLCH ΔE when both have borders.
  if (a.border && b.border) {
    const ac = a.border.color.oklch;
    const bc = b.border.color.oklch;
    if (!ac || !bc) return false;
    if (deltaE(ac, bc) > deltaEThreshold) return false;
  }

  // Radius similarity.
  if (Math.abs(a.radius - b.radius) > radiusTolerancePx) return false;

  return true;
}

// ─── Phase 3: naming ───────────────────────────────────────────────────────

function nameVariant(
  rep: ButtonFeature,
  namedColors: ReturnType<typeof assignColorRoles>,
  _roleByHex: Map<string, ColorRole>,
  deltaEThreshold: number,
  unnamedIndex: number,
  usedNames: Set<string>,
): string {
  // Transparent + border = Outline. Transparent + no border = Ghost.
  if (rep.bg === null) {
    return rep.border ? 'Outline' : 'Ghost';
  }

  // Match background to a named role colour (OKLCH ΔE < 3).
  if (rep.bg.oklch) {
    let bestMatch: { role: NonNullable<ColorRole>; dist: number } | null = null;
    for (const c of namedColors) {
      if (!c.role) continue;
      const cOklch = toOklch(c.hex);
      if (!cOklch) continue;
      const dist = deltaE(rep.bg.oklch, cOklch);
      if (dist < 3 && (bestMatch === null || dist < bestMatch.dist)) {
        bestMatch = { role: c.role, dist };
      }
    }
    if (bestMatch) {
      const labelByRole: Partial<Record<NonNullable<ColorRole>, string>> = {
        primary: 'Primary',
        accent: 'Accent',
        'brand-dark': 'Brand Dark',
        'brand-soft': 'Brand Soft',
        error: 'Destructive',
        success: 'Success',
        warning: 'Warning',
        info: 'Info',
      };
      const label = labelByRole[bestMatch.role];
      if (label && !usedNames.has(label)) return label;
    }
  }

  // Visibility-ordered fallback for unnamed clusters.
  const fallbackOrder = ['Secondary', 'Tertiary'];
  if (unnamedIndex < fallbackOrder.length) {
    return fallbackOrder[unnamedIndex];
  }
  // Use 1-based suffix offset by the fixed-name slots already taken.
  return `Variant-${unnamedIndex - fallbackOrder.length + 1}`;
}

// ─── Phase 4: representative selection ─────────────────────────────────────

function pickRepresentative(cluster: ButtonFeature[]): ButtonFeature {
  // Most visible wins; tie-break on largest area; tie-break on fontSize.
  let best = cluster[0];
  for (let i = 1; i < cluster.length; i++) {
    const c = cluster[i];
    if (c.visibilityScore > best.visibilityScore) {
      best = c;
      continue;
    }
    if (c.visibilityScore === best.visibilityScore) {
      const cArea = c.el.rect.width * c.el.rect.height;
      const bArea = best.el.rect.width * best.el.rect.height;
      if (cArea > bArea) best = c;
    }
  }
  return best;
}

function sumVisibility(cluster: ButtonFeature[]): number {
  let total = 0;
  for (const f of cluster) total += f.visibilityScore;
  return total;
}

// ─── Phase 5: size tiers ───────────────────────────────────────────────────

function detectSizeTiers(
  cluster: ButtonFeature[],
  fontSizeTolerancePx: number,
  paddingTolerancePx: number,
): ButtonFeature[][] {
  if (cluster.length < 2) return [cluster];

  const tiers: ButtonFeature[][] = [];
  for (const f of cluster) {
    let placed = false;
    for (const tier of tiers) {
      const rep = tier[0];
      if (
        Math.abs(f.fontSize - rep.fontSize) <= fontSizeTolerancePx &&
        Math.abs(f.paddingY - rep.paddingY) <= paddingTolerancePx
      ) {
        tier.push(f);
        placed = true;
        break;
      }
    }
    if (!placed) tiers.push([f]);
  }

  // Only emit tiers as separate variants when there are ≥2 distinct
  // groups AND each has at least 1 member that isn't a singleton outlier.
  // Sort by font size ascending so labelTiers can apply sm/md/lg correctly.
  tiers.sort((a, b) => a[0].fontSize - b[0].fontSize);

  // If one tier dominates (>= 80% of members), don't subdivide — single
  // variant entry, even if there are 1–2 outlier sizes.
  const total = cluster.length;
  const dominant = tiers.reduce((max, t) => Math.max(max, t.length), 0);
  if (dominant / total >= 0.8) return [cluster];

  return tiers;
}

function labelTiers(tiers: ButtonFeature[][]): string[] {
  // Ascending font size → sm/md/lg. For 2 tiers use sm/md. For 4+, fall
  // back to numeric suffixes (xs/sm/md/lg) to keep names readable.
  if (tiers.length === 2) return ['sm', 'md'];
  if (tiers.length === 3) return ['sm', 'md', 'lg'];
  if (tiers.length === 4) return ['xs', 'sm', 'md', 'lg'];
  if (tiers.length === 5) return ['xs', 'sm', 'md', 'lg', 'xl'];
  // 6+ — unusual; numeric suffix as failsafe.
  return tiers.map((_, i) => `size-${i + 1}`);
}

// ─── Phase 6: state merge + variant build ──────────────────────────────────

function findInteractionForElement(
  el: ElementStyle,
  pages: PageButtonInput[],
): InteractionCapture | null {
  const key = elementKey(el);
  for (const page of pages) {
    for (const c of page.interactions?.captures ?? []) {
      if (elementKey(c.element) === key) return c;
    }
  }
  // Fallback: tag match + class includes — handles minor className drift
  // (e.g., a hover variant has extra modifier classes).
  for (const page of pages) {
    for (const c of page.interactions?.captures ?? []) {
      if (c.element.tag === el.tag && el.className.includes(c.element.classes)) return c;
    }
  }
  return null;
}

function mostCommonDiff(
  diffs: (Record<string, string> | null)[],
): Record<string, string> | null {
  const nonNull = diffs.filter((d): d is Record<string, string> => d !== null);
  if (nonNull.length === 0) return null;
  // Use JSON-stringified key for equality (ordering-stable per
  // JSON.stringify of an object with consistent key insertion order).
  const counts = new Map<string, { diff: Record<string, string>; count: number }>();
  for (const d of nonNull) {
    const key = JSON.stringify(d);
    const existing = counts.get(key);
    if (existing) existing.count++;
    else counts.set(key, { diff: d, count: 1 });
  }
  let best: { diff: Record<string, string>; count: number } | null = null;
  for (const v of counts.values()) {
    if (!best || v.count > best.count) best = v;
  }
  return best ? best.diff : null;
}

function mergeStates(
  cluster: ButtonFeature[],
  pages: PageButtonInput[],
): {
  hover: Record<string, string> | null;
  focusVisible: Record<string, string> | null;
  focus: Record<string, string> | null;
  active: Record<string, string> | null;
  disabled: Record<string, string> | null;
  transition: string | null;
} {
  const captures = cluster
    .map((f) => findInteractionForElement(f.el, pages))
    .filter((c): c is InteractionCapture => c !== null);

  if (captures.length === 0) {
    return {
      hover: null,
      focusVisible: null,
      focus: null,
      active: null,
      disabled: null,
      transition: cluster[0].el.transition || null,
    };
  }

  const transitions = captures.map((c) => c.transition).filter((t): t is string => !!t);
  return {
    hover: mostCommonDiff(captures.map((c) => c.hoverDiff)),
    focusVisible: mostCommonDiff(captures.map((c) => c.focusVisibleDiff)),
    focus: mostCommonDiff(captures.map((c) => c.focusDiff)),
    active: mostCommonDiff(captures.map((c) => c.activeDiff)),
    disabled: mostCommonDiff(captures.map((c) => c.disabledStyle)),
    transition: transitions[0] ?? cluster[0].el.transition ?? null,
  };
}

function buildVariant(
  name: string,
  cluster: ButtonFeature[],
  rep: ButtonFeature,
  pages: PageButtonInput[],
): ComponentVariant {
  const style: Record<string, string> = {
    backgroundColor: rep.el.backgroundColor,
    color: rep.el.color,
    fontSize: rep.el.fontSize,
    fontWeight: rep.el.fontWeight,
    borderRadius: rep.el.borderRadius,
    padding: `${rep.el.paddingTop} ${rep.el.paddingRight} ${rep.el.paddingBottom} ${rep.el.paddingLeft}`,
  };
  if (rep.el.boxShadow && rep.el.boxShadow !== 'none') {
    style.boxShadow = rep.el.boxShadow;
  }
  if (rep.border) {
    style.borderWidth = rep.el.borderTopWidth;
    style.borderColor = rep.el.borderTopColor;
    style.borderStyle = rep.el.borderStyle;
  }

  const states = mergeStates(cluster, pages);

  const sampleTexts: string[] = [];
  for (const f of cluster) {
    const t = f.el.textContent.trim().slice(0, 40);
    if (t && !sampleTexts.includes(t)) sampleTexts.push(t);
    if (sampleTexts.length >= 3) break;
  }

  return {
    name,
    count: cluster.length,
    style,
    hoverChanges: states.hover,
    focusVisibleChanges: states.focusVisible,
    focusChanges: states.focus,
    activeChanges: states.active,
    disabledStyle: states.disabled,
    transition: states.transition,
    sampleTexts,
  };
}
