// Diagnostics — surfaces what the engine flagged as suspicious or low-confidence.
//
// This is post-processing OUTSIDE the engine. It reads tokens.json + the
// extraction-report + proof-data + pipeline warnings and emits a flat list
// of human-readable `Diagnostic` objects the SPA renders in the result
// panel. Nothing here mutates upstream data.
//
// Rule design principles:
//   - Every diagnostic must point at observable data, not vibes. Each
//     rule cites the exact field it consulted.
//   - Severities: error = "almost certainly wrong, manually review";
//     warning = "engine confidence is low, glance over before trusting";
//     info = "context for the user, not a problem".
//   - Rules MUST be additive. Two failing rules produce two diagnostics,
//     not one merged message. Lets users see ALL concerns at once.
//   - Stable, deterministic IDs so downstream dedup / scoreboard can
//     test against them.
//
// See MIRROR.md Part 2.12 for the divergence rationale.

import type { ColorToken, DesignTokens, ExtractionReport } from './types';

export type DiagnosticSeverity = 'info' | 'warning' | 'error';

export interface Diagnostic {
  /** Stable id — kebab-case rule name; multi-fires get a suffix (e.g. `failed-page-2`). */
  id: string;
  severity: DiagnosticSeverity;
  /** One-line headline shown in the panel row. */
  title: string;
  /** Longer prose explaining what + why. Single string, no markdown. */
  message: string;
  /** Optional concrete next action the user can take. */
  action?: string;
  /** Optional bullet list of supporting facts (token hexes, page URLs, etc). */
  details?: string[];
}

export interface ProofSummary {
  coverage: number | null;
  sampleSize: number | null;
  /** Top unmatched colors from proof-data, already sorted desc by count. */
  unmatchedTop?: Array<{ hex: string; count: number }>;
}

export interface ComputeDiagnosticsInput {
  /** tokens.json shape AFTER role-namer has run (so c.role is populated). */
  tokens: Partial<DesignTokens> & {
    colorTokens?: Array<ColorToken & { role?: string | null }>;
  };
  /** extraction-report.json contents. Null when the file was missing. */
  report: ExtractionReport | null;
  /** proof-data summary. Null when proof step was skipped/failed. */
  proof: ProofSummary | null;
  /** Pipeline-level warnings the API route collected (e.g. proof:error). */
  warnings: string[];
}

