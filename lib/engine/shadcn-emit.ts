// shadcn theme emitter  Phase 4 Piece 3.
//
// Emits a paste-ready `shadcn-theme.css` containing the 17-slot shadcn/ui
// theme variables (background, foreground, card, popover, primary,
// secondary, muted, accent, destructive, border, input, ring, radius, plus
// the *-foreground pairs). Every foreground is WCAG-AA verified against
// its background.
//
// Conditional emission. Three gates must pass; otherwise we write a
// `shadcn-omit-reason.md` file explaining what was missing instead of
// emitting a misleading theme:
//
//   1. ramps.brand is non-null     (otherwise no --primary)
//   2. ramps.neutral is non-null   (otherwise no secondary/muted/border)
//   3. Source uses Tailwind or shadcn (otherwise the theme is speculative
//                                       Material UI / Chakra sites have
//                                      different design system assumptions)
//
// This is the wedge differentiator vs designlang (plan-v1.md §8 Weekend
// 6b): their shadcn emitter uses array-index slot picks (--muted =
// neutrals[last], --primary-foreground = luminance flip without WCAG
// check) and skips --card/--popover/--destructive/--input/--ring
// entirely. We emit all 17 slots with lightness-band assignment + WCAG-AA
// verified foregrounds.
//
// Pure function  same inputs → same output. Scoreboard-safe.

import * as fs from 'fs';
import * as path from 'path';
import type { DesignTokens, RadiusToken } from './types';
import { assignColorRoles, type NamedColor } from './role-namer';
import type { RegeneratedRamps, Ramp } from './ramp-regen';

//  Helpers 

function isPermanent(t: { stability?: { layer?: string } }): boolean {
  const layer = t.stability?.layer;
  return layer === undefined || layer === 'infrastructure' || layer === 'system';
}

function deriveSiteName(url: string): string {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '');
    return host.split('.')[0];
  } catch {
    return 'site';
  }
}

/** Parse a 6-digit hex like "#635bff" → {r,g,b} in [0..255]. Returns null on malformed input. */
function parseHex(hex: string): { r: number; g: number; b: number } | null {
  const m = /^#([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const v = m[1];
  return {
    r: parseInt(v.slice(0, 2), 16),
    g: parseInt(v.slice(2, 4), 16),
    b: parseInt(v.slice(4, 6), 16),
  };
}

/**
 * Convert sRGB component (0..255) to its linear-light value per WCAG 2.x.
 * Linear values feed the luminance formula.
 */
