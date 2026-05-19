import Image from "next/image";
import type { ComponentType, SVGProps } from "react";
import {
  SiCursor,
  SiGithub,
  SiLinear,
  SiRaycast,
  SiResend,
  SiStripe,
  SiSupabase,
  SiVercel,
  SiWise,
} from "@icons-pack/react-simple-icons";
import { GoogleIcon } from "@/icons/google";
import { HeroInteractive } from "./hero-interactive";
import { HeroSearchForm } from "./hero-search-form";

//  Marquee data
// Server-rendered text + brand logos, scrolled by a CSS-only animation.
// Every entry lands in the page's HTML, so crawlers index the keywords
// without us shipping a single byte of JS for the effect.

type Brand = {
  name: string;
  // One of these is required. Logo wins when both are set. Simple Icons
  // doesn't ship every brand (IBM was removed for trademark reasons), so
  // logoSrc covers the long tail with a local public/ asset.
  Logo?: ComponentType<SVGProps<SVGSVGElement>>;
  logoSrc?: string;
};

// Row 1: brands we extract design systems from. Each pill carries a logo
// for visual recognition (the same Simple Icons used by the gallery).
const BRANDS: Brand[] = [
  { name: "wise", Logo: SiWise },
  { name: "stripe", Logo: SiStripe },
  { name: "ibm", logoSrc: "/ibm.png" },
  { name: "linear", Logo: SiLinear },
  { name: "vercel", Logo: SiVercel },
  { name: "supabase", Logo: SiSupabase },
  { name: "cursor", Logo: SiCursor },
  { name: "raycast", Logo: SiRaycast },
  { name: "resend", Logo: SiResend },
  { name: "github", Logo: SiGithub },
];

// Row 2: formats we emit + AI agents we target. Text-only, scrolls in the
// opposite direction so the two rows never visually align.
const KEYWORDS = [
  "tailwind v4",
  "shadcn theme",
  "OKLCH ramps",
  "WCAG AA",
  "design tokens",
  "dark mode",
  "Claude Code",
  "v0",
  "Lovable",
  "Replit",
  "Windsurf",
  "Copilot",
];

const LEFT_SPRITES = [
  {
    src: "/hero/front-right.webp",
    className: "absolute left-[4%] top-[45%] w-24 sm:w-32",
  },
];

const RIGHT_SPRITES = [
  {
    src: "/hero/front-left-confused.webp",
    className: "absolute right-[8%] bottom-[16%] w-24 sm:w-32",
  },
];

const TOP_SPRITES = [
  {
    src: "/hero/front-confused.webp",
    className: "absolute right-[24%] top-[4%] w-20 sm:w-28",
  },
];

