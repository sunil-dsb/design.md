// Deterministic DESIGN.md emitter  Path A, honest scope.
//
// Templates the sections that have crisp tokenized data. Skips the
// subjective ones (Brand Context, Visual Theme, Content & Voice, Do's
// and Don'ts) with a clear hand-off pointer to the universal prompt
// (prompts/universal.md) for agent-written premium versions.
//
// Pure function: same tokens.json input → same DESIGN.md output. No LLM,
// no network. This is what the scoreboard scores against  see plan
// §10 deterministic-MVP commitment.
//
// What lands in each section:
//   §0  Brand Context       SKIPPED  (needs world knowledge)
//   §1  Visual Theme        SKIPPED  (subjective)
//   §2  Color Palette       FULL     (hex, freq, usage, layer, css-var, role)
//   §2.5 Dark Mode          CONDITIONAL (only if darkMode.supported)
//   §3  Typography          FULL     (family, hierarchy table, OpenType features)
//   §4  Components          PARTIAL  (variants + styles, no state rationale)
//   §5  Layout              FULL     (spacing, grid, max widths, radius)
//   §6  Depth & Elevation   FULL     (shadow scale, frequency, classification)
//   §6.5 Motion             CONDITIONAL (duration + easing + keyframes when present)
//   §7  Content & Voice     SKIPPED  (subjective)
//   §8  Do's and Don'ts     SKIPPED  (subjective)
//   §9  Accessibility       FULL     (contrast pairs, focus, touch target, ARIA stats)
//   §10 Responsive          FULL     (breakpoints with rule counts)
//   §11 State Matrix        CONDITIONAL (only with --with-interaction data)
//   §12 Iconography         CONDITIONAL (only if icon system detected)
//   §13 Agent Prompt Guide  PARTIAL  (quick color reference + checklist)
//
// Total: 11 full/partial sections + 4 skipped hand-offs + 2 conditional.
// Skipped sections still appear in the output as a stub pointing the
// reader to the universal prompt  the structure stays complete.

import * as fs from 'fs';
import * as path from 'path';
import type {
  ColorToken,
  DesignTokens,
  ExtractionReport,
  TypographyLevel,
} from './types';
import { rolePriority, type ColorRole } from './role-namer';

//  Public API 

export interface GenerateOptions {
  /** Used in the file header comment + the H1 title. */
  url: string;
  /** Optional override for the site name; defaults to capitalized hostname segment. */
  siteName?: string;
}

/**
 * Render the full DESIGN.md as a single markdown string. Pure function.
 * No I/O, no environment access  easy to test against synthetic tokens.
 */
export function generateDesignMd(
  tokens: DesignTokens,
  report: ExtractionReport | null,
  opts: GenerateOptions,
): string {
  const date = new Date().toISOString().slice(0, 10);
  const siteName = opts.siteName ?? deriveSiteName(opts.url);
  const framework = report?.framework;
  const frameworkLabel = framework?.uiFramework
    ?? (framework?.tailwind?.detected ? 'Tailwind' : 'none');
  const pageCount = report?.pagesCrawled ?? tokens.meta?.totalPages ?? 1;

  const out: string[] = [];

  // Header (verbatim format from resources/design-md-format.md)
  out.push(
    `<!-- Generated: ${date} | Source: ${opts.url} | Pages: ${pageCount} | Framework: ${frameworkLabel} | Format: v2 -->`,
  );
  out.push(
    '<!-- This is not the official design system. Colors, fonts, and spacing may not be 100% accurate. -->',
  );
  out.push('<!-- Sections 0, 1, 7, 8 are skipped in the deterministic emitter  they require -->');
  out.push('<!-- brand judgement. Paste prompts/universal.md into an AI agent for full coverage. -->');
  out.push('');
  out.push(`# Design System: ${siteName}`);
  out.push('');

  // Sections in spec order
  out.push(emitSection0Stub());
  out.push(emitSection1Stub());
  out.push(emitSection2Colors(tokens));
  if (tokens.darkMode?.supported) {
    out.push(emitSection25DarkMode(tokens));
  }
  out.push(emitSection3Typography(tokens));
  out.push(emitSection4Components(tokens));
  out.push(emitSection5Layout(tokens));
  out.push(emitSection6Depth(tokens));
  if (tokens.motionSystem) {
    out.push(emitSection65Motion(tokens));
  }
  out.push(emitSection7Stub());
  out.push(emitSection8Stub());
  out.push(emitSection9A11y(tokens));
  out.push(emitSection10Responsive(tokens));
  if (tokens.components && tokens.components.length > 0) {
    out.push(emitSection11StateMatrix(tokens));
  }
  if (tokens.iconSystem) {
    out.push(emitSection12Iconography(tokens));
  }
  out.push(emitSection13AgentGuide(tokens));

  return out.join('\n') + '\n';
}

