import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  LIGHTNESS_STOPS,
  STOP_NAMES,
  NEUTRAL_TINT_CHROMA,
  chromaTaper,
  hexToOklch,
  regenerateRamp,
  regenerateRampsFromTokens,
  generateAndWriteRamps,
} from '../ramp-regen';
import type { ColorToken, DesignTokens } from '../types';

//  Fixtures 

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

function makeTokens(colorTokens: ColorToken[]): DesignTokens {
  return {
    meta: {
      sourceUrls: ['https://example.com'],
      totalPages: 1,
      extractionDate: new Date().toISOString(),
      framework: { tailwind: null, uiFramework: null, designSystemUrl: null },
      totalElements: 0,
      extractionTime: 0,
    },
    colorTokens,
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
  };
}

const HEX_PATTERN = /^#[0-9a-f]{6}$/;

//  chromaTaper 

describe('chromaTaper', () => {
  it('returns 0.6 at the lower extreme (i=0)', () => {
    expect(chromaTaper(0, 12)).toBeCloseTo(0.6, 5);
  });

  it('returns 0.6 at the upper extreme (i=N-1)', () => {
    expect(chromaTaper(11, 12)).toBeCloseTo(0.6, 5);
  });

  it('peaks near 1.0 at the midpoint', () => {
    // For N=12 the exact midpoint is between i=5 and i=6; both should be ~0.96+
    expect(chromaTaper(5, 12)).toBeGreaterThan(0.95);
    expect(chromaTaper(6, 12)).toBeGreaterThan(0.95);
  });

  it('is symmetric around the midpoint', () => {
    for (let i = 0; i < 6; i++) {
      const left = chromaTaper(i, 12);
      const right = chromaTaper(11 - i, 12);
      expect(left).toBeCloseTo(right, 6);
    }
  });

  it('monotonically increases from i=0 to the midpoint', () => {
    let prev = chromaTaper(0, 12);
    for (let i = 1; i <= 5; i++) {
      const curr = chromaTaper(i, 12);
      expect(curr).toBeGreaterThanOrEqual(prev);
      prev = curr;
    }
  });

  it('monotonically decreases from the midpoint to i=N-1', () => {
    let prev = chromaTaper(6, 12);
    for (let i = 7; i <= 11; i++) {
      const curr = chromaTaper(i, 12);
      expect(curr).toBeLessThanOrEqual(prev);
      prev = curr;
    }
  });

  it('returns 1.0 for N=1 (degenerate case)', () => {
    expect(chromaTaper(0, 1)).toBe(1.0);
  });
});

//  hexToOklch 

describe('hexToOklch', () => {
  it('parses a 6-digit hex into OKLCH', () => {
    const ok = hexToOklch('#635bff');
    expect(ok).not.toBeNull();
    expect(ok!.l).toBeGreaterThan(0);
    expect(ok!.l).toBeLessThan(1);
    expect(ok!.c).toBeGreaterThan(0);
  });

  it('parses 3-digit hex via culori', () => {
    expect(hexToOklch('#fff')).not.toBeNull();
    expect(hexToOklch('#000')).not.toBeNull();
  });

  it('returns null for unparseable input', () => {
    expect(hexToOklch('not-a-color')).toBeNull();
    expect(hexToOklch('')).toBeNull();
    expect(hexToOklch('#xyz')).toBeNull();
  });

  it('handles pure white (l ~ 1, c ~ 0)', () => {
    const ok = hexToOklch('#ffffff')!;
    expect(ok.l).toBeCloseTo(1, 2);
    expect(ok.c).toBeCloseTo(0, 3);
  });

  it('handles pure black (l ~ 0, c ~ 0)', () => {
    const ok = hexToOklch('#000000')!;
    expect(ok.l).toBeCloseTo(0, 2);
    expect(ok.c).toBeCloseTo(0, 3);
  });

  it('collapses NaN hue (pure greys) to 0', () => {
    const ok = hexToOklch('#808080')!;
    expect(Number.isFinite(ok.h)).toBe(true);
  });
});

//  regenerateRamp 

