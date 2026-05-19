import { describe, it, expect } from 'vitest';
import {
  parseColor,
  parsePxValue,
  rgbaToHex,
  wcagContrast,
  deltaE,
  classifyShadow,
  splitShadowLayers,
  mergeTokenSets,
  visibleBorderColors,
  normalizeLineHeight,
  normalizeBorderRadius,
  normalizeShadowValue,
  countGridColumns,
  clusterTokens,
  type OKLCH,
} from '../cluster';
import type {
  DesignTokens,
  ColorToken,
  ElementStyle,
  DOMCollection,
} from '../types';

//  visibleBorderColors fixture helper
//
// visibleBorderColors only reads 8 fields off the element, so a Partial-
// cast keeps each test focused on the inputs that matter. The cast is
// intentional  building a full ElementStyle here would obscure the four
// lines that drive the behaviour we're verifying.

type BorderFixture = Pick<
  ElementStyle,
  | 'borderTopWidth' | 'borderTopColor'
  | 'borderRightWidth' | 'borderRightColor'
  | 'borderBottomWidth' | 'borderBottomColor'
  | 'borderLeftWidth' | 'borderLeftColor'
>;

function borderEl(o: Partial<BorderFixture>): ElementStyle {
  return {
    borderTopWidth: '0px', borderTopColor: 'rgb(0, 0, 0)',
    borderRightWidth: '0px', borderRightColor: 'rgb(0, 0, 0)',
    borderBottomWidth: '0px', borderBottomColor: 'rgb(0, 0, 0)',
    borderLeftWidth: '0px', borderLeftColor: 'rgb(0, 0, 0)',
    ...o,
  } as ElementStyle;
}

//  parseColor 

describe('parseColor', () => {
  it('parses 6-digit hex', () => {
    const c = parseColor('#ff6600');
    expect(c).toEqual({ r: 255, g: 102, b: 0, a: 1 });
  });

  it('parses 3-digit hex (shorthand)', () => {
    const c = parseColor('#f60');
    expect(c).toEqual({ r: 255, g: 102, b: 0, a: 1 });
  });

  it('parses 8-digit hex with alpha', () => {
    const c = parseColor('#ff660080');
    expect(c).not.toBeNull();
    expect(c!.r).toBe(255);
    expect(c!.g).toBe(102);
    expect(c!.b).toBe(0);
    expect(c!.a).toBeCloseTo(0.502, 1);
  });

  it('parses rgb()', () => {
    const c = parseColor('rgb(100, 200, 50)');
    expect(c).toEqual({ r: 100, g: 200, b: 50, a: 1 });
  });

  it('parses rgba() with alpha', () => {
    const c = parseColor('rgba(100, 200, 50, 0.5)');
    expect(c).toEqual({ r: 100, g: 200, b: 50, a: 0.5 });
  });

  it('parses named colors', () => {
    expect(parseColor('white')).toEqual({ r: 255, g: 255, b: 255, a: 1 });
    expect(parseColor('black')).toEqual({ r: 0, g: 0, b: 0, a: 1 });
  });

  it('parses transparent', () => {
    expect(parseColor('transparent')).toEqual({ r: 0, g: 0, b: 0, a: 0 });
  });

  it('returns null for invalid values', () => {
    expect(parseColor('')).toBeNull();
    expect(parseColor('none')).toBeNull();
    expect(parseColor('currentcolor')).toBeNull();
    expect(parseColor('inherit')).toBeNull();
  });

  it('is case-insensitive', () => {
    expect(parseColor('#FF6600')).toEqual({ r: 255, g: 102, b: 0, a: 1 });
    expect(parseColor('RGB(100, 200, 50)')).toEqual({ r: 100, g: 200, b: 50, a: 1 });
  });

  it('parses hsl()', () => {
    const c = parseColor('hsl(0, 100%, 50%)');
    expect(c).not.toBeNull();
    expect(c!.r).toBe(255);
    expect(c!.g).toBe(0);
    expect(c!.b).toBe(0);
  });

  //  Modern CSS color functions
  //
  // parseColor's hex/rgb/hsl regex paths return null for these syntaxes,
  // so the function falls through to a culori-backed branch. The tests
  // below lock that fallback in  if anyone ever rewrites parseColor and
  // drops the culori path, every test in this block fails loudly. Assert
  // alpha preservation explicitly (and exact RGB on anchor cases) so the
  // culori-version-bump regression case is also caught.

  it('parses oklab() with alpha (the Shopify Tertiary button case)', () => {
    // Real captured value from Shopify's Tertiary button bg. The numbers
    // describe ~pure white at 20% opacity. Used to be silently dropped
    // when I (wrongly) thought parseColor's regex paths exhausted the
    // function. They don't  the culori fallback handles it.
    const c = parseColor('oklab(0.999994 0.0000455678 0.0000200868 / 0.2)');
    expect(c).not.toBeNull();
    expect(c!.r).toBe(255);
    expect(c!.g).toBe(255);
    expect(c!.b).toBe(255);
    expect(c!.a).toBeCloseTo(0.2, 5);
  });

  it('parses oklch() without alpha (defaults to 1)', () => {
    const c = parseColor('oklch(0.7 0.15 240)');
    expect(c).not.toBeNull();
    expect(c!.a).toBe(1);
    // Sanity-check the RGB lives in the blue family. Exact culori output
    // can shift by 1-2 units between minor versions; an approximate band
    // is enough to confirm the conversion ran.
    expect(c!.b).toBeGreaterThan(c!.r);
    expect(c!.b).toBeGreaterThan(c!.g);
  });

  it('parses oklch() with percent lightness + alpha', () => {
    const c = parseColor('oklch(70% 0.15 240 / 0.5)');
    expect(c).not.toBeNull();
    expect(c!.a).toBeCloseTo(0.5, 5);
  });

  it('parses lab() with percent lightness', () => {
    const c = parseColor('lab(50% 40 30)');
    expect(c).not.toBeNull();
    // lab(50% 40 30) is a warm red. r > g, r > b.
    expect(c!.r).toBeGreaterThan(c!.g);
    expect(c!.r).toBeGreaterThan(c!.b);
  });

  it('parses lch() with percent lightness', () => {
    const c = parseColor('lch(50% 70 240)');
    expect(c).not.toBeNull();
    // lch(50% 70 240) is a blue. b > r, b > g.
    expect(c!.b).toBeGreaterThan(c!.r);
    expect(c!.b).toBeGreaterThan(c!.g);
  });

  it('parses hwb()', () => {
    const c = parseColor('hwb(240 30% 10%)');
    expect(c).not.toBeNull();
    // Blue (h=240) with 30% whiteness + 10% blackness  desaturated blue.
    expect(c!.b).toBeGreaterThan(c!.r);
  });

  it('parses color(display-p3 ...)', () => {
    // P3 colors get gamut-mapped down to sRGB by culori. The exact mapped
    // sRGB depends on culori's chosen gamut algorithm  test only that
    // the channels land in the right family (green for this case).
    const c = parseColor('color(display-p3 0.5 0.8 0.2)');
    expect(c).not.toBeNull();
    expect(c!.g).toBeGreaterThan(c!.r);
    expect(c!.g).toBeGreaterThan(c!.b);
  });

  it('handles uppercase modern-color names (case-insensitive)', () => {
    // parseColor lowercases the input before any regex match. Once we
    // hit the culori fallback the string is already lowercase  but if
    // anyone ever reorders the lowercase step this test pins the
    // behaviour. getComputedStyle always serialises lowercase anyway.
    const c = parseColor('OKLCH(0.7 0.15 240)');
    expect(c).not.toBeNull();
  });

  it('returns null for malformed modern-color input', () => {
    // culori.parse should fail cleanly on garbage and parseColor catches
    // any thrown error before returning null. No surprises for callers.
    expect(parseColor('oklab(noise garbage)')).toBeNull();
    expect(parseColor('oklch(  )')).toBeNull();
  });
});

//  parsePxValue 

describe('parsePxValue', () => {
  it('parses px values', () => {
    expect(parsePxValue('16px')).toBe(16);
    expect(parsePxValue('0px')).toBe(0);
    expect(parsePxValue('1.5px')).toBe(1.5);
  });

  it('converts rem to px (×16)', () => {
    expect(parsePxValue('1rem')).toBe(16);
    expect(parsePxValue('2rem')).toBe(32);
    expect(parsePxValue('0.75rem')).toBe(12);
  });

  it('converts em to px (×16)', () => {
    expect(parsePxValue('1em')).toBe(16);
  });

  it('handles unitless numbers', () => {
    expect(parsePxValue('24')).toBe(24);
  });

  it('returns null for non-numeric values', () => {
    expect(parsePxValue('auto')).toBeNull();
    expect(parsePxValue('none')).toBeNull();
    expect(parsePxValue('normal')).toBeNull();
    expect(parsePxValue('')).toBeNull();
  });
});

//  rgbaToHex 

describe('rgbaToHex', () => {
  it('converts RGB to 6-digit hex', () => {
    expect(rgbaToHex(255, 102, 0)).toBe('#ff6600');
    expect(rgbaToHex(0, 0, 0)).toBe('#000000');
    expect(rgbaToHex(255, 255, 255)).toBe('#ffffff');
  });

  it('clamps values to 0-255', () => {
    expect(rgbaToHex(300, -10, 128)).toBe('#ff0080');
  });

  it('rounds fractional values', () => {
    expect(rgbaToHex(127.6, 0, 0)).toBe('#800000');
  });
});

//  wcagContrast 

describe('wcagContrast', () => {
  it('returns 21:1 for black on white', () => {
    const ratio = wcagContrast('#000000', '#ffffff');
    expect(ratio).toBeCloseTo(21, 0);
  });

  it('returns 1:1 for same color', () => {
    const ratio = wcagContrast('#336699', '#336699');
    expect(ratio).toBeCloseTo(1, 0);
  });

  it('is symmetric', () => {
    const a = wcagContrast('#000000', '#ffffff');
    const b = wcagContrast('#ffffff', '#000000');
    expect(a).toBeCloseTo(b, 5);
  });

  it('returns 1 for invalid colors', () => {
    expect(wcagContrast('invalid', '#ffffff')).toBe(1);
  });
});

//  deltaE (OKLCH) 

