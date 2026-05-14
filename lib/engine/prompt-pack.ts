// Prompt-pack emitter  the SPA's Phase 2 wiring.
//
// Emits a self-contained "build UI from this design system" prompt the user
// can paste into ANY agent surface (Claude.ai, ChatGPT, Cursor, Codex,
// Windsurf, Lovable, Replit Agent, v0, Copilot) and get UI that follows the
// extracted brand instead of generic AI output.
//
// This is the BUILD prompt, not the "write me a DESIGN.md" prompt. The
// deterministic DESIGN.md emitter (lib/engine/design-md-emit.ts) already
// produces the documentation artifact alongside this. The universal prompt
// is what the user pastes when they want to build a pricing page that
// LOOKS like the extracted site, not commission a 300-line spec doc.
//
// Output: ~50–80 lines of markdown. Top 10 named colors (L1+L2 stability),
// top 8 typography levels, spacing scale, radius scale, shadow scale,
// then "how to use this" + 4 example prompts + cardinal rule for the agent.

import * as fs from 'fs';
import * as path from 'path';
import type {
  ColorToken,
  DesignTokens,
  RadiusToken,
  ShadowToken,
} from './types';
import {
  assignColorRoles,
  assignTypeRoles,
  rolePriority,
  type ColorRole,
  type NamedColor,
  type NamedType,
  type TypeRole,
} from './role-namer';

//  Usage hints (what each role is for) 
// Short phrase per role so the agent reads "Primary  main CTAs, focused
// state" instead of just "Primary #635bff". Helps the model pick the right
// token for each component without guessing.

const COLOR_USAGE_HINTS: Record<NonNullable<ColorRole>, string> = {
  primary: 'main CTAs, focused state, primary buttons',
  'on-primary': 'text/icon on primary backgrounds',
  ink: 'body text',
  muted: 'secondary text, placeholders, captions',
  canvas: 'page background',
  'canvas-alt': 'section / card background',
  hairline: 'borders, dividers',
  accent: 'highlights, badges, secondary CTAs',
  'brand-dark': 'headers, nav, dense surfaces',
  'brand-soft': 'hover / active variants, soft fills',
  success: 'success states, positive indicators',
  warning: 'warnings, caution states',
  error: 'errors, destructive actions',
  info: 'info indicators, links',
};

// Typography role display order. Display → headings → body → captions →
// button → overline. The agent reads top-down, so the most-prominent levels
// come first.
const TYPE_DISPLAY_ORDER: NonNullable<TypeRole>[] = [
  'display-xxl',
  'display-xl',
  'display-lg',
  'display-md',
  'heading-lg',
  'heading-md',
  'heading-sm',
  'body-lg',
  'body-md',
  'body-sm',
  'caption',
  'micro',
  'pico',
  'button',
  'overline',
];

//  Stability filter (L1 + L2 only) 
// The 4-layer stability classification puts campaign (L3) tokens in an
// "expires per launch" bucket and content (L4) tokens in product-imagery
// territory. Neither belongs in a build prompt  the agent shouldn't hard-
// code a launch-week banner color into the user's component library.
// Tokens missing an explicit stability default to inclusion (no signal to
// exclude).
function isPermanent(t: { stability?: { layer?: string } }): boolean {
  const layer = t.stability?.layer;
  return layer === undefined || layer === 'infrastructure' || layer === 'system';
}

function deriveSiteName(url: string): string {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '');
    const base = host.split('.')[0];
    return base.charAt(0).toUpperCase() + base.slice(1);
  } catch {
    return 'Site';
  }
}

