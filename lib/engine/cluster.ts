// @ts-expect-error culori has no bundled declarations in this setup
import * as culori from 'culori';
import type {
  CSSVariable,
  ColorToken,
  ComponentGroup,
  ComponentNode,
  ComponentVariant,
  DesignTokens,
  DOMCollection,
  ElementStyle,
  CSSAnalysis,
  InteractionData,
  InteractionCapture,
  MediaBreakpoint,
  RadiusToken,
  ShadowToken,
  StabilityClassification,
  TypographyLevel,
} from './types';
import type { ComponentScreenshots } from './component-screenshots';

//  Input Interface

interface PageExtraction {
  url: string;
  dom: DOMCollection;
  css?: CSSAnalysis;
  interactions?: InteractionData;
  // Per-element screenshots captured by extract.ts while the source page
  // was still open. Keyed by ElementStyle.nodeId; cluster.ts looks up a
  // variant's representative element here when emitting Card / PricingTier
  // ComponentVariant records.
  componentScreenshots?: ComponentScreenshots;
}

//  Tree Builder for Composed Components

const MAX_TREE_DEPTH = 8;

// Tags we never want to recurse into (or render). Script/style would leak
// executable content into the snippet; metadata + media-internals don't
// render meaningfully out of their original context.
const TREE_SKIP_TAGS = new Set([
  'script',
  'style',
  'link',
  'meta',
  'noscript',
  'template',
  'head',
  'title',
  'iframe',
  'object',
  'embed',
]);

// Style fields copied onto each node in the tree. Mirrors the renderer's
// SAFE_STYLE_PROPS list — these are the visual fields a code-snippet
// consumer needs to recreate the component. Layout fields (position,
// width, height, transform, z-index) are intentionally excluded because
// they don't survive replantation and would mislead the consumer.
const TREE_STYLE_FIELDS = [
  'backgroundColor',
  'color',
  'borderRadius',
  'borderTopWidth',
  'borderRightWidth',
  'borderBottomWidth',
  'borderLeftWidth',
  'borderStyle',
  'borderTopColor',
  'borderRightColor',
  'borderBottomColor',
  'borderLeftColor',
  'paddingTop',
  'paddingRight',
  'paddingBottom',
  'paddingLeft',
  'marginTop',
  'marginRight',
  'marginBottom',
  'marginLeft',
  'gap',
  'fontFamily',
  'fontSize',
  'fontWeight',
  'lineHeight',
  'letterSpacing',
  'textTransform',
  'boxShadow',
  'opacity',
  'display',
  'flexDirection',
  'justifyContent',
  'alignItems',
  'gridTemplateColumns',
] as const;

function styleSnapshot(el: ElementStyle): Record<string, string> {
  const out: Record<string, string> = {};
  for (const key of TREE_STYLE_FIELDS) {
    const v = el[key];
    if (typeof v === 'string' && v && v !== 'none' && v !== 'normal' && v !== 'auto') {
      out[key] = v;
    }
  }
  return out;
}

function attrSnapshot(el: ElementStyle): Record<string, string> {
  const attrs: Record<string, string> = {};
  // ElementStyle carries a small allowlist of attribute-like fields the
  // captured tree needs to faithfully render later. href for <a>, type for
  // <input>/<button>, aria-label for accessibility, src + alt for <img>.
  // src + alt were added so the LiveTree renderer in the SPA can show real
  // images (icons, illustrations) instead of broken placeholders. Cross-
  // origin image loads may still fail at render time — that's a fidelity
  // limit of the captured-tree approach, not something we can fix here.
  if (el.tag === 'a' && el.href) attrs.href = el.href;
  if ((el.tag === 'input' || el.tag === 'button') && el.type) attrs.type = el.type;
  if (el.ariaLabel) attrs['aria-label'] = el.ariaLabel;
  if (el.tag === 'img') {
    if (el.src) attrs.src = el.src;
    if (el.alt) attrs.alt = el.alt;
  }
  return attrs;
}

/**
 * Build a depth-capped tree rooted at `root` using a pre-computed children
 * map. Drops descendants whose tag is in TREE_SKIP_TAGS so the snippet
 * never contains executable content. Returns the tree shape declared in
 * `ComponentNode`.
 */
function buildComponentTree(
  root: ElementStyle,
  childrenByParentId: Map<number, ElementStyle[]>,
  depth: number = 0,
): ComponentNode {
  const node: ComponentNode = {
    tag: root.tag || 'div',
    // Use directText at every depth: parents typically don't have direct
    // text (their text lives in children), so this naturally renders the
    // right thing for headings/paragraphs vs containers.
    text: root.directText ?? '',
    attrs: attrSnapshot(root),
    style: styleSnapshot(root),
    children: [],
  };

  if (depth >= MAX_TREE_DEPTH) return node;
  if (typeof root.nodeId !== 'number') return node;

  const childEls = childrenByParentId.get(root.nodeId) ?? [];
  for (const child of childEls) {
    if (TREE_SKIP_TAGS.has(child.tag)) continue;
    node.children.push(buildComponentTree(child, childrenByParentId, depth + 1));
  }
  return node;
}

//  Named Color Map 

const NAMED_COLORS: Record<string, [number, number, number, number]> = {
  white:       [255, 255, 255, 1],
  black:       [0,   0,   0,   1],
  red:         [255, 0,   0,   1],
  blue:        [0,   0,   255, 1],
  green:       [0,   128, 0,   1],
  yellow:      [255, 255, 0,   1],
  orange:      [255, 165, 0,   1],
  purple:      [128, 0,   128, 1],
  gray:        [128, 128, 128, 1],
  grey:        [128, 128, 128, 1],
  transparent: [0,   0,   0,   0],
};

//  Color Parsing Helpers 

interface RGBA {
  r: number;
  g: number;
  b: number;
  a: number;
}

export function parseColor(value: string): RGBA | null {
  if (!value || value === 'none' || value === 'currentcolor' || value === 'currentColor' || value === 'inherit') {
    return null;
  }

  const trimmed = value.trim().toLowerCase();

  if (trimmed === 'transparent') {
    return { r: 0, g: 0, b: 0, a: 0 };
  }

  if (NAMED_COLORS[trimmed]) {
    const [r, g, b, a] = NAMED_COLORS[trimmed];
    return { r, g, b, a };
  }

  // #hex: 3, 4, 6, or 8 digits
  const hexMatch = trimmed.match(/^#([0-9a-f]{3,8})$/);
  if (hexMatch) {
    const hex = hexMatch[1];
    if (hex.length === 3) {
      return {
        r: parseInt(hex[0] + hex[0], 16),
        g: parseInt(hex[1] + hex[1], 16),
        b: parseInt(hex[2] + hex[2], 16),
        a: 1,
      };
    }
    if (hex.length === 4) {
      return {
        r: parseInt(hex[0] + hex[0], 16),
        g: parseInt(hex[1] + hex[1], 16),
        b: parseInt(hex[2] + hex[2], 16),
        a: parseInt(hex[3] + hex[3], 16) / 255,
      };
    }
    if (hex.length === 6) {
      return {
        r: parseInt(hex.slice(0, 2), 16),
        g: parseInt(hex.slice(2, 4), 16),
        b: parseInt(hex.slice(4, 6), 16),
        a: 1,
      };
    }
    if (hex.length === 8) {
      return {
        r: parseInt(hex.slice(0, 2), 16),
        g: parseInt(hex.slice(2, 4), 16),
        b: parseInt(hex.slice(4, 6), 16),
        a: parseInt(hex.slice(6, 8), 16) / 255,
      };
    }
  }

  // rgb()/rgba()
  const rgbMatch = trimmed.match(
    /^rgba?\(\s*(\d+(?:\.\d+)?)\s*[,\s]\s*(\d+(?:\.\d+)?)\s*[,\s]\s*(\d+(?:\.\d+)?)\s*(?:[,/]\s*(\d+(?:\.\d+)?%?))?\s*\)$/,
  );
  if (rgbMatch) {
    let alpha = 1;
    if (rgbMatch[4] !== undefined) {
      alpha = rgbMatch[4].endsWith('%')
        ? parseFloat(rgbMatch[4]) / 100
        : parseFloat(rgbMatch[4]);
    }
    return {
      r: Math.round(clampByte(parseFloat(rgbMatch[1]))),
      g: Math.round(clampByte(parseFloat(rgbMatch[2]))),
      b: Math.round(clampByte(parseFloat(rgbMatch[3]))),
      a: clamp01(alpha),
    };
  }

  // hsl()/hsla()
  const hslMatch = trimmed.match(
    /^hsla?\(\s*(\d+(?:\.\d+)?)\s*[,\s]\s*(\d+(?:\.\d+)?)%\s*[,\s]\s*(\d+(?:\.\d+)?)%\s*(?:[,/]\s*(\d+(?:\.\d+)?%?))?\s*\)$/,
  );
  if (hslMatch) {
    const h = parseFloat(hslMatch[1]);
    const s = parseFloat(hslMatch[2]) / 100;
    const l = parseFloat(hslMatch[3]) / 100;
    let alpha = 1;
    if (hslMatch[4] !== undefined) {
      alpha = hslMatch[4].endsWith('%')
        ? parseFloat(hslMatch[4]) / 100
        : parseFloat(hslMatch[4]);
    }
    const rgb = hslToRgb(h, s, l);
    return { r: rgb.r, g: rgb.g, b: rgb.b, a: clamp01(alpha) };
  }

  // Fallback: try culori
  try {
    const parsed = culori.parse(trimmed);
    if (parsed) {
      const rgb = culori.converter('rgb')(parsed);
      return {
        r: Math.round(clampByte((rgb.r ?? 0) * 255)),
        g: Math.round(clampByte((rgb.g ?? 0) * 255)),
        b: Math.round(clampByte((rgb.b ?? 0) * 255)),
        a: clamp01(rgb.alpha ?? 1),
      };
    }
  } catch {
    // ignore parse failures
  }

  return null;
}

function hslToRgb(h: number, s: number, l: number): { r: number; g: number; b: number } {
  h = ((h % 360) + 360) % 360;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0, g = 0, b = 0;
  if (h < 60)       { r = c; g = x; b = 0; }
  else if (h < 120) { r = x; g = c; b = 0; }
  else if (h < 180) { r = 0; g = c; b = x; }
  else if (h < 240) { r = 0; g = x; b = c; }
  else if (h < 300) { r = x; g = 0; b = c; }
  else              { r = c; g = 0; b = x; }
  return {
    r: Math.round((r + m) * 255),
    g: Math.round((g + m) * 255),
    b: Math.round((b + m) * 255),
  };
}

function clampByte(v: number): number {
  return Math.max(0, Math.min(255, v));
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

export function rgbaToHex(r: number, g: number, b: number): string {
  const toHex = (n: number) => Math.round(clampByte(n)).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function rgbaKey(c: RGBA): string {
  return `${c.r},${c.g},${c.b},${Math.round(c.a * 1000)}`;
}

//  Shadow & Gradient Parsers 

function extractShadowColors(boxShadow: string): string[] {
  if (!boxShadow || boxShadow === 'none') return [];
  const colors: string[] = [];
  // Match rgb/rgba/hsl/hsla/hex colors within the shadow value
  const colorPatterns = [
    /rgba?\([^)]+\)/g,
    /hsla?\([^)]+\)/g,
    /#[0-9a-fA-F]{3,8}\b/g,
  ];
  for (const pattern of colorPatterns) {
    const matches = boxShadow.match(pattern);
    if (matches) colors.push(...matches);
  }
  return colors;
}

function extractGradientColors(gradient: string): string[] {
  if (!gradient) return [];
  const colors: string[] = [];
  const colorPatterns = [
    /rgba?\([^)]+\)/g,
    /hsla?\([^)]+\)/g,
    /#[0-9a-fA-F]{3,8}\b/g,
  ];
  for (const pattern of colorPatterns) {
    const matches = gradient.match(pattern);
    if (matches) colors.push(...matches);
  }
  // Also check for named colors in gradient stops
  const namedPattern = /\b(white|black|red|blue|green|yellow|orange|purple|gray|grey|transparent)\b/gi;
  const namedMatches = gradient.match(namedPattern);
  if (namedMatches) colors.push(...namedMatches);
  return colors;
}

//  WCAG Contrast 

function relativeLuminance(r: number, g: number, b: number): number {
  const srgb = [r, g, b].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * srgb[0] + 0.7152 * srgb[1] + 0.0722 * srgb[2];
}

