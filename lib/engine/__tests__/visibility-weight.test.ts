import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  computeElementWeight,
  aggregateColorWeights,
  applyVisibilityWeighting,
  DEFAULT_VIEWPORT,
} from '../visibility-weight';
import { assignColorRoles } from '../role-namer';
import type { ColorToken, ElementStyle } from '../types';

//  Test fixtures 

const VIEWPORT = { width: 1440, height: 900 };

/**
 * Build a minimal-but-valid ElementStyle. Defaults are chosen to NOT trigger
 * any boost or visibility gate  so the returned weight reflects only the
 * fields you override.
 */
function makeElement(overrides: Partial<ElementStyle> = {}): ElementStyle {
  return {
    tag: 'div',
    className: '',
    role: '',
    ariaLabel: '',
    textContent: '',
    href: '',
    type: '',
    src: '',
    alt: '',
    rect: { x: 100, y: 1500, width: 100, height: 100 }, // below the fold (y=1500 > viewport.height=900)
    color: '',
    backgroundColor: '',
    borderTopColor: '',
    borderRightColor: '',
    borderBottomColor: '',
    borderLeftColor: '',
    outlineColor: '',
    textDecorationColor: '',
    fontFamily: '',
    fontSize: '',
    fontWeight: '',
    lineHeight: '',
    letterSpacing: '',
    textTransform: '',
    fontFeatureSettings: '',
    paddingTop: '',
    paddingRight: '',
    paddingBottom: '',
    paddingLeft: '',
    marginTop: '',
    marginRight: '',
    marginBottom: '',
    marginLeft: '',
    gap: '',
    borderRadius: '',
    borderTopWidth: '',
    borderRightWidth: '',
    borderBottomWidth: '',
    borderLeftWidth: '',
    borderStyle: '',
    boxShadow: '',
    opacity: '1',
    zIndex: '',
    display: 'block',
    position: 'static',
    flexDirection: '',
    justifyContent: '',
    alignItems: '',
    gridTemplateColumns: '',
    maxWidth: '',
    overflow: '',
    transition: '',
    childrenCount: 0,
    hasImage: false,
    structuralRegion: 'unknown',
    nearestLandmark: '',
    isInsideMedia: false,
    ...overrides,
  };
}

