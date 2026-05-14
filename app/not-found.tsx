import type { Metadata } from "next";
import Image from "next/image";
import { BubbleButton } from "@/components/bubble-button";
import { ArrowLineIcon } from "@/icons/arrow-line";
import { Footer } from "@/components/footer";
import { Navbar } from "@/components/navbar";
import { SkipLink } from "@/components/skip-link";

export const metadata: Metadata = {
  title: "404  not in the spec",
  description: "This route wasn't documented in the DESIGN.md.",
};

export default function NotFound() {
  return (
    <>
      <SkipLink />
      <Navbar />

      <main
        id="main"
        tabIndex={-1}
        className="relative flex flex-1 flex-col items-center justify-center overflow-hidden px-6 py-16 text-center outline-none"
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 -z-10"
          style={{
            backgroundImage:
              "radial-gradient(rgba(255,255,255,0.07) 1px, transparent 1px)",
            backgroundSize: "24px 24px",
            maskImage:
              "radial-gradient(ellipse at center, black 22%, transparent 70%)",
            WebkitMaskImage:
              "radial-gradient(ellipse at center, black 22%, transparent 70%)",
          }}
        />

        <Image
          src="/robots/thinking.webp"
          alt=""
          aria-hidden="true"
          width={165}
          height={123}
          // Animated WebP  Next.js can't optimize animated sources, so
          // serve as-is. Preserves the looping animation.
          unoptimized
          className="pointer-events-none absolute bottom-8 right-4 hidden h-auto w-24 sm:right-10 sm:bottom-10 sm:block sm:w-32"
        />

        <p className="mb-5 inline-flex items-center gap-2 font-pixel text-xs uppercase tracking-widest text-white/55">
          <span
            aria-hidden="true"
            className="size-1.5 rounded-full bg-primary"
          />
          status · not found
        </p>

        <h1 className="font-pixel text-[26vw] leading-[0.85] tracking-tight sm:text-[15vw]">
          4<span className="text-primary">0</span>4
        </h1>

        <p className="mt-8 max-w-md font-pixel text-sm uppercase tracking-widest text-white/60">
          this route wasn&apos;t in the spec
        </p>

        <div className="mt-10 flex justify-center">
          <BubbleButton
            href="/"
            size="lg"
            icon={<ArrowLineIcon className="size-5" />}
          >
            back home
          </BubbleButton>
        </div>
      </main>

      <Footer />
    </>
  );
}
