import { describe, it, expect } from 'vitest';
import {
  assignColorRoles,
  assignTypeRoles,
  rolePriority,
  ROLE_PRIORITY,
  type ColorRole,
} from '../role-namer';
import type { ColorToken, TypographyLevel } from '../types';

// ─── Fixtures ──────────────────────────────────────────────────────────────
//
// Tests use deliberately unambiguous fixtures (clearly-primary purples,
// clearly-canvas whites, clearly-ink near-blacks) so behavioural assertions
// aren't sensitive to borderline scoring decisions inside the algorithm.
// Anyone reading these tests should be able to predict the role from the
// hex + signals alone.

function makeColorToken(overrides: Partial<ColorToken> & { visibilityScore?: number } = {}): ColorToken {
  return {
    hex: '#635bff',
    rgba: [99, 91, 255, 1],
    frequency: 100,
    usedAs: { textColor: 0, bgColor: 0, borderColor: 0, shadowColor: 0, gradientColor: 0, iconColor: 0 },
    cssVariableNames: [],
    pagesCoverage: 1,
    sourcePages: [],
    confidence: 'high',
    ...overrides,
  };
}

function makeTypoLevel(overrides: Partial<TypographyLevel> = {}): TypographyLevel {
  return {
    fontFamily: '"Inter", sans-serif',
    fontSize: '16px',
    fontWeight: '400',
    lineHeight: '1.5',
    letterSpacing: 'normal',
    textTransform: null,
    fontFeatureSettings: null,
    frequency: 50,
    typicalTags: ['p'],
    sampleTexts: [],
    confidence: 'high',
    ...overrides,
  };
}

/** Pull the role for a given hex from the assigned output. */
function roleFor(named: ReturnType<typeof assignColorRoles>, hex: string): ColorRole {
  const match = named.find((c) => c.hex === hex);
  return match ? match.role : null;
}

// ─── ROLE_PRIORITY / rolePriority ──────────────────────────────────────────

describe('ROLE_PRIORITY', () => {
  it('places primary first (0)', () => {
    expect(ROLE_PRIORITY.primary).toBe(0);
  });

  it('places accent second (1)', () => {
    expect(ROLE_PRIORITY.accent).toBe(1);
  });

  it('places brand-dark before brand-soft', () => {
    expect(ROLE_PRIORITY['brand-dark']).toBeLessThan(ROLE_PRIORITY['brand-soft']);
  });

  it('places text colors (ink/canvas) after brand colors', () => {
    expect(ROLE_PRIORITY.ink).toBeGreaterThan(ROLE_PRIORITY.primary);
    expect(ROLE_PRIORITY.ink).toBeGreaterThan(ROLE_PRIORITY.accent);
    expect(ROLE_PRIORITY.canvas).toBeGreaterThan(ROLE_PRIORITY.ink);
  });

  it('places hairline after the main palette colors', () => {
    expect(ROLE_PRIORITY.hairline).toBeGreaterThan(ROLE_PRIORITY.canvas);
    expect(ROLE_PRIORITY.hairline).toBeGreaterThan(ROLE_PRIORITY.muted);
  });

  it('has an entry for every non-null ColorRole', () => {
    const expected: NonNullable<ColorRole>[] = [
      'primary', 'on-primary', 'ink', 'muted', 'canvas', 'canvas-alt',
      'hairline', 'accent', 'brand-dark', 'brand-soft',
      'success', 'warning', 'error', 'info',
    ];
    for (const role of expected) {
      expect(ROLE_PRIORITY[role]).toBeTypeOf('number');
    }
  });
});

describe('rolePriority()', () => {
  it('returns the mapped index for known roles', () => {
    expect(rolePriority('primary')).toBe(0);
    expect(rolePriority('accent')).toBe(1);
    expect(rolePriority('ink')).toBe(4);
  });

  it('returns 999 for null (unassigned)', () => {
    expect(rolePriority(null)).toBe(999);
  });

  it('returns 999 for undefined', () => {
    expect(rolePriority(undefined)).toBe(999);
  });

  it('sorts roles in display order when used as a comparator', () => {
    const roles: ColorRole[] = ['ink', 'primary', null, 'canvas', 'accent'];
    const sorted = [...roles].sort((a, b) => rolePriority(a) - rolePriority(b));
    expect(sorted).toEqual(['primary', 'accent', 'ink', 'canvas', null]);
  });
});

// ─── assignColorRoles ──────────────────────────────────────────────────────

