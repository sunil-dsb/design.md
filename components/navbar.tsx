import Link from "next/link";
import { BubbleButton } from "@/components/bubble-button";
import { StarBadge } from "@/components/star-badge";
import { GithubIcon } from "@/icons/github";

const GITHUB_REPO = "sunil-dsb/design.md";

// Star count is rendered by a tiny client component (StarBadge) so the
// server render finishes instantly and the badge fades in once GitHub
// responds. An earlier server-side implementation coupled every page
// render to GitHub's API and caused dev-server hangs when rate-limited.

export function Navbar() {
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
                aria-label="Star us on GitHub"
                className="flex items-center gap-2 px-4 py-3 text-white/80 transition hover:bg-white/5 hover:text-white sm:px-6 sm:py-4"
              >
                <span className="hidden sm:inline">star us</span>
                <GithubIcon
                  className="size-5"
                  aria-hidden="true"
                  focusable="false"
                />
                {/* Live star count — renders nothing on first paint so SSR is
                    fast; fades in once GitHub responds. Silent on failure. */}
                <StarBadge />
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
