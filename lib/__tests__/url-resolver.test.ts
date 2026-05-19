import { describe, it, expect } from 'vitest';
import {
  normalizeUrl,
  resolveUserInput,
  getGallerySlugs,
} from '../url-resolver';

//  normalizeUrl  pure URL canonicaliser, used by the API route

describe('normalizeUrl', () => {
  it('returns null for empty / whitespace-only input', () => {
    expect(normalizeUrl('')).toBeNull();
    expect(normalizeUrl('   ')).toBeNull();
  });

  it('adds https:// when no scheme is present', () => {
    expect(normalizeUrl('stripe.com')).toBe('https://stripe.com/');
  });

  it('preserves an explicit https:// scheme', () => {
    expect(normalizeUrl('https://stripe.com')).toBe('https://stripe.com/');
  });

  it('preserves an explicit http:// scheme (no silent downgrade)', () => {
    expect(normalizeUrl('http://stripe.com')).toBe('http://stripe.com/');
  });

  it('returns null for inputs `new URL` cannot parse', () => {
    expect(normalizeUrl('not a url at all')).toBeNull();
  });

  it('preserves path / query / fragment', () => {
    expect(normalizeUrl('wise.com/pricing?ref=x#top')).toBe(
      'https://wise.com/pricing?ref=x#top',
    );
  });
});

//  resolveUserInput  UI-layer resolver with brand + gallery shortcuts

describe('resolveUserInput  invalid', () => {
  it('returns invalid for empty input', () => {
    expect(resolveUserInput('')).toEqual({ kind: 'invalid' });
    expect(resolveUserInput('   ')).toEqual({ kind: 'invalid' });
  });
});

describe('resolveUserInput  gallery shortcut', () => {
  it('routes "supabase" (bare name) to /gallery/supabase', () => {
    expect(resolveUserInput('supabase')).toEqual({
      kind: 'gallery',
      href: '/gallery/supabase',
      slug: 'supabase',
    });
  });

  it('routes "supabase.com" to /gallery/supabase', () => {
    expect(resolveUserInput('supabase.com')).toEqual({
      kind: 'gallery',
      href: '/gallery/supabase',
      slug: 'supabase',
    });
  });

  it('routes "www.supabase.com" to /gallery/supabase', () => {
    expect(resolveUserInput('www.supabase.com')).toEqual({
      kind: 'gallery',
      href: '/gallery/supabase',
      slug: 'supabase',
    });
  });

  it('routes "https://supabase.com" to /gallery/supabase', () => {
    expect(resolveUserInput('https://supabase.com')).toEqual({
      kind: 'gallery',
      href: '/gallery/supabase',
      slug: 'supabase',
    });
  });

  it('routes "linear" to /gallery/linear (knows linear.app, not .com)', () => {
    expect(resolveUserInput('linear')).toEqual({
      kind: 'gallery',
      href: '/gallery/linear',
      slug: 'linear',
    });
  });

  it('routes "linear.app" to /gallery/linear', () => {
    expect(resolveUserInput('linear.app')).toEqual({
      kind: 'gallery',
      href: '/gallery/linear',
      slug: 'linear',
    });
  });

  it('routes "shopify" (bare name) to /gallery/shopify', () => {
    expect(resolveUserInput('shopify')).toEqual({
      kind: 'gallery',
      href: '/gallery/shopify',
      slug: 'shopify',
    });
  });

  it('routes "shopify.com" to /gallery/shopify', () => {
    expect(resolveUserInput('shopify.com')).toEqual({
      kind: 'gallery',
      href: '/gallery/shopify',
      slug: 'shopify',
    });
  });

  it('case-insensitive on host: "WISE.COM" still hits gallery', () => {
    const r = resolveUserInput('WISE.COM');
    expect(r.kind).toBe('gallery');
    if (r.kind === 'gallery') expect(r.slug).toBe('wise');
  });

  it('trailing slash on bare host still hits gallery', () => {
    expect(resolveUserInput('wise.com/').kind).toBe('gallery');
  });
});

describe('resolveUserInput  fresh extraction', () => {
  it('routes "anthropic" (unknown brand) to /extract with .com fallback', () => {
    expect(resolveUserInput('anthropic')).toEqual({
      kind: 'extract',
      href: '/extract?url=' + encodeURIComponent('https://anthropic.com/'),
      normalizedUrl: 'https://anthropic.com/',
    });
  });

  it('routes "anthropic.com" to /extract (no gallery yet)', () => {
    expect(resolveUserInput('anthropic.com')).toEqual({
      kind: 'extract',
      href: '/extract?url=' + encodeURIComponent('https://anthropic.com/'),
      normalizedUrl: 'https://anthropic.com/',
    });
  });

  it('routes "wise.com/pricing" to fresh extract (path  not shortcut)', () => {
    // Path /pricing  user wants extraction of that specific page, not
    // the curated gallery view.
    const r = resolveUserInput('wise.com/pricing');
    expect(r.kind).toBe('extract');
    if (r.kind === 'extract') {
      expect(r.normalizedUrl).toBe('https://wise.com/pricing');
    }
  });

  it('routes "wise.com?utm=x" to fresh extract (query  not shortcut)', () => {
    // A query string means the user is sharing a tracked URL; respect
    // that intent rather than dropping it for the curated view.
    const r = resolveUserInput('wise.com?utm=x');
    expect(r.kind).toBe('extract');
  });

  it('routes "blog.wise.com" to fresh extract (subdomain  not shortcut)', () => {
    // Different subdomain  different surface than the curated wise.com
    // extraction. Don't silently swap to /gallery/wise.
    const r = resolveUserInput('blog.wise.com');
    expect(r.kind).toBe('extract');
    if (r.kind === 'extract') {
      expect(r.normalizedUrl).toBe('https://blog.wise.com/');
    }
  });
});

//  Sync check  the gallery slugs in url-resolver match gallery.tsx's
// `live: true` entries. If a brand flips to live without an update here,
// this test fails so CI catches it before the inline-hint goes stale.

describe('gallery index sync', () => {
  it('matches every curated brand under examples/', async () => {
    // Source of truth for "what's curated" is the filesystem: every
    // `examples/<slug>/tokens.json` represents a brand whose extraction
    // has been committed and surfaced in the gallery. If the resolver
    // index drifts from the examples directory, the bare-brand shortcut
    // (e.g. "linear"  /gallery/linear) silently breaks; this test
    // catches that drift in CI before the inline-hint goes stale.
    const fs = await import('fs');
    const path = await import('path');
    const examplesDir = path.resolve(process.cwd(), 'examples');
    const exampleSlugs = fs
      .readdirSync(examplesDir, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .filter((d) =>
        fs.existsSync(path.join(examplesDir, d.name, 'tokens.json')),
      )
      .map((d) => d.name)
      .sort();
    const resolverSlugs = getGallerySlugs();
    expect(resolverSlugs).toEqual(exampleSlugs);
  });
});