/**
 * Write DESIGN.md to disk. Reads tokens.json + extraction-report.json
 * from the output directory; writes DESIGN.md alongside.
 *
 * Returns the absolute path to the written file (or null if tokens.json
 * was missing).
 */
export function generateAndWriteDesignMd(
  outputDir: string,
  url: string,
): string | null {
  const tokensPath = path.join(outputDir, 'tokens.json');
  const reportPath = path.join(outputDir, 'extraction-report.json');
  if (!fs.existsSync(tokensPath)) return null;

  const tokens = JSON.parse(fs.readFileSync(tokensPath, 'utf-8')) as DesignTokens;
  const report = fs.existsSync(reportPath)
    ? (JSON.parse(fs.readFileSync(reportPath, 'utf-8')) as ExtractionReport)
    : null;

  const md = generateDesignMd(tokens, report, { url });
  const destPath = path.join(outputDir, 'DESIGN.md');
  fs.writeFileSync(destPath, md);
  return destPath;
}

//  Helpers 

function deriveSiteName(url: string): string {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '');
    const base = host.split('.')[0];
    return base.charAt(0).toUpperCase() + base.slice(1);
  } catch {
    return 'Site';
  }
}

/** Build a small "(used as: text 12, bg 5, border 2)" suffix. */
function usageSuffix(c: ColorToken): string {
  const parts: string[] = [];
  if (c.usedAs.textColor > 0) parts.push(`text ${c.usedAs.textColor}`);
  if (c.usedAs.bgColor > 0) parts.push(`bg ${c.usedAs.bgColor}`);
  if (c.usedAs.borderColor > 0) parts.push(`border ${c.usedAs.borderColor}`);
  if (c.usedAs.shadowColor > 0) parts.push(`shadow ${c.usedAs.shadowColor}`);
  if (c.usedAs.gradientColor > 0) parts.push(`gradient ${c.usedAs.gradientColor}`);
  if (c.usedAs.iconColor > 0) parts.push(`icon ${c.usedAs.iconColor}`);
  return parts.length > 0 ? `(${parts.join(', ')})` : '';
}

/** Format hex + CSS variable name (when known) + 4-layer stability layer. */
function colorMetaTail(c: ColorToken): string {
  const tail: string[] = [];
  if (c.cssVariableNames && c.cssVariableNames.length > 0) {
    tail.push(`CSS var: \`${c.cssVariableNames[0]}\``);
  }
  if (c.stability?.layer) {
    tail.push(`layer: ${c.stability.layer}`);
  }
  return tail.length > 0 ? ` (${tail.join('; ')})` : '';
}

/** Pick a descriptive name without inventing brand-specific words. */
function describeColor(c: ColorToken): string {
  const c2 = c as ColorToken & { role?: string | null; roleLabel?: string | null };
  if (c2.roleLabel) return c2.roleLabel;
  // Fall back to a structural descriptor based on chroma + lightness.
  const [r, g, b] = c.rgba;
  const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  if (lum > 0.9) return 'Light Surface';
  if (lum < 0.1) return 'Dark Surface';
  // Saturation heuristic
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const sat = max === 0 ? 0 : (max - min) / max;
  if (sat < 0.1) return lum > 0.5 ? 'Mid Neutral' : 'Dark Neutral';
  // Chromatic  describe by hue
  if (r > g && r > b) return g > b ? 'Warm Tone' : 'Crimson Tone';
  if (g > r && g > b) return 'Green Tone';
  if (b > r && b > g) return r > g ? 'Violet Tone' : 'Blue Tone';
  return 'Chromatic Tone';
}