// Pull the primary family from a CSS font stack ("sohne-var", Inter, sans
// → "sohne-var"). Drops quotes. Idempotent on already-clean names.
function canonicalFamily(fontFamily: string): string {
  return (fontFamily ?? '')
    .split(',')[0]
    .trim()
    .replace(/^["']|["']$/g, '');
}

//  Line formatters 

function colorLine(c: NamedColor): string | null {
  if (!c.role || !c.roleLabel) return null;
  const hint = COLOR_USAGE_HINTS[c.role];
  const hintPart = hint ? `  ${hint}` : '';
  return `- **${c.roleLabel}:** \`${c.hex}\`${hintPart}`;
}

// Convert a line-height value to a unitless ratio when both size and lh are
// in px ("57.68px" → "1.03" for 56px size). Falls back to the raw value if
// either side isn't a clean px parse. Spec asks for unitless ratios in the
// typography section per resources/design-md-format.md §3.
function lineHeightRatio(fontSize: string, lineHeight: string): string {
  const sizePx = parseFloat(fontSize);
  const lhPx = parseFloat(lineHeight);
  if (
    Number.isFinite(sizePx) &&
    Number.isFinite(lhPx) &&
    sizePx > 0 &&
    lhPx > 0 &&
    /px\s*$/.test(lineHeight)
  ) {
    return (lhPx / sizePx).toFixed(2);
  }
  return lineHeight; // already unitless, or a keyword like "normal"
}

function typeLine(t: NamedType): string | null {
  if (!t.role || !t.roleLabel) return null;
  const family = canonicalFamily(t.fontFamily);
  const lh = lineHeightRatio(t.fontSize, t.lineHeight);
  const ls = t.letterSpacing && t.letterSpacing !== 'normal'
    ? ` / ls ${t.letterSpacing}`
    : '';
  const features = t.fontFeatureSettings && t.fontFeatureSettings !== 'normal'
    ? ` · features \`${t.fontFeatureSettings}\``
    : '';
  return `- **${t.roleLabel}:** \`${family}\` · ${t.fontSize} / weight ${t.fontWeight} / lh ${lh}${ls}${features}`;
}

//  Public API 

/**
 * Build the universal "use this design system to build UI" prompt as a
 * single markdown string. Pure function  same inputs → same output, no
 * I/O, no environment access.
 *
 * Applies role-namer in-memory so colors and typography levels carry their
 * human-readable role labels (Primary / Ink / Canvas / Display XXL / etc).
 * The caller's tokens object is NOT mutated; the role-assigned arrays live
 * only inside this function.
 */
export function buildUniversalPrompt(tokens: DesignTokens, url: string): string {
  const siteName = deriveSiteName(url);

  //  Role-assign in memory 
  // role-namer attaches `role` + `roleLabel` to every color / typo level.
  // Same pattern the SPA's API response layer uses. The disk-resident
  // tokens.json is never touched.
  const colorsAll: NamedColor[] = Array.isArray(tokens.colorTokens)
    ? assignColorRoles(tokens.colorTokens)
    : [];
  const typesAll: NamedType[] = Array.isArray(tokens.typographyLevels)
    ? assignTypeRoles(tokens.typographyLevels)
    : [];

  //  Filter + sort colors 
  // Stability filter first (no L3 campaign / L4 content), then role-assigned
  // first, then by display priority. Falls back to top-frequency permanent
  // tokens when role-namer couldn't classify anything (rare but defensive).
  const namedColors = colorsAll
    .filter(isPermanent)
    .filter((c) => c.role !== null)
    .sort((a, b) => {
      const pa = rolePriority(a.role);
      const pb = rolePriority(b.role);
      if (pa !== pb) return pa - pb;
      return b.frequency - a.frequency;
    })
    .slice(0, 10);

  const fallbackColors: ColorToken[] = namedColors.length === 0
    ? colorsAll.filter(isPermanent).slice(0, 8)
    : [];

  //  Filter + sort typography levels 
  // Dedupe by role label  role-namer's size-band buckets can collide
  // (a 44px and 48px heading both land in "Display XL"). For a build
  // prompt we want one canonical entry per role so the agent has an
  // unambiguous mapping; users who need the full granular hierarchy can
  // open DESIGN.md or tokens.json. Within each role we keep the highest-
  // frequency variant (the one that paints the most pixels on the site).
  const seenRoles = new Set<TypeRole>();
  const namedTypes = typesAll
    .filter(isPermanent)
    .filter((t) => t.role !== null)
    .sort((a, b) => {
      const ia = TYPE_DISPLAY_ORDER.indexOf(a.role!);
      const ib = TYPE_DISPLAY_ORDER.indexOf(b.role!);
      const sa = ia === -1 ? 99 : ia;
      const sb = ib === -1 ? 99 : ib;
      if (sa !== sb) return sa - sb;
      return b.frequency - a.frequency;
    })
    .filter((t) => {
      if (seenRoles.has(t.role)) return false;
      seenRoles.add(t.role);
      return true;
    })
    .slice(0, 8);

  // Family list (unique, in order of appearance in the sorted type list)
  const families: string[] = [];
  for (const t of namedTypes) {
    const f = canonicalFamily(t.fontFamily);
    if (f && !families.includes(f)) families.push(f);
  }

  const spacing = tokens.spacingSystem;
  const radii: RadiusToken[] = (tokens.radiusTokens ?? [])
    .filter(isPermanent)
    .slice(0, 6);
  const shadows: ShadowToken[] = (tokens.shadowTokens ?? [])
    .filter(isPermanent)
    .slice(0, 5);

  //  Build the markdown 
  const out: string[] = [];

  out.push(`# Design System: ${siteName} (${url})`);
  out.push('');
  out.push(
    'Use these values exactly when building UI. Do not substitute or "improve" any color, size, or spacing.',
  );
  out.push('');

  // Colors
  if (namedColors.length > 0) {
    out.push('## Colors');
    out.push('');
    for (const c of namedColors) {
      const line = colorLine(c);
      if (line) out.push(line);
    }
    out.push('');
  } else if (fallbackColors.length > 0) {
    out.push('## Colors');
    out.push('');
    out.push(
      '_Role-namer could not classify these  they\'re listed by frequency. Inspect before using._',
    );
    out.push('');
    for (const c of fallbackColors) {
      out.push(`- \`${c.hex}\` (used ${c.frequency}×)`);
    }
    out.push('');
  }

  // Typography
  if (namedTypes.length > 0 || families.length > 0) {
    out.push('## Typography');
    out.push('');
    if (families.length > 0) {
      out.push(`Families: ${families.map((f) => `\`${f}\``).join(', ')}`);
      out.push('');
    }
    for (const t of namedTypes) {
      const line = typeLine(t);
      if (line) out.push(line);
    }
    out.push('');
  }

  // Spacing
  if (spacing && Array.isArray(spacing.scale) && spacing.scale.length > 0) {
    out.push('## Spacing');
    out.push('');
    const maxWidthPart = spacing.maxContentWidth
      ? ` Max content width: \`${spacing.maxContentWidth}\`.`
      : '';
    out.push(
      `Base unit **${spacing.baseUnit}px**. Scale: ${spacing.scale.map((n) => `${n}px`).join(', ')}.${maxWidthPart}`,
    );
    if (Array.isArray(spacing.sectionSpacing) && spacing.sectionSpacing.length > 0) {
      out.push('');
      out.push(
        `Section spacing (between major page regions): ${spacing.sectionSpacing.map((n) => `${n}px`).join(', ')}.`,
      );
    }
    out.push('');
  }

  // Border radius
  if (radii.length > 0) {
    out.push('## Border radius');
    out.push('');
    for (const r of radii) {
      const elems = r.typicalElements && r.typicalElements.length > 0
        ? `  ${r.typicalElements.slice(0, 3).join(', ')}`
        : '';
      out.push(`- \`${r.value}\` (used ${r.frequency}×)${elems}`);
    }
    out.push('');
  }

  // Shadows
  if (shadows.length > 0) {
    out.push('## Shadows');
    out.push('');
    for (const s of shadows) {
      out.push(`- \`${s.type ?? 'shadow'}\`: \`${s.value}\``);
    }
    out.push('');
  }

  // How to use
  out.push('---');
  out.push('');
  out.push(
    '**How to use this:** paste this whole block into your AI agent (Cursor / v0 / Lovable / Claude / ChatGPT / Codex / Windsurf / Replit Agent / Copilot) and tell it what to build next.',
  );
  out.push('');
  out.push('Example follow-ups to append after pasting:');
  out.push('');
  out.push(
    '- "Build a pricing page hero with three tiers using the design system above."',
  );
  out.push('- "Make a sign-up form following the design system above."');
  out.push(
    '- "Build a dashboard sidebar with nav items + active state  design system above."',
  );
  out.push(
    '- "Convert this Figma mockup to React using the design system above."',
  );
  out.push('');
  out.push(
    '**Rule for the agent:** use ONLY the values above. No invented colors. No font substitutions without flagging. No "let me bump the radius to 6px to look better." If a value you need isn\'t listed, ask.',
  );
  out.push('');

  return out.join('\n');
}

/**
 * Read tokens.json from disk, build the prompt, write it to
 * `<outputDir>/prompts/universal.md`. The SPA's result panel fetches this
 * path via /api/output/<slug>/prompts/universal.md.
 */
export function generatePromptPack(
  tokensPath: string,
  outputDir: string,
  url: string,
): void {
  const tokens: DesignTokens = JSON.parse(fs.readFileSync(tokensPath, 'utf-8'));
  const prompt = buildUniversalPrompt(tokens, url);
  const promptsDir = path.join(outputDir, 'prompts');
  fs.mkdirSync(promptsDir, { recursive: true });
  fs.writeFileSync(path.join(promptsDir, 'universal.md'), prompt);
}
