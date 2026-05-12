import { describe, it, expect } from 'vitest';
import {
  computeDiagnostics,
  type ProofSummary,
  type Diagnostic,
} from '../diagnostics';
import type { ColorToken, DesignTokens, ExtractionReport } from '../types';

// Test fixtures — minimal-but-valid shapes for each input. Each rule below
// crafts a small variant to trigger exactly one diagnostic, then asserts:
//   1. that the expected diagnostic id appears
//   2. that unrelated diagnostics do NOT appear
//   3. that severity, title, message contain the expected signal

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

function makeColorToken(overrides: Partial<ColorToken> & { role?: string | null } = {}): ColorToken & { role?: string | null } {
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

// A clean test palette — 20 distinct saturated hexes. Used by `makeTokens`
// so the default `baseInput` represents a "healthy" extraction (otherwise
// rules like `palette-all-grey` would fire on every test). Greys are
// deliberately absent so chroma-sensitive rules don't false-fire on the
// default fixture; tests that need greys override `colorTokens` explicitly.
const SATURATED_TEST_PALETTE = [
  '#635bff', '#0a84ff', '#34c759', '#ff3b30', '#ff9500',
  '#5856d6', '#af52de', '#ff2d55', '#5ac8fa', '#ffcc00',
  '#1e88e5', '#43a047', '#fb8c00', '#e53935', '#8e24aa',
  '#3949ab', '#00897b', '#7cb342', '#fdd835', '#bf360c',
];

function makeTokens(overrides: Partial<DesignTokens> = {}): Partial<DesignTokens> {
  return {
    colorTokens: SATURATED_TEST_PALETTE.map((hex, i) =>
      makeColorToken({ hex, frequency: 100 - i }),
    ),
    typographyLevels: Array.from({ length: 5 }, (_, i) => ({
      fontFamily: 'Inter',
      fontSize: `${24 - i * 2}px`,
      fontWeight: '400',
      lineHeight: '1.5',
      letterSpacing: 'normal',
      textTransform: null,
      fontFeatureSettings: null,
      frequency: 10,
      typicalTags: ['p'],
      sampleTexts: [],
      confidence: 'high',
    })),
    ...overrides,
  };
}

const baseInput = {
  tokens: makeTokens(),
  report: makeReport(),
  proof: { coverage: 0.95, sampleSize: 1800, unmatchedTop: [] } as ProofSummary,
  warnings: [],
};

function findById(diags: Diagnostic[], id: string): Diagnostic | undefined {
  return diags.find((d) => d.id === id || d.id.startsWith(id + '-'));
}

// ─── Rule-by-rule tests ───────────────────────────────────────────────────

describe('computeDiagnostics — pipeline warnings', () => {
  it('emits one diagnostic per pipeline warning', () => {
    const diags = computeDiagnostics({
      ...baseInput,
      warnings: ['proof failed: target blocked Playwright', 'prompt-pack failed: disk full'],
    });
    expect(diags.filter((d) => d.id.startsWith('pipeline-warning-'))).toHaveLength(2);
    expect(diags[0].severity).toBe('warning');
    expect(diags[0].message).toContain('proof failed');
  });

  it('emits engine warnings from extraction-report', () => {
    const diags = computeDiagnostics({
      ...baseInput,
      report: makeReport({ warnings: ['Low color token count consider adding more pages'] }),
    });
    expect(diags.filter((d) => d.id.startsWith('engine-warning-'))).toHaveLength(1);
  });
});

describe('computeDiagnostics — proof coverage', () => {
  it('flags low coverage (<70%) when sample size is reasonable', () => {
    const diags = computeDiagnostics({
      ...baseInput,
      proof: { coverage: 0.55, sampleSize: 1500, unmatchedTop: [{ hex: '#ff0000', count: 42 }] },
    });
    const d = findById(diags, 'low-proof-coverage');
    expect(d).toBeDefined();
    expect(d!.severity).toBe('warning');
    expect(d!.title).toContain('55.0%');
    expect(d!.details).toContain('#ff0000 (42 pixels unmatched)');
  });

  it('does NOT flag low coverage when sample size is small (drops confidence anyway)', () => {
    // Tiny sample size should suppress the low-coverage rule because
    // the percentage is itself unreliable. Instead, the low-samples
    // rule fires.
    const diags = computeDiagnostics({
      ...baseInput,
      proof: { coverage: 0.4, sampleSize: 200, unmatchedTop: [] },
    });
    expect(findById(diags, 'low-proof-coverage')).toBeUndefined();
    expect(findById(diags, 'low-proof-samples')).toBeDefined();
  });

  it('does NOT flag coverage at 70%+ (boundary case)', () => {
    const diags = computeDiagnostics({
      ...baseInput,
      proof: { coverage: 0.7, sampleSize: 1500 },
    });
    expect(findById(diags, 'low-proof-coverage')).toBeUndefined();
  });
});

describe('computeDiagnostics — single-page noise', () => {
  it('flags a 50%+ unique-color anomaly', () => {
    const diags = computeDiagnostics({
      ...baseInput,
      report: makeReport({
        designBoundary: {
          ...makeReport().designBoundary,
          anomalies: [
            { url: 'https://example.com/', description: '82% of colors on this page are unique to it (62/76)' },
          ],
        },
      }),
    });
    const d = findById(diags, 'single-page-noise');
    expect(d).toBeDefined();
    expect(d!.severity).toBe('warning');
    expect(d!.message).toContain('82%');
  });

  it('does NOT flag anomalies below 50% threshold', () => {
    const diags = computeDiagnostics({
      ...baseInput,
      report: makeReport({
        designBoundary: {
          ...makeReport().designBoundary,
          anomalies: [
            { url: 'https://example.com/', description: '30% of colors on this page are unique to it' },
          ],
        },
      }),
    });
    expect(findById(diags, 'single-page-noise')).toBeUndefined();
  });

  it('emits multiple single-page diagnostics when multiple pages are noisy', () => {
    const diags = computeDiagnostics({
      ...baseInput,
      report: makeReport({
        designBoundary: {
          ...makeReport().designBoundary,
          anomalies: [
            { url: 'https://example.com/', description: '82% of colors are unique' },
            { url: 'https://example.com/pricing', description: '60% of colors are unique' },
          ],
        },
      }),
    });
    const noiseDiags = diags.filter((d) => d.id.startsWith('single-page-noise'));
    expect(noiseDiags).toHaveLength(2);
    // Rule-local IDs: first match is always -1, second is -2, regardless
    // of how many other (unrelated) diagnostics were pushed before this rule.
    expect(noiseDiags[0].id).toBe('single-page-noise-1');
    expect(noiseDiags[1].id).toBe('single-page-noise-2');
  });

  it('numbers single-page-noise from 1 even when other rules fire before it', () => {
    // Forces low-proof-samples to fire (sampleSize < 1000), which would push
    // a diagnostic into the list BEFORE the single-page-noise loop runs.
    // The single-page-noise id suffix must still start at -1 (rule-local).
    const diags = computeDiagnostics({
      ...baseInput,
      proof: { coverage: 0.95, sampleSize: 400, unmatchedTop: [] },
      report: makeReport({
        designBoundary: {
          ...makeReport().designBoundary,
          anomalies: [
            { url: 'https://example.com/', description: '70% of colors are unique' },
          ],
        },
      }),
    });
    const first = diags.find((d) => d.id.startsWith('single-page-noise'));
    expect(first?.id).toBe('single-page-noise-1');
  });
});

describe('computeDiagnostics — framework miscall', () => {
  it('flags when uiFramework detected but tailwind is null', () => {
    const diags = computeDiagnostics({
      ...baseInput,
      report: makeReport({
        framework: { tailwind: null, uiFramework: 'Ant Design', designSystemUrl: null },
      }),
    });
    const d = findById(diags, 'framework-low-confidence');
    expect(d).toBeDefined();
    expect(d!.title).toContain('Ant Design');
    expect(d!.severity).toBe('warning');
  });

  it('does NOT flag when both Tailwind and uiFramework are detected', () => {
    const diags = computeDiagnostics({
      ...baseInput,
      report: makeReport({
        framework: {
          tailwind: { detected: true, matchCount: 50, sampleClasses: ['flex', 'p-4'], jitDetected: true },
          uiFramework: 'shadcn/ui',
          designSystemUrl: null,
        },
      }),
    });
    expect(findById(diags, 'framework-low-confidence')).toBeUndefined();
  });
});

describe('computeDiagnostics — dark mode empty diff', () => {
  it('flags dark mode supported with empty variableDiff', () => {
    const diags = computeDiagnostics({
      ...baseInput,
      tokens: {
        ...baseInput.tokens,
        darkMode: {
          supported: true,
          detectionMethod: 'toggle-button',
          lightVariables: [],
          darkVariables: [],
          variableDiff: [],
          darkScreenshots: null,
        },
      },
    });
    const d = findById(diags, 'dark-mode-empty-diff');
    expect(d).toBeDefined();
    expect(d!.severity).toBe('info');
    expect(d!.title).toContain('toggle-button');
  });

  it('does NOT flag dark mode with populated variableDiff', () => {
    const diags = computeDiagnostics({
      ...baseInput,
      tokens: {
        ...baseInput.tokens,
        darkMode: {
          supported: true,
          detectionMethod: 'media-query',
          lightVariables: [],
          darkVariables: [],
          variableDiff: [{ name: '--bg', lightValue: '#fff', darkValue: '#000' }],
          darkScreenshots: null,
        },
      },
    });
    expect(findById(diags, 'dark-mode-empty-diff')).toBeUndefined();
  });

  it('does NOT flag dark mode unsupported', () => {
    const diags = computeDiagnostics({
      ...baseInput,
      tokens: {
        ...baseInput.tokens,
        darkMode: {
          supported: false,
          detectionMethod: 'none',
          lightVariables: [],
          darkVariables: [],
          variableDiff: [],
          darkScreenshots: null,
        },
      },
    });
    expect(findById(diags, 'dark-mode-empty-diff')).toBeUndefined();
  });
});

describe('computeDiagnostics — primary is grey', () => {
  it('flags when role=primary token has near-zero saturation', () => {
    const diags = computeDiagnostics({
      ...baseInput,
      tokens: {
        ...baseInput.tokens,
        colorTokens: [
          makeColorToken({ hex: '#888888', role: 'primary' }), // achromatic grey
          ...Array.from({ length: 15 }, (_, i) => makeColorToken({ hex: `#0${i}0${i}0${i}` })),
        ],
      },
    });
    const d = findById(diags, 'primary-is-grey');
    expect(d).toBeDefined();
    expect(d!.severity).toBe('error');
    expect(d!.title).toContain('#888888');
  });

  it('does NOT flag when role=primary token is saturated', () => {
    const diags = computeDiagnostics({
      ...baseInput,
      tokens: {
        ...baseInput.tokens,
        colorTokens: [
          makeColorToken({ hex: '#635bff', role: 'primary' }), // Stripe purple, high sat
          ...Array.from({ length: 15 }, (_, i) => makeColorToken({ hex: `#0${i}0${i}0${i}` })),
        ],
      },
    });
    expect(findById(diags, 'primary-is-grey')).toBeUndefined();
  });

  it('does NOT flag when no token has role=primary', () => {
    const diags = computeDiagnostics({
      ...baseInput,
      tokens: {
        ...baseInput.tokens,
        colorTokens: Array.from({ length: 15 }, (_, i) =>
          makeColorToken({ hex: `#${i.toString(16).padStart(2, '0').repeat(3)}` }),
        ),
      },
    });
    expect(findById(diags, 'primary-is-grey')).toBeUndefined();
  });
});

describe('computeDiagnostics — low token counts', () => {
  it('flags when colorTokens has fewer than 10', () => {
    const diags = computeDiagnostics({
      ...baseInput,
      tokens: { ...baseInput.tokens, colorTokens: Array.from({ length: 5 }, () => makeColorToken()) },
    });
    expect(findById(diags, 'low-color-count')).toBeDefined();
  });

  it('flags when typographyLevels has fewer than 3', () => {
    const diags = computeDiagnostics({
      ...baseInput,
      tokens: {
        ...baseInput.tokens,
        typographyLevels: [
          { fontFamily: 'Inter', fontSize: '16px', fontWeight: '400', lineHeight: '1.5', letterSpacing: 'normal', textTransform: null, fontFeatureSettings: null, frequency: 100, typicalTags: ['p'], sampleTexts: [], confidence: 'high' },
        ],
      },
    });
    expect(findById(diags, 'low-typography-levels')).toBeDefined();
  });

  it('does NOT flag when counts are healthy', () => {
    const diags = computeDiagnostics(baseInput);
    expect(findById(diags, 'low-color-count')).toBeUndefined();
    expect(findById(diags, 'low-typography-levels')).toBeUndefined();
  });
});

describe('computeDiagnostics — palette all grey', () => {
  it('flags when all top tokens are achromatic and count >= 10', () => {
    const diags = computeDiagnostics({
      ...baseInput,
      tokens: {
        ...baseInput.tokens,
        colorTokens: Array.from({ length: 15 }, (_, i) =>
          makeColorToken({ hex: `#${i.toString(16).padStart(2, '0').repeat(3)}` }),
        ),
      },
    });
    const d = findById(diags, 'palette-all-grey');
    expect(d).toBeDefined();
    expect(d!.severity).toBe('error');
  });

  it('does NOT flag when at least one chromatic color is in the top tokens', () => {
    const diags = computeDiagnostics({
      ...baseInput,
      tokens: {
        ...baseInput.tokens,
        colorTokens: [
          makeColorToken({ hex: '#635bff' }), // Stripe purple, saturated
          ...Array.from({ length: 14 }, (_, i) =>
            makeColorToken({ hex: `#${i.toString(16).padStart(2, '0').repeat(3)}` }),
          ),
        ],
      },
    });
    expect(findById(diags, 'palette-all-grey')).toBeUndefined();
  });

  it('does NOT flag when color count is below 10 (low-color-count covers it)', () => {
    const diags = computeDiagnostics({
      ...baseInput,
      tokens: {
        ...baseInput.tokens,
        colorTokens: Array.from({ length: 5 }, () => makeColorToken({ hex: '#888888' })),
      },
    });
    expect(findById(diags, 'palette-all-grey')).toBeUndefined();
  });
});

describe('computeDiagnostics — failed pages', () => {
  it('emits one diagnostic per failed page', () => {
    const diags = computeDiagnostics({
      ...baseInput,
      report: makeReport({
        failedPages: [
          { url: 'https://example.com/blog', reason: 'Timeout after 30000ms' },
          { url: 'https://example.com/login', reason: 'Cloudflare challenge' },
        ],
      }),
    });
    expect(diags.filter((d) => d.id.startsWith('failed-page-'))).toHaveLength(2);
    const first = diags.find((d) => d.id === 'failed-page-1');
    expect(first?.title).toContain('https://example.com/blog');
    expect(first?.message).toContain('Timeout');
  });
});

describe('computeDiagnostics — clean extraction', () => {
  it('emits zero diagnostics when everything is healthy', () => {
    // baseInput is deliberately clean: 20 colors, 5 typography levels,
    // 95% proof coverage, 1800 samples, no anomalies, no warnings,
    // no dark-mode-with-empty-diff, no framework miscall.
    const diags = computeDiagnostics(baseInput);
    expect(diags).toHaveLength(0);
  });
});
