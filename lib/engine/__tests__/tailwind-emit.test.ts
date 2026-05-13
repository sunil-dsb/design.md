import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  buildTailwindCss,
  generateAndWriteTailwindCss,
} from '../tailwind-emit';
import { regenerateRampsFromTokens } from '../ramp-regen';
import type {
  ColorToken,
  DesignTokens,
  RadiusToken,
  ShadowToken,
  TypographyLevel,
} from '../types';
import type { RegeneratedRamps } from '../ramp-regen';

// ─── Fixtures ─────────────────────────────────────────────────────────────

function makeColorToken(overrides: Partial<ColorToken> = {}): ColorToken {
  return {
    hex: '#635bff',
    rgba: [99, 91, 255, 1],
    frequency: 100,
    usedAs: {
      textColor: 0,
      bgColor: 10,
      borderColor: 0,
      shadowColor: 0,
      gradientColor: 0,
      iconColor: 0,
    },
    cssVariableNames: [],
    pagesCoverage: 1,
    sourcePages: [],
    confidence: 'high',
    ...overrides,
  };
}

function makeTypoLevel(overrides: Partial<TypographyLevel> = {}): TypographyLevel {
  return {
    fontFamily: 'Inter, system-ui, sans-serif',
    fontSize: '16px',
    fontWeight: '400',
    lineHeight: '24px',
    letterSpacing: 'normal',
    textTransform: null,
    fontFeatureSettings: null,
    frequency: 10,
    typicalTags: ['p'],
    sampleTexts: [],
    confidence: 'high',
    ...overrides,
  };
}

function makeTokens(overrides: Partial<DesignTokens> = {}): DesignTokens {
  return {
    meta: {
      sourceUrls: ['https://example.com'],
      totalPages: 1,
      extractionDate: '2026-05-13T00:00:00Z',
      framework: { tailwind: null, uiFramework: null, designSystemUrl: null },
      totalElements: 0,
      extractionTime: 0,
    },
    colorTokens: [],
    colorRelationships: { scales: [], contrastPairs: [] },
    typographyLevels: [],
    fontInfo: { fontFaces: [], loadedFonts: [], googleFontsLinks: [] },
    spacingSystem: { baseUnit: 4, scale: [], frequencyMap: {}, maxContentWidth: null, sectionSpacing: [] },
    shadowTokens: [],
    radiusTokens: [],
    components: [],
    layoutPatterns: { maxContentWidth: null, commonColumnCounts: [], sectionSpacing: [], contentAlignment: 'centered' },
    iconSystem: null,
    motionSystem: null,
    a11yTokens: {
      focusIndicator: { style: {}, consistent: false },
      contrastPairs: [],
      minTouchTarget: { width: 0, height: 0 },
      minFontSize: '',
    },
    darkMode: {
      supported: false,
      detectionMethod: 'none',
      lightVariables: [],
      darkVariables: [],
      variableDiff: [],
      darkScreenshots: null,
    },
    breakpoints: [],
    gradients: [],
    consistency: { consistent: [], inconsistent: [] },
    cssVariables: [],
    ...overrides,
  };
}

/** A tokens object with a chromatic primary so ramp regen produces a brand ramp. */
function makeChromaticTokens(): DesignTokens {
  return makeTokens({
    colorTokens: [
      makeColorToken({
        hex: '#635bff',
        usedAs: { textColor: 0, bgColor: 30, borderColor: 0, shadowColor: 0, gradientColor: 0, iconColor: 0 },
      }),
      makeColorToken({
        hex: '#ffffff',
        usedAs: { textColor: 0, bgColor: 50, borderColor: 0, shadowColor: 0, gradientColor: 0, iconColor: 0 },
      }),
      makeColorToken({
        hex: '#0a2540',
        usedAs: { textColor: 20, bgColor: 0, borderColor: 0, shadowColor: 0, gradientColor: 0, iconColor: 0 },
      }),
    ],
  });
}

const DEFAULT_OPTS = { url: 'https://example.com', date: '2026-05-13' };

// ─── Color emission ────────────────────────────────────────────────────────

