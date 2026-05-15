// Shared stability chip  used by the extract result panel AND the
// /gallery/<brand> brand viewer so both flows render the chip identically.
//
// Tracks the classifier in lib/engine/cluster.ts:
//   infrastructure (most stable, foundational tokens)
//   → system (consistent patterns across pages)
//   → campaign (short-lived banners / one-offs)
//   → content (most volatile, page-specific)
//
// Tone colours picked from Tailwind palettes that read well on the
// near-black surface used throughout the SPA.

// Stability-layer colour map. Exported so other components that need the
// same colour-coding (e.g. a future sidebar legend) can reference it.
export const STABILITY_COLORS: Record<string, string> = {
  infrastructure: "text-emerald-300",
  system: "text-sky-300",
  campaign: "text-amber-300",
  content: "text-rose-300",
};

export function StabilityChip({
  layer,
  confidence,
  signals,
}: {
  layer?: string;
  confidence?: number;
  signals?: string[];
}) {
  if (!layer) return null;
  const tone = STABILITY_COLORS[layer] ?? "text-white/55";
  const tooltip =
    signals && signals.length > 0 ? signals.join(" · ") : undefined;
  const confPct =
    typeof confidence === "number" ? Math.round(confidence * 100) : null;
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 font-mono text-[10px] uppercase tracking-widest ${tone}`}
      title={tooltip}
    >
      <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
      <span aria-hidden="true">{layer}</span>
      {confPct !== null && (
        <span aria-hidden="true" className="text-white/40">
          {confPct}%
        </span>
      )}
      <span className="sr-only">
        stability {layer}
        {confPct !== null ? `, confidence ${confPct}%` : ""}
        {signals && signals.length > 0
          ? `, signals: ${signals.join(", ")}`
          : ""}
      </span>
    </span>
  );
}
