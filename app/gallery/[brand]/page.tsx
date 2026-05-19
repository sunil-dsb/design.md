// Brand DESIGN.md viewer  one URL per curated brand under examples/.
// Visits like /gallery/stripe render the full design system extracted for
// that brand: named colors, typography, spacing, radius, shadows, plus the
// agent-written DESIGN.md prose as syntax-highlighted source.
//
// Server component  data is read from examples/<brand>/ at request time
// (or build time when generateStaticParams enumerates a brand). No client
// JS needed; everything renders on the server.
//
// generateStaticParams enumerates brands so the four committed examples
// SSG at build, giving instant load. Unknown brands return 404.

import * as fs from "fs";
import * as path from "path";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Link from "next/link";
import { notFound } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { AnnouncementBar } from "@/components/announcement-bar";
import { CopyHex } from "@/components/copy-hex";
import { Footer } from "@/components/footer";
import { GenerateCta } from "@/components/generate-cta";
import { LongTailColors } from "@/components/long-tail-colors";
import { BrandDownloads } from "@/components/brand-downloads";
import { MdActions } from "@/components/md-actions";
import { Navbar } from "@/components/navbar";
import { SkipLink } from "@/components/skip-link";
import { StabilityChip } from "@/components/stability-chip";
import {
  assignColorRoles,
  assignTypeRoles,
  rolePriority,
  type ColorRole,
} from "@/lib/engine/role-namer";
import type { DesignTokens } from "@/lib/engine/types";

// Inter is the canonical free close-match for Stripe's sohne-var, Linear's
// Inter Display, Vercel's Geist, and most modern product fonts. We load it
// once via next/font/google (self-hosted, no FOUT) and expose it as the
// CSS variable `--font-component` so the components-in-action section
// can pick it up. The brand's *declared* fontFamily still ships in the
// font-family stack first  designers with the proprietary font installed
// locally see the real thing; everyone else lands on Inter. Must sit
// AFTER imports (it's not an import itself  ESLint's import-order linter
// occasionally reshuffles  re-anchor it here if that happens).
const componentFont = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-component",
  display: "swap",
});

const EXAMPLES_ROOT = path.resolve(process.cwd(), "examples");

// Strict allowlist: only directories that actually have tokens.json are
// valid brands. Resists path traversal (notFound() for anything outside
// this list) and self-documents what /gallery serves.
function listBrandSlugs(): string[] {
  if (!fs.existsSync(EXAMPLES_ROOT)) return [];
  return fs
    .readdirSync(EXAMPLES_ROOT, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .filter((d) =>
      fs.existsSync(path.join(EXAMPLES_ROOT, d.name, "tokens.json")),
    )
    .map((d) => d.name)
    .sort();
}

export function generateStaticParams(): Array<{ brand: string }> {
  return listBrandSlugs().map((brand) => ({ brand }));
}

interface BrandData {
  brand: string;
  tokens: DesignTokens;
  /** DESIGN.md content. Still read into memory because the bottom
   *  DesignMdSection renders it inline via ReactMarkdown. The TOP
   *  download bar uses /api/example links and does NOT need this. */
  designMd: string | null;
  sourceUrl: string | null;
  /** True when a generated DESIGN.md sits next to the tokens. */
  hasDesignMd: boolean;
  /** Flags only  no file contents. Used by BrandDownloads to decide
   *  which buttons to render. The actual bytes are streamed by
   *  /api/example/<brand>/<file> on download click, not embedded in
   *  the page payload. Cut /gallery/wise from 3.3 MB to ~500 KB by
   *  not serializing the 1.8 MB tokens.json into the React tree. */
  hasTokensJson: boolean;
  hasTailwindCss: boolean;
  hasShadcnCss: boolean;
}

function loadBrand(brand: string): BrandData | null {
  if (!listBrandSlugs().includes(brand)) return null;
  const dir = path.join(EXAMPLES_ROOT, brand);
  try {
    const tokens = JSON.parse(
      fs.readFileSync(path.join(dir, "tokens.json"), "utf-8"),
    ) as DesignTokens;

    // Apply role-namer + type-namer in memory so the page surface uses
    // role-friendly labels (Primary / Ink / Canvas / etc.) like the
    // extract result panel does. Same pattern as app/scoreboard/page.tsx
    // never mutates the on-disk file.
    if (Array.isArray(tokens.colorTokens)) {
      tokens.colorTokens = assignColorRoles(tokens.colorTokens);
    }
    if (Array.isArray(tokens.typographyLevels)) {
      tokens.typographyLevels = assignTypeRoles(tokens.typographyLevels);
    }

    const designMdPath = path.join(dir, "DESIGN.md");
    const designMd = fs.existsSync(designMdPath)
      ? fs.readFileSync(designMdPath, "utf-8")
      : null;
    const sourceUrl = tokens.meta?.sourceUrls?.[0] ?? null;

    return {
      brand,
      tokens,
      designMd,
      sourceUrl,
      hasDesignMd: designMd !== null,
      // The tokens.json file is read above (we need to parse it); the
      // flag is true here unconditionally because if it didn't exist
      // we'd have caught that on the readFileSync line.
      hasTokensJson: true,
      hasTailwindCss: fs.existsSync(path.join(dir, "tailwind.css")),
      hasShadcnCss: fs.existsSync(path.join(dir, "shadcn-theme.css")),
    };
  } catch {
    return null;
  }
}

function displayName(brand: string): string {
  return brand.charAt(0).toUpperCase() + brand.slice(1);
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ brand: string }>;
}): Promise<Metadata> {
  const { brand } = await params;
  if (!listBrandSlugs().includes(brand)) {
    return { title: "Not found" };
  }
  const name = displayName(brand);
  return {
    title: `${name} design system`,
    description: `${name}'s extracted design system  colors, typography, spacing, radius, and shadows. Plus the curated DESIGN.md.`,
  };
}

export default async function BrandGalleryPage({
  params,
}: {
  params: Promise<{ brand: string }>;
}) {
  const { brand } = await params;
  const data = loadBrand(brand);
  if (!data) notFound();

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
        <article className="mx-auto w-full max-w-5xl px-6 pt-12 pb-24 sm:pt-16">
          <TopRow />
          <BrandHeader data={data} />
          <BrandStats data={data} />
          {/* Section ordering mirrors the live /extract result page:
              Colors (1) → Typography (2) → Buttons (3) → Spacing (4)
              → Radius (5) → Shadows (6) → Cards (7) → DESIGN.md (8).
              Buttons surface early because they're the highest-signal
              interactive element; Cards sit after Shadows because card
              styles depend on the elevation/surface tokens above. The
              download CTA in BrandHeader covers the "I just want the
              file" path; the full DESIGN.md section at the bottom is
              for users who want to read it inline before grabbing. */}
          <ColorsSection tokens={data.tokens} />
          <TypographySection tokens={data.tokens} />
          <ComponentsSection
            brand={data.brand}
            tokens={data.tokens}
            section="buttons"
          />
          <SpacingSection tokens={data.tokens} />
          <RadiusSection tokens={data.tokens} />
          <ShadowsSection tokens={data.tokens} />
          <ComponentsSection
            brand={data.brand}
            tokens={data.tokens}
            section="cards"
          />
          {data.designMd && (
            <DesignMdSection brand={data.brand} source={data.designMd} />
          )}
        </article>

        {/* Conversion hand-off  the reader just scrolled through a full
            brand teardown. Sibling of <article>, not a child, because
            the CTA is a hand-off to the *reader*, not part of the
            brand's design system content. Self-contained max-width so
            it lines up with the article above. */}
        <GenerateCta brand={data.brand} />
      </main>
      <Footer />
    </>
  );
}

//  Sections