describe('buildTailwindCss — colors', () => {
  it('emits @theme block with brand ramp when ramps.brand is non-null', () => {
    const tokens = makeChromaticTokens();
    const ramps = regenerateRampsFromTokens(tokens);
    const css = buildTailwindCss(tokens, ramps, DEFAULT_OPTS);
    expect(css).toContain('@theme {');
    expect(css).toContain('--color-brand-25:');
    expect(css).toContain('--color-brand-50:');
    expect(css).toContain('--color-brand-500:');
    expect(css).toContain('--color-brand-950:');
  });

  it('emits all 12 brand stops in the correct name order', () => {
    const tokens = makeChromaticTokens();
    const ramps = regenerateRampsFromTokens(tokens);
    const css = buildTailwindCss(tokens, ramps, DEFAULT_OPTS);
    const expected = [25, 50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];
    for (const stop of expected) {
      expect(css).toContain(`--color-brand-${stop}:`);
    }
  });

  it('emits neutral ramp (always present)', () => {
    const tokens = makeChromaticTokens();
    const ramps = regenerateRampsFromTokens(tokens);
    const css = buildTailwindCss(tokens, ramps, DEFAULT_OPTS);
    expect(css).toContain('--color-neutral-25:');
    expect(css).toContain('--color-neutral-500:');
    expect(css).toContain('--color-neutral-950:');
  });

  it('omits brand block when ramps.brand is null', () => {
    const tokens = makeTokens({
      colorTokens: [makeColorToken({ hex: '#808080' })], // grey, no chromatic primary
    });
    const ramps = regenerateRampsFromTokens(tokens);
    expect(ramps.brand).toBeNull();
    const css = buildTailwindCss(tokens, ramps, DEFAULT_OPTS);
    expect(css).not.toContain('--color-brand-');
    expect(css).toContain('--color-neutral-25:');
  });

  it('omits all color vars when ramps is null', () => {
    const tokens = makeTokens();
    const css = buildTailwindCss(tokens, null, DEFAULT_OPTS);
    expect(css).not.toContain('--color-brand-');
    expect(css).not.toContain('--color-neutral-');
    // Other sections should still be emitted (if data exists).
    expect(css).toContain('@theme {');
  });

  it('mentions the seed hex in the brand comment', () => {
    const tokens = makeChromaticTokens();
    const ramps = regenerateRampsFromTokens(tokens);
    const css = buildTailwindCss(tokens, ramps, DEFAULT_OPTS);
    expect(css).toContain(ramps.brand!.seedHex);
  });

  it('labels neutral ramp differently when brand is chromatic vs not', () => {
    const chromaticTokens = makeChromaticTokens();
    const chromaticRamps = regenerateRampsFromTokens(chromaticTokens);
    const chromaticCss = buildTailwindCss(chromaticTokens, chromaticRamps, DEFAULT_OPTS);
    expect(chromaticCss).toMatch(/tinted with brand hue/);

    const greyTokens = makeTokens({
      colorTokens: [makeColorToken({ hex: '#808080' })],
    });
    const greyRamps = regenerateRampsFromTokens(greyTokens);
    const greyCss = buildTailwindCss(greyTokens, greyRamps, DEFAULT_OPTS);
    expect(greyCss).toContain('pure grey');
  });
});

// ─── Typography ───────────────────────────────────────────────────────────

