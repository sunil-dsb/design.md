import type { CSSProperties, ReactNode } from "react";
import { Inter } from "next/font/google";

// Inter at every weight Wise uses across its tier ladder, plus 900 for
// the display-tier headlines that mimic the proprietary Wise Sans on
// the live site. Loaded via next/font/google so the showcase renders
// with the right type weight on first paint (no flash of fallback).
const wiseFont = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "900"],
  variable: "--font-wise-preview",
  display: "swap",
});

// Light-themed rich showcase of the Wise design system — the right-pane
// preview in <SpecPreview> on the home page. Built section-by-section
// after the canonical 8-section spec order, but expanded with the
// patterns competitors like getdesign.md surface that we found worth
// adapting: family-grouped color palette, brand-flavoured type samples,
// a "Signature Components" section featuring Wise's currency-converter
// widget, and a Pricing Tiers card grid.

// Wise tokens — every hex below is one of the most-frequent extracted
// values from examples/wise/tokens.json. Hex literals keep the file
// SSR-friendly (no client cost). Matches the YAML front matter in
// examples/wise/DESIGN.md exactly.
//
// `canvasSoft` is the one derived value: a lighter tint of the extracted
// `hairline` so the page bg and the hairline border are visually
// distinct. Everything else is straight from the extracted palette.
const WISE = {
  primary: "#9fe870", // bright-green CTA (freq 98)
  primaryDark: "#008026", // content-positive / hover (freq 28)
  ink: "#163300", // forest-green default text (freq 6346, #1 most-used)
  // #0e0f0c is primarily a TEXT color in the captured data (916 text +
  // 2311 border uses); it doubles as the dark-mode surface for
  // promotional cards.
  inkSoft: "#0e0f0c",
  pureBlack: "#000000", // core contrast (freq 86)
  surface: "#ffffff", // canvas (freq 27)
  // Real extracted sage page bg, replaces the previously-derived #f4f6f2.
  canvasSoft: "#edefeb",
  hairline: "#e8ebe6", // borders + dividers (freq 85)
  muted: "#454745", // secondary body (freq 5563)
  midNeutral: "#808080", // interactive secondary (freq 16)
  darkNeutral: "#6a6c6a", // content tertiary (freq 14)
  celebration: "#0b4c72", // accent blue (freq 70)
  // Tertiary accent for illustrative content (light-cyan tint). Low
  // frequency on the live site but distinctive enough to be worth
  // surfacing in the demo palette.
  accentCyan: "#a0e1e1",
} as const;

export function WisePreview() {
  return (
    <div
      className={`${wiseFont.variable} h-full w-full overflow-y-auto pt-9`}
      style={{
        background: WISE.canvasSoft,
        color: WISE.ink,
        fontFamily:
          "var(--font-wise-preview), 'Inter', system-ui, -apple-system, sans-serif",
      }}
    >
      <WiseHero />
      <WiseColors />
      <WiseTypography />
      <WiseLayout />
      {/* Buttons surface before Shapes + Elevation so the reader sees a
          real interactive component early — once they've absorbed
          colors / typography / layout, the next thing they want to
          touch is a CTA. */}
      <WiseButtons />
      <WiseShapes />
      <WiseElevation />
      <WiseCards />
      <WiseFormElements />
      <WiseSignatureWidget />
      <WisePricingTiers />
      <WiseDosAndDonts />
    </div>
  );
}

//  Shared building blocks

function Section({
  children,
  style,
}: {
  children: ReactNode;
  style?: CSSProperties;
}) {
  return (
    <section
      style={{
        padding: "56px 40px",
        borderTop: `1px solid ${WISE.hairline}`,
        ...style,
      }}
    >
      {children}
    </section>
  );
}

function SectionHeader({
  eyebrow,
  title,
  lede,
}: {
  eyebrow: string;
  title: string;
  // Optional one-line description below the title. Gives each section a
  // clear "what this is" without forcing the user to read body prose.
  lede?: string;
}) {
  return (
    <div style={{ marginBottom: 28 }}>
      <p
        style={{
          fontSize: 11,
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: "0.16em",
          color: WISE.muted,
          margin: 0,
        }}
      >
        {eyebrow}
      </p>
      <h2
        style={{
          fontSize: 32,
          fontWeight: 800,
          lineHeight: 1.05,
          letterSpacing: "-0.02em",
          margin: "8px 0 0",
          color: WISE.ink,
        }}
      >
        {title}
      </h2>
      {lede && (
        <p
          style={{
            fontSize: 15,
            lineHeight: 1.55,
            color: WISE.muted,
            margin: "12px 0 0",
            maxWidth: 600,
          }}
        >
          {lede}
        </p>
      )}
    </div>
  );
}

function SubsectionLabel({
  name,
  caption,
}: {
  name: string;
  caption?: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "baseline",
        gap: 10,
        marginBottom: 14,
      }}
    >
      <p
        style={{
          margin: 0,
          fontSize: 11,
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "0.14em",
          color: WISE.ink,
        }}
      >
        {name}
      </p>
      {caption && (
        <p
          style={{
            margin: 0,
            fontFamily: "ui-monospace, SFMono-Regular, monospace",
            fontSize: 11,
            color: WISE.muted,
          }}
        >
          {caption}
        </p>
      )}
    </div>
  );
}

//  Section 1: Hero — sage canvas, big inverted button

function WiseHero() {
  return (
    <section
      style={{
        background: WISE.primary,
        color: WISE.ink,
        padding: "56px 40px 64px",
      }}
    >
      <p
        style={{
          fontSize: 11,
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: "0.16em",
          margin: 0,
          opacity: 0.7,
        }}
      >
        design.md showcase · wise.com
      </p>
      <h1
        style={{
          fontSize: 52,
          fontWeight: 900,
          lineHeight: 0.95,
          letterSpacing: "-0.025em",
          margin: "20px 0 0",
          maxWidth: "14ch",
        }}
      >
        Send money to 160+ countries.
      </h1>
      <p
        style={{
          fontSize: 18,
          lineHeight: 1.5,
          margin: "20px 0 0",
          maxWidth: 540,
        }}
      >
        Wise&apos;s design system, extracted as DESIGN.md. Drop it into any
        AI agent and build UI that looks exactly like wise.com.
      </p>
      <a
        href="#wise-explore"
        style={{
          ...buttonBase(),
          marginTop: 32,
          background: WISE.ink,
          color: WISE.primary,
        }}
      >
        Explore the system
      </a>
    </section>
  );
}

