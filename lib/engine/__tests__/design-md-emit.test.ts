import { describe, it, expect } from 'vitest';
import { generateDesignMd } from '../design-md-emit';
import type {
  ColorToken,
  DesignTokens,
  ExtractionReport,
  TypographyLevel,
} from '../types';

// ─── Test fixtures ────────────────────────────────────────────────────────

function makeColorToken(overrides: Partial<ColorToken> = {}): ColorToken {
  return {
    hex: '#635bff',
    rgba: [99, 91, 255, 1],
    frequency: 100,
    usedAs: { textColor: 0, bgColor: 50, borderColor: 0, shadowColor: 0, gradientColor: 0, iconColor: 0 },
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
    typicalTags: ['p', 'span'],
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
      makeColorToken({ hex: '#635bff', rgba: [99, 91, 255, 1] }),
      makeColorToken({ hex: '#ffffff', rgba: [255, 255, 255, 1], frequency: 200 }),
    ],
    colorRelationships: { scales: [], contrastPairs: [] },
    typographyLevels: [makeTypoLevel()],
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

function makeReport(overrides: Partial<ExtractionReport> = {}): ExtractionReport {
  return {
    startTime: '2026-05-12T00:00:00Z',
    endTime: '2026-05-12T00:01:00Z',
    totalDuration: 60000,
    sourceUrls: ['https://example.com/'],
    pagesDiscovered: 5,
    pagesCrawled: 5,
    failedPages: [],
    totalElements: 1000,
    framework: { tailwind: null, uiFramework: null, designSystemUrl: null },
    darkModeSupported: false,
    screenshotCount: 25,
    designBoundary: {
      groups: [],
      relationship: 'unified',
      overallSimilarity: 100,
      dimensionScores: { font: 100, color: 100, spacing: 100, radius: 100, component: 100, shadow: 100 },
      sharedTokenSummary: null,
      anomalies: [],
    },
    warnings: [],
    ...overrides,
  };
}

const baseOpts = { url: 'https://stripe.com/' };

// ─── Tests ─────────────────────────────────────────────────────────────────

describe('generateDesignMd — header + structure', () => {
  it('emits the v2 header comment block with date, source, page count, framework', () => {
    const md = generateDesignMd(makeTokens(), makeReport(), baseOpts);
    expect(md).toContain('<!-- Generated:');
    expect(md).toContain('| Source: https://stripe.com/');
    expect(md).toContain('| Pages: 5');
    expect(md).toContain('| Format: v2 -->');
    expect(md).toContain('This is not the official design system');
  });

  it('derives a SiteName from the URL hostname', () => {
    const md = generateDesignMd(makeTokens(), null, { url: 'https://stripe.com/' });
    expect(md).toContain('# Design System: Stripe');
  });

  it('honours an explicit siteName override', () => {
    const md = generateDesignMd(makeTokens(), null, { url: 'https://x.com/', siteName: 'CustomBrand' });
    expect(md).toContain('# Design System: CustomBrand');
  });
});

describe('generateDesignMd — skipped subjective sections', () => {
  it('emits stubs for §0, §1, §7, §8 with a pointer to the universal prompt', () => {
    const md = generateDesignMd(makeTokens(), null, baseOpts);
    for (const heading of ['## 0. Brand Context', '## 1. Visual Theme', '## 7. Content & Voice', "## 8. Do's and Don'ts"]) {
      expect(md).toContain(heading);
    }
    expect(md).toMatch(/prompts\/universal\.md/);
    expect(md).toContain('Skipped by the deterministic emitter');
  });
});

describe('generateDesignMd — §2 Color Palette', () => {
  it('splits colors into Brand (chromatic) and Structural (achromatic) groups', () => {
    const tokens = makeTokens({
      colorTokens: [
        makeColorToken({ hex: '#635bff', rgba: [99, 91, 255, 1], frequency: 100 }), // chromatic
        makeColorToken({ hex: '#888888', rgba: [136, 136, 136, 1], frequency: 50 }), // achromatic
      ],
    });
    const md = generateDesignMd(tokens, null, baseOpts);
    expect(md).toContain('## 2. Color Palette & Roles');
    expect(md).toContain('### Brand Colors');
    expect(md).toContain('### Structural Colors');
    expect(md).toContain('`#635bff`');
    expect(md).toContain('`#888888`');
    expect(md).toContain('### Color Boundary Rules');
  });

  it('excludes L4 content tokens from the permanent palette (spec §2)', () => {
    const tokens = makeTokens({
      colorTokens: [
        makeColorToken({ hex: '#635bff', rgba: [99, 91, 255, 1], stability: { layer: 'system', confidence: 1, signals: [] } }),
        makeColorToken({ hex: '#dead00', rgba: [222, 173, 0, 1], stability: { layer: 'content', confidence: 1, signals: [] } }),
      ],
    });
    const md = generateDesignMd(tokens, null, baseOpts);
    // System token is in palette.
    expect(md).toContain('`#635bff`');
    // Content token is NOT in any palette section (matches the spec exclusion).
    const paletteSection = md.slice(md.indexOf('## 2.'), md.indexOf('## 3.'));
    expect(paletteSection).not.toContain('`#dead00`');
  });

  it('routes L3 campaign tokens to a dedicated "Current Campaign Colors" subsection', () => {
    const tokens = makeTokens({
      colorTokens: [
        makeColorToken({ hex: '#635bff', rgba: [99, 91, 255, 1], stability: { layer: 'system', confidence: 1, signals: [] } }),
        makeColorToken({ hex: '#ff0066', rgba: [255, 0, 102, 1], stability: { layer: 'campaign', confidence: 1, signals: [] } }),
      ],
    });
    const md = generateDesignMd(tokens, null, baseOpts);
    expect(md).toContain('### Current Campaign Colors');
    // The campaign hex appears ONLY in the campaign subsection, not Brand Colors.
    const brandSection = md.slice(md.indexOf('### Brand Colors'), md.indexOf('### Color Boundary Rules'));
    expect(brandSection).not.toContain('`#ff0066`');
    const campaignSection = md.slice(md.indexOf('### Current Campaign Colors'), md.indexOf('## 3.'));
    expect(campaignSection).toContain('`#ff0066`');
  });

  it('omits the "Current Campaign Colors" heading when no L3 tokens exist', () => {
    const tokens = makeTokens({
      colorTokens: [
        makeColorToken({ hex: '#635bff', rgba: [99, 91, 255, 1], stability: { layer: 'infrastructure', confidence: 1, signals: [] } }),
      ],
    });
    const md = generateDesignMd(tokens, null, baseOpts);
    // The heading must be absent...
    expect(md).not.toContain('### Current Campaign Colors');
    // ...and the boundary rules language must not reference a missing subsection.
    expect(md).not.toMatch(/See the Campaign Colours table below/);
    // The boundary-rules language about L3 still appears, but neutrally.
    expect(md).toContain('Campaign (L3) tokens');
  });

  it('defaults to inclusion when a token has no stability field (legacy tokens.json)', () => {
    const tokens = makeTokens({
      colorTokens: [
        makeColorToken({ hex: '#635bff', rgba: [99, 91, 255, 1] }), // no stability field
      ],
    });
    const md = generateDesignMd(tokens, null, baseOpts);
    expect(md).toContain('`#635bff`');
  });

  it('renders usage breakdown when at least one usedAs counter is nonzero', () => {
    const tokens = makeTokens({
      colorTokens: [
        makeColorToken({ hex: '#635bff', usedAs: { textColor: 5, bgColor: 30, borderColor: 0, shadowColor: 0, gradientColor: 0, iconColor: 0 } }),
      ],
    });
    const md = generateDesignMd(tokens, null, baseOpts);
    expect(md).toContain('text 5');
    expect(md).toContain('bg 30');
  });

  it('renders CSS variable name + stability layer suffix when present', () => {
    const tokens = makeTokens({
      colorTokens: [
        makeColorToken({
          hex: '#635bff',
          cssVariableNames: ['--color-primary'],
          stability: { layer: 'infrastructure', confidence: 0.9, signals: [] },
        }),
      ],
    });
    const md = generateDesignMd(tokens, null, baseOpts);
    expect(md).toContain('--color-primary');
    expect(md).toContain('layer: infrastructure');
  });

  it('emits "no color tokens extracted" when colorTokens is empty', () => {
    const tokens = makeTokens({ colorTokens: [] });
    const md = generateDesignMd(tokens, null, baseOpts);
    expect(md).toContain('No color tokens extracted');
  });
});

describe('generateDesignMd — §2.5 Dark Mode', () => {
  it('emits §2.5 ONLY when darkMode.supported is true', () => {
    const tokensOff = makeTokens();
    const tokensOn = makeTokens({
      darkMode: {
        supported: true,
        detectionMethod: 'media-query',
        lightVariables: [],
        darkVariables: [],
        variableDiff: [{ name: '--bg', lightValue: '#fff', darkValue: '#000' }],
        darkScreenshots: null,
      },
    });
    expect(generateDesignMd(tokensOff, null, baseOpts)).not.toContain('## 2.5');
    const onMd = generateDesignMd(tokensOn, null, baseOpts);
    expect(onMd).toContain('## 2.5. Dark Mode System');
    expect(onMd).toContain('media-query');
    expect(onMd).toContain('| `--bg` | `#fff` | `#000` |');
  });

  it('emits a clear "JS-themed" note when supported but variableDiff is empty', () => {
    const tokens = makeTokens({
      darkMode: {
        supported: true,
        detectionMethod: 'toggle-button',
        lightVariables: [],
        darkVariables: [],
        variableDiff: [],
        darkScreenshots: null,
      },
    });
    const md = generateDesignMd(tokens, null, baseOpts);
    expect(md).toContain('JavaScript-based theming');
  });
});

describe('generateDesignMd — §3 Typography', () => {
  it('renders the hierarchy table with all standard columns including Role (validate.ts requirement)', () => {
    const tokens = makeTokens({
      typographyLevels: [
        makeTypoLevel({
          fontFamily: '"Inter", sans-serif',
          fontSize: '48px',
          fontWeight: '700',
          lineHeight: '1.1',
          letterSpacing: '-0.02em',
          fontFeatureSettings: '"ss01"',
          typicalTags: ['h1'],
          frequency: 5,
        }),
      ],
    });
    const md = generateDesignMd(tokens, null, baseOpts);
    expect(md).toContain('## 3. Typography Rules');
    expect(md).toContain('### Hierarchy');
    // Role column must be first per validate.ts's schema check.
    expect(md).toContain('| Role | Font | Size |');
    expect(md).toContain('Display Large');
    expect(md).toContain('`48px`');
    expect(md).toContain('`700`');
    expect(md).toContain('`"ss01"`');
    expect(md).toContain('h1');
  });

  it('derives Role from typical tags when role-namer has not been applied', () => {
    const tokens = makeTokens({
      typographyLevels: [
        makeTypoLevel({ typicalTags: ['h1'] }),
        makeTypoLevel({ typicalTags: ['h2'] }),
        makeTypoLevel({ typicalTags: ['p'] }),
        makeTypoLevel({ typicalTags: ['button'] }),
        makeTypoLevel({ typicalTags: ['code'] }),
      ],
    });
    const md = generateDesignMd(tokens, null, baseOpts);
    expect(md).toContain('Display Large');
    expect(md).toContain('Display Medium');
    expect(md).toContain('Body');
    expect(md).toContain('Button');
    expect(md).toContain('Mono');
  });

  it('uses role-namer roleLabel when present (preferred over tag inference)', () => {
    const level = Object.assign(makeTypoLevel({ typicalTags: ['h1'] }), { roleLabel: 'Display Hero' });
    const md = generateDesignMd(makeTokens({ typographyLevels: [level] }), null, baseOpts);
    expect(md).toContain('Display Hero');
    expect(md).not.toContain('Display Large'); // tag fallback was not used
  });

  it('de-duplicates font families in the "Font Families" list (but keeps every level in the hierarchy table)', () => {
    const tokens = makeTokens({
      typographyLevels: [
        makeTypoLevel({ fontFamily: '"Inter", sans-serif', fontSize: '48px' }),
        makeTypoLevel({ fontFamily: 'Monaspace, monospace', fontSize: '14px' }),
        makeTypoLevel({ fontFamily: '"Inter", sans-serif', fontSize: '16px' }),
      ],
    });
    const md = generateDesignMd(tokens, null, baseOpts);
    // Slice out the Font Families list section so we can count appearances
    // inside it independently of the hierarchy table.
    const familiesBlock = md.slice(md.indexOf('### Font Families'), md.indexOf('### Hierarchy'));
    const familiesInList = (familiesBlock.match(/`Inter`/g) ?? []).length;
    expect(familiesInList).toBe(1); // dedup in the list
    expect(familiesBlock).toContain('`Monaspace`');
    // The hierarchy table includes every level (including duplicates),
    // which is correct — each row represents a distinct size / weight.
    expect(md).toContain('`48px`');
    expect(md).toContain('`14px`');
    expect(md).toContain('`16px`');
  });
});

describe('generateDesignMd — §5 Layout', () => {
  it('renders spacing base unit + scale + section spacing + max width + radius', () => {
    const tokens = makeTokens({
      spacingSystem: { baseUnit: 4, scale: [4, 8, 16, 24], frequencyMap: {}, maxContentWidth: '1200px', sectionSpacing: [48, 64] },
      radiusTokens: [
        { value: '4px', frequency: 20, typicalElements: ['button', 'card'] },
        { value: '12px', frequency: 5, typicalElements: ['card'] },
      ],
    });
    const md = generateDesignMd(tokens, null, baseOpts);
    expect(md).toContain('Base unit:** `4px`');
    expect(md).toContain('`4px`, `8px`, `16px`, `24px`');
    expect(md).toContain('Section spacing:** `48px`, `64px`');
    expect(md).toContain('`1200px`');
    expect(md).toContain('| `4px` | 20 | button, card |');
  });
});

describe('generateDesignMd — §6 Depth & Elevation', () => {
  it('emits the shadow scale table when shadows exist', () => {
    const tokens = makeTokens({
      shadowTokens: [
        { value: '0 1px 2px rgba(0,0,0,0.05)', frequency: 30, type: 'border-shadow', typicalElements: ['button'] },
        { value: '0 8px 24px rgba(0,0,0,0.12)', frequency: 5, type: 'elevation', typicalElements: ['modal'] },
      ],
    });
    const md = generateDesignMd(tokens, null, baseOpts);
    expect(md).toContain('### Shadow Scale');
    expect(md).toContain('border-shadow');
    expect(md).toContain('| elevation |');
  });

  it('emits a "flat surfaces" note when no shadows', () => {
    const md = generateDesignMd(makeTokens({ shadowTokens: [] }), null, baseOpts);
    expect(md).toContain('flat surfaces with no elevation hierarchy');
  });
});

describe('generateDesignMd — §6.5 Motion', () => {
  it('emits §6.5 only when motionSystem is present', () => {
    const off = generateDesignMd(makeTokens({ motionSystem: null }), null, baseOpts);
    expect(off).not.toContain('## 6.5');
    const on = generateDesignMd(
      makeTokens({
        motionSystem: {
          durationScale: [{ label: 'fast', value: '150ms', frequency: 20 }],
          primaryTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)',
          timingFunctions: [{ value: 'cubic-bezier(0.4, 0, 0.2, 1)', frequency: 20 }],
          keyframeAnimations: [],
          prefersReducedMotion: true,
        },
      }),
      null,
      baseOpts,
    );
    expect(on).toContain('## 6.5. Motion System');
    expect(on).toContain('| fast | `150ms` | 20 |');
    expect(on).toContain('cubic-bezier(0.4, 0, 0.2, 1)');
    expect(on).toContain('Supported:** yes');
  });
});