function makeColorToken(overrides: Partial<ColorToken> = {}): ColorToken {
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

//  computeElementWeight: visibility gate 

describe('computeElementWeight  visibility gate', () => {
  it('returns 0 for display:none elements', () => {
    const el = makeElement({ display: 'none', rect: { x: 0, y: 0, width: 200, height: 200 } });
    expect(computeElementWeight(el, VIEWPORT)).toBe(0);
  });

  it('returns 0 for opacity:0 elements', () => {
    const el = makeElement({ opacity: '0', rect: { x: 0, y: 0, width: 200, height: 200 } });
    expect(computeElementWeight(el, VIEWPORT)).toBe(0);
  });

  it('returns 0 for zero-width elements', () => {
    const el = makeElement({ rect: { x: 0, y: 0, width: 0, height: 200 } });
    expect(computeElementWeight(el, VIEWPORT)).toBe(0);
  });

  it('returns 0 for zero-height elements', () => {
    const el = makeElement({ rect: { x: 0, y: 0, width: 200, height: 0 } });
    expect(computeElementWeight(el, VIEWPORT)).toBe(0);
  });

  it('does NOT zero-out partial opacity (0.5 still contributes)', () => {
    // Partial opacity is visible. Engine should weight it the same as opacity:1
    // (we don't multiply by alpha  the user can still see it).
    const el = makeElement({
      opacity: '0.5',
      rect: { x: 0, y: 0, width: 200, height: 200 },
      structuralRegion: 'main',
    });
    expect(computeElementWeight(el, VIEWPORT)).toBeGreaterThan(0);
  });
});

//  computeElementWeight: area 

describe('computeElementWeight  area', () => {
  it('scales weight roughly with sqrt(rect area / viewport area)', () => {
    // A 100×100 element (1% of a 1440×900 viewport area) should produce a
    // smaller weight than a 1440×900 element (full viewport).
    const small = makeElement({ rect: { x: 0, y: 0, width: 100, height: 100 } });
    const big = makeElement({ rect: { x: 0, y: 0, width: 1440, height: 900 } });
    expect(computeElementWeight(big, VIEWPORT)).toBeGreaterThan(
      computeElementWeight(small, VIEWPORT),
    );
  });

  it('caps area multiplier at 2 (full-bleed background cannot dominate)', () => {
    // Element 10× larger than the viewport. sqrt-normalized area would be
    // sqrt(100) = 10, but we cap at 2.
    const huge = makeElement({
      rect: { x: 0, y: 0, width: 4554, height: 2846 }, // ~10× viewport area
    });
    const w = computeElementWeight(huge, VIEWPORT);
    // Above-the-fold by default (y=0), no semantic/interactive boost, area
    // capped at 2 → weight ≈ 2 × 1 × 1 × 2 (foldBoost) = 4.
    expect(w).toBeLessThanOrEqual(4);
  });
});

//  computeElementWeight: semantic boost 

describe('computeElementWeight  semantic boost', () => {
  it('h1 gets a 2.0× boost over a generic div', () => {
    const div = makeElement({ rect: { x: 0, y: 0, width: 200, height: 200 } });
    const h1 = makeElement({ tag: 'h1', rect: { x: 0, y: 0, width: 200, height: 200 } });
    expect(computeElementWeight(h1, VIEWPORT) / computeElementWeight(div, VIEWPORT)).toBeCloseTo(2.0);
  });

  it('h2 gets 1.6×, h3 gets 1.4×, h4-h6 get 1.2×', () => {
    const baseRect = { x: 0, y: 0, width: 200, height: 200 };
    const div = computeElementWeight(makeElement({ rect: baseRect }), VIEWPORT);
    const h2 = computeElementWeight(makeElement({ tag: 'h2', rect: baseRect }), VIEWPORT);
    const h3 = computeElementWeight(makeElement({ tag: 'h3', rect: baseRect }), VIEWPORT);
    const h4 = computeElementWeight(makeElement({ tag: 'h4', rect: baseRect }), VIEWPORT);
    const h5 = computeElementWeight(makeElement({ tag: 'h5', rect: baseRect }), VIEWPORT);
    const h6 = computeElementWeight(makeElement({ tag: 'h6', rect: baseRect }), VIEWPORT);
    expect(h2 / div).toBeCloseTo(1.6);
    expect(h3 / div).toBeCloseTo(1.4);
    expect(h4 / div).toBeCloseTo(1.2);
    expect(h5 / div).toBeCloseTo(1.2);
    expect(h6 / div).toBeCloseTo(1.2);
  });

  it('region boost: nav/main/header = 1.2×, footer/aside = 0.8×', () => {
    const baseRect = { x: 0, y: 0, width: 200, height: 200 };
    const div = computeElementWeight(makeElement({ rect: baseRect }), VIEWPORT);
    const nav = computeElementWeight(makeElement({ rect: baseRect, structuralRegion: 'nav' }), VIEWPORT);
    const main = computeElementWeight(makeElement({ rect: baseRect, structuralRegion: 'main' }), VIEWPORT);
    const footer = computeElementWeight(makeElement({ rect: baseRect, structuralRegion: 'footer' }), VIEWPORT);
    const aside = computeElementWeight(makeElement({ rect: baseRect, structuralRegion: 'aside' }), VIEWPORT);
    expect(nav / div).toBeCloseTo(1.2);
    expect(main / div).toBeCloseTo(1.2);
    expect(footer / div).toBeCloseTo(0.8);
    expect(aside / div).toBeCloseTo(0.8);
  });

  it('h1 in footer composes: 2.0 × 0.8 = 1.6× total', () => {
    const baseRect = { x: 0, y: 0, width: 200, height: 200 };
    const div = computeElementWeight(makeElement({ rect: baseRect }), VIEWPORT);
    const h1Footer = computeElementWeight(
      makeElement({ tag: 'h1', rect: baseRect, structuralRegion: 'footer' }),
      VIEWPORT,
    );
    expect(h1Footer / div).toBeCloseTo(1.6);
  });
});

//  computeElementWeight: interactive boost 

describe('computeElementWeight  interactive boost', () => {
  it.each(['a', 'button', 'input', 'select', 'textarea'])(
    '<%s> gets 1.5× interactive boost',
    (tag) => {
      const baseRect = { x: 0, y: 0, width: 200, height: 200 };
      const div = computeElementWeight(makeElement({ rect: baseRect }), VIEWPORT);
      const interactive = computeElementWeight(makeElement({ tag, rect: baseRect }), VIEWPORT);
      expect(interactive / div).toBeCloseTo(1.5);
    },
  );

  it.each(['button', 'link', 'textbox', 'combobox', 'menuitem'])(
    'role="%s" gets 1.5× boost even on a div',
    (role) => {
      const baseRect = { x: 0, y: 0, width: 200, height: 200 };
      const div = computeElementWeight(makeElement({ rect: baseRect }), VIEWPORT);
      const interactive = computeElementWeight(makeElement({ role, rect: baseRect }), VIEWPORT);
      expect(interactive / div).toBeCloseTo(1.5);
    },
  );
});

//  computeElementWeight: fold boost 

describe('computeElementWeight  fold boost', () => {
  it('above-the-fold (y < viewport.height) gets 2.0×', () => {
    const above = makeElement({ rect: { x: 0, y: 100, width: 200, height: 200 } });
    const below = makeElement({ rect: { x: 0, y: 2000, width: 200, height: 200 } });
    expect(computeElementWeight(above, VIEWPORT) / computeElementWeight(below, VIEWPORT)).toBeCloseTo(2.0);
  });

  it('at-the-fold boundary (y === viewport.height) is BELOW the fold', () => {
    // Strict less-than: y === viewport.height means the top of the element
    // is exactly at the fold line, so the visible portion is zero.
    const atFold = makeElement({ rect: { x: 0, y: VIEWPORT.height, width: 200, height: 200 } });
    const above = makeElement({ rect: { x: 0, y: VIEWPORT.height - 1, width: 200, height: 200 } });
    expect(computeElementWeight(above, VIEWPORT)).toBeGreaterThan(
      computeElementWeight(atFold, VIEWPORT),
    );
  });
});

//  aggregateColorWeights 

describe('aggregateColorWeights', () => {
  it('attributes element weight to the nearest token cluster within ΔE', () => {
    // A hero CTA element with backgroundColor matching #635bff exactly.
    const hero = makeElement({
      tag: 'button',
      rect: { x: 100, y: 200, width: 200, height: 60 },
      structuralRegion: 'main',
      backgroundColor: '#635bff',
    });
    const pages = [{ url: 'https://example.com/', elements: [hero] }];
    const tokens = [makeColorToken({ hex: '#635bff' })];
    const weights = aggregateColorWeights(pages, tokens, VIEWPORT);
    expect(weights.get('#635bff')).toBeGreaterThan(0);
  });

  it('does NOT attribute to tokens beyond the ΔE threshold', () => {
    // An element colored brand-purple is NOT attributed to a yellow token.
    const el = makeElement({
      rect: { x: 100, y: 200, width: 200, height: 60 },
      backgroundColor: '#635bff',
    });
    const pages = [{ url: 'https://example.com/', elements: [el] }];
    const tokens = [makeColorToken({ hex: '#ffff00' })]; // bright yellow
    const weights = aggregateColorWeights(pages, tokens, VIEWPORT, 3);
    expect(weights.get('#ffff00') ?? 0).toBe(0);
  });

  it('skips invisible elements (weight 0)', () => {
    const hidden = makeElement({
      display: 'none',
      backgroundColor: '#635bff',
    });
    const pages = [{ url: 'https://example.com/', elements: [hidden] }];
    const tokens = [makeColorToken({ hex: '#635bff' })];
    const weights = aggregateColorWeights(pages, tokens, VIEWPORT);
    expect(weights.size).toBe(0);
  });

  it('a hero CTA outranks many tiny below-fold elements of a different color', () => {
    // The actual wedge: when grey appears on lots of tiny structural
    // elements and brand-purple appears on a single hero CTA, raw
    // frequency picks grey (more observations) but visibility weighting
    // picks brand-purple (one observation but on a big, interactive,
    // above-the-fold, semantically-promoted element).
    //
    // This is the failure mode dna.md §11.1 calls out and the primary
    // reason for adding visibility weighting in the first place.
    const heroPurple = makeElement({
      tag: 'button',
      rect: { x: 100, y: 200, width: 320, height: 56 },
      structuralRegion: 'main',
      backgroundColor: '#635bff',
    });
    const tinyFooterGrey = makeElement({
      tag: 'div',
      rect: { x: 0, y: 5000, width: 8, height: 8 }, // tiny + below fold + footer
      structuralRegion: 'footer',
      backgroundColor: '#666666',
    });
    const pages = [
      {
        url: 'https://example.com/',
        elements: [heroPurple, ...Array.from({ length: 50 }, () => tinyFooterGrey)],
      },
    ];
    const tokens = [
      makeColorToken({ hex: '#635bff' }),
      makeColorToken({ hex: '#666666' }),
    ];
    const weights = aggregateColorWeights(pages, tokens, VIEWPORT);
    const purpleW = weights.get('#635bff') ?? 0;
    const greyW = weights.get('#666666') ?? 0;
    expect(purpleW).toBeGreaterThan(0);
    expect(greyW).toBeGreaterThan(0);
    // Visibility weighting must rank brand-purple ABOVE grey even though
    // grey has 50× more raw observations.
    expect(purpleW).toBeGreaterThan(greyW);
  });
});

//  applyVisibilityWeighting (integration) 

describe('applyVisibilityWeighting', () => {
  function withTempDir<T>(fn: (dir: string) => T): T {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'visweight-'));
    try {
      return fn(dir);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }

  it('re-sorts colorTokens by visibility score and adds visibilityScore field', () => {
    withTempDir((dir) => {
      const tokensPath = path.join(dir, 'tokens.json');

      // Two colors: greyText (high frequency, no boosts) vs heroPurple (low
      // raw freq but boosted by hero CTA visibility). Before weighting the
      // order is [greyText, heroPurple]; after, it should be [heroPurple, greyText].
      const tokens = {
        colorTokens: [
          makeColorToken({ hex: '#666666', frequency: 200 }),
          makeColorToken({ hex: '#635bff', frequency: 30 }),
        ],
        meta: {},
      };
      fs.writeFileSync(tokensPath, JSON.stringify(tokens));

      const heroCTA = makeElement({
        tag: 'button',
        rect: { x: 100, y: 200, width: 320, height: 56 },
        structuralRegion: 'main',
        backgroundColor: '#635bff',
      });
      // Tiny 8×8 footer hairlines below the fold  minimal area, minimal
      // semantic, no interactive, no fold boost. 50 of them sum to roughly
      // half a hero's weight, so the hero still wins.
      const tinyGreyHairline = makeElement({
        tag: 'div',
        rect: { x: 0, y: 5000, width: 8, height: 8 },
        structuralRegion: 'footer',
        backgroundColor: '#666666',
      });
      const pages = [
        { url: 'https://example.com/', elements: [heroCTA, ...Array(50).fill(tinyGreyHairline)] },
      ];

      const result = applyVisibilityWeighting(tokensPath, pages, VIEWPORT);

      expect(result.weightedCount).toBeGreaterThan(0);
      expect(result.previousTopHex).toBe('#666666');
      expect(result.newTopHex).toBe('#635bff');
      expect(result.primaryChanged).toBe(true);

      const reloaded = JSON.parse(fs.readFileSync(tokensPath, 'utf-8'));
      expect(reloaded.colorTokens[0].hex).toBe('#635bff');
      expect(reloaded.colorTokens[0].visibilityScore).toBeGreaterThan(0);
    });
  });

  it('returns a no-op result when the pages array is empty', () => {
    withTempDir((dir) => {
      const tokensPath = path.join(dir, 'tokens.json');
      fs.writeFileSync(tokensPath, JSON.stringify({ colorTokens: [makeColorToken()] }));
      const result = applyVisibilityWeighting(tokensPath, [], VIEWPORT);
      expect(result.weightedCount).toBe(0);
      expect(result.primaryChanged).toBe(false);
    });
  });

  it('returns a no-op result when tokens.json is missing', () => {
    withTempDir((dir) => {
      const tokensPath = path.join(dir, 'nonexistent.json');
      const result = applyVisibilityWeighting(tokensPath, [{ url: 'x', elements: [] }], VIEWPORT);
      expect(result.weightedCount).toBe(0);
      expect(result.primaryChanged).toBe(false);
    });
  });

  it('exports DEFAULT_VIEWPORT matching extract.ts default browser context', () => {
    expect(DEFAULT_VIEWPORT.width).toBe(1440);
    expect(DEFAULT_VIEWPORT.height).toBe(900);
  });
});