function isChromatic(c: ColorToken): boolean {
  const [r, g, b] = c.rgba;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const sat = max === 0 ? 0 : (max - min) / max;
  return sat >= 0.1;
}

//  Section emitters 

function emitSection0Stub(): string {
  return [
    '## 0. Brand Context',
    '',
    '_Skipped by the deterministic emitter  Brand Context requires world knowledge about the company, audience, and personality that no extraction can produce reliably._',
    '',
    'For a complete, agent-written Brand Context section, paste `prompts/universal.md` (downloadable from the SPA result panel) into Claude Code / Claude.ai / ChatGPT / Cursor.',
    '',
  ].join('\n');
}

function emitSection1Stub(): string {
  return [
    '## 1. Visual Theme & Atmosphere',
    '',
    '_Skipped by the deterministic emitter  Visual Theme requires aesthetic judgement ("could this describe 3 other sites?") that no extraction can produce reliably._',
    '',
    'For a complete, agent-written Visual Theme section, paste `prompts/universal.md` into an AI agent.',
    '',
  ].join('\n');
}

function emitSection2Colors(tokens: DesignTokens): string {
  const colors = tokens.colorTokens ?? [];
  if (colors.length === 0) {
    return '## 2. Color Palette & Roles\n\n_No color tokens extracted._\n';
  }

  //  Spec-compliant filtering by 4-layer stability 
  // resources/design-md-format.md §2 requires:
  //   - main palette: L1 (infrastructure) + L2 (system) ONLY
  //   - L3 (campaign): separate "Current Campaign Colors" subsection
  //   - L4 (content): excluded entirely
  // Tokens missing a stability field default to inclusion (no signal to
  // exclude). Tokens with explicit layer get strict filtering.
  const isPermanent = (c: ColorToken) => {
    const layer = c.stability?.layer;
    return layer === undefined || layer === 'infrastructure' || layer === 'system';
  };
  const isCampaign = (c: ColorToken) => c.stability?.layer === 'campaign';
  const isContent = (c: ColorToken) => c.stability?.layer === 'content';

  const permanent = colors.filter(isPermanent);
  const campaign = colors.filter(isCampaign);
  const contentExcluded = colors.filter(isContent).length;

  // Split permanent palette by chromaticity, then within each group sort
  // by role priority (Primary first, then Accent, then brand variants,
  // then text / surface / structural). Falls back to frequency for
  // ties / un-roled tokens. Surfaces brand identity at the top of both
  // Brand Colors and Structural Colors lists.
  const byRoleThenFreq = (a: ColorToken, b: ColorToken): number => {
    const ra = rolePriority((a as ColorToken & { role?: ColorRole | null }).role);
    const rb = rolePriority((b as ColorToken & { role?: ColorRole | null }).role);
    if (ra !== rb) return ra - rb;
    return b.frequency - a.frequency;
  };
  const brand = permanent.filter(isChromatic).slice().sort(byRoleThenFreq);
  const structural = permanent.filter((c) => !isChromatic(c)).slice().sort(byRoleThenFreq);

  const out: string[] = [];
  out.push('## 2. Color Palette & Roles');
  out.push('');
  out.push(
    `Permanent palette (L1 infrastructure + L2 system): ${permanent.length} tokens. ${campaign.length} campaign-level tokens are listed separately below; ${contentExcluded} content-level tokens are excluded per the 4-layer stability classification.`,
  );
  out.push('');

  if (brand.length > 0) {
    out.push('### Brand Colors');
    out.push('');
    for (const c of brand) {
      const name = describeColor(c);
      const usage = usageSuffix(c);
      const meta = colorMetaTail(c);
      out.push(
        `- **${name}** (\`${c.hex}\`): frequency ${c.frequency}.${usage ? ' Used as ' + usage : ''}.${meta}`,
      );
    }
    out.push('');
  }

  if (structural.length > 0) {
    out.push('### Structural Colors');
    out.push('');
    for (const c of structural) {
      const name = describeColor(c);
      const usage = usageSuffix(c);
      const meta = colorMetaTail(c);
      out.push(
        `- **${name}** (\`${c.hex}\`): frequency ${c.frequency}.${usage ? ' Used as ' + usage : ''}.${meta}`,
      );
    }
    out.push('');
  }

  out.push('### Color Boundary Rules');
  out.push('');
  out.push('- Infrastructure (L1) and System (L2) colors form the permanent palette. Use them anywhere.');
  if (campaign.length > 0) {
    out.push('- Campaign (L3) colors are launch-specific and will change. See the Campaign Colours table below; do not adopt them as permanent tokens.');
  } else {
    out.push('- Campaign (L3) tokens (launch-specific accents that change between campaigns) were not present in this extraction.');
  }
  out.push('- Content (L4) colors appear inside product imagery and are NOT part of the design system. Excluded from this document.');
  out.push('- Permanent chromatic colors at frequency < 5 may be decorative. Verify intent before adopting them as system tokens.');
  out.push('');

  if (campaign.length > 0) {
    const today = new Date().toISOString().slice(0, 10);
    out.push('### Current Campaign Colors');
    out.push('');
    out.push(
      `> Extracted ${today}. These colors are campaign-level (L3) and will change with the next product launch.`,
    );
    out.push('');
    out.push('| Hex | Frequency | Used as | CSS Variable |');
    out.push('|-----|-----------|---------|--------------|');
    for (const c of campaign) {
      const usage = usageSuffix(c).replace(/^\(|\)$/g, '') || '';
      const cssVar = c.cssVariableNames && c.cssVariableNames.length > 0
        ? `\`${c.cssVariableNames[0]}\``
        : '';
      out.push(`| \`${c.hex}\` | ${c.frequency} | ${usage} | ${cssVar} |`);
    }
    out.push('');
  }
  return out.join('\n');
}

