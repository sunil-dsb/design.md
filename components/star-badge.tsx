"use client";

import { useEffect, useState } from "react";

// GitHub repo whose star count we display in the navbar. Hard-coded so
// the badge is a single source of truth — same string used by the navbar
// "Star us" link, kept here to avoid drift.
const GITHUB_REPO = "sunil-dsb/design.md";

// 1234 → "1.2k" · 15234 → "15k" · 1500000 → "1.5M". Under 1000 stays as-is.
function formatStars(n: number): string {
  if (n < 1000) return String(n);
  if (n < 10_000) return `${(n / 1000).toFixed(1)}k`;
  if (n < 1_000_000) return `${Math.round(n / 1000)}k`;
  return `${(n / 1_000_000).toFixed(1)}M`;
}

// Live star-count badge. Renders nothing on first paint so SSR finishes
// instantly; once mounted, fires a fetch to GitHub's public API and
// shows the count when it lands. Failures (rate-limit, offline, etc.)
// are silent — the badge just stays empty, the rest of the navbar is
// unaffected.
//
// This is the "small client component" pattern the navbar comment
// recommends: keep the server render fast, let the count fade in.
export function StarBadge() {
  const [stars, setStars] = useState<number | null>(null);

  useEffect(() => {
    // Cancellation flag avoids setting state if the component unmounts
    // mid-flight (rare here — the navbar is mounted for the page lifetime
    // — but defensive against StrictMode double-mount in dev).
    let cancelled = false;

    async function fetchStars() {
      try {
        const res = await fetch(
          `https://api.github.com/repos/${GITHUB_REPO}`,
          { headers: { Accept: "application/vnd.github+json" } },
        );
        if (!res.ok) return;
        const data = (await res.json()) as { stargazers_count?: number };
        if (cancelled) return;
        if (typeof data.stargazers_count === "number") {
          setStars(data.stargazers_count);
        }
      } catch {
        // GitHub rate-limited / DNS failed / user offline. Stay quiet.
      }
    }

    fetchStars();
    return () => {
      cancelled = true;
    };
  }, []);

  if (stars === null) return null;

  return (
    <span
      aria-label={`${stars} GitHub stars`}
      className="inline-flex items-center gap-1 font-pixel text-[10px] uppercase tracking-widest text-white/80"
    >
      <span aria-hidden="true">★</span>
      <span>{formatStars(stars)}</span>
    </span>
  );
}