//  Section 2: Color Palette — grouped into families

function WiseColors() {
  return (
    <Section>
      <SectionHeader
        eyebrow="Section 2"
        title="Color Palette"
        lede="Thirteen colors extracted from wise.com, grouped by intent. A single saturated brand green carries every CTA. No second brand accent by design."
      />

      <ColorGroup
        family="Brand"
        colors={[
          {
            name: "primary",
            hex: WISE.primary,
            role: "Brand CTA / focus / progress",
          },
          {
            name: "primary-dark",
            hex: WISE.primaryDark,
            role: "Hover + positive state",
          },
        ]}
      />
      <ColorGroup
        family="Surface"
        colors={[
          {
            name: "canvas",
            hex: WISE.surface,
            role: "Card interior",
            outline: true,
          },
          {
            name: "canvas-soft",
            hex: WISE.canvasSoft,
            role: "Sage page background",
            outline: true,
          },
          {
            name: "hairline",
            hex: WISE.hairline,
            role: "Borders + dividers",
            outline: true,
          },
          {
            name: "pure-black",
            hex: WISE.pureBlack,
            role: "Core contrast",
          },
        ]}
      />
      <ColorGroup
        family="Text"
        colors={[
          { name: "ink", hex: WISE.ink, role: "Default heading + body" },
          {
            name: "ink-soft",
            hex: WISE.inkSoft,
            role: "Strong text + dark surface",
          },
          { name: "body", hex: WISE.muted, role: "Secondary body + caption" },
          {
            name: "mid-neutral",
            hex: WISE.midNeutral,
            role: "Interactive secondary",
          },
          {
            name: "dark-neutral",
            hex: WISE.darkNeutral,
            role: "Content tertiary",
          },
        ]}
      />
      <ColorGroup
        family="Accent"
        colors={[
          {
            name: "celebration",
            hex: WISE.celebration,
            role: "Celebration moments / link",
          },
          {
            name: "accent-cyan",
            hex: WISE.accentCyan,
            role: "Tertiary illustration tint",
          },
        ]}
      />
    </Section>
  );
}