describe('buildTailwindCss — typography', () => {
  it('emits --font-sans only when display + body share a family', () => {
    // Most real sites use one family across headings + body. We emit it as
    // --font-sans (Tailwind v4 idiom: the default body font) and SKIP
    // --font-display because it would be a redundant duplicate of --font-sans.
    const tokens = makeTokens({
      typographyLevels: [
        makeTypoLevel({ fontFamily: '"sohne-var", Inter, sans-serif', fontSize: '56px', fontWeight: '300', typicalTags: ['h1'], frequency: 5 }),
        makeTypoLevel({ fontFamily: '"sohne-var", Inter, sans-serif', fontSize: '16px', fontWeight: '400', typicalTags: ['p'], frequency: 50 }),
      ],
    });
    const css = buildTailwindCss(tokens, null, DEFAULT_OPTS);
    // Hyphenated identifiers like `sohne-var` and `sans-serif` are valid CSS
    // without quotes (matches Tailwind v4's own convention).
    expect(css).toContain('--font-sans: sohne-var, Inter, sans-serif;');
    expect(css).not.toContain('--font-display:');
  });

  it('emits both --font-sans and --font-display when families differ', () => {
    const tokens = makeTokens({
      typographyLevels: [
        makeTypoLevel({ fontFamily: '"Playfair Display", serif', fontSize: '56px', typicalTags: ['h1'], frequency: 5 }),
        makeTypoLevel({ fontFamily: 'Inter, sans-serif', fontSize: '16px', typicalTags: ['p'], frequency: 50 }),
      ],
    });
    const css = buildTailwindCss(tokens, null, DEFAULT_OPTS);
    expect(css).toContain('--font-sans: Inter, sans-serif;');
    expect(css).toContain('--font-display: "Playfair Display", serif;');
  });

  it('emits --font-display alone when only display roles were extracted (no body)', () => {
    const tokens = makeTokens({
      typographyLevels: [
        makeTypoLevel({ fontFamily: 'Inter, sans-serif', fontSize: '56px', typicalTags: ['h1'], frequency: 5 }),
      ],
    });
    const css = buildTailwindCss(tokens, null, DEFAULT_OPTS);
    expect(css).toContain('--font-display: Inter, sans-serif;');
    expect(css).not.toContain('--font-sans:');
  });

  it('quotes family names that contain a space', () => {
    // "PT Sans" needs quotes per the CSS spec (space → invalid bare identifier).
    const tokens = makeTokens({
      typographyLevels: [
        makeTypoLevel({ fontFamily: '"PT Sans", Inter, sans-serif', fontSize: '16px', typicalTags: ['p'] }),
      ],
    });
    const css = buildTailwindCss(tokens, null, DEFAULT_OPTS);
    expect(css).toContain('"PT Sans"');
  });

  it('emits --font-mono when a code/pre level is present', () => {
    const tokens = makeTokens({
      typographyLevels: [
        makeTypoLevel({ fontFamily: 'SourceCodePro, monospace', fontSize: '14px', typicalTags: ['code', 'pre'], frequency: 8 }),
        makeTypoLevel({ fontFamily: 'Inter', fontSize: '16px', typicalTags: ['p'], frequency: 100 }),
      ],
    });
    const css = buildTailwindCss(tokens, null, DEFAULT_OPTS);
    expect(css).toContain('--font-mono: SourceCodePro, monospace;');
  });

  it('omits --font-mono when no monospace family is detected', () => {
    const tokens = makeTokens({
      typographyLevels: [
        makeTypoLevel({ fontFamily: 'Inter', fontSize: '16px', typicalTags: ['p'], frequency: 100 }),
      ],
    });
    const css = buildTailwindCss(tokens, null, DEFAULT_OPTS);
    expect(css).not.toContain('--font-mono:');
  });

  it('emits role-named text sizes with line-height + letter-spacing sub-vars', () => {
    const tokens = makeTokens({
      typographyLevels: [
        makeTypoLevel({
          fontFamily: 'Inter',
          fontSize: '56px',
          fontWeight: '300',
          lineHeight: '57.68px',
          letterSpacing: '-1.4px',
          typicalTags: ['h1'],
          frequency: 5,
        }),
      ],
    });
    const css = buildTailwindCss(tokens, null, DEFAULT_OPTS);
    expect(css).toContain('--text-display-xxl: 56px;');
    expect(css).toContain('--text-display-xxl--line-height: 1.030;');
    expect(css).toContain('--text-display-xxl--letter-spacing: -1.4px;');
    expect(css).toContain('--text-display-xxl--font-weight: 300;');
  });

  it('omits --line-height when line-height is "normal"', () => {
    const tokens = makeTokens({
      typographyLevels: [
        makeTypoLevel({
          fontFamily: 'Inter',
          fontSize: '16px',
          lineHeight: 'normal',
          typicalTags: ['p'],
        }),
      ],
    });
    const css = buildTailwindCss(tokens, null, DEFAULT_OPTS);
    expect(css).toContain('--text-body-md: 16px;');
    expect(css).not.toContain('--text-body-md--line-height:');
  });

  it('omits --font-weight when weight is 400 (Tailwind default)', () => {
    const tokens = makeTokens({
      typographyLevels: [
        makeTypoLevel({ fontFamily: 'Inter', fontSize: '16px', fontWeight: '400', typicalTags: ['p'] }),
      ],
    });
    const css = buildTailwindCss(tokens, null, DEFAULT_OPTS);
    expect(css).not.toContain('--text-body-md--font-weight:');
  });

  it('dedupes typography levels by role (highest frequency per role wins)', () => {
    // Two display-xl candidates (44px and 48px both fall in 44-55 band): the
    // higher-frequency one should be kept and the other dropped.
    const tokens = makeTokens({
      typographyLevels: [
        makeTypoLevel({ fontSize: '48px', frequency: 20, typicalTags: ['h1'] }),
        makeTypoLevel({ fontSize: '44px', frequency: 5, typicalTags: ['h1'] }),
      ],
    });
    const css = buildTailwindCss(tokens, null, DEFAULT_OPTS);
    expect(css).toContain('--text-display-xl: 48px;');
    expect(css).not.toContain('--text-display-xl: 44px;');
  });

  it('omits typography section entirely when no role-classified types', () => {
    const tokens = makeTokens({ typographyLevels: [] });
    const css = buildTailwindCss(tokens, null, DEFAULT_OPTS);
    expect(css).not.toContain('--font-display:');
    expect(css).not.toContain('--text-');
  });
});

