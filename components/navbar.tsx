import Link from "next/link";
import { BubbleButton } from "@/components/bubble-button";
import { GithubIcon } from "@/icons/github";

const GITHUB_REPO = "sunil-dsb/design.md";

// Fetch the public star count for the repo, server-side. Cached for an hour
// via Next.js's `revalidate` so we don't burn through GitHub's 60/hr
// unauthenticated rate limit per IP. Returns null on any failure so the
// caller can render a graceful fallback (just "star us" + icon, no badge).
async function getStarCount(): Promise<number | null> {
  try {
    const res = await fetch(`https://api.github.com/repos/${GITHUB_REPO}`, {
      next: { revalidate: 3600 },
      headers: { Accept: "application/vnd.github+json" },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { stargazers_count?: number };
    return typeof data.stargazers_count === "number"
      ? data.stargazers_count
      : null;
  } catch {
    return null;
  }
}

// 1234 → "1.2k" · 15234 → "15k" · 1500000 → "1.5M". Under 1000 stays as-is.
function formatStars(n: number): string {
  if (n < 1000) return String(n);
  if (n < 10000) return `${(n / 1000).toFixed(1)}k`;
  if (n < 1_000_000) return `${Math.round(n / 1000)}k`;
  return `${(n / 1_000_000).toFixed(1)}M`;
}

export async function Navbar() {
  const stars = await getStarCount();

  return (
    <header className="sticky top-0 z-50 w-full border-y border-white/15 bg-black/80 backdrop-blur">
      <div className="flex w-full items-stretch font-pixel text-xs tracking-widest uppercase">
        <Link
          href="/"
          aria-label="design.md home"
          className="flex items-center px-4 py-3 text-base lowercase sm:px-6 sm:py-4"
        >
          design<span className="text-primary">.</span>md
        </Link>

        <div className="flex-1" aria-hidden="true" />

        <nav aria-label="Primary">
          <ul className="flex items-stretch divide-x divide-white/15 border-l border-white/15">
            <li className="hidden sm:flex">
              <Link
                href="/why"
                className="flex items-center px-6 py-4 text-white/80 transition hover:bg-white/5 hover:text-white"
              >
                why we exist
              </Link>
            </li>
            <li className="flex">
              <a
                href={`https://github.com/${GITHUB_REPO}`}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={
                  stars !== null
                    ? `Star us on GitHub — ${stars} stars`
                    : "Star us on GitHub"
                }
                className="group flex items-center gap-3 px-4 py-3 text-white/80 transition hover:bg-white/5 hover:text-white sm:px-6 sm:py-4"
              >
                <span className="hidden sm:inline">star us</span>
                <GithubIcon
                  className="size-5 shrink-0"
                  aria-hidden="true"
                  focusable="false"
                />
                {stars !== null && (
                  <span
                    aria-hidden="true"
                    className="inline-flex items-center gap-1.5 bg-primary p-1 font-pixel text-[10px] uppercase tracking-widest leading-none text-white transition [writing-mode:vertical-rl] group-hover:brightness-110"
                  >
                    {formatStars(stars)}
                  </span>
                )}
              </a>
            </li>
            <li className="flex items-center px-2 sm:px-3">
              {/* Placeholder button until auth is wired up — renders as a
                  real <button> so it doesn't 404 like a dead /signin link. */}
              <BubbleButton aria-label="Sign in (coming soon)">
                sign in
              </BubbleButton>
            </li>
          </ul>
        </nav>
      </div>
    </header>
  );
}
