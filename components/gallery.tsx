import Image from "next/image";
import type { ComponentType, SVGProps } from "react";
import {
  SiCursor,
  SiGithub,
  SiLinear,
  SiRaycast,
  SiStripe,
  SiSupabase,
  SiVercel,
} from "@icons-pack/react-simple-icons";
import { BubbleButton } from "@/components/bubble-button";
import { ArrowLineIcon } from "@/icons/arrow-line";

// First four ship with committed gold DESIGN.md files in examples/.
// The rest are placeholders until they pass extractor vetting (anti-bot,
// design-system completeness). Update `live: true` once they're curated.
//
// `views` / `installs` are illustrative until real telemetry is wired up
// (planned post-launch). They live in this file so it's a one-line change
// when we swap to a real data source.
type Badge = "hot" | "new";

type LogoComponent = ComponentType<SVGProps<SVGSVGElement>>;

type GalleryEntry = {
  slug: string;
  name: string;
  tagline: string;
  swatch: string;
  Logo?: LogoComponent;
  logoSrc?: string;
  live: boolean;
  views?: number;
  installs?: number;
  badge?: Badge;
};

const GALLERY: GalleryEntry[] = [
  {
    slug: "stripe",
    name: "Stripe",
    tagline: "Payments infrastructure",
    swatch: "linear-gradient(135deg,#635bff,#7a73ff)",
    Logo: SiStripe,
    live: true,
    views: 12_400,
    installs: 2_100,
    badge: "hot",
  },
  {
    slug: "linear",
    name: "Linear",
    tagline: "Issue tracking",
    swatch: "linear-gradient(135deg,#5e6ad2,#8b93ff)",
    Logo: SiLinear,
    live: true,
    views: 8_700,
    installs: 1_420,
    badge: "hot",
  },
  {
    slug: "vercel",
    name: "Vercel",
    tagline: "Frontend cloud",
    swatch: "linear-gradient(135deg,#000000,#404040)",
    Logo: SiVercel,
    live: true,
    views: 5_240,
    installs: 940,
  },
  {
    slug: "supabase",
    name: "Supabase",
    tagline: "Postgres + auth",
    swatch: "linear-gradient(135deg,#3ecf8e,#1f6f4d)",
    Logo: SiSupabase,
    live: true,
    views: 3_120,
    installs: 520,
    badge: "new",
  },
  {
    slug: "cursor",
    name: "Cursor",
    tagline: "AI code editor",
    swatch: "linear-gradient(135deg,#0c0c0c,#3a3a3a)",
    Logo: SiCursor,
    live: false,
  },
  {
    slug: "raycast",
    name: "Raycast",
    tagline: "Mac launcher",
    swatch: "linear-gradient(135deg,#ff6363,#ff8a3d)",
    Logo: SiRaycast,
    live: false,
  },
  {
    slug: "github",
    name: "GitHub",
    tagline: "Code hosting",
    swatch: "linear-gradient(135deg,#24292f,#0d1117)",
    Logo: SiGithub,
    live: false,
  },
  {
    slug: "makemyaisite",
    name: "MakeMyAISite",
    tagline: "AI website builder",
    swatch: "linear-gradient(135deg,#000000,#1a1a1a)",
    logoSrc: "/mmai.png",
    live: false,
  },
];

// 12_400 → "12.4k". Under 1k stays as-is. One decimal for k.
function formatCount(n: number): string {
  if (n >= 1_000) {
    return `${(n / 1_000).toFixed(1)}k`;
  }
  return String(n);
}

export function Gallery() {
  return (
    <section
      id="gallery"
      aria-labelledby="gallery-heading"
      className="mx-auto w-full max-w-5xl px-6 pb-24 sm:px-10"
    >
      <header className="mb-8">
        <h2 id="gallery-heading" className="font-pixel text-2xl tracking-tight">
          gallery
        </h2>
        <p className="mt-2 text-sm text-white/60">
          Ready-made DESIGN.md files extracted from popular brands.
        </p>
      </header>

      <ul
        role="list"
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
      >
        {GALLERY.map((b) => (
          <li key={b.slug} className="flex items-stretch">
            <GalleryCard entry={b} />
            <StatsPanel entry={b} />
          </li>
        ))}
        <li className="flex items-center justify-end">
          <BubbleButton
            href="/gallery"
            aria-label="View all gallery entries"
            icon={<ArrowLineIcon className="size-4" />}
          >
            view all gallery
          </BubbleButton>
        </li>
      </ul>
    </section>
  );
}

