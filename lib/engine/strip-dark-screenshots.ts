// Strip the dark-mode screenshot Buffers from tokens.json.
//
// Why this exists: the engine's `extract()` function attaches dark-mode PNG
// screenshots as raw Node `Buffer` objects on `darkMode.darkScreenshots`
// (a Record<viewport, Buffer>). When the engine subsequently writes
// tokens.json with `JSON.stringify`, those Buffers serialize as
// `{type: "Buffer", data: [n, n, n, ...]}` — one entry per byte. A single
// 1080p PNG balloons to ~30 MB of pretty-printed JSON; the full 5-viewport
// dark capture pushes tokens.json past 180 MB on dark-mode-capable sites
// (Stripe, Vercel, etc.).
//
// The PNG files are *also* saved as separate files under
// `screenshots/dark/`, so the buffers inside tokens.json are pure
// redundancy. This helper removes them once, in place, so every consumer
// (SPA route, CLI bin/extract.ts, future scripts) gets a clean
// tokens.json without having to remember the strip step. Upstream behaves
// the same way; their committed examples just don't happen to be on
// dark-mode-capable sites. See MIRROR.md Part 2.11 for context.
//
// Pure function over the disk file: reads, mutates in memory, writes back.
// Returns `true` if a strip happened, `false` if nothing needed stripping.
// Silently returns `false` if tokens.json doesn't exist or is malformed —
// callers shouldn't treat a missing strip as fatal because the underlying
// extraction may have failed for unrelated reasons.

import * as fs from 'fs';

export function stripDarkScreenshotsOnDisk(tokensPath: string): boolean {
  if (!fs.existsSync(tokensPath)) return false;

  let parsed: unknown;
  try {
    parsed = JSON.parse(fs.readFileSync(tokensPath, 'utf-8'));
  } catch {
    return false;
  }

  if (
    !parsed ||
    typeof parsed !== 'object' ||
    !('darkMode' in parsed) ||
    parsed.darkMode === null ||
    typeof parsed.darkMode !== 'object' ||
    !('darkScreenshots' in parsed.darkMode) ||
    parsed.darkMode.darkScreenshots == null
  ) {
    return false;
  }

  // The cast is safe because we just verified the shape above.
  (parsed as { darkMode: { darkScreenshots: unknown } }).darkMode.darkScreenshots = null;
  fs.writeFileSync(tokensPath, JSON.stringify(parsed, null, 2));
  return true;
}