// ─── Spacing ──────────────────────────────────────────────────────────────

describe('buildTailwindCss — spacing', () => {
  it('emits --spacing base unit when spacingSystem.baseUnit is set', () => {
    const tokens = makeTokens({
      spacingSystem: { baseUnit: 4, scale: [4, 8, 16], frequencyMap: {}, maxContentWidth: null, sectionSpacing: [] },
    });
    const css = buildTailwindCss(tokens, null, DEFAULT_OPTS);
    expect(css).toContain('--spacing: 4px;');
  });

  it('omits spacing when baseUnit is 0 or undefined', () => {
    const tokens = makeTokens({
      spacingSystem: { baseUnit: 0, scale: [], frequencyMap: {}, maxContentWidth: null, sectionSpacing: [] },
    });
    const css = buildTailwindCss(tokens, null, DEFAULT_OPTS);
    expect(css).not.toContain('--spacing:');
  });
});

// ─── Radius ───────────────────────────────────────────────────────────────

describe('buildTailwindCss — radius', () => {
  function radius(value: string, frequency: number): RadiusToken {
    return { value, frequency, typicalElements: [] };
  }

  it('emits numeric radii sorted ascending with sm/md/lg names', () => {
    const tokens = makeTokens({
      radiusTokens: [
        radius('8px', 10),
        radius('4px', 50),
        radius('6px', 20),
      ],
    });
    const css = buildTailwindCss(tokens, null, DEFAULT_OPTS);
    // sm = smallest (4px), md = middle (6px), lg = largest (8px)
    expect(css).toContain('--radius-sm: 4px;');
    expect(css).toContain('--radius-md: 6px;');
    expect(css).toContain('--radius-lg: 8px;');
  });

  it('caps the numeric scale at 5 stops', () => {
    const tokens = makeTokens({
      radiusTokens: [
        radius('2px', 5),
        radius('4px', 5),
        radius('6px', 5),
        radius('8px', 5),
        radius('12px', 5),
        radius('16px', 5),
        radius('24px', 5),
      ],
    });
    const css = buildTailwindCss(tokens, null, DEFAULT_OPTS);
    // Should emit sm/md/lg/xl/2xl — 5 names total
    const matches = css.match(/--radius-(?:sm|md|lg|xl|2xl):/g) ?? [];
    expect(matches.length).toBe(5);
  });

  it('emits --radius-full for pill/full radii (9999px, 50%, 100%)', () => {
    const tokens = makeTokens({
      radiusTokens: [
        radius('4px', 10),
        radius('9999px', 8),
      ],
    });
    const css = buildTailwindCss(tokens, null, DEFAULT_OPTS);
    expect(css).toContain('--radius-full: 9999px;');
    expect(css).toContain('--radius-sm: 4px;');
  });

  it('emits --radius-full also for 50% / 100%', () => {
    const tokens = makeTokens({
      radiusTokens: [
        radius('50%', 8),
      ],
    });
    const css = buildTailwindCss(tokens, null, DEFAULT_OPTS);
    expect(css).toContain('--radius-full: 9999px;');
  });

  it('does NOT double-emit 9999px as both a numeric stop and --radius-full', () => {
    // Regression test: 9999px matches both /^\d+px$/ and the fullRe pattern.
    // Without explicit exclusion it would land in numerics AND fulls.
    const tokens = makeTokens({
      radiusTokens: [
        radius('4px', 50),
        radius('9999px', 30),
      ],
    });
    const css = buildTailwindCss(tokens, null, DEFAULT_OPTS);
    expect(css).toContain('--radius-sm: 4px;');
    expect(css).toContain('--radius-full: 9999px;');
    // 9999px should NOT appear as a numeric scale stop too.
    expect(css).not.toMatch(/--radius-(?:sm|md|lg|xl|2xl): 9999px;/);
  });

  it('omits radius section when no radii present', () => {
    const tokens = makeTokens({ radiusTokens: [] });
    const css = buildTailwindCss(tokens, null, DEFAULT_OPTS);
    expect(css).not.toContain('--radius-');
  });
});

