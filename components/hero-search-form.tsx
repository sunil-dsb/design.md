"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, type FormEvent } from "react";
import { resolveUserInput } from "@/lib/url-resolver";

/**
 * Hero URL input. Submits to /gallery/<slug> when the input maps to a
 * curated brand, otherwise to /extract?url=<normalized>. The form is
 * client-side because we show an inline hint below the input as the
 * user types ("✓ Wise is already curated  enter opens /gallery/wise").
 *
 * The hint is informational, not gating  pressing Enter always works
 * regardless of what the hint says, and the same resolver decides where
 * to navigate. Hint exists to make the gallery shortcut feel like a
 * known feature, not a hidden side-effect.
 *
 * Visual styling preserved from the previous inline form in hero.tsx so
 * the swap doesn't shift the page layout.
 */
export function HeroSearchForm({
  // Override the outer wrapper class so this can be reused in other
  // contexts (e.g. the /why bottom CTA needs `mx-auto` + no top margin
  // because it sits in a centered card, not after a subhead paragraph).
  className = "mt-10 w-full max-w-xl",
}: {
  className?: string;
} = {}) {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Hint derived from the current input, not on every keystroke via
  // useEffect  useMemo runs synchronously during render, so the hint
  // updates without a flash. Empty input  no hint (cleaner UX than
  // showing "fill in the field" guidance the user already knows).
  const hint = useMemo(() => describe(url), [url]);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const result = resolveUserInput(url);
    if (result.kind === "invalid") {
      setError("Enter a website URL or brand name (e.g. wise.com or stripe).");
      return;
    }
    setError(null);
    router.push(result.href);
  }

  return (
    <div className={className}>
      <form
        onSubmit={handleSubmit}
        role="search"
        aria-label="Generate DESIGN.md from a URL"
        className="flex w-full items-center gap-2 border border-white/20 px-2 py-2"
      >
        <label htmlFor="url" className="sr-only">
          Website URL
        </label>
        <input
          id="url"
          name="url"
          type="text"
          inputMode="url"
          required
          autoComplete="url"
          spellCheck={false}
          autoCapitalize="none"
          value={url}
          onChange={(e) => {
            setUrl(e.target.value);
            if (error) setError(null);
          }}
          placeholder="paste any website URL e.g. wise.com"
          className="min-w-0 flex-1 appearance-none bg-transparent px-3 py-2 text-sm text-white caret-white placeholder-white/30 outline-none focus:outline-none focus-visible:outline-none [-webkit-tap-highlight-color:transparent]"
        />
        <button
          type="submit"
          aria-label="Generate DESIGN.md"
          className="clip-btn shrink-0"
        >
          {/* "GENERATE " prefix hidden below sm so the form fits on a
              320px viewport. aria-label still announces the full action. */}
          <span aria-hidden="true" className="clip-btn__shadow">
            <span className="hidden sm:inline">GENERATE </span>.md
          </span>
          <span className="clip-btn__face">
            <span className="hidden sm:inline">GENERATE </span>.md
          </span>
        </button>
      </form>

      {/* Inline hint / error  sits in a fixed-min-height slot so it
          appearing / disappearing doesn't shift the page below. The
          aria-live=polite tells screen readers to announce changes
          without interrupting whatever they're reading. */}
      <p
        aria-live="polite"
        className="mt-2 min-h-5 font-pixel text-[10px] uppercase tracking-widest"
      >
        {error ? (
          <span className="text-red-300">{error}</span>
        ) : hint ? (
          <span className={hint.tone === "curated" ? "text-white" : "text-white/45"}>
            {hint.text}
          </span>
        ) : null}
      </p>
    </div>
  );
}

/**
 * Translate the resolver result into a single-line hint string.
 *  curated brand  "✓ Wise is already curated  enter opens
 *                  /gallery/wise"
 *  fresh URL     "we'll extract <host>"
 *  invalid       no hint while typing (the inline error appears only
 *                  on submit, not on every keystroke  less nag).
 * Returns null when the input is empty or invalid so the hint slot
 * stays empty.
 */
function describe(raw: string): { tone: "curated" | "fresh"; text: string } | null {
  if (!raw.trim()) return null;
  const result = resolveUserInput(raw);
  if (result.kind === "gallery") {
    const brand = result.slug.charAt(0).toUpperCase() + result.slug.slice(1);
    return {
      tone: "curated",
      text: `${brand} is already curated  enter opens /gallery/${result.slug}`,
    };
  }
  if (result.kind === "extract") {
    let host = "this URL";
    try {
      host = new URL(result.normalizedUrl).host;
    } catch {
      // unreachable  resolver only returns extract for parseable URLs
    }
    return { tone: "fresh", text: `we'll extract ${host}` };
  }
  return null;
}
