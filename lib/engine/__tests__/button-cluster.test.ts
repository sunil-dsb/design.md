import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { applyButtonClustering, clusterButtons, type PageButtonInput } from '../button-cluster';
import type {
  ColorToken,
  ElementStyle,
  InteractionCapture,
  InteractionData,
  ComponentGroup,
} from '../types';

// ─── Fixtures ──────────────────────────────────────────────────────────────
//
// Test fixtures lean on unambiguous visual signals (clearly-purple buttons,
// clearly-white backgrounds) so behavioural assertions don't ride on
// borderline scoring decisions inside the clusterer.

function makeElement(overrides: Partial<ElementStyle> = {}): ElementStyle {
  return {
    tag: 'button',
    className: '',
    role: '',
    ariaLabel: '',
    textContent: 'Click me',
    href: '',
    type: '',
    rect: { x: 100, y: 200, width: 120, height: 40 },
    color: 'rgb(255, 255, 255)',
    backgroundColor: 'rgb(99, 91, 255)',
    borderTopColor: 'rgb(0, 0, 0)',
    borderRightColor: 'rgb(0, 0, 0)',
    borderBottomColor: 'rgb(0, 0, 0)',
    borderLeftColor: 'rgb(0, 0, 0)',
    outlineColor: 'rgb(0, 0, 0)',
    textDecorationColor: 'rgb(0, 0, 0)',
    fontFamily: 'Inter',
    fontSize: '14px',
    fontWeight: '600',
    lineHeight: '1.5',
    letterSpacing: 'normal',
    textTransform: '',
    fontFeatureSettings: '',
    paddingTop: '12px',
    paddingRight: '24px',
    paddingBottom: '12px',
    paddingLeft: '24px',
    marginTop: '0px',
    marginRight: '0px',
    marginBottom: '0px',
    marginLeft: '0px',
    gap: '0px',
    borderRadius: '8px',
    borderTopWidth: '0px',
    borderRightWidth: '0px',
    borderBottomWidth: '0px',
    borderLeftWidth: '0px',
    borderStyle: 'none',
    boxShadow: 'none',
    opacity: '1',
    zIndex: '0',
    display: 'inline-block',
    position: 'static',
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'stretch',
    gridTemplateColumns: 'none',
    maxWidth: 'none',
    overflow: 'visible',
    transition: 'all 0.2s ease',
    childrenCount: 1,
    hasImage: false,
    structuralRegion: 'main',
    ...overrides,
  };
}

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

function makePage(elements: ElementStyle[], captures: InteractionCapture[] = []): PageButtonInput {
  const interactions: InteractionData = { captures, loadingStates: [], emptyStates: [], errorStates: [] };
  return {
    url: 'https://example.com/',
    elements,
    interactions,
  };
}

// ─── Identification ────────────────────────────────────────────────────────