function emitSection25DarkMode(tokens: DesignTokens): string {
  const dm = tokens.darkMode;
  if (!dm?.supported) return '';
  const out: string[] = [];
  out.push('## 2.5. Dark Mode System');
  out.push('');
  out.push('### Detection Method');
  out.push('');
  out.push(`**Trigger:** \`${dm.detectionMethod}\``);
  out.push('');
  if (dm.variableDiff && dm.variableDiff.length > 0) {
    out.push('### Color Mapping Table');
    out.push('');
    out.push('| Variable | Light Value | Dark Value |');
    out.push('|----------|-------------|------------|');
    for (const entry of dm.variableDiff) {
      out.push(`| \`${entry.name}\` | \`${entry.lightValue}\` | \`${entry.darkValue}\` |`);
    }
    out.push('');
  } else {
    out.push('### Color Mapping Table');
    out.push('');
    out.push(
      '_No CSS variable differences captured. The site likely uses JavaScript-based theming (className swap with hard-coded values) rather than CSS variables. Manual review required for full dark-mode documentation._',
    );
    out.push('');
  }
  return out.join('\n');
}

/**
 * Derive a Role label for a typography level. Prefers the role-namer's
 * assigned `roleLabel` when present, otherwise infers from typical HTML
 * tags. validate.ts (engine's own validator) expects a "Role" column.
 */
function deriveTypoRole(l: TypographyLevel): string {
  const fromNamer = (l as TypographyLevel & { roleLabel?: string | null }).roleLabel;
  if (fromNamer) return fromNamer;
  const tags = new Set((l.typicalTags || []).map((t) => t.toLowerCase()));
  if (tags.has('h1')) return 'Display Large';
  if (tags.has('h2')) return 'Display Medium';
  if (tags.has('h3') || tags.has('h4')) return 'Display Small';
  if (tags.has('button')) return 'Button';
  if (tags.has('code') || tags.has('pre') || tags.has('kbd') || tags.has('samp')) return 'Mono';
  if (tags.has('caption') || tags.has('small')) return 'Caption';
  if (tags.has('label')) return 'Label';
  if (tags.has('p') || tags.has('li') || tags.has('span')) return 'Body';
  return 'Text';
}