function GalleryCard({ entry }: { entry: GalleryEntry }) {
  // The swatch is the visual hero of the card: brand-color gradient, a
  // subtle dot-grid overlay for the pixel-vibe texture, the brand name
  // centered as the "stamp," and a corner badge when one's set.
  const swatch = (
    <div
      className="relative aspect-5/3 w-full overflow-hidden"
      style={{ background: entry.swatch }}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-30"
        style={{
          backgroundImage:
            "radial-gradient(rgba(255,255,255,0.6) 1px, transparent 1px)",
          backgroundSize: "10px 10px",
        }}
      />
      <span
        aria-hidden="true"
        className="absolute inset-0 flex flex-col items-center justify-center gap-2"
      >
        {entry.Logo ? (
          <entry.Logo
            aria-hidden="true"
            focusable="false"
            className="size-8 text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.45)] sm:size-10"
          />
        ) : entry.logoSrc ? (
          <Image
            src={entry.logoSrc}
            alt=""
            width={32}
            height={32}
            sizes="(min-width: 640px) 2rem, 1.5rem"
            className="size-6 object-contain drop-shadow-[0_1px_3px_rgba(0,0,0,0.45)] sm:size-8"
          />
        ) : null}
        <span className="font-pixel text-sm tracking-tight text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.4)] lowercase">
          {entry.name}
        </span>
      </span>
    </div>
  );

  if (entry.live) {
    // Append badge state to aria-label so screen readers hear "hot" / "new"
    //  they otherwise wouldn't (aria-label overrides nested text).
    const badgeSuffix = entry.badge ? `  ${entry.badge}` : "";
    return (
      <a
        href={`#${entry.slug}`}
        aria-label={`Open ${entry.name} DESIGN.md${badgeSuffix}`}
        className="group flex flex-1 flex-col overflow-hidden border border-white/10 bg-black transition hover:border-white/40 focus-visible:border-primary"
      >
        {swatch}
        <div className="flex flex-1 flex-col border-t border-white/10 px-4 py-3">
          <div className="flex items-center justify-between gap-2">
            <span className="font-pixel text-xs tracking-wide text-white">
              {entry.name}
            </span>
            <span
              aria-hidden="true"
              className="font-mono text-[10px] text-white/30 transition group-hover:translate-x-0.5 group-hover:text-white/80"
            >
              →
            </span>
          </div>
          <p className="mt-1 truncate text-xs text-white/55">{entry.tagline}</p>
        </div>
      </a>
    );
  }

  // Coming-soon cards used to be `opacity-60` to read as muted, but stacking
  // that opacity on already-translucent text dropped labels below WCAG
  // contrast (effective ~0.24 on black for the label). We now drop the
  // global opacity and instead dim just the swatch via a black overlay
  // keeps the brand recognisable as "less active" while letting the meta
  // text stay fully readable.
  return (
    <article
      aria-label={`${entry.name}  need sign`}
      className="relative flex flex-1 flex-col overflow-hidden border border-white/10 bg-black"
    >
      <div className="relative">
        {swatch}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-black/40"
        />
      </div>
      <div className="flex flex-1 flex-col border-t border-white/10 px-4 py-3">
        <div className="font-pixel text-xs tracking-wide text-white">
          {entry.name}
        </div>
        <p className="mt-1 font-mono text-[10px] tracking-widest text-white/70 uppercase">
          need sign
        </p>
      </div>
    </article>
  );
}

// Detached metadata column. Brand-primary blue body with white text;
// when a badge is set the badge sits in its own cell at the top with an
// inverse treatment (white bg, blue text) so it visually pops off the
// blue bar. Order top→bottom: badge (optional) · views · installs.
function StatsPanel({ entry }: { entry: GalleryEntry }) {
  const hasData = entry.live && entry.views != null && entry.installs != null;

  const ariaLabel = (() => {
    const parts: string[] = [`${entry.name} info`];
    if (entry.badge) parts.push(entry.badge);
    if (hasData) {
      parts.push(`${formatCount(entry.views!)} views`);
      parts.push(`${formatCount(entry.installs!)} installs`);
    } else {
      parts.push("stats not yet available");
    }
    return parts.join(", ");
  })();

  const divider = hasData
    ? "border-t border-white/15"
    : "border-t border-white/5";

  return (
    <aside
      aria-label={ariaLabel}
      className={
        "flex w-14 flex-col text-white sm:w-16 " +
        // bg-white/10 + text-white at full opacity meets WCAG AA on near-black;
        // the previous bg-white/5 + text-white/40 fell below contrast threshold.
        (hasData ? "bg-primary" : "bg-white/10")
      }
    >
      {entry.badge && hasData ? (
        <>
          <BadgeCell badge={entry.badge} />
          <div className={divider} />
        </>
      ) : null}
      <StatCell
        value={hasData ? formatCount(entry.views!) : ""}
        label="views"
        dim={!hasData}
      />
      <div className={divider} />
      <StatCell
        value={hasData ? formatCount(entry.installs!) : ""}
        label="installs"
        dim={!hasData}
      />
    </aside>
  );
}

function StatCell({
  value,
  label,
  dim,
}: {
  value: string;
  label: string;
  dim: boolean;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-0.5 px-1 py-3 text-center">
      <span className="font-pixel text-base leading-none tracking-tight">
        {value}
      </span>
      <span
        className={
          "font-mono text-[8px] tracking-wide uppercase " +
          // text-white at 70% on bg-white/10 over black, and full white on
          // bg-primary, both clear WCAG AA for small text. The previous
          // `/30` on the dim panel was the main contrast offender.
          (dim ? "text-white/70" : "text-white")
        }
      >
        {label}
      </span>
    </div>
  );
}

// Badge cell  a small white pill *inset* within the blue bar. Outer
// container is transparent (the parent's blue shows through, framing the
// pill on all sides); inner span is the actual white-on-blue badge,
// sized to content. Reads as "an accent nested inside the bar" rather
// than a horizontal stripe.
function BadgeCell({ badge }: { badge: Badge }) {
  const hot = badge === "hot";
  return (
    <div className="flex shrink-0 items-center justify-center px-1.5 py-2">
      <span className="flex items-center justify-center gap-1 bg-white px-2 py-1 text-primary">
        {hot ? (
          <span aria-hidden="true" className="text-xs leading-none">
            🔥
          </span>
        ) : null}
        <span className="text-[10px] leading-none font-medium tracking-wide uppercase">
          {badge}
        </span>
      </span>
    </div>
  );
}
