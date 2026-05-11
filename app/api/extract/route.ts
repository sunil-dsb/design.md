import * as fs from "fs";
import * as path from "path";
import { NextResponse } from "next/server";
import { extract, type ExtractOptions } from "@/lib/engine/extract";
import { assignColorRoles, assignTypeRoles } from "@/lib/engine/role-namer";
import type { ColorToken, TypographyLevel } from "@/lib/engine/types";

// Node runtime is required `playwright`, `fs`, and `path` are Node-only.
// (Default is `nodejs`, but explicit so we don't lose it to a refactor.)
export const runtime = "nodejs";
// Disable any caching every extraction is unique.
export const dynamic = "force-dynamic";
// Each extraction takes 30–120 s. 300 s ceiling for local dev.
export const maxDuration = 300;

interface ExtractRequest {
  url: string;
  // Optional knobs sensible defaults for first-pass local testing.
  maxPages?: number;
  noInteraction?: boolean;
  noDarkMode?: boolean;
}

function normalizeUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    // Validate by constructing.
    const u = new URL(withProtocol);
    return u.toString();
  } catch {
    return null;
  }
}

function slugForOutput(url: string): string {
  const u = new URL(url);
  // Keep it deterministic and filesystem-safe.
  return u.hostname.replace(/[^a-z0-9.-]/gi, "-");
}

export async function POST(req: Request) {
  let body: ExtractRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body must be JSON." }, { status: 400 });
  }

  const url = normalizeUrl(body.url ?? "");
  if (!url) {
    return NextResponse.json(
      { error: "Provide a valid `url` (e.g. `stripe.com` or `https://stripe.com`)." },
      { status: 400 },
    );
  }

  const slug = slugForOutput(url);
  const outputDir = path.join(process.cwd(), "output", slug);

  const options: ExtractOptions = {
    urls: [url],
    output: outputDir,
    concurrency: 8,
    // Multi-page extraction primary brand colors often only appear with
    // sufficient weight on /pricing or /docs. Single-page mode mis-classifies
    // structural greys as primary because of frequency dominance.
    maxPages: body.maxPages ?? 5,
    extraUrls: [],
    // Capture hover/focus/active/disabled states these often surface the
    // actual brand accent colours and ring/focus tokens we'd otherwise miss.
    noInteraction: body.noInteraction ?? false,
    noDarkMode: body.noDarkMode ?? false,
    verbose: false,
  };

  const startedAt = Date.now();
  try {
    await extract(options);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: `Extraction failed: ${message}`, url, options },
      { status: 500 },
    );
  }

  const tokensPath = path.join(outputDir, "tokens.json");
  if (!fs.existsSync(tokensPath)) {
    return NextResponse.json(
      { error: "Extraction completed but tokens.json was not produced.", outputDir },
      { status: 500 },
    );
  }

  // Read the tokens.json back from disk. The engine writes it as part of its
  // pipeline (extract.ts:473-476).
  type TokensShape = {
    colorTokens?: ColorToken[];
    typographyLevels?: TypographyLevel[];
    [key: string]: unknown;
  };

  let tokens: TokensShape;
  try {
    tokens = JSON.parse(fs.readFileSync(tokensPath, "utf-8"));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: `Failed to read tokens.json: ${message}` },
      { status: 500 },
    );
  }

  // ─── Our post-processing layer (plan.md §4 ADD) ─────────────────────────
  // Heuristic role naming: Primary / Ink / Canvas / Hairline / Muted /
  // Accent / Display XXL / Body MD / Button / etc. Deterministic, no LLM.
  if (Array.isArray(tokens.colorTokens)) {
    tokens.colorTokens = assignColorRoles(tokens.colorTokens);
  }
  if (Array.isArray(tokens.typographyLevels)) {
    tokens.typographyLevels = assignTypeRoles(tokens.typographyLevels);
  }

  const reportPath = path.join(outputDir, "extraction-report.json");
  const report = fs.existsSync(reportPath)
    ? JSON.parse(fs.readFileSync(reportPath, "utf-8"))
    : null;

  return NextResponse.json({
    url,
    outputDir: path.relative(process.cwd(), outputDir),
    durationMs: Date.now() - startedAt,
    tokens,
    report,
  });
}