describe('generateDesignMd — §9 Accessibility', () => {
  it('renders contrast pair table + focus + touch target + alt text + tab order', () => {
    const tokens = makeTokens({
      a11yTokens: {
        focusIndicator: { style: { outline: '2px solid #635bff' }, consistent: true },
        contrastPairs: [
          { foreground: '#000', background: '#fff', ratio: 21.0, meetsAA: true, meetsAAA: true, usageCount: 100 },
          { foreground: '#888', background: '#fff', ratio: 3.5, meetsAA: false, meetsAAA: false, usageCount: 5 },
        ],
        minTouchTarget: { width: 44, height: 44 },
        minFontSize: '12px',
        altTextCoverage: { withAlt: 10, withoutAlt: 5, total: 15, percentage: 66.7 },
        tabOrder: { tabbableCount: 50, hasPositiveTabindex: false, positiveTabindexCount: 0 },
        skipLinkDetected: true,
        reducedMotionSupport: true,
      },
    });
    const md = generateDesignMd(tokens, null, baseOpts);
    expect(md).toContain('WCAG 2.2 AA');
    expect(md).toContain('21.00:1');
    expect(md).toContain('3.50:1');
    expect(md).toContain('`outline`: `2px solid #635bff`');
    expect(md).toContain('44×44px');
    expect(md).toContain('10 of 15 images have alt text');
    expect(md).toContain('Tabbable elements:** 50');
    expect(md).toContain('Skip-to-main link:** present');
  });
});