export function wcagContrast(hex1: string, hex2: string): number {
  const c1 = parseColor(hex1);
  const c2 = parseColor(hex2);
  if (!c1 || !c2) return 1;
  const l1 = relativeLuminance(c1.r, c1.g, c1.b);
  const l2 = relativeLuminance(c2.r, c2.g, c2.b);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

//  Math Helpers 

function gcd(a: number, b: number): number {
  a = Math.abs(Math.round(a));
  b = Math.abs(Math.round(b));
  while (b) {
    const t = b;
    b = a % b;
    a = t;
  }
  return a;
}

function mode<T>(arr: T[]): T | undefined {
  if (arr.length === 0) return undefined;
  const freq = new Map<string, { value: T; count: number }>();
  for (const v of arr) {
    const key = String(v);
    const entry = freq.get(key);
    if (entry) {
      entry.count++;
    } else {
      freq.set(key, { value: v, count: 1 });
    }
  }
  let best: { value: T; count: number } | undefined;
  for (const entry of freq.values()) {
    if (!best || entry.count > best.count) best = entry;
  }
  return best?.value;
}

export function parsePxValue(val: string): number | null {
  if (!val || val === 'auto' || val === 'none' || val === 'normal') return null;
  const num = parseFloat(val);
  if (isNaN(num)) return null;
  if (val.endsWith('rem')) return num * 16;
  if (val.endsWith('em')) return num * 16;
  // px or unitless
  return num;
}

/**
 * Normalise a CSS border-radius string for cluster keying / emit.
 *
 * Used by the radius clustering pass to:
 *   - Collapse rem-derived sub-pixel drift ("18.7693px", "18.769px") into
 *     a single integer-px bucket ("19px"). Real design tokens authored
 *     in rem land here together instead of fragmenting into noise.
 *   - Filter outliers: any corner > MAX_RADIUS_PX (10000) signals a
 *     `calc(infinity)` overflow or `Number.MAX_SAFE_INTEGER`-style sentinel
 *     (Shopify's "3.35544e+07px" was extracted 25 times pre-fix). The cap
 *     sits above the conventional pill value (`9999px`) so genuine pill
 *     radii pass through; anything an order of magnitude higher is
 *     overflow territory and gets dropped.
 *   - Filter all-zero shorthands ("0px 0px 0px 0px") that the simple
 *     `value === '0px'` check missed. Same null-return path.
 *   - Preserve genuine asymmetric corners ("32px 32px 0px 0px"),
 *     percentages ("50%"), and pill conventions ("9999px") as-is. Each
 *     of these is its own design intent.
 *
 * Returns the normalised string, or null when the input should be
 * dropped from the radius scale entirely. Exported for unit testing.
 */
const MAX_RADIUS_PX = 10000;

/**
 * Strip invisible layers from a multi-layer CSS box-shadow value
 * (Issue SH3 fix). Returns the cleaned shadow string, or null if no
 * visible layer remains.
 *
 * Why: Tailwind v4's preflight defines `--tw-ring-offset-shadow`,
 * `--tw-ring-shadow`, `--tw-inset-shadow`, and `--tw-shadow` as CSS
 * variables that default to `0 0 #0000` (transparent, all-zero). When
 * an element ships ANY shadow utility, the computed `box-shadow` value
 * concatenates ALL FOUR slot values, with the unused ones rendering as
 * `rgba(0, 0, 0, 0) 0px 0px 0px 0px`  invisible noise that bloats
 * tokens.json strings and obscures the design-intent layers. See real
 * Shopify shadow strings: every entry has four placeholder layers
 * before the actual shadow content.
 *
 * A layer is invisible iff:
 *   - Its colour parses to alpha = 0 (fully transparent), OR
 *   - All four numeric components (offsetX, offsetY, blur, spread) are 0
 *
 * A `rgba(0, 0, 0, 0) 0px 0px 0px 0px` placeholder matches BOTH; either
 * gate alone suffices. Real shadows have either a visible colour or
 * a non-zero offset / blur / spread.
 *
 * Exported for unit testing.
 */
export function normalizeShadowValue(value: string): string | null {
  if (!value || value === 'none') return null;
  const layers = splitShadowLayers(value);
  const visible = layers.filter((layer) => {
    // Extract the colour (first rgba / hsla / hex / oklab / oklch /
    // named-colour-ish token). parseColor handles every CSS colour
    // syntax used in shadows (delegates modern colours to culori).
    const colorMatch = layer.match(
      /rgba?\([^)]+\)|hsla?\([^)]+\)|#[0-9a-fA-F]{3,8}|oklab\([^)]+\)|oklch\([^)]+\)/,
    );
    if (colorMatch) {
      const parsed = parseColor(colorMatch[0]);
      if (parsed && parsed.a === 0) return false;
    }
    // Strip the colour fragment, then check the remaining numbers.
    // Inset keyword + comments don't matter here  we only care if
    // ALL FOUR of offsetX / offsetY / blur / spread are zero.
    const sansColor = layer
      .replace(/rgba?\([^)]+\)/g, '')
      .replace(/hsla?\([^)]+\)/g, '')
      .replace(/#[0-9a-fA-F]{3,8}/g, '')
      .replace(/oklab\([^)]+\)/g, '')
      .replace(/oklch\([^)]+\)/g, '')
      .replace(/\binset\b/g, '')
      .trim();
    const nums = sansColor
      .match(/-?\d+(\.\d+)?(px)?/g)
      ?.map((n) => parseFloat(n)) ?? [];
    if (nums.length > 0 && nums.every((n) => n === 0)) return false;
    return true;
  });
  if (visible.length === 0) return null;
  return visible.join(', ');
}

export function normalizeBorderRadius(raw: string): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed || trimmed === 'none') return null;

  // Split on whitespace to get the individual corners (1-4 components).
  // CSS allows the `/` separator for elliptical-radius syntax  rare in
  // practice and not part of any design system we've seen, so we treat
  // the whole string as opaque if it contains a slash.
  if (trimmed.includes('/')) return trimmed;

  const parts = trimmed.split(/\s+/);
  const normalised: string[] = [];
  let allZero = true;
  for (const part of parts) {
    // Percentage: keep authored value as-is. "50%" and "100%" are
    // semantically distinct from px-based radii (50% = ellipse / circle,
    // 100% on small widgets, etc.). Don't collapse.
    if (part.endsWith('%')) {
      normalised.push(part);
      if (parseFloat(part) !== 0) allZero = false;
      continue;
    }
    // Try parsing as a px-like length (px / rem / em via parsePxValue).
    const px = parsePxValue(part);
    if (px !== null) {
      // Drop the whole token if ANY corner exceeds the sane radius cap.
      // Catches Shopify's 3.35544e+07 outlier and similar calc()-overflow
      // sentinels without affecting realistic pill values (9999px stays).
      if (px > MAX_RADIUS_PX) return null;
      const rounded = Math.round(px);
      normalised.push(`${rounded}px`);
      if (rounded !== 0) allZero = false;
      continue;
    }
    // Unknown form (calc(), keyword, etc.)  pass through unchanged.
    normalised.push(part);
    allZero = false;
  }

  if (allZero) return null;
  return normalised.join(' ');
}

/**
 * Normalise a CSS line-height to integer pixels relative to a given font
 * size. Used by the typography clustering pass so that the same authored
 * line-height surfaces as the same cluster key regardless of which CSS
 * unit was specified (Issue T3 / T4 fix).
 *
 * Handles every CSS line-height syntax getComputedStyle can emit:
 *   - "24px"           absolute length
 *   - "1.5"            unitless multiplier (rendered as multiplier x font-size)
 *   - "150%"           percent multiplier
 *   - "1.5em" / "rem"  em / rem (rem treated as 1rem = 16px per parsePxValue)
 *   - "normal"         CSS default; browsers compute ~1.2 x font-size  use 1.2
 *
 * Returns the integer pixel value. Rounding to integers groups trivially
 * different lineHeights (24.001px vs 24px, sub-pixel float drift) into
 * the same bucket while keeping genuinely-distinct lineHeights (24 vs 28)
 * separate. Exported for unit testing.
 */
export function normalizeLineHeight(
  lineHeight: string,
  fontSizePx: number,
): number {
  if (!lineHeight || lineHeight === 'normal') {
    return Math.round(fontSizePx * 1.2);
  }
  const trimmed = lineHeight.trim();
  // Percent value: "150%"  multiply by font-size, divide by 100.
  if (trimmed.endsWith('%')) {
    const pct = parseFloat(trimmed);
    if (Number.isFinite(pct)) return Math.round((pct / 100) * fontSizePx);
    return Math.round(fontSizePx * 1.2);
  }
  // Absolute or rem / em via parsePxValue. Important: this branch must
  // run BEFORE the unitless branch, because parseFloat("1.5em") = 1.5
  // and the bare-number path would treat it as a 1.5x multiplier  but
  // 1.5em is 1.5 x 16 = 24px regardless of font-size.
  if (trimmed.endsWith('px') || trimmed.endsWith('rem') || trimmed.endsWith('em')) {
    const px = parsePxValue(trimmed);
    if (px !== null) return Math.round(px);
  }
  // Unitless multiplier: "1.5"  multiplier x font-size.
  const ratio = parseFloat(trimmed);
  if (Number.isFinite(ratio)) return Math.round(ratio * fontSizePx);
  return Math.round(fontSizePx * 1.2);
}

/**
 * Count the number of columns in a `grid-template-columns` computed value.
 *
 * The naive `.split(/\s+/)` approach over-counts when track sizes contain
 * embedded whitespace via functional notation. getComputedStyle returns:
 *   - `minmax(0px, 1fr) minmax(0px, 1fr)` for a 2-col minmax grid
 *   - `fit-content(200px) 1fr` for fit-content tracks
 *   - `repeat(...)` is normalized by the browser into explicit tracks, but
 *     line names `[start]` / `[col-end]` survive in the computed value.
 *
 * This helper walks the string tracking paren depth so functional notations
 * count as a single track, and skips bracket-wrapped line names.
 *
 * Exported for unit testing.
 */
export function countGridColumns(gtc: string): number {
  if (!gtc || gtc === 'none') return 0;
  const tokens: string[] = [];
  let buf = '';
  let parenDepth = 0;
  let bracketDepth = 0;
  for (let i = 0; i < gtc.length; i++) {
    const ch = gtc[i];
    if (ch === '(') parenDepth++;
    else if (ch === ')') parenDepth = Math.max(0, parenDepth - 1);
    else if (ch === '[') bracketDepth++;
    else if (ch === ']') bracketDepth = Math.max(0, bracketDepth - 1);
    if (/\s/.test(ch) && parenDepth === 0 && bracketDepth === 0) {
      if (buf.length > 0) {
        tokens.push(buf);
        buf = '';
      }
      continue;
    }
    buf += ch;
  }
  if (buf.length > 0) tokens.push(buf);
  // Line names (bracket-wrapped) don't represent columns.
  return tokens.filter((t) => t.length > 0 && !t.startsWith('[')).length;
}

//  Element Visual Score (representative selection)

/**
 * Cheap visual-prominence score used to pick a representative element from a
 * cluster of same-variant components (Card / Hero / Footer / Link / Badge /
 * Input / PricingTier / Navigation). Higher score = more visually prominent.
 *
 * Formula: sqrt(area) × foldBoost. sqrt because a 2× wider element is ~2×
 * as visually prominent, not 4×. foldBoost: 2 above-the-fold, 1 below.
 *
 * Viewport height hardcoded to 900 to match extract.ts's per-page newContext
 * call (`{ width: 1440, height: 900 }`). DOM rects this function consumes
 * were captured at that viewport, so 900 is the right fold boundary.
 *
 * visibility-weight.ts has a richer formula with semantic + interactive
 * boosts. Those signals are valuable for color-token weighting but largely
 * noise for component-representative picking (a Hero isn't a heading; a
 * Card isn't interactive). The simpler formula here is the right tool and
 * keeps cluster.ts free of the cross-module dep on the visibility-weight
 * ADD layer (which would also create a circular import — that module
 * already imports `parseColor` + `deltaE` from here).
 *
 * Buttons are unaffected: button-cluster.ts replaces components[type ===
 * 'Button'] downstream with its own OKLCH-ΔE clustering + visibility-picked
 * representative. The improved pick here still runs for Button, but its
 * output is overwritten later.
 */
function elementVisualScore(el: ElementStyle): number {
  const area = el.rect.width * el.rect.height;
  if (area <= 0) return 0;
  const foldBoost = el.rect.y < 900 ? 2 : 1;
  return Math.sqrt(area) * foldBoost;
}

/**
 * Strict visibility gate. Mirrors the early-exit in
 * visibility-weight.ts:computeElementWeight so raw frequency counts and
 * visibility-weighted scores see the same set of elements.
 *
 * Excluded:
 *   - display: none            — not in the render tree at all
 *   - opacity: 0               — rendered but contributes no visible pixels
 *   - width or height ≤ 0      — degenerate rect, paints nothing
 *
 * NOT excluded: visibility: hidden. Those elements reserve layout space
 * and may be revealed by JS (open/close panels, dropdowns); their CSS is
 * still part of the design system. Revisit if low-quality sites are seen
 * leaking hidden colors into the palette.
 *
 * Applied today to the COLOR-COLLECTION loop only — frequency counts
 * are the field most contaminated by hidden-element pollution because
 * role-namer's fallback path and 4-layer stability classification both
 * consume them. Typography / spacing / shadow / radius / component
 * extraction don't apply this gate yet (separate accuracy item).
 */
