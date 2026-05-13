import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  scorePrimary,
  scorePalette,
  scoreTypography,
  scoreSpacing,
  scoreTokens,
  scoreExtraction,
  computeComposite,
  goldPathFor,
  PRIMARY_PASS_DELTA_E,
  DELTA_E_MATCH,
  type OverallScore,
} from '../score';
import type { GoldTokens } from '../gold/types';
import type { ColorToken, DesignTokens, TypographyLevel } from '../../lib/engine/types';

// ─── Fixtures ─────────────────────────────────────────────────────────────

function makeColorToken(over: Partial<ColorToken> = {}): ColorToken {
  return {
    hex: '#635bff',
    rgba: [99, 91, 255, 1],
    frequency: 100,
    usedAs: { textColor: 0, bgColor: 0, borderColor: 0, shadowColor: 0, gradientColor: 0, iconColor: 0 },
    cssVariableNames: [],
    pagesCoverage: 1,
    sourcePages: [],
    confidence: 'high',
    ...over,
  };
}

function makeTypoLevel(over: Partial<TypographyLevel> = {}): TypographyLevel {
  return {
    fontFamily: '"Inter", sans-serif',
    fontSize: '16px',
    fontWeight: '400',
    lineHeight: '1.5',
    letterSpacing: 'normal',
    textTransform: null,
    fontFeatureSettings: null,
    frequency: 100,
    typicalTags: ['p'],
    sampleTexts: [],
    confidence: 'high',
    ...over,
  };
}

function makeGold(over: Partial<GoldTokens> = {}): GoldTokens {
  return {
    brand: 'test',
    url: 'https://test.com/',
    verifiedAt: '2026-05-12',
    verifiedBy: 'unit test',
    colors: {
      primary: { hex: '#635bff', name: 'Iris' },
      paletteHexes: ['#635bff', '#000000', '#ffffff', '#3ecf8e'],
    },
    typography: {
      display: { family: 'Inter' },
      body: { family: 'Inter' },
    },
    spacing: {
      baseUnit: 4,
      scale: [4, 8, 12, 16, 24, 32, 48],
    },
    ...over,
  };
}

// ─── scorePrimary ─────────────────────────────────────────────────────────

describe('scorePrimary', () => {
  it('returns deltaE=0 + pass when extracted matches gold exactly', () => {
    const tokens = [
      Object.assign(makeColorToken({ hex: '#635bff' }), { role: 'primary' }),
    ];
    const result = scorePrimary(tokens, makeGold());
    expect(result.deltaE).toBeLessThan(0.5);
    expect(result.pass).toBe(true);
    expect(result.extracted).toBe('#635bff');
  });

  it('passes when ΔE is below the configured threshold', () => {
    // #635aff is one byte off from #635bff — perceptually identical.
    const tokens = [
      Object.assign(makeColorToken({ hex: '#635aff' }), { role: 'primary' }),
    ];
    const result = scorePrimary(tokens, makeGold());
    expect(result.deltaE).toBeLessThan(PRIMARY_PASS_DELTA_E);
    expect(result.pass).toBe(true);
  });

  it('fails when extracted primary is a very different color', () => {
    const tokens = [
      Object.assign(makeColorToken({ hex: '#ff0000' }), { role: 'primary' }),
    ];
    const result = scorePrimary(tokens, makeGold());
    expect(result.deltaE).toBeGreaterThan(PRIMARY_PASS_DELTA_E);
    expect(result.pass).toBe(false);
  });

  it('fails with deltaE=Infinity when no primary role is assigned', () => {
    const tokens = [makeColorToken({ hex: '#635bff' })]; // no role
    const result = scorePrimary(tokens, makeGold());
    expect(result.extracted).toBe(null);
    expect(result.deltaE).toBe(Infinity);
    expect(result.pass).toBe(false);
  });

  it('handles missing colorTokens gracefully', () => {
    const result = scorePrimary(undefined, makeGold());
    expect(result.pass).toBe(false);
    expect(result.extracted).toBe(null);
  });
});