function ColorGroup({
  family,
  colors,
}: {
  family: string;
  colors: Array<{
    name: string;
    hex: string;
    role: string;
    outline?: boolean;
  }>;
}) {
  return (
    <div style={{ marginBottom: 32 }}>
      <SubsectionLabel name={family} caption={`${colors.length} tokens`} />
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
          gap: 12,
        }}
      >
        {colors.map((c) => (
          <div
            key={c.hex + c.name}
            style={{
              background: WISE.surface,
              border: `1px solid ${WISE.hairline}`,
              borderRadius: 8,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                height: 84,
                background: c.hex,
                borderBottom: c.outline ? `1px solid ${WISE.hairline}` : "none",
              }}
            />
            <div style={{ padding: "10px 12px 12px" }}>
              <p
                style={{
                  margin: 0,
                  fontSize: 13,
                  fontWeight: 600,
                  color: WISE.ink,
                }}
              >
                {c.name}
              </p>
              <p
                style={{
                  margin: "2px 0 0",
                  fontFamily: "ui-monospace, SFMono-Regular, monospace",
                  fontSize: 11,
                  color: WISE.muted,
                }}
              >
                {c.hex.toLowerCase()}
              </p>
              <p
                style={{
                  margin: "6px 0 0",
                  fontSize: 11,
                  lineHeight: 1.4,
                  color: WISE.muted,
                }}
              >
                {c.role}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

//  Section 3: Typography — 9 tiers with brand sample copy

function WiseTypography() {
  const tiers: Array<{
    name: string;
    size: number;
    weight: number;
    lineHeight: number;
    letter?: string;
    family?: string;
    sample: string;
  }> = [
    {
      name: "display-xxl",
      size: 80,
      weight: 900,
      lineHeight: 0.92,
      letter: "-0.03em",
      sample: "Send money.",
    },
    {
      name: "display-xl",
      size: 56,
      weight: 900,
      lineHeight: 0.95,
      letter: "-0.025em",
      sample: "Get the real rate.",
    },
    {
      name: "display-lg",
      size: 40,
      weight: 900,
      lineHeight: 1,
      letter: "-0.02em",
      sample: "Money without borders",
    },
    {
      name: "h1",
      size: 32,
      weight: 600,
      lineHeight: 1.1,
      letter: "-0.015em",
      sample: "Multi-currency account",
    },
    {
      name: "h2",
      size: 24,
      weight: 600,
      lineHeight: 1.2,
      sample: "How Wise compares",
    },
    {
      name: "h3",
      size: 20,
      weight: 600,
      lineHeight: 1.3,
      sample: "What&apos;s the fee?",
    },
    {
      name: "body-lg",
      size: 18,
      weight: 400,
      lineHeight: 1.5,
      sample:
        "Hold and convert 40+ currencies at the real exchange rate, with a transparent fee.",
    },
    {
      name: "body-md",
      size: 16,
      weight: 400,
      lineHeight: 1.5,
      sample:
        "We charge a small upfront fee. No hidden markup on the exchange rate.",
    },
    {
      name: "label-md",
      size: 14,
      weight: 600,
      lineHeight: 1.4,
      sample: "EUR · €",
    },
  ];

  return (
    <Section>
      <SectionHeader
        eyebrow="Section 3"
        title="Typography"
        lede="Two-family pairing: Wise Sans at weight 900 for hero display sizes, Inter at 400/600 for every other tier. Inter is the universal fallback when Wise Sans isn't installed."
      />
      {/* Single white-surface card wraps every tier — same chrome as
          the spacing section so the two scales feel like one design
          language. Internal hairline borders between rows sit on white
          (where they actually show) instead of on the sage page bg
          (where they nearly disappear). */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          background: WISE.surface,
          border: `1px solid ${WISE.hairline}`,
          borderRadius: 8,
          overflow: "hidden",
        }}
      >
        {tiers.map((t, i) => (
          <div
            key={t.name}
            style={{
              padding: "20px 22px",
              borderTop: i === 0 ? "none" : `1px solid ${WISE.hairline}`,
            }}
          >
            <p
              style={{
                margin: 0,
                fontSize: Math.min(t.size, 56),
                fontWeight: t.weight,
                lineHeight: t.lineHeight,
                letterSpacing: t.letter ?? "normal",
                // ink-soft (#0e0f0c) is Wise's actual rendered headline
                // color in display contexts. The brand reserves #163300
                // (true forest green) for body text and the primary-CTA
                // foreground; large display copy lands on near-black.
                color: WISE.inkSoft,
                fontFamily: t.family ?? "inherit",
              }}
              // The sample may include HTML entities the user-facing
              // text would otherwise show literally (e.g. &apos;).
              dangerouslySetInnerHTML={{ __html: t.sample }}
            />
            <p
              style={{
                margin: "10px 0 0",
                fontFamily: "ui-monospace, SFMono-Regular, monospace",
                fontSize: 11,
                // Slightly darker than the previous muted gray so the
                // metadata line reads cleanly against the white card.
                // Family name + tier name still pop above it as ink.
                color: WISE.darkNeutral,
              }}
            >
              <strong style={{ color: WISE.ink, fontWeight: 600 }}>
                {t.name}
              </strong>
              {" · "}
              {/* Font family name highlighted with semibold + ink color
                  so it reads as the most important metadata token in
                  the line. Inter is the universal Wise font; the user
                  always wants to see which family they&apos;re looking at. */}
              <strong style={{ color: WISE.ink, fontWeight: 600 }}>
                Inter
              </strong>
              {" · "}
              {t.size}px / {t.lineHeight} · w{t.weight}
              {t.letter ? ` · ${t.letter}` : ""}
            </p>
          </div>
        ))}
      </div>
    </Section>
  );
}

//  Section 4: Layout & Spacing — 4px base scale visualized

function WiseLayout() {
  const scale = [
    { name: "xs", px: 4 },
    { name: "sm", px: 8 },
    { name: "md", px: 16 },
    { name: "lg", px: 24 },
    { name: "xl", px: 48 },
    { name: "xxl", px: 80 },
  ];
  return (
    <Section>
      <SectionHeader
        eyebrow="Section 4"
        title="Layout & Spacing"
        lede="4px base unit. Every gap, padding, margin, and section gutter is a multiple of 4. The rhythm carries the whole system."
      />
      {/* Bookend + line visualisation — same pattern the extract-result
          page uses for its spacing section. Two squares represent two
          elements; the line between them IS the spacing value at real
          pixel width. Reading the row tells you exactly what gap you&apos;d
          get between two adjacent items. */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          background: WISE.surface,
          border: `1px solid ${WISE.hairline}`,
          borderRadius: 8,
          overflow: "hidden",
        }}
      >
        {scale.map((s, i) => (
          <div
            key={s.name}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 20,
              padding: "16px 18px",
              borderTop: i === 0 ? "none" : `1px solid ${WISE.hairline}`,
            }}
          >
            {/* The visualisation. h-10 lane with two 24px ink squares
                bookending a 1px ink line whose width = the step. */}
            <div
              aria-hidden="true"
              style={{
                display: "flex",
                alignItems: "center",
                height: 24,
                flexShrink: 0,
              }}
            >
              <span
                style={{
                  width: 24,
                  height: 24,
                  background: WISE.ink,
                  borderRadius: 2,
                }}
              />
              <span
                style={{
                  height: 1,
                  width: s.px,
                  background: WISE.ink,
                }}
              />
              <span
                style={{
                  width: 24,
                  height: 24,
                  background: WISE.ink,
                  borderRadius: 2,
                }}
              />
            </div>
            {/* Metadata column — big px value on top, t-shirt label
                below in primary-dark. Same hierarchy the extract result
                page uses; just the colors flip from dark theme to light. */}
            <div style={{ minWidth: 0, flex: 1 }}>
              <p
                style={{
                  margin: 0,
                  fontSize: 18,
                  fontWeight: 700,
                  color: WISE.ink,
                  letterSpacing: "-0.01em",
                }}
              >
                {s.px}
                <span
                  style={{
                    marginLeft: 4,
                    fontSize: 11,
                    fontWeight: 600,
                    textTransform: "uppercase",
                    letterSpacing: "0.14em",
                    color: WISE.muted,
                  }}
                >
                  px
                </span>
              </p>
              <p
                style={{
                  margin: "4px 0 0",
                  fontSize: 11,
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: "0.14em",
                  color: WISE.primaryDark,
                }}
              >
                {s.name}
              </p>
            </div>
          </div>
        ))}
      </div>
    </Section>
  );
}

//  Section 5: Shapes — radius scale

function WiseShapes() {
  const shapes = [
    { name: "none", radius: 0 },
    { name: "sm", radius: 2 },
    { name: "md", radius: 8 },
    { name: "lg", radius: 16 },
    { name: "full", radius: 9999 },
  ];
  return (
    <Section>
      <SectionHeader
        eyebrow="Section 6"
        title="Shapes"
        lede="Pills (9999px) are Wise&apos;s identifying button radius. Used on every CTA, secondary, and outline button. Inputs and small chips sit at 2 to 8px, and cards use 8 to 16px for moderate softness."
      />
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(108px, 1fr))",
          gap: 16,
        }}
      >
        {shapes.map((s) => (
          <div
            key={s.name}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 10,
              padding: "14px 8px",
              background: WISE.surface,
              borderRadius: 8,
              border: `1px solid ${WISE.hairline}`,
            }}
          >
            <div
              aria-hidden="true"
              style={{
                width: 72,
                height: 72,
                background: WISE.primary,
                borderRadius: s.radius,
              }}
            />
            <div style={{ textAlign: "center" }}>
              <p
                style={{
                  margin: 0,
                  fontSize: 12,
                  fontWeight: 600,
                  color: WISE.ink,
                }}
              >
                {s.name}
              </p>
              <p
                style={{
                  margin: "2px 0 0",
                  fontFamily: "ui-monospace, SFMono-Regular, monospace",
                  fontSize: 10,
                  color: WISE.muted,
                }}
              >
                {s.radius === 9999 ? "9999px" : `${s.radius}px`}
              </p>
            </div>
          </div>
        ))}
      </div>
    </Section>
  );
}