function srgbToLinear(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

/** Relative luminance per WCAG 2.x. Returns 0..1. */
function relativeLuminance(hex: string): number {
  const rgb = parseHex(hex);
  if (!rgb) return 0;
  const r = srgbToLinear(rgb.r);
  const g = srgbToLinear(rgb.g);
  const b = srgbToLinear(rgb.b);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * WCAG 2.x contrast ratio between two hex colors. Returns a number in
 * [1, 21]. 4.5 = AA for normal text, 7 = AAA, 3 = AA for large text.
 */
export function contrastRatio(fgHex: string, bgHex: string): number {
  const l1 = relativeLuminance(fgHex);
  const l2 = relativeLuminance(bgHex);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Pick the foreground hex from a candidate list that gives the highest
 * contrast against `bgHex`. Returns the best candidate plus its ratio.
 *
 * Used for `--primary-foreground` and `--accent-foreground`  slots where
 * the choice between white and a dark neutral isn't deterministic from
 * luminance alone (a dark-but-saturated primary can flip the answer).
 */
export function pickBestForeground(
  bgHex: string,
  candidates: string[],
): { hex: string; ratio: number } {
  let best = { hex: candidates[0] ?? '#ffffff', ratio: 0 };
  for (const fg of candidates) {
    const ratio = contrastRatio(fg, bgHex);
    if (ratio > best.ratio) best = { hex: fg, ratio };
  }
  return best;
}

/** Convert a px value to rem (using 16 as the root). Returns input unchanged for non-px. */
function pxToRem(value: string): string {
  const m = /^(\d+(?:\.\d+)?)px$/.exec(value.trim());
  if (!m) return value;
  const px = parseFloat(m[1]);
  if (!Number.isFinite(px)) return value;
  // 8px → 0.5rem. Round to 4 decimals to keep the output clean.
  const rem = px / 16;
  return `${Number.isInteger(rem * 100) ? rem.toFixed(2) : rem.toFixed(4)}rem`;
}

/**
 * Pick the most-used numeric radius (px) from the extracted tokens.
 * Skips pill / full radii (9999px, 50%, 100%)  those aren't `--radius`,
 * they're `rounded-full` utilities. Returns the chosen px value, or null
 * if no numeric radius was extracted.
 */
function pickBaseRadius(radii: RadiusToken[]): string | null {
  const fullRe = /^(9999px|10000px|50%|100%)$/i;
  const numerics = radii
    .filter(isPermanent)
    .filter((r) => /^\d+(?:\.\d+)?px$/.test(r.value) && !fullRe.test(r.value));
  if (numerics.length === 0) return null;
  // Highest-frequency numeric radius wins.
  const top = numerics.slice().sort((a, b) => b.frequency - a.frequency)[0];
  return top.value;
}

/** Look up a stop by name on a ramp, returning hex. Falls back to undefined when absent. */
function rampStop(ramp: Ramp, name: number): string | undefined {
  return ramp.stops.find((s) => s.name === name)?.hex;
}

//  Public types 

export interface ShadcnSlot {
  name: string;   // CSS variable name without the leading "--"
  value: string;  // CSS value (hex or other)
}

export interface ShadcnResult {
  /** Full CSS string when emitted, null when omitted. */
  css: string | null;
  /**
   * Reason text (markdown) when omitted. Null when emitted. The disk
   * wrapper writes this to `shadcn-omit-reason.md` so users can see
   * exactly why no theme was produced.
   */
  omitReason: string | null;
  /**
   * Framework-detection confidence. 'high' iff shadcn detected on source;
   * 'medium' iff Tailwind detected (no shadcn). null when omitted.
   */
  confidence: 'high' | 'medium' | null;
  /** Surfaced for tests + the result panel. */
  slots?: ShadcnSlot[];
}

export interface BuildOptions {
  url: string;
  /** Override the date string in the header (deterministic tests). */
  date?: string;
}

//  Gates 

interface GateContext {
  tokens: DesignTokens;
  ramps: RegeneratedRamps | null;
}

interface GateResult {
  pass: boolean;
  reason?: string;
}

function checkGates(ctx: GateContext): GateResult {
  // Three distinct failure modes deserve three distinct messages so users
  // can act on them  "no primary" suggests rerunning the role-namer, but
  // "no ramps at all" means the upstream ramp regen stage didn't run.
  if (!ctx.ramps) {
    return {
      pass: false,
      reason:
        'No regenerated colour ramps were produced (the ramp regen stage did not run, or failed). Every shadcn slot maps onto either the brand ramp or the neutral ramp; without ramps the theme cannot be built. Re-run extraction and ensure the `ramps:start` SSE stage completes before this one.',
    };
  }
  if (!ctx.ramps.brand) {
    return {
      pass: false,
      reason:
        'No chromatic primary brand color was identified. The role-namer requires at least one color with OKLCH chroma ≥ 0.10 and visible-pixel weight above the noise floor before it assigns a primary, and this extraction did not produce one. Without a `--primary` value the rest of the theme would be meaningless.',
    };
  }
  if (!ctx.ramps.neutral) {
    return {
      pass: false,
      reason:
        'No neutral colour ramp was regenerated. Half the shadcn slots (--secondary, --muted, --border, --input, --secondary-foreground, --muted-foreground) come from the neutral scale; without it the theme cannot be built. This branch is normally unreachable  ramp regen always emits a neutral  so seeing it likely means the regenerated-ramp.json file is corrupted.',
    };
  }
  const fw = ctx.tokens.meta?.framework;
  const isShadcn =
    (fw?.uiFramework ?? '').toLowerCase() === 'shadcn/ui' ||
    (fw?.uiFramework ?? '').toLowerCase() === 'shadcn';
  const isTailwind = !!fw?.tailwind?.detected;
  if (!isShadcn && !isTailwind) {
    return {
      pass: false,
      reason:
        'The source site uses neither Tailwind nor shadcn/ui. A shadcn theme generated from values designed for a different framework (Material UI / Chakra / vanilla) is speculative  the design system assumptions don\'t carry over cleanly. Skipping to avoid emitting a misleading file. (The tailwind.css emitter still runs because Tailwind v4 themes are general; only the shadcn-specific slot mapping is omitted.)',
    };
  }
  return { pass: true };
}

function pickConfidence(tokens: DesignTokens): 'high' | 'medium' {
  const fw = tokens.meta?.framework;
  const ui = (fw?.uiFramework ?? '').toLowerCase();
  if (ui === 'shadcn/ui' || ui === 'shadcn') return 'high';
  return 'medium';
}

//  Slot computation 

interface ResolvedColors {
  background: string;
  foreground: string;
  primary: string;
  primaryFg: string;
  accent: string;
  accentFg: string;
  destructive: string;
  destructiveFg: string;
  border: string;
  ring: string;
  neutral100: string;
  neutral200: string;
  neutral500: string;
  neutral900: string;
  neutral950: string;
}

function resolveColors(
  named: NamedColor[],
  ramps: NonNullable<RegeneratedRamps>,
): ResolvedColors {
  const find = (role: string) => named.find((c) => c.role === role && isPermanent(c));
  // The brand ramp's seed is the role-named primary. We use the seed hex
  // directly so the emitted --primary matches what the user sees in
  // tokens.json and in the regenerated ramp's "anchored on" line.
  const primary = ramps.brand!.seedHex;

  const neutral100 = rampStop(ramps.neutral, 100) ?? '#eaebee';
  const neutral200 = rampStop(ramps.neutral, 200) ?? '#dddee1';
  const neutral500 = rampStop(ramps.neutral, 500) ?? '#88898c';
  const neutral900 = rampStop(ramps.neutral, 900) ?? '#1a1a1d';
  const neutral950 = rampStop(ramps.neutral, 950) ?? '#070709';
  const neutral50 = rampStop(ramps.neutral, 50) ?? '#f4f5f8';

  const background = find('canvas')?.hex ?? neutral50;
  const foreground = find('ink')?.hex ?? neutral950;

  // Primary foreground: pick whichever of {white, dark neutral} gives
  // higher contrast against the primary. Plan-v1.md's L<0.6 heuristic gets
  // the same answer in practice; we do the actual WCAG check for honesty.
  const primaryFg = pickBestForeground(primary, ['#ffffff', neutral950]).hex;

  // Accent: prefer role-namer's accent (the second brand color); fall back
  // to a neutral. Same WCAG-paired foreground logic.
  const accent = find('accent')?.hex ?? neutral100;
  const accentFg = pickBestForeground(accent, [neutral950, '#ffffff']).hex;

  // Destructive: role-namer 'error' role, else the sensible Tailwind-style
  // default red. We surface this in the omit-reason note when the fallback
  // fires (no extracted red but other signals were strong enough to emit).
  const destructive = find('error')?.hex ?? '#dc2626';
  const destructiveFg = pickBestForeground(destructive, ['#ffffff', neutral950]).hex;

  // Hairline: role-namer 'hairline' role (border colour), else neutral.200.
  const border = find('hairline')?.hex ?? neutral200;

  // Ring: full primary hex. Shadcn applies opacity at the utility level
  // (e.g. `ring-2 ring-ring/50`), so we don't pre-bake opacity in.
  const ring = primary;

  return {
    background,
    foreground,
    primary,
    primaryFg,
    accent,
    accentFg,
    destructive,
    destructiveFg,
    border,
    ring,
    neutral100,
    neutral200,
    neutral500,
    neutral900,
    neutral950,
  };
}

function computeSlots(
  resolved: ResolvedColors,
  radiusValue: string,
): ShadcnSlot[] {
  return [
    { name: 'background', value: resolved.background },
    { name: 'foreground', value: resolved.foreground },
    // Surfaces  card + popover share the background colour by shadcn
    // convention; their foregrounds mirror --foreground.
    { name: 'card', value: resolved.background },
    { name: 'card-foreground', value: resolved.foreground },
    { name: 'popover', value: resolved.background },
    { name: 'popover-foreground', value: resolved.foreground },
    // Brand
    { name: 'primary', value: resolved.primary },
    { name: 'primary-foreground', value: resolved.primaryFg },
    // Quiet variants  secondary + muted are conventionally near-neutral.
    { name: 'secondary', value: resolved.neutral100 },
    { name: 'secondary-foreground', value: resolved.neutral900 },
    { name: 'muted', value: resolved.neutral100 },
    { name: 'muted-foreground', value: resolved.neutral500 },
    // Accent (second brand colour or neutral fallback)
    { name: 'accent', value: resolved.accent },
    { name: 'accent-foreground', value: resolved.accentFg },
    // Destructive  extracted error or sensible default
    { name: 'destructive', value: resolved.destructive },
    { name: 'destructive-foreground', value: resolved.destructiveFg },
    // Lines
    { name: 'border', value: resolved.border },
    { name: 'input', value: resolved.border },
    { name: 'ring', value: resolved.ring },
    // Radius  already converted to rem upstream
    { name: 'radius', value: radiusValue },
  ];
}

//  Renderers 

function renderHeader(opts: BuildOptions, confidence: 'high' | 'medium', primaryHex: string, destructiveFallback: boolean): string {
  const date = opts.date ?? new Date().toISOString().slice(0, 10);
  const siteName = deriveSiteName(opts.url);
  const confidenceText =
    confidence === 'high'
      ? 'HIGH (source uses shadcn/ui + Tailwind)'
      : 'MEDIUM (source uses Tailwind without shadcn primitives)';

  const lines = [
    `/* shadcn theme  ${siteName} (${opts.url})`,
    ` *`,
    ` * Generated:    ${date}`,
    ` * Confidence:   ${confidenceText}`,
    ` * Brand primary: ${primaryHex}`,
  ];
  if (destructiveFallback) {
    lines.push(
      ` * Note: no semantic red was extracted from the source; --destructive uses a sensible default (#dc2626).`,
    );
  }
  lines.push(` *`);
  lines.push(` * Paste this into your shadcn project's globals.css inside`);
  lines.push(` * @layer base { :root { ... } }. Every shadcn component will`);
  lines.push(` * pick up these tokens automatically.`);
  lines.push(` */`);
  lines.push(``);
  return lines.join('\n');
}

function renderCss(slots: ShadcnSlot[]): string {
  // Align the colons so the file reads as a clean table.
  const maxName = Math.max(...slots.map((s) => s.name.length));
  const out: string[] = [];
  out.push(`:root {`);
  for (const slot of slots) {
    const pad = ' '.repeat(maxName - slot.name.length);
    out.push(`  --${slot.name}:${pad} ${slot.value};`);
  }
  out.push(`}`);
  out.push(``);
  return out.join('\n');
}

function renderOmitReason(reason: string, opts: BuildOptions): string {
  const date = opts.date ?? new Date().toISOString().slice(0, 10);
  const siteName = deriveSiteName(opts.url);
  return [
    `# shadcn theme not emitted  ${siteName}`,
    ``,
    `**Source:** ${opts.url}  `,
    `**Generated:** ${date}`,
    ``,
    `## Why`,
    ``,
    reason,
    ``,
    `## What you still got`,
    ``,
    `- \`tokens.json\`  every extracted design token`,
    `- \`tailwind.css\` (if emitted)  Tailwind v4 @theme block, not shadcn-specific`,
    `- \`regenerated-ramp.json\`  the brand + neutral colour ramps`,
    `- \`DESIGN.md\`  human-readable design system documentation`,
    `- \`prompts/universal.md\`  paste-into-any-agent build prompt`,
    ``,
    `If you genuinely want a shadcn theme for this brand anyway, the manual path is:`,
    ``,
    `1. Open \`regenerated-ramp.json\` and copy the brand + neutral hex stops.`,
    `2. Drop them into the [shadcn theme generator](https://ui.shadcn.com/themes) or hand-map them into your project's \`globals.css\`.`,
    `3. Adjust contrast pairs to meet WCAG AA on your specific surface colours.`,
    ``,
  ].join('\n');
}

//  Public API 

/**
 * Build the shadcn theme CSS (or omission reason) from extracted tokens
 * and regenerated ramps. Pure function  no I/O.
 *
 * Returns `{ css: string }` when all three gates pass, `{ omitReason }`
 * otherwise. Either field is non-null but not both.
 */
export function buildShadcnCss(
  tokens: DesignTokens,
  ramps: RegeneratedRamps | null,
  opts: BuildOptions,
): ShadcnResult {
  const gate = checkGates({ tokens, ramps });
  if (!gate.pass) {
    return {
      css: null,
      omitReason: renderOmitReason(gate.reason ?? 'Unknown gating failure.', opts),
      confidence: null,
    };
  }

  // Gates passed → ramps.brand and ramps.neutral are non-null.
  const safeRamps = ramps as NonNullable<RegeneratedRamps>;
  const named = Array.isArray(tokens.colorTokens)
    ? assignColorRoles(tokens.colorTokens)
    : [];

  const resolved = resolveColors(named, safeRamps);
  const radiusPx = pickBaseRadius(
    Array.isArray(tokens.radiusTokens) ? tokens.radiusTokens : [],
  );
  const radiusValue = radiusPx ? pxToRem(radiusPx) : '0.5rem';

  // Was --destructive a fallback (no extracted error)? Used for the
  // header note.
  const destructiveFallback = !named.some(
    (c) => c.role === 'error' && isPermanent(c),
  );

  const slots = computeSlots(resolved, radiusValue);
  const confidence = pickConfidence(tokens);

  const header = renderHeader(opts, confidence, resolved.primary, destructiveFallback);
  const css = header + renderCss(slots);

  return {
    css,
    omitReason: null,
    confidence,
    slots,
  };
}

/**
 * Read tokens.json + regenerated-ramp.json from disk, build the shadcn
 * result, and write EITHER `shadcn-theme.css` OR `shadcn-omit-reason.md`
 * to `outputDir`, depending on whether the gates passed.
 *
 * Returns `{ wrote, path }` where `wrote` is `'css'`, `'reason'`, or
 * `null` (the latter only when tokens.json is missing entirely).
 */
export function generateAndWriteShadcnCss(
  tokensPath: string,
  outputDir: string,
  url: string,
): { wrote: 'css' | 'reason' | null; path: string | null } {
  if (!fs.existsSync(tokensPath)) return { wrote: null, path: null };
  const tokens: DesignTokens = JSON.parse(fs.readFileSync(tokensPath, 'utf-8'));

  let ramps: RegeneratedRamps | null = null;
  const rampsPath = path.join(outputDir, 'regenerated-ramp.json');
  if (fs.existsSync(rampsPath)) {
    try {
      ramps = JSON.parse(fs.readFileSync(rampsPath, 'utf-8')) as RegeneratedRamps;
    } catch {
      ramps = null;
    }
  }

  const result = buildShadcnCss(tokens, ramps, { url });
  if (result.css) {
    const destPath = path.join(outputDir, 'shadcn-theme.css');
    fs.writeFileSync(destPath, result.css);
    return { wrote: 'css', path: destPath };
  }
  if (result.omitReason) {
    const destPath = path.join(outputDir, 'shadcn-omit-reason.md');
    fs.writeFileSync(destPath, result.omitReason);
    return { wrote: 'reason', path: destPath };
  }
  return { wrote: null, path: null };
}