export function isElementVisible(el: ElementStyle): boolean {
  if (el.display === 'none') return false;
  const opacity = parseFloat(el.opacity || '1');
  if (Number.isFinite(opacity) && opacity === 0) return false;
  if (el.rect.width <= 0 || el.rect.height <= 0) return false;
  // Screen-reader-only pattern: width:1px; height:1px; clip:rect(...);
  // overflow:hidden; position:absolute. The element exists in the DOM
  // and has non-zero rect, but is functionally invisible to sighted
  // users. We filter the canonical 1x1 (or sub-pixel) signature so it
  // doesn't pollute touch-target metrics, minFontSize, contrast pairs,
  // typography clusters, etc. The AND of both dimensions <=1 preserves
  // legitimate 1px-wide vertical dividers (e.g. 1x100 rect passes).
  if (el.rect.width <= 1 && el.rect.height <= 1) return false;
  return true;
}

/**
 * Set of unique border colours that ACTUALLY render on an element.
 *
 * Two correctness wins over the previous "add all 4 border-side colours
 * unconditionally" approach:
 *
 *   1. Per-side width gate. `getComputedStyle` returns a real border-color
 *      value even when the side has `border-width: 0` (e.g. Tailwind v4
 *      preflight sets `border-color: rgb(229, 231, 235)` on every element
 *      by default). Counting those colours conflates "Tailwind preflight
 *      default" with "design-intent border colour" and inflates the
 *      hairline-tone frequency. Skipping sides with width 0 fixes that.
 *
 *   2. Per-element dedupe. A typical 4-side uniform border (`border: 1px
 *      solid #abc`) used to contribute its colour FOUR times per element,
 *      4xing the borderColor count for hairline tones. A `Set<string>`
 *      keyed on the colour-string makes the count one-per-element.
 *      getComputedStyle always normalises to the same string for the same
 *      resolved colour, so string-keyed dedupe is safe.
 *
 * Returns an empty set when no side has visible width (the element has no
 * visible borders at all  the most common case across modern UI).
 *
 * Exported for unit testing. Pure  no I/O, no closures, no mutation
 * of inputs.
 */
export function visibleBorderColors(el: ElementStyle): Set<string> {
  const colors = new Set<string>();
  if (parseFloat(el.borderTopWidth) > 0) colors.add(el.borderTopColor);
  if (parseFloat(el.borderRightWidth) > 0) colors.add(el.borderRightColor);
  if (parseFloat(el.borderBottomWidth) > 0) colors.add(el.borderBottomColor);
  if (parseFloat(el.borderLeftWidth) > 0) colors.add(el.borderLeftColor);
  return colors;
}

//  Usage Context Type

type UsageContext = 'textColor' | 'bgColor' | 'borderColor' | 'shadowColor' | 'gradientColor' | 'iconColor';

interface ColorEntry {
  rgba: RGBA;
  hex: string;
  frequency: number;
  usedAs: Record<UsageContext, number>;
  // URL  per-page frequency (Issue #4 fix). Was previously a Set<string>
  // tracking only which pages saw this colour; the final emit then divided
  // total `frequency` by `pages.size` to fake a uniform per-page split,
  // which silently lied about per-page distribution. The Map shape lets
  // the final emit use real counts (3 on page A, 1 on page B) instead.
  pages: Map<string, number>;
  cssVariableNames: Set<string>;
  // Distinct alpha values seen for this RGB triple (and OKLCH neighbours
  // after clustering), mapped to their accumulated frequency. Lets the
  // final emit surface `alphaVariants` on the ColorToken without losing
  // the alpha=0.2 contribution when it merges into the alpha=1 cluster
  // representative. Keys are rounded to 3 decimals  see roundAlpha()
  // so authored alphas like 0.5 don't fragment into 0.4999 / 0.5001 due
  // to upstream parsing float drift.
  alphaCounts: Map<number, number>;
}

/**
 * Round alpha to 3 decimals so we don't fragment otherwise-identical
 * alphas into separate buckets due to upstream float noise. Browsers and
 * parsers can return 0.9999... for an authored 1.0, or 0.20000000003 for
 * 0.2  rounding at the bucket level keeps the variant list honest.
 */
function roundAlpha(a: number): number {
  return Math.round(a * 1000) / 1000;
}

//  Exported Utilities (for testing) 

export interface OKLCH {
  l: number;
  c: number;
  h: number;
}

/** Euclidean distance in OKLCH space, scaled ×100 */
export function deltaE(a: OKLCH, b: OKLCH): number {
  const dl = (a.l - b.l) * 100;
  const dc = (a.c - b.c) * 100;
  const dhRad = ((a.h - b.h) * Math.PI) / 180;
  const dh = 2 * Math.sqrt(a.c * b.c) * Math.sin(dhRad / 2) * 100;
  return Math.sqrt(dl * dl + dc * dc + dh * dh);
}

/** Split box-shadow into layers, respecting commas inside rgba()/hsla() */
export function splitShadowLayers(value: string): string[] {
  const layers: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < value.length; i++) {
    if (value[i] === '(') depth++;
    else if (value[i] === ')') depth--;
    else if (value[i] === ',' && depth === 0) {
      layers.push(value.slice(start, i).trim());
      start = i + 1;
    }
  }
  layers.push(value.slice(start).trim());
  return layers.filter((l) => l.length > 0);
}

/** Classify a CSS box-shadow string by type */
export function classifyShadow(value: string): 'border-shadow' | 'ring' | 'elevation' | 'inset' | 'complex-stack' {
  const parts = splitShadowLayers(value);
  if (parts.length > 1) return 'complex-stack';
  if (value.includes('inset')) return 'inset';

  const cleaned = value
    .replace(/rgba?\([^)]+\)/g, '')
    .replace(/hsla?\([^)]+\)/g, '')
    .replace(/#[0-9a-fA-F]{3,8}/g, '')
    .trim();

  const nums = cleaned.match(/-?\d+(\.\d+)?(px)?/g)?.map((n) => parseFloat(n)) ?? [];
  const offsetX = nums[0] ?? 0;
  const offsetY = nums[1] ?? 0;
  const blur = nums[2] ?? 0;
  const spread = nums[3] ?? 0;

  if (offsetX === 0 && offsetY === 0 && blur === 0 && spread > 0) return 'border-shadow';
  if (offsetX === 0 && offsetY === 0 && blur === 0 && spread !== 0) return 'ring';
  if (offsetY > 0 && blur > 0) return 'elevation';

  return 'elevation';
}

//  Stability Classification 

function classifyColorStability(color: ColorToken): StabilityClassification {
  const signals: string[] = [];
  let score = 0;

  // Signal 1: Page coverage
  if (color.pagesCoverage >= 0.8) { score += 30; signals.push(`pages: ${(color.pagesCoverage * 100).toFixed(0)}%`); }
  else if (color.pagesCoverage >= 0.5) { score += 20; signals.push(`pages: ${(color.pagesCoverage * 100).toFixed(0)}%`); }
  else if (color.pagesCoverage < 0.2) { score -= 20; signals.push('single-page'); }

  // Signal 2: Usage dimensions
  const usedDimensions = Object.entries(color.usedAs).filter(([, v]) => v > 0).length;
  if (color.usedAs.textColor > 0 || color.usedAs.borderColor > 0) { score += 25; signals.push('text/border usage'); }
  if (usedDimensions >= 3) { score += 15; signals.push(`${usedDimensions} usage dimensions`); }
  if (usedDimensions === 1 && (color.usedAs.bgColor > 0 || color.usedAs.gradientColor > 0)) { score -= 15; signals.push('bg/gradient only'); }

  // Signal 3: CSS variable presence
  if (color.cssVariableNames.length > 0) { score += 20; signals.push(`css-var: ${color.cssVariableNames[0]}`); }

  // Signal 4: Frequency
  if (color.frequency >= 500) { score += 20; signals.push(`freq: ${color.frequency}`); }
  else if (color.frequency >= 50) { score += 10; signals.push(`freq: ${color.frequency}`); }
  else if (color.frequency <= 5) { score -= 20; signals.push(`freq: ${color.frequency} (rare)`); }

  // Signal 5: Chromaticity achromatic colors are almost always system-level
  const [r, g, b] = color.rgba;
  const isAchromatic = Math.max(r, g, b) - Math.min(r, g, b) <= 25;
  if (isAchromatic) { score += 10; signals.push('achromatic'); }

  let layer: StabilityClassification['layer'];
  if (score >= 60) layer = 'infrastructure';
  else if (score >= 30) layer = 'system';
  else if (score >= 0) layer = 'campaign';
  else layer = 'content';

  return { layer, confidence: Math.min(1, Math.max(0, (score + 40) / 100)), signals };
}

function classifyTypographyStability(typo: TypographyLevel): StabilityClassification {
  const signals: string[] = [];
  let score = 0;

  // Frequency
  if (typo.frequency >= 100) { score += 30; signals.push(`freq: ${typo.frequency}`); }
  else if (typo.frequency >= 20) { score += 15; signals.push(`freq: ${typo.frequency}`); }
  else if (typo.frequency <= 3) { score -= 20; signals.push(`freq: ${typo.frequency} (rare)`); }

  // Structural tags (nav, header, footer → infrastructure)
  const infraTags = ['nav', 'header', 'footer'];
  const hasInfraTag = typo.typicalTags.some((t) => infraTags.includes(t));
  if (hasInfraTag) { score += 25; signals.push(`tag: ${typo.typicalTags.filter((t) => infraTags.includes(t)).join(',')}`); }

  // Heading tags → system
  const headingTags = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'];
  const hasHeadingTag = typo.typicalTags.some((t) => headingTags.includes(t));
  if (hasHeadingTag) { score += 15; signals.push('heading tag'); }

  // Body text tag
  if (typo.typicalTags.includes('p') || typo.typicalTags.includes('span')) {
    score += 10; signals.push('body text');
  }

  let layer: StabilityClassification['layer'];
  if (score >= 50) layer = 'infrastructure';
  else if (score >= 25) layer = 'system';
  else if (score >= 0) layer = 'campaign';
  else layer = 'content';

  return { layer, confidence: Math.min(1, Math.max(0, (score + 40) / 100)), signals };
}

function classifyShadowStability(shadow: ShadowToken): StabilityClassification {
  const signals: string[] = [];
  let score = 0;

  if (shadow.frequency >= 50) { score += 30; signals.push(`freq: ${shadow.frequency}`); }
  else if (shadow.frequency >= 10) { score += 15; signals.push(`freq: ${shadow.frequency}`); }
  else if (shadow.frequency <= 3) { score -= 15; signals.push(`freq: ${shadow.frequency} (rare)`); }

  // System shadow types
  if (shadow.type === 'elevation') { score += 10; signals.push('elevation type'); }
  if (shadow.type === 'ring') { score += 10; signals.push('ring type'); }

  let layer: StabilityClassification['layer'];
  if (score >= 40) layer = 'infrastructure';
  else if (score >= 20) layer = 'system';
  else if (score >= 0) layer = 'campaign';
  else layer = 'content';

  return { layer, confidence: Math.min(1, Math.max(0, (score + 40) / 100)), signals };
}

function classifyRadiusStability(radius: RadiusToken, maxFrequency: number): StabilityClassification {
  const signals: string[] = [];
  let score = 0;

  // Dominant radius
  if (maxFrequency > 0 && radius.frequency >= maxFrequency * 0.5) {
    score += 30; signals.push('dominant radius');
  }

  if (radius.frequency >= 50) { score += 20; signals.push(`freq: ${radius.frequency}`); }
  else if (radius.frequency >= 10) { score += 10; signals.push(`freq: ${radius.frequency}`); }
  else if (radius.frequency <= 3) { score -= 15; signals.push(`freq: ${radius.frequency} (rare)`); }

  let layer: StabilityClassification['layer'];
  if (score >= 40) layer = 'infrastructure';
  else if (score >= 20) layer = 'system';
  else if (score >= 0) layer = 'campaign';
  else layer = 'content';

  return { layer, confidence: Math.min(1, Math.max(0, (score + 40) / 100)), signals };
}