// ─── scorePalette ─────────────────────────────────────────────────────────

describe('scorePalette', () => {
  it('returns perfect F1 when extracted palette = gold palette exactly', () => {
    const tokens = [
      makeColorToken({ hex: '#635bff' }),
      makeColorToken({ hex: '#000000' }),
      makeColorToken({ hex: '#ffffff' }),
      makeColorToken({ hex: '#3ecf8e' }),
    ];
    const result = scorePalette(tokens, makeGold());
    expect(result.matched).toBe(4);
    expect(result.recall).toBe(1);
    expect(result.precision).toBe(1);
    expect(result.f1).toBe(1);
  });

  it('returns recall=0 when no extracted matches any gold', () => {
    const tokens = [
      makeColorToken({ hex: '#abcdef' }),
      makeColorToken({ hex: '#fedcba' }),
    ];
    const result = scorePalette(tokens, makeGold());
    expect(result.matched).toBe(0);
    expect(result.recall).toBe(0);
    expect(result.precision).toBe(0);
    expect(result.f1).toBe(0);
  });

  it('returns partial recall when extracted covers some but not all gold', () => {
    const tokens = [
      makeColorToken({ hex: '#635bff' }), // matches gold[0]
      makeColorToken({ hex: '#000000' }), // matches gold[1]
      // misses #ffffff and #3ecf8e
    ];
    const result = scorePalette(tokens, makeGold());
    expect(result.matched).toBe(2);
    expect(result.recall).toBeCloseTo(0.5);
    expect(result.precision).toBe(1); // every extracted matches
  });

  it('returns precision <1 when extracted has many non-gold colors', () => {
    const tokens = [
      makeColorToken({ hex: '#635bff' }), // match
      makeColorToken({ hex: '#aaaaaa' }), // noise
      makeColorToken({ hex: '#bbbbbb' }), // noise
      makeColorToken({ hex: '#cccccc' }), // noise
    ];
    const result = scorePalette(tokens, makeGold());
    expect(result.precision).toBe(0.25);
  });

  it('handles empty extracted array', () => {
    const result = scorePalette([], makeGold());
    expect(result.matched).toBe(0);
    expect(result.recall).toBe(0);
    expect(result.precision).toBe(0);
    expect(result.f1).toBe(0);
    expect(result.extractedCount).toBe(0);
  });
});

// ─── scoreTypography ──────────────────────────────────────────────────────

describe('scoreTypography', () => {
  it('passes when display family matches gold', () => {
    const levels = [
      makeTypoLevel({ fontFamily: '"Inter", sans-serif', typicalTags: ['h1'], frequency: 5 }),
      makeTypoLevel({ fontFamily: '"Inter", sans-serif', typicalTags: ['p'], frequency: 50 }),
    ];
    const result = scoreTypography(levels, makeGold());
    expect(result.display.pass).toBe(true);
    expect(result.display.extracted).toBe('inter');
    expect(result.body.pass).toBe(true);
  });

  it('fails when display family is wrong', () => {
    const levels = [
      makeTypoLevel({ fontFamily: '"Helvetica", sans-serif', typicalTags: ['h1'] }),
    ];
    const result = scoreTypography(levels, makeGold());
    expect(result.display.pass).toBe(false);
    expect(result.display.extracted).toBe('helvetica');
    expect(result.display.gold).toBe('inter');
  });

  it('strips quotes and lowercases for canonical comparison', () => {
    const levels = [
      makeTypoLevel({ fontFamily: "'INTER', sans-serif", typicalTags: ['h1'] }),
    ];
    const result = scoreTypography(levels, makeGold());
    expect(result.display.pass).toBe(true);
  });

  it('handles empty typography levels', () => {
    const result = scoreTypography([], makeGold());
    expect(result.display.extracted).toBe(null);
    expect(result.display.pass).toBe(false);
  });
});

// ─── scoreSpacing ─────────────────────────────────────────────────────────