describe('generateDesignMd — §10 Responsive', () => {
  it('renders breakpoints table', () => {
    const tokens = makeTokens({
      breakpoints: [
        { query: 'max-width: 768px', type: 'max-width', value: '768px', ruleCount: 25 },
        { query: 'min-width: 1024px', type: 'min-width', value: '1024px', ruleCount: 40 },
      ],
    });
    const md = generateDesignMd(tokens, null, baseOpts);
    expect(md).toContain('## 10. Responsive Behavior');
    expect(md).toContain('| max-width | `768px` | 25 |');
    expect(md).toContain('| min-width | `1024px` | 40 |');
  });
});

describe('generateDesignMd — §11 State Matrix', () => {
  it('emits the matrix only when components are present, with state ticks', () => {
    const tokensNoComponents = makeTokens({ components: [] });
    expect(generateDesignMd(tokensNoComponents, null, baseOpts)).not.toContain('## 11.');

    const tokens = makeTokens({
      components: [
        {
          type: 'Button',
          variants: [
            {
              name: 'Primary',
              count: 10,
              style: { background: '#635bff' },
              hoverChanges: { background: '#7a73ff' },
              focusVisibleChanges: { outline: '2px solid blue' },
              focusChanges: null,
              activeChanges: null,
              disabledStyle: { opacity: '0.5' },
              transition: 'all 150ms ease',
              sampleTexts: ['Sign up'],
            },
          ],
        },
      ],
    });
    const md = generateDesignMd(tokens, null, baseOpts);
    expect(md).toContain('## 11. State Matrix');
    expect(md).toContain('| Button · Primary | ✓ | ✓ | ✓ | — | ✓ |');
  });
});

