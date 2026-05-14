// Heuristic role naming for the extracted token output.
//
// This is one of "our 7 layers on top of the fork" (plan.md §4). It's the
// piece that turns raw frequency-sorted tokens into named semantic roles
// like Primary / Ink / Canvas matching what getdesignsystem.md does
// without an LLM.
//
// Two passes:
//   - assignColorRoles(): Primary / Ink / Canvas / Canvas Alt / Hairline /
//     Muted / Accent / Brand Dark / Brand Soft / On Primary / semantic
//     Success/Warning/Error/Info
//   - assignTypeRoles(): Display XXL → Pico size bands plus Button / Overline
//
// Signals used, ordered by trust:
//   1. CSS variable name match (`--primary`, `--text`, `--bg`, etc.)  ← strongest
//   2. usedAs context (textColor / bgColor / borderColor count)
//   3. OKLCH coordinates (lightness L, chroma C, hue h)
//   4. Total frequency
//   5. 4-layer stability classification (infrastructure preferred)
//
// Determinism: same tokens.json → same roles every time. No LLM, no API
// calls. Falls back gracefully when signals are weak (returns role: null).

// @ts-expect-error culori has no bundled declarations in this setup
import * as culori from 'culori';
import type { ColorToken, TypographyLevel } from './types';

//  Color roles 

export type ColorRole =
  | 'primary'
  | 'on-primary'
  | 'ink'
  | 'muted'
  | 'canvas'
  | 'canvas-alt'
  | 'hairline'
  | 'accent'
  | 'brand-dark'
  | 'brand-soft'
  | 'success'
  | 'warning'
  | 'error'
  | 'info'
  | null;

/**
 * Display order for named colors when presenting the palette to a human.
 * Primary first (the brand), then Accent (the supporting brand color),
 * then text colors, surfaces, etc. Lower number = earlier in the list.
 * Used by the SPA result panel and the DESIGN.md emitter so the brand
 * identity shows up at the top of both surfaces.
 */
export const ROLE_PRIORITY: Record<NonNullable<ColorRole>, number> = {
  primary: 0,
  accent: 1,
  'brand-dark': 2,
  'brand-soft': 3,
  ink: 4,
  canvas: 5,
  'canvas-alt': 6,
  muted: 7,
  hairline: 8,
  success: 9,
  warning: 10,
  error: 11,
  info: 12,
  'on-primary': 13,
};

/** Score a token by its role for display ordering. Unrole'd tokens sink to 999. */
export function rolePriority(role: ColorRole | undefined | null): number {
  if (!role) return 999;
  return ROLE_PRIORITY[role] ?? 99;
}

const COLOR_ROLE_LABELS: Record<NonNullable<ColorRole>, string> = {
  primary: 'Primary',
  'on-primary': 'On Primary',
  ink: 'Ink',
  muted: 'Muted',
  canvas: 'Canvas',
  'canvas-alt': 'Canvas Alt',
  hairline: 'Hairline',
  accent: 'Accent',
  'brand-dark': 'Brand Dark',
  'brand-soft': 'Brand Soft',
  success: 'Success',
  warning: 'Warning',
  error: 'Error',
  info: 'Info',
};

export interface NamedColor extends ColorToken {
  role: ColorRole;
  roleLabel: string | null;
}

interface ColorWithOklch {
  color: ColorToken;
  oklch: { l: number; c: number; h: number } | null;
}