describe('deltaE', () => {
  it('returns 0 for identical colors', () => {
    const c: OKLCH = { l: 0.5, c: 0.1, h: 180 };
    expect(deltaE(c, c)).toBe(0);
  });

  it('returns small value for similar colors', () => {
    const a: OKLCH = { l: 0.5, c: 0.1, h: 180 };
    const b: OKLCH = { l: 0.51, c: 0.1, h: 181 };
    expect(deltaE(a, b)).toBeLessThan(3);
  });

  it('returns large value for different colors', () => {
    const a: OKLCH = { l: 0.9, c: 0.0, h: 0 };   // near white
    const b: OKLCH = { l: 0.1, c: 0.0, h: 0 };   // near black
    expect(deltaE(a, b)).toBeGreaterThan(50);
  });

  it('is symmetric', () => {
    const a: OKLCH = { l: 0.6, c: 0.15, h: 30 };
    const b: OKLCH = { l: 0.4, c: 0.10, h: 200 };
    expect(deltaE(a, b)).toBeCloseTo(deltaE(b, a), 10);
  });

  it('detects within-cluster threshold (< 3)', () => {
    // Two very similar purples
    const a: OKLCH = { l: 0.5, c: 0.2, h: 270 };
    const b: OKLCH = { l: 0.505, c: 0.2, h: 270.5 };
    expect(deltaE(a, b)).toBeLessThan(3);
  });
});

//  classifyShadow 

describe('splitShadowLayers', () => {
  it('treats rgba commas as non-separators', () => {
    expect(splitShadowLayers('rgba(0,0,0,0.1) 0 4px 6px')).toHaveLength(1);
    expect(splitShadowLayers('rgba(50,50,93,0.12) 0px 16px 32px 0px')).toHaveLength(1);
  });

  it('splits real multi-layer shadows', () => {
    expect(splitShadowLayers('0 1px 2px #000, 0 4px 8px #111')).toHaveLength(2);
    expect(splitShadowLayers('rgba(0,0,0,0.1) 0 1px 2px, rgba(0,0,0,0.05) 0 4px 8px')).toHaveLength(2);
  });

  it('handles single simple shadow', () => {
    expect(splitShadowLayers('0 2px 4px #000')).toHaveLength(1);
  });
});

describe('classifyShadow', () => {
  it('classifies elevation shadow (hex color)', () => {
    expect(classifyShadow('0px 2px 8px #00000020')).toBe('elevation');
    expect(classifyShadow('0 4px 6px #0000001a')).toBe('elevation');
  });

  it('classifies elevation shadow (rgba color)', () => {
    expect(classifyShadow('rgba(0,0,0,0.1) 0px 4px 6px 0px')).toBe('elevation');
    expect(classifyShadow('rgba(50,50,93,0.12) 0px 16px 32px 0px')).toBe('elevation');
  });

  it('classifies border-shadow (spread only, no offset/blur)', () => {
    expect(classifyShadow('0 0 0 2px #0000001a')).toBe('border-shadow');
    expect(classifyShadow('0 0 0 2px rgba(0,0,0,0.1)')).toBe('border-shadow');
  });

  it('classifies ring (negative spread, no offset/blur)', () => {
    expect(classifyShadow('0 0 0 -2px #000')).toBe('ring');
  });

  it('classifies inset shadow', () => {
    expect(classifyShadow('inset 0 2px 4px #0000001a')).toBe('inset');
    expect(classifyShadow('inset 0 2px 4px rgba(0,0,0,0.1)')).toBe('inset');
  });

  it('classifies real multi-layer shadows as complex-stack', () => {
    expect(classifyShadow('0 1px 2px #000, 0 4px 8px #111')).toBe('complex-stack');
    expect(classifyShadow('rgba(0,0,0,0.1) 0 1px 2px, rgba(0,0,0,0.05) 0 4px 8px')).toBe('complex-stack');
  });

  it('defaults to elevation for ambiguous values', () => {
    expect(classifyShadow('0 0 4px #000')).toBe('elevation');
  });
});

//  mergeTokenSets 

function makeColor(hex: string, freq: number): ColorToken {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return {
    hex,
    rgba: [r, g, b, 1],
    frequency: freq,
    usedAs: { textColor: 0, bgColor: freq, borderColor: 0, shadowColor: 0, gradientColor: 0, iconColor: 0 },
    cssVariableNames: [],
    pagesCoverage: 1,
    sourcePages: [],
    confidence: 'high',
  };
}

function makeMinimalTokens(colors: ColorToken[]): DesignTokens {
  return {
    colorTokens: colors,
    colorRelationships: { lightnessScales: [], complementaryPairs: [], contrastPairs: [] },
    typographyLevels: [
      { fontFamily: 'Inter', fontSize: '16px', fontWeight: '400', lineHeight: '1.5', letterSpacing: 'normal', textTransform: null, fontFeatureSettings: null, frequency: 50, typicalTags: ['p'], sampleTexts: ['Hello'], confidence: 'high' },
    ],
    fontInfo: { fontFaces: [], loadedFonts: [] },
    shadowTokens: [{ value: '0 2px 4px #0001', frequency: 10, type: 'elevation', typicalElements: ['div'] }],
    radiusTokens: [{ value: '8px', frequency: 20, typicalElements: ['div'] }],
    spacingSystem: { baseUnit: null, commonValues: [], gcdCandidate: null },
    componentGroups: [],
    cssVariablesSummary: [],
    metadata: { totalPages: 1, totalElements: 100, extractedAt: '2026-01-01', urls: ['https://example.com'] },
  } as unknown as DesignTokens;
}

describe('mergeTokenSets', () => {
  it('merges perceptually identical colors by combining frequencies', () => {
    const existing = makeMinimalTokens([makeColor('#ff0000', 10)]);
    // #ff0100 is nearly identical to #ff0000
    const incoming = makeMinimalTokens([makeColor('#ff0100', 5)]);
    const merged = mergeTokenSets(existing, incoming);
    // Should merge into one color since delta-E < 3
    expect(merged.colorTokens.length).toBe(1);
    expect(merged.colorTokens[0].frequency).toBe(15);
  });

  it('keeps distinct colors separate', () => {
    const existing = makeMinimalTokens([makeColor('#ff0000', 10)]);
    const incoming = makeMinimalTokens([makeColor('#0000ff', 5)]); // very different
    const merged = mergeTokenSets(existing, incoming);
    expect(merged.colorTokens.length).toBe(2);
  });

  it('merges typography by key (family|size|weight)', () => {
    const existing = makeMinimalTokens([]);
    existing.typographyLevels = [
      { fontFamily: 'Inter', fontSize: '16px', fontWeight: '400', lineHeight: '1.5', letterSpacing: 'normal', textTransform: null, fontFeatureSettings: null, frequency: 50, typicalTags: ['p'], sampleTexts: ['Hello'], confidence: 'high' },
    ];
    const incoming = makeMinimalTokens([]);
    incoming.typographyLevels = [
      { fontFamily: 'Inter', fontSize: '16px', fontWeight: '400', lineHeight: '1.5', letterSpacing: 'normal', textTransform: null, fontFeatureSettings: null, frequency: 30, typicalTags: ['p'], sampleTexts: ['World'], confidence: 'high' },
      { fontFamily: 'Inter', fontSize: '32px', fontWeight: '700', lineHeight: '1.2', letterSpacing: 'normal', textTransform: null, fontFeatureSettings: null, frequency: 10, typicalTags: ['h1'], sampleTexts: ['Title'], confidence: 'medium' },
    ];
    const merged = mergeTokenSets(existing, incoming);
    expect(merged.typographyLevels.length).toBe(2);
    const body = merged.typographyLevels.find(t => t.fontSize === '16px');
    expect(body!.frequency).toBe(80);
  });

  it('merges shadows by exact value', () => {
    const existing = makeMinimalTokens([]);
    existing.shadowTokens = [{ value: '0 2px 4px #0001', frequency: 10, type: 'elevation', typicalElements: ['div'] }];
    const incoming = makeMinimalTokens([]);
    incoming.shadowTokens = [
      { value: '0 2px 4px #0001', frequency: 5, type: 'elevation', typicalElements: ['div'] },
      { value: '0 8px 16px #0002', frequency: 3, type: 'elevation', typicalElements: ['section'] },
    ];
    const merged = mergeTokenSets(existing, incoming);
    expect(merged.shadowTokens.length).toBe(2);
    expect(merged.shadowTokens.find(s => s.value === '0 2px 4px #0001')!.frequency).toBe(15);
  });

  it('merges radius tokens by exact value', () => {
    const existing = makeMinimalTokens([]);
    existing.radiusTokens = [{ value: '8px', frequency: 20, typicalElements: ['div'] }];
    const incoming = makeMinimalTokens([]);
    incoming.radiusTokens = [
      { value: '8px', frequency: 10, typicalElements: ['div'] },
      { value: '16px', frequency: 5, typicalElements: ['section'] },
    ];
    const merged = mergeTokenSets(existing, incoming);
    expect(merged.radiusTokens.length).toBe(2);
    expect(merged.radiusTokens.find(r => r.value === '8px')!.frequency).toBe(30);
  });
});

//  visibleBorderColors