describe('regenerateRamp', () => {
  it('returns null for an unparseable seed', () => {
    expect(regenerateRamp('not-a-color')).toBeNull();
  });

  it('produces 12 stops', () => {
    const ramp = regenerateRamp('#635bff')!;
    expect(ramp.stops).toHaveLength(12);
  });

  it('stop names match STOP_NAMES (Tailwind-extended)', () => {
    const ramp = regenerateRamp('#635bff')!;
    expect(ramp.stops.map((s) => s.name)).toEqual([...STOP_NAMES]);
  });

  it('stops are ordered lightest-to-darkest', () => {
    const ramp = regenerateRamp('#635bff')!;
    for (let i = 1; i < ramp.stops.length; i++) {
      expect(ramp.stops[i].oklch.l).toBeLessThan(ramp.stops[i - 1].oklch.l);
    }
  });

  it('lightness values match LIGHTNESS_STOPS exactly (canonical, not post-clamp)', () => {
    // The algorithm's claim is "stop i has lightness LIGHTNESS_STOPS[i]".
    // We store the canonical value, not the post-clamp drift (which is
    // sub-perceptual numerical noise). See buildRamp() in ramp-regen.ts.
    const ramp = regenerateRamp('#635bff')!;
    for (let i = 0; i < LIGHTNESS_STOPS.length; i++) {
      expect(ramp.stops[i].oklch.l).toBeCloseTo(LIGHTNESS_STOPS[i], 6);
    }
  });

  it('hue is preserved across every stop (matches seed hue exactly)', () => {
    // We store the synthesis hue (the algorithm's claim that all stops
    // share the seed hue), not the post-clamp hue which can drift by ~1°
    // for chromatic stops and become noise for near-grey stops.
    const ramp = regenerateRamp('#635bff')!;
    const seedHue = ramp.seedOklch.h;
    for (const stop of ramp.stops) {
      expect(stop.oklch.h).toBeCloseTo(seedHue, 6);
    }
  });

  it('chroma is highest near the midpoint, lower at extremes', () => {
    const ramp = regenerateRamp('#635bff')!;
    const midChroma = Math.max(ramp.stops[5].oklch.c, ramp.stops[6].oklch.c);
    expect(ramp.stops[0].oklch.c).toBeLessThan(midChroma);
    expect(ramp.stops[11].oklch.c).toBeLessThan(midChroma);
  });

  it('every stop hex is 6-digit lowercase', () => {
    const ramp = regenerateRamp('#635bff')!;
    for (const stop of ramp.stops) {
      expect(stop.hex).toMatch(HEX_PATTERN);
    }
  });

  it('seedHex is normalised to lowercase', () => {
    const ramp = regenerateRamp('#635BFF')!;
    expect(ramp.seedHex).toBe('#635bff');
  });

  it('algorithm field identifies the curve', () => {
    const ramp = regenerateRamp('#635bff')!;
    expect(ramp.algorithm).toBe('oklch-lightness-curve');
  });

  it('produces a near-white at stop 25 and near-black at stop 950', () => {
    const ramp = regenerateRamp('#635bff')!;
    const stop25 = ramp.stops.find((s) => s.name === 25)!;
    const stop950 = ramp.stops.find((s) => s.name === 950)!;
    expect(stop25.oklch.l).toBeGreaterThan(0.9);
    expect(stop950.oklch.l).toBeLessThan(0.2);
  });

  it('handles a pure grey seed (chroma 0) by emitting a grey ramp', () => {
    const ramp = regenerateRamp('#808080')!;
    for (const stop of ramp.stops) {
      expect(stop.oklch.c).toBeCloseTo(0, 3);
    }
  });

  it('Stripe purple seed produces a recognisable purple ramp', () => {
    // Sanity check on the canonical Stripe brand color.
    const ramp = regenerateRamp('#635bff')!;
    // Midpoint should still read as a chromatic purple (hue ~278°).
    const mid = ramp.stops.find((s) => s.name === 500)!;
    expect(mid.oklch.c).toBeGreaterThan(0.1);
    // Hue is preserved exactly from the seed (we store synthesis hue).
    expect(mid.oklch.h).toBeCloseTo(ramp.seedOklch.h, 6);
  });
});

//  regenerateRampsFromTokens 