describe('assignColorRoles()', () => {
  describe('primary', () => {
    it('picks the high-chroma color as primary', () => {
      const purple = makeColorToken({ hex: '#635bff', usedAs: { textColor: 0, bgColor: 30, borderColor: 0, shadowColor: 0, gradientColor: 0, iconColor: 0 } });
      const white = makeColorToken({ hex: '#ffffff', usedAs: { textColor: 0, bgColor: 100, borderColor: 0, shadowColor: 0, gradientColor: 0, iconColor: 0 } });
      const black = makeColorToken({ hex: '#000000', usedAs: { textColor: 50, bgColor: 0, borderColor: 0, shadowColor: 0, gradientColor: 0, iconColor: 0 } });
      const named = assignColorRoles([purple, white, black]);
      expect(roleFor(named, '#635bff')).toBe('primary');
    });

    it('gives a strong boost when CSS variable name contains "primary"', () => {
      // Two equally chromatic candidates — one carries --primary, the other doesn't.
      const teal = makeColorToken({
        hex: '#00c2b8',
        cssVariableNames: ['--primary'],
        usedAs: { textColor: 0, bgColor: 5, borderColor: 0, shadowColor: 0, gradientColor: 0, iconColor: 0 },
      });
      const orange = makeColorToken({
        hex: '#ff6118',
        usedAs: { textColor: 0, bgColor: 30, borderColor: 0, shadowColor: 0, gradientColor: 0, iconColor: 0 },
      });
      const named = assignColorRoles([teal, orange]);
      expect(roleFor(named, '#00c2b8')).toBe('primary');
    });

    it('uses visibilityScore over raw bgColor count when present', () => {
      // Low-bg-count, high-visibility token should outscore high-bg-count,
      // low-visibility token. This is the bug that role-namer's log10 fix
      // exists to prevent — without it, a footer hairline would beat the
      // brand color.
      const realBrand = makeColorToken({
        hex: '#635bff',
        usedAs: { textColor: 0, bgColor: 3, borderColor: 0, shadowColor: 0, gradientColor: 0, iconColor: 0 },
        visibilityScore: 800,
      } as Partial<ColorToken> & { visibilityScore: number });
      const noisyCampaign = makeColorToken({
        hex: '#ff00aa',
        usedAs: { textColor: 0, bgColor: 50, borderColor: 0, shadowColor: 0, gradientColor: 0, iconColor: 0 },
        visibilityScore: 5,
      } as Partial<ColorToken> & { visibilityScore: number });
      const named = assignColorRoles([realBrand, noisyCampaign]);
      expect(roleFor(named, '#635bff')).toBe('primary');
    });

    it('falls back to bgColor count when visibilityScore is absent', () => {
      // Two same-chroma purples, one with much higher bgColor usage. No
      // visibilityScore on either — legacy code path.
      const heavyUse = makeColorToken({
        hex: '#7c3aed',
        usedAs: { textColor: 0, bgColor: 40, borderColor: 0, shadowColor: 0, gradientColor: 0, iconColor: 0 },
      });
      const lightUse = makeColorToken({
        hex: '#8b5cf6',
        usedAs: { textColor: 0, bgColor: 1, borderColor: 0, shadowColor: 0, gradientColor: 0, iconColor: 0 },
      });
      const named = assignColorRoles([heavyUse, lightUse]);
      expect(roleFor(named, '#7c3aed')).toBe('primary');
    });

    it('penalises near-black and near-white from being labeled primary', () => {
      // Pure white has c=0 anyway so it's filtered earlier, but the L>0.98
      // penalty exists for "high chroma in name" edge cases.
      const realBrand = makeColorToken({
        hex: '#635bff',
        usedAs: { textColor: 0, bgColor: 10, borderColor: 0, shadowColor: 0, gradientColor: 0, iconColor: 0 },
      });
      const black = makeColorToken({ hex: '#000000' });
      const named = assignColorRoles([realBrand, black]);
      expect(roleFor(named, '#635bff')).toBe('primary');
      expect(roleFor(named, '#000000')).not.toBe('primary');
    });
  });

  describe('canvas / canvas-alt', () => {
    it('assigns canvas to the lightest color with bgColor usage', () => {
      const white = makeColorToken({
        hex: '#ffffff',
        usedAs: { textColor: 0, bgColor: 50, borderColor: 0, shadowColor: 0, gradientColor: 0, iconColor: 0 },
      });
      const named = assignColorRoles([white]);
      expect(roleFor(named, '#ffffff')).toBe('canvas');
    });

    it('assigns canvas-alt to a slightly off-white bg color', () => {
      const white = makeColorToken({
        hex: '#ffffff',
        usedAs: { textColor: 0, bgColor: 100, borderColor: 0, shadowColor: 0, gradientColor: 0, iconColor: 0 },
      });
      const offWhite = makeColorToken({
        hex: '#ebf0f5',
        usedAs: { textColor: 0, bgColor: 30, borderColor: 0, shadowColor: 0, gradientColor: 0, iconColor: 0 },
      });
      const named = assignColorRoles([white, offWhite]);
      expect(roleFor(named, '#ffffff')).toBe('canvas');
      expect(roleFor(named, '#ebf0f5')).toBe('canvas-alt');
    });
  });

  describe('ink', () => {
    it('assigns ink to the darkest text color', () => {
      const ink = makeColorToken({
        hex: '#061b31',
        usedAs: { textColor: 80, bgColor: 0, borderColor: 0, shadowColor: 0, gradientColor: 0, iconColor: 0 },
      });
      const named = assignColorRoles([ink]);
      expect(roleFor(named, '#061b31')).toBe('ink');
    });

    it('prefers a chromatic dark over pure black for ink', () => {
      const tintedInk = makeColorToken({
        hex: '#061b31',
        usedAs: { textColor: 50, bgColor: 0, borderColor: 0, shadowColor: 0, gradientColor: 0, iconColor: 0 },
      });
      const pureBlack = makeColorToken({
        hex: '#000000',
        usedAs: { textColor: 50, bgColor: 0, borderColor: 0, shadowColor: 0, gradientColor: 0, iconColor: 0 },
      });
      const named = assignColorRoles([tintedInk, pureBlack]);
      expect(roleFor(named, '#061b31')).toBe('ink');
      expect(roleFor(named, '#000000')).not.toBe('ink');
    });
  });

  describe('hairline', () => {
    it('assigns hairline to a light border color', () => {
      const border = makeColorToken({
        hex: '#e6e6e6',
        usedAs: { textColor: 0, bgColor: 0, borderColor: 20, shadowColor: 0, gradientColor: 0, iconColor: 0 },
      });
      const named = assignColorRoles([border]);
      expect(roleFor(named, '#e6e6e6')).toBe('hairline');
    });
  });

  describe('accent', () => {
    it('assigns accent to a high-chroma color in a hue distinct from primary', () => {
      const primaryPurple = makeColorToken({
        hex: '#635bff',
        usedAs: { textColor: 0, bgColor: 30, borderColor: 0, shadowColor: 0, gradientColor: 0, iconColor: 0 },
      });
      const accentOrange = makeColorToken({
        hex: '#ff6118',
        frequency: 50,
        usedAs: { textColor: 0, bgColor: 10, borderColor: 0, shadowColor: 0, gradientColor: 0, iconColor: 0 },
      });
      const named = assignColorRoles([primaryPurple, accentOrange]);
      expect(roleFor(named, '#635bff')).toBe('primary');
      expect(roleFor(named, '#ff6118')).toBe('accent');
    });
  });

  describe('semantic (success / warning / error / info)', () => {
    // Purple wins primary (CSS-var boost guarantees it), cyan wins accent
    // (high chroma + frequency, hue ~195° matches no semantic band so it
    // can't compete for error/success/warning/info). That frees the
    // semantic phase to claim the remaining red/green test color.
    const purplePrimary = makeColorToken({
      hex: '#635bff',
      cssVariableNames: ['--primary'],
      usedAs: { textColor: 0, bgColor: 30, borderColor: 0, shadowColor: 0, gradientColor: 0, iconColor: 0 },
    });
    const cyanAccent = makeColorToken({
      hex: '#06b6d4',
      frequency: 100,
      usedAs: { textColor: 0, bgColor: 20, borderColor: 0, shadowColor: 0, gradientColor: 0, iconColor: 0 },
    });

    it('assigns error to a red hue (~25°)', () => {
      const red = makeColorToken({ hex: '#ef4444', frequency: 20 });
      const named = assignColorRoles([purplePrimary, cyanAccent, red]);
      expect(roleFor(named, '#ef4444')).toBe('error');
    });

    it('assigns success to a green hue (~145°)', () => {
      const green = makeColorToken({ hex: '#10b981', frequency: 20 });
      const named = assignColorRoles([purplePrimary, cyanAccent, green]);
      expect(roleFor(named, '#10b981')).toBe('success');
    });
  });

  describe('null assignment', () => {
    it('returns role: null for tokens that fit no rule', () => {
      // Mid-grey with no bg/border/text usage — no role fits.
      const orphan = makeColorToken({
        hex: '#888888',
        usedAs: { textColor: 0, bgColor: 0, borderColor: 0, shadowColor: 0, gradientColor: 0, iconColor: 0 },
      });
      const named = assignColorRoles([orphan]);
      expect(named[0].role).toBeNull();
      expect(named[0].roleLabel).toBeNull();
    });

    it('preserves the original token shape on the output', () => {
      const t = makeColorToken({ hex: '#635bff', frequency: 42, pagesCoverage: 3 });
      const [named] = assignColorRoles([t]);
      expect(named.hex).toBe('#635bff');
      expect(named.frequency).toBe(42);
      expect(named.pagesCoverage).toBe(3);
      expect(named).toHaveProperty('role');
      expect(named).toHaveProperty('roleLabel');
    });
  });

  describe('uniqueness', () => {
    it('does not label the same color with two roles', () => {
      // A near-white that could match both canvas and canvas-alt criteria.
      const white = makeColorToken({
        hex: '#ffffff',
        usedAs: { textColor: 0, bgColor: 100, borderColor: 0, shadowColor: 0, gradientColor: 0, iconColor: 0 },
      });
      const named = assignColorRoles([white]);
      // Should get exactly one of canvas / canvas-alt, not both somehow.
      expect(named).toHaveLength(1);
      expect(named[0].role).toBe('canvas');
    });
  });

  describe('empty input', () => {
    it('returns an empty array for no colors', () => {
      expect(assignColorRoles([])).toEqual([]);
    });
  });
});