describe('clusterButtons — identification (Phase 1)', () => {
  it('identifies <button> elements regardless of styling', () => {
    const variants = clusterButtons([makePage([makeElement({ tag: 'button' })])], []);
    expect(variants).toHaveLength(1);
    expect(variants[0].count).toBe(1);
  });

  it('identifies elements with role="button"', () => {
    const variants = clusterButtons(
      [makePage([makeElement({ tag: 'div', role: 'button' })])],
      [],
    );
    expect(variants).toHaveLength(1);
  });

  it('identifies styled anchors (bg + radius + padding) even without an interaction capture', () => {
    const anchor = makeElement({
      tag: 'a',
      backgroundColor: 'rgb(99, 91, 255)',
      borderRadius: '8px',
      paddingTop: '8px',
      paddingBottom: '8px',
      paddingLeft: '16px',
      paddingRight: '16px',
    });
    const variants = clusterButtons([makePage([anchor])], []);
    expect(variants).toHaveLength(1);
  });

  it('identifies anchors with a captured hover state even without bg/radius', () => {
    const anchor = makeElement({
      tag: 'a',
      className: 'cta',
      backgroundColor: 'rgba(0,0,0,0)',
      borderRadius: '0px',
      paddingTop: '8px',
      paddingBottom: '8px',
      paddingLeft: '16px',
      paddingRight: '16px',
    });
    const capture: InteractionCapture = {
      element: { tag: 'a', classes: 'cta', textContent: 'Sign up', role: '' },
      componentType: 'a',
      defaultStyle: {},
      hoverDiff: { backgroundColor: 'rgb(99, 91, 255)' },
      focusVisibleDiff: null,
      focusDiff: null,
      activeDiff: null,
      disabledStyle: null,
      transition: null,
    };
    const variants = clusterButtons([makePage([anchor], [capture])], []);
    expect(variants).toHaveLength(1);
  });

  it('does NOT identify a footer link with padding but no interaction signal', () => {
    const link = makeElement({
      tag: 'a',
      backgroundColor: 'rgba(0,0,0,0)',
      borderRadius: '0px',
      paddingTop: '8px',
      paddingBottom: '8px',
      paddingLeft: '8px',
      paddingRight: '8px',
      structuralRegion: 'footer',
    });
    const variants = clusterButtons([makePage([link])], []);
    expect(variants).toHaveLength(0);
  });

  it('identifies <div> with interaction signal + padding ≥ 16', () => {
    const div = makeElement({
      tag: 'div',
      className: 'btn-wrapper',
      paddingTop: '8px',
      paddingBottom: '8px',
      paddingLeft: '16px',
      paddingRight: '16px',
    });
    const capture: InteractionCapture = {
      element: { tag: 'div', classes: 'btn-wrapper', textContent: 'Click', role: '' },
      componentType: 'div',
      defaultStyle: {},
      hoverDiff: { backgroundColor: 'rgb(50, 50, 50)' },
      focusVisibleDiff: null,
      focusDiff: null,
      activeDiff: null,
      disabledStyle: null,
      transition: null,
    };
    const variants = clusterButtons([makePage([div], [capture])], []);
    expect(variants).toHaveLength(1);
  });
});

// ─── Clustering (Phase 2) ──────────────────────────────────────────────────

describe('clusterButtons — visual-signature clustering (Phase 2)', () => {
  it('groups buttons with the same bg + text colors together', () => {
    const a = makeElement({ backgroundColor: 'rgb(99, 91, 255)' });
    const b = makeElement({ backgroundColor: 'rgb(99, 91, 255)' });
    const variants = clusterButtons([makePage([a, b])], []);
    expect(variants).toHaveLength(1);
    expect(variants[0].count).toBe(2);
  });

  it('splits buttons with different bg colors into separate variants', () => {
    const purple = makeElement({ backgroundColor: 'rgb(99, 91, 255)', textContent: 'Buy' });
    const orange = makeElement({ backgroundColor: 'rgb(255, 97, 24)', textContent: 'Sell' });
    const variants = clusterButtons([makePage([purple, orange])], []);
    expect(variants).toHaveLength(2);
  });

  it('separates filled and outline (border) variants even when bg colors are similar', () => {
    const filled = makeElement({
      backgroundColor: 'rgb(99, 91, 255)',
      borderTopWidth: '0px',
      borderStyle: 'none',
    });
    const outline = makeElement({
      backgroundColor: 'rgba(0, 0, 0, 0)',
      color: 'rgb(99, 91, 255)',
      borderTopWidth: '1px',
      borderTopColor: 'rgb(99, 91, 255)',
      borderRightWidth: '1px',
      borderBottomWidth: '1px',
      borderLeftWidth: '1px',
      borderStyle: 'solid',
    });
    const variants = clusterButtons([makePage([filled, outline])], []);
    expect(variants).toHaveLength(2);
  });

  it('separates buttons with vs without shadow', () => {
    const noShadow = makeElement({ boxShadow: 'none' });
    const shadowed = makeElement({ boxShadow: '0 2px 4px rgba(0,0,0,0.1)' });
    const variants = clusterButtons([makePage([noShadow, shadowed])], []);
    expect(variants).toHaveLength(2);
  });

  it('separates buttons whose radius differs by more than the tolerance', () => {
    const sharp = makeElement({ borderRadius: '0px' });
    const rounded = makeElement({ borderRadius: '24px' });
    const variants = clusterButtons([makePage([sharp, rounded])], []);
    expect(variants).toHaveLength(2);
  });

  it('keeps buttons within radius tolerance in the same cluster', () => {
    const a = makeElement({ borderRadius: '6px' });
    const b = makeElement({ borderRadius: '8px' });
    const variants = clusterButtons([makePage([a, b])], []);
    expect(variants).toHaveLength(1);
  });

  it('respects custom deltaE threshold', () => {
    // Two near-identical purples — ΔE ~1.5
    const a = makeElement({ backgroundColor: 'rgb(99, 91, 255)' });
    const b = makeElement({ backgroundColor: 'rgb(95, 87, 250)' });
    const strict = clusterButtons([makePage([a, b])], [], { deltaEThreshold: 1 });
    const lenient = clusterButtons([makePage([a, b])], [], { deltaEThreshold: 8 });
    expect(strict.length).toBeGreaterThanOrEqual(lenient.length);
  });
});

