import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { buildUniversalPrompt, generatePromptPack } from '../prompt-pack';
import type {
  ColorToken,
  DesignTokens,
  RadiusToken,
  ShadowToken,
  TypographyLevel,
} from '../types';

// ─── Fixtures ──────────────────────────────────────────────────────────────
//
// Fixtures favour role-namer-friendly inputs so the prompt actually surfaces
// named colors / typography. Bare-minimum tokens that role-namer can't
// classify would produce a fallback-mode prompt — useful for one test but
// not the baseline.

function makeColorToken(overrides: Partial<ColorToken> = {}): ColorToken {
  return {
    hex: '#635bff',
    rgba: [99, 91, 255, 1],
    frequency: 100,
    usedAs: { textColor: 0, bgColor: 30, borderColor: 0, shadowColor: 0, gradientColor: 0, iconColor: 0 },
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

function makeTokens(overrides: Partial<DesignTokens> = {}): DesignTokens {
  return {
    meta: {
      sourceUrls: ['https://example.com/'],
      totalPages: 5,
      extractionDate: '2026-05-12',
      framework: { tailwind: null, uiFramework: null, designSystemUrl: null },
      totalElements: 1000,
      extractionTime: 60000,
    },
    colorTokens: [
      makeColorToken({ hex: '#635bff', usedAs: { textColor: 0, bgColor: 30, borderColor: 0, shadowColor: 0, gradientColor: 0, iconColor: 0 } }),
      makeColorToken({ hex: '#ffffff', usedAs: { textColor: 0, bgColor: 200, borderColor: 0, shadowColor: 0, gradientColor: 0, iconColor: 0 }, frequency: 200 }),
      makeColorToken({ hex: '#061b31', usedAs: { textColor: 80, bgColor: 0, borderColor: 0, shadowColor: 0, gradientColor: 0, iconColor: 0 } }),
    ],
    colorRelationships: { scales: [], contrastPairs: [] },
    typographyLevels: [
      makeTypoLevel({ fontSize: '56px', fontWeight: '700', typicalTags: ['h1'] }),
      makeTypoLevel({ fontSize: '16px', typicalTags: ['p'] }),
    ],
    fontInfo: { fontFaces: [], loadedFonts: [], googleFontsLinks: [] },
    spacingSystem: { baseUnit: 4, scale: [4, 8, 16, 24, 32], frequencyMap: {}, maxContentWidth: '1200px', sectionSpacing: [48, 64, 96] },
    shadowTokens: [],
    radiusTokens: [],
    components: [],
    layoutPatterns: { maxContentWidth: '1200px', commonColumnCounts: [12], sectionSpacing: [48], contentAlignment: 'centered' },
    iconSystem: null,
    motionSystem: null,
    a11yTokens: {
      focusIndicator: { style: {}, consistent: true },
      contrastPairs: [],
      minTouchTarget: { width: 44, height: 44 },
      minFontSize: '12px',
    },
    darkMode: { supported: false, detectionMethod: 'none', lightVariables: [], darkVariables: [], variableDiff: [], darkScreenshots: null },
    breakpoints: [],
    gradients: [],
    consistency: { consistent: [], inconsistent: [] },
    cssVariables: [],
    ...overrides,
  };
}

// ─── buildUniversalPrompt — header & structure ──────────────────────────────

describe('buildUniversalPrompt — header', () => {
  it('derives the site name from the URL hostname', () => {
    const out = buildUniversalPrompt(makeTokens(), 'https://stripe.com/');
    expect(out).toMatch(/^# Design System: Stripe \(https:\/\/stripe\.com\/\)/);
  });

  it('strips www. and uses the second-level domain', () => {
    const out = buildUniversalPrompt(makeTokens(), 'https://www.linear.app/features');
    expect(out).toMatch(/^# Design System: Linear /);
  });

  it('falls back to "Site" for an unparseable URL', () => {
    const out = buildUniversalPrompt(makeTokens(), 'not-a-url');
    expect(out).toMatch(/^# Design System: Site /);
  });

  it('includes the "use these exactly" instruction line', () => {
    const out = buildUniversalPrompt(makeTokens(), 'https://stripe.com/');
    expect(out).toContain('Use these values exactly');
    expect(out).toContain('Do not substitute');
  });

  it('always includes the agent-rule footer', () => {
    const out = buildUniversalPrompt(makeTokens(), 'https://stripe.com/');
    expect(out).toContain('Rule for the agent');
    expect(out).toContain('use ONLY the values above');
  });

  it('includes 4 example follow-up prompts', () => {
    const out = buildUniversalPrompt(makeTokens(), 'https://stripe.com/');
    const examples = out.match(/^- "/gm) ?? [];
    // Examples in the footer ("Build a pricing page...", "Make a sign-up form...", etc.)
    expect(examples.length).toBeGreaterThanOrEqual(4);
  });
});

// ─── Colors section ─────────────────────────────────────────────────────────

describe('buildUniversalPrompt — colors', () => {
  it('renders role-labeled colors with usage hints', () => {
    const out = buildUniversalPrompt(makeTokens(), 'https://stripe.com/');
    expect(out).toContain('## Colors');
    expect(out).toMatch(/\*\*Primary:\*\* `#635bff` — main CTAs/);
    expect(out).toMatch(/\*\*Canvas:\*\* `#ffffff` — page background/);
    expect(out).toMatch(/\*\*Ink:\*\* `#061b31` — body text/);
  });

  it('orders colors by role priority (Primary first, then Canvas / Ink)', () => {
    const out = buildUniversalPrompt(makeTokens(), 'https://stripe.com/');
    const primaryIdx = out.indexOf('**Primary:**');
    const canvasIdx = out.indexOf('**Canvas:**');
    const inkIdx = out.indexOf('**Ink:**');
    expect(primaryIdx).toBeGreaterThan(-1);
    expect(canvasIdx).toBeGreaterThan(primaryIdx);
    expect(inkIdx).toBeGreaterThan(primaryIdx);
  });

  it('excludes L3 campaign and L4 content colors (stability filter)', () => {
    const tokens = makeTokens({
      colorTokens: [
        makeColorToken({
          hex: '#635bff',
          usedAs: { textColor: 0, bgColor: 30, borderColor: 0, shadowColor: 0, gradientColor: 0, iconColor: 0 },
          stability: { layer: 'infrastructure', signals: [], confidence: 1 },
        }),
        makeColorToken({
          hex: '#ff00aa',
          usedAs: { textColor: 0, bgColor: 30, borderColor: 0, shadowColor: 0, gradientColor: 0, iconColor: 0 },
          stability: { layer: 'campaign', signals: [], confidence: 1 },
        }),
        makeColorToken({
          hex: '#ffaa00',
          usedAs: { textColor: 0, bgColor: 30, borderColor: 0, shadowColor: 0, gradientColor: 0, iconColor: 0 },
          stability: { layer: 'content', signals: [], confidence: 1 },
        }),
      ],
    });
    const out = buildUniversalPrompt(tokens, 'https://stripe.com/');
    expect(out).toContain('#635bff');
    expect(out).not.toContain('#ff00aa');
    expect(out).not.toContain('#ffaa00');
  });

  it('includes tokens with no stability field (defaults to inclusion)', () => {
    // No stability assigned anywhere → all colors should pass the permanent filter.
    const out = buildUniversalPrompt(makeTokens(), 'https://stripe.com/');
    expect(out).toContain('#635bff');
  });

  it('caps the color list at 10 entries', () => {
    // 14 saturated, role-classifiable colors so the >10 cap actually fires.
    const distinctColors = [
      '#635bff', '#ffffff', '#061b31', '#e6e6e6', '#ff6118',
      '#ef4444', '#10b981', '#fbbf24', '#3b82f6', '#a855f7',
      '#ec4899', '#06b6d4', '#84cc16', '#f97316',
    ];
    const tokens = makeTokens({
      colorTokens: distinctColors.map((hex, i) => makeColorToken({
        hex,
        frequency: 100 - i,
        usedAs: { textColor: i % 2, bgColor: 30 - i, borderColor: i % 3, shadowColor: 0, gradientColor: 0, iconColor: 0 },
      })),
    });
    const out = buildUniversalPrompt(tokens, 'https://stripe.com/');
    // Count rendered role-tagged color lines (those that start with `- **`)
    const colorLines = (out.match(/^- \*\*[A-Z][a-zA-Z ]+:\*\* `#/gm) ?? []);
    expect(colorLines.length).toBeLessThanOrEqual(10);
  });

  it('uses fallback rendering when no colors are role-classifiable', () => {
    // All-grey palette — role-namer can't classify most of these, but at
    // least one might still match a role. The fallback only kicks in when
    // ZERO colors are named. Use orphan greys with no usage signals.
    const tokens = makeTokens({
      colorTokens: [
        makeColorToken({ hex: '#888888', frequency: 50, usedAs: { textColor: 0, bgColor: 0, borderColor: 0, shadowColor: 0, gradientColor: 0, iconColor: 0 } }),
        makeColorToken({ hex: '#999999', frequency: 40, usedAs: { textColor: 0, bgColor: 0, borderColor: 0, shadowColor: 0, gradientColor: 0, iconColor: 0 } }),
      ],
    });
    const out = buildUniversalPrompt(tokens, 'https://stripe.com/');
    // Should either fall back ("Role-namer could not classify") or omit the
    // colors block. Either is acceptable — what's NOT acceptable is hex
    // strings rendered without role labels in the main path.
    if (out.includes('## Colors')) {
      expect(out).toContain('Role-namer could not classify');
    }
  });

  it('omits the Colors section entirely if colorTokens is empty', () => {
    const out = buildUniversalPrompt(makeTokens({ colorTokens: [] }), 'https://stripe.com/');
    expect(out).not.toContain('## Colors');
  });
});

// ─── Typography section ─────────────────────────────────────────────────────

describe('buildUniversalPrompt — typography', () => {
  it('renders role-labeled typography levels', () => {
    const out = buildUniversalPrompt(makeTokens(), 'https://stripe.com/');
    expect(out).toContain('## Typography');
    expect(out).toMatch(/\*\*Display XXL:\*\*/);
    expect(out).toMatch(/\*\*Body MD:\*\*/);
  });

  it('lists unique font families in order of appearance', () => {
    const tokens = makeTokens({
      typographyLevels: [
        makeTypoLevel({ fontFamily: '"Sohne", sans-serif', fontSize: '56px', typicalTags: ['h1'] }),
        makeTypoLevel({ fontFamily: '"Inter", sans-serif', fontSize: '16px', typicalTags: ['p'] }),
        makeTypoLevel({ fontFamily: '"Sohne", sans-serif', fontSize: '24px', typicalTags: ['h2'] }),
      ],
    });
    const out = buildUniversalPrompt(tokens, 'https://stripe.com/');
    const familiesLine = out.split('\n').find((l) => l.startsWith('Families:'))!;
    expect(familiesLine).toBeDefined();
    // Sohne appears once, Inter appears once; both present.
    expect(familiesLine).toContain('`Sohne`');
    expect(familiesLine).toContain('`Inter`');
    // Each family should only show up once in the families list.
    const sohneCount = (familiesLine.match(/Sohne/g) ?? []).length;
    expect(sohneCount).toBe(1);
  });

  it('converts px line-height to a unitless ratio when both are px', () => {
    const tokens = makeTokens({
      typographyLevels: [
        makeTypoLevel({ fontSize: '56px', lineHeight: '67.2px', typicalTags: ['h1'] }),
      ],
    });
    const out = buildUniversalPrompt(tokens, 'https://stripe.com/');
    // 67.2 / 56 = 1.2
    expect(out).toMatch(/lh 1\.20/);
  });

  it('preserves "normal" keyword line-height verbatim', () => {
    const tokens = makeTokens({
      typographyLevels: [
        makeTypoLevel({ fontSize: '16px', lineHeight: 'normal' }),
      ],
    });
    const out = buildUniversalPrompt(tokens, 'https://stripe.com/');
    expect(out).toMatch(/lh normal/);
  });

  it('dedupes typography levels that share a role (keeps highest-frequency)', () => {
    // Two 56px+ entries both classify as display-xxl; only one should appear.
    const tokens = makeTokens({
      typographyLevels: [
        makeTypoLevel({ fontSize: '56px', frequency: 5, typicalTags: ['h1'] }),
        makeTypoLevel({ fontSize: '64px', frequency: 50, typicalTags: ['h1'] }),
      ],
    });
    const out = buildUniversalPrompt(tokens, 'https://stripe.com/');
    const xxlLines = (out.match(/\*\*Display XXL:\*\*/g) ?? []);
    expect(xxlLines.length).toBe(1);
    // Higher-frequency variant should be the kept one.
    expect(out).toContain('64px');
  });

  it('omits the Typography section if typographyLevels is empty', () => {
    const out = buildUniversalPrompt(makeTokens({ typographyLevels: [] }), 'https://stripe.com/');
    expect(out).not.toContain('## Typography');
  });
});

// ─── Spacing / radius / shadow sections ─────────────────────────────────────

describe('buildUniversalPrompt — spacing / radius / shadow', () => {
  it('renders the base unit and scale', () => {
    const out = buildUniversalPrompt(makeTokens(), 'https://stripe.com/');
    expect(out).toContain('## Spacing');
    expect(out).toContain('Base unit **4px**');
    expect(out).toContain('4px, 8px, 16px, 24px, 32px');
  });

  it('includes maxContentWidth when present', () => {
    const out = buildUniversalPrompt(makeTokens(), 'https://stripe.com/');
    expect(out).toContain('Max content width: `1200px`');
  });

  it('includes sectionSpacing when present', () => {
    const out = buildUniversalPrompt(makeTokens(), 'https://stripe.com/');
    expect(out).toContain('Section spacing');
    expect(out).toContain('48px, 64px, 96px');
  });

  it('omits Spacing section when scale is empty', () => {
    const tokens = makeTokens({
      spacingSystem: { baseUnit: 4, scale: [], frequencyMap: {}, maxContentWidth: null, sectionSpacing: [] },
    });
    const out = buildUniversalPrompt(tokens, 'https://stripe.com/');
    expect(out).not.toContain('## Spacing');
  });

  it('renders radius tokens (top 6) with typical elements', () => {
    const radii: RadiusToken[] = [
      { value: '4px', frequency: 50, typicalElements: ['button'] },
      { value: '8px', frequency: 30, typicalElements: ['card'] },
    ];
    const out = buildUniversalPrompt(makeTokens({ radiusTokens: radii }), 'https://stripe.com/');
    expect(out).toContain('## Border radius');
    expect(out).toContain('`4px` (used 50×) — button');
    expect(out).toContain('`8px` (used 30×) — card');
  });

  it('renders shadow tokens with their type label', () => {
    const shadows: ShadowToken[] = [
      { type: 'elevation', value: '0 1px 2px rgba(0,0,0,0.06)', frequency: 20, typicalElements: ['card'] },
    ];
    const out = buildUniversalPrompt(makeTokens({ shadowTokens: shadows }), 'https://stripe.com/');
    expect(out).toContain('## Shadows');
    expect(out).toContain('`elevation`: `0 1px 2px rgba(0,0,0,0.06)`');
  });

  it('omits Border radius and Shadow sections when their arrays are empty', () => {
    const out = buildUniversalPrompt(makeTokens(), 'https://stripe.com/');
    expect(out).not.toContain('## Border radius');
    expect(out).not.toContain('## Shadows');
  });
});

// ─── generatePromptPack — disk I/O ──────────────────────────────────────────

describe('generatePromptPack — disk write', () => {
  let tmpRoot: string;

  beforeEach(() => {
    tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'prompt-pack-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  });

  it('writes universal.md to <outputDir>/prompts/', () => {
    const tokensPath = path.join(tmpRoot, 'tokens.json');
    fs.writeFileSync(tokensPath, JSON.stringify(makeTokens()));
    generatePromptPack(tokensPath, tmpRoot, 'https://stripe.com/');
    const promptPath = path.join(tmpRoot, 'prompts', 'universal.md');
    expect(fs.existsSync(promptPath)).toBe(true);
    const content = fs.readFileSync(promptPath, 'utf-8');
    expect(content).toMatch(/^# Design System: Stripe/);
  });

  it('creates the prompts directory if it does not exist', () => {
    const tokensPath = path.join(tmpRoot, 'tokens.json');
    fs.writeFileSync(tokensPath, JSON.stringify(makeTokens()));
    expect(fs.existsSync(path.join(tmpRoot, 'prompts'))).toBe(false);
    generatePromptPack(tokensPath, tmpRoot, 'https://stripe.com/');
    expect(fs.existsSync(path.join(tmpRoot, 'prompts'))).toBe(true);
  });

  it('overwrites an existing prompt on re-run (deterministic)', () => {
    const tokensPath = path.join(tmpRoot, 'tokens.json');
    fs.writeFileSync(tokensPath, JSON.stringify(makeTokens()));
    generatePromptPack(tokensPath, tmpRoot, 'https://stripe.com/');
    const first = fs.readFileSync(path.join(tmpRoot, 'prompts', 'universal.md'), 'utf-8');
    generatePromptPack(tokensPath, tmpRoot, 'https://stripe.com/');
    const second = fs.readFileSync(path.join(tmpRoot, 'prompts', 'universal.md'), 'utf-8');
    expect(second).toEqual(first);
  });
});
