// Prompt-pack emitter the SPA's Phase 2 wiring.
//
// Upstream's pipeline has a hard Phase 1 / Phase 2 boundary: scripts produce
// tokens.json (deterministic), an agent writes DESIGN.md (semantic). The
// upstream CLI hands off to Claude Code's `/install-skill design-md-generator`
// for Phase 2. Our SPA can't assume the user has Claude Code locally, so we
// emit a self-contained prompt the user can paste into ANY agent surface
// (Claude.ai, ChatGPT, Cursor, Windsurf, Codex CLI) and get a DESIGN.md back.
//
// This is the MVP variant: a single "universal" prompt that inlines the
// cardinal rules + section spec + the entire tokens.json. Plan-v1.md
// Weekend 6b adds 4 more per-agent variants (Cursor, v0, Lovable, Replit)
// using the same `coreBrief(design)` pattern.

import * as fs from 'fs';
import * as path from 'path';
import type { DesignTokens } from './types';

// The cardinal rules are an exact restatement of SKILL.md's Overview rules.
// We inline them so the prompt works against agents that have not installed
// SKILL.md (Claude.ai web, ChatGPT, etc).
const CARDINAL_RULES = `
**Cardinal rule: every numerical value in your output MUST exist in the tokens.json below.**

This means:
- Every hex value must appear in either \`colorTokens[].hex\` or \`cssVariables[].value\`.
- Every font-size, line-height, letter-spacing must match \`typographyLevels[].*\`.
- Every shadow string must appear verbatim in \`shadowTokens[].value\`.
- Every border-radius must come from \`radiusTokens[].value\`.
- Every spacing value must be a member of \`spacingSystem.scale\`.

**Format rules:**
- 6-digit lowercase hex only (\`#ffffff\`, never \`#fff\` or \`#FFF\`).
- Numeric font weights only (\`400\`, \`700\`), not words (\`bold\`, \`regular\`).
- Include OpenType features per typography level if present.
- Pixel values from extraction stay in px; only convert to rem when explicitly
  shown that way in tokens.

**Stability layer filtering:**
- Only use tokens classified as \`infrastructure\` (L1) or \`system\` (L2) in
  main content sections. Tokens classified as \`campaign\` (L3) belong in a
  "Current campaign — subject to change" note. Tokens classified as
  \`content\` (L4) must be excluded entirely.

**What you contribute:** semantic role names (which color is "Primary"), brand
voice analysis, content & voice section from microcopy, accessibility contract
inference, named design principles, and the agent prompt guide. Never invent
numbers.
`.trim();