// ─── Variant naming (Phase 3) ──────────────────────────────────────────────

describe('clusterButtons — variant naming (Phase 3)', () => {
  it('names the bg-matches-primary cluster as Primary', () => {
    const primaryBtn = makeElement({ backgroundColor: 'rgb(99, 91, 255)' });
    const palette: ColorToken[] = [
      makeColorToken({ hex: '#635bff', usedAs: { textColor: 0, bgColor: 30, borderColor: 0, shadowColor: 0, gradientColor: 0, iconColor: 0 } }),
    ];
    const variants = clusterButtons([makePage([primaryBtn])], palette);
    expect(variants[0].name).toBe('Primary');
  });

  it('names a transparent + border button as Outline', () => {
    const outline = makeElement({
      backgroundColor: 'rgba(0, 0, 0, 0)',
      color: 'rgb(99, 91, 255)',
      borderTopWidth: '1px',
      borderTopColor: 'rgb(99, 91, 255)',
      borderStyle: 'solid',
    });
    const variants = clusterButtons([makePage([outline])], []);
    expect(variants[0].name).toBe('Outline');
  });

  it('names a transparent + no border button as Ghost', () => {
    const ghost = makeElement({
      backgroundColor: 'rgba(0, 0, 0, 0)',
      color: 'rgb(99, 91, 255)',
      borderStyle: 'none',
    });
    const variants = clusterButtons([makePage([ghost])], []);
    expect(variants[0].name).toBe('Ghost');
  });

  it('names a red-button matching the error role as Destructive', () => {
    // Purple wins primary (CSS-var boost). Cyan wins accent (high chroma,
    // hue 195° matches no semantic band). Red is then free to claim the
    // semantic 'error' slot — same pattern role-namer.test.ts uses.
    const destroy = makeElement({ backgroundColor: 'rgb(239, 68, 68)' });
    const palette: ColorToken[] = [
      makeColorToken({
        hex: '#635bff',
        cssVariableNames: ['--primary'],
        usedAs: { textColor: 0, bgColor: 50, borderColor: 0, shadowColor: 0, gradientColor: 0, iconColor: 0 },
      }),
      makeColorToken({
        hex: '#06b6d4',
        frequency: 100,
        usedAs: { textColor: 0, bgColor: 20, borderColor: 0, shadowColor: 0, gradientColor: 0, iconColor: 0 },
      }),
      makeColorToken({
        hex: '#ef4444',
        frequency: 20,
        usedAs: { textColor: 0, bgColor: 5, borderColor: 0, shadowColor: 0, gradientColor: 0, iconColor: 0 },
      }),
    ];
    const variants = clusterButtons([makePage([destroy])], palette);
    expect(variants.map((v) => v.name)).toContain('Destructive');
  });

  it('falls back to Secondary for the highest-visibility unnamed cluster', () => {
    const primary = makeElement({ backgroundColor: 'rgb(99, 91, 255)' });
    const secondary = makeElement({ backgroundColor: 'rgb(40, 40, 40)', textContent: 'Learn more' });
    const palette: ColorToken[] = [
      makeColorToken({
        hex: '#635bff',
        cssVariableNames: ['--primary'],
        usedAs: { textColor: 0, bgColor: 50, borderColor: 0, shadowColor: 0, gradientColor: 0, iconColor: 0 },
      }),
    ];
    const variants = clusterButtons([makePage([primary, secondary])], palette);
    expect(variants.map((v) => v.name)).toContain('Primary');
    expect(variants.map((v) => v.name)).toContain('Secondary');
  });

  it('uses Variant-N for additional unnamed clusters beyond Tertiary', () => {
    // 5 distinct unmatched variants with no palette mappings.
    const a = makeElement({ backgroundColor: 'rgb(40, 40, 40)' });
    const b = makeElement({ backgroundColor: 'rgb(20, 80, 100)' });
    const c = makeElement({ backgroundColor: 'rgb(120, 50, 80)' });
    const d = makeElement({ backgroundColor: 'rgb(180, 130, 50)' });
    const e = makeElement({ backgroundColor: 'rgb(60, 130, 70)' });
    const variants = clusterButtons([makePage([a, b, c, d, e])], []);
    const names = variants.map((v) => v.name);
    expect(names).toContain('Secondary');
    expect(names).toContain('Tertiary');
    expect(names.some((n) => n.startsWith('Variant-'))).toBe(true);
  });
});

