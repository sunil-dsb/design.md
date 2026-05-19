"use client";

import { useState } from "react";
import { HighlightedMd } from "./highlight-md";
import { WisePreview } from "./wise-preview";

type TabId = "design" | "preview" | "tailwind" | "shadcn";

type Props = {
  designMd: string;
  previewHtml: string;
  // Real per-brand CSS read from examples/<brand>/{tailwind.css, shadcn-theme.css}
  // by the server parent. Nullable so older example folders that predate
  // the emitters fall through to a placeholder message instead of stale
  // generic-purple samples that don't match the showcased brand.
  tailwindCss: string | null;
  shadcnCss: string | null;
  exampleLabel: string;
};

// Placeholder shown only when the brand's CSS file is missing on disk.
// Wise (the home demo) has both, so this is a defensive fallback  not
// the visible-on-load state.
const MISSING_PLACEHOLDER = (format: string, brand: string) =>
  `/* ${format} for ${brand} has not been generated yet.\n * The DESIGN.md and preview.html on the other tabs are still real;\n * the CSS emitters just haven't run for this example folder.\n */`;

// `badge` is a small uppercase chip after the tab label. Currently only
// "hot" exists (filled primary, attention-grabbing) for freshly-shipped
// tabs. New badge values can be added to the union  rendering branches
// on the value, so adding "new" or "beta" later is a single-line change.
type Tab = {
  id: TabId;
  label: string;
  badge?: "hot";
};

const TABS: Tab[] = [
  { id: "design", label: "DESIGN.md" },
  { id: "preview", label: "preview.html" },
  { id: "tailwind", label: "tailwind.css", badge: "hot" },
  { id: "shadcn", label: "shadcn.css" },
];

export function SpecTabs({
  designMd,
  previewHtml,
  tailwindCss,
  shadcnCss,
  exampleLabel,
}: Props) {
  const [active, setActive] = useState<TabId>("design");

  return (
    <>
      {/* Tabs bar */}
      <div
        role="tablist"
        aria-label="DESIGN.md output formats"
        className="flex items-stretch overflow-x-auto border-b border-white/10 bg-black"
      >
        {TABS.map((t) => {
          const isActive = active === t.id;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              aria-controls={`spec-panel-${t.id}`}
              id={`spec-tab-${t.id}`}
              onClick={() => setActive(t.id)}
              className={
                "flex shrink-0 items-center gap-2 border-r border-white/10 px-4 py-2 font-mono text-xs transition " +
                (isActive
                  ? "border-b-2 border-b-primary bg-white/3 text-white"
                  : "text-white/40 hover:bg-white/3 hover:text-white/70")
              }
            >
              <span
                aria-hidden="true"
                className={
                  "size-1.5 rounded-full " +
                  (isActive ? "bg-primary" : "bg-white/20")
                }
              />
              {t.label}
              {t.badge ? (
                <span className="ml-1 bg-primary px-1.5 py-0.5 font-pixel text-[9px] tracking-widest text-white uppercase">
                  {t.badge}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      {/* Split view */}
      <div className="grid grid-cols-1 lg:grid-cols-2">
        {/* Editor pane (swaps per active tab) */}
        <div
          tabIndex={0}
          role="tabpanel"
          id={`spec-panel-${active}`}
          aria-labelledby={`spec-tab-${active}`}
          className="relative h-80 overflow-auto focus-visible:outline-2 focus-visible:outline-primary lg:h-112"
        >
          {active === "design" ? (
            <EditorPane source={designMd} highlight />
          ) : null}
          {active === "preview" ? <EditorPane source={previewHtml} /> : null}
          {active === "tailwind" ? (
            <EditorPane
              source={
                tailwindCss ?? MISSING_PLACEHOLDER("tailwind.css", exampleLabel)
              }
              banner={`Tailwind v4 @theme  ${exampleLabel}`}
            />
          ) : null}
          {active === "shadcn" ? (
            <EditorPane
              source={
                shadcnCss ?? MISSING_PLACEHOLDER("shadcn-theme.css", exampleLabel)
              }
              banner={`shadcn/ui theme  ${exampleLabel}`}
            />
          ) : null}

          {/* Scroll-hint gradient */}
          <div
            aria-hidden="true"
            className="pointer-events-none sticky bottom-0 -mt-12 h-12 bg-linear-to-t from-black to-transparent"
          />
        </div>

        {/* Preview pane (always the same  the rendered HTML preview) */}
        <div className="relative h-80 border-t border-white/15 lg:h-112 lg:border-t-0 lg:border-l">
          <div className="absolute inset-x-0 top-0 z-10 flex items-center gap-2 border-b border-black/10 bg-white px-3 py-2 font-mono text-[10px] text-black/50">
            <span
              aria-hidden="true"
              className="flex items-center gap-0.5 text-black/30"
            >
              <span>‹</span>
              <span>›</span>
            </span>
            <span
              aria-hidden="true"
              className="size-1.5 rounded-full bg-[#28c840]"
            />
            <span className="flex min-w-0 flex-1 items-center gap-1 truncate rounded-sm bg-black/[0.04] px-2 py-0.5">
              <span className="text-black/40">file://</span>
              <span className="truncate text-black/70">
                {exampleLabel}/DESIGN.md
              </span>
            </span>
          </div>
          {/* Brand-on-brand rich render of the Wise design system —
              replaces the auto-generated preview.html iframe with a
              hand-tailored React component so the showcase actually
              looks like wise.com rather than a generic auto-rendered
              page. `previewHtml` prop stays for backwards-compat with
              the parent's data load; can be removed in a follow-up
              cleanup once no consumer reads it. */}
          <WisePreview />
        </div>
      </div>
    </>
  );
}

function EditorPane({
  source,
  highlight,
  banner,
}: {
  source: string;
  highlight?: boolean;
  banner?: string;
}) {
  const lineCount = source.split("\n").length;
  return (
    <div className="flex min-h-full">
      <div
        aria-hidden="true"
        className="sticky left-0 z-10 select-none border-r border-white/10 bg-black px-3 py-5 text-right font-mono text-xs leading-relaxed text-white/25"
      >
        {Array.from({ length: lineCount }, (_, i) => (
          <div key={i}>{i + 1}</div>
        ))}
      </div>
      <div className="relative flex-1">
        {banner ? (
          <div className="sticky top-0 z-10 flex items-center gap-2 border-b border-primary/25 bg-primary/10 px-4 py-2 font-pixel text-[10px] tracking-widest text-primary uppercase backdrop-blur">
            <span
              aria-hidden="true"
              className="size-1.5 rounded-full bg-primary"
            />
            {banner}
          </div>
        ) : null}
        <pre className="px-4 py-5 text-left text-sm leading-relaxed text-white/85">
          <code className="font-mono">
            {highlight ? <HighlightedMd source={source} /> : source}
          </code>
        </pre>
      </div>
    </div>
  );
}
