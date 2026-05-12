"use client";

import { useState } from "react";
import { HighlightedMd } from "./highlight-md";

type TabId = "design" | "preview" | "tailwind" | "shadcn";

type Props = {
  designMd: string;
  previewHtml: string;
  exampleLabel: string;
};

// Static placeholder content for the formats we plan to emit but haven't
// wired yet (plan-v1.md W6a/W6b). Shown verbatim under the corresponding
// tab so users can see the shape of the output we'll generate per brand.
const TAILWIND_SAMPLE = `@theme {
  --color-brand-50:  oklch(0.985 0.005 260);
  --color-brand-100: oklch(0.95  0.04  260);
  --color-brand-500: oklch(0.63  0.18  260);
  --color-brand-600: oklch(0.55  0.18  260);
  --color-brand-950: oklch(0.13  0.04  260);

  --font-display: "Geist Sans";
  --font-body:    "Geist Sans";
  --font-mono:    "Geist Mono";

  --spacing-base: 4px;
  --radius-md:    0.5rem;
  --radius-lg:    0.75rem;
}`;

const SHADCN_SAMPLE = `:root {
  --background:           oklch(1     0     0);
  --foreground:           oklch(0.15  0     0);
  --primary:              oklch(0.63  0.18  260);
  --primary-foreground:   oklch(0.98  0     0);
  --secondary:            oklch(0.97  0     0);
  --secondary-foreground: oklch(0.15  0     0);
  --muted:                oklch(0.97  0     0);
  --muted-foreground:     oklch(0.55  0     0);
  --border:               oklch(0.9   0     0);
  --ring:                 oklch(0.63  0.18  260 / 0.5);
  --radius:               0.5rem;
}`;

type Tab = {
  id: TabId;
  label: string;
  soon?: boolean;
};

const TABS: Tab[] = [
  { id: "design", label: "DESIGN.md" },
  { id: "preview", label: "preview.html" },
  { id: "tailwind", label: "tailwind.css", soon: true },
  { id: "shadcn", label: "shadcn.css", soon: true },
];

export function SpecTabs({ designMd, previewHtml, exampleLabel }: Props) {
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
              {t.soon ? (
                <span className="ml-1 bg-primary/20 px-1.5 py-0.5 font-pixel text-[9px] tracking-widest text-primary uppercase">
                  soon
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
              source={TAILWIND_SAMPLE}
              banner="Tailwind v4 @theme — generated per brand"
            />
          ) : null}
          {active === "shadcn" ? (
            <EditorPane
              source={SHADCN_SAMPLE}
              banner="shadcn/ui theme — generated per brand"
            />
          ) : null}

          {/* Scroll-hint gradient */}
          <div
            aria-hidden="true"
            className="pointer-events-none sticky bottom-0 -mt-12 h-12 bg-linear-to-t from-black to-transparent"
          />
        </div>

        {/* Preview pane (always the same — the rendered HTML preview) */}
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
          <iframe
            srcDoc={previewHtml}
            title={`${exampleLabel} DESIGN.md rendered preview`}
            sandbox=""
            loading="lazy"
            className="h-full w-full border-0 bg-white pt-9"
          />
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
