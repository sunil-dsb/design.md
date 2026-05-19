import { HeroSearchForm } from "./hero-search-form";

// Conversion CTA shown at the bottom of every gallery page  the index
// page (/gallery) and each brand page (/gallery/<brand>). Mirrors the
// /why bottom-CTA so the visual language is consistent across secondary
// surfaces: pixel-font kicker, large headline, supporting line, then the
// inline URL form. Server component  the only client island is the
// nested HeroSearchForm.
//
// Why inline form, not a button → /:
// The reader is at peak intent after scrolling a full brand teardown
// (or the gallery roster). A button that bounces them to the home form
// adds a navigation hop right when they're ready to paste. The form
// here is the same component used in the hero, with the same smart hint
// ("✓ Wise is already curated  enter opens /gallery/wise"), so pasting
// a curated brand still routes to its gallery entry without a round
// trip to /.
//
// The optional brand prop personalises the line on a brand page
// ("like wise.com?  paste any URL"). On the gallery index it stays
// generic.
export function GenerateCta({ brand }: { brand?: string } = {}) {
  const branded = brand
    ? brand.charAt(0).toUpperCase() + brand.slice(1)
    : null;

  // Self-contained width constraint  the gallery index renders this as a
  // direct child of <main> (no surrounding max-w wrapper), while the brand
  // page renders it inside <article className="max-w-5xl">. The outer
  // wrapper here keeps both paths visually identical without coupling
  // callers to a specific layout.
  return (
    <section
      aria-labelledby="generate-cta-heading"
      className="mx-auto mt-20 w-full max-w-5xl px-6 sm:px-10"
    >
      <div className="border border-white/15 bg-white/2 px-6 py-14 text-center sm:px-12 sm:py-16">
        <p className="mb-3 font-pixel text-xs uppercase tracking-widest text-white">
          your turn
        </p>
        <h2
          id="generate-cta-heading"
          className="font-pixel text-2xl tracking-tight sm:text-4xl"
        >
          Extract any website&apos;s{" "}
          <span className="text-primary">DESIGN.md</span>
        </h2>
        <p className="mx-auto mt-5 max-w-md text-white/60">
          {branded
            ? `Like ${branded}? Paste any URL  colors, typography, spacing, radius, shadows, and the source DESIGN.md, free.`
            : "Paste any URL. Get a full design system back  colors, typography, spacing, radius, shadows, and the source DESIGN.md. Free, MIT, no signup."}
        </p>
        <HeroSearchForm className="mx-auto mt-8 w-full max-w-xl text-left" />
      </div>
    </section>
  );
}