//  Section 6: Elevation & Depth

function WiseElevation() {
  return (
    <Section>
      <SectionHeader
        eyebrow="Section 7"
        title="Elevation & Depth"
        lede="Hierarchy comes from surface contrast and hairline borders, not drop shadows. Only two box-shadow values exist on the live site."
      />
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 20,
        }}
      >
        {[
          {
            name: "Flat",
            value: "(no shadow)",
            usage: "Default surface mood",
            preview: { background: WISE.surface, border: `1px solid ${WISE.hairline}` },
          },
          {
            name: "Hairline",
            value: "0 0 0 1px rgba(22,51,0,0.12)",
            usage: "Focused input ring",
            preview: {
              background: WISE.surface,
              boxShadow: "0 0 0 1px rgba(22,51,0,0.32)",
            },
          },
          {
            name: "Soft Card",
            value: "0 10px 32px rgba(0,0,0,0.15), 0 40px 40px rgba(0,0,0,0.04)",
            usage: "Modals + popovers",
            preview: {
              background: WISE.surface,
              boxShadow:
                "0 10px 32px rgba(0,0,0,0.15), 0 40px 40px rgba(0,0,0,0.04)",
            },
          },
        ].map((e) => (
          <div
            key={e.name}
            style={{ display: "flex", flexDirection: "column", gap: 12 }}
          >
            <div
              style={{
                height: 88,
                borderRadius: 10,
                margin: "8px",
                ...e.preview,
              }}
            />
            <div>
              <p
                style={{
                  margin: 0,
                  fontSize: 13,
                  fontWeight: 600,
                  color: WISE.ink,
                }}
              >
                {e.name}
              </p>
              <p
                style={{
                  margin: "4px 0 0",
                  fontFamily: "ui-monospace, SFMono-Regular, monospace",
                  fontSize: 10,
                  lineHeight: 1.5,
                  color: WISE.muted,
                  wordBreak: "break-all",
                }}
              >
                {e.value}
              </p>
              <p
                style={{
                  margin: "6px 0 0",
                  fontSize: 11,
                  color: WISE.muted,
                }}
              >
                {e.usage}
              </p>
            </div>
          </div>
        ))}
      </div>
    </Section>
  );
}

//  Section 7: Buttons — 4 variants

function buttonBase(): CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    // Fully rounded pill — Wise's canonical CTA shape. Even though the
    // extracted radiusTokens show 2px as the most-frequent literal value,
    // the brand's identifying button silhouette is the pill. Pills are
    // applied site-wide on every CTA, secondary, and outline button.
    borderRadius: 9999,
    padding: "14px 26px",
    fontWeight: 600,
    fontSize: 16,
    lineHeight: 1,
    cursor: "default",
    fontFamily: "inherit",
    border: "1px solid transparent",
    textDecoration: "none",
  };
}

function WiseButtons() {
  return (
    <Section>
      <SectionHeader
        eyebrow="Section 5"
        title="Buttons"
        lede="Every button is a fully-rounded pill. Wise&apos;s identifying silhouette. Three flat variants ladder by emphasis, and a circular icon affordance carries inline directional actions."
      />
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 16,
        }}
      >
        <ButtonShowcase
          name="button-primary"
          caption="Brand CTA · green on ink"
        >
          <button
            type="button"
            style={{ ...buttonBase(), background: WISE.primary, color: WISE.ink }}
          >
            Learn about the Wise Travel card
          </button>
        </ButtonShowcase>
        <ButtonShowcase
          name="button-inverted"
          caption="Polarity-flipped · ink on green text"
        >
          <button
            type="button"
            style={{ ...buttonBase(), background: WISE.ink, color: WISE.primary }}
          >
            Sign up in minutes
          </button>
        </ButtonShowcase>
        <ButtonShowcase
          name="button-outline"
          caption="White fill · 1px ink border"
        >
          <button
            type="button"
            style={{
              ...buttonBase(),
              background: WISE.surface,
              color: WISE.ink,
              border: `1px solid ${WISE.ink}`,
            }}
          >
            See how it works
          </button>
        </ButtonShowcase>
        <ButtonShowcase
          name="button-icon"
          caption="Circular pair · disabled + active"
        >
          <div style={{ display: "inline-flex", gap: 12 }}>
            <button
              type="button"
              aria-label="Previous (disabled)"
              disabled
              style={{
                ...buttonBase(),
                padding: 0,
                width: 48,
                height: 48,
                background: WISE.hairline,
                color: WISE.muted,
                fontSize: 18,
                cursor: "not-allowed",
              }}
            >
              ←
            </button>
            <button
              type="button"
              aria-label="Continue"
              style={{
                ...buttonBase(),
                padding: 0,
                width: 48,
                height: 48,
                background: WISE.primary,
                color: WISE.ink,
                fontSize: 18,
              }}
            >
              →
            </button>
          </div>
        </ButtonShowcase>
      </div>
    </Section>
  );
}

function ButtonShowcase({
  name,
  caption,
  children,
}: {
  name: string;
  caption: string;
  children: ReactNode;
}) {
  return (
    <div
      style={{
        background: WISE.surface,
        border: `1px solid ${WISE.hairline}`,
        borderRadius: 10,
        padding: 24,
        display: "flex",
        flexDirection: "column",
        gap: 16,
        alignItems: "flex-start",
      }}
    >
      <SubsectionLabel name={name} caption={caption} />
      {children}
    </div>
  );
}

//  Section 8: Cards — variants