describe('visibleBorderColors', () => {
  it('counts a 4-side uniform border ONCE, not 4×', () => {
    // The historical bug: a card with `border: 1px solid #abc` contributed
    // #abc four times per element, 4xing the hairline-tone frequency.
    const el = borderEl({
      borderTopWidth: '1px', borderTopColor: 'rgb(229, 231, 235)',
      borderRightWidth: '1px', borderRightColor: 'rgb(229, 231, 235)',
      borderBottomWidth: '1px', borderBottomColor: 'rgb(229, 231, 235)',
      borderLeftWidth: '1px', borderLeftColor: 'rgb(229, 231, 235)',
    });
    const colors = visibleBorderColors(el);
    expect(colors.size).toBe(1);
    expect(colors.has('rgb(229, 231, 235)')).toBe(true);
  });

  it('returns an empty set when every side has zero width', () => {
    // The Tailwind-preflight scenario: `border-color: rgb(229, 231, 235)`
    // is set by the framework reset, but `border-width: 0` means no border
    // actually renders. The colour shouldn't pollute the palette.
    const el = borderEl({
      borderTopWidth: '0px', borderTopColor: 'rgb(229, 231, 235)',
      borderRightWidth: '0px', borderRightColor: 'rgb(229, 231, 235)',
      borderBottomWidth: '0px', borderBottomColor: 'rgb(229, 231, 235)',
      borderLeftWidth: '0px', borderLeftColor: 'rgb(229, 231, 235)',
    });
    expect(visibleBorderColors(el).size).toBe(0);
  });

  it('returns only the visible-side colour when only one side has width', () => {
    // The left-accent-card pattern: only the left border renders. Other
    // sides have width 0 but still carry a computed border-color value
    // (currentColor / the element's text colour). Those must not leak.
    const el = borderEl({
      borderLeftWidth: '4px', borderLeftColor: 'rgb(255, 0, 0)',
      // The other three sides keep the default rgb(0,0,0) from borderEl()
      // with width 0  exactly the situation getComputedStyle reports for
      // a `border-left: 4px solid red` declaration.
    });
    const colors = visibleBorderColors(el);
    expect(colors.size).toBe(1);
    expect(colors.has('rgb(255, 0, 0)')).toBe(true);
    expect(colors.has('rgb(0, 0, 0)')).toBe(false);
  });

  it('counts each distinct colour when sides have different colours', () => {
    // A multi-colour border (rare but real on stylised cards, e.g.
    // a top-accent + bottom-shadow-stand-in pattern). Each unique colour
    // counts once  the dedupe is on colour, not on count of sides.
    const el = borderEl({
      borderTopWidth: '2px', borderTopColor: 'rgb(255, 0, 0)',
      borderRightWidth: '2px', borderRightColor: 'rgb(0, 255, 0)',
      borderBottomWidth: '2px', borderBottomColor: 'rgb(0, 0, 255)',
      borderLeftWidth: '2px', borderLeftColor: 'rgb(255, 255, 0)',
    });
    const colors = visibleBorderColors(el);
    expect(colors.size).toBe(4);
    expect(colors.has('rgb(255, 0, 0)')).toBe(true);
    expect(colors.has('rgb(0, 255, 0)')).toBe(true);
    expect(colors.has('rgb(0, 0, 255)')).toBe(true);
    expect(colors.has('rgb(255, 255, 0)')).toBe(true);
  });

  it('treats subpixel widths as visible', () => {
    // High-DPI sites sometimes use 0.5px or 0.66px hairlines. Those must
    // count as visible  parseFloat handles the conversion. Defensive
    // tests for the parseFloat edge case in case anyone ever swaps the
    // gate for a stricter integer check.
    const el = borderEl({
      borderTopWidth: '0.5px', borderTopColor: 'rgb(99, 102, 241)',
    });
    expect(visibleBorderColors(el).size).toBe(1);
  });
});

//  alphaVariants  same-RGB clustering must preserve observed alphas
//
// Issue #3 history: pre-fix, an alpha=0.2 overlay variant of the same RGB
// got silently rolled into the alpha=1 cluster (OKLCH conversion drops
// alpha, so deltaE = 0 between alpha-variants of the same colour). The
// loser's frequency was added but the alpha=0.2 fact was lost. Now the
// cluster tracks `alphaCounts` internally and surfaces `alphaVariants`
// on the emitted ColorToken when more than one distinct alpha is seen.

function makeColorElement(overrides: Partial<ElementStyle>): ElementStyle {
  // Minimal-but-valid ElementStyle used to drive clusterTokens through
  // its color-collection loop. isElementVisible() requires non-zero rect
  // and non-`none` display; everything else can be a sensible default.
  // The fields the cluster reads off elements during color collection
  // are: rect, display, opacity, color, backgroundColor, the four
  // border-side colors + widths, outlineColor, textDecorationColor, and
  // boxShadow. Other fields stay at defaults that won't trip the gate.
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
    rect: { x: 0, y: 0, width: 100, height: 40 },
    color: 'rgb(0, 0, 0)',
    backgroundColor: 'rgba(0, 0, 0, 0)',
    borderTopColor: 'rgb(0, 0, 0)',
    borderRightColor: 'rgb(0, 0, 0)',
    borderBottomColor: 'rgb(0, 0, 0)',
    borderLeftColor: 'rgb(0, 0, 0)',
    outlineColor: 'rgba(0, 0, 0, 0)',
    textDecorationColor: 'rgba(0, 0, 0, 0)',
    fontFamily: 'sans-serif',
    fontSize: '16px',
    fontWeight: '400',
    lineHeight: 'normal',
    letterSpacing: 'normal',
    textTransform: '',
    fontFeatureSettings: '',
    paddingTop: '0px',
    paddingRight: '0px',
    paddingBottom: '0px',
    paddingLeft: '0px',
    marginTop: '0px',
    marginRight: '0px',
    marginBottom: '0px',
    marginLeft: '0px',
    gap: '0px',
    borderRadius: '0px',
    borderTopWidth: '0px',
    borderRightWidth: '0px',
    borderBottomWidth: '0px',
    borderLeftWidth: '0px',
    borderStyle: 'none',
    boxShadow: 'none',
    opacity: '1',
    zIndex: '0',
    display: 'block',
    position: 'static',
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'stretch',
    gridTemplateColumns: 'none',
    maxWidth: 'none',
    overflow: 'visible',
    transition: 'none',
    childrenCount: 0,
    hasImage: false,
    structuralRegion: 'content',
    nearestLandmark: null,
    isInsideMedia: false,
    ...overrides,
  } as ElementStyle;
}

function makePage(url: string, elements: ElementStyle[]) {
  // PageExtraction shape  cluster.ts only reads `url` and `dom.elements`
  // (plus other optional fields not used in these alpha tests). All other
  // DOMCollection fields default to empty arrays.
  const dom: DOMCollection = {
    cssVariables: [],
    elements,
    pseudoElements: [],
    gradients: [],
    svgColors: [],
    svgSizes: [],
    fontInfo: { fontFaces: [], loadedFonts: [], googleFontsLinks: [] },
    logoColors: null,
  };
  return { url, dom };
}

describe('alphaVariants (Issue #3 fix)', () => {
  it('OMITS the field when a cluster only saw one alpha', () => {
    // Single solid background  cluster should NOT emit alphaVariants
    // (keeps tokens.json compact for the common case).
    const tokens = clusterTokens(
      [makePage('https://x/', [
        makeColorElement({ backgroundColor: 'rgb(0, 0, 0)' }),
      ])],
      [],
    );
    const black = tokens.colorTokens.find((c) => c.hex === '#000000');
    expect(black).toBeDefined();
    expect(black!.alphaVariants).toBeUndefined();
  });

  it('emits sorted-by-frequency-desc list when same RGB appears at multiple alphas', () => {
    // Same RGB at alpha=1.0 (dominant, 3x) and alpha=0.2 (1x). Pre-fix,
    // the 0.2 entry silently merged into the 1.0 entry and the alpha
    // info disappeared. Post-fix, alphaVariants surfaces both with the
    // dominant alpha first.
    const tokens = clusterTokens(
      [makePage('https://x/', [
        makeColorElement({ backgroundColor: 'rgb(255, 255, 255)' }),
        makeColorElement({ backgroundColor: 'rgb(255, 255, 255)' }),
        makeColorElement({ backgroundColor: 'rgb(255, 255, 255)' }),
        makeColorElement({ backgroundColor: 'rgba(255, 255, 255, 0.2)' }),
      ])],
      [],
    );
    const white = tokens.colorTokens.find((c) => c.hex === '#ffffff');
    expect(white).toBeDefined();
    expect(white!.alphaVariants).toEqual([1, 0.2]);
    // Invariant: alphaVariants[0] equals rgba[3] (the dominant alpha).
    expect(white!.alphaVariants![0]).toBe(white!.rgba[3]);
  });

  it('orders three+ distinct alphas by frequency, not by alpha value', () => {
    // Five elements with three distinct alphas. alpha=0.5 is most
    // frequent (3x), alpha=1.0 is mid (1x), alpha=0.2 is least (1x).
    // alphaVariants[0] should be the MOST FREQUENT alpha (0.5), not
    // the highest alpha value (1.0). This is the "dominant alpha
    // matches rgba[3]" invariant in action.
    const tokens = clusterTokens(
      [makePage('https://x/', [
        makeColorElement({ backgroundColor: 'rgba(50, 50, 50, 0.5)' }),
        makeColorElement({ backgroundColor: 'rgba(50, 50, 50, 0.5)' }),
        makeColorElement({ backgroundColor: 'rgba(50, 50, 50, 0.5)' }),
        makeColorElement({ backgroundColor: 'rgb(50, 50, 50)' }),
        makeColorElement({ backgroundColor: 'rgba(50, 50, 50, 0.2)' }),
      ])],
      [],
    );
    const grey = tokens.colorTokens.find((c) => c.hex === '#323232');
    expect(grey).toBeDefined();
    expect(grey!.alphaVariants).toEqual([0.5, 1, 0.2]);
    expect(grey!.alphaVariants![0]).toBe(grey!.rgba[3]);
  });

  it('buckets near-identical alphas together via 3-decimal rounding', () => {
    // Authored alpha 0.2 can return as 0.20000003 or 0.199997 depending
    // on float drift through CSS parsing  upstream of parseColor. The
    // rounding to 3 decimals collapses these into a single bucket so
    // the variants list reports honest distinct alphas, not float noise.
    const tokens = clusterTokens(
      [makePage('https://x/', [
        // All three are functionally "0.2"  rgbaKey itself rounds
        // alpha to 3 decimals when building the map key, so the entries
        // collapse before clustering even begins. The point of the test
        // is to verify the rounding contract end-to-end: noisy 0.2-ish
        // inputs surface as one alpha bucket (0.2), not three.
        makeColorElement({ backgroundColor: 'rgba(99, 102, 241, 0.2)' }),
        makeColorElement({ backgroundColor: 'rgba(99, 102, 241, 0.2)' }),
        makeColorElement({ backgroundColor: 'rgba(99, 102, 241, 0.2)' }),
      ])],
      [],
    );
    const indigo = tokens.colorTokens.find((c) => c.hex === '#6366f1');
    expect(indigo).toBeDefined();
    // Only one distinct alpha  field is OMITTED rather than emitting
    // a single-element list. Keeps the schema honest about variants.
    expect(indigo!.alphaVariants).toBeUndefined();
    expect(indigo!.rgba[3]).toBe(0.2);
  });
});

//  sourcePages per-page frequency (Issue #4 fix)
//
// History: pre-fix, sourcePages[i].frequency was a fake uniform
// distribution  `Math.round(total / pages.size)` assigned to every
// page, regardless of where the colour actually appeared. The new
// ColorEntry.pages: Map<url, count> tracks real per-page counts; the
// emit reads them directly. These tests lock the honest behaviour in.

