import { describe, it, expect } from 'vitest';
import { extractA11y } from '../a11y-extract';
import type { DOMCollection, ElementStyle } from '../types';

//  Test fixtures

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
    rect: { x: 0, y: 0, width: 100, height: 40 },
    color: 'rgb(0, 0, 0)',
    backgroundColor: 'rgb(255, 255, 255)',
    borderTopColor: '',
    borderRightColor: '',
    borderBottomColor: '',
    borderLeftColor: '',
    outlineColor: '',
    textDecorationColor: '',
    fontFamily: '',
    fontSize: '16px',
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

function makeCollection(elements: ElementStyle[]): DOMCollection {
  return {
    cssVariables: [],
    elements,
    pseudoElements: [],
    gradients: [],
    svgColors: [],
    svgSizes: [],
    fontInfo: { fontFaces: [], loadedFonts: [], googleFontsLinks: [] },
    logoColors: null,
  };
}

//  Contrast pairs (Issue A1 + A2)

describe('contrast pair extraction (Issue A1 + A2)', () => {
  it('skips invisible elements (Issue A1 visibility gate)', () => {
    const result = extractA11y(
      [makeCollection([
        // Visible text  contributes.
        makeElement({
          tag: 'p',
          textContent: 'visible',
          color: 'rgb(0, 0, 0)',
          backgroundColor: 'rgb(255, 255, 255)',
        }),
        // Hidden modal with terrible contrast  must NOT contribute.
        makeElement({
          tag: 'p',
          textContent: 'hidden',
          color: 'rgb(255, 255, 0)',
          backgroundColor: 'rgb(255, 255, 255)',
          display: 'none',
        }),
        // Zero-rect element  must NOT contribute.
        makeElement({
          tag: 'p',
          textContent: 'collapsed',
          color: 'rgb(128, 128, 128)',
          backgroundColor: 'rgb(255, 255, 255)',
          rect: { x: 0, y: 0, width: 0, height: 0 },
        }),
      ])],
      [],
    );
    expect(result.contrastPairs).toHaveLength(1);
    expect(result.contrastPairs[0].foreground).toBe('rgb(0, 0, 0)');
  });

  it('skips elements with no rendered text (Issue A2)', () => {
    // Empty wrappers with color/bg declared previously inflated the
    // count. Post-fix, only text-bearing elements contribute.
    const result = extractA11y(
      [makeCollection([
        makeElement({ tag: 'div', textContent: '', color: 'rgb(0, 0, 0)', backgroundColor: 'rgb(255, 255, 255)' }),
        makeElement({ tag: 'div', textContent: '   ', color: 'rgb(0, 0, 0)', backgroundColor: 'rgb(255, 255, 255)' }),
        makeElement({ tag: 'p', textContent: 'real text', color: 'rgb(0, 0, 0)', backgroundColor: 'rgb(255, 255, 255)' }),
      ])],
      [],
    );
    expect(result.contrastPairs).toHaveLength(1);
    expect(result.contrastPairs[0].usageCount).toBe(1);
  });

  it('flags pairs that fail WCAG AA', () => {
    const result = extractA11y(
      [makeCollection([
        makeElement({
          tag: 'p',
          textContent: 'low contrast',
          color: 'rgb(200, 200, 200)',
          backgroundColor: 'rgb(255, 255, 255)',
        }),
      ])],
      [],
    );
    expect(result.contrastPairs[0].meetsAA).toBe(false);
  });

  it('skips rgba(*,*,*,0) backgrounds as transparent (real-data follow-up)', () => {
    // getComputedStyle returns `rgba(0, 0, 0, 0)` for transparent
    // backgrounds, never the literal "transparent" string. Pre-fix
    // the string-equality check missed this and the report listed
    // every text colour paired with `rgba(0, 0, 0, 0)`  ratios were
    // meaningless math against transparent. Post-fix these pairs
    // are excluded.
    const result = extractA11y(
      [makeCollection([
        makeElement({
          tag: 'p',
          textContent: 'on transparent (the common case)',
          color: 'rgb(34, 34, 34)',
          backgroundColor: 'rgba(0, 0, 0, 0)',
        }),
        makeElement({
          tag: 'p',
          textContent: 'on white (the real pair)',
          color: 'rgb(34, 34, 34)',
          backgroundColor: 'rgb(255, 255, 255)',
        }),
      ])],
      [],
    );
    expect(result.contrastPairs).toHaveLength(1);
    expect(result.contrastPairs[0].background).toBe('rgb(255, 255, 255)');
  });

  it('skips literal "transparent" foreground as well as rgba(*,*,*,0)', () => {
    const result = extractA11y(
      [makeCollection([
        makeElement({
          tag: 'p',
          textContent: 'invisible text',
          color: 'transparent',
          backgroundColor: 'rgb(255, 255, 255)',
        }),
        makeElement({
          tag: 'p',
          textContent: 'still invisible',
          color: 'rgba(255, 0, 0, 0)',
          backgroundColor: 'rgb(255, 255, 255)',
        }),
      ])],
      [],
    );
    expect(result.contrastPairs).toHaveLength(0);
  });
});