describe('generateDesignMd — §12 Iconography', () => {
  it('emits §12 only when iconSystem is present', () => {
    expect(generateDesignMd(makeTokens({ iconSystem: null }), null, baseOpts)).not.toContain('## 12');
    const tokens = makeTokens({
      iconSystem: {
        library: 'Lucide',
        sizeScale: [16, 20, 24],
        strokeWidth: 1.5,
        colorMode: 'currentColor',
        totalCount: 80,
        labeledPercentage: 72,
      },
    });
    const md = generateDesignMd(tokens, null, baseOpts);
    expect(md).toContain('## 12. Iconography');
    expect(md).toContain('Library:** Lucide');
    expect(md).toContain('`16px`, `20px`, `24px`');
    expect(md).toContain('`1.5`');
    expect(md).toContain('Color mode:** currentColor');
    expect(md).toContain('72%');
  });
});

describe('generateDesignMd — §13 Agent Prompt Guide', () => {
  it('renders quick color reference + self-containment checklist + pointer to universal prompt', () => {
    const tokens = makeTokens({
      colorTokens: [
        Object.assign(makeColorToken({ hex: '#635bff' }), { roleLabel: 'Primary' }),
        Object.assign(makeColorToken({ hex: '#000000' }), { roleLabel: 'Ink' }),
      ],
    });
    const md = generateDesignMd(tokens, null, baseOpts);
    expect(md).toContain('## 13. Agent Prompt Guide');
    expect(md).toContain('### Quick Color Reference');
    expect(md).toContain('**Primary**: `#635bff`');
    expect(md).toContain('**Ink**: `#000000`');
    expect(md).toContain('### Self-Containment Checklist');
    expect(md).toContain('prompts/universal.md');
  });

  it('falls back to a frequency-sorted hex list when no role labels are present', () => {
    const tokens = makeTokens({
      colorTokens: [
        makeColorToken({ hex: '#aaaaaa', frequency: 200 }),
        makeColorToken({ hex: '#bbbbbb', frequency: 100 }),
      ],
    });
    const md = generateDesignMd(tokens, null, baseOpts);
    expect(md).toContain('`#aaaaaa`');
    expect(md).toContain('`#bbbbbb`');
  });
});