function WiseCards() {
  return (
    <Section>
      <SectionHeader
        eyebrow="Section 8"
        title="Cards"
        lede="Five variants. Three compact cards ladder by surface (white default, soft-brand feature, dark promotional), followed by an editorial feature-list card and a forest-green testimonial card pulled from the live marketing surfaces."
      />
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 16,
        }}
      >
        {/* White default */}
        <div
          style={{
            background: WISE.surface,
            border: `1px solid ${WISE.hairline}`,
            borderRadius: 8,
            padding: 24,
          }}
        >
          <p
            style={{
              margin: 0,
              fontSize: 11,
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.12em",
              color: WISE.primaryDark,
            }}
          >
            Wise account
          </p>
          <h4
            style={{
              margin: "8px 0 4px",
              fontSize: 20,
              fontWeight: 700,
              color: WISE.ink,
            }}
          >
            €1,234.56
          </h4>
          <p
            style={{
              margin: 0,
              fontSize: 14,
              color: WISE.muted,
              lineHeight: 1.5,
            }}
          >
            Default white card on sage canvas. Surface contrast carries
            the elevation.
          </p>
        </div>

        {/* Soft-brand feature card — derives a pale-green tint from the
            extracted primary at low alpha. No separate pale-green token
            exists in the captured palette; this is a CSS-side derivation
            to support brand-tinted feature surfaces without inventing a
            new color value. */}
        <div
          style={{
            background: "rgba(159, 232, 112, 0.22)",
            borderRadius: 8,
            padding: 24,
          }}
        >
          <p
            style={{
              margin: 0,
              fontSize: 11,
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.12em",
              color: WISE.primaryDark,
            }}
          >
            Reach
          </p>
          <h4
            style={{
              margin: "8px 0 4px",
              fontSize: 20,
              fontWeight: 700,
              color: WISE.ink,
            }}
          >
            Send to 160 countries
          </h4>
          <p
            style={{
              margin: 0,
              fontSize: 14,
              color: WISE.muted,
              lineHeight: 1.5,
            }}
          >
            Soft-brand feature card. A derived pale-green tint (primary at
            low alpha) highlights a brand moment without leaning on the
            full CTA green.
          </p>
        </div>

        {/* Dark promotional card */}
        <div
          style={{
            background: WISE.inkSoft,
            color: WISE.primary,
            borderRadius: 8,
            padding: 24,
          }}
        >
          <p
            style={{
              margin: 0,
              fontSize: 11,
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.12em",
              opacity: 0.7,
            }}
          >
            The Wise account
          </p>
          <h4
            style={{
              margin: "8px 0 4px",
              fontSize: 20,
              fontWeight: 700,
              color: WISE.primary,
            }}
          >
            One account, every currency
          </h4>
          <p
            style={{
              margin: 0,
              fontSize: 14,
              lineHeight: 1.5,
              // Soft brand-tinted text on the dark surface. No pale-green
              // token in the extracted palette; derived from primary at
              // lower alpha for the same on-brand softness.
              color: "rgba(159, 232, 112, 0.78)",
            }}
          >
            Polarity-flipped dark variant. Promotional moments only.
          </p>
        </div>
      </div>

      {/* Editorial feature-list card — full-width row below the 3-up
          grid. Distinct from the compact cards above: heavy display
          headline, sub-lede, hairline-divided feature rows with circular
          line-art icons, and a smaller pill CTA at the bottom. Used for
          marketing surfaces (Wise's "Make your transfer count" section
          on wise.com is the canonical example). */}
      <div style={{ marginTop: 16 }}>
        <SubsectionLabel name="card-editorial" caption="Marketing feature list" />
        <EditorialCard />
      </div>

      {/* Testimonial card. Forest-green surface, app-store badge in a
          white circular chip, a quote in primary green with markdown-
          style asterisk emphasis on the standout adjectives, and a
          white attribution. Pulled from the Wise app-store review
          marketing pattern. */}
      <div style={{ marginTop: 16 }}>
        <SubsectionLabel name="card-testimonial" caption="Forest-green review card" />
        <TestimonialCard />
      </div>
    </Section>
  );
}

// Editorial feature-list card. Heavy display heading + 3 hairline-divided
// rows + small pill CTA. Mirrors Wise's "Make your transfer count"
// marketing surface on wise.com. Kept as a sibling helper to the inline
// JSX above so the Cards section stays readable.
function EditorialCard() {
  const features = [
    {
      Icon: GraduationCapIcon,
      title: "Education",
      body: "Send tuition and living costs to students abroad, with a fee that scales with the transfer not a flat surprise.",
    },
    {
      Icon: SuitcaseIcon,
      title: "Travelling",
      body: "Hold 40+ currencies and spend like a local. Convert when the rate is right, not when you land.",
    },
    {
      Icon: HeartIcon,
      title: "Medical",
      body: "Move money to family for urgent care in minutes, with a clear receipt for every fee.",
    },
  ];
  return (
    <div
      style={{
        background: WISE.surface,
        borderRadius: 20,
        padding: "40px 36px 32px",
        border: `1px solid ${WISE.hairline}`,
      }}
    >
      <h3
        style={{
          margin: 0,
          fontSize: 46,
          lineHeight: 1.02,
          fontWeight: 900,
          letterSpacing: "-0.01em",
          textTransform: "uppercase",
          color: WISE.inkSoft,
          maxWidth: 640,
        }}
      >
        Make your transfer count
      </h3>
      <p
        style={{
          margin: "18px 0 0",
          fontSize: 16,
          lineHeight: 1.55,
          color: WISE.muted,
          maxWidth: 560,
        }}
      >
        Save up to 45% when you send money globally. Lightning-fast.
        Completely transparent.
      </p>

      <div style={{ marginTop: 28 }}>
        {features.map(({ Icon, title, body }, i) => (
          <div
            key={title}
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 20,
              padding: "20px 0",
              borderTop: `1px solid ${WISE.hairline}`,
              ...(i === features.length - 1
                ? { borderBottom: `1px solid ${WISE.hairline}` }
                : null),
            }}
          >
            <span
              aria-hidden="true"
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: 44,
                height: 44,
                borderRadius: 9999,
                border: `1px solid ${WISE.hairline}`,
                color: WISE.ink,
                flexShrink: 0,
              }}
            >
              <Icon />
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <h4
                style={{
                  margin: 0,
                  fontSize: 18,
                  fontWeight: 700,
                  color: WISE.ink,
                }}
              >
                {title}
              </h4>
              <p
                style={{
                  margin: "6px 0 0",
                  fontSize: 14,
                  lineHeight: 1.55,
                  color: WISE.muted,
                  maxWidth: 560,
                }}
              >
                {body}
              </p>
            </div>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 28 }}>
        <span
          style={{
            ...buttonBase(),
            padding: "12px 22px",
            fontSize: 14,
            background: WISE.primary,
            color: WISE.ink,
          }}
        >
          Learn about sending money
        </span>
      </div>
    </div>
  );
}

function GraduationCapIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M2 9l10-5 10 5-10 5L2 9z" />
      <path d="M6 11v5c0 1.5 2.7 3 6 3s6-1.5 6-3v-5" />
      <path d="M22 9v5" />
    </svg>
  );
}

function SuitcaseIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="3" y="7" width="18" height="13" rx="2" />
      <path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
      <path d="M3 12h18" />
    </svg>
  );
}

function HeartIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  );
}

// Renders **bold**-style emphasis in markdown source as <em>. The
// review copy in the Wise testimonial uses *cheap*, *easy*, *fast* to
// stress the value props, so the card preserves that emphasis pattern.
function emphasize(text: string) {
  const parts = text.split(/(\*[^*]+\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("*") && part.endsWith("*") && part.length > 2) {
      return (
        <em key={i} style={{ fontStyle: "italic" }}>
          {part.slice(1, -1)}
        </em>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

function TestimonialCard() {
  return (
    <div
      style={{
        background: WISE.ink,
        borderRadius: 20,
        padding: "36px 36px 56px",
        minHeight: 360,
        display: "flex",
        flexDirection: "column",
        maxWidth: 560,
      }}
    >
      <span
        aria-hidden="true"
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: 48,
          height: 48,
          borderRadius: 9999,
          background: WISE.surface,
          marginBottom: 36,
        }}
      >
        <PlayStoreIcon />
      </span>
      <blockquote
        style={{
          margin: 0,
          fontSize: 22,
          lineHeight: 1.35,
          fontWeight: 700,
          color: WISE.primary,
          maxWidth: 460,
        }}
      >
        &ldquo;{emphasize("Wise is a popular money transfer app known for being *cheap*, *easy*, and *fast* for sending money abroad.")}&rdquo;
      </blockquote>
      <p
        style={{
          margin: "28px 0 0",
          fontSize: 14,
          fontWeight: 700,
          color: WISE.surface,
        }}
      >
        Priyanka Dey
      </p>
    </div>
  );
}

// Multi-colour Google Play badge mark. Static fills (not currentColor)
// since the brand mark must stay brand-accurate.
function PlayStoreIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path d="M4 2.5v19l9.5-9.5L4 2.5z" fill="#4285F4" />
      <path d="M4 2.5L13.5 12 17 8.5 6.5 2.5 4 2.5z" fill="#34A853" />
      <path d="M4 21.5L13.5 12 17 15.5 6.5 21.5 4 21.5z" fill="#EA4335" />
      <path d="M17 8.5L13.5 12 17 15.5l3.5-2c1.2-.7 1.2-2.3 0-3l-3.5-2z" fill="#FBBC04" />
    </svg>
  );
}

//  Section 9: Form Elements

function WiseFormElements() {
  const inputStyle: CSSProperties = {
    width: "100%",
    background: WISE.surface,
    color: WISE.ink,
    border: `1px solid ${WISE.hairline}`,
    borderRadius: 2,
    padding: "12px 16px",
    fontSize: 16,
    fontFamily: "inherit",
    outline: "none",
  };
  return (
    <Section>
      <SectionHeader
        eyebrow="Section 9"
        title="Form Elements"
        lede="Inputs use 2px corner radius matching the button silhouette. Labels are sentence-case in Inter weight 600. Focus state replaces the hairline border with a brand-tinted box-shadow ring."
      />
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
          gap: 24,
          maxWidth: 720,
        }}
      >
        <div>
          <label
            htmlFor="wise-email"
            style={{
              display: "block",
              fontSize: 13,
              fontWeight: 600,
              color: WISE.ink,
              marginBottom: 6,
            }}
          >
            Email address
          </label>
          <input
            id="wise-email"
            type="email"
            placeholder="you@example.com"
            style={inputStyle}
          />
        </div>
        <div>
          <label
            htmlFor="wise-amount"
            style={{
              display: "block",
              fontSize: 13,
              fontWeight: 600,
              color: WISE.ink,
              marginBottom: 6,
            }}
          >
            How much would you like to send?
          </label>
          <input
            id="wise-amount"
            type="text"
            defaultValue="1,000.00"
            style={inputStyle}
          />
        </div>
      </div>
    </Section>
  );
}

//  Section 10: Signature Components — currency converter

function WiseSignatureWidget() {
  return (
    <Section>
      <SectionHeader
        eyebrow="Section 10"
        title="Signature Component"
        lede="The currency converter is Wise&apos;s most recognisable widget. Two amount fields with country chips, the live mid-market rate visible, and a primary CTA at the bottom. Composed entirely from tokens above."
      />
      <CurrencyConverter />
    </Section>
  );
}