function classifyComponentStability(component: ComponentGroup): StabilityClassification {
  const signals: string[] = [];
  let score = 0;
  const totalCount = component.variants.reduce((sum, v) => sum + v.count, 0);

  if (totalCount >= 50) { score += 25; signals.push(`count: ${totalCount}`); }
  else if (totalCount >= 10) { score += 10; signals.push(`count: ${totalCount}`); }
  else if (totalCount <= 3) { score -= 15; signals.push(`count: ${totalCount} (rare)`); }

  // Structural components → infrastructure
  const infraTypes = ['Navigation', 'Footer'];
  if (infraTypes.includes(component.type)) { score += 30; signals.push(`structural: ${component.type}`); }

  // Common UI components → system
  const systemTypes = ['Button', 'Input', 'Card', 'Badge', 'Link'];
  if (systemTypes.includes(component.type)) { score += 15; signals.push(`ui primitive: ${component.type}`); }

  let layer: StabilityClassification['layer'];
  if (score >= 40) layer = 'infrastructure';
  else if (score >= 20) layer = 'system';
  else if (score >= 0) layer = 'campaign';
  else layer = 'content';

  return { layer, confidence: Math.min(1, Math.max(0, (score + 40) / 100)), signals };
}

/** Classify all tokens in a DesignTokens object by temporal stability layer. Can be called independently. */
export function classifyTokenStability(tokens: DesignTokens): void {
  for (const color of tokens.colorTokens) {
    color.stability = classifyColorStability(color);
  }

  for (const typo of tokens.typographyLevels) {
    typo.stability = classifyTypographyStability(typo);
  }

  for (const shadow of tokens.shadowTokens) {
    shadow.stability = classifyShadowStability(shadow);
  }

  const maxRadiusFreq = tokens.radiusTokens.length > 0
    ? Math.max(...tokens.radiusTokens.map((r) => r.frequency))
    : 0;
  for (const radius of tokens.radiusTokens) {
    radius.stability = classifyRadiusStability(radius, maxRadiusFreq);
  }

  for (const component of tokens.components) {
    component.stability = classifyComponentStability(component);
  }
}

//  Main Export 