// ─── Shadows ──────────────────────────────────────────────────────────────

describe('buildTailwindCss — shadows', () => {
  function shadow(value: string, frequency: number, type: ShadowToken['type']): ShadowToken {
    return { value, frequency, type, typicalElements: [] };
  }

  it('emits elevation shadows ordered by elevation proxy', () => {
    const tokens = makeTokens({
      shadowTokens: [
        shadow('0px 16px 32px 0px rgba(0,0,0,0.15)', 5, 'elevation'),  // largest
        shadow('0px 1px 2px 0px rgba(0,0,0,0.08)', 50, 'elevation'),    // smallest
        shadow('0px 8px 16px 0px rgba(0,0,0,0.12)', 30, 'elevation'),   // middle
      ],
    });
    const css = buildTailwindCss(tokens, null, DEFAULT_OPTS);
    // After sorting by elevation: sm=1px,2px / md=8,16 / lg=16,32
    expect(css).toContain('--shadow-sm: 0px 1px 2px 0px rgba(0,0,0,0.08);');
    expect(css).toContain('--shadow-md: 0px 8px 16px 0px rgba(0,0,0,0.12);');
    expect(css).toContain('--shadow-lg: 0px 16px 32px 0px rgba(0,0,0,0.15);');
  });

  it('skips border-shadow and ring types', () => {
    const tokens = makeTokens({
      shadowTokens: [
        shadow('0px 0px 0px 1px rgba(0,0,0,0.1)', 100, 'border-shadow'),
        shadow('0px 0px 0px 3px rgba(83,58,253,0.3)', 100, 'ring'),
        shadow('0px 8px 16px 0px rgba(0,0,0,0.12)', 10, 'elevation'),
      ],
    });
    const css = buildTailwindCss(tokens, null, DEFAULT_OPTS);
    // Only the elevation shadow should appear
    const matches = css.match(/--shadow-\w+:/g) ?? [];
    expect(matches.length).toBe(1);
    expect(css).toContain('--shadow-sm: 0px 8px 16px 0px');
  });

  it('skips elevation/complex-stack shadows that are actually borders (y=0, blur=0)', () => {
    // Regression: Vercel surfaces `rgb(235,235,235) 0px 0px 0px 1px` as a
    // `complex-stack` shadow, but it's a 1px border with no elevation. The
    // emitter must filter on the actual y-offset + blur, not just the type.
    const tokens = makeTokens({
      shadowTokens: [
        shadow('rgb(235, 235, 235) 0px 0px 0px 1px', 100, 'complex-stack'),
        shadow('rgba(0, 0, 0, 0.08) 0px 0px 0px 1px', 50, 'elevation'),
        shadow('0px 8px 16px 0px rgba(0,0,0,0.12)', 10, 'elevation'),
      ],
    });
    const css = buildTailwindCss(tokens, null, DEFAULT_OPTS);
    // Only the genuine elevation (y=8, blur=16) should appear.
    const matches = css.match(/--shadow-\w+:/g) ?? [];
    expect(matches.length).toBe(1);
    expect(css).toContain('--shadow-sm: 0px 8px 16px 0px');
  });

  it('captures elevation from later layers when the stack starts with transparent placeholders', () => {
    // Supabase/Tailwind-preflight pattern: stack starts with one or more
    // transparent `0px 0px 0px 0px` layers and the real elevation lives in
    // a later layer. The elevation proxy must scan ALL layers and take the
    // max, not just the first match.
    const tokens = makeTokens({
      shadowTokens: [
        shadow(
          'rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.1) 0px 10px 15px -3px',
          10,
          'complex-stack',
        ),
      ],
    });
    const css = buildTailwindCss(tokens, null, DEFAULT_OPTS);
    // Should NOT be filtered out (real elevation in layer 3).
    expect(css).toMatch(/--shadow-sm:/);
    expect(css).toContain('0px 10px 15px -3px');
  });

  it('includes inset and complex-stack shadows', () => {
    const tokens = makeTokens({
      shadowTokens: [
        shadow('inset 0px 1px 2px rgba(0,0,0,0.1)', 5, 'inset'),
        shadow('rgba(0,0,0,0.08) 0px 4px 8px 0px, rgba(0,0,0,0.04) 0px 1px 2px 0px', 10, 'complex-stack'),
      ],
    });
    const css = buildTailwindCss(tokens, null, DEFAULT_OPTS);
    expect(css).toMatch(/--shadow-sm:/);
    expect(css).toMatch(/--shadow-md:/);
  });

  it('omits shadow section when no elevation shadows present', () => {
    const tokens = makeTokens({
      shadowTokens: [shadow('0px 0px 0px 1px rgba(0,0,0,0.1)', 100, 'border-shadow')],
    });
    const css = buildTailwindCss(tokens, null, DEFAULT_OPTS);
    expect(css).not.toContain('--shadow-');
  });

  it('caps shadow scale at 5', () => {
    const tokens = makeTokens({
      shadowTokens: [
        shadow('0px 1px 2px 0px rgba(0,0,0,0.05)', 5, 'elevation'),
        shadow('0px 2px 4px 0px rgba(0,0,0,0.06)', 5, 'elevation'),
        shadow('0px 4px 8px 0px rgba(0,0,0,0.08)', 5, 'elevation'),
        shadow('0px 8px 16px 0px rgba(0,0,0,0.10)', 5, 'elevation'),
        shadow('0px 16px 32px 0px rgba(0,0,0,0.12)', 5, 'elevation'),
        shadow('0px 32px 64px 0px rgba(0,0,0,0.14)', 5, 'elevation'),
        shadow('0px 64px 128px 0px rgba(0,0,0,0.16)', 5, 'elevation'),
      ],
    });
    const css = buildTailwindCss(tokens, null, DEFAULT_OPTS);
    const matches = css.match(/--shadow-(?:sm|md|lg|xl|2xl):/g) ?? [];
    expect(matches.length).toBe(5);
  });
});

