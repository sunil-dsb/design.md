import { Features } from "@/components/features";
import { Footer } from "@/components/footer";
import { Gallery } from "@/components/gallery";
import { Hero } from "@/components/hero";
import { Navbar } from "@/components/navbar";
import { SkipLink } from "@/components/skip-link";
import { SpecPreview } from "@/components/spec-preview";
import { StartCTA } from "@/components/start-cta";

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
    </>
  );
}