describe('scoreSpacing', () => {
  it('passes baseUnit and recall when extracted matches gold', () => {
    const spacing: DesignTokens['spacingSystem'] = {
      baseUnit: 4,
      scale: [4, 8, 12, 16, 24, 32, 48],
      frequencyMap: {},
      maxContentWidth: null,
      sectionSpacing: [],
    };
    const result = scoreSpacing(spacing, makeGold());
    expect(result.baseUnit.pass).toBe(true);
    expect(result.scaleRecall).toBe(1);
    expect(result.scaleMae).toBe(0);
  });

  it('partial recall when extracted misses some gold steps', () => {
    const spacing: DesignTokens['spacingSystem'] = {
      baseUnit: 4,
      scale: [4, 8, 16, 32], // missing 12, 24, 48
      frequencyMap: {},
      maxContentWidth: null,
      sectionSpacing: [],
    };
    const result = scoreSpacing(spacing, makeGold());
    // 4 of 7 gold steps present (4, 8, 16, 32)
    expect(result.scaleRecall).toBeCloseTo(4 / 7);
  });

  it('baseUnit fails when wrong', () => {
    const spacing: DesignTokens['spacingSystem'] = {
      baseUnit: 8, // gold says 4
      scale: [8, 16, 24],
      frequencyMap: {},
      maxContentWidth: null,
      sectionSpacing: [],
    };
    const result = scoreSpacing(spacing, makeGold());
    expect(result.baseUnit.pass).toBe(false);
    expect(result.baseUnit.extracted).toBe(8);
    expect(result.baseUnit.gold).toBe(4);
  });

  it('handles missing spacingSystem', () => {
    const result = scoreSpacing(undefined, makeGold());
    expect(result.baseUnit.pass).toBe(false);
    expect(result.scaleRecall).toBe(0);
  });
});

// ─── computeComposite ─────────────────────────────────────────────────────

describe('computeComposite', () => {
  it('returns 100 for a perfect extraction', () => {
    const composite = computeComposite({
      colors: {
        primary: { extracted: '#635bff', gold: '#635bff', deltaE: 0, pass: true },
        palette: { matched: 4, recall: 1, precision: 1, f1: 1, extractedCount: 4, goldCount: 4 },
      },
      typography: {
        display: { extracted: 'inter', gold: 'inter', pass: true },
        body: { extracted: 'inter', gold: 'inter', pass: true },
      },
      spacing: {
        baseUnit: { extracted: 4, gold: 4, pass: true },
        scaleRecall: 1,
        scaleMae: 0,
      },
    });
    expect(composite).toBe(100);
  });

  it('returns 0 for an empty extraction', () => {
    const composite = computeComposite({
      colors: {
        primary: { extracted: null, gold: '#635bff', deltaE: Infinity, pass: false },
        palette: { matched: 0, recall: 0, precision: 0, f1: 0, extractedCount: 0, goldCount: 4 },
      },
      typography: {
        display: { extracted: null, gold: 'inter', pass: false },
        body: { extracted: null, gold: 'inter', pass: false },
      },
      spacing: {
        baseUnit: { extracted: null, gold: 4, pass: false },
        scaleRecall: 0,
        scaleMae: Infinity,
      },
    });
    expect(composite).toBe(0);
  });

  it('rewards partial-credit primary picks (within 2× threshold)', () => {
    // ΔE between threshold and 2× threshold → 15 points instead of 0 or 30.
    const composite = computeComposite({
      colors: {
        primary: { extracted: '#x', gold: '#y', deltaE: PRIMARY_PASS_DELTA_E + 1, pass: false },
        palette: { matched: 0, recall: 0, precision: 0, f1: 0, extractedCount: 1, goldCount: 4 },
      },
      typography: {
        display: { extracted: null, gold: 'inter', pass: false },
        body: { extracted: null, gold: 'inter', pass: false },
      },
      spacing: {
        baseUnit: { extracted: null, gold: 4, pass: false },
        scaleRecall: 0,
        scaleMae: Infinity,
      },
    });
    // Primary partial (15) + coverage floor (10) = 25
    expect(composite).toBe(25);
  });
});