// ─── Output structure / header ────────────────────────────────────────────

describe('buildTailwindCss — output structure', () => {
  it('starts with a /* ... */ header comment mentioning site + date', () => {
    const tokens = makeChromaticTokens();
    const ramps = regenerateRampsFromTokens(tokens);
    const css = buildTailwindCss(tokens, ramps, { url: 'https://stripe.com', date: '2026-05-13' });
    expect(css.startsWith('/*')).toBe(true);
    expect(css).toContain('stripe');
    expect(css).toContain('2026-05-13');
  });

  it('contains a single @theme block with proper braces', () => {
    const tokens = makeChromaticTokens();
    const ramps = regenerateRampsFromTokens(tokens);
    const css = buildTailwindCss(tokens, ramps, DEFAULT_OPTS);
    const openCount = (css.match(/@theme \{/g) ?? []).length;
    const closeCount = (css.match(/^\}$/gm) ?? []).length;
    expect(openCount).toBe(1);
    expect(closeCount).toBe(1);
  });

  it('ends with a newline', () => {
    const tokens = makeChromaticTokens();
    const ramps = regenerateRampsFromTokens(tokens);
    const css = buildTailwindCss(tokens, ramps, DEFAULT_OPTS);
    expect(css.endsWith('\n')).toBe(true);
  });

  it('is deterministic with a fixed date override', () => {
    const tokens = makeChromaticTokens();
    const ramps = regenerateRampsFromTokens(tokens);
    const a = buildTailwindCss(tokens, ramps, { url: 'https://x.com', date: '2026-05-13' });
    const b = buildTailwindCss(tokens, ramps, { url: 'https://x.com', date: '2026-05-13' });
    expect(a).toBe(b);
  });

  it('does not mutate the input tokens or ramps', () => {
    const tokens = makeChromaticTokens();
    const ramps = regenerateRampsFromTokens(tokens);
    const tokensSnapshot = JSON.stringify(tokens);
    const rampsSnapshot = JSON.stringify(ramps);
    buildTailwindCss(tokens, ramps, DEFAULT_OPTS);
    expect(JSON.stringify(tokens)).toBe(tokensSnapshot);
    expect(JSON.stringify(ramps)).toBe(rampsSnapshot);
  });
});

