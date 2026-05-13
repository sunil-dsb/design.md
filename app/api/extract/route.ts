import * as fs from "fs";
import * as path from "path";
import { extract, type ExtractOptions } from "@/lib/engine/extract";
import { generatePreview } from "@/lib/engine/preview-gen";
import { runProof } from "@/lib/engine/proof";
import { generateReport } from "@/lib/engine/report-gen";
import { generatePromptPack } from "@/lib/engine/prompt-pack";
import { generateAndWriteDesignMd } from "@/lib/engine/design-md-emit";
import { assignColorRoles, assignTypeRoles } from "@/lib/engine/role-namer";
import { computeDiagnostics, type ProofSummary } from "@/lib/engine/diagnostics";
import { applyVisibilityWeighting, DEFAULT_VIEWPORT } from "@/lib/engine/visibility-weight";
import { checkAndRecordRateLimit, getClientIp } from "@/lib/rate-limit";
import type { ColorToken, TypographyLevel } from "@/lib/engine/types";

// Note on the Turbopack NFT trace warning at build time: these engine
// modules contain runtime fs/path operations on dynamic `outputDir`
// values, which makes NFT over-trace the project. The warning is
// deployment-bundle-size noise on Vercel, not a runtime issue. An
// earlier attempt to suppress it via `import(/*turbopackIgnore: true*/
// "@/lib/engine/...")` broke at runtime because the `@/` tsconfig alias
// isn't resolved when the bundler skips an import. If we need to shrink
// the deployed function bundle later, the correct fix is to either use
// a relative-path dynamic import or restructure the engine to make its
// file ops statically scoped. Until then we live with the warning.

// Node runtime is required `playwright`, `fs`, and `path` are Node-only.
export const runtime = "nodejs";
// Disable any caching every extraction is unique.
export const dynamic = "force-dynamic";
// Phase 1 extract takes 30–120 s; Phase 3 proof adds 30–60 s. 300 s ceiling
// matches local dev; on Vercel hobby max is 60 s so production deploys will
// need a hosted worker (see plan-v1.md §5).
export const maxDuration = 300;

// ─── Server-Sent Events plumbing ────────────────────────────────────────────
//
// We stream stage updates to the client over a single POST connection so the
// SPA result panel can show "crawling → extracting → proving → reporting"
// instead of a 3-minute blank spinner.
//
// Why POST + fetch streams (not EventSource): the URL to extract is in the
// request body. EventSource only supports GET, so we'd have to encode the URL
// as a query string. POST with a streaming Response is the standard 2026
// pattern for this shape of work.
//
// Event protocol (mirrors W3C SSE format):
//   event: stage
//   data: {"kind":"extract:start","label":"extracting tokens"}
//
//   event: result
//   data: {<the full JSON payload>}
//
//   event: done
//   data: {}
//
//   event: error
//   data: {"message":"..."}
//
// Comments starting with `:` are heartbeats every 15s during long-running
// stages so proxies (Vercel edge, nginx, Cloudflare) don't close the stream
// for inactivity. The browser silently ignores `:` lines.

type StageKind =
  | "extract:start"   | "extract:done"
  | "weighting:start" | "weighting:done" | "weighting:error"
  | "preview:start"   | "preview:done"   | "preview:error"
  | "proof:start"     | "proof:done"     | "proof:error"
  | "report:start"    | "report:done"    | "report:error"
  | "prompts:start"   | "prompts:done"   | "prompts:error"
  | "designmd:start"  | "designmd:done"  | "designmd:error";

interface StageEvent {
  kind: StageKind;
  label: string;
  durationMs?: number;
  // Stage-specific data, e.g. proof coverage at proof:done.
  detail?: Record<string, unknown>;
}

interface ExtractRequest {
  url: string;
  maxPages?: number;
  noInteraction?: boolean;
  noDarkMode?: boolean;
  // When true (default), runs preview-gen + proof.ts + report-gen after
  // extract finishes so the result panel can embed the visual artifacts.
  withPhase3?: boolean;
}

function normalizeUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    return new URL(withProtocol).toString();
  } catch {
    return null;
  }
}