// ─── assignTypeRoles ───────────────────────────────────────────────────────

describe('assignTypeRoles()', () => {
  it('classifies 60px as display-xxl', () => {
    const [t] = assignTypeRoles([makeTypoLevel({ fontSize: '60px' })]);
    expect(t.role).toBe('display-xxl');
    expect(t.roleLabel).toBe('Display XXL');
  });

  it('classifies 48px as display-xl', () => {
    const [t] = assignTypeRoles([makeTypoLevel({ fontSize: '48px' })]);
    expect(t.role).toBe('display-xl');
  });

  it('classifies 40px as display-lg', () => {
    const [t] = assignTypeRoles([makeTypoLevel({ fontSize: '40px' })]);
    expect(t.role).toBe('display-lg');
  });

  it('classifies 32px as display-md', () => {
    const [t] = assignTypeRoles([makeTypoLevel({ fontSize: '32px' })]);
    expect(t.role).toBe('display-md');
  });

  it('classifies 24px with h2 tag as heading-lg', () => {
    const [t] = assignTypeRoles([makeTypoLevel({ fontSize: '24px', typicalTags: ['h2'] })]);
    expect(t.role).toBe('heading-lg');
  });

  it('classifies 16px body text as body-md', () => {
    const [t] = assignTypeRoles([makeTypoLevel({ fontSize: '16px', typicalTags: ['p'] })]);
    expect(t.role).toBe('body-md');
  });

  it('classifies 14px text as body-sm', () => {
    const [t] = assignTypeRoles([makeTypoLevel({ fontSize: '14px' })]);
    expect(t.role).toBe('body-sm');
  });

  it('classifies very small text (8px) as pico', () => {
    const [t] = assignTypeRoles([makeTypoLevel({ fontSize: '8px' })]);
    expect(t.role).toBe('pico');
  });

  it('detects button role for bold + small + button tag', () => {
    const [t] = assignTypeRoles([
      makeTypoLevel({ fontSize: '14px', fontWeight: '600', typicalTags: ['button'] }),
    ]);
    expect(t.role).toBe('button');
    expect(t.roleLabel).toBe('Button');
  });

  it('detects button role for bold + anchor tag', () => {
    const [t] = assignTypeRoles([
      makeTypoLevel({ fontSize: '15px', fontWeight: '700', typicalTags: ['a'] }),
    ]);
    expect(t.role).toBe('button');
  });

  it('detects overline (eyebrow) for uppercase + small size', () => {
    const [t] = assignTypeRoles([
      makeTypoLevel({ fontSize: '12px', textTransform: 'uppercase' }),
    ]);
    expect(t.role).toBe('overline');
  });

  it('preserves all original TypographyLevel fields on the output', () => {
    const input = makeTypoLevel({
      fontSize: '18px',
      fontFamily: '"Sohne", sans-serif',
      lineHeight: '1.4',
      frequency: 99,
    });
    const [out] = assignTypeRoles([input]);
    expect(out.fontFamily).toBe('"Sohne", sans-serif');
    expect(out.fontSize).toBe('18px');
    expect(out.lineHeight).toBe('1.4');
    expect(out.frequency).toBe(99);
    expect(out).toHaveProperty('role');
    expect(out).toHaveProperty('roleLabel');
  });

  it('returns an empty array for no inputs', () => {
    expect(assignTypeRoles([])).toEqual([]);
  });
});
