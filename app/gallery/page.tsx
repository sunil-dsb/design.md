// Gallery index  the destination of the "view all gallery" button on the
// home page. Lists every curated brand. Clicking a card opens the brand's
// design system at /gallery/<brand>.
//
// Server component  the gallery roster is statically known (hardcoded in
// components/gallery.tsx for now). Future: derive from examples/ at build
// time so adding a brand is a single-folder change.

import type { Metadata } from "next";
import { AnnouncementBar } from "@/components/announcement-bar";
import { Footer } from "@/components/footer";
import { Gallery } from "@/components/gallery";
import { GenerateCta } from "@/components/generate-cta";
import { Navbar } from "@/components/navbar";
import { SkipLink } from "@/components/skip-link";

export const metadata: Metadata = {
  title: "Gallery",
  description:
    "Curated DESIGN.md files for popular brands  ready to drop into your AI agent. Each entry is a full design system extraction: colors, typography, spacing, radius, and shadows.",
};

export default function GalleryIndexPage() {
  return (
    <>
      <SkipLink />
      <AnnouncementBar />
      <Navbar />
      <main
        id="main"
        tabIndex={-1}
        className="flex flex-1 flex-col outline-none"
      >
        <header className="mx-auto w-full max-w-5xl px-6 pt-12 pb-8 sm:pt-16 sm:px-10">
          <p className="mb-4 inline-flex items-center gap-2 font-pixel text-xs uppercase tracking-widest text-white/55">
            <span
              aria-hidden="true"
              className="size-1.5 rounded-full bg-primary"
            />
            curated design systems
          </p>
          <h1 className="font-pixel text-4xl leading-[1.05] tracking-tight sm:text-6xl">
            gallery<span className="text-primary">.</span>
          </h1>
          <p className="mt-6 max-w-2xl text-base leading-7 text-white/70">
            Every entry below is a real DESIGN.md extracted from the brand&apos;s
            live site and hand-curated against their canonical palette.
            Click any card to see the full design system  colors, typography,
            spacing, radius, shadows, and the source DESIGN.md.
          </p>
        </header>

        <Gallery />

        <GenerateCta />
      </main>
      <Footer />
    </>
  );
}