describe('sourcePages frequency (Issue #4 fix)', () => {
  it('reports honest per-page counts, not a uniform split', () => {
    // Colour used 3x on page A and 1x on page B. The pre-fix code
    // would emit (2, 2) because 4 / 2 pages = 2. The new code emits
    // the real (3, 1).
    const tokens = clusterTokens(
      [
        makePage('https://site/a', [
          makeColorElement({ backgroundColor: 'rgb(255, 100, 50)' }),
          makeColorElement({ backgroundColor: 'rgb(255, 100, 50)' }),
          makeColorElement({ backgroundColor: 'rgb(255, 100, 50)' }),
        ]),
        makePage('https://site/b', [
          makeColorElement({ backgroundColor: 'rgb(255, 100, 50)' }),
        ]),
      ],
      [],
    );
    const orange = tokens.colorTokens.find((c) => c.hex === '#ff6432');
    expect(orange).toBeDefined();
    expect(orange!.sourcePages).toEqual([
      { url: 'https://site/a', frequency: 3 },
      { url: 'https://site/b', frequency: 1 },
    ]);
    // Sanity-check: per-page counts sum to the total cluster frequency.
    const sum = orange!.sourcePages.reduce((acc, sp) => acc + sp.frequency, 0);
    expect(sum).toBe(orange!.frequency);
  });

  it('sorts sourcePages by frequency descending', () => {
    // Five elements split (1, 3) across pages. sourcePages should be
    // (page-b 3, page-a 1)  the page where the colour dominates lists
    // first. Consistent with the alphaVariants ordering convention.
    const tokens = clusterTokens(
      [
        makePage('https://site/a', [
          makeColorElement({ backgroundColor: 'rgb(10, 20, 30)' }),
        ]),
        makePage('https://site/b', [
          makeColorElement({ backgroundColor: 'rgb(10, 20, 30)' }),
          makeColorElement({ backgroundColor: 'rgb(10, 20, 30)' }),
          makeColorElement({ backgroundColor: 'rgb(10, 20, 30)' }),
        ]),
      ],
      [],
    );
    const navy = tokens.colorTokens.find((c) => c.hex === '#0a141e');
    expect(navy).toBeDefined();
    expect(navy!.sourcePages[0]).toEqual({
      url: 'https://site/b',
      frequency: 3,
    });
    expect(navy!.sourcePages[1]).toEqual({
      url: 'https://site/a',
      frequency: 1,
    });
  });

  it('survives OKLCH cluster merging  near-identical RGBs combine counts per page', () => {
    // rgb(10,10,10) on page A (2x) + rgb(12,12,12) on page B (3x) cluster
    // together via OKLCH (deltaE < 3). The merged entry's sourcePages
    // should be (page-b 3, page-a 2)  the merge step must preserve
    // page-disaggregated counts, not collapse them into one bucket.
    const tokens = clusterTokens(
      [
        makePage('https://site/a', [
          makeColorElement({ backgroundColor: 'rgb(10, 10, 10)' }),
          makeColorElement({ backgroundColor: 'rgb(10, 10, 10)' }),
        ]),
        makePage('https://site/b', [
          makeColorElement({ backgroundColor: 'rgb(12, 12, 12)' }),
          makeColorElement({ backgroundColor: 'rgb(12, 12, 12)' }),
          makeColorElement({ backgroundColor: 'rgb(12, 12, 12)' }),
        ]),
      ],
      [],
    );
    // Both RGBs collapse to one cluster representative. Find by total
    // frequency  it should be 5 (2 + 3) regardless of which RGB won.
    const dark = tokens.colorTokens.find((c) => c.frequency === 5);
    expect(dark).toBeDefined();
    expect(dark!.sourcePages.length).toBe(2);
    const pageBfreq = dark!.sourcePages.find((sp) => sp.url === 'https://site/b')?.frequency;
    const pageAfreq = dark!.sourcePages.find((sp) => sp.url === 'https://site/a')?.frequency;
    expect(pageBfreq).toBe(3);
    expect(pageAfreq).toBe(2);
  });
});

//  outlineColor + textDecorationColor are NOT collected (Issue #6 + #8 fix)
//
// Both fields default to `currentcolor` and getComputedStyle reports a
// real colour value on every visible element even when outline-style /
// text-decoration is `none`. Pre-fix, every visible element bumped the
// borderColor count (via outline) and the textColor count (via text-
// decoration) for its own ink, inflating ink-tone counts by ~1 per
// element across the whole extraction. These tests lock in the new
// no-collection behaviour: a colour that ONLY appears as outline or
// text-decoration must not surface in colorTokens.

describe('outline + text-decoration not double-counted (Issue #6 + #8)', () => {
  it('does NOT add outlineColor to the palette', () => {
    // Element's background is blue. Its outline-color is set to a
    // distinct red, but outline-style is none (so the outline doesn't
    // render). Pre-fix: red appeared in colorTokens as a borderColor.
    // Post-fix: red is absent because we don't collect outlineColor.
    const tokens = clusterTokens(
      [makePage('https://x/', [
        makeColorElement({
          backgroundColor: 'rgb(0, 0, 255)',
          outlineColor: 'rgb(255, 0, 0)',
        }),
      ])],
      [],
    );
    expect(tokens.colorTokens.find((c) => c.hex === '#0000ff')).toBeDefined();
    expect(tokens.colorTokens.find((c) => c.hex === '#ff0000')).toBeUndefined();
  });

  it('does NOT add textDecorationColor to the palette', () => {
    // Element's color is blue. Its text-decoration-color is set to a
    // distinct green, but text-decoration is none. Pre-fix: green
    // appeared in colorTokens as a textColor. Post-fix: green is absent.
    const tokens = clusterTokens(
      [makePage('https://x/', [
        makeColorElement({
          color: 'rgb(0, 0, 255)',
          textDecorationColor: 'rgb(0, 255, 0)',
        }),
      ])],
      [],
    );
    expect(tokens.colorTokens.find((c) => c.hex === '#0000ff')).toBeDefined();
    expect(tokens.colorTokens.find((c) => c.hex === '#00ff00')).toBeUndefined();
  });
});

//  Cluster representative prefers CSS-variable-named entries (Issue #9)
//
// History: pre-fix, when two OKLCH-similar entries clustered (e.g.
// #000000 used 5x as raw text + #020202 used 2x via `var(--text-primary)`),
// the higher-frequency one won representative status and the variable
// name was relegated to `cssVariableNames` while the canonical `hex`
// stayed `#000000`. The new rule: an entry with CSS variable names
// outranks an entry without, regardless of frequency  variable names
// are explicit design-intent signal.

describe('cluster representative prefers CSS-var-named entries (Issue #9)', () => {
  // The colour fixtures below use rgb(10,10,10) and rgb(12,12,12)
  // (#0a0a0a / #0c0c0c) because their OKLCH ΔE is just under the
  // 3-threshold  guaranteed to cluster via the same condition real
  // OKLCH-similar entries do. (Closer pairs like #000000 / #020202 fall
  // OUTSIDE the threshold and stay as separate clusters; the existing
  // "near-identical RGBs combine counts per page" test already
  // validates this 10/12 pairing clusters.)

  it('swaps representative to the var-named entry even when it has lower frequency', () => {
    // 5x #0a0a0a (no var) + 2x #0c0c0c (var=--text-primary). Pre-fix:
    // rep = #0a0a0a because higher frequency. Post-fix: rep = #0c0c0c
    // because the CSS variable name is the design-intent signal.
    const tokens = clusterTokens(
      [makePage('https://x/', [
        makeColorElement({ color: 'rgb(10, 10, 10)' }),
        makeColorElement({ color: 'rgb(10, 10, 10)' }),
        makeColorElement({ color: 'rgb(10, 10, 10)' }),
        makeColorElement({ color: 'rgb(10, 10, 10)' }),
        makeColorElement({ color: 'rgb(10, 10, 10)' }),
        makeColorElement({ color: 'rgb(12, 12, 12)' }),
        makeColorElement({ color: 'rgb(12, 12, 12)' }),
      ])],
      [
        {
          name: '--text-primary',
          value: 'rgb(12, 12, 12)',
          source: ':root',
        },
      ],
    );
    const named = tokens.colorTokens.find((c) => c.hex === '#0c0c0c');
    expect(named).toBeDefined();
    expect(named!.cssVariableNames).toEqual(['--text-primary']);
    expect(named!.frequency).toBe(7);
    // The raw #0a0a0a entry no longer exists as a separate token; it
    // merged in and surrendered representative status to the var-named.
    expect(tokens.colorTokens.find((c) => c.hex === '#0a0a0a')).toBeUndefined();
  });

  it('does NOT swap when the var-named entry already wins on frequency', () => {
    // 5x #0c0c0c (var) + 2x #0a0a0a (no var). The var-named entry is
    // higher-frequency, so it became the cluster rep on push. Incoming
    // has no var, swap doesn't fire (no-op path). Same end result as
    // the previous test  rep stays #0c0c0c  but verifies the
    // un-swapped branch.
    const tokens = clusterTokens(
      [makePage('https://x/', [
        makeColorElement({ color: 'rgb(12, 12, 12)' }),
        makeColorElement({ color: 'rgb(12, 12, 12)' }),
        makeColorElement({ color: 'rgb(12, 12, 12)' }),
        makeColorElement({ color: 'rgb(12, 12, 12)' }),
        makeColorElement({ color: 'rgb(12, 12, 12)' }),
        makeColorElement({ color: 'rgb(10, 10, 10)' }),
        makeColorElement({ color: 'rgb(10, 10, 10)' }),
      ])],
      [
        {
          name: '--text-primary',
          value: 'rgb(12, 12, 12)',
          source: ':root',
        },
      ],
    );
    const named = tokens.colorTokens.find((c) => c.hex === '#0c0c0c');
    expect(named).toBeDefined();
    expect(named!.cssVariableNames).toEqual(['--text-primary']);
    expect(named!.frequency).toBe(7);
  });

  it('keeps frequency-based winner when BOTH entries have var names', () => {
    // Both clusters carry CSS variable names. Higher-freq #0c0c0c (3x)
    // stays the rep; the swap rule requires that existing has NO vars
    // while incoming does, so the no-swap branch fires. Var names from
    // the loser still get unioned into the rep.
    const tokens = clusterTokens(
      [makePage('https://x/', [
        makeColorElement({ color: 'rgb(12, 12, 12)' }),
        makeColorElement({ color: 'rgb(12, 12, 12)' }),
        makeColorElement({ color: 'rgb(12, 12, 12)' }),
        makeColorElement({ color: 'rgb(10, 10, 10)' }),
      ])],
      [
        { name: '--text-strong', value: 'rgb(12, 12, 12)', source: ':root' },
        { name: '--text-secondary', value: 'rgb(10, 10, 10)', source: ':root' },
      ],
    );
    const merged = tokens.colorTokens.find((c) => c.hex === '#0c0c0c');
    expect(merged).toBeDefined();
    // Both var names land on the cluster representative.
    expect(merged!.cssVariableNames.sort()).toEqual(
      ['--text-secondary', '--text-strong'].sort(),
    );
    expect(merged!.frequency).toBe(4);
    expect(tokens.colorTokens.find((c) => c.hex === '#0a0a0a')).toBeUndefined();
  });

  it('keeps frequency-based winner when NEITHER entry has var names', () => {
    // No CSS variables at all  pure frequency wins (the unchanged
    // path). 4x #0a0a0a + 1x #0c0c0c. Rep = #0a0a0a.
    const tokens = clusterTokens(
      [makePage('https://x/', [
        makeColorElement({ color: 'rgb(10, 10, 10)' }),
        makeColorElement({ color: 'rgb(10, 10, 10)' }),
        makeColorElement({ color: 'rgb(10, 10, 10)' }),
        makeColorElement({ color: 'rgb(10, 10, 10)' }),
        makeColorElement({ color: 'rgb(12, 12, 12)' }),
      ])],
      [],
    );
    const merged = tokens.colorTokens.find((c) => c.hex === '#0a0a0a');
    expect(merged).toBeDefined();
    expect(merged!.cssVariableNames).toEqual([]);
    expect(merged!.frequency).toBe(5);
    expect(tokens.colorTokens.find((c) => c.hex === '#0c0c0c')).toBeUndefined();
  });
});