// The 17-section v2 schema. Numbered, exact order; section 2.5 is conditional
// on darkMode.supported; sections 14-17 are optional and only included when
// the data supports them.
const SECTION_SPEC = `
Write the DESIGN.md with this exact structure:

\`\`\`
<!-- Generated: {YYYY-MM-DD} | Source: {url} | Pages: {count} | Framework: {name|none} | Format: v2 -->
<!-- This is not the official design system. Colors, fonts, and spacing may not be 100% accurate. -->

# Design System: {SiteName}

## 0. Brand Context
Company identity, target audience, brand personality (3-5 descriptors with
design evidence), and sources referenced.

## 1. Visual Theme & Atmosphere
Opening sentence that passes the "could this describe 3 other sites?" test.
Three to four paragraphs of layered expansion. Named design principles with
comparative framing ("Unlike X, this site does Y"). Key characteristics list.

## 2. Color Palette & Roles
Split into Brand Colors and Structural Colors. For each token: hex, frequency,
6-dimension usage breakdown (text/bg/border/shadow/gradient/icon), CSS
variable names, stability layer.

## 2.5. Dark Mode System  [only when darkMode.supported === true]
Full parallel color mapping. Strategy name. Comparative observation against
light mode. Variable diff table.

## 3. Typography Rules
Font families subsection. Font substitution notes. Hierarchy table with
OpenType features column. Named typography strategies (e.g. "Lightness as
Luxury", "Compression as Identity").

## 4. Component Stylings
Every component variant gets a "Use:" line with real text from samples, state
rationale (why hover changes color, why focus shows a ring), and the
transition specification.

## 5. Layout Principles
Spacing scale with frequency counts. Grid & container. Whitespace philosophy
with contrast statements. Border radius scale with frequency.

## 6. Depth & Elevation
Named principle. Shadow scale table with frequency. Shadow philosophy
paragraph.

## 6.5. Motion System
Duration / easing scale with frequency. Choreography. Reduced-motion policy.

## 7. Content & Voice
Tone descriptors. Capitalization rules (heading case, button case). Button
label patterns. Error/empty state copy. Emoji policy. Voice examples (real
quotes). Vibe paragraph.

## 8. Do's and Don'ts
8-12 Dos and 8-12 Don'ts. Counter-intuitive test on the Don'ts. Specific
thresholds. Copy-paste shortcuts.

## 9. Accessibility Contract
WCAG target. Contrast ratio table (5+ rows). Focus indicator spec. Touch /
click target minimums. Reduced-motion support. ARIA patterns.

## 10. Responsive Behavior
Breakpoints table with CSS rule counts. Collapsing strategy. Touch targets.
Image behavior.

## 11. State Matrix
Component x State table (default / hover / focus / active / disabled /
loading / empty / error). At least 4 component rows.

## 12. Iconography
System detection. Sizing scale. Stroke width. Color usage. Substitution
recommendation.

## 13. Agent Prompt Guide
Quick color reference. Self-containment checklist. 5-6 self-contained
component prompts (100-200 words each, every value inlined). Iteration guide.

## 14. Pattern Compositions  [optional]
## 15. Platform Adaptations  [optional]
## 16. Internationalization Notes  [optional]
## 17. Design Tokens Dictionary  [optional]
\`\`\`

After writing all sections, machine-verify: every hex value in your output
must exist in tokens.colorTokens[].hex or tokens.cssVariables[].value. Remove
any phantoms.
`.trim();

// Trim the tokens to what's actually useful for the agent. Full tokens.json
// includes raw debug fields the writer doesn't need (e.g. sampleTexts can be
// noisy, fontInfo.fontFaces dense). We keep the load-bearing fields and drop
// only the heaviest debug ones to reduce prompt size.
function leanTokens(tokens: DesignTokens): DesignTokens {
  // Shallow clone so we don't mutate the caller's object.
  const lean = { ...tokens } as DesignTokens;

  // Limit sampleTexts to first 3 per typography level — keeps the agent
  // grounded with real microcopy without ballooning the prompt.
  if (Array.isArray(lean.typographyLevels)) {
    lean.typographyLevels = lean.typographyLevels.map((t) => ({
      ...t,
      sampleTexts: Array.isArray(t.sampleTexts) ? t.sampleTexts.slice(0, 3) : t.sampleTexts,
    }));
  }

  return lean;
}

// Build the universal prompt. Self-contained: the agent doesn't need any
// external file references to write DESIGN.md.
export function buildUniversalPrompt(tokens: DesignTokens, url: string): string {
  const lean = leanTokens(tokens);
  const today = new Date().toISOString().slice(0, 10);
  const siteName = (() => {
    try {
      const host = new URL(url).hostname.replace(/^www\./, '');
      const base = host.split('.')[0];
      return base.charAt(0).toUpperCase() + base.slice(1);
    } catch {
      return 'Site';
    }
  })();

  return `# Write DESIGN.md v2 for ${url}

You are a senior design-systems writer. Your job is to author a complete
DESIGN.md v2 file for ${siteName} (${url}) using the extracted tokens.json
below as the single source of truth. The date is ${today}.

${CARDINAL_RULES}

${SECTION_SPEC}

---

## tokens.json

\`\`\`json
${JSON.stringify(lean, null, 2)}
\`\`\`

---

Now write the DESIGN.md as a single markdown document. Sections 0-13 + 6.5
are required (plus 2.5 when darkMode.supported is true). Sections 14-17 only
if the data clearly supports them. Output the markdown directly with no
preamble or postscript — just the file content starting from the
\`<!-- Generated: ... -->\` header.
`;
}

// Persist the prompt to disk so it's downloadable via /api/output/<slug>/...
// Pattern mirrors preview-gen / proof / report-gen: takes tokens path + dir,
// writes a fixed-name file.
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
