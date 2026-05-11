import type { Metadata } from "next";
import { Suspense } from "react";
import { Footer } from "@/components/footer";
import { Navbar } from "@/components/navbar";
import { SkipLink } from "@/components/skip-link";
import { ExtractClient } from "./extract-client";

export const metadata: Metadata = {
  title: "Extract",
  description: "Extract a DESIGN.md from any public URL.",
};

export default function ExtractPage() {
  return (
    <>
      <SkipLink />
      <Navbar />

      <main
        id="main"
        tabIndex={-1}
        className="flex flex-1 flex-col outline-none"
      >
        <Suspense fallback={<ExtractFallback />}>
          <ExtractClient />
        </Suspense>
      </main>

      <Footer />
    </>
  );
}

function ExtractFallback() {
  return (
    <div className="mx-auto w-full max-w-3xl px-6 pt-12 pb-24 sm:pt-16">
      <p className="mb-4 inline-flex items-center gap-2 font-pixel text-xs uppercase tracking-widest text-white/55">
        <span aria-hidden="true" className="size-1.5 rounded-full bg-primary" />
        loading
      </p>
      <h1 className="font-pixel text-4xl leading-[1.05] tracking-tight sm:text-6xl">
        extract
      </h1>
      <p className="mt-6 font-pixel text-xs uppercase tracking-widest text-white/50">
        warming up the engine
      </p>
    </div>
  );
}