// ─── generateAndWriteTailwindCss (disk wrapper) ──────────────────────────

describe('generateAndWriteTailwindCss', () => {
  function withTempDir<T>(fn: (dir: string) => T): T {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tailwind-emit-'));
    try {
      return fn(dir);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }

  it('writes tailwind.css next to tokens.json + regenerated-ramp.json', () => {
    withTempDir((dir) => {
      const tokens = makeChromaticTokens();
      const ramps = regenerateRampsFromTokens(tokens);
      fs.writeFileSync(path.join(dir, 'tokens.json'), JSON.stringify(tokens));
      fs.writeFileSync(path.join(dir, 'regenerated-ramp.json'), JSON.stringify(ramps));

      const destPath = generateAndWriteTailwindCss(
        path.join(dir, 'tokens.json'),
        dir,
        'https://example.com',
      );

      expect(destPath).not.toBeNull();
      expect(fs.existsSync(path.join(dir, 'tailwind.css'))).toBe(true);
      const css = fs.readFileSync(path.join(dir, 'tailwind.css'), 'utf-8');
      expect(css).toContain('--color-brand-500:');
      expect(css).toContain('@theme {');
    });
  });

  it('returns null when tokens.json is missing', () => {
    withTempDir((dir) => {
      const result = generateAndWriteTailwindCss(
        path.join(dir, 'absent.json'),
        dir,
        'https://example.com',
      );
      expect(result).toBeNull();
      expect(fs.existsSync(path.join(dir, 'tailwind.css'))).toBe(false);
    });
  });

  it('emits a valid file with no colors when regenerated-ramp.json is missing', () => {
    withTempDir((dir) => {
      const tokens = makeChromaticTokens();
      fs.writeFileSync(path.join(dir, 'tokens.json'), JSON.stringify(tokens));
      // Note: NO regenerated-ramp.json written.

      const destPath = generateAndWriteTailwindCss(
        path.join(dir, 'tokens.json'),
        dir,
        'https://example.com',
      );
      expect(destPath).not.toBeNull();
      const css = fs.readFileSync(path.join(dir, 'tailwind.css'), 'utf-8');
      expect(css).toContain('@theme {');
      expect(css).not.toContain('--color-brand-');
      expect(css).not.toContain('--color-neutral-');
    });
  });

  it('handles a malformed regenerated-ramp.json gracefully (treats as missing)', () => {
    withTempDir((dir) => {
      const tokens = makeChromaticTokens();
      fs.writeFileSync(path.join(dir, 'tokens.json'), JSON.stringify(tokens));
      fs.writeFileSync(path.join(dir, 'regenerated-ramp.json'), 'not json at all');

      const destPath = generateAndWriteTailwindCss(
        path.join(dir, 'tokens.json'),
        dir,
        'https://example.com',
      );
      expect(destPath).not.toBeNull();
      const css = fs.readFileSync(path.join(dir, 'tailwind.css'), 'utf-8');
      expect(css).not.toContain('--color-brand-');
    });
  });
});
