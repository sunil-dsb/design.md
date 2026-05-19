/**
 * URL resolver  the single source of truth for "what does the user mean
 * when they type X into one of our URL inputs."
 *
 * Two exports, layered:
 *
 *   normalizeUrl(raw)        pure URL canonicaliser. Trim, ensure scheme,
 *                            run through `new URL` to validate. Returns
 *                            the canonical https URL string, or null if
 *                            the input can't reasonably be coerced.
 *                            This is what the /api/extract route uses as
 *                            its final-layer safety net.
 *
 *   resolveUserInput(raw)    UI-layer wrapper. Adds two behaviours on top
 *                            of normalizeUrl:
 *                              1. Bare brand-name heuristic. "supabase"
 *                                 with no dot in the host gets `.com`
 *                                 appended  the user typed a brand, not
 *                                 a URL, and `.com` is the right default
 *                                 for ~90% of brands they mean.
 *                              2. Gallery shortcut. If the resolved host
 *                                 matches a curated `live: true` brand
 *                                 AND the path is empty / `/`, return
 *                                 `{ kind: 'gallery', href: '/gallery/<slug>' }`
 *                                 so the UI redirects to the curated
 *                                 page instead of re-extracting.
 *
 * The hero form + the /extract page both call `resolveUserInput`. The
 * /api/extract route only needs `normalizeUrl` (no gallery shortcut at
 * the API layer  the API runs extraction unconditionally; routing
 * decisions live in the UI).
 *
 * Gallery index is hardcoded below. There are six entries today. A unit
 * test in __tests__/url-resolver.test.ts asserts the index covers every
 * `live: true` brand in components/gallery.tsx so CI catches drift.
 * Auto-deriving from `examples/<slug>/tokens.json` would need build-time
 * codegen to ship safely in the client bundle  not worth the complexity
 * at six entries.
 */

/**
 * Map of canonical hostnames (lowercased, no scheme) to gallery slugs.
 * Both `www.` and bare forms are listed so a lookup is O(1) regardless
 * of which shape the user typed.
 *
 * Linear is the gotcha worth flagging: it ships on `.app`, not `.com`.
 * A bare-brand lookup ("linear") falls through to bare-brand handling
 * below, which checks brandSlug  hostname mappings too.
 */
const GALLERY_HOSTS: Record<string, string> = {
  'wise.com': 'wise',
  'www.wise.com': 'wise',
  'stripe.com': 'stripe',
  'www.stripe.com': 'stripe',
  'ibm.com': 'ibm',
  'www.ibm.com': 'ibm',
  'linear.app': 'linear',
  'www.linear.app': 'linear',
  'vercel.com': 'vercel',
  'www.vercel.com': 'vercel',
  'supabase.com': 'supabase',
  'www.supabase.com': 'supabase',
  'shopify.com': 'shopify',
  'www.shopify.com': 'shopify',
};

/**
 * Bare-brand-name  canonical hostname lookup. Lets "linear" resolve to
 * `linear.app` (not `.com`, which doesn't exist) and "wise" resolve to
 * `wise.com`. For brand names NOT in this map we fall back to appending
 * `.com`  the right default for the long tail of brand-name guesses.
 */
const BRAND_NAME_HOSTS: Record<string, string> = {
  wise: 'wise.com',
  stripe: 'stripe.com',
  ibm: 'ibm.com',
  linear: 'linear.app',
  vercel: 'vercel.com',
  supabase: 'supabase.com',
  shopify: 'shopify.com',
};

/** Returns a list of all live gallery slugs (used by tests). */
export function getGallerySlugs(): string[] {
  return Array.from(new Set(Object.values(GALLERY_HOSTS))).sort();
}

/**
 * Pure URL canonicaliser. The same logic the /api/extract route uses as
 * its final-layer safety net  exported here so the API can import it
 * instead of duplicating.
 *
 *  Trims surrounding whitespace.
 *  Ensures `https://` scheme (defaults to https; we don't downgrade to
 *    http on the user's behalf).
 *  Runs the candidate through `new URL` to validate. Invalid  null.
 *  Does NOT lowercase the host (URL parser already does); preserves the
 *    user's path/query/fragment as-is.
 *  Does NOT do the bare-brand `.com` heuristic  that's a UI concern,
 *    not an API concern.
 */
export function normalizeUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const withProtocol = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;
  try {
    return new URL(withProtocol).toString();
  } catch {
    return null;
  }
}

/**
 * Three possible outcomes when a user submits text into a URL input.
 *
 *   gallery  the input maps to a curated brand (host match + bare
 *             path). UI redirects to the curated page.
 *   extract  the input is a real URL we should crawl. UI navigates
 *             to /extract?url=<normalized>.
 *   invalid  the input can't be coerced into a URL at all (empty,
 *             malformed, hostile scheme). UI shows an inline error.
 */
export type ResolveResult =
  | { kind: 'gallery'; href: string; slug: string }
  | { kind: 'extract'; href: string; normalizedUrl: string }
  | { kind: 'invalid' };

/**
 * UI-layer resolver. Decides whether the user's input means "show me
 * the curated brand at /gallery/<slug>" or "extract this URL fresh."
 *
 * Bare brand names get the `.com` (or `.app` for Linear) treatment via
 * BRAND_NAME_HOSTS; unknown brand names fall back to `<name>.com`.
 *
 * Gallery shortcut fires ONLY when the path is `/` or empty. If the user
 * types `wise.com/pricing`, they want a specific page extracted; sending
 * them to the curated /gallery/wise would silently swap their intent.
 */
export function resolveUserInput(raw: string): ResolveResult {
  const trimmed = raw.trim();
  if (!trimmed) return { kind: 'invalid' };

  // Bare brand name shortcut: no dot, no slash, just letters/numbers
  // (so something like "linear" matches but "linear/blog" doesn't).
  // Mapped names hit the brand index for the correct TLD; unmapped
  // names fall through to the `.com` heuristic.
  const looksLikeBareName = /^[a-z0-9][a-z0-9-]{0,40}$/i.test(trimmed);
  let candidate = trimmed;
  if (looksLikeBareName) {
    const lower = trimmed.toLowerCase();
    const host = BRAND_NAME_HOSTS[lower] ?? `${lower}.com`;
    candidate = `https://${host}`;
  }

  const normalized = normalizeUrl(candidate);
  if (!normalized) return { kind: 'invalid' };

  // Gallery shortcut. Lowercase the host for the index lookup; preserve
  // case in the normalized URL we hand back (URL parser does already).
  let parsed: URL;
  try {
    parsed = new URL(normalized);
  } catch {
    return { kind: 'invalid' };
  }
  const host = parsed.hostname.toLowerCase();
  const isBarePath = parsed.pathname === '' || parsed.pathname === '/';
  const noQueryOrHash = parsed.search === '' && parsed.hash === '';
  if (isBarePath && noQueryOrHash) {
    const slug = GALLERY_HOSTS[host];
    if (slug) {
      return { kind: 'gallery', href: `/gallery/${slug}`, slug };
    }
  }

  return {
    kind: 'extract',
    href: `/extract?url=${encodeURIComponent(normalized)}`,
    normalizedUrl: normalized,
  };
}