// ─── Representative pick (Phase 4) ─────────────────────────────────────────

describe('clusterButtons — representative selection (Phase 4)', () => {
  it('picks the most-visible button as the canonical example, not the first', () => {
    // Tiny low-vis button at top, large hero button further down — both share
    // the same purple variant. Representative should be the hero.
    const tiny = makeElement({
      rect: { x: 0, y: 0, width: 30, height: 20 },
      paddingTop: '4px',
      paddingBottom: '4px',
      paddingLeft: '8px',
      paddingRight: '8px',
      fontSize: '12px',
      structuralRegion: 'footer',
      textContent: 'small',
    });
    const hero = makeElement({
      rect: { x: 100, y: 300, width: 240, height: 56 },
      paddingTop: '16px',
      paddingBottom: '16px',
      paddingLeft: '32px',
      paddingRight: '32px',
      fontSize: '18px',
      structuralRegion: 'main',
      textContent: 'Get started',
    });
    const variants = clusterButtons([makePage([tiny, hero])], []);
    // Both should cluster together — same bg/text/border/radius/shadow.
    // But size sub-clustering may split them; either way at least one
    // variant should report `Get started` as a sample text, not just `small`.
    const allSamples = variants.flatMap((v) => v.sampleTexts).join('|');
    expect(allSamples).toContain('Get started');
  });
});

// ─── Size tiers (Phase 5) ──────────────────────────────────────────────────

describe('clusterButtons — size tiers (Phase 5)', () => {
  it('emits one variant when sizes are uniform', () => {
    const a = makeElement({ fontSize: '14px', paddingTop: '8px', paddingBottom: '8px' });
    const b = makeElement({ fontSize: '14px', paddingTop: '8px', paddingBottom: '8px' });
    const variants = clusterButtons([makePage([a, b])], []);
    expect(variants).toHaveLength(1);
    expect(variants[0].name).not.toMatch(/\b(sm|md|lg)\b/);
  });

  it('splits into sm/md when 2 size groups are present', () => {
    // Build five small + five large so each tier has enough members to
    // survive the 80%-dominant guard.
    const small: ElementStyle[] = Array.from({ length: 5 }, () =>
      makeElement({ fontSize: '12px', paddingTop: '6px', paddingBottom: '6px' }),
    );
    const large: ElementStyle[] = Array.from({ length: 5 }, () =>
      makeElement({ fontSize: '18px', paddingTop: '16px', paddingBottom: '16px' }),
    );
    const variants = clusterButtons([makePage([...small, ...large])], []);
    expect(variants.length).toBeGreaterThanOrEqual(2);
    expect(variants.some((v) => v.name.endsWith(' sm'))).toBe(true);
    expect(variants.some((v) => v.name.endsWith(' md'))).toBe(true);
  });

  it('does not subdivide when one size dominates 80%+', () => {
    // 9 small + 1 large — should NOT split.
    const small: ElementStyle[] = Array.from({ length: 9 }, () =>
      makeElement({ fontSize: '14px', paddingTop: '8px', paddingBottom: '8px' }),
    );
    const large: ElementStyle[] = [
      makeElement({ fontSize: '20px', paddingTop: '16px', paddingBottom: '16px' }),
    ];
    const variants = clusterButtons([makePage([...small, ...large])], []);
    expect(variants).toHaveLength(1);
  });
});