function toOklch(hex: string): { l: number; c: number; h: number } | null {
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

function cssVarMatches(color: ColorToken, pattern: RegExp): boolean {
  return color.cssVariableNames.some((v) => pattern.test(v));
}

/** Shortest signed distance between two OKLCH hues (-180..180), absolute value. */
function hueDelta(h1: number, h2: number): number {
  const d = ((h1 - h2 + 540) % 360) - 180;
  return Math.abs(d);
}

export function assignColorRoles(colors: ColorToken[]): NamedColor[] {
  const withOklch: ColorWithOklch[] = colors.map((color) => ({
    color,
    oklch: toOklch(color.hex),
  }));

  // Track assigned roles by hex so a color is only labeled once.
  const assigned = new Map<string, ColorRole>();
  const assign = (hex: string, role: ColorRole) => {
    if (!assigned.has(hex)) assigned.set(hex, role);
  };

  //  1. PRIMARY 
  // High chroma + visual prominence + bonus for --primary / --brand css var.
  //
  // When visibility weighting has run (visibilityScore present on tokens),
  // it replaces raw `usedAs.bgColor` count as the prominence signal  the
  // weighted score captures "how visually prominent is this color across
  // all the elements that paint it" (area × fold × interactivity × region),
  // which is structurally better than counting bg-occurrences. dna.md §11.1
  // explicitly identifies this as the fix for the "footer-grey beats brand
  // color via frequency" failure mode.
  //
  // Falls back to the original bgColor count when visibilityScore is
  // absent  preserves behaviour on legacy tokens.json (and the 4 gallery
  // examples which were extracted before this layer existed).
  const primaryCandidates = withOklch
    .filter(({ oklch }) => oklch && oklch.c >= 0.1)
    .map((entry) => {
      const { color, oklch } = entry;
      const visScore = (color as ColorToken & { visibilityScore?: number }).visibilityScore;
      // Prominence signal:
      //   Visibility path: log10(vis + 1) * 30  grows with visibility but
      //     with diminishing returns. The previous `min(vis*25, 60)` saturated
      //     at vis ≈ 2.4, which collapsed all high-visibility tokens to the
      //     same score and let chroma alone decide. On real data that picked
      //     a campaign one-off with no usage (visScore 39) over the actual
      //     button.Primary backgroundColor (visScore 880). log10 keeps
      //     differentiation across the full 1-1000 visScore range observed
      //     in real extractions.
      //   Legacy path: min(usedAs.bgColor, 50) preserved for tokens.json
      //     that predates the visibility-weighting layer.
      const prominenceSignal =
        typeof visScore === 'number'
          ? Math.log10(Math.max(visScore, 0) + 1) * 30
          : Math.min(color.usedAs.bgColor, 50);
      const score =
        (oklch!.c * 50) +
        prominenceSignal +
        (cssVarMatches(color, /(?:^|[-_])(?:primary|brand|accent)(?:[-_]|$)/i) ? 200 : 0) +
        // Penalise pure black/white "high chroma" misreads (shouldn't trigger but defensive).
        (oklch!.l > 0.98 || oklch!.l < 0.05 ? -1000 : 0);
      return { entry, score };
    })
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score);

  if (primaryCandidates.length > 0) {
    assign(primaryCandidates[0].entry.color.hex, 'primary');
  }

  const primaryOklch =
    primaryCandidates.length > 0 ? primaryCandidates[0].entry.oklch : null;

  //  2. CANVAS 
  // Lightest color with significant bg usage. Almost always #ffffff or very near.
  const canvasCandidates = withOklch
    .filter(({ color, oklch }) => oklch && oklch.l > 0.95 && color.usedAs.bgColor > 0)
    .filter(({ color }) => !assigned.has(color.hex))
    .sort((a, b) => {
      const aBoost = cssVarMatches(a.color, /(?:bg|background|canvas|surface)/i) ? 1e6 : 0;
      const bBoost = cssVarMatches(b.color, /(?:bg|background|canvas|surface)/i) ? 1e6 : 0;
      return (b.color.usedAs.bgColor + bBoost) - (a.color.usedAs.bgColor + aBoost);
    });

  if (canvasCandidates.length > 0) {
    assign(canvasCandidates[0].color.hex, 'canvas');
  }

  //  3. CANVAS ALT 
  // Second-lightest distinct background covering significant area.
  const canvasAltCandidates = withOklch
    .filter(({ color, oklch }) => oklch && oklch.l > 0.85 && oklch.l <= 0.97 && color.usedAs.bgColor >= 2)
    .filter(({ color }) => !assigned.has(color.hex))
    .sort((a, b) => b.color.usedAs.bgColor - a.color.usedAs.bgColor);

  if (canvasAltCandidates.length > 0) {
    assign(canvasAltCandidates[0].color.hex, 'canvas-alt');
  }

  //  4. INK 
  // Darkest text color. Strongly prefer slightly-chromatic darks over pure
  // black real brands tint their dark text colors. Stripe uses #061b31,
  // not #000000.
  const inkCandidates = withOklch
    .filter(({ color, oklch }) => oklch && oklch.l < 0.35 && color.usedAs.textColor >= 3)
    .filter(({ color }) => !assigned.has(color.hex))
    .map((entry) => {
      const { color, oklch } = entry;
      const score =
        color.usedAs.textColor +
        (cssVarMatches(color, /(?:^|[-_])(?:text|foreground|content|fg)(?:[-_]|$)/i) ? 100 : 0) +
        // Tint preference: chromatic darks beat pure greys.
        (oklch!.c > 0.02 ? 20 : 0) +
        // Strong preference for stability=infrastructure.
        (color.stability?.layer === 'infrastructure' ? 30 : 0);
      return { entry, score };
    })
    .sort((a, b) => b.score - a.score);

  if (inkCandidates.length > 0) {
    assign(inkCandidates[0].entry.color.hex, 'ink');
  }

  //  5. MUTED 
  // Secondary body text: medium luminance, low chroma, used as textColor.
  const mutedCandidates = withOklch
    .filter(({ color, oklch }) =>
      oklch && oklch.l >= 0.35 && oklch.l <= 0.7 && oklch.c < 0.08 && color.usedAs.textColor >= 3,
    )
    .filter(({ color }) => !assigned.has(color.hex))
    .map(({ color, oklch }) => ({
      color,
      oklch,
      score:
        color.usedAs.textColor +
        (cssVarMatches(color, /(?:muted|secondary|tertiary|placeholder|helper)/i) ? 100 : 0),
    }))
    .sort((a, b) => b.score - a.score);

  if (mutedCandidates.length > 0) {
    assign(mutedCandidates[0].color.hex, 'muted');
  }

  //  6. HAIRLINE 
  // Light grey border color used heavily as borderColor.
  const hairlineCandidates = withOklch
    .filter(({ color, oklch }) => oklch && oklch.l > 0.82 && color.usedAs.borderColor >= 3)
    .filter(({ color }) => !assigned.has(color.hex))
    .map(({ color }) => ({
      color,
      score:
        color.usedAs.borderColor +
        (cssVarMatches(color, /(?:border|divider|hairline|rule|outline)/i) ? 100 : 0),
    }))
    .sort((a, b) => b.score - a.score);

  if (hairlineCandidates.length > 0) {
    assign(hairlineCandidates[0].color.hex, 'hairline');
  }

  //  7. BRAND DARK 
  // Same hue as primary, darker. Used for featured tiers, dashboard chrome.
  if (primaryOklch) {
    const brandDarkCandidates = withOklch
      .filter(({ oklch }) =>
        oklch && oklch.l < primaryOklch.l - 0.1 && oklch.c > 0.04,
      )
      .filter(({ color }) => !assigned.has(color.hex))
      .filter(({ oklch }) => hueDelta(oklch!.h, primaryOklch.h) < 25)
      .sort((a, b) => b.color.frequency - a.color.frequency);

    if (brandDarkCandidates.length > 0) {
      assign(brandDarkCandidates[0].color.hex, 'brand-dark');
    }

    //  8. BRAND SOFT 
    // Same hue as primary, lighter product UI accent / hover state.
    const brandSoftCandidates = withOklch
      .filter(({ oklch }) =>
        oklch && oklch.l > primaryOklch.l + 0.1 && oklch.c > 0.04,
      )
      .filter(({ color }) => !assigned.has(color.hex))
      .filter(({ oklch }) => hueDelta(oklch!.h, primaryOklch.h) < 25)
      .sort((a, b) => b.color.frequency - a.color.frequency);

    if (brandSoftCandidates.length > 0) {
      assign(brandSoftCandidates[0].color.hex, 'brand-soft');
    }
  }

  //  9. ACCENT 
  // Highest-chroma color in a hue family distinct from primary (ΔH > 30°).
  // Visibility-aware: when a weighted score is present, prefer it over raw
  // frequency. Same fallback logic as PRIMARY.
  const accentCandidates = withOklch
    .filter(({ oklch }) => oklch && oklch.c >= 0.1)
    .filter(({ color }) => !assigned.has(color.hex))
    .filter(({ oklch }) => !primaryOklch || hueDelta(oklch!.h, primaryOklch.h) > 30)
    .map(({ color, oklch }) => {
      const visScore = (color as ColorToken & { visibilityScore?: number }).visibilityScore;
      const prominenceSignal =
        typeof visScore === 'number'
          ? Math.min(visScore * 10, 30)
          : Math.log(color.frequency + 1) * 10;
      return {
        color,
        oklch,
        score: oklch!.c * 50 + prominenceSignal,
      };
    })
    .sort((a, b) => b.score - a.score);

  if (accentCandidates.length > 0) {
    assign(accentCandidates[0].color.hex, 'accent');
  }

  //  10. SEMANTIC (success / warning / error / info) 
  // Saturated colors matching standard hue bands, distinct from brand.
  const semanticHues: Array<{ hue: number; tolerance: number; role: NonNullable<ColorRole> }> = [
    { hue: 25, tolerance: 25, role: 'error' }, // Red-orange
    { hue: 145, tolerance: 25, role: 'success' }, // Green
    { hue: 85, tolerance: 18, role: 'warning' }, // Yellow / amber
    { hue: 240, tolerance: 25, role: 'info' }, // Blue
  ];

  for (const { hue, tolerance, role } of semanticHues) {
    const candidates = withOklch
      .filter(({ oklch }) =>
        oklch && oklch.c >= 0.1 && oklch.l > 0.3 && oklch.l < 0.75,
      )
      .filter(({ color }) => !assigned.has(color.hex))
      .filter(({ oklch }) => hueDelta(oklch!.h, hue) < tolerance)
      // Distinct from primary so we don't relabel primary's hue as info.
      .filter(({ oklch }) => !primaryOklch || hueDelta(oklch!.h, primaryOklch.h) > 30)
      .sort((a, b) => b.color.frequency - a.color.frequency);

    if (candidates.length > 0) {
      assign(candidates[0].color.hex, role);
    }
  }

  //  11. ON PRIMARY 
  // White (or near-white) text color, used when primary is dark enough that
  // light text pairs with it.
  if (primaryOklch && primaryOklch.l < 0.65) {
    const onPrimaryCandidate = withOklch
      .filter(({ color, oklch }) => oklch && oklch.l > 0.97 && color.usedAs.textColor > 0)
      .filter(({ color }) => !assigned.has(color.hex))
      .sort((a, b) => b.color.frequency - a.color.frequency)[0];

    if (onPrimaryCandidate) {
      assign(onPrimaryCandidate.color.hex, 'on-primary');
    }
  }

  // Return all colors with roles attached (null for unassigned long-tail).
  return colors.map((color) => {
    const role = assigned.get(color.hex) ?? null;
    return {
      ...color,
      role,
      roleLabel: role ? COLOR_ROLE_LABELS[role] : null,
    };
  });
}