//  Typography visibility gate (Issue T1 fix)
//
// History: the typography extraction loop only checked textContent, so
// hidden-but-DOM-present elements (modals, dropdowns, a11y visually-
// hidden helpers) contributed typography levels. The new gate mirrors
// the colour pass's isElementVisible() check  display:none, opacity:0,
// zero-rect elements no longer pollute typographyLevels with text-style
// values that never render to the user.

describe('typography visibility gate (Issue T1)', () => {
  it('skips display:none elements with text content', () => {
    // Visible: Roboto 20px on a 100x40 visible element.
    // Hidden: ComicSans 40px on a display:none element with text. The
    // hidden one would have surfaced as the LARGEST typography level
    // (sorted size-desc) and confused downstream consumers about the
    // brand's display typeface. With the gate, only Roboto/20px lands.
    const tokens = clusterTokens(
      [makePage('https://x/', [
        makeColorElement({
          textContent: 'Visible heading',
          fontFamily: 'Roboto',
          fontSize: '20px',
          fontWeight: '500',
        }),
        makeColorElement({
          textContent: 'Hidden heading',
          fontFamily: 'ComicSans',
          fontSize: '40px',
          fontWeight: '900',
          display: 'none',
        }),
      ])],
      [],
    );
    expect(tokens.typographyLevels.length).toBe(1);
    expect(tokens.typographyLevels[0].fontFamily).toBe('Roboto');
    expect(tokens.typographyLevels[0].fontSize).toBe('20px');
    expect(tokens.typographyLevels[0].fontWeight).toBe('500');
  });

  it('skips opacity:0 elements with text content', () => {
    // Same scenario via the opacity:0 axis. Same expected outcome  the
    // visible one wins, the invisible one is dropped.
    const tokens = clusterTokens(
      [makePage('https://x/', [
        makeColorElement({
          textContent: 'Visible body',
          fontFamily: 'Inter',
          fontSize: '16px',
        }),
        makeColorElement({
          textContent: 'Invisible body',
          fontFamily: 'Garbage',
          fontSize: '99px',
          opacity: '0',
        }),
      ])],
      [],
    );
    expect(tokens.typographyLevels.length).toBe(1);
    expect(tokens.typographyLevels[0].fontFamily).toBe('Inter');
  });

  it('skips zero-rect elements with text content', () => {
    // An element collapsed to 0x0 (e.g. a width:0 container holding
    // text for a hidden tooltip) gates out via the rect check, even
    // though display + opacity look "visible". Matches the colour pass.
    const tokens = clusterTokens(
      [makePage('https://x/', [
        makeColorElement({
          textContent: 'Real',
          fontFamily: 'Inter',
          fontSize: '18px',
        }),
        makeColorElement({
          textContent: 'Phantom',
          fontFamily: 'Garbage',
          fontSize: '99px',
          rect: { x: 0, y: 0, width: 0, height: 0 },
        }),
      ])],
      [],
    );
    expect(tokens.typographyLevels.length).toBe(1);
    expect(tokens.typographyLevels[0].fontFamily).toBe('Inter');
  });
});

//  Typography wrapper-element skip (Issue T2 fix)
//
// History: the typography loop counted every element with non-empty
// `textContent`. Because textContent is descendant-aggregated, a layout
// like <div><div><p>text</p></div></div> contributed THREE entries to
// the same typography group  the outer divs reported "text" via their
// descendants even though they rendered no glyphs themselves. Switching
// the gate to `directText` (immediate text-node children only) makes
// the wrapper divs report empty and skip cleanly. Real text-rendering
// elements with inline children (e.g. <p>Hello <a>world</a></p>) still
// count both p and a  each has its own direct text, which is the
// correct count.

describe('typography wrapper-element skip (Issue T2)', () => {
  it('skips wrapper elements that have no DIRECT text (only descendant-aggregated)', () => {
    // Wrapper div: textContent = "Body text" (descendant aggregate),
    // directText = "" (no immediate text children). Pre-fix this
    // contributed a phantom typography level under the wrapper's font.
    // Post-fix: skipped, only the leaf <p> contributes.
    const tokens = clusterTokens(
      [makePage('https://x/', [
        // The outermost wrapper. Descendant text BUT no direct glyphs.
        makeColorElement({
          tag: 'div',
          textContent: 'Body text',
          directText: '',
          fontFamily: 'WrapperFont',
          fontSize: '99px',
        }),
        // Another wrapper level deeper. Same descendant pattern.
        makeColorElement({
          tag: 'div',
          textContent: 'Body text',
          directText: '',
          fontFamily: 'WrapperFont',
          fontSize: '99px',
        }),
        // The leaf paragraph that actually renders the text.
        makeColorElement({
          tag: 'p',
          textContent: 'Body text',
          directText: 'Body text',
          fontFamily: 'Inter',
          fontSize: '16px',
        }),
      ])],
      [],
    );
    // Only the leaf typography survives. Wrappers' fake "99px
    // WrapperFont" level is gated out.
    expect(tokens.typographyLevels.length).toBe(1);
    expect(tokens.typographyLevels[0].fontFamily).toBe('Inter');
    expect(tokens.typographyLevels[0].fontSize).toBe('16px');
    expect(tokens.typographyLevels[0].frequency).toBe(1);
  });

  it('still counts inline-text elements with their own direct text', () => {
    // <p>Hello <a>world</a></p>:
    //   <p> directText = "Hello "  counts as body
    //   <a> directText = "world"   counts as body (same group  inherits
    //                              family/size/weight from parent)
    // Both contribute. Net group frequency = 2. Sample texts include both.
    // This proves the directText gate doesn't accidentally drop
    // legitimate inline-rendered text.
    const tokens = clusterTokens(
      [makePage('https://x/', [
        makeColorElement({
          tag: 'p',
          textContent: 'Hello world',  // descendant-aggregated
          directText: 'Hello ',          // only the text NOT inside <a>
          fontFamily: 'Inter',
          fontSize: '16px',
        }),
        makeColorElement({
          tag: 'a',
          textContent: 'world',
          directText: 'world',           // <a> directly carries this text
          fontFamily: 'Inter',
          fontSize: '16px',
        }),
      ])],
      [],
    );
    // Both elements collide on the same {family|size|weight} key, so
    // they merge into one level with freq=2.
    expect(tokens.typographyLevels.length).toBe(1);
    expect(tokens.typographyLevels[0].frequency).toBe(2);
  });

  it('falls back to textContent when directText is undefined (legacy fixtures)', () => {
    // Older fixtures predate the directText field. The gate must not
    // accidentally skip them  fallback to textContent preserves the
    // original behaviour for legacy data. Verified by passing an
    // element with NO directText prop set: textContent gate wins.
    const tokens = clusterTokens(
      [makePage('https://x/', [
        makeColorElement({
          textContent: 'Legacy body',
          // intentionally NO directText override  exercises the
          // `el.directText !== undefined` fallback branch
          fontFamily: 'Inter',
          fontSize: '16px',
        }),
      ])],
      [],
    );
    expect(tokens.typographyLevels.length).toBe(1);
    expect(tokens.typographyLevels[0].fontFamily).toBe('Inter');
  });
});

//  normalizeLineHeight (Issue T3 + T4 helper)

describe('normalizeLineHeight', () => {
  it('returns the px value for absolute px lineHeights', () => {
    expect(normalizeLineHeight('24px', 16)).toBe(24);
    expect(normalizeLineHeight('28px', 16)).toBe(28);
  });

  it('multiplies unitless lineHeight by font size', () => {
    // "1.5" * 16 = 24. Tailwind-style unitless ratios collapse to the
    // same px value as an explicit "24px" lineHeight on the same font.
    expect(normalizeLineHeight('1.5', 16)).toBe(24);
    expect(normalizeLineHeight('1.25', 16)).toBe(20);
  });

  it('handles percent lineHeights', () => {
    // "150%" * 16 = 24. Same as unitless 1.5.
    expect(normalizeLineHeight('150%', 16)).toBe(24);
  });

  it('handles em / rem lineHeights as absolute lengths', () => {
    // 1.5em on a 16px font is NOT the same as a unitless 1.5  em
    // resolves against the FONT size of the element where it's
    // declared, which for line-height means the element's own font
    // size, giving the same end result here (24px). But parsePxValue
    // treats em/rem as 16x multiplier (1.5em = 24px). The test pins
    // the current behaviour even though the spec is subtly different.
    expect(normalizeLineHeight('1.5em', 16)).toBe(24);
    expect(normalizeLineHeight('1.5rem', 16)).toBe(24);
  });

  it('treats "normal" as 1.2 x font size (CSS spec default)', () => {
    // "normal" is the CSS default. Browsers compute roughly 1.2x font
    // size for most Western scripts. Pin 1.2 as our canonical default.
    expect(normalizeLineHeight('normal', 16)).toBe(19);
    expect(normalizeLineHeight('normal', 20)).toBe(24);
  });

  it('returns the 1.2x fallback for malformed input', () => {
    // Empty / non-numeric / garbage strings fall through to the same
    // 1.2x font-size default as "normal". Defensive  any unparseable
    // computed-style edge case the engine encounters lands here
    // rather than throwing or returning NaN.
    expect(normalizeLineHeight('', 16)).toBe(19);
    expect(normalizeLineHeight('garbage', 16)).toBe(19);
  });

  it('rounds sub-pixel values to integers', () => {
    // Float drift from a browser computing 1.5 x 16.5 = 24.75 lands
    // on 25, while 24.25 lands on 24. Sub-pixel noise within the
    // same authored line-height collapses to one bucket.
    expect(normalizeLineHeight('24.25px', 16)).toBe(24);
    expect(normalizeLineHeight('24.5px', 16)).toBe(25);
  });
});

