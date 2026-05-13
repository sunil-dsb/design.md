// Tailwind v4 `@theme` emitter — Phase 4 Piece 2.
//
// Takes the regenerated brand + neutral ramps (Piece 1) and the extracted
// typography / spacing / radius / shadow scales from tokens.json, emits a
// paste-ready `tailwind.css` file with a single `@theme { ... }` block.
// Users drop it into their Tailwind v4 project alongside `@import
// "tailwindcss";` and immediately get `bg-brand-500`, `text-display-xxl`,
// `shadow-md`, `rounded-md`, etc. as working utilities.
//
// Why this is the wedge (plan-v1.md §2): every other extraction tool that
// emits Tailwind config (designlang ships v3 `theme.extend`) uses the raw
// observed colors. We use our regenerated 12-stop OKLCH ramps anchored on
// the brand seed, so the emitted scale is coherent — every step has the
// right relationship to every other step. Designers can build with it.
//
// Pure function — same inputs → same output. Scoreboard-safe.

import * as fs from 'fs';
import * as path from 'path';
import type { DesignTokens, RadiusToken, ShadowToken } from './types';
import {
  assignTypeRoles,
  type NamedType,
  type TypeRole,
} from './role-namer';
import type { RegeneratedRamps, Ramp } from './ramp-regen';

// ─── Constants ────────────────────────────────────────────────────────────

/** Tailwind-style size labels for radii and shadows, in ascending order. */
const SCALE_NAMES = ['sm', 'md', 'lg', 'xl', '2xl'] as const;

/** Typography display order — same as prompt-pack.ts. */
const TYPE_DISPLAY_ORDER: NonNullable<TypeRole>[] = [
  'display-xxl',
  'display-xl',
  'display-lg',
  'display-md',
  'heading-lg',
  'heading-md',
  'heading-sm',
  'body-lg',
  'body-md',
  'body-sm',
  'caption',
  'micro',
  'pico',
  'button',
  'overline',
];

/** Shadow types to include — elevation-like only. Border-shadows are borders,
 *  not box-shadow utilities; ring-shadows are focus-state, also separate. */
const ELEVATION_SHADOW_TYPES = new Set(['elevation', 'complex-stack', 'inset']);

// ─── Helpers ──────────────────────────────────────────────────────────────

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

/**
 * Clean up a CSS font-family string. Removes outer quotes from each family,
 * trims, drops empty entries.
 */