describe('regenerateRampsFromTokens', () => {
  it('returns brand ramp + neutral when tokens have a chromatic primary', () => {
    const tokens = makeTokens([
      // High-chroma, prominent bgColor usage → role-namer picks this as primary
      makeColorToken({ hex: '#635bff', usedAs: { textColor: 0, bgColor: 30, borderColor: 0, shadowColor: 0, gradientColor: 0, iconColor: 0 } }),
      makeColorToken({ hex: '#ffffff', usedAs: { textColor: 0, bgColor: 50, borderColor: 0, shadowColor: 0, gradientColor: 0, iconColor: 0 } }),
      makeColorToken({ hex: '#0a2540', usedAs: { textColor: 20, bgColor: 0, borderColor: 0, shadowColor: 0, gradientColor: 0, iconColor: 0 } }),
    ]);
    const result = regenerateRampsFromTokens(tokens);
    expect(result.brand).not.toBeNull();
    expect(result.brand!.seedHex).toBe('#635bff');
    expect(result.brand!.stops).toHaveLength(12);
    expect(result.neutral.stops).toHaveLength(12);
    expect(result.generatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('neutral ramp is tinted (chroma > 0) when brand is chromatic', () => {
    const tokens = makeTokens([
      makeColorToken({ hex: '#635bff', usedAs: { textColor: 0, bgColor: 30, borderColor: 0, shadowColor: 0, gradientColor: 0, iconColor: 0 } }),
    ]);
    const result = regenerateRampsFromTokens(tokens);
    // Mid-neutral has approximately NEUTRAL_TINT_CHROMA. We store the
    // actual post-clamp chroma, which can differ marginally from the
    // requested value due to the OKLCH↔RGB round-trip. Tolerance of 0.001
    // is much smaller than the 0.04 chromatic threshold so consumers
    // can't be confused.
    const midNeutral = result.neutral.stops.find((s) => s.name === 500)!;
    expect(midNeutral.oklch.c).toBeGreaterThan(0);
    expect(midNeutral.oklch.c).toBeCloseTo(NEUTRAL_TINT_CHROMA, 2);
    // Neutral hue inherits the brand hue exactly (synthesis hue).
    expect(midNeutral.oklch.h).toBeCloseTo(result.brand!.seedOklch.h, 6);
  });

  it('returns brand=null + pure grey neutral when no chromatic primary exists', () => {
    const tokens = makeTokens([
      makeColorToken({ hex: '#000000' }),
      makeColorToken({ hex: '#ffffff' }),
      makeColorToken({ hex: '#808080' }),
    ]);
    const result = regenerateRampsFromTokens(tokens);
    expect(result.brand).toBeNull();
    for (const stop of result.neutral.stops) {
      expect(stop.oklch.c).toBeCloseTo(0, 5);
    }
  });

  it('returns brand=null + pure grey neutral when colorTokens is empty', () => {
    const tokens = makeTokens([]);
    const result = regenerateRampsFromTokens(tokens);
    expect(result.brand).toBeNull();
    expect(result.neutral.stops).toHaveLength(12);
  });

  it('uses pure grey neutrals when brand chroma is below CHROMATIC_THRESHOLD', () => {
    // Slightly chromatic but below threshold  role-namer's primary filter
    // requires c >= 0.1 so this wouldn't even get role-named "primary", so
    // brand should be null and neutrals should be pure grey.
    const tokens = makeTokens([
      makeColorToken({ hex: '#7a7a8a' }), // very-low-chroma blueish grey
    ]);
    const result = regenerateRampsFromTokens(tokens);
    expect(result.brand).toBeNull();
    // Pure grey neutrals
    for (const stop of result.neutral.stops) {
      expect(stop.oklch.c).toBeCloseTo(0, 5);
    }
  });

  it('does not mutate the input tokens', () => {
    const original = makeTokens([
      makeColorToken({ hex: '#635bff', usedAs: { textColor: 0, bgColor: 30, borderColor: 0, shadowColor: 0, gradientColor: 0, iconColor: 0 } }),
    ]);
    const snapshot = JSON.stringify(original);
    regenerateRampsFromTokens(original);
    expect(JSON.stringify(original)).toBe(snapshot);
  });

  it('is deterministic  same input → same output', () => {
    const tokens = makeTokens([
      makeColorToken({ hex: '#635bff', usedAs: { textColor: 0, bgColor: 30, borderColor: 0, shadowColor: 0, gradientColor: 0, iconColor: 0 } }),
    ]);
    const a = regenerateRampsFromTokens(tokens);
    const b = regenerateRampsFromTokens(tokens);
    // generatedAt will differ, but the ramp content should be identical.
    expect(a.brand?.stops).toEqual(b.brand?.stops);
    expect(a.neutral.stops).toEqual(b.neutral.stops);
  });
});

//  generateAndWriteRamps (disk wrapper) 

describe('generateAndWriteRamps', () => {
  function withTempDir<T>(fn: (dir: string) => T): T {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ramp-regen-'));
    try {
      return fn(dir);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }

  it('writes regenerated-ramp.json next to tokens.json', () => {
    withTempDir((dir) => {
      const tokensPath = path.join(dir, 'tokens.json');
      const tokens = makeTokens([
        makeColorToken({ hex: '#635bff', usedAs: { textColor: 0, bgColor: 30, borderColor: 0, shadowColor: 0, gradientColor: 0, iconColor: 0 } }),
      ]);
      fs.writeFileSync(tokensPath, JSON.stringify(tokens));

      const result = generateAndWriteRamps(tokensPath, dir);
      expect(result).not.toBeNull();

      const outPath = path.join(dir, 'regenerated-ramp.json');
      expect(fs.existsSync(outPath)).toBe(true);
      const written = JSON.parse(fs.readFileSync(outPath, 'utf-8'));
      expect(written.brand.seedHex).toBe('#635bff');
      expect(written.brand.stops).toHaveLength(12);
      expect(written.neutral.stops).toHaveLength(12);
    });
  });

  it('returns null when tokens.json is missing', () => {
    withTempDir((dir) => {
      const missing = path.join(dir, 'absent.json');
      const result = generateAndWriteRamps(missing, dir);
      expect(result).toBeNull();
      expect(fs.existsSync(path.join(dir, 'regenerated-ramp.json'))).toBe(false);
    });
  });

  it('handles tokens with no chromatic primary  emits brand=null + grey neutral', () => {
    withTempDir((dir) => {
      const tokensPath = path.join(dir, 'tokens.json');
      const tokens = makeTokens([makeColorToken({ hex: '#808080' })]);
      fs.writeFileSync(tokensPath, JSON.stringify(tokens));

      const result = generateAndWriteRamps(tokensPath, dir);
      expect(result).not.toBeNull();
      expect(result!.brand).toBeNull();
      expect(result!.neutral.stops).toHaveLength(12);
    });
  });
});