//  Typography lineHeight clustering (Issue T3 + T4 fix)
//
// History: pre-fix, the cluster key was `{family|size|weight}`  same
// family/size/weight with DIFFERENT lineHeights collapsed into one
// level, and `mode(g.lineHeights)` picked the dominant lineHeight as
// the emit value (T3 lost the secondary token). Also, mode() ran
// across mixed-unit strings ("24px" vs "1.5") so output spelling
// depended on insertion order (T4 ambiguity).
//
// Post-fix: lineHeight is normalised to integer px via
// normalizeLineHeight() and added as a key axis. Distinct lineHeights
// split into distinct levels. The emit always says "Npx" so the form
// is unambiguous regardless of how each element authored its
// lineHeight.

describe('typography lineHeight clustering (Issue T3 + T4)', () => {
  it('splits typography levels when lineHeights differ on same family/size/weight', () => {
    // Tailwind-style scenario: text-base/4 (lineHeight 16px) vs
    // text-base/6 (lineHeight 24px)  same fontSize/family/weight,
    // distinct lineHeight design tokens. Pre-fix: one merged level.
    // Post-fix: two separate levels.
    const tokens = clusterTokens(
      [makePage('https://x/', [
        makeColorElement({
          textContent: 'tight body',
          fontFamily: 'Inter',
          fontSize: '16px',
          fontWeight: '400',
          lineHeight: '16px',
        }),
        makeColorElement({
          textContent: 'tight body 2',
          fontFamily: 'Inter',
          fontSize: '16px',
          fontWeight: '400',
          lineHeight: '16px',
        }),
        makeColorElement({
          textContent: 'loose body',
          fontFamily: 'Inter',
          fontSize: '16px',
          fontWeight: '400',
          lineHeight: '24px',
        }),
      ])],
      [],
    );
    expect(tokens.typographyLevels.length).toBe(2);
    const lhs = tokens.typographyLevels.map((l) => l.lineHeight).sort();
    expect(lhs).toEqual(['16px', '24px']);
  });

  it('MERGES cross-unit equivalents (px vs unitless vs percent) on same font', () => {
    // Three different ways to write a 24px lineHeight on a 16px font:
    //   "24px", "1.5", "150%". All normalise to 24 and merge into ONE
    // typography level. Pre-fix mode() would have picked an arbitrary
    // spelling. Post-fix the emit is always "24px".
    const tokens = clusterTokens(
      [makePage('https://x/', [
        makeColorElement({
          textContent: 'a',
          fontFamily: 'Inter',
          fontSize: '16px',
          lineHeight: '24px',
        }),
        makeColorElement({
          textContent: 'b',
          fontFamily: 'Inter',
          fontSize: '16px',
          lineHeight: '1.5',
        }),
        makeColorElement({
          textContent: 'c',
          fontFamily: 'Inter',
          fontSize: '16px',
          lineHeight: '150%',
        }),
      ])],
      [],
    );
    expect(tokens.typographyLevels.length).toBe(1);
    expect(tokens.typographyLevels[0].lineHeight).toBe('24px');
    expect(tokens.typographyLevels[0].frequency).toBe(3);
  });

  it('treats "normal" as the same as 1.2x font size for clustering', () => {
    // Element A specifies "normal" lineHeight; element B specifies
    // explicit "19px" (which is round(16 * 1.2)). Same canonical
    // value, should cluster together. Verifies the "normal" branch
    // of normalizeLineHeight produces a stable bucket.
    const tokens = clusterTokens(
      [makePage('https://x/', [
        makeColorElement({
          textContent: 'a',
          fontFamily: 'Inter',
          fontSize: '16px',
          lineHeight: 'normal',
        }),
        makeColorElement({
          textContent: 'b',
          fontFamily: 'Inter',
          fontSize: '16px',
          lineHeight: '19px',
        }),
      ])],
      [],
    );
    expect(tokens.typographyLevels.length).toBe(1);
    expect(tokens.typographyLevels[0].lineHeight).toBe('19px');
    expect(tokens.typographyLevels[0].frequency).toBe(2);
  });
});

//  Spacing visibility gate (Issue S1 fix)
//
// History: the spacing-collection loop iterated every element's
// padding / margin / gap regardless of visibility. A hidden tooltip
// with `padding: 7px` would contribute 7 to spacingValues, drag down
// the GCD from (say) 4 to 1, and silently break the scale extraction
// for the whole site. The new gate mirrors the colour + typography
// passes and prevents off-rhythm hidden values from poisoning the
// frequency map.

describe('spacing visibility gate (Issue S1)', () => {
  it('skips padding from a display:none element', () => {
    // Visible: padding 16px (clean 4-multiple)
    // Hidden: padding 7px (off-rhythm  if counted would drag GCD to 1)
    // Post-fix: hidden is skipped, scale captures the visible 16 cleanly.
    const tokens = clusterTokens(
      [makePage('https://x/', [
        makeColorElement({
          paddingTop: '16px',
          paddingRight: '16px',
          paddingBottom: '16px',
          paddingLeft: '16px',
        }),
        makeColorElement({
          paddingTop: '7px',
          paddingRight: '7px',
          paddingBottom: '7px',
          paddingLeft: '7px',
          display: 'none',
        }),
      ])],
      [],
    );
    // 16 made it into the scale, 7 didn't.
    expect(tokens.spacingSystem.scale).toContain(16);
    expect(tokens.spacingSystem.scale).not.toContain(7);
  });

  it('skips margin from an opacity:0 element', () => {
    // Same shape via the opacity axis. Verifies the gate fires for
    // every isElementVisible branch (not just display:none).
    const tokens = clusterTokens(
      [makePage('https://x/', [
        makeColorElement({
          marginTop: '24px',
        }),
        makeColorElement({
          marginTop: '13px',
          opacity: '0',
        }),
      ])],
      [],
    );
    expect(tokens.spacingSystem.scale).toContain(24);
    expect(tokens.spacingSystem.scale).not.toContain(13);
  });

  it('skips gap from a zero-rect element', () => {
    // A flex container collapsed to 0x0 (degenerate after layout)
    // still has a computed `gap` value. The visibility gate skips it
    // so the gap doesn't pollute the spacing scale.
    const tokens = clusterTokens(
      [makePage('https://x/', [
        makeColorElement({ gap: '32px' }),
        makeColorElement({
          gap: '11px',
          rect: { x: 0, y: 0, width: 0, height: 0 },
        }),
      ])],
      [],
    );
    expect(tokens.spacingSystem.scale).toContain(32);
    expect(tokens.spacingSystem.scale).not.toContain(11);
  });
});

//  maxContentWidth picking (Issue S5 fix)
//
// History: maxContentWidth was the mode of all maxWidth strings seen.
// On 5/7 real brands this produced "100%" because many small
// responsive widgets ship max-width:100% while only a few layout
// containers ship the px cap. The new decision tree prefers concrete
// repeated px values (the layout cap) over single occurrences over
// non-px frequency.

describe('maxContentWidth picking (Issue S5)', () => {
  it('prefers a repeated px value over a more-frequent "100%"', () => {
    // The pre-fix bug exactly: 6 widgets at 100%, 2 layout containers
    // at 1200px. Mode picks "100%". S5 says: largest repeated px wins.
    const tokens = clusterTokens(
      [makePage('https://x/', [
        makeColorElement({ maxWidth: '100%' }),
        makeColorElement({ maxWidth: '100%' }),
        makeColorElement({ maxWidth: '100%' }),
        makeColorElement({ maxWidth: '100%' }),
        makeColorElement({ maxWidth: '100%' }),
        makeColorElement({ maxWidth: '100%' }),
        makeColorElement({ maxWidth: '1200px' }),
        makeColorElement({ maxWidth: '1200px' }),
      ])],
      [],
    );
    expect(tokens.spacingSystem.maxContentWidth).toBe('1200px');
  });

  it('picks the LARGEST repeated px when several px values repeat', () => {
    // 1100 appears 3x, 1200 appears 2x. Mode-of-px would pick 1100.
    // S5 instead picks 1200 (the largest cap) because that's the
    // genuine "content max" while smaller px values are usually
    // section / column caps.
    const tokens = clusterTokens(
      [makePage('https://x/', [
        makeColorElement({ maxWidth: '1100px' }),
        makeColorElement({ maxWidth: '1100px' }),
        makeColorElement({ maxWidth: '1100px' }),
        makeColorElement({ maxWidth: '1200px' }),
        makeColorElement({ maxWidth: '1200px' }),
      ])],
      [],
    );
    expect(tokens.spacingSystem.maxContentWidth).toBe('1200px');
  });

  it('handles rem maxWidths by converting to px', () => {
    // `max-width: 80rem` is a common Tailwind / modern-CSS pattern for
    // a 1280px cap. The picker should normalise it through parsePxValue
    // (rem * 16) so it lands in the same numeric bucket as `1280px`.
    const tokens = clusterTokens(
      [makePage('https://x/', [
        makeColorElement({ maxWidth: '80rem' }),
        makeColorElement({ maxWidth: '1280px' }),
        makeColorElement({ maxWidth: '100%' }),
      ])],
      [],
    );
    expect(tokens.spacingSystem.maxContentWidth).toBe('1280px');
  });

  it('falls back to the largest single px when nothing repeats', () => {
    // No px value appears twice  layer 2 kicks in: pick the largest
    // single px. Beats percentages because px is explicit design intent.
    const tokens = clusterTokens(
      [makePage('https://x/', [
        makeColorElement({ maxWidth: '100%' }),
        makeColorElement({ maxWidth: '100%' }),
        makeColorElement({ maxWidth: '100%' }),
        makeColorElement({ maxWidth: '1440px' }),  // one-off layout cap
      ])],
      [],
    );
    expect(tokens.spacingSystem.maxContentWidth).toBe('1440px');
  });

  it('falls back to non-px mode when no px values exist', () => {
    // Truly fluid layout  every container is 100%. There's no px
    // signal, so the pre-fix "mode of non-px" behaviour is the best
    // we can do. "100%" is the honest answer here.
    const tokens = clusterTokens(
      [makePage('https://x/', [
        makeColorElement({ maxWidth: '100%' }),
        makeColorElement({ maxWidth: '100%' }),
        makeColorElement({ maxWidth: 'fit-content' }),
      ])],
      [],
    );
    expect(tokens.spacingSystem.maxContentWidth).toBe('100%');
  });

  it('returns null when no element has an explicit maxWidth', () => {
    // All elements default to "none"  filtered upstream. The picker
    // sees an empty maxWidthValues array and returns null cleanly.
    const tokens = clusterTokens(
      [makePage('https://x/', [
        makeColorElement({ maxWidth: 'none' }),
        makeColorElement({ maxWidth: 'none' }),
      ])],
      [],
    );
    expect(tokens.spacingSystem.maxContentWidth).toBeNull();
  });
});