export function computeDiagnostics(input: ComputeDiagnosticsInput): Diagnostic[] {
  const diags: Diagnostic[] = [];
  const { tokens, report, proof, warnings } = input;

  // ── 1. Pipeline warnings (Phase 3 partial failures) ────────────────────
  // These are surfaced by the API route when a stage like proof.ts failed
  // but the rest of the pipeline kept going.
  for (let i = 0; i < (warnings ?? []).length; i++) {
    diags.push({
      id: `pipeline-warning-${i + 1}`,
      severity: 'warning',
      title: 'Phase 3 partial success',
      message: warnings[i],
    });
  }

  // ── 2. Engine-emitted warnings (from extract.ts) ───────────────────────
  const engineWarnings = report?.warnings ?? [];
  for (let i = 0; i < engineWarnings.length; i++) {
    diags.push({
      id: `engine-warning-${i + 1}`,
      severity: 'warning',
      title: 'Engine warning',
      message: engineWarnings[i],
    });
  }

  // ── 3. Low pixel-fidelity coverage ─────────────────────────────────────
  if (
    proof?.coverage !== null &&
    proof?.coverage !== undefined &&
    proof?.sampleSize !== null &&
    proof?.sampleSize !== undefined &&
    proof.sampleSize >= 500 &&
    proof.coverage < 0.7
  ) {
    diags.push({
      id: 'low-proof-coverage',
      severity: 'warning',
      title: `Pixel-fidelity coverage is ${(proof.coverage * 100).toFixed(1)}%`,
      message:
        'A significant fraction of sampled pixels on the live page did not match any color in the extracted palette. The engine likely missed colors — common causes: lazy-loaded styles, CSS-in-JS hydrated after networkidle, or interaction states not yet captured.',
      action:
        'Open proof.html for a side-by-side. Consider re-running with --with-interaction or --max-pages 10.',
      details: proof.unmatchedTop?.slice(0, 5).map((u) => `${u.hex} (${u.count} pixels unmatched)`),
    });
  }

  // ── 4. Low proof sample size ───────────────────────────────────────────
  // proof.ts excludes <img>/<video>/<canvas>/<svg> and background-image
  // regions. On image-heavy homepages there's little non-image area left.
  // Coverage % is technically accurate but low-confidence at this scale.
  if (
    proof?.sampleSize !== null &&
    proof?.sampleSize !== undefined &&
    proof.sampleSize < 1000
  ) {
    diags.push({
      id: 'low-proof-samples',
      severity: 'info',
      title: `Proof sample size is low (${proof.sampleSize} pixels)`,
      message:
        'proof.ts excludes image regions (<img>, <video>, <canvas>, <svg>, background-image). This page is mostly imagery, leaving few non-image pixels to sample. Coverage percentage is low-confidence at this sample size.',
      action: 'Coverage on text-and-chrome-heavy pages (pricing, docs) is more representative.',
    });
  }

  // ── 5. Single-page color noise ─────────────────────────────────────────
  // designBoundary.anomalies surfaces pages where most colors are unique.
  // That usually means frequency-dominance is including one-offs (campaign
  // banners, decorative gradients) alongside real system tokens.
  //
  // Use a rule-local counter (noiseIdx) for the id suffix so the first
  // single-page-noise diagnostic is always `-1` regardless of what
  // earlier rules pushed. Other multi-fire rules (pipeline-warning,
  // engine-warning, failed-page) follow the same convention.
  let noiseIdx = 0;
  for (const anomaly of report?.designBoundary?.anomalies ?? []) {
    const pct = anomaly.description?.match(/(\d+)\s*%/)?.[1];
    const pctNum = pct ? parseInt(pct, 10) : 0;
    if (pctNum >= 50) {
      noiseIdx++;
      diags.push({
        id: `single-page-noise-${noiseIdx}`,
        severity: 'warning',
        title: 'Single-page color noise detected',
        message: `${anomaly.url}: ${anomaly.description}. Frequency-dominance ranking may include one-off campaign or decorative colors in the primary candidates.`,
        action:
          'Manually verify the chosen primary brand color. Increasing --max-pages to 8+ dilutes single-page noise.',
      });
    }
  }

  // ── 6. Framework detection low confidence ──────────────────────────────
  // When a UI framework name is returned but Tailwind detection is null,
  // it's often a heuristic false positive on coincidental class names.
  // (Real Tailwind + UI-framework sites usually report both.)
  const fw = report?.framework ?? tokens?.meta?.framework;
  if (fw?.uiFramework && fw?.tailwind === null) {
    diags.push({
      id: 'framework-low-confidence',
      severity: 'warning',
      title: `Framework detection may be miscalled: "${fw.uiFramework}"`,
      message:
        'The UI framework heuristic matched but no Tailwind / utility-CSS signal was found. Real framework usage usually surfaces both. This often indicates a coincidental class-name pattern.',
      action:
        'Cross-check by viewing the site source. If wrong, the framework field in DESIGN.md will mislead the agent.',
    });
  }

  // ── 7. Dark mode detected but empty variable diff ──────────────────────
  // Site supports dark mode (toggle clicked, theme changed) but no CSS
  // variables differ between modes. Means the site uses JS-based theming
  // (className swap with hard-coded values), so DESIGN.md Section 2.5
  // will have nothing to populate.
  const dm = tokens?.darkMode;
  if (
    dm?.supported &&
    (!dm?.variableDiff || dm.variableDiff.length === 0)
  ) {
    diags.push({
      id: 'dark-mode-empty-diff',
      severity: 'info',
      title: `Dark mode detected (${dm.detectionMethod}) but no CSS-variable changes captured`,
      message:
        'The toggle worked but the engine could not capture CSS-variable differences between light and dark. Likely JS-based theming (className swap with hard-coded values) rather than CSS variables.',
      action:
        'DESIGN.md Section 2.5 (Dark Mode System) will be minimal. Manual review needed if dark mode is important for this site.',
    });
  }

  // ── 8. Low color count ─────────────────────────────────────────────────
  const colorCount = tokens?.colorTokens?.length ?? 0;
  if (colorCount > 0 && colorCount < 10) {
    diags.push({
      id: 'low-color-count',
      severity: 'warning',
      title: `Low color count (${colorCount} tokens)`,
      message:
        'Most real sites yield 20+ unique colors after OKLCH clustering. A low count usually means the crawl missed pages, the site uses runtime-injected styles the engine could not see, or the site is genuinely minimal (rare).',
      action:
        'Consider increasing --max-pages, enabling --with-interaction, or adding specific URLs via --extra-urls.',
    });
  }

  // ── 9. Low typography variety ──────────────────────────────────────────
  const typoCount = tokens?.typographyLevels?.length ?? 0;
  if (typoCount > 0 && typoCount < 3) {
    diags.push({
      id: 'low-typography-levels',
      severity: 'warning',
      title: `Low typography variety (${typoCount} levels)`,
      message:
        'Hierarchy table will be sparse. Most sites have 5-8 distinct typography levels (heading variants + body + label + caption).',
    });
  }

  // ── 10. Primary color appears structural (low chroma) ─────────────────
  // Frequency-dominance failure: a high-frequency footer / border grey
  // beats the actual brand color in the role-namer's ranking. Detected
  // by checking the role-named "primary" token's HSL-approximated
  // saturation (cheap proxy for OKLCH chroma).
  const primary = tokens?.colorTokens?.find(
    (c) => (c as ColorToken & { role?: string | null }).role === 'primary',
  );
  if (primary) {
    const sat = approxHexSaturation(primary.hex);
    if (sat !== null && sat < 0.15) {
      diags.push({
        id: 'primary-is-grey',
        severity: 'error',
        title: `Primary picked appears structural: ${primary.hex}`,
        message: `The role-namer selected a low-saturation color (approx HSL S = ${(sat * 100).toFixed(0)}%) as Primary. This is usually a frequency-dominance failure — a footer link grey or hairline border outranks the real brand color.`,
        action:
          'Manually inspect the top high-chroma colors in the long-tail. The real primary is likely there but was beaten on raw frequency. Weekend 3 visibility weighting (plan-v1.md) is the structural fix.',
      });
    }
  }

  // ── 11. All extracted colors are low-chroma ───────────────────────────
  // Stronger sanity check than primary-is-grey: if the ENTIRE palette is
  // achromatic the extraction probably failed (crawl missed brand pages,
  // CSS-in-JS didn't hydrate, or the site is genuinely greyscale — rare).
  // Threshold: require ≥10 colors before this fires, otherwise the
  // low-color-count rule already covers it.
  if ((tokens?.colorTokens?.length ?? 0) >= 10) {
    const tested = tokens!.colorTokens!.slice(0, 30);
    const chromatic = tested.filter((c) => {
      const s = approxHexSaturation(c.hex);
      return s !== null && s >= 0.15;
    });
    if (chromatic.length === 0) {
      diags.push({
        id: 'palette-all-grey',
        severity: 'error',
        title: `Entire palette appears achromatic (${tested.length} of top tokens)`,
        message:
          'No chromatic colors found in the top extracted tokens. Either the crawl missed all brand pages, CSS-in-JS styles never hydrated, or the site is genuinely greyscale (very rare). The brand color is almost certainly missing.',
        action:
          'Re-run with --with-interaction or --max-pages 12. If the brand IS greyscale, ignore this flag.',
      });
    }
  }

  // ── 12. Failed pages ───────────────────────────────────────────────────
  const failedPages = report?.failedPages ?? [];
  for (let i = 0; i < failedPages.length; i++) {
    const f = failedPages[i];
    diags.push({
      id: `failed-page-${i + 1}`,
      severity: 'warning',
      title: `Page crawl failed: ${f.url}`,
      message: f.reason || 'No reason provided by crawler.',
    });
  }

  return diags;
}

// ── Helpers ───────────────────────────────────────────────────────────────

/**
 * Approximates HSL saturation from a 6-digit hex. Returns null on malformed
 * input. Used as a cheap proxy for OKLCH chroma — full OKLCH would require
 * pulling in culori at this layer; this is a 10-line check that catches
 * the common "primary is grey" miscall without the dependency.
 */
function approxHexSaturation(hex: string): number | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return null;
  const r = parseInt(m[1].slice(0, 2), 16) / 255;
  const g = parseInt(m[1].slice(2, 4), 16) / 255;
  const b = parseInt(m[1].slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const lightness = (max + min) / 2;
  if (max === min) return 0;
  const delta = max - min;
  return lightness > 0.5 ? delta / (2 - max - min) : delta / (max + min);
}