// ─── State merge (Phase 6) ─────────────────────────────────────────────────

describe('clusterButtons — state merge (Phase 6)', () => {
  it('attaches hover/focus/active diffs from interaction-capture to the variant', () => {
    const btn = makeElement({ className: 'cta-primary' });
    const capture: InteractionCapture = {
      element: { tag: 'button', classes: 'cta-primary', textContent: 'Click me', role: '' },
      componentType: 'button',
      defaultStyle: {},
      hoverDiff: { backgroundColor: 'rgb(50, 45, 230)' },
      focusVisibleDiff: { outline: '2px solid rgb(99, 91, 255)' },
      focusDiff: null,
      activeDiff: { transform: 'scale(0.98)' },
      disabledStyle: { opacity: '0.5' },
      transition: 'all 0.2s ease',
    };
    const variants = clusterButtons([makePage([btn], [capture])], []);
    expect(variants[0].hoverChanges).toEqual({ backgroundColor: 'rgb(50, 45, 230)' });
    expect(variants[0].focusVisibleChanges).toEqual({ outline: '2px solid rgb(99, 91, 255)' });
    expect(variants[0].activeChanges).toEqual({ transform: 'scale(0.98)' });
    expect(variants[0].disabledStyle).toEqual({ opacity: '0.5' });
    expect(variants[0].transition).toBe('all 0.2s ease');
  });

  it('picks the most-common hover diff when cluster members disagree', () => {
    const a = makeElement({ className: 'btn a' });
    const b = makeElement({ className: 'btn b' });
    const c = makeElement({ className: 'btn c' });
    const captures: InteractionCapture[] = [
      {
        element: { tag: 'button', classes: 'btn a', textContent: '', role: '' },
        componentType: 'button',
        defaultStyle: {},
        hoverDiff: { backgroundColor: 'rgb(0, 0, 0)' },
        focusVisibleDiff: null, focusDiff: null, activeDiff: null, disabledStyle: null, transition: null,
      },
      {
        element: { tag: 'button', classes: 'btn b', textContent: '', role: '' },
        componentType: 'button',
        defaultStyle: {},
        hoverDiff: { backgroundColor: 'rgb(50, 45, 230)' },
        focusVisibleDiff: null, focusDiff: null, activeDiff: null, disabledStyle: null, transition: null,
      },
      {
        element: { tag: 'button', classes: 'btn c', textContent: '', role: '' },
        componentType: 'button',
        defaultStyle: {},
        hoverDiff: { backgroundColor: 'rgb(50, 45, 230)' },
        focusVisibleDiff: null, focusDiff: null, activeDiff: null, disabledStyle: null, transition: null,
      },
    ];
    const variants = clusterButtons([makePage([a, b, c], captures)], []);
    expect(variants[0].hoverChanges).toEqual({ backgroundColor: 'rgb(50, 45, 230)' });
  });

  it('falls back to the element transition when no interaction captures match', () => {
    const btn = makeElement({ transition: 'all 0.3s ease-in-out' });
    const variants = clusterButtons([makePage([btn])], []);
    expect(variants[0].transition).toBe('all 0.3s ease-in-out');
  });
});

// ─── Empty / edge cases ────────────────────────────────────────────────────