export function clusterTokens(pages: PageExtraction[], cssVariables: CSSVariable[]): DesignTokens {
  const totalPages = pages.length;

  //  1. Color Clustering 

  const colorMap = new Map<string, ColorEntry>();

  function addColor(colorStr: string, context: UsageContext, pageUrl: string): void {
    const parsed = parseColor(colorStr);
    if (!parsed) return;
    // Skip fully transparent
    if (parsed.a === 0) return;

    const hex = rgbaToHex(parsed.r, parsed.g, parsed.b);
    const key = rgbaKey(parsed);
    const roundedAlpha = roundAlpha(parsed.a);
    const existing = colorMap.get(key);
    if (existing) {
      existing.frequency++;
      existing.usedAs[context]++;
      // Bump per-page count. Previously this was an unordered Set add
      // (we only tracked which pages saw the colour); now we track
      // actual per-page frequency so the final emit can report honest
      // sourcePages[i].frequency values instead of total / pages.size.
      existing.pages.set(pageUrl, (existing.pages.get(pageUrl) ?? 0) + 1);
      // Same rgbaKey means same alpha (rgbaKey includes alpha at 3
      // decimals), so this just bumps the single existing alpha bucket.
      // The cross-alpha merge happens later when two same-RGB / different-
      // alpha entries collapse into one OKLCH cluster.
      existing.alphaCounts.set(
        roundedAlpha,
        (existing.alphaCounts.get(roundedAlpha) ?? 0) + 1,
      );
    } else {
      colorMap.set(key, {
        rgba: parsed,
        hex,
        frequency: 1,
        usedAs: {
          textColor: 0,
          bgColor: 0,
          borderColor: 0,
          shadowColor: 0,
          gradientColor: 0,
          iconColor: 0,
        },
        pages: new Map([[pageUrl, 1]]),
        cssVariableNames: new Set(),
        alphaCounts: new Map([[roundedAlpha, 1]]),
      });
      colorMap.get(key)!.usedAs[context] = 1;
    }
  }

  for (const page of pages) {
    const { dom, url } = page;

    // Element colors
    for (const el of dom.elements) {
      // Skip elements that aren't rendering pixels (display:none,
      // opacity:0, degenerate rect). Their colors are still defined in
      // the CSS but they contribute nothing to the visible UI — counting
      // them inflates frequency for hidden modals / dropdowns / off-screen
      // a11y helpers, which poisons role-namer's fallback prominence
      // signal and the 4-layer stability classifier. See isElementVisible
      // for the exact gate; matches visibility-weight.ts so the two
      // passes agree on what "in the system" means.
      if (!isElementVisible(el)) continue;

      addColor(el.color, 'textColor', url);
      addColor(el.backgroundColor, 'bgColor', url);
      // Border colours: count each unique colour once per element, gated
      // by per-side visibility. See visibleBorderColors() for the
      // correctness story  the previous 4-side unconditional add was
      // 4xing the count for uniformly-bordered elements AND silently
      // including phantom Tailwind-preflight colours from zero-width
      // sides, both of which polluted the frequency ranking and made
      // role-namer's >= 3 threshold for "hairline" effectively require
      // 12 real border-uses.
      for (const borderColor of visibleBorderColors(el)) {
        addColor(borderColor, 'borderColor', url);
      }
      // outline-color + text-decoration-color: NOT collected here. Both
      // default to the CSS `currentcolor` keyword, which getComputedStyle
      // resolves to the element's own `color` value. Since we already
      // count `el.color` as textColor above, adding these unconditionally
      // (which is what the pre-fix code did) inflated:
      //   * borderColor for the dominant ink, by ~1 per visible element
      //     (outline default style is `none` but its colour still
      //     reports as currentcolor; non-rendering, but counted)
      //   * textColor for the same ink, by ~1 per visible element on
      //     anything with text-decoration default of `none`
      // Real custom focus-ring colours surface via interaction-capture
      // hover/focus state diffs, not static computed style. Real custom
      // underline colours are extremely rare and usually equal the brand
      // primary, captured via the regular `color` path. Net effect of
      // skipping these two: ink colours stop being over-attributed as
      // borders, role-namer's border/text ratios become accurate, no
      // measurable signal is lost.

      // Box shadow colors
      const shadowColors = extractShadowColors(el.boxShadow);
      for (const sc of shadowColors) {
        addColor(sc, 'shadowColor', url);
      }
    }

    // SVG colors → icon context
    for (const svgColor of dom.svgColors) {
      addColor(svgColor, 'iconColor', url);
    }

    // Pseudo-element colors
    for (const pseudo of dom.pseudoElements) {
      addColor(pseudo.color, 'textColor', url);
      addColor(pseudo.backgroundColor, 'bgColor', url);
      // Gradient colors from pseudo backgroundImage
      const gradColors = extractGradientColors(pseudo.backgroundImage);
      for (const gc of gradColors) {
        addColor(gc, 'gradientColor', url);
      }
    }

    // Gradient colors
    for (const gradient of dom.gradients) {
      const gradColors = extractGradientColors(gradient.value);
      for (const gc of gradColors) {
        addColor(gc, 'gradientColor', url);
      }
    }

    // Logo colors
    if (dom.logoColors) {
      for (const lc of dom.logoColors) {
        addColor(lc, 'bgColor', url);
      }
    }
  }

  // Cross-reference with CSS variables
  const cssVarHexMap = new Map<string, string[]>();
  for (const v of cssVariables) {
    const parsed = parseColor(v.value);
    if (parsed) {
      const key = rgbaKey(parsed);
      const entry = colorMap.get(key);
      if (entry) {
        entry.cssVariableNames.add(v.name);
      }
      if (!cssVarHexMap.has(key)) cssVarHexMap.set(key, []);
      cssVarHexMap.get(key)!.push(v.name);
    }
  }

  // Cluster colors using deltaE in OKLCH space
  const toOklch = culori.converter('oklch');
  const entries = Array.from(colorMap.values());

  interface ClusteredColor extends ColorEntry {
    oklch: { l: number; c: number; h: number } | null;
  }

  const withOklch: ClusteredColor[] = entries.map((e) => {
    try {
      const rgb = { mode: 'rgb' as const, r: e.rgba.r / 255, g: e.rgba.g / 255, b: e.rgba.b / 255 };
      const oklch = toOklch(rgb);
      return {
        ...e,
        oklch: oklch ? { l: oklch.l ?? 0, c: oklch.c ?? 0, h: oklch.h ?? 0 } : null,
      };
    } catch {
      return { ...e, oklch: null };
    }
  });

  // Cluster within each usage group context, deltaE < 3
  // Simple greedy clustering: sort by frequency desc, assign to first cluster within threshold
  const clustered: ClusteredColor[] = [];
  const sortedByFreq = [...withOklch].sort((a, b) => b.frequency - a.frequency);

  for (const color of sortedByFreq) {
    let merged = false;
    if (color.oklch) {
      for (const existing of clustered) {
        if (!existing.oklch) continue;
        if (deltaE(color.oklch, existing.oklch) < 3) {
          // Issue #9 fix: prefer the variable-named entry as the cluster
          // representative. Decide BEFORE merging the cssVariableNames
          // sets  after the union, both sides would always have vars.
          // Rule: swap iff the incoming has a CSS var name AND the
          // existing doesn't. If both have vars (or neither), keep the
          // current frequency-based winner. This surfaces design-intent
          // hex values like `#020202` (set via `var(--text-primary)`)
          // instead of OKLCH-adjacent raw `#000000` siblings that
          // outnumbered them in frequency.
          const shouldSwapRepresentative =
            color.cssVariableNames.size > 0 &&
            existing.cssVariableNames.size === 0;

          // Merge into existing cluster representative
          existing.frequency += color.frequency;
          for (const [ctx, count] of Object.entries(color.usedAs) as [UsageContext, number][]) {
            existing.usedAs[ctx] += count;
          }
          // Merge per-page counts. Previously this was Set-union (lost
          // per-page frequency); the Map merge sums counts per URL so a
          // colour used 3x on page A and 5x on page B post-OKLCH-cluster
          // surfaces as (3, 5) rather than the fake-uniform (4, 4) the
          // pre-fix code would emit.
          for (const [url, freq] of color.pages) {
            existing.pages.set(url, (existing.pages.get(url) ?? 0) + freq);
          }
          for (const v of color.cssVariableNames) existing.cssVariableNames.add(v);
          // Merge alpha buckets. This is the key fix for Issue #3
          // pre-fix, the loser's alpha was thrown away here (only its
          // frequency was added), so an alpha=0.2 overlay variant
          // silently disappeared into the alpha=1 base. Adding the
          // other entry's alphaCounts means the final colorToken can
          // expose `alphaVariants: [1, 0.2]` for translucent overlays.
          for (const [a, count] of color.alphaCounts) {
            existing.alphaCounts.set(
              a,
              (existing.alphaCounts.get(a) ?? 0) + count,
            );
          }
          // Apply the rep-swap decided BEFORE the merges. The hex / rgba
          // / oklch fields are the "canonical colour" the final emit
          // writes to tokens.json; everything else is a sum or union.
          // Swapping just these three preserves the variable-named
          // entry as the canonical surface without affecting any of the
          // accumulated frequency / usage / page data.
          if (shouldSwapRepresentative) {
            existing.hex = color.hex;
            existing.rgba = color.rgba;
            existing.oklch = color.oklch;
          }
          merged = true;
          break;
        }
      }
    }
    if (!merged) {
      // Spread copies the Map reference for `alphaCounts`  fine because
      // we never re-encounter `color` after the unmerged push (the outer
      // loop iterates each ClusteredColor once). If that invariant ever
      // breaks, swap `...color` for an explicit field copy + new Map.
      clustered.push({ ...color });
    }
  }

  // Sort by total frequency descending
  clustered.sort((a, b) => b.frequency - a.frequency);

  // Build per-page frequency
  const pageColorFrequency = new Map<string, Map<string, number>>();
  for (const page of pages) {
    pageColorFrequency.set(page.url, new Map());
  }

  // Rebuild source pages info from original entries (pre-cluster)
  // For simplicity, use the pages set on each clustered entry
  const colorTokens: ColorToken[] = clustered.map((c) => {
    const pagesCoverage = c.pages.size / Math.max(totalPages, 1);
    // Honest per-page counts (Issue #4 fix). The previous code divided
    // the cluster's total frequency evenly by `pages.size` and assigned
    // that uniform number to every sourcePages entry, which silently
    // lied about per-page distribution. Now we emit the actual count
    // observed per page during addColor + the cluster merge step.
    // Sort high-to-low so the dominant-on-this-color page is listed
    // first  matches the existing convention for `alphaVariants`.
    const sourcePages = Array.from(c.pages.entries())
      .map(([url, frequency]) => ({ url, frequency }))
      .sort((a, b) => b.frequency - a.frequency);

    // Derive alpha variants. Field is OMITTED when the cluster only saw
    // one alpha (the common case)  keeps tokens.json compact for solid
    // palettes. When > 1 distinct alpha exists, emit them sorted by
    // frequency desc; the head element matches rgba[3] (dominant alpha
    // wins cluster representative because sortedByFreq pre-orders the
    // greedy clustering pass by total entry frequency).
    let alphaVariants: number[] | undefined;
    if (c.alphaCounts.size > 1) {
      alphaVariants = Array.from(c.alphaCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([alpha]) => alpha);
    }

    return {
      hex: c.hex,
      rgba: [c.rgba.r, c.rgba.g, c.rgba.b, c.rgba.a] as [number, number, number, number],
      frequency: c.frequency,
      usedAs: { ...c.usedAs },
      cssVariableNames: Array.from(c.cssVariableNames),
      pagesCoverage,
      sourcePages,
      confidence: c.frequency <= 2 ? 'low' as const : (pagesCoverage >= 0.5 ? 'high' as const : 'medium' as const),
      ...(alphaVariants ? { alphaVariants } : {}),
    };
  });

  //  Color Relationships 

  // Lightness scales: group by hue (H ± 10°), different lightness
  const oklchColors = clustered
    .filter((c) => c.oklch && c.frequency >= 3)
    .map((c) => ({
      hex: c.hex,
      h: c.oklch!.h,
      l: c.oklch!.l,
      c: c.oklch!.c,
      frequency: c.frequency,
    }));

  const scales: { baseHue: number; steps: { hex: string; lightness: number; frequency: number }[] }[] = [];
  const usedInScale = new Set<string>();

  for (const color of oklchColors) {
    if (usedInScale.has(color.hex)) continue;
    if (color.c < 0.01) continue; // skip near-achromatic

    const group = oklchColors.filter(
      (other) =>
        !usedInScale.has(other.hex) &&
        Math.abs(((color.h - other.h + 180) % 360) - 180) <= 10 &&
        other.c >= 0.01,
    );

    if (group.length >= 3) {
      const sorted = [...group].sort((a, b) => a.l - b.l);
      const steps = sorted.map((s) => ({
        hex: s.hex,
        lightness: Math.round(s.l * 100) / 100,
        frequency: s.frequency,
      }));
      scales.push({ baseHue: Math.round(color.h), steps });
      for (const s of group) usedInScale.add(s.hex);
    }
  }

  // WCAG contrast pairs for high-frequency colors
  const highFreqColors = colorTokens.filter((c) => c.frequency >= 5).slice(0, 20);
  const contrastPairs: {
    foreground: string;
    background: string;
    contrastRatio: number;
    meetsAA: boolean;
    meetsAAA: boolean;
    usageCount: number;
  }[] = [];

  for (let i = 0; i < highFreqColors.length; i++) {
    for (let j = i + 1; j < highFreqColors.length; j++) {
      const fg = highFreqColors[i];
      const bg = highFreqColors[j];
      const ratio = wcagContrast(fg.hex, bg.hex);
      if (ratio >= 3) {
        // Determine which is foreground vs background by usage
        const fgIsText = fg.usedAs.textColor > fg.usedAs.bgColor;
        const foreground = fgIsText ? fg.hex : bg.hex;
        const background = fgIsText ? bg.hex : fg.hex;
        contrastPairs.push({
          foreground,
          background,
          contrastRatio: Math.round(ratio * 100) / 100,
          meetsAA: ratio >= 4.5,
          meetsAAA: ratio >= 7,
          usageCount: fg.frequency + bg.frequency,
        });
      }
    }
  }

  contrastPairs.sort((a, b) => b.usageCount - a.usageCount);

  //  2. Typography Levels 

  interface TypoGroup {
    fontFamily: string;
    fontSize: number;
    fontWeight: string;
    // Canonical normalised line-height in integer pixels (Issue T3 fix).
    // Was previously NOT part of the cluster key  same family/size/
    // weight with different lineHeights collapsed into one group and
    // the dominant lineHeight won via mode(). Now lineHeightPx is a
    // first-class axis: distinct lineHeights produce distinct levels.
    lineHeightPx: number;
    lineHeights: string[];
    letterSpacings: string[];
    textTransforms: string[];
    fontFeatureSettings: string[];
    tags: string[];
    sampleTexts: string[];
    frequency: number;
  }

  const typoGroups = new Map<string, TypoGroup>();

  for (const page of pages) {
    for (const el of page.dom.elements) {
      // Visibility gate (Issue T1 fix). Mirrors the colour-collection
      // loop's gate: hidden modals, off-screen dropdowns, and a11y-only
      // visually-hidden helpers all carry text that contributes
      // nothing to the rendered typography system. dom-collector
      // pre-filters by display/visibility/opacity/zero-rect, but this
      // is defence in depth and matches the colour pass's gate verbatim
      // so the two passes agree on "what's in the typography system".
      if (!isElementVisible(el)) continue;
      // Direct-text gate (Issue T2 fix). Wrapper layouts like
      // <div><div><p>text</p></div></div> have the outer divs report a
      // non-empty `textContent` (which is descendant-aggregated) even
      // though they render no glyphs themselves  the typography
      // contribution belongs to the inner <p>. Using `directText` (text
      // nodes that are IMMEDIATE children only) gates wrappers out
      // cleanly without affecting legitimate inline-text elements like
      // <a> or <em> inside a paragraph (those have their own direct
      // text and contribute separately, which is correct).
      // Fallback to textContent when directText is undefined  legacy
      // captures predating the directText field still flow through.
      const ownText = el.directText !== undefined ? el.directText : el.textContent;
      if (!ownText || ownText.trim().length === 0) continue;

      const rawSize = parsePxValue(el.fontSize);
      if (!rawSize || rawSize <= 0) continue;

      const fontFamily = (el.fontFamily || '').split(',')[0].trim().replace(/["']/g, '');
      const roundedSize = Math.round(rawSize);
      const weight = el.fontWeight || '400';
      // Normalise lineHeight to integer pixels so distinct authored
      // values (24px vs 28px) split cleanly while unit variants
      // ("24px" vs "1.5" on a 16px font) merge correctly. See
      // normalizeLineHeight() for the full unit-handling story.
      const lineHeightPx = normalizeLineHeight(el.lineHeight, rawSize);
      const key = `${fontFamily}|${roundedSize}|${weight}|${lineHeightPx}`;

      const existing = typoGroups.get(key);
      if (existing) {
        existing.frequency++;
        existing.lineHeights.push(el.lineHeight);
        existing.letterSpacings.push(el.letterSpacing);
        if (el.textTransform && el.textTransform !== 'none') {
          existing.textTransforms.push(el.textTransform);
        }
        if (el.fontFeatureSettings && el.fontFeatureSettings !== 'normal') {
          existing.fontFeatureSettings.push(el.fontFeatureSettings);
        }
        if (!existing.tags.includes(el.tag)) existing.tags.push(el.tag);
        if (existing.sampleTexts.length < 3) {
          const sample = el.textContent.trim().slice(0, 80);
          if (!existing.sampleTexts.includes(sample)) {
            existing.sampleTexts.push(sample);
          }
        }
      } else {
        typoGroups.set(key, {
          fontFamily,
          fontSize: roundedSize,
          fontWeight: weight,
          lineHeightPx,
          lineHeights: [el.lineHeight],
          letterSpacings: [el.letterSpacing],
          textTransforms: el.textTransform && el.textTransform !== 'none' ? [el.textTransform] : [],
          fontFeatureSettings: el.fontFeatureSettings && el.fontFeatureSettings !== 'normal'
            ? [el.fontFeatureSettings] : [],
          tags: [el.tag],
          sampleTexts: [el.textContent.trim().slice(0, 80)],
          frequency: 1,
        });
      }
    }
  }

  const typographyLevels: TypographyLevel[] = Array.from(typoGroups.values())
    .sort((a, b) => b.fontSize - a.fontSize)
    .map((g) => ({
      fontFamily: g.fontFamily,
      fontSize: `${g.fontSize}px`,
      fontWeight: g.fontWeight,
      // Emit the canonical normalised lineHeight as integer px. Within
      // a group all elements have the same lineHeightPx (that's how
      // they grouped), so the value is unambiguous. Replaces the
      // pre-fix `mode(g.lineHeights)` which picked an arbitrary
      // ORIGINAL string from a mixed-unit pool ("24px" vs "1.5") and
      // could surface either form depending on insertion order  the
      // T4 ambiguity that T3's normalisation eliminates.
      lineHeight: `${g.lineHeightPx}px`,
      letterSpacing: mode(g.letterSpacings) ?? 'normal',
      textTransform: g.textTransforms.length > 0 ? mode(g.textTransforms) ?? null : null,
      fontFeatureSettings: g.fontFeatureSettings.length > 0 ? mode(g.fontFeatureSettings) ?? null : null,
      frequency: g.frequency,
      typicalTags: g.tags.slice(0, 5),
      sampleTexts: g.sampleTexts.slice(0, 3),
      confidence: g.frequency === 1 ? 'low' as const : (g.frequency >= 5 ? 'high' as const : 'medium' as const),
    }));

  //  3. Font Info 

  const fontFaces: { family: string; weight: string; style: string; src: string }[] = [];
  const loadedFonts: { family: string; weight: string; style: string }[] = [];
  const googleFontsLinks: string[] = [];
  const seenFontFaces = new Set<string>();
  const seenLoadedFonts = new Set<string>();
  const seenGoogleLinks = new Set<string>();

  for (const page of pages) {
    for (const ff of page.dom.fontInfo.fontFaces) {
      const key = `${ff.family}|${ff.weight}|${ff.style}`;
      if (!seenFontFaces.has(key)) {
        seenFontFaces.add(key);
        fontFaces.push(ff);
      }
    }
    for (const lf of page.dom.fontInfo.loadedFonts) {
      const key = `${lf.family}|${lf.weight}|${lf.style}`;
      if (!seenLoadedFonts.has(key)) {
        seenLoadedFonts.add(key);
        loadedFonts.push({ family: lf.family, weight: lf.weight, style: lf.style });
      }
    }
    for (const link of page.dom.fontInfo.googleFontsLinks) {
      if (!seenGoogleLinks.has(link)) {
        seenGoogleLinks.add(link);
        googleFontsLinks.push(link);
      }
    }
  }

  //  4. Spacing System 

  const spacingValues: number[] = [];
  const maxWidthValues: string[] = [];

  for (const page of pages) {
    for (const el of page.dom.elements) {
      // Visibility gate (Issue S1 fix). Mirrors the colour / typography
      // passes  hidden modals, off-screen dropdowns, and a11y-only
      // visually-hidden helpers carry padding / margin / gap values
      // that contribute nothing to the rendered spacing system. Their
      // values can be off-rhythm (e.g. a hidden tooltip with padding
      // 7px) and dragging them into the GCD pass would lower baseUnit
      // and break the scale calculation.
      if (!isElementVisible(el)) continue;
      const spacingProps = [
        el.paddingTop, el.paddingRight, el.paddingBottom, el.paddingLeft,
        el.marginTop, el.marginRight, el.marginBottom, el.marginLeft,
        el.gap,
      ];
      for (const prop of spacingProps) {
        const px = parsePxValue(prop);
        if (px !== null && px > 0) {
          spacingValues.push(Math.round(px));
        }
      }
      if (el.maxWidth && el.maxWidth !== 'none') {
        maxWidthValues.push(el.maxWidth);
      }
    }
  }

  // Frequency histogram
  const spacingFreq = new Map<number, number>();
  for (const v of spacingValues) {
    spacingFreq.set(v, (spacingFreq.get(v) ?? 0) + 1);
  }

  // Top 20 values by frequency
  const topSpacings = Array.from(spacingFreq.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([val]) => val);

  // Base unit via GCD of top values
  let baseUnit = 4;
  if (topSpacings.length >= 2) {
    let g = topSpacings[0];
    for (let i = 1; i < topSpacings.length; i++) {
      g = gcd(g, topSpacings[i]);
      if (g <= 1) break;
    }
    baseUnit = g >= 2 ? g : 4;
  }

  // Build scale as multiples of base unit present in the data
  const scaleSet = new Set<number>();
  for (const val of spacingFreq.keys()) {
    if (val % baseUnit === 0 && val <= baseUnit * 32) {
      scaleSet.add(val);
    }
  }
  const spacingScale = Array.from(scaleSet).sort((a, b) => a - b);

  // Max content width (Issue S5 fix). The pre-fix code picked mode-of-
  // strings, which lost to "100%" on 5/7 real brands  many small
  // responsive widgets ship max-width:100% while only a few layout
  // containers ship the actual px cap. New decision tree:
  //
  //   1. Among px-like values (px / rem / em that parse to absolute
  //      pixels), prefer the LARGEST that appears at least TWICE. A
  //      repeated px value is almost always the layout cap, used by
  //      the header / footer / main containers in concert.
  //
  //   2. Else fall back to ANY px value, picking the largest. A
  //      single-occurrence concrete px still beats a percentage  it
  //      reflects explicit design intent.
  //
  //   3. Else fall back to mode-of-strings (the pre-fix behaviour) for
  //      the edge case of a truly fluid site that never specifies an
  //      absolute max-width. "100%" is the right answer there.
  //
  // Output is always normalised to "Npx" when a numeric path wins so
  // the value is unambiguous for downstream consumers (matches the
  // lineHeight + spacing-scale emit conventions).
  let maxContentWidth: string | null = null;
  if (maxWidthValues.length > 0) {
    const pxCounts = new Map<number, number>();
    const nonPxFreq = new Map<string, number>();
    for (const mw of maxWidthValues) {
      // Only count CSS absolute-length values as "px-like". `100%`,
      // `fit-content`, `min-content`, `none`, `auto`, `calc(...)` all
      // route to the non-px bucket where mode-of-strings still applies.
      if (/^\d+(\.\d+)?(px|rem|em)$/i.test(mw)) {
        const px = parsePxValue(mw);
        if (px !== null && px > 0) {
          const rounded = Math.round(px);
          pxCounts.set(rounded, (pxCounts.get(rounded) ?? 0) + 1);
          continue;
        }
      }
      nonPxFreq.set(mw, (nonPxFreq.get(mw) ?? 0) + 1);
    }

    // Layer 1: largest px appearing at least twice.
    const repeatedPx = Array.from(pxCounts.entries())
      .filter(([, c]) => c >= 2)
      .sort((a, b) => b[0] - a[0]);
    if (repeatedPx.length > 0) {
      maxContentWidth = `${repeatedPx[0][0]}px`;
    } else if (pxCounts.size > 0) {
      // Layer 2: any px value, largest wins. Single occurrence still
      // beats percentages because a px cap is explicit design intent.
      const largestPx = Math.max(...pxCounts.keys());
      maxContentWidth = `${largestPx}px`;
    } else if (nonPxFreq.size > 0) {
      // Layer 3: only non-px values  pick the most frequent. Same as
      // pre-fix behaviour, only reached when there's no px signal at all.
      maxContentWidth = Array.from(nonPxFreq.entries())
        .sort((a, b) => b[1] - a[1])[0][0];
    }
  }

  // Section spacing: large gap values (>= 48px)
  const sectionSpacingSet = new Set<number>();
  for (const [val, freq] of spacingFreq.entries()) {
    if (val >= 48 && freq >= 2) {
      sectionSpacingSet.add(val);
    }
  }
  const sectionSpacing = Array.from(sectionSpacingSet).sort((a, b) => a - b);

  const frequencyMap: Record<number, number> = {};
  for (const [val, freq] of spacingFreq.entries()) {
    frequencyMap[val] = freq;
  }

  //  5. Shadow System

  const shadowFreq = new Map<string, { value: string; frequency: number; elements: string[] }>();

  for (const page of pages) {
    for (const el of page.dom.elements) {
      // Visibility gate (Issue SH1 fix). Mirrors colour / typography /
      // spacing / radius passes. Hidden modals' shadow chrome
      // contributes nothing visible to the rendered shadow system.
      if (!isElementVisible(el)) continue;
      // Strip Tailwind v4 preflight placeholder layers (Issue SH3 fix).
      // Tailwind ships four shadow CSS variables that default to
      // `0 0 #0000` (transparent, all-zero); the computed boxShadow
      // value concatenates all four even when only one is used. The
      // normaliser drops invisible layers so tokens.json shows just
      // the design-intent shadow content. Returns null when every
      // layer is invisible (functionally equivalent to "none").
      const shadow = normalizeShadowValue(el.boxShadow);
      if (!shadow) continue;

      const existing = shadowFreq.get(shadow);
      if (existing) {
        existing.frequency++;
        if (existing.elements.length < 5 && !existing.elements.includes(el.tag)) {
          existing.elements.push(el.tag);
        }
      } else {
        shadowFreq.set(shadow, { value: shadow, frequency: 1, elements: [el.tag] });
      }
    }
  }

  function classifyShadow(value: string): ShadowToken['type'] {
    // Split on commas OUTSIDE parentheses to handle rgba(r,g,b,a) correctly
    const parts = splitShadowLayers(value);
    if (parts.length > 1) return 'complex-stack';
    if (value.includes('inset')) return 'inset';

    // Remove color portions for analysis
    const cleaned = value
      .replace(/rgba?\([^)]+\)/g, '')
      .replace(/hsla?\([^)]+\)/g, '')
      .replace(/#[0-9a-fA-F]{3,8}/g, '')
      .trim();

    const nums = cleaned.match(/-?\d+(\.\d+)?(px)?/g)?.map((n) => parseFloat(n)) ?? [];
    // box-shadow: offsetX offsetY blur spread
    const offsetX = nums[0] ?? 0;
    const offsetY = nums[1] ?? 0;
    const blur = nums[2] ?? 0;
    const spread = nums[3] ?? 0;

    if (offsetX === 0 && offsetY === 0 && blur === 0 && spread > 0) return 'border-shadow';
    if (offsetX === 0 && offsetY === 0 && blur === 0 && spread !== 0) return 'ring';
    if (offsetY > 0 && blur > 0) return 'elevation';

    return 'elevation';
  }

  function shadowIntensity(value: string): number {
    const cleaned = value
      .replace(/rgba?\([^)]+\)/g, '')
      .replace(/hsla?\([^)]+\)/g, '')
      .replace(/#[0-9a-fA-F]{3,8}/g, '')
      .trim();
    const nums = cleaned.match(/-?\d+(\.\d+)?(px)?/g)?.map((n) => parseFloat(n)) ?? [];
    const blur = Math.abs(nums[2] ?? 0);
    return blur;
  }

  const shadowTokens: ShadowToken[] = Array.from(shadowFreq.values())
    .sort((a, b) => shadowIntensity(b.value) - shadowIntensity(a.value))
    .map((s) => ({
      value: s.value,
      frequency: s.frequency,
      type: classifyShadow(s.value),
      typicalElements: s.elements,
    }));

  //  6. Radius System

  const radiusFreq = new Map<string, { value: string; frequency: number; elements: string[] }>();

  for (const page of pages) {
    for (const el of page.dom.elements) {
      // Visibility gate (Issue R1 fix). Mirrors the colour / typography /
      // spacing passes. Hidden modals' rounded chrome contributes
      // nothing visible to the rendered radius system.
      if (!isElementVisible(el)) continue;
      // Normalise the value (Issue R8 / R9 fix). normalizeBorderRadius
      // collapses rem-derived sub-pixel drift into integer-px buckets,
      // filters extreme outliers (`3.35544e+07px` from calc()-overflow
      // sentinels), drops all-zero shorthands, and preserves genuine
      // asymmetric corners + percentage / pill values verbatim.
      const radius = normalizeBorderRadius(el.borderRadius);
      if (!radius) continue;

      const existing = radiusFreq.get(radius);
      if (existing) {
        existing.frequency++;
        if (existing.elements.length < 5 && !existing.elements.includes(el.tag)) {
          existing.elements.push(el.tag);
        }
      } else {
        radiusFreq.set(radius, { value: radius, frequency: 1, elements: [el.tag] });
      }
    }
  }

  const radiusTokens: RadiusToken[] = Array.from(radiusFreq.values())
    .sort((a, b) => b.frequency - a.frequency)
    .map((r) => ({
      value: r.value,
      frequency: r.frequency,
      typicalElements: r.elements,
    }));

  //  7. Component Identification 

  interface IdentifiedComponent {
    type: string;
    element: ElementStyle;
    pageUrl: string;
    // The crawler can revisit the same URL (input URL + rediscovered
    // links → duplicate entries with `pageUrl` equal but separate DOM
    // walks). nodeIds reset per visit, so URL alone is not enough to look
    // up the right page's screenshots / parent map. pageIndex is unique.
    pageIndex: number;
  }

  const identified: IdentifiedComponent[] = [];

  for (const [pageIndex, page] of pages.entries()) {
    const pageHeight = Math.max(
      ...page.dom.elements.map((el) => el.rect.y + el.rect.height),
      1000,
    );

    for (const el of page.dom.elements) {
      // Visibility gate (Issue C1 fix). Mirrors the gate on every
      // other pass in this file (colour / typography / spacing /
      // radius / shadow). dom-collector already pre-filters display
      // none / visibility:hidden / opacity:0 / zero-rect at line 206
      // 209, so this is defence in depth rather than an observable
      // behaviour change today  but it keeps all six passes agreeing
      // on the same definition of "in the system" and protects against
      // future dom-collector changes that loosen the upstream filter.
      if (!isElementVisible(el)) continue;
      const bg = parseColor(el.backgroundColor);
      const hasBg = bg !== null && bg.a > 0.05;
      const padding = Math.min(
        parsePxValue(el.paddingTop) ?? 0,
        parsePxValue(el.paddingRight) ?? 0,
        parsePxValue(el.paddingBottom) ?? 0,
        parsePxValue(el.paddingLeft) ?? 0,
      );
      const hasShadowOrBorder =
        (el.boxShadow && el.boxShadow !== 'none') ||
        (parseFloat(el.borderTopWidth) > 0 && el.borderStyle !== 'none');
      const radiusPx = parsePxValue(el.borderRadius) ?? 0;

      // Button
      if (
        el.tag === 'button' ||
        el.role === 'button' ||
        (el.tag === 'a' && hasBg && radiusPx > 0 && padding >= 4)
      ) {
        identified.push({ type: 'Button', element: el, pageUrl: page.url, pageIndex });
        continue;
      }

      // Input
      if (el.tag === 'input' || el.tag === 'textarea' || el.tag === 'select') {
        identified.push({ type: 'Input', element: el, pageUrl: page.url, pageIndex });
        continue;
      }

      // Navigation
      if (
        el.tag === 'nav' ||
        (el.position === 'sticky' || el.position === 'fixed') &&
          (el.tag === 'header' || el.rect.y < 10)
      ) {
        identified.push({ type: 'Navigation', element: el, pageUrl: page.url, pageIndex });
        continue;
      }

      // Badge
      if (radiusPx >= 100 && el.rect.height < 30 && hasBg) {
        identified.push({ type: 'Badge', element: el, pageUrl: page.url, pageIndex });
        continue;
      }

      // Hero
      const fontSize = parsePxValue(el.fontSize) ?? 0;
      if (el.rect.y < 100 && fontSize >= 32 && el.rect.height > 300) {
        identified.push({ type: 'Hero', element: el, pageUrl: page.url, pageIndex });
        continue;
      }

      // PricingTier — must be checked BEFORE Card, because every pricing
      // tier is also card-shaped and we want it in its own group. The
      // flag is set by dom-collector when the element has card chrome
      // + a price signal + a list + a CTA descendant.
      if (el.isPricingTierCandidate) {
        identified.push({
          type: 'PricingTier',
          element: el,
          pageUrl: page.url,
          pageIndex,
        });
        continue;
      }

      // Card
      if (
        (hasShadowOrBorder || hasBg) &&
        radiusPx > 0 &&
        padding >= 12 &&
        el.childrenCount >= 2 &&
        el.rect.width >= 200 &&
        el.rect.width <= 800
      ) {
        identified.push({ type: 'Card', element: el, pageUrl: page.url, pageIndex });
        continue;
      }

      // Link
      if (el.tag === 'a' && !hasBg) {
        identified.push({ type: 'Link', element: el, pageUrl: page.url, pageIndex });
        continue;
      }

      // Footer
      if (
        el.tag === 'footer' ||
        (el.rect.y > pageHeight * 0.8 && el.childrenCount >= 3 && el.tag === 'div')
      ) {
        identified.push({ type: 'Footer', element: el, pageUrl: page.url, pageIndex });
      }
    }
  }

  //  Variant Detection 

  // Names the type-aware classifier may emit. Used by the per-type variant-
  // counter rewrite below to decide which returns are "real" labels and
  // which need a Variant-N fallback. Anything not in this set falls back.
  const RECOGNIZED_VARIANT_NAMES = new Set([
    // Button surface treatment
    'Primary', 'Secondary', 'Ghost', 'Destructive',
    // Card / PricingTier surface treatment
    'Outlined', 'Elevated', 'Filled', 'Featured',
    // Badge semantic hue
    'Success', 'Warning', 'Error', 'Info', 'Brand', 'Neutral',
    // Single-instance types (Hero / Footer / Navigation / Input / Link)
    'Default',
  ]);

  /**
   * Button surface treatment: Primary / Secondary / Ghost / Destructive by
   * background luminance + text contrast. button-cluster.ts replaces this
   * downstream with OKLCH-ΔE clustering on (bg, text, border); we keep the
   * simple classifier here for non-SPA CLI runs that don't run button-cluster.
   */
  function classifyButtonVariant(el: ElementStyle): string {
    const bg = parseColor(el.backgroundColor);
    const text = parseColor(el.color);

    // Transparent bg → Ghost
    if (!bg || bg.a < 0.05) return 'Ghost';

    const bgLum = bg ? relativeLuminance(bg.r, bg.g, bg.b) : 1;
    const textLum = text ? relativeLuminance(text.r, text.g, text.b) : 0;

    // Red-ish bg → Destructive
    if (bg && bg.r > 180 && bg.g < 100 && bg.b < 100) return 'Destructive';

    // Dark bg + light text → Primary
    if (bgLum < 0.3 && textLum > 0.5) return 'Primary';

    // Light/white bg + dark text + border/shadow → Secondary
    const hasShadowOrBorder =
      (el.boxShadow && el.boxShadow !== 'none') ||
      parseFloat(el.borderTopWidth) > 0;
    if (bgLum > 0.7 && textLum < 0.4 && hasShadowOrBorder) return 'Secondary';

    return 'Primary';
  }

  /**
   * Surface-treatment variants for Card / PricingTier — types where multiple
   * visual variants are meaningful on real sites (feature vs pricing vs
   * testimonial cards; default vs featured tiers).
   *
   *   - Featured: chromatic bg (saturated, mid-luminance). Sites typically
   *               paint a featured tier or highlighted card with brand hue.
   *   - Outlined: border-only, no fill.
   *   - Elevated: solid bg + box-shadow (raised surface).
   *   - Filled:   solid bg, no shadow.
   *   - Default:  no distinguishing surface treatment.
   *
   * Checked BEFORE Outlined so a chromatic card with a border still scores
   * as "Featured" rather than collapsing into "Outlined".
   */
  function classifySurfaceVariant(el: ElementStyle): string {
    const bg = parseColor(el.backgroundColor);
    const hasBg = bg !== null && bg.a > 0.5;
    const hasBorder =
      parseFloat(el.borderTopWidth) > 0 && el.borderStyle !== 'none';
    const hasShadow = !!el.boxShadow && el.boxShadow !== 'none';

    if (hasBg && bg) {
      const max = Math.max(bg.r, bg.g, bg.b);
      const min = Math.min(bg.r, bg.g, bg.b);
      const sat = max > 0 ? (max - min) / max : 0;
      const lum = relativeLuminance(bg.r, bg.g, bg.b);
      // Saturated AND not near-white/near-black → featured/highlighted
      if (sat > 0.25 && lum > 0.1 && lum < 0.85) return 'Featured';
    }
    if (hasBorder && !hasBg) return 'Outlined';
    if (hasBg && hasShadow) return 'Elevated';
    if (hasBg) return 'Filled';
    return 'Default';
  }

  /**
   * Semantic-hue variants for Badge — small chips that usually carry status
   * meaning. Reuses the clusterTokens-scope `toOklch` converter so hue
   * values are consistent with the color-clustering pass.
   *
   *   < 0.05 chroma   → Neutral (matches role-namer's low-chroma boundary)
   *   0°..30°, 350°..360° → Error (red band)
   *   30°..100°       → Warning (orange / yellow)
   *   100°..180°      → Success (green / teal)
   *   180°..250°      → Info (blue / cyan)
   *   250°..350°      → Brand (purple / pink — typically brand badges)
   */
  function classifyHueVariant(el: ElementStyle): string {
    const bg = parseColor(el.backgroundColor);
    if (!bg || bg.a < 0.05) return 'Default';

    const rgb = { mode: 'rgb' as const, r: bg.r / 255, g: bg.g / 255, b: bg.b / 255 };
    const ok = toOklch(rgb) as { c?: number; h?: number } | null;
    if (!ok || !Number.isFinite(ok.c) || (ok.c ?? 0) < 0.05) return 'Neutral';

    const h = Number.isFinite(ok.h) ? (ok.h as number) : 0;
    if (h < 30 || h >= 350) return 'Error';
    if (h < 100) return 'Warning';
    if (h < 180) return 'Success';
    if (h < 250) return 'Info';
    return 'Brand';
  }

  /**
   * Top-level variant classifier — dispatches by component type because the
   * meaningful axis-of-variation differs:
   *
   *   - Button:           surface treatment (Primary/Secondary/Ghost/Destructive)
   *   - Card/PricingTier: surface treatment (Outlined/Elevated/Filled/Featured)
   *   - Badge:            semantic hue (Success/Warning/Error/Info/Brand/Neutral)
   *   - Everything else:  'Default'
   *
   * Previously every type funneled through the Button classifier, so Heroes,
   * Footers, Navigations, etc. all got Primary/Secondary/Ghost/Destructive
   * labels — meaningless for those types. Even Cards (where multiple variants
   * ARE meaningful) ended up with names that didn't reflect the visual
   * distinction.
   */
  function classifyVariant(el: ElementStyle, type: string): string {
    if (type === 'Button') return classifyButtonVariant(el);
    if (type === 'Card' || type === 'PricingTier') return classifySurfaceVariant(el);
    if (type === 'Badge') return classifyHueVariant(el);
    return 'Default';
  }

  // Group by component type, then by variant. `pageIndexes` mirrors
  // `pageUrls` order: pageIndexes[0] is the page where elements[0] was
  // first seen — the lookup key for the composed-component screenshot
  // and parent-map indexes.
  const componentTypeGroups = new Map<
    string,
    Map<
      string,
      {
        count: number;
        elements: ElementStyle[];
        pageUrls: string[];
        pageIndexes: number[];
      }
    >
  >();

  for (const comp of identified) {
    if (!componentTypeGroups.has(comp.type)) {
      componentTypeGroups.set(comp.type, new Map());
    }
    const variants = componentTypeGroups.get(comp.type)!;
    const variantName = classifyVariant(comp.element, comp.type);

    const existing = variants.get(variantName);
    if (existing) {
      existing.count++;
      if (existing.elements.length < 3) {
        existing.elements.push(comp.element);
        existing.pageIndexes.push(comp.pageIndex);
      } else {
        // Maintain top-3 by visual score across ALL instances site-wide,
        // not just the first 3 in DOM walk order. Without this, a sidebar
        // widget crawled early can shadow a hero card crawled later when
        // both fall into the same variant bucket. Replace the lowest-scored
        // kept element if the incoming one beats it. The `representative =
        // elements[bestIdx]` selection below picks the highest of the
        // surviving three.
        const newScore = elementVisualScore(comp.element);
        let minIdx = 0;
        let minScore = elementVisualScore(existing.elements[0]);
        for (let i = 1; i < existing.elements.length; i++) {
          const s = elementVisualScore(existing.elements[i]);
          if (s < minScore) { minScore = s; minIdx = i; }
        }
        if (newScore > minScore) {
          existing.elements[minIdx] = comp.element;
          existing.pageIndexes[minIdx] = comp.pageIndex;
        }
      }
      if (!existing.pageUrls.includes(comp.pageUrl)) existing.pageUrls.push(comp.pageUrl);
    } else {
      variants.set(variantName, {
        count: 1,
        elements: [comp.element],
        pageUrls: [comp.pageUrl],
        pageIndexes: [comp.pageIndex],
      });
    }
  }

  // Build interaction lookup
  const interactionLookup = new Map<string, InteractionCapture>();
  for (const page of pages) {
    if (!page.interactions) continue;
    for (const capture of page.interactions.captures) {
      const key = `${capture.element.tag}|${capture.element.classes}|${capture.componentType}`;
      interactionLookup.set(key, capture);
    }
  }

  function findInteraction(el: ElementStyle): InteractionCapture | undefined {
    const key1 = `${el.tag}|${el.className}|${el.tag}`;
    if (interactionLookup.has(key1)) return interactionLookup.get(key1);
    // Try matching by tag and partial class
    for (const [, cap] of interactionLookup) {
      if (cap.element.tag === el.tag && el.className.includes(cap.element.classes)) {
        return cap;
      }
    }
    return undefined;
  }

  // Per-page indexes used by the composed-component pass below. Keyed by
  // PAGE INDEX (not URL): the crawler can revisit the same URL twice (input
  // URL + rediscovered link → two entries with identical `pe.url`), and
  // nodeIds reset per visit. A URL-keyed map silently drops the first
  // visit's data via Map overwrite; pageIndex is unique by construction.
  const COMPOSED_TYPES = new Set(['Card', 'PricingTier']);
  const parentMapsByPageIndex = new Map<number, Map<number, ElementStyle[]>>();
  const screenshotsByPageIndex = new Map<number, ComponentScreenshots>();
  for (const [pageIndex, pe] of pages.entries()) {
    const childrenMap = new Map<number, ElementStyle[]>();
    for (const el of pe.dom.elements) {
      if (
        typeof el.parentNodeId === 'number' &&
        el.parentNodeId >= 0
      ) {
        const siblings = childrenMap.get(el.parentNodeId) ?? [];
        siblings.push(el);
        childrenMap.set(el.parentNodeId, siblings);
      }
    }
    parentMapsByPageIndex.set(pageIndex, childrenMap);
    if (pe.componentScreenshots) {
      screenshotsByPageIndex.set(pageIndex, pe.componentScreenshots);
    }
  }

  const components: ComponentGroup[] = [];

  for (const [type, variants] of componentTypeGroups) {
    const variantList: ComponentVariant[] = [];

    // Deduplicate variant names with counter for non-standard names
    let variantCounter = 1;

    for (const [name, data] of variants) {
      // Pick the highest-scored of the kept (top-3-by-score) elements as the
      // representative. Both the variant style snapshot and the composed-
      // component lookups (tree + screenshot) use this index, so they all
      // come from the same most-prominent instance.
      let bestIdx = 0;
      let bestScore = elementVisualScore(data.elements[0]);
      for (let i = 1; i < data.elements.length; i++) {
        const s = elementVisualScore(data.elements[i]);
        if (s > bestScore) { bestScore = s; bestIdx = i; }
      }
      const representative = data.elements[bestIdx];
      const interaction = findInteraction(representative);

      const style: Record<string, string> = {
        backgroundColor: representative.backgroundColor,
        color: representative.color,
        fontSize: representative.fontSize,
        fontWeight: representative.fontWeight,
        borderRadius: representative.borderRadius,
        padding: `${representative.paddingTop} ${representative.paddingRight} ${representative.paddingBottom} ${representative.paddingLeft}`,
      };
      if (representative.boxShadow !== 'none') {
        style.boxShadow = representative.boxShadow;
      }
      if (parseFloat(representative.borderTopWidth) > 0) {
        style.borderWidth = representative.borderTopWidth;
        style.borderColor = representative.borderTopColor;
        style.borderStyle = representative.borderStyle;
      }

      const sampleTexts = data.elements
        .map((e) => e.textContent.trim().slice(0, 40))
        .filter((t) => t.length > 0)
        .slice(0, 3);

      const displayName = RECOGNIZED_VARIANT_NAMES.has(name)
        ? name
        : `Variant-${variantCounter++}`;

      // Composed-component augmentation: build the descendant tree and
      // attach the source-page screenshot URL. `pageIndexes[bestIdx]` is the
      // page where the chosen representative was first seen — using
      // pageIndex (not URL) avoids the duplicate-URL collision where Map.set
      // would overwrite one visit's screenshots with another's. Both lookups
      // are best-effort — if either fails the variant still ships, just
      // without the rich preview.
      let tree: ComponentNode | undefined;
      let screenshotUrl: string | undefined;
      if (COMPOSED_TYPES.has(type)) {
        const pageIndex = data.pageIndexes[bestIdx];
        const childrenMap = parentMapsByPageIndex.get(pageIndex);
        if (childrenMap) {
          tree = buildComponentTree(representative, childrenMap);
        }
        if (typeof representative.nodeId === 'number') {
          const pageShots = screenshotsByPageIndex.get(pageIndex);
          const info = pageShots?.[representative.nodeId];
          if (info) screenshotUrl = info.url;
        }
      }

      variantList.push({
        name: displayName,
        count: data.count,
        style,
        hoverChanges: interaction?.hoverDiff ?? null,
        focusVisibleChanges: interaction?.focusVisibleDiff ?? null,
        focusChanges: interaction?.focusDiff ?? null,
        activeChanges: interaction?.activeDiff ?? null,
        disabledStyle: interaction?.disabledStyle ?? null,
        transition: interaction?.transition ?? (representative.transition || null),
        sampleTexts,
        ...(tree ? { tree } : {}),
        ...(screenshotUrl ? { screenshotUrl } : {}),
      });
    }

    variantList.sort((a, b) => b.count - a.count);
    components.push({ type, variants: variantList });
  }

  components.sort((a, b) => {
    const totalA = a.variants.reduce((sum, v) => sum + v.count, 0);
    const totalB = b.variants.reduce((sum, v) => sum + v.count, 0);
    return totalB - totalA;
  });

  //  8. Layout Patterns 

  const columnCounts = new Set<number>();
  for (const page of pages) {
    for (const el of page.dom.elements) {
      if (!isElementVisible(el)) continue;
      if (el.gridTemplateColumns && el.gridTemplateColumns !== 'none') {
        const cols = countGridColumns(el.gridTemplateColumns);
        if (cols > 0) columnCounts.add(cols);
      }
    }
  }

  // Content alignment detection.
  //
  // Restrict to semantic layout-section tags. The previous version of this
  // loop ran across *every* element, so `fullWidthCount` was effectively
  // "count of block-level elements on the page"  thousands of <div> /
  // <p> / <li> inner content drowning out the actual page-level wrappers
  // and forcing nearly every site to classify as 'full-width' or 'mixed'.
  // Semantic-section filter focuses on the elements that actually express
  // page-layout intent. Visibility gate keeps hidden modals / drawers
  // from contributing (consistency with column-counting loop above).
  const layoutSectionTags = new Set([
    'main', 'section', 'header', 'footer', 'nav', 'article', 'aside',
  ]);
  let centeredCount = 0;
  let fullWidthCount = 0;
  for (const page of pages) {
    for (const el of page.dom.elements) {
      if (!isElementVisible(el)) continue;
      if (!layoutSectionTags.has(el.tag)) continue;
      const mwVal = parsePxValue(el.maxWidth);
      const hasAutoMargin = el.marginLeft === 'auto' || el.marginRight === 'auto';
      // 3000px upper bound for "centered". Real production wrappers
      // routinely run 1760-2520px (Airbnb is 2520; large marketing
      // pages 1920+). The previous 2000px cap misclassified these as
      // 'full-width' even though margin: auto + a finite max-width
      // are the textbook definition of a centered layout. Anything
      // >= 3000px is effectively edge-to-edge on any real monitor.
      if (mwVal && mwVal > 0 && mwVal < 3000 && hasAutoMargin) {
        centeredCount++;
      } else if (el.display === 'block' && (!mwVal || mwVal >= 3000)) {
        fullWidthCount++;
      }
    }
  }

  let contentAlignment: 'centered' | 'full-width' | 'mixed' = 'mixed';
  if (centeredCount > fullWidthCount * 3) contentAlignment = 'centered';
  else if (fullWidthCount > centeredCount * 3) contentAlignment = 'full-width';

  const layoutPatterns = {
    maxContentWidth,
    commonColumnCounts: Array.from(columnCounts).sort((a, b) => a - b),
    sectionSpacing,
    contentAlignment,
  };

  //  9. Cross-page Consistency 

  const varByPage = new Map<string, Map<string, string>>();
  for (const page of pages) {
    const pageVars = new Map<string, string>();
    for (const v of page.dom.cssVariables) {
      pageVars.set(v.name, v.value);
    }
    varByPage.set(page.url, pageVars);
  }

  const allVarNames = new Set<string>();
  for (const [, vars] of varByPage) {
    for (const name of vars.keys()) allVarNames.add(name);
  }

  const consistent: { token: string; value: string; pages: string[] }[] = [];
  const inconsistent: { token: string; values: { value: string; pages: string[] }[] }[] = [];

  for (const name of allVarNames) {
    const valuePages = new Map<string, string[]>();
    for (const [url, vars] of varByPage) {
      const val = vars.get(name);
      if (val !== undefined) {
        if (!valuePages.has(val)) valuePages.set(val, []);
        valuePages.get(val)!.push(url);
      }
    }

    if (valuePages.size === 1) {
      const [value, pgs] = Array.from(valuePages.entries())[0];
      consistent.push({ token: name, value, pages: pgs });
    } else if (valuePages.size > 1) {
      inconsistent.push({
        token: name,
        values: Array.from(valuePages.entries()).map(([value, pgs]) => ({ value, pages: pgs })),
      });
    }
  }

  //  10. Gradient Aggregation 

  const gradients: { type: string; value: string; elementTag: string; location: string }[] = [];
  const seenGradients = new Set<string>();

  for (const page of pages) {
    for (const g of page.dom.gradients) {
      const key = `${g.type}|${g.value}`;
      if (seenGradients.has(key)) continue;
      seenGradients.add(key);

      let location = 'decorative';
      if (g.rect.y < 100 && g.rect.height > 200) {
        location = 'hero';
      } else if (g.elementTag === 'button' || g.elementTag === 'a') {
        location = 'button';
      } else if (
        g.rect.width >= 200 &&
        g.rect.width <= 800 &&
        g.rect.height >= 100
      ) {
        location = 'card';
      }

      gradients.push({
        type: g.type,
        value: g.value,
        elementTag: g.elementTag,
        location,
      });
    }
  }

  //  Breakpoints 

  const breakpointMap = new Map<string, MediaBreakpoint>();
  for (const page of pages) {
    if (!page.css) continue;
    for (const bp of page.css.mediaBreakpoints) {
      const key = `${bp.type}|${bp.value}`;
      const existing = breakpointMap.get(key);
      if (existing) {
        existing.ruleCount += bp.ruleCount;
      } else {
        breakpointMap.set(key, { ...bp });
      }
    }
  }
  const breakpoints = Array.from(breakpointMap.values()).sort((a, b) => {
    const aVal = parseFloat(a.value) || 0;
    const bVal = parseFloat(b.value) || 0;
    return aVal - bVal;
  });

  //  A11y Tokens (basic) 

  // Focus indicator: check pseudo-class rules for :focus-visible
  let focusStyle: Record<string, string> = {};
  let focusConsistent = true;
  const focusStyles: string[] = [];

  for (const page of pages) {
    if (!page.css) continue;
    for (const rule of page.css.pseudoClassRules) {
      if (rule.pseudoClass === ':focus-visible' || rule.pseudoClass === ':focus') {
        const outline = rule.properties['outline'] || rule.properties['box-shadow'] || '';
        if (outline) focusStyles.push(outline);
        if (Object.keys(focusStyle).length === 0) {
          focusStyle = { ...rule.properties };
        }
      }
    }
  }

  if (focusStyles.length > 1) {
    const unique = new Set(focusStyles);
    focusConsistent = unique.size <= 2;
  }

  // Min touch target and font size
  let minTouchWidth = Infinity;
  let minTouchHeight = Infinity;
  let minFontSize = Infinity;

  for (const page of pages) {
    for (const el of page.dom.elements) {
      if (el.tag === 'button' || el.tag === 'a' || el.tag === 'input' || el.role === 'button') {
        if (el.rect.width > 0 && el.rect.width < minTouchWidth) minTouchWidth = el.rect.width;
        if (el.rect.height > 0 && el.rect.height < minTouchHeight) minTouchHeight = el.rect.height;
      }
      const fs = parsePxValue(el.fontSize);
      if (fs && fs > 0 && fs < minFontSize) minFontSize = fs;
    }
  }

  // A11y contrast pairs from the color tokens
  const a11yContrastPairs = contrastPairs.slice(0, 20).map((cp) => ({
    foreground: cp.foreground,
    background: cp.background,
    ratio: cp.contrastRatio,
    meetsAA: cp.meetsAA,
    meetsAAA: cp.meetsAAA,
    usageCount: cp.usageCount,
  }));

  const a11yTokens = {
    focusIndicator: {
      style: focusStyle,
      consistent: focusConsistent,
    },
    contrastPairs: a11yContrastPairs,
    minTouchTarget: {
      width: minTouchWidth === Infinity ? 44 : Math.round(minTouchWidth),
      height: minTouchHeight === Infinity ? 44 : Math.round(minTouchHeight),
    },
    minFontSize: minFontSize === Infinity ? '16px' : `${Math.round(minFontSize)}px`,
  };

  //  Total Elements 

  const totalElements = pages.reduce((sum, p) => sum + p.dom.elements.length, 0);

  //  Assemble Final Tokens 

  const result: DesignTokens = {
    meta: {
      sourceUrls: pages.map((p) => p.url),
      totalPages,
      extractionDate: new Date().toISOString(),
      framework: { tailwind: null, uiFramework: null, designSystemUrl: null },
      totalElements,
      extractionTime: 0,
    },

    colorTokens,

    colorRelationships: {
      scales,
      contrastPairs,
    },

    typographyLevels,

    fontInfo: {
      fontFaces,
      loadedFonts,
      googleFontsLinks,
    },

    spacingSystem: {
      baseUnit,
      scale: spacingScale,
      frequencyMap,
      maxContentWidth,
      sectionSpacing,
    },

    shadowTokens,
    radiusTokens,
    components,
    layoutPatterns,

    iconSystem: null,
    motionSystem: null,
    a11yTokens,

    darkMode: {
      supported: false,
      detectionMethod: 'none',
      lightVariables: [],
      darkVariables: [],
      variableDiff: [],
      darkScreenshots: null,
    },

    breakpoints,

    gradients,

    consistency: {
      consistent,
      inconsistent,
    },

    cssVariables,
  };

  //  Stability Classification Pass 
  classifyTokenStability(result);

  return result;
}

