import type { ReactNode } from "react";

type HeroInteractiveProps = {
  children: ReactNode;
};

export function HeroInteractive({ children }: HeroInteractiveProps) {
  return (
    <section
      aria-labelledby="hero-heading"
      className="relative isolate flex flex-col items-center overflow-hidden px-6 pt-12 pb-32 text-center sm:pt-20"
    >
      <div aria-hidden="true" className="absolute inset-0 -z-10">
        <span className="hero-beam hero-beam--1" />
        <span className="hero-beam hero-beam--2" />
        <span className="hero-beam hero-beam--3" />
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
