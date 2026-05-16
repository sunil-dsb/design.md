// Shared stability chip + legend — used by the extract result panel AND the
// /gallery/<brand> brand viewer so both flows render identically.
//
// Tracks the classifier in lib/engine/cluster.ts:
//   infrastructure → system → campaign → content
// (most stable → most volatile)
//
// UX choices (rationale):
//
//   - Display label: "infrastructure" is dev-jargon. We surface it as "Core"
//     in the visible label and only keep the original name as the internal
//     `layer` value (so engine-side state stays unchanged).
//
//   - Shape indicator alongside the color dot: colorblind users + the
//     accessibility-honesty story for this very product need a non-color
//     channel. Triangle / square / diamond / circle map to the 4 layers.
//
//   - Confidence percentage hidden by default. It's the classifier's
//     internal confidence — useful to a developer auditing the engine, not
//     to a user reading their DESIGN.md. Surfaced via title attribute and
//     opt-in `showConfidence`. (See [[role-namer-heuristic-drift]] — the
//     percentage itself wobbles as the heuristic evolves.)
//
//   - Tooltip explains what the layer MEANS, not just lists signals.

export const STABILITY_COLORS: Record<string, string> = {
  infrastructure: "text-emerald-300",
  system: "text-sky-300",
  campaign: "text-amber-300",
  content: "text-rose-300",
};

const STABILITY_LABELS: Record<string, string> = {
  infrastructure: "Core",
  system: "System",
  campaign: "Campaign",
  content: "Content",
};

const STABILITY_SHAPES: Record<string, string> = {
  infrastructure: "▲",
  system: "■",
  campaign: "◆",
  content: "●",
};

const STABILITY_DESCRIPTIONS: Record<string, string> = {
  infrastructure:
    "Core foundation — page background, body text, base font. Almost never changes.",
  system:
    "Brand design system — primary, accent, hairline. Stable across the product.",
  campaign:
    "Launch-specific — promo gradients, one-off highlights. Will change.",
  content:
    "Inside imagery — not really part of the design system. Treat with caution.",
};

export function StabilityChip({
  layer,
  confidence,
  signals,
  showConfidence = false,
}: {
  layer?: string;
  confidence?: number;
  signals?: string[];
  showConfidence?: boolean;
}) {
  if (!layer) return null;
  const tone = STABILITY_COLORS[layer] ?? "text-white/55";
  const displayLabel = STABILITY_LABELS[layer] ?? layer;
  const shape = STABILITY_SHAPES[layer];
  const description = STABILITY_DESCRIPTIONS[layer];

  const tooltipLines: string[] = [];
  if (description) tooltipLines.push(description);
  if (typeof confidence === "number") {
    tooltipLines.push(`Confidence: ${Math.round(confidence * 100)}%`);
  }
  if (signals && signals.length > 0) {
    tooltipLines.push(`Signals: ${signals.join(" · ")}`);
  }
  const tooltip = tooltipLines.join("\n\n");

  const confPct =
    typeof confidence === "number" ? Math.round(confidence * 100) : null;

  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 font-mono text-[10px] uppercase tracking-widest ${tone}`}
      title={tooltip}
    >
      {shape && (
        <span aria-hidden="true" className="text-[12px] leading-none">
          {shape}
        </span>
      )}
      <span aria-hidden="true">{displayLabel}</span>
      {showConfidence && confPct !== null && (
        <span aria-hidden="true" className="text-white/40">
          {confPct}%
        </span>
      )}
      <span className="sr-only">
        stability layer {displayLabel}
        {confPct !== null ? `, confidence ${confPct}%` : ""}
        {description ? `. ${description}` : ""}
      </span>
    </span>
  );
}

/**
 * Compact legend that explains the 4 stability layers. Designed for placement
 * in a section header's rightSlot (e.g. inside `<PanelHeader rightSlot={...}>`
 * for the Colors section), or anywhere a user might first encounter a chip.
 *
 * Uses native `<details>` so it's keyboard-accessible, requires no client
 * JS, and progressively discloses — collapsed by default to avoid clutter.
 */
export function StabilityLegend() {
  const layers: Array<keyof typeof STABILITY_COLORS> = [
    "infrastructure",
    "system",
    "campaign",
    "content",
  ];
  return (
    <details className="inline-block">
      <summary className="cursor-pointer font-pixel text-[10px] uppercase tracking-widest text-white/45 transition-colors hover:text-white">
        what do these labels mean? ⓘ
      </summary>
      <div className="mt-3 grid grid-cols-1 gap-3 border border-white/10 bg-black p-4 sm:grid-cols-2">
        {layers.map((layer) => (
          <div key={layer} className="flex items-start gap-2">
            <span
              className={`shrink-0 text-[14px] leading-none ${STABILITY_COLORS[layer]}`}
              aria-hidden="true"
            >
              {STABILITY_SHAPES[layer]}
            </span>
            <div>
              <p
                className={`font-pixel text-[10px] uppercase tracking-widest ${STABILITY_COLORS[layer]}`}
              >
                {STABILITY_LABELS[layer]}
              </p>
              <p className="mt-1 text-[11px] leading-relaxed text-white/65">
                {STABILITY_DESCRIPTIONS[layer]}
              </p>
            </div>
          </div>
        ))}
      </div>
    </details>
  );
}