//  Typography roles 

export type TypeRole =
  | 'display-xxl'
  | 'display-xl'
  | 'display-lg'
  | 'display-md'
  | 'heading-lg'
  | 'heading-md'
  | 'heading-sm'
  | 'body-lg'
  | 'body-md'
  | 'body-sm'
  | 'caption'
  | 'micro'
  | 'pico'
  | 'button'
  | 'overline'
  | null;

const TYPE_ROLE_LABELS: Record<NonNullable<TypeRole>, string> = {
  'display-xxl': 'Display XXL',
  'display-xl': 'Display XL',
  'display-lg': 'Display LG',
  'display-md': 'Display MD',
  'heading-lg': 'Heading LG',
  'heading-md': 'Heading MD',
  'heading-sm': 'Heading SM',
  'body-lg': 'Body LG',
  'body-md': 'Body MD',
  'body-sm': 'Body SM',
  caption: 'Caption',
  micro: 'Micro',
  pico: 'Pico',
  button: 'Button',
  overline: 'Overline',
};

export interface NamedType extends TypographyLevel {
  role: TypeRole;
  roleLabel: string | null;
}

export function assignTypeRoles(types: TypographyLevel[]): NamedType[] {
  return types.map((t) => {
    const sizePx = parseFloat(t.fontSize) || 0;
    const weight = parseInt(t.fontWeight, 10) || 400;
    const tags = t.typicalTags || [];
    const isUppercase = t.textTransform === 'uppercase';

    // Eyebrow / overline: small + uppercase + tracked.
    if (isUppercase && sizePx >= 9 && sizePx <= 16) {
      return { ...t, role: 'overline' as const, roleLabel: TYPE_ROLE_LABELS.overline };
    }

    // Button label: medium-bold + small-to-medium size + button/anchor context.
    if (
      weight >= 600 &&
      sizePx >= 12 &&
      sizePx <= 18 &&
      (tags.includes('button') || tags.includes('a'))
    ) {
      return { ...t, role: 'button' as const, roleLabel: TYPE_ROLE_LABELS.button };
    }

    // Heading tags get the heading family regardless of size.
    const isHeadingTag = tags.some((tag) => /^h[1-6]$/i.test(tag));

    // Size-band assignment. Display sizes are ≥24 px; bigger = bigger label.
    let role: NonNullable<TypeRole>;
    if (sizePx >= 56) role = 'display-xxl';
    else if (sizePx >= 44) role = 'display-xl';
    else if (sizePx >= 36) role = 'display-lg';
    else if (sizePx >= 28) role = 'display-md';
    else if (sizePx >= 22) role = isHeadingTag ? 'heading-lg' : 'body-lg';
    else if (sizePx >= 18) role = isHeadingTag ? 'heading-md' : 'body-lg';
    else if (sizePx >= 15) role = isHeadingTag ? 'heading-sm' : 'body-md';
    else if (sizePx >= 13) role = 'body-sm';
    else if (sizePx >= 11) role = 'caption';
    else if (sizePx >= 9) role = 'micro';
    else role = 'pico';

    return { ...t, role, roleLabel: TYPE_ROLE_LABELS[role] };
  });
}
