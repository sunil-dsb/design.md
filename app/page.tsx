import { Features } from "@/components/features";
import { Footer } from "@/components/footer";
import { Gallery } from "@/components/gallery";
import { Hero } from "@/components/hero";
import { Navbar } from "@/components/navbar";
import { SkipLink } from "@/components/skip-link";
import { SpecPreview } from "@/components/spec-preview";
import { StartCTA } from "@/components/start-cta";

// JSON-LD structured data. Server-rendered into the document so crawlers
// pick up the SoftwareApplication record on first byte. The SearchAction
// shape tells Google that /extract?url= is a query endpoint, which can
// surface a sitelinks search box in the SERP.
const STRUCTURED_DATA = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      "@id": "https://design.md/#website",
      url: "https://design.md/",
      name: "design.md",
      description:
        "A markdown-first format for shipping design. Write the source of truth once — render it as a doc, a system, or a prompt.",
      potentialAction: {
        "@type": "SearchAction",
        target: "https://design.md/extract?url={query}",
        "query-input": "required name=query",
      },
    },
    {
      "@type": "SoftwareApplication",
      "@id": "https://design.md/#app",
      name: "design.md",
      applicationCategory: "DeveloperApplication",
      operatingSystem: "Web",
      url: "https://design.md/",
      description:
        "Paste a URL. Get a DESIGN.md with colors, typography, spacing, and tokens ready for your AI agent to read.",
      offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
    },
  ],
};

export default function Home() {
  return (
    <>
      <SkipLink />
      <Navbar />

      <main id="main" tabIndex={-1} className="flex flex-1 flex-col outline-none">
        <Hero />
        <Gallery />
        <SpecPreview />
        <Features />
        <StartCTA />
      </main>

      <Footer />

      <script
        type="application/ld+json"
        // Static object → safe to serialize. No user input flows into this string.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(STRUCTURED_DATA) }}
      />
    </>
  );
}