function CurrencyConverter() {
  return (
    // Outer green frame — the brand-color wrap that makes the widget
    // unmistakably Wise. The white inner card sits on this canvas with
    // generous padding all around so the converter feels framed, not
    // just hosted on a green section.
    <div
      style={{
        background: WISE.primary,
        borderRadius: 28,
        padding: 28,
        maxWidth: 520,
      }}
    >
      <div
        style={{
          background: WISE.surface,
          borderRadius: 22,
          padding: 28,
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}
      >
        {/* Rate pill — sage-tinted pill in the top-right showing the
            live conversion rate. Lock icon signals the rate is secured;
            chevron implies "tap to expand". */}
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <RatePill />
        </div>

        {/* Source row */}
        <CcyField
          label="You send exactly"
          flag="🇮🇳"
          code="INR"
          amount="80,000.00"
        />

        {/* Inline discount banner — sage tint with the
            celebration-blue link inside. Pure microcopy, no action. */}
        <DiscountBanner />

        {/* Destination row */}
        <CcyField
          label="Recipient gets"
          flag="🇺🇸"
          code="USD"
          amount="811.70"
        />

        {/* Hairline divider before the meta info */}
        <hr
          aria-hidden="true"
          style={{
            border: 0,
            borderTop: `1px solid ${WISE.hairline}`,
            margin: "16px 0 8px",
          }}
        />

        <InfoRow
          icon={<ClockIcon />}
          label="Arrives"
          value="Today - in 11 hours"
        />
        <InfoRow
          icon={<ReceiptIcon />}
          label="Total fees"
          value="Included in INR amount"
          rightExtra={
            <span
              style={{
                fontSize: 14,
                fontWeight: 600,
                color: WISE.ink,
                textDecoration: "underline",
                textUnderlineOffset: 3,
                textDecorationColor: `${WISE.ink}55`,
              }}
            >
              1,727.65 INR ›
            </span>
          }
        />

        <button
          type="button"
          style={{
            ...buttonBase(),
            background: WISE.primary,
            color: WISE.ink,
            marginTop: 20,
            width: "100%",
            padding: "18px 24px",
            fontSize: 17,
          }}
        >
          Send money
        </button>
      </div>
    </div>
  );
}

// Top-right rate pill — sage-tinted, with a small lock-icon prefix.
function RatePill() {
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "8px 14px",
        background: WISE.canvasSoft,
        borderRadius: 9999,
        fontSize: 13,
        fontWeight: 600,
        color: WISE.ink,
      }}
    >
      <LockIcon />
      1 USD = 96.4302 INR
      <span aria-hidden="true" style={{ opacity: 0.55, fontSize: 14 }}>
        ›
      </span>
    </div>
  );
}

// Currency-amount row — label on top, flag chip + big amount on the
// row below. Used for both source and destination amounts in the
// converter. The chevron suggests an inline edit affordance.
function CcyField({
  label,
  flag,
  code,
  amount,
}: {
  label: string;
  flag: string;
  code: string;
  amount: string;
}) {
  return (
    <div style={{ marginTop: 4 }}>
      <p
        style={{
          margin: 0,
          fontSize: 14,
          color: WISE.ink,
          fontWeight: 500,
        }}
      >
        {label}
      </p>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
          marginTop: 10,
        }}
      >
        <CurrencyChip flag={flag} code={code} />
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            fontSize: 36,
            fontWeight: 800,
            color: WISE.inkSoft,
            letterSpacing: "-0.02em",
            lineHeight: 1,
          }}
        >
          {amount}
          <span aria-hidden="true" style={{ opacity: 0.4, fontSize: 22 }}>
            ›
          </span>
        </span>
      </div>
    </div>
  );
}

// Round-pill currency selector — flag inside a small circle, then the
// currency code, then a dropdown caret.
function CurrencyChip({ flag, code }: { flag: string; code: string }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "6px 14px 6px 6px",
        background: WISE.canvasSoft,
        borderRadius: 9999,
        fontSize: 15,
        fontWeight: 600,
        color: WISE.ink,
      }}
    >
      <span
        aria-hidden="true"
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: 28,
          height: 28,
          borderRadius: 9999,
          background: WISE.surface,
          fontSize: 16,
          lineHeight: 1,
        }}
      >
        {flag}
      </span>
      {code}
      <span aria-hidden="true" style={{ fontSize: 12, opacity: 0.6 }}>
        ▾
      </span>
    </span>
  );
}

// Inline discount banner — sage-tinted box with a small icon and a
// celebration-blue inline link. Purely informational; no action.
function DiscountBanner() {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        margin: "12px 0 18px",
        padding: "12px 14px",
        background: WISE.canvasSoft,
        borderRadius: 10,
        fontSize: 13,
        color: WISE.ink,
        lineHeight: 1.45,
      }}
    >
      <TagIcon />
      <span>
        Sending over 25,000 USD or equivalent?{" "}
        <a
          href="#"
          onClick={(e) => e.preventDefault()}
          style={{
            color: WISE.celebration,
            fontWeight: 600,
            textDecoration: "underline",
            textUnderlineOffset: 2,
          }}
        >
          We&apos;ll discount our fee
        </a>
      </span>
    </div>
  );
}

// Metadata info row with a circular icon container on the left.
function InfoRow({
  icon,
  label,
  value,
  rightExtra,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  rightExtra?: ReactNode;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 14,
        padding: "10px 0",
      }}
    >
      <span
        aria-hidden="true"
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: 40,
          height: 40,
          borderRadius: 9999,
          border: `1px solid ${WISE.hairline}`,
          color: WISE.ink,
          flexShrink: 0,
        }}
      >
        {icon}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p
          style={{
            margin: 0,
            fontSize: 13,
            color: WISE.muted,
            fontWeight: 500,
          }}
        >
          {label}
        </p>
        <p
          style={{
            margin: "2px 0 0",
            fontSize: 15,
            fontWeight: 600,
            color: WISE.ink,
          }}
        >
          {value}
        </p>
      </div>
      {rightExtra && <span style={{ flexShrink: 0 }}>{rightExtra}</span>}
    </div>
  );
}

// Inline SVG icons matching Wise's line-art style. Stroke width and
// stroke colour pick up `currentColor`, so they inherit ink from the
// container.
function LockIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="4" y="11" width="16" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

function ReceiptIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 3v18l2-2 2 2 2-2 2 2 2-2 2 2 2-2V3" />
      <path d="M8 7h8M8 11h8M8 15h5" />
    </svg>
  );
}

function TagIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: WISE.celebration, flexShrink: 0 }} aria-hidden="true">
      <path d="M20.59 13.41 13.42 20.58a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82Z" />
      <circle cx="7.5" cy="7.5" r="1.5" />
    </svg>
  );
}

//  Section 11: Pricing Tiers — 3-up grid