describe('generateDesignMd — overall sanity', () => {
  it('produces a well-formed document that ends with a newline', () => {
    const md = generateDesignMd(makeTokens(), makeReport(), baseOpts);
    expect(md.endsWith('\n')).toBe(true);
    // No unclosed code blocks
    const codeFences = (md.match(/```/g) || []).length;
    expect(codeFences % 2).toBe(0);
  });

  it('contains exactly the expected H2/H2.5 sections for a "minimum data" extraction', () => {
    // Minimum extraction: no dark mode, no motion, no icons, no components,
    // no shadows, no breakpoints. We expect the four skipped stubs + the
    // required sections that don't gate on data.
    const md = generateDesignMd(makeTokens(), null, baseOpts);
    expect(md).toContain('## 0. Brand Context');
    expect(md).toContain('## 1. Visual Theme');
    expect(md).toContain('## 2. Color Palette');
    expect(md).not.toContain('## 2.5');
    expect(md).toContain('## 3. Typography');
    expect(md).toContain('## 4. Component Stylings');
    expect(md).toContain('## 5. Layout');
    expect(md).toContain('## 6. Depth & Elevation');
    expect(md).not.toContain('## 6.5');
    expect(md).toContain('## 7. Content & Voice');
    expect(md).toContain("## 8. Do's and Don'ts");
    expect(md).toContain('## 9. Accessibility');
    expect(md).toContain('## 10. Responsive');
    expect(md).not.toContain('## 11.'); // gated on components
    expect(md).not.toContain('## 12.'); // gated on iconSystem
    expect(md).toContain('## 13. Agent Prompt Guide');
  });
});
