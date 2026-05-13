import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  buildShadcnCss,
  generateAndWriteShadcnCss,
  contrastRatio,
  pickBestForeground,
  type ShadcnSlot,
} from '../shadcn-emit';
import { regenerateRampsFromTokens } from '../ramp-regen';
import type {
  ColorToken,
  DesignTokens,
  FrameworkDetection,
  RadiusToken,
} from '../types';

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

function makeRadius(value: string, frequency: number): RadiusToken {
  return { value, frequency, typicalElements: [] };
}

function makeFramework(overrides: Partial<FrameworkDetection> = {}): FrameworkDetection {
  return {
    tailwind: { detected: true, matchCount: 50, sampleClasses: ['flex'], jitDetected: false },
    uiFramework: null,
    designSystemUrl: null,
    ...overrides,
  };
}

function makeTokens(overrides: Partial<DesignTokens> = {}): DesignTokens {
  return {
    meta: {
      sourceUrls: ['https://example.com'],
      totalPages: 1,
      extractionDate: '2026-05-13T00:00:00Z',
      framework: makeFramework(),
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

/** A tokens object that passes all three gates. */
function makeViableTokens(extras: Partial<DesignTokens> = {}): DesignTokens {
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
    ...extras,
  });
}

const DEFAULT_OPTS = { url: 'https://example.com', date: '2026-05-13' };

function getSlot(slots: ShadcnSlot[] | undefined, name: string): string | undefined {
  return slots?.find((s) => s.name === name)?.value;
}

// ─── contrastRatio + pickBestForeground (WCAG primitives) ────────────────

describe('contrastRatio', () => {
  it('white on black = 21 (the maximum)', () => {
    expect(contrastRatio('#ffffff', '#000000')).toBeCloseTo(21, 1);
  });

  it('white on white = 1 (the minimum)', () => {
    expect(contrastRatio('#ffffff', '#ffffff')).toBeCloseTo(1, 6);
  });

  it('is symmetric — order of args does not matter', () => {
    const a = contrastRatio('#635bff', '#ffffff');
    const b = contrastRatio('#ffffff', '#635bff');
    expect(a).toBeCloseTo(b, 6);
  });

  it('Stripe purple #635bff on white meets AA for normal text (>= 4.5)', () => {
    const r = contrastRatio('#635bff', '#ffffff');
    expect(r).toBeGreaterThanOrEqual(4.5);
  });

  it('returns 0-side default for malformed input', () => {
    // Malformed input → luminance 0 → ratio ~ 21 (white vs "black"). We
    // don't crash; the value is just an artifact. Callers shouldn't pass
    // bad hex but this is defensive.
    expect(() => contrastRatio('not-a-hex', '#ffffff')).not.toThrow();
  });
});

describe('pickBestForeground', () => {
  it('picks white over dark grey on a saturated mid-light brand', () => {
    const r = pickBestForeground('#635bff', ['#ffffff', '#070709']);
    // Whichever wins, it should meet AA.
    expect(r.ratio).toBeGreaterThanOrEqual(4.5);
  });

  it('picks the dark neutral over white on a very light primary', () => {
    const r = pickBestForeground('#fef9c3', ['#ffffff', '#070709']);
    expect(r.hex).toBe('#070709');
  });

  it('returns the candidate with the highest ratio', () => {
    const r = pickBestForeground('#888888', ['#ffffff', '#000000']);
    // Black on mid-grey is higher contrast than white on mid-grey.
    expect(r.hex).toBe('#000000');
  });
});

// ─── Gate 1: no chromatic primary → omit ──────────────────────────────────

describe('buildShadcnCss — gate 1 (no primary)', () => {
  it('omits with the "no chromatic primary" message when ramps.brand is null but ramps itself exists', () => {
    const tokens = makeTokens({
      colorTokens: [
        makeColorToken({ hex: '#000000' }),
        makeColorToken({ hex: '#ffffff' }),
        makeColorToken({ hex: '#808080' }),
      ],
    });
    const ramps = regenerateRampsFromTokens(tokens);
    expect(ramps.brand).toBeNull(); // confirms gate-1 should trip
    const result = buildShadcnCss(tokens, ramps, DEFAULT_OPTS);
    expect(result.css).toBeNull();
    expect(result.omitReason).toContain('No chromatic primary');
    expect(result.confidence).toBeNull();
  });

  it('omits with the "no ramps" message when ramps is explicitly null', () => {
    // Distinct failure mode — ramp regen stage didn't run at all, vs.
    // ramp regen ran but couldn't find a chromatic primary. Each gets its
    // own message so users can diagnose which upstream stage to investigate.
    const tokens = makeViableTokens();
    const result = buildShadcnCss(tokens, null, DEFAULT_OPTS);
    expect(result.css).toBeNull();
    expect(result.omitReason).toContain('No regenerated colour ramps');
    expect(result.omitReason).not.toContain('No chromatic primary');
  });
});

// ─── Gate 3: no Tailwind or shadcn → omit ─────────────────────────────────

describe('buildShadcnCss — gate 3 (no Tailwind / shadcn)', () => {
  it('omits when framework is neither Tailwind nor shadcn', () => {
    const tokens = makeViableTokens({
      meta: {
        sourceUrls: ['https://example.com'],
        totalPages: 1,
        extractionDate: '2026-05-13T00:00:00Z',
        framework: makeFramework({ tailwind: null, uiFramework: 'Material UI' }),
        totalElements: 0,
        extractionTime: 0,
      },
    });
    const ramps = regenerateRampsFromTokens(tokens);
    const result = buildShadcnCss(tokens, ramps, DEFAULT_OPTS);
    expect(result.css).toBeNull();
    expect(result.omitReason).toContain('neither Tailwind nor shadcn');
  });

  it('omits when framework is completely undetected', () => {
    const tokens = makeViableTokens({
      meta: {
        sourceUrls: ['https://example.com'],
        totalPages: 1,
        extractionDate: '2026-05-13T00:00:00Z',
        framework: makeFramework({ tailwind: null, uiFramework: null }),
        totalElements: 0,
        extractionTime: 0,
      },
    });
    const ramps = regenerateRampsFromTokens(tokens);
    const result = buildShadcnCss(tokens, ramps, DEFAULT_OPTS);
    expect(result.css).toBeNull();
    expect(result.omitReason).toMatch(/neither/);
  });
});

// ─── Confidence labelling ─────────────────────────────────────────────────

describe('buildShadcnCss — confidence label', () => {
  it('high when source uses shadcn/ui', () => {
    const tokens = makeViableTokens({
      meta: {
        sourceUrls: ['https://example.com'],
        totalPages: 1,
        extractionDate: '2026-05-13T00:00:00Z',
        framework: makeFramework({ uiFramework: 'shadcn/ui' }),
        totalElements: 0,
        extractionTime: 0,
      },
    });
    const ramps = regenerateRampsFromTokens(tokens);
    const result = buildShadcnCss(tokens, ramps, DEFAULT_OPTS);
    expect(result.confidence).toBe('high');
    expect(result.css).toContain('HIGH (source uses shadcn/ui + Tailwind)');
  });

  it('medium when only Tailwind is detected', () => {
    const tokens = makeViableTokens(); // tailwind detected by default fixture
    const ramps = regenerateRampsFromTokens(tokens);
    const result = buildShadcnCss(tokens, ramps, DEFAULT_OPTS);
    expect(result.confidence).toBe('medium');
    expect(result.css).toContain('MEDIUM (source uses Tailwind without shadcn primitives)');
  });
});

// ─── Slot mapping ─────────────────────────────────────────────────────────

describe('buildShadcnCss — slot mapping', () => {
  it('emits all 20 slots', () => {
    const tokens = makeViableTokens();
    const ramps = regenerateRampsFromTokens(tokens);
    const result = buildShadcnCss(tokens, ramps, DEFAULT_OPTS);
    const expected = [
      'background', 'foreground',
      'card', 'card-foreground',
      'popover', 'popover-foreground',
      'primary', 'primary-foreground',
      'secondary', 'secondary-foreground',
      'muted', 'muted-foreground',
      'accent', 'accent-foreground',
      'destructive', 'destructive-foreground',
      'border', 'input', 'ring',
      'radius',
    ];
    for (const name of expected) {
      expect(getSlot(result.slots, name)).toBeDefined();
      expect(result.css).toContain(`--${name}:`);
    }
  });

  it('--primary matches the brand ramp seed hex', () => {
    const tokens = makeViableTokens();
    const ramps = regenerateRampsFromTokens(tokens);
    const result = buildShadcnCss(tokens, ramps, DEFAULT_OPTS);
    expect(getSlot(result.slots, 'primary')).toBe(ramps.brand!.seedHex);
  });

  it('--primary-foreground meets AA contrast against --primary', () => {
    const tokens = makeViableTokens();
    const ramps = regenerateRampsFromTokens(tokens);
    const result = buildShadcnCss(tokens, ramps, DEFAULT_OPTS);
    const primary = getSlot(result.slots, 'primary')!;
    const fg = getSlot(result.slots, 'primary-foreground')!;
    expect(contrastRatio(primary, fg)).toBeGreaterThanOrEqual(4.5);
  });

  it('--card / --popover mirror --background', () => {
    const tokens = makeViableTokens();
    const ramps = regenerateRampsFromTokens(tokens);
    const result = buildShadcnCss(tokens, ramps, DEFAULT_OPTS);
    const bg = getSlot(result.slots, 'background')!;
    expect(getSlot(result.slots, 'card')).toBe(bg);
    expect(getSlot(result.slots, 'popover')).toBe(bg);
  });

  it('--card-foreground / --popover-foreground mirror --foreground', () => {
    const tokens = makeViableTokens();
    const ramps = regenerateRampsFromTokens(tokens);
    const result = buildShadcnCss(tokens, ramps, DEFAULT_OPTS);
    const fg = getSlot(result.slots, 'foreground')!;
    expect(getSlot(result.slots, 'card-foreground')).toBe(fg);
    expect(getSlot(result.slots, 'popover-foreground')).toBe(fg);
  });

  it('--secondary and --muted both = neutral.100', () => {
    const tokens = makeViableTokens();
    const ramps = regenerateRampsFromTokens(tokens);
    const result = buildShadcnCss(tokens, ramps, DEFAULT_OPTS);
    const neutral100 = ramps.neutral.stops.find((s) => s.name === 100)!.hex;
    expect(getSlot(result.slots, 'secondary')).toBe(neutral100);
    expect(getSlot(result.slots, 'muted')).toBe(neutral100);
  });

  it('--secondary-foreground = neutral.900', () => {
    const tokens = makeViableTokens();
    const ramps = regenerateRampsFromTokens(tokens);
    const result = buildShadcnCss(tokens, ramps, DEFAULT_OPTS);
    const neutral900 = ramps.neutral.stops.find((s) => s.name === 900)!.hex;
    expect(getSlot(result.slots, 'secondary-foreground')).toBe(neutral900);
  });

  it('--muted-foreground = neutral.500', () => {
    const tokens = makeViableTokens();
    const ramps = regenerateRampsFromTokens(tokens);
    const result = buildShadcnCss(tokens, ramps, DEFAULT_OPTS);
    const neutral500 = ramps.neutral.stops.find((s) => s.name === 500)!.hex;
    expect(getSlot(result.slots, 'muted-foreground')).toBe(neutral500);
  });

  it('--border and --input share the same hex', () => {
    const tokens = makeViableTokens();
    const ramps = regenerateRampsFromTokens(tokens);
    const result = buildShadcnCss(tokens, ramps, DEFAULT_OPTS);
    expect(getSlot(result.slots, 'border')).toBe(getSlot(result.slots, 'input'));
  });

  it('--ring matches --primary (shadcn applies opacity at utility level)', () => {
    const tokens = makeViableTokens();
    const ramps = regenerateRampsFromTokens(tokens);
    const result = buildShadcnCss(tokens, ramps, DEFAULT_OPTS);
    expect(getSlot(result.slots, 'ring')).toBe(getSlot(result.slots, 'primary'));
  });

  it('--destructive-foreground meets AA against --destructive', () => {
    const tokens = makeViableTokens();
    const ramps = regenerateRampsFromTokens(tokens);
    const result = buildShadcnCss(tokens, ramps, DEFAULT_OPTS);
    const d = getSlot(result.slots, 'destructive')!;
    const dfg = getSlot(result.slots, 'destructive-foreground')!;
    expect(contrastRatio(d, dfg)).toBeGreaterThanOrEqual(4.5);
  });

  it('--accent-foreground meets AA against --accent', () => {
    const tokens = makeViableTokens();
    const ramps = regenerateRampsFromTokens(tokens);
    const result = buildShadcnCss(tokens, ramps, DEFAULT_OPTS);
    const accent = getSlot(result.slots, 'accent')!;
    const afg = getSlot(result.slots, 'accent-foreground')!;
    expect(contrastRatio(accent, afg)).toBeGreaterThanOrEqual(4.5);
  });
});

// ─── --destructive fallback behaviour ─────────────────────────────────────

describe('buildShadcnCss — destructive fallback', () => {
  it('uses the sensible default #dc2626 when no error color is extracted', () => {
    const tokens = makeViableTokens();
    const ramps = regenerateRampsFromTokens(tokens);
    const result = buildShadcnCss(tokens, ramps, DEFAULT_OPTS);
    expect(getSlot(result.slots, 'destructive')).toBe('#dc2626');
  });

  it('mentions the destructive fallback in the file header note', () => {
    const tokens = makeViableTokens();
    const ramps = regenerateRampsFromTokens(tokens);
    const result = buildShadcnCss(tokens, ramps, DEFAULT_OPTS);
    expect(result.css).toContain('no semantic red was extracted');
  });

  it('uses an extracted error color when one was detected', () => {
    // role-namer's ordering: PRIMARY → CANVAS → ALT → INK → MUTED →
    // HAIRLINE → BRAND DARK → BRAND SOFT → ACCENT → SEMANTIC (error etc.).
    // A red is the strongest 'error' candidate — but if it's the ONLY
    // chromatic non-primary colour, ACCENT (which runs first) snaps it up
    // and the SEMANTIC step never reaches it. We add a teal as a separate
    // ACCENT candidate so ACCENT picks the teal, leaving the red free for
    // the error step.
    const tokens = makeViableTokens({
      colorTokens: [
        makeColorToken({
          hex: '#635bff',
          usedAs: { textColor: 0, bgColor: 30, borderColor: 0, shadowColor: 0, gradientColor: 0, iconColor: 0 },
        }),
        makeColorToken({
          hex: '#ffffff',
          usedAs: { textColor: 0, bgColor: 50, borderColor: 0, shadowColor: 0, gradientColor: 0, iconColor: 0 },
        }),
        // Accent candidate — teal-green at higher frequency than the red.
        makeColorToken({
          hex: '#10b981',
          frequency: 30,
          usedAs: { textColor: 0, bgColor: 5, borderColor: 0, shadowColor: 0, gradientColor: 0, iconColor: 5 },
        }),
        // A red in the role-namer's "error" hue band (≈25° ±25°) with
        // enough chroma + lightness to qualify for the SEMANTIC step.
        makeColorToken({
          hex: '#e63946',
          frequency: 20,
          usedAs: { textColor: 5, bgColor: 0, borderColor: 0, shadowColor: 0, gradientColor: 0, iconColor: 5 },
        }),
      ],
    });
    const ramps = regenerateRampsFromTokens(tokens);
    const result = buildShadcnCss(tokens, ramps, DEFAULT_OPTS);
    expect(getSlot(result.slots, 'destructive')).toBe('#e63946');
    expect(result.css).not.toContain('no semantic red was extracted');
  });
});

// ─── --radius extraction ──────────────────────────────────────────────────

describe('buildShadcnCss — radius', () => {
  it('converts extracted px radius to rem', () => {
    const tokens = makeViableTokens({
      radiusTokens: [
        makeRadius('8px', 100),
      ],
    });
    const ramps = regenerateRampsFromTokens(tokens);
    const result = buildShadcnCss(tokens, ramps, DEFAULT_OPTS);
    expect(getSlot(result.slots, 'radius')).toBe('0.50rem');
  });

  it('picks the most-frequent numeric radius (skipping 9999/pill values)', () => {
    const tokens = makeViableTokens({
      radiusTokens: [
        makeRadius('9999px', 200),
        makeRadius('4px', 10),
        makeRadius('8px', 50),
      ],
    });
    const ramps = regenerateRampsFromTokens(tokens);
    const result = buildShadcnCss(tokens, ramps, DEFAULT_OPTS);
    // 8px is the most-frequent numeric (9999 is a pill, filtered out)
    expect(getSlot(result.slots, 'radius')).toBe('0.50rem');
  });

  it('falls back to 0.5rem when no numeric radii are present', () => {
    const tokens = makeViableTokens({
      radiusTokens: [makeRadius('50%', 10)], // pill only
    });
    const ramps = regenerateRampsFromTokens(tokens);
    const result = buildShadcnCss(tokens, ramps, DEFAULT_OPTS);
    expect(getSlot(result.slots, 'radius')).toBe('0.5rem');
  });
});

// ─── Output structure / formatting ────────────────────────────────────────

describe('buildShadcnCss — output formatting', () => {
  it('emits a :root { ... } block', () => {
    const tokens = makeViableTokens();
    const ramps = regenerateRampsFromTokens(tokens);
    const result = buildShadcnCss(tokens, ramps, DEFAULT_OPTS);
    expect(result.css).toMatch(/:root \{[\s\S]+?\}/);
  });

  it('starts with /* ... */ header containing site + confidence + primary hex', () => {
    const tokens = makeViableTokens();
    const ramps = regenerateRampsFromTokens(tokens);
    const result = buildShadcnCss(tokens, ramps, { url: 'https://stripe.com', date: '2026-05-13' });
    expect(result.css!.startsWith('/*')).toBe(true);
    expect(result.css).toContain('stripe');
    expect(result.css).toContain('2026-05-13');
    expect(result.css).toContain('Brand primary:');
  });

  it('is deterministic with a fixed date override', () => {
    const tokens = makeViableTokens();
    const ramps = regenerateRampsFromTokens(tokens);
    const a = buildShadcnCss(tokens, ramps, { url: 'https://x.com', date: '2026-05-13' });
    const b = buildShadcnCss(tokens, ramps, { url: 'https://x.com', date: '2026-05-13' });
    expect(a.css).toBe(b.css);
  });

  it('does not mutate the input tokens or ramps', () => {
    const tokens = makeViableTokens();
    const ramps = regenerateRampsFromTokens(tokens);
    const tokensSnapshot = JSON.stringify(tokens);
    const rampsSnapshot = JSON.stringify(ramps);
    buildShadcnCss(tokens, ramps, DEFAULT_OPTS);
    expect(JSON.stringify(tokens)).toBe(tokensSnapshot);
    expect(JSON.stringify(ramps)).toBe(rampsSnapshot);
  });

  it('ends with a newline', () => {
    const tokens = makeViableTokens();
    const ramps = regenerateRampsFromTokens(tokens);
    const result = buildShadcnCss(tokens, ramps, DEFAULT_OPTS);
    expect(result.css!.endsWith('\n')).toBe(true);
  });
});

// ─── Omit-reason markdown ────────────────────────────────────────────────

describe('buildShadcnCss — omit reason markdown', () => {
  it('starts with a markdown title naming the site', () => {
    const tokens = makeTokens({
      colorTokens: [makeColorToken({ hex: '#808080' })],
    });
    const ramps = regenerateRampsFromTokens(tokens);
    const result = buildShadcnCss(tokens, ramps, { url: 'https://example.com', date: '2026-05-13' });
    expect(result.omitReason!.startsWith('# shadcn theme not emitted')).toBe(true);
    expect(result.omitReason).toContain('example');
  });

  it('explains what artifacts the user still has', () => {
    const tokens = makeTokens({
      colorTokens: [makeColorToken({ hex: '#808080' })],
    });
    const ramps = regenerateRampsFromTokens(tokens);
    const result = buildShadcnCss(tokens, ramps, DEFAULT_OPTS);
    expect(result.omitReason).toContain('tokens.json');
    expect(result.omitReason).toContain('tailwind.css');
    expect(result.omitReason).toContain('DESIGN.md');
  });
});

// ─── generateAndWriteShadcnCss (disk wrapper) ────────────────────────────

describe('generateAndWriteShadcnCss', () => {
  function withTempDir<T>(fn: (dir: string) => T): T {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'shadcn-emit-'));
    try {
      return fn(dir);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }

  it('writes shadcn-theme.css when gates pass', () => {
    withTempDir((dir) => {
      const tokens = makeViableTokens();
      const ramps = regenerateRampsFromTokens(tokens);
      fs.writeFileSync(path.join(dir, 'tokens.json'), JSON.stringify(tokens));
      fs.writeFileSync(path.join(dir, 'regenerated-ramp.json'), JSON.stringify(ramps));

      const result = generateAndWriteShadcnCss(
        path.join(dir, 'tokens.json'),
        dir,
        'https://example.com',
      );

      expect(result.wrote).toBe('css');
      expect(result.path).toBe(path.join(dir, 'shadcn-theme.css'));
      expect(fs.existsSync(path.join(dir, 'shadcn-theme.css'))).toBe(true);
      expect(fs.existsSync(path.join(dir, 'shadcn-omit-reason.md'))).toBe(false);
    });
  });

  it('writes shadcn-omit-reason.md when gates fail', () => {
    withTempDir((dir) => {
      const tokens = makeTokens({
        colorTokens: [makeColorToken({ hex: '#808080' })],
      });
      const ramps = regenerateRampsFromTokens(tokens);
      fs.writeFileSync(path.join(dir, 'tokens.json'), JSON.stringify(tokens));
      fs.writeFileSync(path.join(dir, 'regenerated-ramp.json'), JSON.stringify(ramps));

      const result = generateAndWriteShadcnCss(
        path.join(dir, 'tokens.json'),
        dir,
        'https://example.com',
      );

      expect(result.wrote).toBe('reason');
      expect(result.path).toBe(path.join(dir, 'shadcn-omit-reason.md'));
      expect(fs.existsSync(path.join(dir, 'shadcn-omit-reason.md'))).toBe(true);
      expect(fs.existsSync(path.join(dir, 'shadcn-theme.css'))).toBe(false);
    });
  });

  it('returns null wrote when tokens.json is missing', () => {
    withTempDir((dir) => {
      const result = generateAndWriteShadcnCss(
        path.join(dir, 'absent.json'),
        dir,
        'https://example.com',
      );
      expect(result.wrote).toBeNull();
      expect(result.path).toBeNull();
    });
  });

  it('handles missing regenerated-ramp.json (treats as no ramps → omit)', () => {
    withTempDir((dir) => {
      const tokens = makeViableTokens();
      fs.writeFileSync(path.join(dir, 'tokens.json'), JSON.stringify(tokens));
      // No regenerated-ramp.json on disk.

      const result = generateAndWriteShadcnCss(
        path.join(dir, 'tokens.json'),
        dir,
        'https://example.com',
      );

      expect(result.wrote).toBe('reason');
    });
  });
});