//  minTouchTarget (Issue A4 + A5)

describe('minTouchTarget (Issue A4 + A5)', () => {
  it('tracks min width and min height INDEPENDENTLY (Issue A4)', () => {
    // Pre-fix, the loop tracked the smallest-AREA element. A 200x20
    // skinny link (area 4000) would lose to a 50x50 square button
    // (area 2500), so the reported {width: 50, height: 50} would hide
    // the real 20px-height accessibility failure.
    // Post-fix, the worst dimension of each axis is surfaced.
    const result = extractA11y(
      [makeCollection([
        // Skinny link: 200 wide x 20 tall  worst height = 20.
        makeElement({
          tag: 'a',
          href: '#',
          textContent: 'skinny',
          rect: { x: 0, y: 0, width: 200, height: 20 },
        }),
        // Compact button: 50 wide x 50 tall  worst width = 50.
        makeElement({
          tag: 'button',
          textContent: 'square',
          rect: { x: 0, y: 0, width: 50, height: 50 },
        }),
        // A wider button so the metric isn't trivially 50 for both.
        makeElement({
          tag: 'button',
          textContent: 'wide',
          rect: { x: 0, y: 0, width: 200, height: 50 },
        }),
      ])],
      [],
    );
    expect(result.minTouchTarget).toEqual({ width: 50, height: 20 });
  });

  it('skips screen-reader-only 1x1 elements (real-data SR-only follow-up)', () => {
    // Airbnb (and most production sites) use the SR-only pattern:
    //   width: 1px; height: 1px; clip: rect(0,0,0,0); overflow: hidden
    // Pre-fix the rect was non-zero so isElementVisible let it through,
    // and minTouchTarget collapsed to {1, 1}. Post-fix the 1x1
    // signature is filtered in isElementVisible.
    const result = extractA11y(
      [makeCollection([
        makeElement({
          tag: 'a',
          href: '#main',
          textContent: 'Skip to content',
          rect: { x: 0, y: 0, width: 1, height: 1 },
          overflow: 'hidden',
        }),
        makeElement({
          tag: 'button',
          textContent: 'real button',
          rect: { x: 0, y: 0, width: 48, height: 48 },
        }),
      ])],
      [],
    );
    expect(result.minTouchTarget).toEqual({ width: 48, height: 48 });
  });

  it('skips invisible interactive elements (Issue A5)', () => {
    const result = extractA11y(
      [makeCollection([
        // Visible 44x44 button  meets WCAG floor.
        makeElement({
          tag: 'button',
          textContent: 'ok',
          rect: { x: 0, y: 0, width: 44, height: 44 },
        }),
        // Hidden 8x8 button (modal dismiss icon, drawer trigger, etc.)
        // pre-fix this would pull minTouchTarget down to {8, 8}.
        makeElement({
          tag: 'button',
          textContent: 'hidden',
          rect: { x: 0, y: 0, width: 8, height: 8 },
          display: 'none',
        }),
      ])],
      [],
    );
    expect(result.minTouchTarget).toEqual({ width: 44, height: 44 });
  });

  it('returns {0, 0} when no interactive elements are visible', () => {
    const result = extractA11y(
      [makeCollection([
        makeElement({ tag: 'div', textContent: 'not interactive' }),
      ])],
      [],
    );
    expect(result.minTouchTarget).toEqual({ width: 0, height: 0 });
  });
});

//  minFontSize (Issue A6)

describe('minFontSize (Issue A6)', () => {
  it('skips invisible elements (Issue A6 visibility gate)', () => {
    const result = extractA11y(
      [makeCollection([
        makeElement({ tag: 'p', textContent: 'normal', fontSize: '16px' }),
        // Hidden tooltip with tiny font  pre-fix would pull min down to 8px.
        makeElement({
          tag: 'span',
          textContent: 'hidden tooltip',
          fontSize: '8px',
          display: 'none',
        }),
      ])],
      [],
    );
    expect(result.minFontSize).toBe('16px');
  });

  it('picks the smallest visible text size', () => {
    const result = extractA11y(
      [makeCollection([
        makeElement({ tag: 'p', textContent: 'body', fontSize: '16px' }),
        makeElement({ tag: 'small', textContent: 'fine print', fontSize: '12px' }),
        makeElement({ tag: 'h1', textContent: 'heading', fontSize: '48px' }),
      ])],
      [],
    );
    expect(result.minFontSize).toBe('12px');
  });
});
