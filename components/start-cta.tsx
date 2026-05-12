import Image from "next/image";
import { BubbleButton } from "@/components/bubble-button";
import { ArrowLineIcon } from "@/icons/arrow-line";

// Decorative floating robot mascots. Parent wrapper is aria-hidden so the
// individual Image alts can stay empty — no need to label decoration twice.
const ROBOTS = [
  {
    src: "/robots/thinking.webp",
    className: "absolute left-[6%] top-[12%] w-28 sm:w-36",
  },
  {
    src: "/robots/type-dance-front.webp",
    className: "absolute right-[12%] top-[6%] w-24 sm:w-32",
  },
  {
    src: "/robots/type-dance-3.webp",
    className: "absolute left-[14%] bottom-[14%] w-32 sm:w-44",
  },
  {
    src: "/robots/type-dance-4.webp",
    className: "absolute right-[6%] bottom-[10%] w-28 sm:w-36",
  },
];

export function StartCTA() {
  return (
    <section
      id="start"
      aria-labelledby="start-heading"
      className="relative w-full overflow-hidden px-6 py-32 text-center"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 hidden sm:block"
      >
        {ROBOTS.map((r) => (
          // Animated WebPs — Next.js's optimizer refuses animated sources
          // (it only emits single frames). `unoptimized` serves the file
          // as-is so the loop stays intact.
          <Image
            key={r.src}
            src={r.src}
            alt=""
            width={165}
            height={123}
            unoptimized
            className={`h-auto ${r.className}`}
          />
        ))}
      </div>

      <div className="relative mx-auto max-w-3xl">
        <h2
          id="start-heading"
          className="font-pixel text-3xl tracking-tight sm:text-4xl"
        >
          ship the spec, not the screenshot
        </h2>
        <p className="mx-auto mt-6 max-w-lg text-white/60">
          Drop a <code className="text-white/80">DESIGN.md</code> in your repo.
          Your AI agent stops averaging and starts referencing.
        </p>
        <div className="mt-10 flex justify-center">
          <BubbleButton
            href="/why"
            size="lg"
            // Descriptive name for screen readers & Lighthouse — the visible
            // "learn more" alone is flagged as non-descriptive link text.
            aria-label="Read why design.md exists"
            icon={<ArrowLineIcon className="size-5" />}
          >
            learn more
          </BubbleButton>
        </div>
      </div>
    </section>
  );
}
