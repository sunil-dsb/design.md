import { promises as fs } from "node:fs";
import path from "node:path";

// Showcased example. Both files live in /examples/<brand>/ and are read on
// the server at render time (statically rendered → baked into the build).
const EXAMPLE_BRAND = "stripe";
const EXAMPLE_LABEL = "stripe.com";

export async function SpecPreview() {
  const dir = path.join(process.cwd(), "examples", EXAMPLE_BRAND);
  const [designMd, previewHtml] = await Promise.all([
    fs.readFile(path.join(dir, "DESIGN.md"), "utf8"),
    fs.readFile(path.join(dir, "preview.html"), "utf8"),
  ]);

  const lines = designMd.split("\n");
  const lineCount = lines.length;
  const sectionCount = (designMd.match(/^##\s/gm) || []).length;
  const tokenCount = (designMd.match(/^\s{2,}[a-z][a-z0-9-]*:/gim) || []).length;
  const sizeKb = (new TextEncoder().encode(designMd).length / 1024).toFixed(1);

  return (
    <section
      id="spec"
      aria-labelledby="spec-heading"
      className="mx-auto w-full max-w-5xl px-6 pb-24 sm:px-10"
    >
      <header className="mb-8">
        <h2 id="spec-heading" className="font-pixel text-2xl tracking-tight">
          example
        </h2>
        <p className="mt-2 text-sm text-white/60">
          A real DESIGN.md — markdown source on the left, rendered preview on
          the right.
        </p>
      </header>

      <figure className="overflow-hidden border border-white/15 bg-black">
        {/* macOS window chrome */}
        <figcaption className="flex items-center justify-between gap-3 border-b border-white/15 bg-white/6 px-4 py-2.5">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex shrink-0 items-center gap-2">
              <span
                aria-hidden="true"
                className="size-3 rounded-full bg-[#ff5f57]"
              />
              <span
                aria-hidden="true"
                className="size-3 rounded-full bg-[#febc2e]"
              />
              <span
                aria-hidden="true"
                className="size-3 rounded-full bg-[#28c840]"
              />
            </span>
            <span className="font-pixel text-xs uppercase tracking-widest text-white/60">
              spec preview
            </span>
          </div>
          <span className="shrink-0 font-pixel text-xs uppercase tracking-widest text-white">
            {EXAMPLE_LABEL}
          </span>
        </figcaption>

        {/* File-tabs bar */}
        <div className="flex items-stretch border-b border-white/10 bg-black">
          <span
            aria-hidden="true"
            className="flex items-center gap-2 border-r border-white/10 border-b-2 border-b-primary bg-white/3 px-4 py-2 font-mono text-xs text-white"
          >
            <span className="size-1.5 rounded-full bg-primary" />
            DESIGN.md
          </span>
          <span
            aria-hidden="true"
            className="flex items-center gap-2 border-r border-white/10 px-4 py-2 font-mono text-xs text-white/40"
          >
            preview.html
          </span>
          <span className="flex-1" />
          <span
            aria-hidden="true"
            className="hidden items-center px-4 py-2 font-pixel text-[10px] uppercase tracking-widest text-white/40 sm:flex"
          >
            split view
          </span>
        </div>

        {/* Split view */}
        <div className="grid grid-cols-1 lg:grid-cols-2">
          {/* Editor pane */}
          <div
            tabIndex={0}
            role="region"
            aria-label={`${EXAMPLE_LABEL} DESIGN.md source`}
            className="relative h-80 overflow-auto focus-visible:outline-2 focus-visible:outline-primary lg:h-112"
          >
            <div className="flex min-h-full">
              <div
                aria-hidden="true"
                className="sticky left-0 select-none border-r border-white/10 bg-black px-3 py-5 text-right font-mono text-xs leading-relaxed text-white/25"
              >
                {Array.from({ length: lineCount }, (_, i) => (
                  <div key={i}>{i + 1}</div>
                ))}
              </div>
              <pre className="flex-1 px-4 py-5 text-left text-sm leading-relaxed text-white/85">
                <code>{designMd}</code>
              </pre>
            </div>
          </div>

          {/* Preview pane */}
          <div className="relative h-80 border-t border-white/15 lg:h-112 lg:border-t-0 lg:border-l">
            <div className="absolute inset-x-0 top-0 z-10 flex items-center gap-2 border-b border-black/10 bg-white px-3 py-2 font-mono text-[10px] text-black/50">
              <span aria-hidden="true" className="size-1.5 rounded-full bg-[#28c840]" />
              <span className="truncate">
                {EXAMPLE_LABEL}/DESIGN.md → rendered
              </span>
            </div>
            <iframe
              srcDoc={previewHtml}
              title={`${EXAMPLE_LABEL} DESIGN.md rendered preview`}
              sandbox=""
              loading="lazy"
              className="h-full w-full border-0 bg-white pt-8"
            />
          </div>
        </div>

        {/* Status bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 bg-white/3 px-4 py-2 font-mono text-[10px] text-white/45">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5">
              <span
                aria-hidden="true"
                className="size-1.5 rounded-full bg-primary"
              />
              <span className="text-white/70">ready</span>
            </span>
            <span>
              <span className="text-white/70">{lineCount}</span> lines
            </span>
            <span>
              <span className="text-white/70">{sectionCount}</span> sections
            </span>
            <span>
              <span className="text-white/70">{tokenCount}</span> tokens
            </span>
            <span>
              <span className="text-white/70">{sizeKb}</span> kb
            </span>
          </div>
          <span className="font-pixel text-[10px] uppercase tracking-widest text-white/55">
            spec v2
          </span>
        </div>
      </figure>
    </section>
  );
}