function emitSection3Typography(tokens: DesignTokens): string {
  const levels = tokens.typographyLevels ?? [];
  const families = new Set<string>();
  for (const l of levels) {
    if (l.fontFamily) families.add(l.fontFamily.split(',')[0].trim().replace(/^["']|["']$/g, ''));
  }

  const out: string[] = [];
  out.push('## 3. Typography Rules');
  out.push('');
  if (families.size > 0) {
    out.push('### Font Families');
    out.push('');
    for (const f of families) {
      out.push(`- \`${f}\``);
    }
    out.push('');
  }

  if (levels.length === 0) {
    out.push('_No typography levels extracted._');
    out.push('');
    return out.join('\n');
  }

  // Role column first (matches validate.ts's expected schema), then
  // Font, then Size + the rest of the canonical typography fields.
  out.push('### Hierarchy');
  out.push('');
  out.push('| Role | Font | Size | Weight | Line Height | Letter Spacing | OpenType | Frequency | Typical Tags |');
  out.push('|------|------|------|--------|-------------|----------------|----------|-----------|--------------|');
  for (const l of levels) {
    const role = deriveTypoRole(l);
    const family = (l.fontFamily || '').split(',')[0].trim().replace(/^["']|["']$/g, '');
    const tags = (l.typicalTags || []).slice(0, 4).join(', ');
    const features = l.fontFeatureSettings && l.fontFeatureSettings !== 'normal'
      ? `\`${l.fontFeatureSettings}\`` : '';
    out.push(
      `| ${role} | \`${family}\` | \`${l.fontSize}\` | \`${l.fontWeight}\` | \`${l.lineHeight}\` | \`${l.letterSpacing}\` | ${features} | ${l.frequency} | ${tags} |`,
    );
  }
  out.push('');
  return out.join('\n');
}

function emitSection4Components(tokens: DesignTokens): string {
  const components = tokens.components ?? [];
  const out: string[] = [];
  out.push('## 4. Component Stylings');
  out.push('');
  out.push(
    '_Partial template: extracted variant styles are documented below, but the "Use:" lines and state-change rationale are subjective and best filled in by an AI agent. See `prompts/universal.md` for the agent-written version._',
  );
  out.push('');

  if (components.length === 0) {
    out.push('_No components extracted. Run with `--with-interaction` to surface component variants._');
    out.push('');
    return out.join('\n');
  }

  for (const group of components) {
    out.push(`### ${group.type}`);
    out.push('');
    for (const v of group.variants) {
      out.push(`#### ${v.name}`);
      out.push('');
      out.push(`- **Count:** ${v.count}`);
      const styleKeys = Object.keys(v.style ?? {});
      if (styleKeys.length > 0) {
        out.push('- **Style:**');
        for (const k of styleKeys.slice(0, 12)) {
          out.push(`  - \`${k}\`: \`${v.style[k]}\``);
        }
      }
      if (v.hoverChanges) {
        out.push(`- **On hover:** ${Object.keys(v.hoverChanges).length} property change(s).`);
      }
      if (v.focusVisibleChanges) {
        out.push(`- **On focus-visible:** ${Object.keys(v.focusVisibleChanges).length} property change(s).`);
      }
      if (v.activeChanges) {
        out.push(`- **On active:** ${Object.keys(v.activeChanges).length} property change(s).`);
      }
      if (v.disabledStyle) {
        out.push(`- **Disabled style:** ${Object.keys(v.disabledStyle).length} property override(s).`);
      }
      if (v.transition) {
        out.push(`- **Transition:** \`${v.transition}\``);
      }
      out.push('');
    }
  }
  return out.join('\n');
}

function emitSection5Layout(tokens: DesignTokens): string {
  const ss = tokens.spacingSystem;
  const radii = tokens.radiusTokens ?? [];
  const layout = tokens.layoutPatterns;
  const out: string[] = [];
  out.push('## 5. Layout Principles');
  out.push('');

  if (ss) {
    out.push('### Spacing System');
    out.push('');
    out.push(`- **Base unit:** \`${ss.baseUnit}px\``);
    if (ss.scale && ss.scale.length > 0) {
      out.push(`- **Scale:** ${ss.scale.map((n) => `\`${n}px\``).join(', ')}`);
    }
    if (ss.sectionSpacing && ss.sectionSpacing.length > 0) {
      out.push(`- **Section spacing:** ${ss.sectionSpacing.map((n) => `\`${n}px\``).join(', ')}`);
    }
    if (ss.maxContentWidth) {
      out.push(`- **Max content width:** \`${ss.maxContentWidth}\``);
    }
    out.push('');
  }

  if (layout) {
    out.push('### Grid & Container');
    out.push('');
    if (layout.commonColumnCounts && layout.commonColumnCounts.length > 0) {
      out.push(`- **Common column counts:** ${layout.commonColumnCounts.join(', ')}`);
    }
    out.push(`- **Content alignment:** ${layout.contentAlignment ?? ''}`);
    if (layout.maxContentWidth) {
      out.push(`- **Max content width:** \`${layout.maxContentWidth}\``);
    }
    out.push('');
  }

  if (radii.length > 0) {
    out.push('### Border Radius Scale');
    out.push('');
    out.push('| Value | Frequency | Typical Elements |');
    out.push('|-------|-----------|------------------|');
    for (const r of radii) {
      const els = (r.typicalElements || []).slice(0, 4).join(', ') || '';
      out.push(`| \`${r.value}\` | ${r.frequency} | ${els} |`);
    }
    out.push('');
  }
  return out.join('\n');
}

function emitSection6Depth(tokens: DesignTokens): string {
  const shadows = tokens.shadowTokens ?? [];
  const out: string[] = [];
  out.push('## 6. Depth & Elevation');
  out.push('');
  if (shadows.length === 0) {
    out.push('_No shadow tokens extracted. The system relies on flat surfaces with no elevation hierarchy._');
    out.push('');
    return out.join('\n');
  }

  out.push('### Shadow Scale');
  out.push('');
  out.push('| Type | Value | Frequency | Typical Elements |');
  out.push('|------|-------|-----------|------------------|');
  for (const s of shadows) {
    const els = (s.typicalElements || []).slice(0, 4).join(', ') || '';
    out.push(`| ${s.type} | \`${s.value}\` | ${s.frequency} | ${els} |`);
  }
  out.push('');
  return out.join('\n');
}

function emitSection65Motion(tokens: DesignTokens): string {
  const ms = tokens.motionSystem;
  if (!ms) return '';
  const out: string[] = [];
  out.push('## 6.5. Motion System');
  out.push('');

  if (ms.durationScale && ms.durationScale.length > 0) {
    out.push('### Duration Scale');
    out.push('');
    out.push('| Label | Value | Frequency |');
    out.push('|-------|-------|-----------|');
    for (const d of ms.durationScale) {
      out.push(`| ${d.label} | \`${d.value}\` | ${d.frequency} |`);
    }
    out.push('');
  }

  if (ms.primaryTimingFunction) {
    out.push(`### Easing\n\n- **Primary:** \`${ms.primaryTimingFunction}\``);
    if (ms.timingFunctions && ms.timingFunctions.length > 1) {
      out.push('- **Other observed:**');
      for (const t of ms.timingFunctions.slice(0, 6)) {
        out.push(`  - \`${t.value}\` (frequency ${t.frequency})`);
      }
    }
    out.push('');
  }

  if (ms.keyframeAnimations && ms.keyframeAnimations.length > 0) {
    out.push('### Keyframe Animations');
    out.push('');
    out.push('| Name | Type | Duration | Properties |');
    out.push('|------|------|----------|------------|');
    for (const k of ms.keyframeAnimations.slice(0, 8)) {
      out.push(`| \`${k.name}\` | ${k.type} | \`${k.duration}\` | ${(k.properties || []).slice(0, 4).join(', ')} |`);
    }
    out.push('');
  }

  out.push(`### Reduced Motion\n\n- **Supported:** ${ms.prefersReducedMotion ? 'yes (CSS query observed)' : 'not detected'}`);
  out.push('');
  return out.join('\n');
}

function emitSection7Stub(): string {
  return [
    '## 7. Content & Voice',
    '',
    '_Skipped by the deterministic emitter  Content & Voice requires reading microcopy and inferring brand voice, which no extraction can do reliably._',
    '',
    'For a complete, agent-written Content & Voice section, paste `prompts/universal.md` into an AI agent.',
    '',
  ].join('\n');
}

function emitSection8Stub(): string {
  return [
    "## 8. Do's and Don'ts",
    '',
    "_Skipped by the deterministic emitter  Do's and Don'ts are brand-specific judgement calls._",
    '',
    "For a complete, agent-written Do's and Don'ts section, paste `prompts/universal.md` into an AI agent.",
    '',
  ].join('\n');
}

function emitSection9A11y(tokens: DesignTokens): string {
  const a = tokens.a11yTokens;
  const out: string[] = [];
  out.push('## 9. Accessibility Contract');
  out.push('');

  if (!a) {
    out.push('_No accessibility data extracted._');
    out.push('');
    return out.join('\n');
  }

  out.push('### WCAG Target');
  out.push('');
  out.push('- **Default:** WCAG 2.2 AA (4.5:1 normal text, 3:1 large text)');
  out.push('');

  if (a.contrastPairs && a.contrastPairs.length > 0) {
    out.push('### Contrast Pairs');
    out.push('');
    out.push('| Foreground | Background | Ratio | AA | AAA | Usage |');
    out.push('|------------|------------|-------|----|-----|-------|');
    for (const p of a.contrastPairs.slice(0, 12)) {
      out.push(
        `| \`${p.foreground}\` | \`${p.background}\` | ${p.ratio.toFixed(2)}:1 | ${p.meetsAA ? '✓' : '✗'} | ${p.meetsAAA ? '✓' : '✗'} | ${p.usageCount} |`,
      );
    }
    out.push('');
  }

  if (a.focusIndicator?.style && Object.keys(a.focusIndicator.style).length > 0) {
    out.push('### Focus Indicator');
    out.push('');
    out.push(`- **Consistent across components:** ${a.focusIndicator.consistent ? 'yes' : 'no'}`);
    for (const [k, v] of Object.entries(a.focusIndicator.style).slice(0, 8)) {
      out.push(`  - \`${k}\`: \`${v}\``);
    }
    out.push('');
  }

  if (a.minTouchTarget) {
    out.push(`### Touch / Click Target\n\n- **Minimum observed:** \`${a.minTouchTarget.width}×${a.minTouchTarget.height}px\``);
    out.push('');
  }

  if (a.altTextCoverage) {
    out.push(`### Alt Text Coverage\n\n- ${a.altTextCoverage.withAlt} of ${a.altTextCoverage.total} images have alt text (${a.altTextCoverage.percentage.toFixed(0)}%)`);
    out.push('');
  }

  if (a.tabOrder) {
    out.push(`### Tab Order\n\n- **Tabbable elements:** ${a.tabOrder.tabbableCount}`);
    if (a.tabOrder.hasPositiveTabindex) {
      out.push(`- **Positive tabindex values:** ${a.tabOrder.positiveTabindexCount} (anti-pattern  most sites should rely on document order)`);
    }
    out.push('');
  }

  if (a.skipLinkDetected !== undefined) {
    out.push(`- **Skip-to-main link:** ${a.skipLinkDetected ? 'present' : 'not detected'}`);
  }
  if (a.reducedMotionSupport !== undefined) {
    out.push(`- **Reduced motion handling:** ${a.reducedMotionSupport ? 'supported' : 'not detected'}`);
  }
  out.push('');
  return out.join('\n');
}

function emitSection10Responsive(tokens: DesignTokens): string {
  const bps = tokens.breakpoints ?? [];
  const out: string[] = [];
  out.push('## 10. Responsive Behavior');
  out.push('');

  if (bps.length === 0) {
    out.push('_No `@media` breakpoints extracted._');
    out.push('');
    return out.join('\n');
  }

  out.push('### Breakpoints');
  out.push('');
  out.push('| Type | Value | Rules |');
  out.push('|------|-------|-------|');
  for (const bp of bps.slice(0, 16)) {
    out.push(`| ${bp.type} | \`${bp.value}\` | ${bp.ruleCount} |`);
  }
  out.push('');
  return out.join('\n');
}

function emitSection11StateMatrix(tokens: DesignTokens): string {
  const components = tokens.components ?? [];
  const out: string[] = [];
  out.push('## 11. State Matrix');
  out.push('');

  const rows = components.flatMap((g) =>
    g.variants.map((v) => ({
      component: `${g.type} · ${v.name}`,
      hasHover: !!v.hoverChanges,
      hasFocusVisible: !!v.focusVisibleChanges,
      hasActive: !!v.activeChanges,
      hasDisabled: !!v.disabledStyle,
    })),
  );

  if (rows.length === 0) {
    out.push('_No state data captured. Re-run with `--with-interaction` to enable hover/focus/active capture._');
    out.push('');
    return out.join('\n');
  }

  out.push('| Component / Variant | default | hover | focus-visible | active | disabled |');
  out.push('|---------------------|---------|-------|---------------|--------|----------|');
  for (const r of rows.slice(0, 20)) {
    out.push(
      `| ${r.component} | ✓ | ${r.hasHover ? '✓' : ''} | ${r.hasFocusVisible ? '✓' : ''} | ${r.hasActive ? '✓' : ''} | ${r.hasDisabled ? '✓' : ''} |`,
    );
  }
  out.push('');
  return out.join('\n');
}

function emitSection12Iconography(tokens: DesignTokens): string {
  const icons = tokens.iconSystem;
  if (!icons) return '';
  const out: string[] = [];
  out.push('## 12. Iconography');
  out.push('');
  out.push(`- **Library:** ${icons.library ?? 'custom / unknown'}`);
  out.push(`- **Total icons observed:** ${icons.totalCount}`);
  out.push(`- **Color mode:** ${icons.colorMode}`);
  if (icons.strokeWidth !== null && icons.strokeWidth !== undefined) {
    out.push(`- **Stroke width:** \`${icons.strokeWidth}\``);
  }
  if (icons.sizeScale && icons.sizeScale.length > 0) {
    out.push(`- **Sizes observed:** ${icons.sizeScale.map((n) => `\`${n}px\``).join(', ')}`);
  }
  if (icons.labeledPercentage !== undefined) {
    out.push(`- **Labeled (aria-label / sibling text / etc.):** ${icons.labeledPercentage.toFixed(0)}%`);
  }
  out.push('');
  return out.join('\n');
}

function emitSection13AgentGuide(tokens: DesignTokens): string {
  const out: string[] = [];
  out.push('## 13. Agent Prompt Guide');
  out.push('');
  out.push('Quick reference for an AI coding agent generating UI from this design system.');
  out.push('');

  out.push('### Quick Color Reference');
  out.push('');
  const namedColors = (tokens.colorTokens ?? [])
    .filter((c) => (c as ColorToken & { roleLabel?: string | null }).roleLabel)
    .slice(0, 12);
  if (namedColors.length > 0) {
    for (const c of namedColors) {
      const label = (c as ColorToken & { roleLabel?: string | null }).roleLabel;
      out.push(`- **${label}**: \`${c.hex}\``);
    }
  } else {
    const top = (tokens.colorTokens ?? []).slice(0, 8);
    for (const c of top) {
      out.push(`- \`${c.hex}\` (frequency ${c.frequency})`);
    }
  }
  out.push('');

  out.push('### Self-Containment Checklist');
  out.push('');
  out.push('When asking an AI to produce a component using this system, the prompt MUST inline:');
  out.push('');
  out.push('- [ ] Font family, size, weight, line-height, letter-spacing');
  out.push('- [ ] All colors as 6-digit lowercase hex');
  out.push('- [ ] Padding, border-radius, shadow values');
  out.push('- [ ] OpenType features when the system uses them');
  out.push('- [ ] Hover, focus-visible, active values where the variant has them');
  out.push('- [ ] Transition value');
  out.push('');

  out.push('### Where to go for the full premium guide');
  out.push('');
  out.push(
    'For agent-written prose covering Sections 0, 1, 4 (rationale), 7, 8, and the iteration guide, paste `prompts/universal.md` into Claude Code / Claude.ai / ChatGPT / Cursor / Codex / Windsurf / Lovable / Replit Agent.',
  );
  out.push('');
  return out.join('\n');
}