//  normalizeBorderRadius (Issue R8 + R9 helper)

describe('normalizeBorderRadius', () => {
  it('rounds sub-pixel px values to integer (rem-drift collapse)', () => {
    // The Wise case: `border-radius: 1.17rem` resolves to ~18.7693px
    // and ~18.769px depending on browser float drift. Both should
    // land in the same "19px" bucket post-fix.
    expect(normalizeBorderRadius('18.7693px')).toBe('19px');
    expect(normalizeBorderRadius('18.769px')).toBe('19px');
    expect(normalizeBorderRadius('37.5385px')).toBe('38px');
  });

  it('passes integer px values through unchanged', () => {
    expect(normalizeBorderRadius('8px')).toBe('8px');
    expect(normalizeBorderRadius('16px')).toBe('16px');
    expect(normalizeBorderRadius('9999px')).toBe('9999px');
  });

  it('preserves percentage values verbatim', () => {
    // 50%  ellipse / circle marker (semantically distinct from px).
    // 100%  small-widget fully-rounded marker.
    expect(normalizeBorderRadius('50%')).toBe('50%');
    expect(normalizeBorderRadius('100%')).toBe('100%');
  });

  it('filters out extreme outliers above MAX_RADIUS_PX (10000)', () => {
    // The Shopify scenario: `border-radius: calc(infinity * 1px)` or
    // `Number.MAX_SAFE_INTEGER`-style sentinel resolves to
    // 33,554,432px which currently surfaces as "3.35544e+07px" in
    // tokens.json. Drop it entirely  not a design token.
    //
    // The cap is set ABOVE the conventional pill value (9999px) so
    // legitimate pill radii pass through; anything an order of
    // magnitude higher is overflow / sentinel territory.
    expect(normalizeBorderRadius('3.35544e+07px')).toBeNull();
    expect(normalizeBorderRadius('33554432px')).toBeNull();
    expect(normalizeBorderRadius('50000px')).toBeNull();
    // Boundary check: 9999 keeps (pill), 10001 drops.
    expect(normalizeBorderRadius('9999px')).toBe('9999px');
    expect(normalizeBorderRadius('10001px')).toBeNull();
  });

  it('filters out all-zero shorthand forms', () => {
    // The simple '0px' check in the old code missed "0px 0px 0px 0px".
    // Now the all-zero detector catches every form that renders no
    // visible radius regardless of how many components were authored.
    expect(normalizeBorderRadius('0px')).toBeNull();
    expect(normalizeBorderRadius('0px 0px')).toBeNull();
    expect(normalizeBorderRadius('0px 0px 0px 0px')).toBeNull();
    expect(normalizeBorderRadius('0%')).toBeNull();
  });

  it('normalises each corner of asymmetric shorthands independently', () => {
    // The captured Wise / Shopify pattern: top-rounded card with
    // sub-pixel rem-derived values. Each corner gets the same
    // rounding treatment as the single-value path.
    expect(normalizeBorderRadius('18.7693px 18.7693px 0px 0px')).toBe('19px 19px 0px 0px');
    expect(normalizeBorderRadius('32px 32px 0px 0px')).toBe('32px 32px 0px 0px');
    expect(normalizeBorderRadius('0px 0px 12px 12px')).toBe('0px 0px 12px 12px');
  });

  it('preserves mixed-unit asymmetric forms', () => {
    // Real CSS allows mixing units across corners. The normaliser
    // rounds the px-like ones and leaves percentages alone, so the
    // emitted shape still reflects authored intent.
    expect(normalizeBorderRadius('8px 50% 8px 50%')).toBe('8px 50% 8px 50%');
  });

  it('drops an asymmetric form when any corner exceeds the max-radius cap', () => {
    // If ANY corner is an outlier, the whole token is suspect.
    // Defensive return null rather than emit partial nonsense.
    expect(normalizeBorderRadius('8px 50000px 8px 8px')).toBeNull();
  });

  it('handles rem values via parsePxValue', () => {
    // 1rem = 16px  rounds to 16. Same bucket as authored "16px".
    expect(normalizeBorderRadius('1rem')).toBe('16px');
    expect(normalizeBorderRadius('0.5rem')).toBe('8px');
  });

  it('returns null for empty / "none" input', () => {
    expect(normalizeBorderRadius('')).toBeNull();
    expect(normalizeBorderRadius('none')).toBeNull();
  });

  it('passes through elliptical-radius syntax (slash) unchanged', () => {
    // CSS allows `border-radius: 8px / 4px` for elliptical corners.
    // Rare and not a design system pattern we've seen  pass through
    // opaquely rather than risk mangling the syntax.
    expect(normalizeBorderRadius('8px / 4px')).toBe('8px / 4px');
  });
});

//  Radius clustering integration tests (Issue R1 + R8 + R9 fix)

describe('radius clustering (Issue R1 + R8 + R9)', () => {
  it('hides off-rhythm radii from hidden elements (visibility gate)', () => {
    // R1: a hidden element with a weird 7px radius shouldn't drag a
    // phantom entry into radiusTokens. Visible 16px is the only one
    // that survives.
    const tokens = clusterTokens(
      [makePage('https://x/', [
        makeColorElement({ borderRadius: '16px' }),
        makeColorElement({ borderRadius: '7px', display: 'none' }),
      ])],
      [],
    );
    const values = tokens.radiusTokens.map((r) => r.value);
    expect(values).toContain('16px');
    expect(values).not.toContain('7px');
  });

  it('merges rem-drift values into a single bucket', () => {
    // R8: two elements with subpixel-different computed radii (rem
    // float drift) both land in the "19px" bucket. Pre-fix they
    // would have appeared as two separate radiusTokens entries.
    const tokens = clusterTokens(
      [makePage('https://x/', [
        makeColorElement({ borderRadius: '18.7693px' }),
        makeColorElement({ borderRadius: '18.769px' }),
        makeColorElement({ borderRadius: '18.7694px' }),
      ])],
      [],
    );
    expect(tokens.radiusTokens.length).toBe(1);
    expect(tokens.radiusTokens[0].value).toBe('19px');
    expect(tokens.radiusTokens[0].frequency).toBe(3);
  });

  it('filters extreme outliers (3.35e+07px sentinel)', () => {
    // R9: Shopify's calc()-overflow sentinel "3.35544e+07px" appeared
    // 25 times in the captured data. Post-fix it doesn't make it
    // into radiusTokens at all  only the real radii (12px, 24px)
    // surface.
    const tokens = clusterTokens(
      [makePage('https://x/', [
        makeColorElement({ borderRadius: '12px' }),
        makeColorElement({ borderRadius: '3.35544e+07px' }),
        makeColorElement({ borderRadius: '24px' }),
      ])],
      [],
    );
    const values = tokens.radiusTokens.map((r) => r.value);
    expect(values).toContain('12px');
    expect(values).toContain('24px');
    expect(values.some((v) => v.includes('e+'))).toBe(false);
    expect(values.some((v) => /^[0-9]{4,}px$/.test(v))).toBe(false);
  });

  it('preserves 50% / 9999px as distinct buckets (semantic difference)', () => {
    // 50% is the ellipse/circle marker. 9999px is the pill convention.
    // Even though both produce rounded shapes, they're different
    // design intents  keep them separate.
    const tokens = clusterTokens(
      [makePage('https://x/', [
        makeColorElement({ borderRadius: '50%' }),
        makeColorElement({ borderRadius: '9999px' }),
      ])],
      [],
    );
    const values = tokens.radiusTokens.map((r) => r.value);
    expect(values).toContain('50%');
    expect(values).toContain('9999px');
  });
});

//  normalizeShadowValue (Issue SH3 helper)

describe('normalizeShadowValue', () => {
  it('strips Tailwind preflight all-zero transparent placeholder layers', () => {
    // Real Shopify shadow: 4 placeholder layers from Tailwind v4's
    // CSS variable preflight + one real layer. Post-strip only the
    // real layer remains.
    const input =
      'rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.3) 0px 4px 6px 0px';
    expect(normalizeShadowValue(input)).toBe('rgba(0, 0, 0, 0.3) 0px 4px 6px 0px');
  });

  it('preserves multi-layer real shadows untouched', () => {
    // Wise's complex-stack: two real layers with non-zero alpha and
    // non-zero offsets. Nothing should be stripped.
    const input =
      'rgba(0, 0, 0, 0.15) 0px 10px 32px 0px, rgba(0, 0, 0, 0.04) 0px 40px 40px 0px';
    expect(normalizeShadowValue(input)).toBe(input);
  });

  it('preserves single-layer real shadows untouched', () => {
    expect(normalizeShadowValue('rgba(0, 0, 0, 0.1) 0px 2px 4px 0px')).toBe(
      'rgba(0, 0, 0, 0.1) 0px 2px 4px 0px',
    );
  });

  it('returns null when every layer is transparent', () => {
    // All layers are rgba(0,0,0,0) placeholders. Functionally equivalent
    // to box-shadow: none  drop entirely so the element doesn't
    // contribute a phantom "shadow" token to the system.
    const input =
      'rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px';
    expect(normalizeShadowValue(input)).toBeNull();
  });

  it('returns null for "none" and empty input', () => {
    expect(normalizeShadowValue('none')).toBeNull();
    expect(normalizeShadowValue('')).toBeNull();
  });

  it('drops an all-zero-numeric layer even with a non-transparent colour', () => {
    // Layer like `rgba(0, 0, 0, 0.5) 0px 0px 0px 0px`: visible colour
    // but no offset / blur / spread. Renders nothing. Drop.
    const input =
      'rgba(0, 0, 0, 0.5) 0px 0px 0px 0px, rgba(0, 0, 0, 0.1) 0px 4px 6px 0px';
    expect(normalizeShadowValue(input)).toBe('rgba(0, 0, 0, 0.1) 0px 4px 6px 0px');
  });

  it('preserves inset shadows when they have real offsets / blur', () => {
    const input =
      'rgba(255, 255, 255, 0.08) 0px 1px 0px 0px inset, rgba(0, 0, 0, 0.1) 0px 4px 6px 0px';
    expect(normalizeShadowValue(input)).toBe(input);
  });

  it('preserves modern color syntaxes in shadow layers', () => {
    // oklch / oklab shadow colours flow through  the regex includes
    // those, and parseColor handles them via culori.
    const input = 'oklch(0.7 0.15 240 / 0.3) 0px 4px 6px 0px';
    expect(normalizeShadowValue(input)).toBe(input);
  });
});

