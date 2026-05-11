import { DigitRain } from "./digit-rain";

// Big footer with three decorative layers stacked over a black bg:
//   1. animated blue mesh gradient blobs (.scene-gradient in globals.css)
//   2. interactive digit-rain canvas, masked to fade out toward the bottom
//   3. a top-side black-to-transparent overlay that hides the digit-rain
//      ceiling
// On top of all three: a giant "design.md" pixel-font wordmark anchored
// to the bottom-center. Mobile gets a shorter footer via Tailwind so the
// wordmark doesn't crowd the viewport.
//
// Sizing was previously over-parametrised — six props nobody set. The
// hardcoded values below match what every caller was already passing.
export function Footer() {
  return (
    <footer className="relative h-105 w-full overflow-hidden bg-black max-sm:h-65!">
      <div
        aria-hidden="true"
        className="scene-gradient scene-gradient--fade pointer-events-none absolute inset-0"
      >
        <span className="scene-blob scene-blob--1" />
        <span className="scene-blob scene-blob--2" />
        <span className="scene-blob scene-blob--3" />
        <span className="scene-blob scene-blob--4" />
      </div>

      <div
        className="absolute inset-0"
        style={{
          maskImage:
            "linear-gradient(to bottom, black 0%, black 45%, transparent 80%)",
          WebkitMaskImage:
            "linear-gradient(to bottom, black 0%, black 45%, transparent 80%)",
        }}
      >
        <DigitRain />
      </div>

      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-linear-to-b from-black to-transparent"
      />

      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center">
        <span className="font-pixel text-[22vw] leading-[0.82] tracking-tight text-white/90 sm:text-[18vw]">
          design.md
        </span>
      </div>
    </footer>
  );
}