// Single row at the top of every brand page: "← gallery" pinned left,
// "curated design system" pill pinned right. Replaces the old breadcrumb
// + in-header pill stack so the page opens cleaner.
function TopRow() {
  return (
    <div className="mb-6 flex items-center justify-between gap-3">
      <Link
        href="/gallery"
        className="font-pixel text-[10px] uppercase tracking-widest text-white/55 transition hover:text-white"
      >
        ← gallery
      </Link>
      <p className="inline-flex items-center gap-2 font-pixel text-[10px] uppercase tracking-widest text-white/55">
        <span aria-hidden="true" className="size-1.5 rounded-full bg-primary" />
        curated design system
      </p>
    </div>
  );
}

function BrandHeader({ data }: { data: BrandData }) {
  const name = displayName(data.brand);
  // Normalise the source URL to host-only: strip scheme, trailing slash, and
  // a leading `www.` so the headline reads as a clean root domain.
  const host = data.sourceUrl
    ? data.sourceUrl
        .replace(/^https?:\/\//, "")
        .replace(/^www\./, "")
        .replace(/\/$/, "")
    : null;

  // Split the host at the last dot so we can colour the dot with the
  // primary-accent treatment used elsewhere on the SPA. "stripe.com" →
  // ["stripe", "com"]; "linear.app" → ["linear", "app"]. Fallback to the
  // capitalised brand slug if for some reason there's no URL.
  const lastDot = host ? host.lastIndexOf(".") : -1;
  const stem = host && lastDot > 0 ? host.slice(0, lastDot) : name;
  const tld = host && lastDot > 0 ? host.slice(lastDot + 1) : "md";

  return (
    <header>
      <h1 className="font-pixel text-4xl leading-[1.05] tracking-tight sm:text-6xl">
        {stem}
        <span className="text-primary">.</span>
        {tld}
      </h1>
      {host && (
        <p className="mt-6 max-w-2xl text-base leading-7 text-white/70">
          Extracted from{" "}
          <a
            href={data.sourceUrl ?? "#"}
            target="_blank"
            rel="noopener noreferrer"
            className="font-mono text-white underline decoration-white/30 underline-offset-4 hover:decoration-white"
          >
            {host}
          </a>{" "}
          and curated against the {name} brand. Every value below is real
          tokens read from{" "}
          <code className="font-mono text-white/85">
            examples/{data.brand}/tokens.json
          </code>
          .
        </p>
      )}
      {/* Top-of-page download bar. DESIGN.md is the primary CTA (right-
          aligned, green tone); tokens.json + tailwind.css + shadcn-
          theme.css sit on the left as supporting artifacts. The bar
          appears above the fold on most viewports so users who just
          want the file don't have to scroll past the colour / type /
          component proof to find it.
          BrandDownloads is a SERVER component and renders plain `<a
          href download>` anchors pointing at /api/example/<brand>/...
          so file contents stay off the page payload  the previous
          implementation embedded the full tokens.json (1.8 MB on Wise)
          as a React prop, bloating /gallery/wise to 3.3 MB. */}
      {data.hasDesignMd && (
        <div className="mt-8">
          <BrandDownloads
            brand={data.brand}
            hasDesignMd={data.hasDesignMd}
            hasTokensJson={data.hasTokensJson}
            hasTailwindCss={data.hasTailwindCss}
            hasShadcnCss={data.hasShadcnCss}
          />
        </div>
      )}
    </header>
  );
}

function BrandStats({ data }: { data: BrandData }) {
  const t = data.tokens;
  const colorCount = t.colorTokens?.length ?? 0;
  const typoCount = t.typographyLevels?.length ?? 0;
  const shadowCount = t.shadowTokens?.length ?? 0;
  const radiusCount = t.radiusTokens?.length ?? 0;
  const baseUnit = t.spacingSystem?.baseUnit;
  const primary = (t.colorTokens ?? []).find(
    (c) => (c as { role?: string | null }).role === "primary",
  );
  return (
    <section className="mt-10 grid grid-cols-2 gap-px overflow-hidden border border-white/10 bg-white/10 sm:grid-cols-3 lg:grid-cols-6">
      <Stat label="colors" value={String(colorCount)} />
      <Stat label="typography" value={String(typoCount)} />
      <Stat label="shadows" value={String(shadowCount)} />
      <Stat label="radii" value={String(radiusCount)} />
      <Stat
        label="spacing base"
        value={baseUnit ? `${baseUnit}px` : "—"}
      />
      <Stat
        label="primary"
        value={primary ? primary.hex : "—"}
        mono
      />
    </section>
  );
}

function Stat({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1 bg-black px-5 py-4">
      <span className="font-pixel text-[10px] uppercase tracking-widest text-white/55">
        {label}
      </span>
      <span
        className={`text-base text-white ${mono ? "font-mono text-sm" : "font-pixel"}`}
      >
        {value}
      </span>
    </div>
  );
}

function SectionHeader({
  index,
  label,
  count,
}: {
  index: number;
  label: string;
  count?: number;
}) {
  return (
    <div className="mb-4 flex items-center gap-3">
      <span
        aria-hidden="true"
        className="font-pixel text-xs uppercase tracking-widest text-primary"
      >
        {String(index).padStart(2, "0")}
      </span>
      <span aria-hidden="true" className="h-px flex-1 bg-white/10" />
      <h2 className="font-pixel text-sm uppercase tracking-widest text-white">
        {label}
        {typeof count === "number" && (
          <span className="ml-2 text-white/40">· {count}</span>
        )}
      </h2>
    </div>
  );
}

//  Section: Colors

function ColorsSection({ tokens }: { tokens: DesignTokens }) {
  const colors = tokens.colorTokens ?? [];
  if (colors.length === 0) return null;

  // Same sort as extract-client.tsx: role-priority first, frequency tiebreak.
  const namedColors = colors
    .filter((c) => (c as { roleLabel?: string | null }).roleLabel)
    .slice()
    .sort((a, b) => {
      const pa = rolePriority(
        (a as { role?: ColorRole | null }).role ?? null,
      );
      const pb = rolePriority(
        (b as { role?: ColorRole | null }).role ?? null,
      );
      if (pa !== pb) return pa - pb;
      return b.frequency - a.frequency;
    });
  const longTail = colors.filter(
    (c) => !(c as { roleLabel?: string | null }).roleLabel,
  );

  return (
    <section className="mt-16">
      <SectionHeader index={1} label="colors" count={colors.length} />

      {namedColors.length > 0 && (
        <div className="grid grid-cols-2 gap-px overflow-hidden border border-white/10 bg-white/10 sm:grid-cols-3 md:grid-cols-4">
          {namedColors.map((c, i) => (
            <ColorCard
              key={`${c.hex}-named-${i}`}
              hex={c.hex}
              label={(c as { roleLabel?: string | null }).roleLabel!}
              frequency={c.frequency}
              stability={
                (c as { stability?: { layer: string; confidence: number; signals?: string[] } }).stability
              }
            />
          ))}
        </div>
      )}

      {longTail.length > 0 && (
        <LongTailColors
          colors={longTail.map((c) => ({
            hex: c.hex,
            frequency: c.frequency,
          }))}
        />
      )}
    </section>
  );
}

function ColorCard({
  hex,
  label,
  frequency,
  stability,
}: {
  hex: string;
  label: string;
  frequency: number;
  stability?: { layer: string; confidence: number; signals?: string[] };
}) {
  return (
    <div className="flex flex-col bg-black">
      <div
        className="relative aspect-4/3 w-full overflow-hidden"
        style={{ background: hex }}
      >
        <div
          aria-hidden="true"
          className="absolute inset-0 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06),inset_0_-1px_24px_rgba(0,0,0,0.18)]"
        />
      </div>
      <div className="flex flex-col gap-2 border-t border-white/10 p-4">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate font-pixel text-sm tracking-wide text-white">
            {label}
          </p>
          <span className="shrink-0 font-pixel text-[10px] uppercase tracking-widest text-primary">
            {frequency}×
          </span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <CopyHex value={hex} />
          <StabilityChip
            layer={stability?.layer}
            confidence={stability?.confidence}
            signals={stability?.signals}
          />
        </div>
      </div>
    </div>
  );
}

//  Section: Typography

function TypographySection({ tokens }: { tokens: DesignTokens }) {
  const levels = tokens.typographyLevels ?? [];
  if (levels.length === 0) return null;

  return (
    <section className="mt-16">
      <SectionHeader index={2} label="typography" count={levels.length} />
      <ul role="list" className="divide-y divide-white/10 border border-white/10">
        {levels.map((t, i) => {
          const stab =
            (t as { stability?: { layer: string; confidence: number; signals?: string[] } }).stability;
          const roleLabel =
            (t as { roleLabel?: string | null }).roleLabel ?? "";
          return (
            <li key={`${t.fontFamily}-${t.fontSize}-${i}`} className="flex items-center gap-5 px-5 py-5">
              <span
                aria-hidden="true"
                className="w-6 shrink-0 font-pixel text-[10px] uppercase tracking-widest text-primary"
              >
                {String(i + 1).padStart(2, "0")}
              </span>
              <div className="min-w-0 flex-1">
                <p
                  aria-hidden="true"
                  style={{
                    fontFamily: `'${t.fontFamily}', system-ui, sans-serif`,
                    fontSize: `min(${t.fontSize}, 3rem)`,
                    fontWeight: t.fontWeight,
                    lineHeight: 1.1,
                  }}
                  className="truncate text-white"
                >
                  {roleLabel
                    ? roleLabel.charAt(0).toUpperCase() + roleLabel.slice(1)
                    : "Aa Bb Cc"}
                </p>
                <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="font-pixel text-[10px] uppercase tracking-widest text-white">
                    {roleLabel}
                  </span>
                  <span
                    aria-hidden="true"
                    className="font-mono text-xs text-white/35"
                  >
                    ·
                  </span>
                  <span className="font-mono text-xs text-white/80">
                    {t.fontSize}
                  </span>
                  <span
                    aria-hidden="true"
                    className="font-mono text-xs text-white/35"
                  >
                    ·
                  </span>
                  <span className="font-mono text-xs text-white/80">
                    w{t.fontWeight}
                  </span>
                  <span
                    aria-hidden="true"
                    className="font-mono text-xs text-white/35"
                  >
                    ·
                  </span>
                  <span className="truncate font-mono text-xs text-white/60">
                    {t.fontFamily}
                  </span>
                  {stab?.layer && (
                    <>
                      <span
                        aria-hidden="true"
                        className="font-mono text-xs text-white/35"
                      >
                        ·
                      </span>
                      <StabilityChip
                        layer={stab.layer}
                        confidence={stab.confidence}
                        signals={stab.signals}
                      />
                    </>
                  )}
                </p>
              </div>
              <span
                aria-hidden="true"
                className="shrink-0 font-pixel text-[10px] uppercase tracking-widest text-primary"
              >
                {t.frequency}×
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

//  Section: Spacing

function SpacingSection({ tokens }: { tokens: DesignTokens }) {
  const spacing = tokens.spacingSystem;
  if (!spacing || !Array.isArray(spacing.scale) || spacing.scale.length === 0) {
    return null;
  }
  const scale = spacing.scale.slice().sort((a, b) => a - b);
  // Scale the visual width by the largest step so the relative size of
  // each step reads at a glance. Cap so a 4px step still has a visible bar.
  const maxStep = scale[scale.length - 1];
  return (
    <section className="mt-16">
      <SectionHeader index={4} label="spacing" count={scale.length} />
      <div className="border border-white/10 bg-black p-6">
        <p className="mb-4 font-pixel text-[10px] uppercase tracking-widest text-white/55">
          base unit · {spacing.baseUnit}px
        </p>
        <ul role="list" className="flex flex-col gap-2">
          {scale.map((step) => (
            <li key={step} className="flex items-center gap-3">
              <span className="w-12 shrink-0 font-mono text-xs text-white/70">
                {step}px
              </span>
              <span
                aria-hidden="true"
                className="block h-3 rounded-sm bg-primary/80"
                style={{
                  width: `${Math.max(2, (step / maxStep) * 100)}%`,
                }}
              />
            </li>
          ))}
        </ul>
        {spacing.maxContentWidth && (
          <p className="mt-6 font-mono text-xs text-white/55">
            max content width:{" "}
            <span className="text-white/85">{spacing.maxContentWidth}</span>
          </p>
        )}
      </div>
    </section>
  );
}

//  Section: Radius

function RadiusSection({ tokens }: { tokens: DesignTokens }) {
  const radii = tokens.radiusTokens ?? [];
  if (radii.length === 0) return null;
  return (
    <section className="mt-16">
      <SectionHeader index={5} label="border radius" count={radii.length} />
      <ul
        role="list"
        className="grid grid-cols-2 gap-px overflow-hidden border border-white/10 bg-white/10 sm:grid-cols-3 md:grid-cols-4"
      >
        {radii.slice(0, 12).map((r, i) => {
          const stab =
            (r as { stability?: { layer: string; confidence: number; signals?: string[] } }).stability;
          return (
            <li
              key={`${r.value}-${i}`}
              className="flex flex-col items-center gap-4 bg-black px-5 py-6"
            >
              <div
                aria-hidden="true"
                className="size-16 shrink-0 border border-white/25 bg-white/8"
                style={{ borderRadius: r.value }}
              />
              <div className="flex flex-col items-center text-center">
                <p className="font-pixel text-base tracking-tight text-white">
                  {r.value}
                </p>
                <p className="mt-2 font-pixel text-[10px] uppercase tracking-widest text-white/55">
                  {r.frequency}× used
                </p>
                {stab?.layer && (
                  <div className="mt-2">
                    <StabilityChip
                      layer={stab.layer}
                      confidence={stab.confidence}
                      signals={stab.signals}
                    />
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

//  Section: Shadows

function ShadowsSection({ tokens }: { tokens: DesignTokens }) {
  const shadows = tokens.shadowTokens ?? [];
  if (shadows.length === 0) return null;
  return (
    <section className="mt-16">
      <SectionHeader index={6} label="shadows" count={shadows.length} />
      <ul
        role="list"
        className="grid grid-cols-1 gap-px overflow-hidden border border-white/10 bg-white/10 sm:grid-cols-2 lg:grid-cols-3"
      >
        {shadows.slice(0, 9).map((s, i) => {
          const stab =
            (s as { stability?: { layer: string; confidence: number; signals?: string[] } }).stability;
          return (
            <li key={`${s.value}-${i}`} className="flex flex-col gap-4 bg-black p-5">
              <div className="grid place-items-center rounded-sm bg-white px-4 py-7">
                <span
                  aria-hidden="true"
                  className="block h-14 w-full max-w-32 rounded-sm bg-white"
                  style={{ boxShadow: s.value }}
                />
              </div>
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-x-2 gap-y-1 font-pixel text-[10px] uppercase tracking-widest text-white">
                  <span>{s.type ?? "shadow"}</span>
                  <span aria-hidden="true" className="text-white/35">
                    ·
                  </span>
                  <span className="text-primary">{s.frequency}× used</span>
                  {stab?.layer && (
                    <>
                      <span aria-hidden="true" className="text-white/35">
                        ·
                      </span>
                      <StabilityChip
                        layer={stab.layer}
                        confidence={stab.confidence}
                        signals={stab.signals}
                      />
                    </>
                  )}
                </p>
                <code className="mt-2 block break-all font-mono text-[11px] text-white/70">
                  {s.value}
                </code>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

//  Section: Captured components
//
// Reads tokens.components directly. Every background colour, padding value,
// border, and sample text below is a real DOM observation from the brand's
// live page at crawl time  no synthesis. If a brand's extraction yields
// three button variants in Japanese (because the crawler hit the localised
// version), we show those three buttons in Japanese. That's the truth.
//
// Components we don't have rich structural data for (Footer, Navigation)
// are listed in the "also captured" footer rather than rendered, so we
// never pretend to know more than we measured.

interface CapturedVariant {
  name: string;
  count: number;
  style: Record<string, string | undefined>;
  hoverChanges: Record<string, string> | null;
  sampleTexts?: string[];
  /**
   * Optional flag set by the brand's tokens.json when the variant renders
   * with a trailing icon (Carbon "Button with icon", Stripe icon-CTA, etc).
   * The page renders a Carbon-style ArrowRight glyph after the label so
   * the visible button matches the variant the brand actually ships on
   * its marketing surface.
   */
  withTrailingIcon?: boolean;
}

interface CapturedComponentGroup {
  type: string;
  variants: CapturedVariant[];
}

// Pick a card-appropriate radius. The naive "highest-frequency radius
// token" approach (what we used before) breaks on brands whose top
// radius is `50%` (circle avatars — paints a rectangle as an ellipse)
// or `9999px` (pill buttons — rounds a wide card into a stadium). And
// the next-highest can be `2px` (used for inputs / hairlines, not cards
// e.g. Wise), which renders as essentially-sharp corners on a card.
//
// Strategy:
//   1. Prefer the actual captured Card variant's `borderRadius`. That's
//      a measured value from a real DOM element classified as Card, so
//      it's the closest thing we have to "what this brand uses for
//      cards." For asymmetric shorthands like "32px 32px 0px 0px" take
//      the largest corner value — it captures the brand's rounded-card
//      vibe even when the specific captured card has mixed corners.
//   2. Fall back to the frequency-sorted radiusTokens, but skip values
//      that semantically aren't card radii: `%` (circles), `≥ 100px`
//      (pills), and asymmetric shorthands.
//   3. Final fallback: 6px.
function pickCardRadius(tokens: DesignTokens): string {
  const cardGroup = (tokens.components ?? []).find(
    (c) => (c.type ?? "").toLowerCase() === "card",
  );
  const captured = cardGroup?.variants?.[0]?.style?.borderRadius;
  if (captured) {
    const corners = captured
      .split(/\s+/)
      .map((s) => parseFloat(s))
      .filter((n) => Number.isFinite(n));
    const maxCorner = corners.length > 0 ? Math.max(...corners) : NaN;
    // Allow 0 — flat-card brands like IBM/Carbon legitimately use 0px.
    if (Number.isFinite(maxCorner) && maxCorner >= 0 && maxCorner < 100) {
      return `${maxCorner}px`;
    }
  }
  const radii = tokens.radiusTokens ?? [];
  for (const r of radii) {
    const v = r.value;
    if (v.includes("%")) continue;
    if (v.includes(" ")) continue;
    const px = parseFloat(v);
    if (!Number.isFinite(px)) continue;
    // Allow 0 — Carbon / IBM tiles are flat-corner 0px by convention.
    if (px < 0) continue;
    if (px >= 100) continue;
    return v;
  }
  return "6px";
}

function ComponentsSection({
  brand,
  tokens,
  section,
}: {
  brand: string;
  tokens: DesignTokens;
  /**
   * Splits the captured-components surface into two top-level sections
   * so the page flow matches the live `/extract` result page: buttons
   * surface early (after Typography), cards surface later (after
   * Shadows). Without this prop we'd render buttons + cards in one
   * fused block, which is what extract-client.tsx explicitly avoids.
   *
   *   "buttons"  buttons subsection only. Header index 3.
   *   "cards"    reference cards + captured links + also-captured list.
   *                Header index 7.
   */
  section: "buttons" | "cards";
}) {
  const components = (tokens.components ??
    []) as unknown as CapturedComponentGroup[];
  if (components.length === 0) return null;

  // Brand canvas color for the stage tile  buttons designed for light
  // surfaces (transparent or translucent backgrounds) need a solid surface
  // beneath to render authentically. Fall back to white if the engine
  // didn't capture a canvas role.
  const colors =
    (tokens.colorTokens as Array<{ hex: string; role?: string | null }>) ?? [];
  const pick = (role: string) =>
    colors.find((c) => c.role === role)?.hex;
  const stageBg = pick("canvas") ?? "#ffffff";

  // Body font  prefer a level with role=body, else the highest-frequency
  // level (which is almost always body text on real sites).
  const bodyFont =
    (
      tokens.typographyLevels as Array<{
        fontFamily: string;
        role?: string | null;
      }>
    )?.find((t) => t.role === "body")?.fontFamily ??
    tokens.typographyLevels?.[0]?.fontFamily ??
    "system-ui";

  // Display font  the largest typography level's family. For most brands
  // this equals bodyFont (Stripe uses sohne-var for both); for editorial
  // brands like IBM the largest sizes use a different family (Plex Serif
  // for display, Plex Sans for body). We pull from the level with the
  // largest `fontSize` rather than role-based lookup, since role-namer
  // assigns "display-xxl" / "display-xl" / etc. by size band.
  const displayFont =
    (
      [...((tokens.typographyLevels as Array<{
        fontFamily: string;
        fontSize: string;
      }>) ?? [])]
        .filter((t) => t.fontFamily && t.fontSize)
        .sort(
          (a, b) =>
            parseFloat(b.fontSize.replace(/[^\d.]/g, "")) -
            parseFloat(a.fontSize.replace(/[^\d.]/g, "")),
        )[0]?.fontFamily
    ) ?? bodyFont;

  // Cards card-philosophy: "elevated" (white canvas + shadow + hairline
  // Stripe / Vercel marketing default) or "flat" (Carbon Layer 01 surface,
  // no shadow, no border  IBM / Carbon products). Read from
  // `tokens.meta.cardStyle` so each brand declares its own card aesthetic
  // in its tokens.json rather than the page hard-coding per brand.
  const cardStyle: "flat" | "elevated" =
    (tokens.meta as { cardStyle?: string } | undefined)?.cardStyle === "flat"
      ? "flat"
      : "elevated";

  // Pick the right surface colour. A brand can override with an explicit
  // hex via `tokens.meta.cardSurface`  necessary when canvas-alt isn't the
  // right colour (e.g. Stripe's canvas-alt is the blue-tinted #e5edf5 but
  // its product feature blocks render on pure white).
  const metaCardSurface = (tokens.meta as { cardSurface?: string } | undefined)
    ?.cardSurface;
  const cardSurface =
    metaCardSurface ??
    (cardStyle === "flat"
      ? pick("canvas-alt") ?? pick("canvas") ?? "#f4f4f4"
      : pick("canvas") ?? "#ffffff");

  // Brand-declared reference-card recipes. When present, render the brand's
  // specific marketing-card patterns (e.g. Stripe's "Grow new lines of
  // revenue." feature block). When absent, fall back to the generic
  // ReferenceContentCard + ReferenceFeatureCard pair that works for any
  // brand using the brand's tokens.
  const referenceCards = (
    tokens.meta as { referenceCards?: ReferenceCardRecipe[] } | undefined
  )?.referenceCards;

  // Tokens used by the *reference* card compositions further down. These
  // cards aren't captured as components; they're built from real extracted
  // tokens so an agent reading this page knows exactly which hex / radius /
  // shadow values to use when authoring a brand-style card.
  const cardTokens = {
    canvas: stageBg,
    surface: cardSurface,
    style: cardStyle,
    hairline: pick("hairline") ?? "#e5e7eb",
    ink: pick("ink") ?? "#0f172a",
    muted: pick("muted") ?? "#64748b",
    primary: pick("primary") ?? "#6366f1",
    accent: pick("accent"),
    radius: pickCardRadius(tokens),
    signatureShadow:
      tokens.shadowTokens?.find((s) => s.type === "complex-stack")?.value ??
      tokens.shadowTokens?.[0]?.value ??
      "0 4px 12px rgba(0, 0, 0, 0.08)",
    bodyFont,
    displayFont,
    iconStyle: ((tokens.meta as { iconStyle?: string } | undefined)?.iconStyle === "chevron"
      ? "chevron"
      : "arrow") as IconStyle,
  };

  // Trailing-icon convention per brand. Carbon brands (IBM) use the
  // ArrowRight glyph (Carbon `→`); Stripe-family marketing surfaces use a
  // thin chevron (`›`). Each brand declares its preference in
  // `tokens.meta.iconStyle`; default is "arrow".
  const iconStyle: IconStyle =
    (tokens.meta as { iconStyle?: string } | undefined)?.iconStyle === "chevron"
      ? "chevron"
      : "arrow";

  // Group captured components by type. Button + Link variants get rendered
  // visually; everything else (Footer, Navigation, etc.) is listed in the
  // "also captured" footer because we don't have enough structural data
  // to render them honestly.
  const buttons = components.find(
    (c) => c.type?.toLowerCase() === "button",
  );
  const links = components.find((c) => c.type?.toLowerCase() === "link");
  const others = components.filter((c) => {
    const t = c.type?.toLowerCase();
    return t !== "button" && t !== "link";
  });

  const totalButtons = buttons?.variants?.length ?? 0;
  const totalLinks = links?.variants?.length ?? 0;

  const sourceHost = tokens.meta?.sourceUrls?.[0]
    ? tokens.meta.sourceUrls[0]
        .replace(/^https?:\/\//, "")
        .replace(/^www\./, "")
        .replace(/\/$/, "")
    : brand;

  // Buttons-only section: surfaces high-signal interactive component
  // immediately after Typography, mirroring the live /extract result
  // page order so the same brand reads the same way on both surfaces.
  if (section === "buttons") {
    if (totalButtons === 0) return null;
    return (
      <section className={`mt-16 ${componentFont.variable}`}>
        <SectionHeader index={3} label="buttons" count={totalButtons} />
        <p className="mb-6 max-w-2xl text-sm leading-7 text-white/65">
          Real DOM observations from{" "}
          <code className="font-mono text-white/85">{sourceHost}</code> at
          crawl time. Backgrounds, paddings, borders, even the sample text
          all captured, none invented. Buttons sit on the brand&apos;s own
          canvas colour so transparent and translucent variants render the
          way they do on the live page.
        </p>
        <CapturedButtonsPanel
          variants={buttons!.variants}
          stageBg={stageBg}
          bodyFont={bodyFont}
          iconStyle={iconStyle}
        />
      </section>
    );
  }

  // Cards section: reference card recipes (hand-curated brand patterns
  // composed from extracted tokens) + captured links + the "also
  // captured" footer for non-rendered component types (Footer / Nav /
  // Input). Lives after Shadows to match the live result page order.
  return (
    <section className={`mt-16 ${componentFont.variable}`}>
      <SectionHeader index={7} label="cards" />
      <p className="mb-6 max-w-2xl text-sm leading-7 text-white/65">
        Reference card patterns composed from{" "}
        <code className="font-mono text-white/85">{sourceHost}</code>
        &apos;s extracted canvas + hairline + signature shadow + base
        radius. Useful as a recipe when an agent rebuilds the brand
        style; not pretending these specific layouts were captured from
        the DOM.
      </p>
      <ul role="list" className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {referenceCards && referenceCards.length > 0 ? (
          referenceCards.map((recipe, i) => (
            <ReferenceCardFromRecipe
              key={`${recipe.title}-${i}`}
              recipe={recipe}
              tokens={cardTokens}
            />
          ))
        ) : (
          <>
            <ReferenceContentCard tokens={cardTokens} />
            <ReferenceFeatureCard tokens={cardTokens} />
          </>
        )}
      </ul>

      {totalLinks > 0 && (
        <div className="mt-10 space-y-4">
          <SubsectionLabel
            name="links"
            caption={`${totalLinks} variant${totalLinks === 1 ? "" : "s"} captured`}
          />
          <CapturedLinksPanel
            variants={links!.variants}
            stageBg={stageBg}
            bodyFont={bodyFont}
          />
        </div>
      )}

      {others.length > 0 && (
        <div className="mt-10 border border-white/10 p-5">
          <p className="font-pixel text-[10px] uppercase tracking-widest text-white/55">
            also captured
          </p>
          <p className="mt-2 text-sm leading-6 text-white/65">
            The engine identified these additional component groups in the
            page DOM. They aren&apos;t rendered visually here because
            structural components (footer, navigation) need their
            containing layout to display meaningfully and the engine
            doesn&apos;t yet capture that.
          </p>
          <ul role="list" className="mt-3 flex flex-wrap gap-2">
            {others.map((o) => (
              <li
                key={o.type}
                className="inline-flex items-center gap-2 border border-white/10 px-2.5 py-1 font-pixel text-[10px] uppercase tracking-widest text-white/70"
              >
                <span
                  aria-hidden="true"
                  className="size-1 rounded-full bg-emerald-300"
                />
                {o.type}
                <span aria-hidden="true" className="text-white/40">·</span>
                <span className="text-white/55">
                  {o.variants?.length ?? 0} variant
                  {(o.variants?.length ?? 0) === 1 ? "" : "s"}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

// Contextual English labels for known button-variant names. The engine
// captures whatever text was in the DOM at crawl time  often localised
// (e.g. Stripe was crawled on a Japanese URL so sample texts are 始める /
// 営業にお問い合わせ). For the rendered button label we use a recognised
// English CTA the brand uses on its English surface; the real captured
// strings are still shown below as authenticity proof. If the variant
// name isn't in this map we fall back to the first captured sample.
const CONTEXTUAL_BUTTON_LABELS: Record<string, string> = {
  primary: "Get started",
  secondary: "Contact sales",
  ghost: "Learn more",
  outline: "Cancel",
  destructive: "Delete",
  filled: "Submit",
  subtle: "Skip",
  default: "Continue",
};

function contextualButtonLabel(variant: CapturedVariant): string {
  const fromMap = CONTEXTUAL_BUTTON_LABELS[variant.name.toLowerCase()];
  if (fromMap) return fromMap;
  return variant.sampleTexts?.[0] ?? variant.name;
}

// All captured button variants rendered together on one brand-canvas stage.
// The visual showcase is the point  technical CSS recipes live in the
// DESIGN.md section below, so duplicating them here as metadata tables
// just added vertical noise. Each button keeps its exact captured CSS
// (background, padding, border, transition) via inline style; below each
// button is a small caption naming the variant + observation count.
function CapturedButtonsPanel({
  variants,
  stageBg,
  bodyFont,
  iconStyle,
}: {
  variants: CapturedVariant[];
  stageBg: string;
  bodyFont: string;
  iconStyle: IconStyle;
}) {
  return (
    <div
      className="flex flex-wrap items-end gap-x-8 gap-y-8 border border-white/10 p-8 sm:p-10"
      style={{ background: stageBg }}
    >
      {variants.map((v, i) => (
        <CapturedButtonItem
          key={`${v.name}-${i}`}
          variant={v}
          bodyFont={bodyFont}
          iconStyle={iconStyle}
        />
      ))}
    </div>
  );
}

// One button rendered with its full captured inline style + a caption.
// Wrapped in a flex column so the caption sits directly under the button
// at the same width, like sample swatches in a print spec sheet.
function CapturedButtonItem({
  variant,
  bodyFont,
  iconStyle,
}: {
  variant: CapturedVariant;
  bodyFont: string;
  iconStyle: IconStyle;
}) {
  const inlineStyle = {
    ...variant.style,
    fontFamily: `'${bodyFont}', var(--font-component), system-ui, sans-serif`,
    cursor: "default",
    ...(variant.withTrailingIcon
      ? { display: "inline-flex", alignItems: "center", gap: "12px" }
      : {}),
  } as React.CSSProperties;

  const label = contextualButtonLabel(variant);
  // Use captured page background colour as the caption tone reference.
  // The page sits on the brand canvas; captions need to read against it,
  // so use ink-ish tones with low alpha that work on either dark or
  // light brand-canvas surfaces (most are white).
  return (
    <div className="flex flex-col items-start gap-2">
      <button type="button" style={inlineStyle} disabled>
        {label}
        {variant.withTrailingIcon && (
          <BrandTrailingIcon iconStyle={iconStyle} />
        )}
      </button>
      <p
        className="font-pixel text-[10px] uppercase tracking-widest"
        style={{ color: "rgba(0, 0, 0, 0.55)", fontFamily: "var(--font-component), system-ui, sans-serif" }}
      >
        <span style={{ color: "rgba(0, 0, 0, 0.85)" }}>{variant.name}</span>
        <span aria-hidden="true" style={{ margin: "0 0.5em", color: "rgba(0, 0, 0, 0.3)" }}>·</span>
        <span>{variant.count}× observed</span>
      </p>
    </div>
  );
}

// Carbon's ArrowRight glyph at 16px. Used by Carbon "Button with icon" on
// ibm.com marketing CTAs. Rendered inline so no icon-library dependency
// is needed; `currentColor` inherits the button's text colour.
function ArrowRightIcon() {
  return (
    <svg
      aria-hidden="true"
      width="16"
      height="16"
      viewBox="0 0 32 32"
      fill="currentColor"
      style={{ flexShrink: 0 }}
    >
      <path d="M18 6L16.57 7.393 24.15 15 4 15 4 17 24.15 17 16.57 24.573 18 26 28 16z" />
    </svg>
  );
}

// Stripe's chevron-right glyph (`›`) at 14px. Lighter, thinner, slightly
// angled  Stripe uses this on every marketing CTA (Start now, Request
// an invite, Read the story). Stroke 1.75 matches the on-page weight.
function ChevronRightIcon() {
  return (
    <svg
      aria-hidden="true"
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ flexShrink: 0 }}
    >
      <path d="M6 4l4 4-4 4" />
    </svg>
  );
}

// Brand-aware trailing-icon picker. Each brand declares its CTA-icon
// convention via `tokens.meta.iconStyle`  Carbon brands (IBM) use
// `"arrow"`; Stripe-family brands use `"chevron"`. Defaults to "arrow"
// when no preference is declared.
function BrandTrailingIcon({ iconStyle }: { iconStyle: IconStyle }) {
  return iconStyle === "chevron" ? <ChevronRightIcon /> : <ArrowRightIcon />;
}

type IconStyle = "arrow" | "chevron";

// All captured link variants rendered together on one brand-canvas stage.
// Same UX principle as CapturedButtonsPanel  visual showcase here, CSS
// recipe in DESIGN.md.
function CapturedLinksPanel({
  variants,
  stageBg,
  bodyFont,
}: {
  variants: CapturedVariant[];
  stageBg: string;
  bodyFont: string;
}) {
  return (
    <div
      className="flex flex-wrap items-end gap-x-12 gap-y-6 border border-white/10 p-8 sm:p-10"
      style={{ background: stageBg }}
    >
      {variants.map((v, i) => (
        <CapturedLinkItem
          key={`${v.name}-${i}`}
          variant={v}
          bodyFont={bodyFont}
        />
      ))}
    </div>
  );
}

function CapturedLinkItem({
  variant,
  bodyFont,
}: {
  variant: CapturedVariant;
  bodyFont: string;
}) {
  const inlineStyle = {
    ...variant.style,
    fontFamily: `'${bodyFont}', var(--font-component), system-ui, sans-serif`,
  } as React.CSSProperties;
  return (
    <div className="flex flex-col items-start gap-2">
      {/* `<a>` without href is an inert anchor element  server-safe and
          no navigation. Captured colour / font / padding still render. */}
      <a style={inlineStyle}>View documentation</a>
      <p
        className="font-pixel text-[10px] uppercase tracking-widest"
        style={{ color: "rgba(0, 0, 0, 0.55)", fontFamily: "var(--font-component), system-ui, sans-serif" }}
      >
        <span style={{ color: "rgba(0, 0, 0, 0.85)" }}>{variant.name}</span>
        <span aria-hidden="true" style={{ margin: "0 0.5em", color: "rgba(0, 0, 0, 0.3)" }}>·</span>
        <span>{variant.count}× observed</span>
      </p>
    </div>
  );
}

// Reference card token shape  small subset of the brand's tokens used to
// compose card layouts. Kept narrow so an agent reading the recipe sees
// only the values they need to use.
interface ReferenceCardTokens {
  /** Page-stage colour for context (not used inside the card itself). */
  canvas: string;
  /** Card surface colour. For flat brands (IBM) this is canvas-alt
   *  (e.g. #f4f4f4 Carbon Layer 01); for elevated brands (Stripe) this
   *  is canvas (#ffffff). */
  surface: string;
  /** Card aesthetic philosophy chosen by the brand. Drives shadow + border. */
  style: "flat" | "elevated";
  hairline: string;
  ink: string;
  muted: string;
  primary: string;
  accent?: string;
  radius: string;
  signatureShadow: string;
  /** Family used for body / paragraph copy. */
  bodyFont: string;
  /** Family used for large display titles. Differs from bodyFont on
   *  editorial brands (e.g. IBM uses Plex Serif for titles, Plex Sans
   *  for body); equals bodyFont on single-font brands (Stripe). */
  displayFont: string;
  /** Trailing-icon convention the brand uses on CTAs. IBM/Carbon = arrow,
   *  Stripe = chevron. Drives the glyph in CardBottomCta. */
  iconStyle: IconStyle;
}

// Build the wrapper styles per card-style. Flat cards (IBM) have no
// shadow and no border  the surface contrast against the page provides
// the affordance. Elevated cards (Stripe) get a hairline + the brand's
// captured signature shadow.
function cardWrapperStyle(
  tokens: ReferenceCardTokens,
  padding: string,
  override?: { surface?: string; textColor?: string },
): React.CSSProperties {
  const surface = override?.surface ?? tokens.surface;
  const ink = override?.textColor ?? tokens.ink;
  const base: React.CSSProperties = {
    background: surface,
    borderRadius: tokens.radius,
    padding,
    color: ink,
    fontFamily: `'${tokens.bodyFont}', var(--font-component), system-ui, sans-serif`,
    display: "flex",
    flexDirection: "column",
    listStyle: "none",
    minHeight: tokens.style === "flat" ? "320px" : undefined,
  };
  if (tokens.style === "elevated") {
    // Hairline reads against the page (dark), not against the card surface,
    // so we keep it on for both white and brand-coloured override surfaces.
    base.border = `1px solid ${tokens.hairline}`;
    base.boxShadow = tokens.signatureShadow;
  }
  return base;
}

// Bottom-row CTA used by both card variants. Renders the brand's primary
// link text on the left and a Carbon-style ArrowRight on the right
// matches the dominant ibm.com tile pattern (and translates fine to
// Stripe-style cards where the arrow becomes part of the inline link).
function CardBottomCta({
  label,
  primary,
  iconStyle,
}: {
  label: string;
  primary: string;
  iconStyle: IconStyle;
}) {
  return (
    <p
      style={{
        marginTop: "auto",
        paddingTop: "32px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "16px",
        color: primary,
        fontSize: "14px",
        fontWeight: 400,
        margin: "32px 0 0",
      }}
    >
      <span style={{ color: primary }}>{label}</span>
      <span
        aria-hidden="true"
        style={{ color: primary, display: "inline-flex", alignItems: "center" }}
      >
        <BrandTrailingIcon iconStyle={iconStyle} />
      </span>
    </p>
  );
}

// Content card  the eyebrow + big serif title + body + bottom CTA pattern
// IBM ships across ibm.com (Carbon "Tile" with productive content layout).
// Same pattern reads cleanly on elevated brands too; only the surface
// colour, shadow, and title-font family change between styles.
function ReferenceContentCard({ tokens }: { tokens: ReferenceCardTokens }) {
  return (
    <li style={cardWrapperStyle(tokens, "32px")}>
      <p
        style={{
          fontSize: "14px",
          fontWeight: 400,
          color: tokens.muted,
          margin: 0,
        }}
      >
        Interactive demo
      </p>
      <h4
        style={{
          margin: "12px 0 0",
          fontSize: "28px",
          fontWeight: 400,
          lineHeight: 1.2,
          letterSpacing: "0",
          color: tokens.ink,
          fontFamily: `'${tokens.displayFont}', var(--font-component), system-ui, sans-serif`,
        }}
      >
        Explore the interactive demo
      </h4>
      <p
        style={{
          marginTop: "24px",
          marginBottom: 0,
          fontSize: "14px",
          lineHeight: 1.5,
          color: tokens.ink,
          letterSpacing: "0.16px",
        }}
      >
        This demonstration shows how easy of use and instant insights empower
        teams to make quick, confident decisions  the canonical product-tile
        layout this brand uses on its marketing surface.
      </p>
      <CardBottomCta
        label="Take the interactive demo"
        primary={tokens.primary}
        iconStyle={tokens.iconStyle}
      />
    </li>
  );
}

// Feature card  icon-led variant of the tile. For flat brands the icon is
// a thin-stroke line-art glyph (no background tile, matches Carbon's
// product feature tile); for elevated brands the icon sits inside an
// accent-tinted square tile (matches Stripe's feature-block pattern).
function ReferenceFeatureCard({ tokens }: { tokens: ReferenceCardTokens }) {
  const accent = tokens.accent ?? tokens.primary;
  return (
    <li style={cardWrapperStyle(tokens, "32px")}>
      {tokens.style === "flat" ? (
        <FlatLineArtIcon color={tokens.primary} />
      ) : (
        <div
          aria-hidden="true"
          style={{
            width: "40px",
            height: "40px",
            borderRadius: tokens.radius,
            background: `${accent}1f`,
            color: accent,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "20px",
            fontWeight: 700,
          }}
        >
          ✦
        </div>
      )}
      <p
        style={{
          marginTop: "16px",
          marginBottom: 0,
          fontSize: "14px",
          fontWeight: 400,
          color: tokens.muted,
        }}
      >
        Brand newsroom
      </p>
      <h4
        style={{
          margin: "12px 0 0",
          fontSize: "22px",
          fontWeight: 400,
          lineHeight: 1.27,
          color: tokens.ink,
          fontFamily: `'${tokens.displayFont}', var(--font-component), system-ui, sans-serif`,
        }}
      >
        Editorial tile  feature recipe with icon, eyebrow, and inline CTA.
      </h4>
      <CardBottomCta
        label="Read the blog"
        primary={tokens.primary}
        iconStyle={tokens.iconStyle}
      />
    </li>
  );
}

// 48px thin-stroke geometric icon for flat-style feature cards. Carbon
// product tiles use thin lineart icons in the brand primary colour; this
// is a content-agnostic stand-in (rounded rectangle with an inset dot)
// that reads as iconography without needing an icon library.
function FlatLineArtIcon({ color }: { color: string }) {
  return (
    <svg
      aria-hidden="true"
      width="48"
      height="48"
      viewBox="0 0 48 48"
      fill="none"
      stroke={color}
      strokeWidth="1.5"
    >
      <rect x="8" y="8" width="32" height="32" rx="2" />
      <circle cx="24" cy="24" r="4" />
      <path d="M24 14V8M24 40v-6M14 24H8M40 24h-6" />
    </svg>
  );
}

// Per-brand reference-card recipe. Each brand declares its specific
// marketing-card patterns in `tokens.meta.referenceCards`; the renderer
// reads them and composes the card from extracted tokens. Lets us match
// what each brand actually ships on its marketing surface without
// hard-coding per-brand JSX.
interface ReferenceCardRecipe {
  /** Icon registry name. See CARD_ICONS map for available names. */
  icon: keyof typeof CARD_ICONS;
  /** Bold title prefix (e.g. "Grow new lines of revenue." trailing period
   *  intentional  Stripe convention). */
  title: string;
  /** Body that continues inline after the title. */
  body: string;
  /** Inline CTA label rendered at the bottom in the brand's primary
   *  colour, followed by the brand's trailing-icon glyph. */
  ctaLabel: string;
  /** Optional layout switch. "feature" (default) is the standard icon +
   *  title + body + inline CTA pattern. "testimonial" swaps the layout
   *  to icon + blockquote + author, used when a brand's reference card
   *  pattern is a customer-quote surface (Wise ships this on its
   *  marketing pages — green-surfaced quote tile with forest ink). */
  layout?: "feature" | "testimonial";
  /** Optional per-card surface override. When set, this card uses the
   *  given hex as its background instead of the brand's `cardSurface`.
   *  Used when a brand ships multiple card surfaces (e.g. Wise pairs a
   *  white action-card with a Bright-Green testimonial-card). */
  surface?: string;
  /** Optional per-card foreground override. Pairs with `surface` when the
   *  override surface needs a non-default ink colour (e.g. Wise's green
   *  testimonial card reads in forest #163300, not the default ink). */
  textColor?: string;
  /** Author / attribution for the testimonial layout. Ignored for
   *  feature layout. */
  author?: string;
}

// Line-art icon registry for reference-card recipes. Each is 20×20 inside
// a 24-viewBox; rendered with `currentColor` so it inherits the icon-tile
// foreground colour, which the renderer sets to the brand primary.
const CARD_ICONS = {
  "trending-up": () => (
    <svg
      aria-hidden="true"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 17l6-6 4 4 8-8M17 7h4v4" />
    </svg>
  ),
  "grid-plus": () => (
    <svg
      aria-hidden="true"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="3" width="7" height="7" />
      <rect x="3" y="14" width="7" height="7" />
      <rect x="14" y="14" width="7" height="7" />
      <path d="M17.5 4v6M14.5 7h6" />
    </svg>
  ),
  shield: () => (
    <svg
      aria-hidden="true"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 3l8 3v6c0 4.5-3 8-8 9-5-1-8-4.5-8-9V6l8-3z" />
    </svg>
  ),
  bolt: () => (
    <svg
      aria-hidden="true"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M13 3L4 14h7l-1 7 9-11h-7l1-7z" />
    </svg>
  ),
} as const;

// Render a single recipe — dispatches on layout. Feature layout is the
// Stripe-style marketing block (icon + title + body + inline CTA); the
// testimonial layout swaps to icon + blockquote + author and is used
// when a brand pairs a quote card with its action cards (Wise's green
// quote tile pattern). Container always respects `tokens.style` so a
// flat brand still gets sharp corners regardless of layout choice.
function ReferenceCardFromRecipe({
  recipe,
  tokens,
}: {
  recipe: ReferenceCardRecipe;
  tokens: ReferenceCardTokens;
}) {
  if (recipe.layout === "testimonial") {
    return <ReferenceTestimonialCard recipe={recipe} tokens={tokens} />;
  }
  return <ReferenceFeatureRecipeCard recipe={recipe} tokens={tokens} />;
}

function ReferenceFeatureRecipeCard({
  recipe,
  tokens,
}: {
  recipe: ReferenceCardRecipe;
  tokens: ReferenceCardTokens;
}) {
  const IconGlyph = CARD_ICONS[recipe.icon] ?? CARD_ICONS["trending-up"];
  const surface = recipe.surface ?? tokens.surface;
  const ink = recipe.textColor ?? tokens.ink;
  // When the card has an override surface (Wise white-on-green), the
  // body-text mutedink contrast loses meaning — switch to the primary
  // ink for body too, since "muted" is calibrated against the default
  // surface, not arbitrary brand colours.
  const bodyInk = recipe.surface ? ink : tokens.muted;
  return (
    <li
      style={cardWrapperStyle(tokens, "32px", {
        surface: recipe.surface,
        textColor: recipe.textColor,
      })}
    >
      <div
        aria-hidden="true"
        style={{
          width: "48px",
          height: "48px",
          borderRadius: tokens.radius,
          background: `${tokens.primary}14`,
          color: tokens.primary,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: "24px",
        }}
      >
        <IconGlyph />
      </div>
      <p
        style={{
          margin: 0,
          fontSize: "16px",
          lineHeight: 1.5,
          color: ink,
          fontFamily: `'${tokens.bodyFont}', var(--font-component), system-ui, sans-serif`,
        }}
      >
        <strong style={{ fontWeight: 700, color: ink }}>{recipe.title}</strong>{" "}
        <span style={{ color: bodyInk }}>{recipe.body}</span>
      </p>
      <p
        style={{
          marginTop: "auto",
          paddingTop: "32px",
          margin: "32px 0 0",
          display: "inline-flex",
          alignItems: "center",
          gap: "6px",
          color: tokens.primary,
          fontSize: "16px",
          fontWeight: 600,
        }}
      >
        <span>{recipe.ctaLabel}</span>
        <span
          aria-hidden="true"
          style={{
            color: tokens.primary,
            display: "inline-flex",
            alignItems: "center",
          }}
        >
          <BrandTrailingIcon iconStyle={tokens.iconStyle} />
        </span>
      </p>
    </li>
  );
}

// Testimonial card  Wise's customer-quote tile pattern. Brand-coloured
// surface (Bright Green for Wise) with forest-ink text, icon at top,
// blockquote in the middle, author at the bottom. No CTA — quote
// surfaces don't take you anywhere, they're social-proof anchors.
// `recipe.ctaLabel` is reused as the author when `recipe.author` is
// absent, since both fields are optional in user-authored token JSON.
function ReferenceTestimonialCard({
  recipe,
  tokens,
}: {
  recipe: ReferenceCardRecipe;
  tokens: ReferenceCardTokens;
}) {
  const IconGlyph = CARD_ICONS[recipe.icon] ?? CARD_ICONS["trending-up"];
  const surface = recipe.surface ?? tokens.primary;
  const ink = recipe.textColor ?? tokens.ink;
  const author = recipe.author ?? recipe.ctaLabel;
  return (
    <li
      style={cardWrapperStyle(tokens, "32px", {
        surface,
        textColor: ink,
      })}
    >
      {/* Icon sits in a white inset tile so it pops off the brand surface
          matches Wise's Google-Play badge treatment on its testimonial
          cards. The inner foreground uses the brand primary so the icon
          itself reads as part of the brand vocabulary. */}
      <div
        aria-hidden="true"
        style={{
          width: "44px",
          height: "44px",
          borderRadius: "9999px",
          background: "#ffffff",
          color: tokens.primary,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: "24px",
        }}
      >
        <IconGlyph />
      </div>
      <blockquote
        style={{
          margin: 0,
          fontSize: "18px",
          lineHeight: 1.45,
          fontWeight: 700,
          color: ink,
          fontFamily: `'${tokens.bodyFont}', var(--font-component), system-ui, sans-serif`,
        }}
      >
        {recipe.title} {recipe.body}
      </blockquote>
      <p
        style={{
          marginTop: "auto",
          paddingTop: "32px",
          margin: "32px 0 0",
          color: ink,
          fontSize: "14px",
          fontWeight: 600,
        }}
      >
        {author}
      </p>
    </li>
  );
}

function SubsectionLabel({
  name,
  caption,
}: {
  name: string;
  caption: string;
}) {
  return (
    <div className="flex flex-wrap items-baseline gap-3">
      <h3 className="font-pixel text-[11px] uppercase tracking-widest text-white">
        {name}
      </h3>
      <p className="font-mono text-[11px] text-white/55">{caption}</p>
    </div>
  );
}

//  Section: DESIGN.md source
//
// Rendered with react-markdown + remark-gfm so tables, lists, headings,
// and inline code all turn into real HTML rather than pipe-separated
// source text. The `components` map below skins every element with
// Tailwind classes that match the dark-theme aesthetic used elsewhere
// in the SPA. Runs at build time (server component / SSG) so the
// runtime client bundle stays unchanged.

function DesignMdSection({
  brand,
  source,
}: {
  brand: string;
  source: string;
}) {
  return (
    <section className="mt-16">
      <SectionHeader index={8} label="DESIGN.md" />
      <div className="border border-white/10 bg-black">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-5 py-3">
          <div className="flex flex-wrap items-center gap-3">
            <p className="font-mono text-xs text-white/55">
              examples/{brand}/DESIGN.md
            </p>
            <span className="font-pixel text-[10px] uppercase tracking-widest text-white/40">
              · {source.split("\n").length} lines
            </span>
          </div>
          <MdActions source={source} filename={`${brand}.DESIGN.md`} />
        </header>
        <div className="px-6 py-6 sm:px-8 sm:py-8">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              h1: (props) => (
                <h1
                  className="mb-4 font-pixel text-2xl tracking-tight text-white"
                  {...props}
                />
              ),
              h2: (props) => (
                <h2
                  className="mt-8 mb-3 border-b border-white/10 pb-2 font-pixel text-lg tracking-tight text-white"
                  {...props}
                />
              ),
              h3: (props) => (
                <h3
                  className="mt-6 mb-2 font-pixel text-sm uppercase tracking-widest text-emerald-300"
                  {...props}
                />
              ),
              h4: (props) => (
                <h4
                  className="mt-4 mb-1 font-pixel text-xs uppercase tracking-widest text-white/80"
                  {...props}
                />
              ),
              p: (props) => (
                <p
                  className="my-3 text-sm leading-7 text-white/75"
                  {...props}
                />
              ),
              ul: (props) => (
                <ul
                  className="my-3 list-disc space-y-1 pl-6 text-sm leading-7 text-white/75 marker:text-emerald-300/60"
                  {...props}
                />
              ),
              ol: (props) => (
                <ol
                  className="my-3 list-decimal space-y-1 pl-6 text-sm leading-7 text-white/75 marker:text-emerald-300/60"
                  {...props}
                />
              ),
              li: (props) => <li {...props} />,
              strong: (props) => (
                <strong className="font-semibold text-white" {...props} />
              ),
              em: (props) => <em className="italic text-white/85" {...props} />,
              a: (props) => (
                <a
                  className="text-emerald-300 underline decoration-emerald-300/40 underline-offset-4 hover:decoration-emerald-300"
                  target="_blank"
                  rel="noopener noreferrer"
                  {...props}
                />
              ),
              blockquote: (props) => (
                <blockquote
                  className="my-4 border-l-2 border-emerald-300/50 pl-4 text-sm italic text-white/65"
                  {...props}
                />
              ),
              hr: (props) => (
                <hr className="my-8 border-white/10" {...props} />
              ),
              // Inline `code` and block `pre > code`. We style code uniformly
              // (token-like background, monospace, primary-tinted) and let
              // pre add the block-level whitespace/scroll behaviour.
              code: (props) => (
                <code
                  className="rounded bg-white/10 px-1 py-0.5 font-mono text-[0.92em] text-emerald-300"
                  {...props}
                />
              ),
              pre: (props) => (
                <pre
                  className="my-4 overflow-x-auto rounded border border-white/10 bg-black/50 p-4 font-mono text-xs leading-6 text-white/85 [&_code]:bg-transparent [&_code]:p-0 [&_code]:text-white/85"
                  {...props}
                />
              ),
              // GFM tables. Wrap in overflow-x-auto so wide tables (Stripe's
              // type system has 8+ columns) scroll on narrow screens
              // rather than wrapping cells.
              table: (props) => (
                <div className="my-6 overflow-x-auto border border-white/10">
                  <table
                    className="w-full border-collapse text-left text-xs"
                    {...props}
                  />
                </div>
              ),
              thead: (props) => (
                <thead className="bg-white/3" {...props} />
              ),
              tbody: (props) => (
                <tbody className="divide-y divide-white/5" {...props} />
              ),
              tr: (props) => <tr {...props} />,
              th: (props) => (
                <th
                  className="border-b border-white/10 px-3 py-2 font-pixel text-[10px] uppercase tracking-widest text-white/55"
                  {...props}
                />
              ),
              td: (props) => (
                <td
                  className="px-3 py-2 align-top font-mono text-[11px] text-white/80"
                  {...props}
                />
              ),
              img: (props) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  className="my-4 rounded border border-white/10"
                  alt=""
                  {...props}
                />
              ),
            }}
          >
            {source}
          </ReactMarkdown>
        </div>
      </div>
    </section>
  );
}