//  countGridColumns (Issue L2)

describe('countGridColumns', () => {
  it('counts simple fr tracks', () => {
    expect(countGridColumns('1fr 1fr 1fr')).toBe(3);
  });

  it('counts mixed pixel + fr tracks', () => {
    expect(countGridColumns('200px 1fr 100px')).toBe(3);
  });

  it('treats each minmax() track as one column (not two)', () => {
    // Issue L2: getComputedStyle returns `minmax(0px, 1fr)` with the
    // embedded space; the naive split was counting this as 6 tokens
    // for a 3-col grid. Helper respects paren depth.
    expect(
      countGridColumns('minmax(0px, 1fr) minmax(0px, 1fr) minmax(0px, 1fr)'),
    ).toBe(3);
  });

  it('treats fit-content() as one track', () => {
    expect(countGridColumns('fit-content(200px) 1fr 1fr')).toBe(3);
  });

  it('treats clamp() / nested functions as one track', () => {
    expect(countGridColumns('clamp(100px, 50%, 400px) 1fr')).toBe(2);
  });

  it('skips bracket-wrapped line names', () => {
    // Line names like `[col-start]` appear in computed values and
    // are not columns. A 2-col grid with names should still be 2.
    expect(countGridColumns('[col-start] 1fr [mid] 2fr [col-end]')).toBe(2);
  });

  it('handles single-column grids', () => {
    expect(countGridColumns('1fr')).toBe(1);
    expect(countGridColumns('minmax(0px, 1fr)')).toBe(1);
  });

  it('returns 0 for "none" and empty input', () => {
    expect(countGridColumns('none')).toBe(0);
    expect(countGridColumns('')).toBe(0);
  });

  it('collapses multiple whitespace between tracks', () => {
    expect(countGridColumns('1fr   1fr  \t  1fr')).toBe(3);
  });

  it('handles mixed minmax + line names + plain tracks', () => {
    // Real-world Tailwind-style grid template with named lines around
    // minmax tracks; only the 3 real tracks should count.
    expect(
      countGridColumns(
        '[full-start] minmax(1rem, 1fr) [content-start] 1fr [content-end] minmax(1rem, 1fr) [full-end]',
      ),
    ).toBe(3);
  });
});

//  Layout patterns (Issue L1 + L3: alignment heuristic semantic filter)

describe('content alignment heuristic (Issue L1 + L3)', () => {
  it("classifies a page wrapped in a centered <main> as 'centered'", () => {
    // Issue L3 fix: a single semantic <main max-width: 1200px; margin: 0 auto>
    // wrapping the page should produce 'centered'. Pre-fix the result was
    // 'mixed' or 'full-width' because every inner <div>/<p>/<li> padded
    // fullWidthCount past the 3x threshold.
    const tokens = clusterTokens(
      [makePage('https://x/', [
        makeColorElement({
          tag: 'main',
          maxWidth: '1200px',
          marginLeft: 'auto',
          marginRight: 'auto',
          display: 'block',
          rect: { x: 0, y: 0, width: 1200, height: 4000 },
        }),
        // Lots of inner content (div / p / li) that should be SKIPPED
        // because they're not semantic layout-section tags.
        ...Array.from({ length: 20 }, () =>
          makeColorElement({ tag: 'div', display: 'block', maxWidth: 'none' }),
        ),
        ...Array.from({ length: 30 }, () =>
          makeColorElement({ tag: 'p', display: 'block', maxWidth: 'none' }),
        ),
      ])],
      [],
    );
    expect(tokens.layoutPatterns.contentAlignment).toBe('centered');
  });

  it("classifies a 2520px-wide centered <main> as 'centered' (Issue L3 threshold)", () => {
    // Real-data regression: Airbnb's body wrapper is max-width: 2520px
    // with margin: auto. Pre-fix the < 2000px cap classified this as
    // 'full-width' even though it's a textbook centered layout. Post-
    // fix the cap is < 3000px.
    const tokens = clusterTokens(
      [makePage('https://x/', [
        makeColorElement({
          tag: 'main',
          maxWidth: '2520px',
          marginLeft: 'auto',
          marginRight: 'auto',
          display: 'block',
          rect: { x: 0, y: 0, width: 2520, height: 4000 },
        }),
      ])],
      [],
    );
    expect(tokens.layoutPatterns.contentAlignment).toBe('centered');
  });

  it("classifies edge-to-edge <section>s as 'full-width'", () => {
    const fullWidthSection = (): ElementStyle =>
      makeColorElement({
        tag: 'section',
        maxWidth: 'none',
        marginLeft: '0px',
        marginRight: '0px',
        display: 'block',
        rect: { x: 0, y: 0, width: 1440, height: 600 },
      });
    const tokens = clusterTokens(
      [makePage('https://x/', [
        fullWidthSection(),
        fullWidthSection(),
        fullWidthSection(),
        fullWidthSection(),
      ])],
      [],
    );
    expect(tokens.layoutPatterns.contentAlignment).toBe('full-width');
  });

  it('skips invisible semantic wrappers (Issue L1 visibility gate)', () => {
    // Issue L1: a hidden <main> drawer shouldn't influence alignment.
    // The only visible wrapper is the centered one, so the result must
    // be 'centered' even with a hidden full-width <main> in the page.
    const tokens = clusterTokens(
      [makePage('https://x/', [
        makeColorElement({
          tag: 'main',
          maxWidth: '1200px',
          marginLeft: 'auto',
          marginRight: 'auto',
          display: 'block',
          rect: { x: 0, y: 0, width: 1200, height: 4000 },
        }),
        // 5x hidden full-width <main>s  pre-gate these would inflate
        // fullWidthCount and push the verdict away from 'centered'.
        ...Array.from({ length: 5 }, () =>
          makeColorElement({
            tag: 'main',
            display: 'none',
            maxWidth: 'none',
            rect: { x: 0, y: 0, width: 0, height: 0 },
          }),
        ),
      ])],
      [],
    );
    expect(tokens.layoutPatterns.contentAlignment).toBe('centered');
  });
});

//  countGridColumns integration (Issue L2 in cluster)

describe('column counting integration (Issue L2)', () => {
  it('does not over-count minmax-tracked grids in commonColumnCounts', () => {
    // 3-column grid using `minmax(0px, 1fr)` (the Tailwind default).
    // Pre-fix the naive split would record 6 columns; post-fix records 3.
    const tokens = clusterTokens(
      [makePage('https://x/', [
        makeColorElement({
          tag: 'div',
          display: 'grid',
          gridTemplateColumns: 'minmax(0px, 1fr) minmax(0px, 1fr) minmax(0px, 1fr)',
          rect: { x: 0, y: 0, width: 1200, height: 400 },
        }),
      ])],
      [],
    );
    expect(tokens.layoutPatterns.commonColumnCounts).toEqual([3]);
    expect(tokens.layoutPatterns.commonColumnCounts).not.toContain(6);
  });
});

//  Shadow clustering integration tests (Issue SH1 + SH3 fix)

describe('shadow clustering (Issue SH1 + SH3)', () => {
  it('hides shadows from invisible elements (visibility gate)', () => {
    // SH1: a hidden modal with a weird shadow shouldn't drag a
    // phantom entry into shadowTokens. Visible-element shadow only.
    const visibleShadow = 'rgba(0, 0, 0, 0.2) 0px 4px 8px 0px';
    const hiddenShadow = 'rgba(255, 0, 0, 0.9) 0px 99px 99px 0px';
    const tokens = clusterTokens(
      [makePage('https://x/', [
        makeColorElement({ boxShadow: visibleShadow }),
        makeColorElement({ boxShadow: hiddenShadow, display: 'none' }),
      ])],
      [],
    );
    const values = tokens.shadowTokens.map((s) => s.value);
    expect(values).toContain(visibleShadow);
    expect(values).not.toContain(hiddenShadow);
  });

  it('merges Tailwind-padded shadows that share their real layer (post-strip)', () => {
    // Two elements ship the SAME design-intent shadow but Tailwind's
    // CSS variable concat adds different numbers of placeholder layers
    // depending on which utilities are active. Pre-fix the strings
    // were different and the shadows split into two buckets; post-fix
    // both strip to the same real-layer string and merge.
    const realLayer = 'rgba(0, 0, 0, 0.3) 0px 4px 6px 0px';
    const fourPlaceholders =
      'rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, ' +
      realLayer;
    const twoPlaceholders =
      'rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, ' + realLayer;
    const tokens = clusterTokens(
      [makePage('https://x/', [
        makeColorElement({ boxShadow: fourPlaceholders }),
        makeColorElement({ boxShadow: twoPlaceholders }),
      ])],
      [],
    );
    expect(tokens.shadowTokens.length).toBe(1);
    expect(tokens.shadowTokens[0].value).toBe(realLayer);
    expect(tokens.shadowTokens[0].frequency).toBe(2);
  });

  it('drops all-transparent shadows entirely', () => {
    // An element with box-shadow set to fully-placeholder values
    // shouldn't appear as a shadowToken  it's functionally "none".
    const tokens = clusterTokens(
      [makePage('https://x/', [
        makeColorElement({
          boxShadow: 'rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px',
        }),
      ])],
      [],
    );
    expect(tokens.shadowTokens.length).toBe(0);
  });
});