function canonicalFamilyStack(fontFamily: string): string {
  return (fontFamily ?? '')
    .split(',')
    .map((p) => p.trim().replace(/^["']|["']$/g, ''))
    .filter(Boolean)
    .map((name) => {
      // Multi-word family names need quotes (CSS spec). Single-word names like
      // "Inter" / "sans-serif" don't. Quote anything with a space or non-
      // identifier character to be safe.
      return /[\s\W]/.test(name) && !/^[a-z-]+$/.test(name)
        ? `"${name}"`
        : name;
    })
    .join(', ');
}

/**
 * Convert a line-height value to a unitless ratio when both size and lh are
 * in px. Same helper as prompt-pack.ts.
 */
function lineHeightRatio(fontSize: string, lineHeight: string): string {
  const sizePx = parseFloat(fontSize);
  const lhPx = parseFloat(lineHeight);
  if (
    Number.isFinite(sizePx) &&
    Number.isFinite(lhPx) &&
    sizePx > 0 &&
    lhPx > 0 &&
    /px\s*$/.test(lineHeight)
  ) {
    return (lhPx / sizePx).toFixed(3);
  }
  return lineHeight;
}

/**
 * Parse the y-offset + blur across ALL layers of a box-shadow value string
 * and return the maximum. Used to rank shadows by elevation.
 *
 * Multi-layer shadows often start with transparent placeholder layers
 * (`rgba(0,0,0,0) 0px 0px 0px 0px, ..., rgba(0,0,0,0.1) 0px 10px 15px -3px`)
 * — Supabase and Tailwind preflight do this. We need to find the
 * dominant elevation across the whole stack, not just the first layer,
 * or we'd misclassify these stacks as borders.
 *
 * Returns 0 when no `<x>px <y>px <blur>px` triple is found — caller treats
 * that as "this is a border-style shadow, not elevation."
 */
function shadowElevationProxy(value: string): number {
  // `g` flag so .exec() walks every match in the string.
  const re = /(-?\d+(?:\.\d+)?)px\s+(-?\d+(?:\.\d+)?)px\s+(-?\d+(?:\.\d+)?)px/g;
  let max = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(value ?? '')) !== null) {
    const y = parseFloat(m[2]);
    const blur = parseFloat(m[3]);
    const proxy = Math.abs(y) + Math.abs(blur);
    if (proxy > max) max = proxy;
  }
  return max;
}

// ─── Section emitters (each returns an array of lines, no trailing blank) ─

function emitRamp(family: string, ramp: Ramp): string[] {
  const out: string[] = [];
  for (const stop of ramp.stops) {
    out.push(`  --color-${family}-${stop.name}: ${stop.hex};`);
  }
  return out;
}

function emitFontFamilies(types: NamedType[]): string[] {
  // Group by role family, then pick the most-used family stack per group.
  const displayRoles = new Set<TypeRole>([
    'display-xxl',
    'display-xl',
    'display-lg',
    'display-md',
    'heading-lg',
    'heading-md',
    'heading-sm',
  ]);
  const bodyRoles = new Set<TypeRole>([
    'body-lg',
    'body-md',
    'body-sm',
    'caption',
    'micro',
    'pico',
    'button',
    'overline',
  ]);

  const accFreq = (filter: (t: NamedType) => boolean) => {
    const freq = new Map<string, number>();
    for (const t of types) {
      if (!filter(t)) continue;
      const stack = canonicalFamilyStack(t.fontFamily);
      if (!stack) continue;
      freq.set(stack, (freq.get(stack) ?? 0) + (t.frequency || 1));
    }
    return [...freq.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  };

  const displayStack = accFreq((t) => displayRoles.has(t.role));
  const sansStack = accFreq((t) => bodyRoles.has(t.role));
  // Mono: any level whose typicalTags include code/pre/kbd/samp, or whose
  // family name contains `mono` / `code` / common monospace identifiers.
  const monoStack = (() => {
    const monoLike = (t: NamedType) => {
      const tags = (t.typicalTags ?? []).map((s) => s.toLowerCase());
      if (tags.some((tag) => ['code', 'pre', 'kbd', 'samp', 'tt'].includes(tag))) return true;
      const fam = t.fontFamily.toLowerCase();
      return /mono|courier|menlo|consolas|sourcecodepro|sf\s?mono|jetbrains/i.test(fam);
    };
    return accFreq(monoLike);
  })();

  // Emission rules:
  //   --font-sans    — the body / default font. Tailwind v4 idiom — the
  //                    `font-sans` utility falls back to this, which is what
  //                    most components use by default.
  //   --font-display — only when the display family genuinely DIFFERS from
  //                    --font-sans. On most sites display + body share a
  //                    family, so this var is omitted and `font-sans` covers
  //                    headings too. When only display roles were extracted
  //                    (sansStack === null), the `!== sansStack` check still
  //                    passes ("Inter" !== null), so --font-display emits
  //                    alone.
  //   --font-mono    — when a monospace family was detected (code/pre tags
  //                    or a family-name pattern match).
  const out: string[] = [];
  if (sansStack) out.push(`  --font-sans: ${sansStack};`);
  if (displayStack && displayStack !== sansStack) {
    out.push(`  --font-display: ${displayStack};`);
  }
  if (monoStack) out.push(`  --font-mono: ${monoStack};`);
  return out;
}

function emitTypeScale(types: NamedType[]): string[] {
  // Dedupe by role (highest-frequency variant per role), keep in display
  // order. Same pattern prompt-pack.ts uses.
  const seenRoles = new Set<TypeRole>();
  const orderedRoles: NamedType[] = [];
  for (const role of TYPE_DISPLAY_ORDER) {
    const candidates = types
      .filter((t) => t.role === role)
      .sort((a, b) => b.frequency - a.frequency);
    if (candidates.length > 0 && !seenRoles.has(role)) {
      seenRoles.add(role);
      orderedRoles.push(candidates[0]);
    }
  }

  const out: string[] = [];
  for (const t of orderedRoles) {
    if (!t.role) continue;
    const name = t.role; // e.g. "display-xxl"
    const size = t.fontSize.trim();
    out.push(`  --text-${name}: ${size};`);
    const lh = lineHeightRatio(t.fontSize, t.lineHeight);
    if (lh && lh !== 'normal') {
      out.push(`  --text-${name}--line-height: ${lh};`);
    }
    if (t.letterSpacing && t.letterSpacing !== 'normal' && t.letterSpacing !== '0px') {
      out.push(`  --text-${name}--letter-spacing: ${t.letterSpacing};`);
    }
    const weight = parseInt(t.fontWeight, 10);
    if (Number.isFinite(weight) && weight !== 400) {
      out.push(`  --text-${name}--font-weight: ${weight};`);
    }
  }
  return out;
}

function emitSpacing(tokens: DesignTokens): string[] {
  const ss = tokens.spacingSystem;
  if (!ss || typeof ss.baseUnit !== 'number' || ss.baseUnit <= 0) return [];
  // Tailwind v4: a single --spacing value derives the whole numeric scale.
  // `p-4` becomes `padding: calc(4 * var(--spacing))`. Setting `--spacing: 4px`
  // matches the most common base unit (and exactly what Tailwind's default is).
  return [`  --spacing: ${ss.baseUnit}px;`];
}

function emitRadii(radii: RadiusToken[]): string[] {
  const permanent = radii.filter(isPermanent);
  // Bucket the "full / pill / round" radii away from the numeric scale.
  // Note: 9999px matches `\d+px` too, so we must EXCLUDE these from the
  // numeric filter or they'd be double-emitted (once as sm/md/lg/xl/2xl
  // by px-value sort, and again as --radius-full).
  const fullRe = /^(9999px|10000px|50%|100%)$/i;
  const fulls = permanent.filter((r) => fullRe.test(r.value));
  const numerics = permanent.filter(
    (r) => /^\d+(\.\d+)?px$/.test(r.value) && !fullRe.test(r.value),
  );

  // Sort numerics by frequency desc, take top 5, then sort those by px asc
  // and name them sm/md/lg/xl/2xl.
  const top = numerics
    .slice()
    .sort((a, b) => b.frequency - a.frequency)
    .slice(0, SCALE_NAMES.length)
    .sort((a, b) => parseFloat(a.value) - parseFloat(b.value));

  const out: string[] = [];
  for (let i = 0; i < top.length; i++) {
    out.push(`  --radius-${SCALE_NAMES[i]}: ${top[i].value};`);
  }
  if (fulls.length > 0) {
    out.push(`  --radius-full: 9999px;`);
  }
  return out;
}

function emitShadows(shadows: ShadowToken[]): string[] {
  // First filter: only stable shadows tagged as elevation-like. Second
  // filter: shadows with y=0 AND blur=0 are pure borders (1px rings, focus
  // outlines) regardless of how the extractor labelled them — exclude
  // those too. Otherwise sites like Vercel surface a `0px 0px 0px 1px`
  // ring as `--shadow-lg`, which is wrong: Tailwind's `shadow-*` utilities
  // are for elevation, not borders.
  const candidates = shadows
    .filter(isPermanent)
    .filter((s) => ELEVATION_SHADOW_TYPES.has(s.type))
    .filter((s) => shadowElevationProxy(s.value) > 0);
  if (candidates.length === 0) return [];

  // Top 5 by frequency, then re-sort by elevation proxy (y-offset + blur) so
  // sm/md/lg/xl/2xl line up with perceived elevation.
  const top = candidates
    .slice()
    .sort((a, b) => b.frequency - a.frequency)
    .slice(0, SCALE_NAMES.length)
    .sort((a, b) => shadowElevationProxy(a.value) - shadowElevationProxy(b.value));

  const out: string[] = [];
  for (let i = 0; i < top.length; i++) {
    out.push(`  --shadow-${SCALE_NAMES[i]}: ${top[i].value};`);
  }
  return out;
}

// ─── Public API ───────────────────────────────────────────────────────────

export interface BuildOptions {
  /** Used in the file header comment. */
  url: string;
  /** Override the date string in the header (for deterministic tests). */
  date?: string;
}

/**
 * Build the full Tailwind v4 `@theme` CSS as a string. Pure function — no
 * I/O, no environment access.
 *
 * Applies role-namer in-memory so typography levels carry their role
 * labels. The caller's tokens / ramps objects are NOT mutated.
 *
 * Pass `ramps: null` if regenerated ramps weren't produced; the file will
 * omit the color section but still emit typography / spacing / radius /
 * shadow sections.
 */
export function buildTailwindCss(
  tokens: DesignTokens,
  ramps: RegeneratedRamps | null,
  opts: BuildOptions,
): string {
  const siteName = deriveSiteName(opts.url);
  const date = opts.date ?? new Date().toISOString().slice(0, 10);

  // ── Header comment ─────────────────────────────────────────────────
  const headerLines: string[] = [];
  headerLines.push(`/* Tailwind v4 @theme — ${siteName} (${opts.url})`);
  headerLines.push(` *`);
  headerLines.push(` * Generated: ${date}`);
  if (ramps?.brand) {
    headerLines.push(
      ` * Brand ramp seed: ${ramps.brand.seedHex} (algorithm: ${ramps.brand.algorithm})`,
    );
  }
  headerLines.push(` *`);
  headerLines.push(
    ` * Paste this into your project. If you already have an @import "tailwindcss";`,
  );
  headerLines.push(
    ` * line, drop the @theme block alongside it; otherwise paste the whole file.`,
  );
  headerLines.push(` */`);
  headerLines.push(``);

  // ── Section blocks ─────────────────────────────────────────────────
  const themeLines: string[] = [];
  themeLines.push(`@theme {`);

  // Colors
  if (ramps?.brand) {
    themeLines.push(`  /* Brand ramp — regenerated 12-stop OKLCH, anchored on ${ramps.brand.seedHex}. */`);
    themeLines.push(...emitRamp('brand', ramps.brand));
    themeLines.push(``);
  }
  if (ramps?.neutral) {
    const neutralLabel =
      ramps.brand && ramps.brand.seedOklch.c >= 0.04
        ? `tinted with brand hue ${ramps.neutral.seedOklch.h.toFixed(0)}° at chroma ${ramps.neutral.seedOklch.c.toFixed(3)}`
        : 'pure grey';
    themeLines.push(`  /* Neutral ramp — ${neutralLabel}. */`);
    themeLines.push(...emitRamp('neutral', ramps.neutral));
    themeLines.push(``);
  }

  // Typography
  const types: NamedType[] = Array.isArray(tokens.typographyLevels)
    ? assignTypeRoles(tokens.typographyLevels).filter(isPermanent)
    : [];
  const familyLines = emitFontFamilies(types);
  const typeScaleLines = emitTypeScale(types);
  if (familyLines.length > 0) {
    themeLines.push(`  /* Type families */`);
    themeLines.push(...familyLines);
    themeLines.push(``);
  }
  if (typeScaleLines.length > 0) {
    themeLines.push(`  /* Type scale (role-named — e.g. \`text-display-xxl\`, \`text-body-md\`). */`);
    themeLines.push(...typeScaleLines);
    themeLines.push(``);
  }

  // Spacing
  const spacingLines = emitSpacing(tokens);
  if (spacingLines.length > 0) {
    themeLines.push(`  /* Spacing base unit — Tailwind derives the whole numeric scale from this. */`);
    themeLines.push(...spacingLines);
    themeLines.push(``);
  }

  // Radius
  const radii = Array.isArray(tokens.radiusTokens) ? tokens.radiusTokens : [];
  const radiusLines = emitRadii(radii);
  if (radiusLines.length > 0) {
    themeLines.push(`  /* Border radius */`);
    themeLines.push(...radiusLines);
    themeLines.push(``);
  }

  // Shadows
  const shadows = Array.isArray(tokens.shadowTokens) ? tokens.shadowTokens : [];
  const shadowLines = emitShadows(shadows);
  if (shadowLines.length > 0) {
    themeLines.push(`  /* Shadows (elevation only — border-shadows and rings are emitted separately). */`);
    themeLines.push(...shadowLines);
    themeLines.push(``);
  }

  // Drop the trailing blank line before the closing brace if present.
  while (themeLines[themeLines.length - 1] === '') themeLines.pop();
  themeLines.push(`}`);
  themeLines.push(``);

  return headerLines.join('\n') + themeLines.join('\n');
}

/**
 * Read tokens.json and regenerated-ramp.json from disk, build the Tailwind
 * CSS, write it to `<outputDir>/tailwind.css`.
 *
 * Returns the absolute path of the written file on success, or null when
 * tokens.json is missing. If regenerated-ramp.json is missing, emits a
 * valid file with the colour section omitted (callers should usually
 * ensure ramp regeneration ran first, but this is defensive).
 */
export function generateAndWriteTailwindCss(
  tokensPath: string,
  outputDir: string,
  url: string,
): string | null {
  if (!fs.existsSync(tokensPath)) return null;
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

  const css = buildTailwindCss(tokens, ramps, { url });
  const destPath = path.join(outputDir, 'tailwind.css');
  fs.writeFileSync(destPath, css);
  return destPath;
}
