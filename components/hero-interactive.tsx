import type { CSSProperties, ReactNode } from "react";

type HeroInteractiveProps = {
  children: ReactNode;
};

// Number of bars across the hero. Higher → smoother wave + more GPU work.
// 32 lands a clean middle ground at modern viewport widths.
const BAR_COUNT = 32;

// Symmetric V silhouette computed once at module scope. Power-curve falloff
// (|t|^1.3) gives a gentler dip near the middle than a strict linear V,
// matching the reference's slightly-rounded valley.
const HERO_BAR_SCALES = Array.from({ length: BAR_COUNT }, (_, i) => {
  const t = (i - (BAR_COUNT - 1) / 2) / ((BAR_COUNT - 1) / 2); // -1 → 1
  const abs = Math.abs(t);
  return 0.1 + 0.5 * Math.pow(abs, 1.3);
});

// Stagger step (seconds) between consecutive bars' animation delays.
// Smaller → faster left-to-right wave propagation.
const STAGGER_STEP = 0.22;

// Per-bar duration variation: cycles through five values (8.5 – 10.5s) so
// the row never settles into a single mechanical beat. Each bar picks its
// duration based on its index mod 5.
const DURATION_VARIANTS = ["8.5s", "9.0s", "9.5s", "10.0s", "10.5s"];

const BAR_BASIS = `${(100 / BAR_COUNT).toFixed(4)}%`;

export function HeroInteractive({ children }: HeroInteractiveProps) {
  return (
    <section
      aria-labelledby="hero-heading"
      className="relative isolate flex flex-col items-center overflow-hidden px-6 pt-12 pb-32 text-center sm:pt-20"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 flex items-end"
        style={{
          backfaceVisibility: "hidden",
          transform: "translateZ(0)",
          // Scope layout/paint/style to this subtree so the 32 bars'
          // continuous animation never invalidates anything outside.
          contain: "layout paint style",
        }}
      >
        {HERO_BAR_SCALES.map((scale, i) => (
          <div
            key={i}
            className="h-full"
            style={
              {
                flex: `1 0 ${BAR_BASIS}`,
                maxWidth: BAR_BASIS,
                transformOrigin: "center bottom",
                transform: `scaleY(${scale.toFixed(3)})`,
              } as CSSProperties
            }
          >
            <div
              className="hero-grad-bar h-full w-full"
              style={{
                // Negative delay starts each bar mid-cycle, so on first paint
                // the row is already in its steady pulsing state — no visible
                // "fade-in from dim" on page load.
                animationDelay: `${(-i * STAGGER_STEP).toFixed(2)}s`,
                animationDuration: DURATION_VARIANTS[i % DURATION_VARIANTS.length],
              }}
            />
          </div>
        ))}
      </div>

      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          backgroundImage:
            "radial-gradient(rgba(255,255,255,0.07) 1px, transparent 1px)",
          backgroundSize: "26px 26px",
          maskImage:
            "radial-gradient(ellipse at center, black 25%, transparent 75%)",
          WebkitMaskImage:
            "radial-gradient(ellipse at center, black 25%, transparent 75%)",
        }}
      />

      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-40 bg-linear-to-t from-black to-transparent"
      />

      {children}
    </section>
  );
}