function slugForOutput(url: string): string {
  return new URL(url).hostname.replace(/[^a-z0-9.-]/gi, "-");
}

export async function POST(req: Request) {
  let body: ExtractRequest;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Body must be JSON." }, { status: 400 });
  }

  const url = normalizeUrl(body.url ?? "");
  if (!url) {
    return Response.json(
      { error: "Provide a valid `url` (e.g. `stripe.com` or `https://stripe.com`)." },
      { status: 400 },
    );
  }

  // ── Rate limiting (after URL validation so malformed requests don't
  // burn a slot). Per-IP daily cap, configurable via
  // RATE_LIMIT_PER_IP_PER_DAY env var (default 5). Auto-bypassed when
  // NODE_ENV !== 'production' so local dev doesn't trip itself, and when
  // ?key=<value> matches RATE_LIMIT_BYPASS_KEY for demos. See
  // lib/rate-limit.ts for the full contract.
  const bypassKey = new URL(req.url).searchParams.get("key");
  const clientIp = getClientIp(req);
  const rl = checkAndRecordRateLimit(clientIp, bypassKey);
  if (!rl.allowed) {
    return Response.json(
      {
        error: `Daily limit reached — ${rl.used} of ${rl.limit} extractions used in the last 24 hours. Try again ${rl.resetIn}.`,
      },
      {
        status: 429,
        headers: { "retry-after": String(rl.retryAfterSeconds) },
      },
    );
  }

  const slug = slugForOutput(url);
  const outputDir = path.join(process.cwd(), "output", slug);

  // Seed extraUrls with high-value funnel pages that often carry component
  // variants the homepage doesn't show. `/pricing` is the most universal —
  // it's where outlined "Contact sales" buttons, comparison tables, and
  // tier-card components typically appear. Sites without /pricing 404
  // gracefully (the crawler adds them to failedUrls and continues).
  let extraUrls: string[] = [];
  try {
    const parsed = new URL(url);
    const pricingUrl = `${parsed.protocol}//${parsed.host}/pricing`;
    if (pricingUrl !== url && pricingUrl !== url.replace(/\/$/, '')) {
      extraUrls = [pricingUrl];
    }
  } catch {
    // URL was already validated above; this catch is defensive.
  }

  const options: ExtractOptions = {
    urls: [url],
    output: outputDir,
    concurrency: 8,
    // 8 pages matches the CLI default and gives the 4-layer stability
    // classifier enough cross-page evidence to separate L1 infrastructure
    // (everywhere) from L3 campaign (one-off banners). The previous
    // 5-page default left every L1 token looking single-page-unique on
    // small sites.
    maxPages: body.maxPages ?? 8,
    extraUrls,
    noInteraction: body.noInteraction ?? false,
    noDarkMode: body.noDarkMode ?? false,
    verbose: false,
  };

  const withPhase3 = body.withPhase3 !== false; // default true
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      // ── Tiny SSE writer ───────────────────────────────────────────────
      const sendEvent = (event: string, data: unknown) => {
        const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
        controller.enqueue(encoder.encode(payload));
      };
      const sendComment = (text: string) => {
        controller.enqueue(encoder.encode(`: ${text}\n\n`));
      };

      // Heartbeat keeps the connection warm during long blocking awaits
      // (extract() is 30-120s, proof is 30-60s). 15s is well under every
      // common proxy idle timeout (Cloudflare 100s, Vercel 30s).
      const heartbeat = setInterval(() => {
        try {
          sendComment("heartbeat");
        } catch {
          // Controller closed — let the cleanup in finally handle it.
        }
      }, 15000);

      // Wrap each stage so its emit + timing + error handling is uniform.
      const runStage = async <T>(
        kind: Extract<StageKind, `${string}:start`>,
        label: string,
        fn: () => Promise<T> | T,
      ): Promise<{ ok: true; value: T } | { ok: false; error: string }> => {
        const startKind = kind;
        const baseName = kind.replace(":start", "");
        const doneKind = `${baseName}:done` as StageKind;
        const errorKind = `${baseName}:error` as StageKind;

        sendEvent("stage", { kind: startKind, label } satisfies StageEvent);
        const t0 = Date.now();
        try {
          const value = await fn();
          sendEvent("stage", {
            kind: doneKind,
            label,
            durationMs: Date.now() - t0,
          } satisfies StageEvent);
          return { ok: true, value };
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          sendEvent("stage", {
            kind: errorKind,
            label,
            durationMs: Date.now() - t0,
            detail: { message },
          } satisfies StageEvent);
          return { ok: false, error: message };
        }
      };

      const warnings: string[] = [];
      const phase3 = { preview: false, proof: false, report: false, prompts: false, designmd: false };
      const overallStart = Date.now();

      try {
        // ── Phase 1: extract (the only fatal stage) ───────────────────
        // extract() returns the per-page extraction data so we can apply
        // visibility weighting (Phase 1.5) without re-running Playwright.
        // See MIRROR.md Part 2.13 for the engine signature change.
        const extractResult = await runStage(
          "extract:start",
          "extracting tokens",
          () => extract(options),
        );
        if (!extractResult.ok) {
          sendEvent("error", { message: `Extraction failed: ${extractResult.error}` });
          return;
        }
        const pageExtractions = extractResult.value;

        const tokensPath = path.join(outputDir, "tokens.json");
        if (!fs.existsSync(tokensPath)) {
          sendEvent("error", {
            message: "Extraction completed but tokens.json was not produced.",
          });
          return;
        }

        // ── Phase 1.5: visibility-and-importance weighting ──────────
        //
        // Apply visibility weighting in-memory to mutate tokens.json with
        // visibilityScore + re-sort. dna.md §11.1's wedge — the single
        // largest accuracy multiplier. See lib/engine/visibility-weight.ts.
        //
        // Phase 3 readers (preview-gen / proof / report-gen / prompt-pack /
        // design-md-emit) and the diagnostics module all benefit from the
        // re-sorted colorTokens because they iterate the array and the
        // "most important" tokens are now genuinely at the front.
        //
        // No disk sidecar — earlier versions wrote pageExtractions to an
        // `elements.json` file just so this function could read it back
        // (5-20 MB round-trip for data already in memory). The function
        // now takes the array directly.
        await runStage("weighting:start", "applying visibility weighting", () => {
          // Trim to the fields the weighting module actually consults —
          // each ElementStyle keeps rect / tag / region / color attributes
          // the weight formula needs.
          const slim = pageExtractions.map((pe) => ({
            url: pe.url,
            elements: pe.dom.elements,
          }));
          return applyVisibilityWeighting(tokensPath, slim, DEFAULT_VIEWPORT);
        });

        // ── Strip redundant dark-mode screenshot buffers from tokens.json ─
        //
        // The engine attaches dark-mode PNG screenshots as raw Node Buffers
        // on `darkMode.darkScreenshots` (a Record<viewport, Buffer>). When
        // JSON.stringify serializes those Buffers it emits a {type:'Buffer',
        // data:[n,n,n,...]} object per byte — pretty-printed, a single 1080p
        // PNG balloons to ~30MB and the full 5-viewport set pushes tokens.json
        // past 180MB on dark-mode-capable sites (Stripe, Vercel, etc.).
        //
        // The PNGs are also saved as actual files under screenshots/dark/, so
        // the buffers in tokens.json are pure redundancy. We strip them once
        // here, before Phase 3 readers parse the file. None of preview-gen /
        // proof / report-gen / prompt-pack use this field.
        //
        // Upstream behaves the same way; their committed examples just don't
        // happen to have dark mode detected. See MIRROR.md Part 2.11.
        try {
          const tokensRaw = fs.readFileSync(tokensPath, "utf-8");
          const tokensOnDisk = JSON.parse(tokensRaw);
          if (
            tokensOnDisk?.darkMode &&
            typeof tokensOnDisk.darkMode === "object" &&
            tokensOnDisk.darkMode.darkScreenshots
          ) {
            delete tokensOnDisk.darkMode.darkScreenshots;
            fs.writeFileSync(tokensPath, JSON.stringify(tokensOnDisk, null, 2));
          }
        } catch (err) {
          // Strip failure is non-fatal — tokens.json may just be larger.
          warnings.push(
            `darkScreenshots strip skipped: ${err instanceof Error ? err.message : String(err)}`,
          );
        }

        // ── Phase 3: preview / proof / report (best-effort) ───────────
        const previewPath = path.join(outputDir, "preview.html");
        const proofHtmlPath = path.join(outputDir, "proof.html");
        const reportHtmlPath = path.join(outputDir, "report.html");

        if (withPhase3) {
          const prev = await runStage(
            "preview:start",
            "generating preview",
            () => {
              generatePreview(tokensPath, outputDir);
              return fs.existsSync(previewPath);
            },
          );
          phase3.preview = prev.ok && prev.value === true;
          if (!prev.ok) warnings.push(`preview-gen failed: ${prev.error}`);

          const prf = await runStage(
            "proof:start",
            "running pixel-fidelity proof",
            async () => {
              await runProof(
                url,
                tokensPath,
                outputDir,
                phase3.preview ? previewPath : undefined,
              );
              return fs.existsSync(proofHtmlPath);
            },
          );
          phase3.proof = prf.ok && prf.value === true;
          if (!prf.ok) {
            // Common failure: target site blocks Playwright's second visit
            // after the initial crawl. Tokens are still valid; surface as a
            // warning, don't fail the request.
            warnings.push(`proof failed (tokens still valid): ${prf.error}`);
          }

          const rpt = await runStage(
            "report:start",
            "generating report",
            () => {
              generateReport(tokensPath, outputDir, undefined);
              return fs.existsSync(reportHtmlPath);
            },
          );
          phase3.report = rpt.ok && rpt.value === true;
          if (!rpt.ok) warnings.push(`report-gen failed: ${rpt.error}`);

          // Prompt pack the SPA's Phase 2 bridge. Writes a self-contained
          // universal prompt to output/<slug>/prompts/universal.md that the
          // user pastes into any AI agent (Claude Code, Claude.ai, ChatGPT,
          // Cursor, Codex, Windsurf) to produce DESIGN.md from tokens.json.
          // See lib/engine/prompt-pack.ts and plan-v1.md §7 Weekend 6b.
          const promptPackPath = path.join(outputDir, "prompts", "universal.md");
          const pmp = await runStage(
            "prompts:start",
            "preparing prompt pack",
            () => {
              generatePromptPack(tokensPath, outputDir, url);
              return fs.existsSync(promptPackPath);
            },
          );
          phase3.prompts = pmp.ok && pmp.value === true;
          if (!pmp.ok) warnings.push(`prompt-pack failed: ${pmp.error}`);

          // Deterministic DESIGN.md emitter — Path A (templates ~11 of 17
          // sections; the subjective 4 stub out with hand-offs to the
          // universal prompt). Pure function over tokens.json — no LLM,
          // scoreboard-safe. See lib/engine/design-md-emit.ts.
          const designMdPath = path.join(outputDir, "DESIGN.md");
          const dmd = await runStage(
            "designmd:start",
            "writing deterministic DESIGN.md",
            () => {
              generateAndWriteDesignMd(outputDir, url);
              return fs.existsSync(designMdPath);
            },
          );
          phase3.designmd = dmd.ok && dmd.value === true;
          if (!dmd.ok) warnings.push(`design-md-emit failed: ${dmd.error}`);
        }

        // ── Read tokens back + apply heuristic role naming ────────────
        type TokensShape = {
          colorTokens?: ColorToken[];
          typographyLevels?: TypographyLevel[];
          [key: string]: unknown;
        };

        let tokens: TokensShape;
        try {
          tokens = JSON.parse(fs.readFileSync(tokensPath, "utf-8"));
        } catch (err) {
          sendEvent("error", {
            message: `Failed to read tokens.json: ${
              err instanceof Error ? err.message : String(err)
            }`,
          });
          return;
        }

        // Heuristic role naming (Primary / Ink / Canvas / Hairline / Muted /
        // ...) runs in the response layer only — never mutates tokens.json
        // on disk. See MIRROR.md Part 2.7.
        if (Array.isArray(tokens.colorTokens)) {
          tokens.colorTokens = assignColorRoles(tokens.colorTokens);
        }
        if (Array.isArray(tokens.typographyLevels)) {
          tokens.typographyLevels = assignTypeRoles(tokens.typographyLevels);
        }

        const reportJsonPath = path.join(outputDir, "extraction-report.json");
        const report = fs.existsSync(reportJsonPath)
          ? JSON.parse(fs.readFileSync(reportJsonPath, "utf-8"))
          : null;

        // ── Read proof-data.json once and extract everything we need ──
        // We pull coverage (already used as a stat), totalSampled (feeds the
        // low-sample-size diagnostic), and the top-5 unmatched-color bins
        // (feeds the low-coverage diagnostic's details). proof.ts writes
        // unmatchedColors as {r,g,b,count}; we convert to {hex,count} here so
        // the diagnostics module stays color-format-agnostic.
        let proofCoverage: number | null = null;
        let proofSummary: ProofSummary | null = null;
        const proofDataPath = path.join(outputDir, "proof-data.json");
        if (fs.existsSync(proofDataPath)) {
          try {
            const proofData = JSON.parse(fs.readFileSync(proofDataPath, "utf-8"));
            const coverage = typeof proofData?.coverage === "number"
              ? proofData.coverage
              : null;
            const sampleSize = typeof proofData?.totalSampled === "number"
              ? proofData.totalSampled
              : null;
            const unmatchedTop = Array.isArray(proofData?.unmatchedColors)
              ? proofData.unmatchedColors
                  .slice(0, 5)
                  .map((c: { r: number; g: number; b: number; count: number }) => {
                    // Defensive: clamp to [0,255] AND coerce non-finite numbers
                    // to 0 so a stray NaN doesn't produce "#NaNNaNNaN".
                    const byte = (n: number): string => {
                      const v = Number.isFinite(n) ? Math.max(0, Math.min(255, Math.round(n))) : 0;
                      return v.toString(16).padStart(2, "0");
                    };
                    return {
                      hex: "#" + byte(c.r) + byte(c.g) + byte(c.b),
                      count: typeof c.count === "number" ? c.count : 0,
                    };
                  })
              : undefined;
            proofCoverage = coverage;
            proofSummary = { coverage, sampleSize, unmatchedTop };
          } catch {
            // Best-effort; ignore parse errors. proofCoverage stays null.
          }
        }

        // ── Engine diagnostics ────────────────────────────────────────
        // Pure function over (tokens, report, proof, warnings). Produces a
        // flat list the SPA renders in the result panel. See
        // lib/engine/diagnostics.ts for the rule set.
        const diagnostics = computeDiagnostics({
          tokens,
          report,
          proof: proofSummary,
          warnings,
        });

        const outputBase = `/api/output/${encodeURIComponent(slug)}`;
        sendEvent("result", {
          url,
          outputDir: path.relative(process.cwd(), outputDir),
          durationMs: Date.now() - overallStart,
          tokens,
          report,
          artifacts: {
            tokensJsonUrl: `${outputBase}/tokens.json`,
            previewHtmlUrl: phase3.preview ? `${outputBase}/preview.html` : null,
            proofHtmlUrl: phase3.proof ? `${outputBase}/proof.html` : null,
            reportHtmlUrl: phase3.report ? `${outputBase}/report.html` : null,
            promptPackUrl: phase3.prompts ? `${outputBase}/prompts/universal.md` : null,
            designMdUrl: phase3.designmd ? `${outputBase}/DESIGN.md` : null,
          },
          proofCoverage,
          phase3,
          warnings,
          diagnostics,
        });
        sendEvent("done", {});
      } catch (err) {
        // Last-resort catch: any unexpected throw inside the stage runner
        // pipeline. Stage-level errors are already handled inside runStage;
        // this catches the controller / encoder edge cases.
        const message = err instanceof Error ? err.message : String(err);
        try {
          sendEvent("error", { message });
        } catch {
          // Controller may already be closed.
        }
      } finally {
        clearInterval(heartbeat);
        try {
          controller.close();
        } catch {
          // Already closed.
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      "x-accel-buffering": "no", // disables nginx/Vercel response buffering
    },
  });
}