// Hero: the H1, tagline, and the URL-paste form that POSTs to /extract.
// One h1 per page lives here. The form submits as `GET /extract?url=…`,
// where the extract page reads useSearchParams and prefills its input.
export function Hero() {
  return (
    <HeroInteractive>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 hidden sm:block"
      >
        {[...LEFT_SPRITES, ...RIGHT_SPRITES, ...TOP_SPRITES].map((s) => (
          // `unoptimized` because these are animated WebPs  Next.js's image
          // optimizer can only output single frames and refuses animated
          // sources. Serving the original file preserves the animation.
          <Image
            key={s.src}
            src={s.src}
            alt=""
            width={165}
            height={123}
            unoptimized
            className={`h-auto ${s.className}`}
          />
        ))}
      </div>

      <a
        href="https://stitch.withgoogle.com/docs/design-md/overview"
        target="_blank"
        rel="noopener noreferrer"
        className="absolute top-1/2 right-0 z-10 hidden -translate-y-1/2 items-center gap-1.5 bg-primary px-2 py-3 font-pixel text-[10px] tracking-widest text-white uppercase transition [writing-mode:vertical-rl] hover:brightness-110 sm:flex"
      >
        <span>Built on</span>
        <GoogleIcon
          aria-hidden="true"
          focusable="false"
          className="size-3 shrink-0 rotate-90"
        />
        <span className="sr-only">Google</span>
        <span>DESIGN.md spec</span>
      </a>

      <a
        href="https://github.com/sunil-dsb/design.md"
        target="_blank"
        rel="noopener noreferrer"
        className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/15 px-3 py-1 text-xs text-white/70 transition hover:border-white/30 hover:text-white"
      >
        <span aria-hidden="true" className="size-1.5 rounded-full bg-primary" />
        v1 · open source
      </a>

      <h1
        id="hero-heading"
        className="font-pixel text-6xl leading-[1.05] tracking-tight sm:text-8xl md:text-9xl"
      >
        design<span className="text-primary">.</span>md
      </h1>

      <p className="mt-8 max-w-xl text-base leading-7 text-white/70 sm:text-lg">
        The <span className="text-white">most accurate</span> DESIGN.md generator.
        Perceptual color clustering + pixel-fidelity verification.
        <span className="text-white"> Free forever.</span> Open source, MIT.
      </p>

      {/* Client island  the form needs JS for the inline hint that shows
          "✓ Wise is already curated  enter opens /gallery/wise" while
          typing, and to intercept submit for the gallery-shortcut redirect. */}
      <HeroSearchForm />

      {/* Two-row scrolling marquee. Pure server-rendered text + inline
          SVG logos (no JS), scrolled by a CSS-only animation. Both rows
          double their content in the markup so the translate(-50%) loop
          is seamless  the duplicate halves are aria-hidden to keep
          screen readers from hearing each item twice. */}
      {/* Section divider  centered pixel-font label flanked by hairlines.
          Reads as a chapter break between the form and the marquee. The
          lines hide on very narrow screens via responsive width so the
          label keeps room to breathe on a 320px viewport. */}
      <div className="mt-20 mb-6 flex items-center justify-center gap-4">
        <span aria-hidden="true" className="h-px w-10 bg-white/15 sm:w-20" />
        <p className="font-pixel text-[11px] tracking-[0.25em] text-white/55 uppercase">
          extracted from · emits to · used by
        </p>
        <span aria-hidden="true" className="h-px w-10 bg-white/15 sm:w-20" />
      </div>

      {/* Row 1: brands with logos, scrolls left.
          The list is rendered THREE times (not two): with only one set the
          original 8 items at ~140px each (~1120px) are narrower than a
          1440px desktop viewport, so at translateX(-50%) the right edge of
          the track would clear the right edge of the viewport leaving a
          visible empty band. Three copies + a -33.333% translate keeps the
          track at least 2× viewport-wide at every animation phase, so the
          loop is invisible. The CSS animation's `to` value must match the
          1 / copies fraction (see globals.css hero-marquee-scroll). */}
      <div
        aria-label="Brands we extract design systems from"
        className="hero-marquee w-screen max-w-[100vw]"
      >
        <ul role="list" className="hero-marquee__track">
          {[0, 1, 2].flatMap((copy) =>
            BRANDS.map((b) => (
              <li
                key={`${b.name}-${copy}`}
                aria-hidden={copy > 0 ? "true" : undefined}
                className="hero-marquee__item"
              >
                {b.Logo ? (
                  <b.Logo
                    aria-hidden="true"
                    focusable="false"
                    className="size-3 shrink-0"
                  />
                ) : b.logoSrc ? (
                  <Image
                    src={b.logoSrc}
                    alt=""
                    width={12}
                    height={12}
                    className="size-3 shrink-0 object-contain"
                  />
                ) : null}
                {b.name}
              </li>
            )),
          )}
        </ul>
      </div>

      {/* Row 2: formats + AI agents, scrolls RIGHT (opposite direction so
          the two rows never visually align). Same three-copy strategy. */}
      <div
        aria-label="Formats we emit and AI agents we support"
        className="hero-marquee hero-marquee--reverse mt-3 w-screen max-w-[100vw]"
      >
        <ul role="list" className="hero-marquee__track">
          {[0, 1, 2].flatMap((copy) =>
            KEYWORDS.map((k) => (
              <li
                key={`${k}-${copy}`}
                aria-hidden={copy > 0 ? "true" : undefined}
                className="hero-marquee__item"
              >
                {k}
              </li>
            )),
          )}
        </ul>
      </div>
    </HeroInteractive>
  );
}
