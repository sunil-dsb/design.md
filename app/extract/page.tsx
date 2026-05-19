import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AnnouncementBar } from "@/components/announcement-bar";
import { Footer } from "@/components/footer";
import { Navbar } from "@/components/navbar";
import { SkipLink } from "@/components/skip-link";
import { resolveUserInput } from "@/lib/url-resolver";
import { ExtractClient } from "./extract-client";

export const metadata: Metadata = {
  title: "Extract",
  description: "Extract a DESIGN.md from any public URL.",
};

// Next.js 16 passes searchParams as a Promise to async server-component
// pages. We resolve it server-side and run the URL through the resolver
// BEFORE rendering ExtractClient. Two outcomes worth handling early:
//
//   1. Gallery shortcut. User landed on /extract?url=supabase (could
//      have been a shared link, an old bookmark, or the home form
//      misrouted somehow)  redirect to /gallery/supabase server-side
//      so the extract chrome never flashes.
//
//   2. Normalisation. User typed "supabase.com" with no scheme  the
//      client component reads the URL via `useSearchParams`, so giving
//      it a pre-normalised URL means the auto-fire effect sends the
//      cleanly-formed value to the API. Without this step the client
//      would receive the raw input and the engine would do the parsing.
//      Both work; doing it here keeps the client's job simpler.
//
// Invalid input is passed through unchanged  the client component shows
// its own error UI in that case, which is friendlier than a redirect to
// a generic error page.
export default async function ExtractPage({
  searchParams,
}: {
  searchParams: Promise<{ url?: string }>;
}) {
  const params = await searchParams;
  const raw = params.url?.trim();
  if (raw) {
    const result = resolveUserInput(raw);
    if (result.kind === "gallery") {
      redirect(result.href);
    }
    if (result.kind === "extract" && result.normalizedUrl !== raw) {
      redirect(result.href);
    }
  }
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
