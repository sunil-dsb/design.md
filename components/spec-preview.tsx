import { promises as fs } from "node:fs";
import path from "node:path";
import { SpecTabs } from "./spec-tabs";

// Showcased example. Both files live in /examples/<brand>/ and are read on
// the server at render time (statically rendered → baked into the build).
// The server component owns the file reads + the static chrome/status bar;
// the actual tabs + editor pane are delegated to <SpecTabs> (client) so
// users can switch between DESIGN.md / preview.html / tailwind / shadcn.
const EXAMPLE_BRAND = "stripe";
const EXAMPLE_LABEL = "stripe.com";

export async function SpecPreview() {
  const dir = path.join(process.cwd(), "examples", EXAMPLE_BRAND);
  const [designMd, previewHtml] = await Promise.all([
    fs.readFile(path.join(dir, "DESIGN.md"), "utf8"),
    fs.readFile(path.join(dir, "preview.html"), "utf8"),
  ]);

  // Stats for the bottom status bar  derived once at render time.
  const lineCount = designMd.split("\n").length;
  const sectionCount = (designMd.match(/^##\s/gm) || []).length;
  const tokenCount = (designMd.match(/^\s{2,}[a-z][a-z0-9-]*:/gim) || [])
    .length;
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
          A real DESIGN.md markdown source on the left, rendered preview on the
          right. Switch tabs to see what we&apos;ll emit alongside.
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
            <span className="font-pixel text-xs tracking-widest text-white/60 uppercase">
              spec preview
            </span>
          </div>
          <span className="shrink-0 font-pixel text-xs tracking-widest text-primary uppercase">
            {EXAMPLE_LABEL}
          </span>
        </figcaption>

        {/* Tabs + split view (client) */}
        <SpecTabs
          designMd={designMd}
          previewHtml={previewHtml}
          exampleLabel={EXAMPLE_LABEL}
        />

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
          <span className="font-pixel text-[10px] tracking-widest text-white/55 uppercase">
            spec v2
          </span>
        </div>
      </figure>
    </section>
  );
}