describe('clusterButtons — edge cases', () => {
  it('returns an empty array when no pages are provided', () => {
    expect(clusterButtons([], [])).toEqual([]);
  });

  it('returns an empty array when no buttons are found', () => {
    const para = makeElement({ tag: 'p', textContent: 'just text' });
    expect(clusterButtons([makePage([para])], [])).toEqual([]);
  });

  it('aggregates buttons across multiple pages', () => {
    const home = makeElement({ backgroundColor: 'rgb(99, 91, 255)' });
    const pricing = makeElement({ backgroundColor: 'rgb(99, 91, 255)' });
    const variants = clusterButtons(
      [
        { url: 'https://example.com/', elements: [home] },
        { url: 'https://example.com/pricing', elements: [pricing] },
      ],
      [],
    );
    expect(variants).toHaveLength(1);
    expect(variants[0].count).toBe(2);
  });
});

// ─── applyButtonClustering — disk I/O ──────────────────────────────────────

describe('applyButtonClustering — disk write', () => {
  let tmpRoot: string;
  let tokensPath: string;

  beforeEach(() => {
    tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'button-cluster-test-'));
    tokensPath = path.join(tmpRoot, 'tokens.json');
  });

  afterEach(() => {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  });

  it('returns no-op when tokens.json is missing', () => {
    const result = applyButtonClustering(path.join(tmpRoot, 'missing.json'), [makePage([])]);
    expect(result.mutated).toBe(false);
    expect(result.candidateCount).toBe(0);
  });

  it('returns no-op when pages array is empty', () => {
    fs.writeFileSync(tokensPath, JSON.stringify({ colorTokens: [], components: [] }));
    const result = applyButtonClustering(tokensPath, []);
    expect(result.mutated).toBe(false);
  });

  it('replaces existing components[type === Button] with the new variants', () => {
    fs.writeFileSync(tokensPath, JSON.stringify({
      colorTokens: [makeColorToken({ hex: '#635bff' })],
      components: [
        { type: 'Button', variants: [{ name: 'Old', count: 1, style: {}, hoverChanges: null, focusVisibleChanges: null, focusChanges: null, activeChanges: null, disabledStyle: null, transition: null, sampleTexts: ['stale'] }] },
        { type: 'Card', variants: [] },
      ] as ComponentGroup[],
    }));

    const btn = makeElement({ backgroundColor: 'rgb(99, 91, 255)', textContent: 'New' });
    const result = applyButtonClustering(tokensPath, [makePage([btn])]);

    expect(result.mutated).toBe(true);
    const after = JSON.parse(fs.readFileSync(tokensPath, 'utf-8'));
    const buttonGroup = after.components.find((c: ComponentGroup) => c.type === 'Button');
    expect(buttonGroup.variants[0].name).not.toBe('Old');
    expect(buttonGroup.variants[0].sampleTexts).toContain('New');
    // Card group untouched.
    expect(after.components.find((c: ComponentGroup) => c.type === 'Card')).toBeDefined();
  });

  it('inserts a Button component group when none exists', () => {
    fs.writeFileSync(tokensPath, JSON.stringify({ colorTokens: [], components: [] }));
    const btn = makeElement({ backgroundColor: 'rgb(99, 91, 255)' });
    applyButtonClustering(tokensPath, [makePage([btn])]);
    const after = JSON.parse(fs.readFileSync(tokensPath, 'utf-8'));
    expect(after.components.some((c: ComponentGroup) => c.type === 'Button')).toBe(true);
  });

  it('does not mutate tokens.json when no buttons are identified', () => {
    fs.writeFileSync(tokensPath, JSON.stringify({ colorTokens: [], components: [{ type: 'Card', variants: [] }] }));
    const para = makeElement({ tag: 'p', textContent: 'just text' });
    const before = fs.readFileSync(tokensPath, 'utf-8');
    applyButtonClustering(tokensPath, [makePage([para])]);
    const after = fs.readFileSync(tokensPath, 'utf-8');
    expect(after).toBe(before);
  });

  it('returns no-op when tokens.json is malformed', () => {
    fs.writeFileSync(tokensPath, '{ not valid json');
    const btn = makeElement({ backgroundColor: 'rgb(99, 91, 255)' });
    const result = applyButtonClustering(tokensPath, [makePage([btn])]);
    expect(result.mutated).toBe(false);
  });
});