// ─── DELTA_E_MATCH exported ───────────────────────────────────────────────

describe('exported thresholds', () => {
  it('exposes DELTA_E_MATCH and PRIMARY_PASS_DELTA_E for tuning', () => {
    expect(typeof DELTA_E_MATCH).toBe('number');
    expect(typeof PRIMARY_PASS_DELTA_E).toBe('number');
  });
});

// ─── scoreTokens (in-memory end-to-end) ──────────────────────────────────

describe('scoreTokens', () => {
  it('assembles every sub-score + composite from in-memory objects', () => {
    const tokens = {
      colorTokens: [
        Object.assign(makeColorToken({ hex: '#635bff' }), { role: 'primary' }),
        makeColorToken({ hex: '#000000' }),
        makeColorToken({ hex: '#ffffff' }),
        makeColorToken({ hex: '#3ecf8e' }),
      ],
      typographyLevels: [
        makeTypoLevel({ fontFamily: '"Inter", sans-serif', typicalTags: ['h1'], frequency: 5 }),
        makeTypoLevel({ fontFamily: '"Inter", sans-serif', typicalTags: ['p'], frequency: 50 }),
      ],
      spacingSystem: {
        baseUnit: 4,
        scale: [4, 8, 12, 16, 24, 32, 48],
        frequencyMap: {},
        maxContentWidth: null,
        sectionSpacing: [],
      },
    } as unknown as Parameters<typeof scoreTokens>[0];
    const result = scoreTokens(tokens, makeGold());
    expect(result.brand).toBe('test');
    expect(result.composite).toBe(100);
    expect(result.colors.primary.pass).toBe(true);
    expect(result.typography.display.pass).toBe(true);
    expect(result.spacing.baseUnit.pass).toBe(true);
    expect(typeof result.scoredAt).toBe('string');
  });
});

// ─── scoreExtraction (file-reading wrapper) ──────────────────────────────

describe('scoreExtraction', () => {
  function withTempDir<T>(fn: (dir: string) => T): T {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'score-'));
    try {
      return fn(dir);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }

  it('reads tokens.json + gold.json from disk and computes the score', () => {
    withTempDir((dir) => {
      const tokensPath = path.join(dir, 'tokens.json');
      const goldPath = path.join(dir, 'gold.json');
      fs.writeFileSync(
        tokensPath,
        JSON.stringify({
          colorTokens: [
            Object.assign(makeColorToken({ hex: '#635bff' }), { role: 'primary' }),
          ],
          typographyLevels: [],
          spacingSystem: { baseUnit: 4, scale: [4, 8, 16], frequencyMap: {}, maxContentWidth: null, sectionSpacing: [] },
        }),
      );
      fs.writeFileSync(goldPath, JSON.stringify(makeGold()));
      const result = scoreExtraction(tokensPath, goldPath);
      expect(result.brand).toBe('test');
      expect(result.colors.primary.pass).toBe(true);
    });
  });

  it('throws on missing tokens file', () => {
    withTempDir((dir) => {
      const goldPath = path.join(dir, 'gold.json');
      fs.writeFileSync(goldPath, JSON.stringify(makeGold()));
      expect(() => scoreExtraction(path.join(dir, 'missing.json'), goldPath)).toThrow();
    });
  });
});

// ─── goldPathFor helper ──────────────────────────────────────────────────

describe('goldPathFor', () => {
  it('returns eval/gold/<brand>.json relative to the project root', () => {
    const p = goldPathFor('stripe', '/some/root');
    expect(p).toMatch(/[\\/]eval[\\/]gold[\\/]stripe\.json$/);
  });
});

// ─── Type marker — OverallScore exported ─────────────────────────────────

// Ensures the type is exposed; compile-time check only.
const _marker: OverallScore | null = null;
void _marker;