//  Incremental Merge 

/** Merge incoming tokens into an existing set, deduplicating by perceptual similarity */
export function mergeTokenSets(existing: DesignTokens, incoming: DesignTokens): DesignTokens {
  // @ts-expect-error culori has no bundled declarations in this setup
  const toOklch = (culori as typeof import('culori')).converter('oklch');

  //  Color merge: delta-E < 3 → combine frequencies 
  const mergedColors = [...existing.colorTokens];

  for (const ic of incoming.colorTokens) {
    const icRgb = { mode: 'rgb' as const, r: ic.rgba[0] / 255, g: ic.rgba[1] / 255, b: ic.rgba[2] / 255 };
    const icOklch = toOklch(icRgb);
    let matched = false;

    if (icOklch) {
      for (const ec of mergedColors) {
        const ecRgb = { mode: 'rgb' as const, r: ec.rgba[0] / 255, g: ec.rgba[1] / 255, b: ec.rgba[2] / 255 };
        const ecOklch = toOklch(ecRgb);
        if (ecOklch && deltaE(
          { l: icOklch.l ?? 0, c: icOklch.c ?? 0, h: icOklch.h ?? 0 },
          { l: ecOklch.l ?? 0, c: ecOklch.c ?? 0, h: ecOklch.h ?? 0 },
        ) < 3) {
          // Merge into existing
          ec.frequency += ic.frequency;
          for (const [ctx, count] of Object.entries(ic.usedAs)) {
            (ec.usedAs as Record<string, number>)[ctx] = ((ec.usedAs as Record<string, number>)[ctx] ?? 0) + count;
          }
          for (const v of ic.cssVariableNames) {
            if (!ec.cssVariableNames.includes(v)) ec.cssVariableNames.push(v);
          }
          matched = true;
          break;
        }
      }
    }
    if (!matched) {
      mergedColors.push({ ...ic });
    }
  }
  mergedColors.sort((a, b) => b.frequency - a.frequency);

  //  Typography merge: key = family|size|weight 
  const typoMap = new Map<string, TypographyLevel>();
  for (const t of existing.typographyLevels) {
    typoMap.set(`${t.fontFamily}|${t.fontSize}|${t.fontWeight}`, t);
  }
  for (const t of incoming.typographyLevels) {
    const key = `${t.fontFamily}|${t.fontSize}|${t.fontWeight}`;
    const ex = typoMap.get(key);
    if (ex) {
      ex.frequency += t.frequency;
    } else {
      typoMap.set(key, { ...t });
    }
  }
  const mergedTypo = Array.from(typoMap.values()).sort((a, b) => {
    const sizeA = parseFloat(a.fontSize);
    const sizeB = parseFloat(b.fontSize);
    return sizeB - sizeA;
  });

  //  Shadow merge: exact value match 
  const shadowMap = new Map<string, ShadowToken>();
  for (const s of existing.shadowTokens) shadowMap.set(s.value, s);
  for (const s of incoming.shadowTokens) {
    const ex = shadowMap.get(s.value);
    if (ex) {
      ex.frequency += s.frequency;
    } else {
      shadowMap.set(s.value, { ...s });
    }
  }
  const mergedShadows = Array.from(shadowMap.values()).sort((a, b) => b.frequency - a.frequency);

  //  Radius merge: exact value match 
  const radiusMap = new Map<string, RadiusToken>();
  for (const r of existing.radiusTokens) radiusMap.set(r.value, r);
  for (const r of incoming.radiusTokens) {
    const ex = radiusMap.get(r.value);
    if (ex) {
      ex.frequency += r.frequency;
    } else {
      radiusMap.set(r.value, { ...r });
    }
  }
  const mergedRadius = Array.from(radiusMap.values()).sort((a, b) => b.frequency - a.frequency);

  return {
    ...incoming,
    colorTokens: mergedColors,
    typographyLevels: mergedTypo,
    shadowTokens: mergedShadows,
    radiusTokens: mergedRadius,
    // Keep incoming's other fields (components, layout, etc.)
    // as they represent the latest extraction
  };
}
