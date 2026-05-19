// Serves files from the committed `examples/<brand>/` tree so the gallery
// brand page can offer Download buttons (DESIGN.md, tokens.json, tailwind
// .css, shadcn-theme.css) via plain `<a href download>` anchors without
// having to embed the file contents as React props.
//
// Why a separate route from /api/output?
//   /api/output  TRANSIENT files written by /api/extract at request
//                  time. Filesystem source is `output/<slug>/`. No-store
//                  caching because each extraction overwrites the dir.
//   /api/example  COMMITTED files in the repo. Filesystem source is
//                   `examples/<slug>/`. Cacheable (the bytes don't
//                   change between commits) so browser + CDN can keep
//                   the file warm across page loads.
// Separating the two surfaces means each can have its own caching policy
// and access pattern without one accidentally serving the other's data.
//
// Security: the route must reject anything that escapes the examples
// root. Symlinks, `..`, NUL bytes, and absolute paths are blocked via
// realpath comparison (same defense-in-depth as /api/output).

import * as fs from "fs";
import * as path from "path";

export const runtime = "nodejs";
// `dynamic = 'force-static'` is wrong here because we serve different
// files at different sub-paths; let Next.js cache based on the URL.
// Pages that link to a specific brand's tailwind.css get cached per URL.

const EXAMPLES_ROOT = path.resolve(process.cwd(), "examples");

const CONTENT_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
};

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path: segments } = await params;

  // Defense in depth: reject traversal, NUL, and backslash before
  // resolving; then verify the resolved path is inside EXAMPLES_ROOT.
  for (const seg of segments) {
    if (seg.includes("..") || seg.includes("\0") || seg.includes("\\")) {
      return new Response("Bad path", { status: 400 });
    }
  }

  const requested = path.resolve(EXAMPLES_ROOT, ...segments);
  if (
    !requested.startsWith(EXAMPLES_ROOT + path.sep) &&
    requested !== EXAMPLES_ROOT
  ) {
    return new Response("Forbidden", { status: 403 });
  }

  if (!fs.existsSync(requested)) {
    return new Response("Not found", { status: 404 });
  }

  const stat = fs.statSync(requested);
  if (!stat.isFile()) {
    return new Response("Not a file", { status: 400 });
  }

  const ext = path.extname(requested).toLowerCase();
  const contentType = CONTENT_TYPES[ext] ?? "application/octet-stream";

  const buf = fs.readFileSync(requested);
  return new Response(new Uint8Array(buf), {
    headers: {
      "content-type": contentType,
      "content-length": String(buf.length),
      // Committed files; immutable between deploys. Hour-long browser
      // cache + day-long CDN cache. If a brand's files change, the
      // deploy rolls a new build hash and clients re-fetch.
      "cache-control": "public, max-age=3600, s-maxage=86400",
    },
  });
}