//  End-to-end wedge: role-namer + visibility weighting 
//
// This is THE wedge test: it proves that visibility weighting actually
// changes which color role-namer picks as Primary, not just the array
// order. If this passes, the implementation is structurally complete.
// If this fails, visibility weighting is cosmetic-only and the accuracy
// wedge from dna.md §11.1 is not realised.

describe('visibility-weight + role-namer integration (the wedge)', () => {
  it('without visibilityScore, role-namer picks the higher-bgColor-count token', () => {
    // Two saturated colors. A real brand purple (#635bff) used on a few
    // prominent elements. A campaign red (#cc0033) used on many small
    // decorative icons. WITHOUT visibility weighting, raw bgColor count
    // dominates and the campaign red wins  which is wrong.
    const tokens: ColorToken[] = [
      makeColorToken({ hex: '#635bff', frequency: 8, usedAs: { textColor: 0, bgColor: 5, borderColor: 0, shadowColor: 0, gradientColor: 0, iconColor: 0 } }),
      makeColorToken({ hex: '#cc0033', frequency: 50, usedAs: { textColor: 0, bgColor: 50, borderColor: 0, shadowColor: 0, gradientColor: 0, iconColor: 0 } }),
    ];
    const named = assignColorRoles(tokens);
    const primary = named.find((c) => c.role === 'primary');
    expect(primary?.hex).toBe('#cc0033'); // wrong  but reproducible without visibility weighting
  });

  it('WITH visibilityScore, role-namer correctly picks the visibility-prominent token', () => {
    // Same tokens, but now augmented with visibility scores. Brand purple
    // has visibilityScore 2.0 (heavily-weighted hero CTA), campaign red
    // has 0.5 (lots of tiny icons that don't sum to as much weight).
    // role-namer's prominence signal now uses visibilityScore × 25 (capped
    // at 60) instead of the raw bgColor count.
    //
    // Math:
    //   Purple: chroma * 50 + min(2.0*25, 60) = 9 + 50 = 59
    //   Red:    chroma * 50 + min(0.5*25, 60) = ~14 + 12.5 = ~26.5
    //   → Purple wins as expected.
    const tokens: ColorToken[] = [
      Object.assign(
        makeColorToken({ hex: '#635bff', frequency: 8, usedAs: { textColor: 0, bgColor: 5, borderColor: 0, shadowColor: 0, gradientColor: 0, iconColor: 0 } }),
        { visibilityScore: 2.0 },
      ),
      Object.assign(
        makeColorToken({ hex: '#cc0033', frequency: 50, usedAs: { textColor: 0, bgColor: 50, borderColor: 0, shadowColor: 0, gradientColor: 0, iconColor: 0 } }),
        { visibilityScore: 0.5 },
      ),
    ];
    const named = assignColorRoles(tokens);
    const primary = named.find((c) => c.role === 'primary');
    expect(primary?.hex).toBe('#635bff'); // correct  visibility weighting did its job
  });

  it('role-namer falls back to bgColor count when visibilityScore is absent (legacy tokens.json)', () => {
    // Same as the first test (no visibility scores)  proves the fallback
    // path is intact for old extractions and the committed gallery examples.
    const tokens: ColorToken[] = [
      makeColorToken({ hex: '#635bff', frequency: 8, usedAs: { textColor: 0, bgColor: 5, borderColor: 0, shadowColor: 0, gradientColor: 0, iconColor: 0 } }),
      makeColorToken({ hex: '#cc0033', frequency: 50, usedAs: { textColor: 0, bgColor: 50, borderColor: 0, shadowColor: 0, gradientColor: 0, iconColor: 0 } }),
    ];
    // Ensure no token has a visibilityScore.
    for (const t of tokens) {
      expect((t as ColorToken & { visibilityScore?: number }).visibilityScore).toBeUndefined();
    }
    const named = assignColorRoles(tokens);
    const primary = named.find((c) => c.role === 'primary');
    // Same outcome as first test  fallback path picks red on raw count.
    expect(primary?.hex).toBe('#cc0033');
  });
});