function WisePricingTiers() {
  const tiers = [
    {
      name: "Personal",
      price: "Free",
      period: "no monthly fee",
      lede: "For individuals sending money abroad.",
      features: [
        "Real exchange rate",
        "Send to 160+ countries",
        "Community support",
      ],
      cta: "Get started",
      featured: false,
    },
    {
      name: "Business",
      price: "$31",
      period: "one-time setup",
      lede: "For teams paying suppliers + contractors.",
      features: [
        "Everything in Personal",
        "Batch payments (up to 1,000)",
        "Multi-user access + roles",
        "Accounting integrations",
      ],
      cta: "Start free trial",
      featured: true,
    },
    {
      name: "Enterprise",
      price: "Custom",
      period: "talk to sales",
      lede: "For organisations operating globally.",
      features: [
        "Everything in Business",
        "Dedicated account manager",
        "Volume FX pricing",
        "Priority support + SLA",
      ],
      cta: "Talk to sales",
      featured: false,
    },
  ];
  return (
    <Section>
      <SectionHeader
        eyebrow="Section 11"
        title="Pricing Tiers"
        lede="Three-up plan grid with the middle tier polarity-flipped to draw the eye. Same tokens, different surface. Shows how the design system handles a real SaaS layout."
      />
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 16,
        }}
      >
        {tiers.map((t) => (
          <PricingCard key={t.name} tier={t} />
        ))}
      </div>
    </Section>
  );
}

function PricingCard({
  tier,
}: {
  tier: {
    name: string;
    price: string;
    period: string;
    lede: string;
    features: string[];
    cta: string;
    featured: boolean;
  };
}) {
  const bg = tier.featured ? WISE.inkSoft : WISE.surface;
  const fg = tier.featured ? WISE.primary : WISE.ink;
  // Featured tier meta uses primary at lower alpha for a brand-tinted
  // muted feel against the dark surface. Non-featured uses the standard
  // muted neutral.
  const meta = tier.featured ? "rgba(159, 232, 112, 0.72)" : WISE.muted;
  return (
    <div
      style={{
        background: bg,
        color: fg,
        border: tier.featured ? "none" : `1px solid ${WISE.hairline}`,
        borderRadius: 12,
        padding: 24,
        display: "flex",
        flexDirection: "column",
        gap: 16,
        position: "relative",
      }}
    >
      {tier.featured && (
        <span
          style={{
            position: "absolute",
            top: -10,
            left: 24,
            background: WISE.primary,
            color: WISE.ink,
            fontSize: 10,
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.14em",
            padding: "4px 8px",
            borderRadius: 2,
          }}
        >
          Most popular
        </span>
      )}
      <div>
        <p
          style={{
            margin: 0,
            fontSize: 11,
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.14em",
            color: meta,
          }}
        >
          {tier.name}
        </p>
        <p
          style={{
            margin: "10px 0 2px",
            fontSize: 36,
            fontWeight: 800,
            lineHeight: 1,
            color: fg,
            letterSpacing: "-0.02em",
          }}
        >
          {tier.price}
        </p>
        <p style={{ margin: 0, fontSize: 12, color: meta }}>{tier.period}</p>
      </div>
      <p style={{ margin: 0, fontSize: 14, color: meta, lineHeight: 1.5 }}>
        {tier.lede}
      </p>
      <ul
        style={{
          margin: 0,
          padding: 0,
          listStyle: "none",
          display: "flex",
          flexDirection: "column",
          gap: 8,
          borderTop: `1px solid ${tier.featured ? "rgba(255,255,255,0.1)" : WISE.hairline}`,
          paddingTop: 16,
        }}
      >
        {tier.features.map((f) => (
          <li
            key={f}
            style={{
              fontSize: 13,
              lineHeight: 1.5,
              color: fg,
              display: "flex",
              gap: 8,
              alignItems: "flex-start",
            }}
          >
            <span
              aria-hidden="true"
              style={{
                color: tier.featured ? WISE.primary : WISE.primaryDark,
                fontWeight: 700,
              }}
            >
              ✓
            </span>
            {f}
          </li>
        ))}
      </ul>
      <button
        type="button"
        style={{
          ...buttonBase(),
          background: tier.featured ? WISE.primary : WISE.ink,
          color: tier.featured ? WISE.ink : WISE.primary,
          marginTop: "auto",
        }}
      >
        {tier.cta}
      </button>
    </div>
  );
}

//  Section 12: Do's and Don'ts

function WiseDosAndDonts() {
  const dos = [
    "Use the brand green liberally on primary CTAs and focus states",
    "Pair bright green with forest-green ink (no pure black/white)",
    "Stick to 2px corner radius on buttons and inputs",
    "Use Inter (or Wise Sans at hero sizes) for everything",
    "Quote real numbers. Exact fees, exact rates.",
    "Make every fee visible. Never tuck cost behind a tooltip.",
  ];
  const donts = [
    "Don&apos;t introduce a second accent colour",
    "Don&apos;t use pill-shaped buttons or large radii on interactive elements",
    "Don&apos;t lean on heavy shadows or 3D effects",
    "Don&apos;t try to look like a consumer toy (no Lottie spam, no rainbow gradients)",
    "Don&apos;t bury fees or use disclaimer-style microcopy",
    "Don&apos;t write in passive voice or banking-ese",
  ];

  return (
    <Section style={{ paddingBottom: 72 }}>
      <SectionHeader
        eyebrow="Section 12"
        title="Do&apos;s and Don&apos;ts"
        lede="Practical guardrails. Read these before extending the system to a new surface."
      />
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
          gap: 24,
        }}
      >
        <DoDontList title="Do" items={dos} color={WISE.primaryDark} />
        <DoDontList title="Don&apos;t" items={donts} color={WISE.muted} />
      </div>
    </Section>
  );
}

function DoDontList({
  title,
  items,
  color,
}: {
  title: string;
  items: string[];
  color: string;
}) {
  return (
    <div>
      <p
        style={{
          margin: "0 0 12px",
          fontSize: 11,
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "0.14em",
          color,
        }}
        dangerouslySetInnerHTML={{ __html: title }}
      />
      <ul
        style={{
          margin: 0,
          padding: 0,
          listStyle: "none",
          display: "flex",
          flexDirection: "column",
          gap: 10,
        }}
      >
        {items.map((item, i) => (
          <li
            key={i}
            style={{
              fontSize: 13,
              lineHeight: 1.5,
              color: WISE.ink,
              paddingLeft: 18,
              position: "relative",
            }}
          >
            <span
              aria-hidden="true"
              style={{
                position: "absolute",
                left: 0,
                top: 8,
                width: 8,
                height: 2,
                background: color,
              }}
            />
            <span dangerouslySetInnerHTML={{ __html: item }} />
          </li>
        ))}
      </ul>
    </div>
  );
}
