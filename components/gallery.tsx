import Image from "next/image";
import type { ComponentType, SVGProps } from "react";
import {
  SiAntdesign,
  SiAtlassian,
  SiGithub,
  SiGoogle,
  SiLinear,
  SiPinterest,
  SiRaycast,
  SiShopify,
  SiStripe,
  SiSupabase,
  SiVercel,
  SiWise,
} from "@icons-pack/react-simple-icons";
import { BubbleButton } from "@/components/bubble-button";
import { ArrowLineIcon } from "@/icons/arrow-line";

// First four ship with committed gold DESIGN.md files in examples/.
// The rest are placeholders until they pass extractor vetting (anti-bot,
// design-system completeness). Update `live: true` once they're curated.
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
  // Honest, reproducible per-brand metrics derived from the extracted
  // tokens.json. `colors` = count of OKLCH-clustered color tokens,
  // `tokens` = total token count (colors + type + spacing + radius +
  // shadow). Previous `views` / `installs` were placeholder telemetry
  // and a trust risk on a pre-launch site, so we swapped to numbers
  // that the engine itself produces and anyone can re-verify by
  // running `pnpm engine:extract <url>`.
  colors?: number;
  tokens?: number;
  badge?: Badge;
};

const GALLERY: GalleryEntry[] = [
  {
    slug: "wise",
    name: "Wise",
    tagline: "International money transfer",
    // Bright Green → Forest Green: Wise's two-color brand pairing
    // (#9FE870 primary accent, #163300 ink/dark surface) verified
    // against wise.design.
    swatch: "linear-gradient(135deg,#9fe870,#163300)",
    Logo: SiWise,
    live: true,
    // Real counts from examples/wise/tokens.json (must stay in sync if the
    // file is regenerated): 17 colorTokens; 17 typographyLevels + 13 spacing
    // scale + 13 radiusTokens + 2 shadowTokens = 45 non-color tokens →
    // 62 total tokens.
    colors: 17,
    tokens: 62,
    badge: "hot",
  },
  {
    slug: "stripe",
    name: "Stripe",
    tagline: "Payments infrastructure",
    swatch: "linear-gradient(135deg,#635bff,#7a73ff)",
    Logo: SiStripe,
    live: true,
    colors: 76,
    tokens: 142,
  },
  {
    slug: "ibm",
    name: "IBM",
    tagline: "Carbon design system",
    swatch: "linear-gradient(135deg,#0f62fe,#002d9c)",
    logoSrc: "/ibm.png",
    live: true,
    colors: 56,
    tokens: 128,
    badge: "hot",
  },
  {
    slug: "linear",
    name: "Linear",
    tagline: "Issue tracking",
    swatch: "linear-gradient(135deg,#5e6ad2,#8b93ff)",
    Logo: SiLinear,
    live: true,
    colors: 40,
    tokens: 92,
  },
  {
    slug: "vercel",
    name: "Vercel",
    tagline: "Frontend cloud",
    swatch: "linear-gradient(135deg,#000000,#404040)",
    Logo: SiVercel,
    live: true,
    colors: 47,
    tokens: 88,
  },
  {
    slug: "supabase",
    name: "Supabase",
    tagline: "Postgres + auth",
    swatch: "linear-gradient(135deg,#3ecf8e,#1f6f4d)",
    Logo: SiSupabase,
    live: true,
    colors: 17,
    tokens: 64,
    badge: "new",
  },
  // Popular / trending public design systems. All `live: false` until each
  // has a curated extraction committed to `examples/<slug>/`. Each tagline
  // names the design system the brand publishes so a viewer reading the
  // card knows what the eventual extraction will be verifiable against.
  {
    slug: "github",
    name: "GitHub",
    tagline: "Primer",
    swatch: "linear-gradient(135deg,#24292f,#0d1117)",
    Logo: SiGithub,
    live: false,
  },
  {
    slug: "shopify",
    name: "Shopify",
    tagline: "Ecommerce platform",
    // Captured accent pairing  Mint (#36f4a4) into the classic bag
    // green (#95bf47)  verified at extraction time against the live
    // shopify.com surface. Tagline follows the descriptor pattern of
    // the other live entries (Wise = "International money transfer",
    // Stripe = "Payments infrastructure") rather than claiming a
    // design-system name; the captured palette is shopify.com's own
    // marketing surface, which is Polaris-adjacent (shares Inter, the
    // 450/550 font weights, and the Magic-purple token) but not a
    // 1:1 admin-Polaris extraction.
    swatch: "linear-gradient(135deg,#36f4a4,#95bf47)",
    Logo: SiShopify,
    live: true,
    colors: 32,
    tokens: 78,
    badge: "new",
  },
  {
    slug: "atlassian",
    name: "Atlassian",
    tagline: "Atlassian Design System",
    swatch: "linear-gradient(135deg,#0052cc,#2684ff)",
    Logo: SiAtlassian,
    live: false,
  },
  {
    slug: "pinterest",
    name: "Pinterest",
    tagline: "Gestalt",
    swatch: "linear-gradient(135deg,#e60023,#ad081b)",
    Logo: SiPinterest,
    live: false,
  },
  {
    slug: "material",
    name: "Material",
    tagline: "Material Design 3",
    // Google's product hero blue + the Material 3 accent green
    swatch: "linear-gradient(135deg,#0061a4,#5cb874)",
    Logo: SiGoogle,
    live: false,
  },
  {
    slug: "antdesign",
    name: "Ant Design",
    tagline: "Ant Design (React)",
    swatch: "linear-gradient(135deg,#1677ff,#0958d9)",
    Logo: SiAntdesign,
    live: false,
  },
  // Adobe / Microsoft / Twilio / Salesforce don't ship in @icons-pack
  // (Adobe + Microsoft excluded for trademark; Twilio + Salesforce just
  // absent). Logo slot stays empty  the centered brand name carries
  // recognition on the coming-soon overlay.
  {
    slug: "adobe",
    name: "Adobe",
    tagline: "Spectrum",
    swatch: "linear-gradient(135deg,#fa0f00,#b1041d)",
    live: false,
  },
  {
    slug: "microsoft",
    name: "Microsoft",
    tagline: "Fluent 2",
    swatch: "linear-gradient(135deg,#0078d4,#003a76)",
    live: false,
  },
  {
    slug: "twilio",
    name: "Twilio",
    tagline: "Paste",
    swatch: "linear-gradient(135deg,#f22f46,#9f1c2b)",
    live: false,
  },
  {
    slug: "salesforce",
    name: "Salesforce",
    tagline: "Lightning Design System",
    swatch: "linear-gradient(135deg,#00a1e0,#0070d2)",
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

// Home-page slice: the first 10 entries from GALLERY ("hottest" order is
// the array order  Wise/Stripe/IBM lead, then the most-recognised public
// design systems) plus MakeMyAISite pinned as the 11th slot for the
// promotional callout. 11 brand cards + view-all bubble = 12 grid cells,
// which lays out cleanly as 3×4 on lg, 2×6 on sm, 1×12 on mobile.
//
// Anything beyond this slice surfaces on /gallery (the "view all" page).
const HOME_GALLERY: GalleryEntry[] = (() => {
  const top = GALLERY.slice(0, 10);
  const promo = GALLERY.find((g) => g.slug === "makemyaisite");
  return promo ? [...top, promo] : top;
})();

export function Gallery({
  variant = "full",
}: {
  /**
   * `"home"` shows the hottest 10 + MakeMyAISite + a "view all gallery"
   * bubble pointing to /gallery. `"full"` lists every entry with no
   * view-all (we're already on /gallery in that case).
   */
  variant?: "home" | "full";
} = {}) {
  const entries = variant === "home" ? HOME_GALLERY : GALLERY;
  const showViewAll = variant === "home";
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
        {entries.map((b) => (
          <li key={b.slug} className="flex items-stretch">
            <GalleryCard entry={b} />
            <StatsPanel entry={b} />
          </li>
        ))}
        {showViewAll && (
          <li className="flex items-center justify-end">
            <BubbleButton
              href="/gallery"
              aria-label="View all gallery entries"
              icon={<ArrowLineIcon className="size-4" />}
            >
              view all gallery
            </BubbleButton>
          </li>
        )}
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
            width={48}
            height={48}
            sizes="(min-width: 640px) 3rem, 2.25rem"
            className="size-9 object-contain drop-shadow-[0_1px_3px_rgba(0,0,0,0.45)] sm:size-12"
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
        href={`/gallery/${entry.slug}`}
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
// blue bar. Order top→bottom: badge (optional) · colors · tokens.
//
// Stats are *honest, reproducible* numbers from the engine: colors =
// extracted color-cluster count, tokens = total token count across colors,
// type, spacing, radius, shadow. Anyone can verify by re-running
// `pnpm engine:extract <url>`.
function StatsPanel({ entry }: { entry: GalleryEntry }) {
  const hasData = entry.live && entry.colors != null && entry.tokens != null;

  const ariaLabel = (() => {
    const parts: string[] = [`${entry.name} info`];
    if (entry.badge) parts.push(entry.badge);
    if (hasData) {
      parts.push(`${formatCount(entry.colors!)} colors`);
      parts.push(`${formatCount(entry.tokens!)} tokens`);
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
        value={hasData ? formatCount(entry.colors!) : ""}
        label="colors"
        dim={!hasData}
      />
      <div className={divider} />
      <StatCell
        value={hasData ? formatCount(entry.tokens!) : ""}
        label="tokens"
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
