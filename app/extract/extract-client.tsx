"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { ArrowIcon } from "@/icons/arrow";
import { BubbleButton } from "@/components/bubble-button";
import type { Diagnostic } from "@/lib/engine/diagnostics";
import { rolePriority, type ColorRole } from "@/lib/engine/role-namer";

// ─── Stage-tracking types ───────────────────────────────────────────────────
// Mirrors the SSE protocol defined in app/api/extract/route.ts. Four stages
// match the four awaited blocks server-side; ordering is fixed so the loading
// UI can render them as a deterministic checklist.

type StageStatus = "pending" | "running" | "done" | "error";

interface StageState {
  status: StageStatus;
  label: string;
  durationMs?: number;
  message?: string;
}

type StageKey = "extract" | "weighting" | "preview" | "proof" | "report" | "prompts" | "designmd";

const STAGE_ORDER: StageKey[] = ["extract", "weighting", "preview", "proof", "report", "prompts", "designmd"];

const INITIAL_STAGES: Record<StageKey, StageState> = {
  extract:   { status: "pending", label: "extracting tokens" },
  weighting: { status: "pending", label: "applying visibility weighting" },
  preview:   { status: "pending", label: "generating preview" },
  proof:     { status: "pending", label: "running pixel-fidelity proof" },
  report:    { status: "pending", label: "generating report" },
  prompts:   { status: "pending", label: "preparing prompt pack" },
  designmd:  { status: "pending", label: "writing deterministic DESIGN.md" },
};

// Server emits stage kinds like "extract:start" / "preview:done" /
// "proof:error". Strip the suffix to get the StageKey.
function parseStageKind(kind: string): { key: StageKey; phase: "start" | "done" | "error" } | null {
  const [base, phase] = kind.split(":");
  if (!STAGE_ORDER.includes(base as StageKey)) return null;
  if (phase !== "start" && phase !== "done" && phase !== "error") return null;
  return { key: base as StageKey, phase };
}

// ─── SSE reader ─────────────────────────────────────────────────────────────
// Parses a text/event-stream body into discrete (event, data) callbacks.
// Handles message framing on \n\n boundaries, decodes JSON `data:` payloads,
// and silently skips heartbeats (lines starting with `:`).
//
// Why not EventSource? EventSource only supports GET and we POST a JSON body
// containing the URL to extract. Reading the fetch response body manually is
// the standard 2026 SSE-over-POST pattern.

async function readSse(
  body: ReadableStream<Uint8Array>,
  onEvent: (event: string, data: unknown) => void,
): Promise<void> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      // SSE messages are separated by a blank line. The spec accepts
      // either LF (\n\n) or CRLF (\r\n\r\n); our server emits LF directly
      // but proxies sometimes translate. Match both with a regex.
      let separatorMatch = /\r?\n\r?\n/.exec(buffer);
      while (separatorMatch !== null) {
        const sepIndex = separatorMatch.index;
        const sepLen = separatorMatch[0].length;
        const rawMessage = buffer.slice(0, sepIndex);
        buffer = buffer.slice(sepIndex + sepLen);

        const trimmed = rawMessage.trim();
        if (trimmed.length > 0) {
          let eventName = "message";
          const dataParts: string[] = [];
          // Tolerate CRLF line endings inside a message too.
          for (const line of rawMessage.split(/\r?\n/)) {
            // Comment line — heartbeat or note. Skip.
            if (line.startsWith(":")) continue;
            if (line.startsWith("event:")) {
              eventName = line.slice(6).trim();
            } else if (line.startsWith("data:")) {
              // SSE spec: multiple `data:` lines concatenate with \n. We
              // join with empty string because our server always sends a
              // single-line JSON payload, but the protocol allows both.
              dataParts.push(line.slice(5).trimStart());
            }
          }
          const dataStr = dataParts.join("");
          let parsed: unknown = dataStr;
          try {
            parsed = JSON.parse(dataStr);
          } catch {
            // Leave parsed as the raw string when JSON parsing fails.
          }
          onEvent(eventName, parsed);
        }

        separatorMatch = /\r?\n\r?\n/.exec(buffer);
      }
    }
  } finally {
    reader.releaseLock();
  }
}

interface ExtractResponse {
  url: string;
  outputDir: string;
  durationMs: number;
  tokens: {
    colorTokens?: Array<{
      hex: string;
      frequency: number;
      stability?: { layer: string; confidence: number };
      role?: string | null;
      roleLabel?: string | null;
    }>;
    typographyLevels?: Array<{
      fontFamily: string;
      fontSize: string;
      fontWeight: string;
      frequency: number;
      role?: string | null;
      roleLabel?: string | null;
    }>;
    spacingSystem?: {
      baseUnit: number;
      scale: number[];
      sectionSpacing?: number[];
      maxContentWidth?: string | null;
    };
    radiusTokens?: Array<{
      value: string;
      frequency: number;
      typicalElements?: string[];
    }>;
    shadowTokens?: Array<{
      value: string;
      frequency: number;
      type?: string;
      typicalElements?: string[];
    }>;
    motionSystem?: {
      durationScale?: Array<{ label: string; value: string; frequency: number }>;
      primaryTimingFunction?: string;
      timingFunctions?: Array<{ value: string; frequency: number }>;
      keyframeAnimations?: Array<{ name: string; type: string; duration: string; properties?: string[] }>;
      prefersReducedMotion?: boolean;
    } | null;
    a11yTokens?: {
      focusIndicator?: { style?: Record<string, string>; consistent?: boolean };
      contrastPairs?: Array<{
        foreground: string;
        background: string;
        ratio: number;
        meetsAA: boolean;
        meetsAAA: boolean;
        usageCount?: number;
      }>;
      minTouchTarget?: { width: number; height: number };
      altTextCoverage?: { withAlt: number; withoutAlt: number; total: number; percentage: number };
      tabOrder?: { tabbableCount: number; hasPositiveTabindex: boolean; positiveTabindexCount: number };
      skipLinkDetected?: boolean;
      reducedMotionSupport?: boolean;
    };
    breakpoints?: Array<{ query?: string; type: string; value: string; ruleCount: number }>;
    components?: Array<{
      type: string;
      variants: Array<{
        name: string;
        count: number;
        style: Record<string, string>;
        hoverChanges?: Record<string, string> | null;
        focusVisibleChanges?: Record<string, string> | null;
        focusChanges?: Record<string, string> | null;
        activeChanges?: Record<string, string> | null;
        disabledStyle?: Record<string, string> | null;
        transition?: string | null;
        sampleTexts?: string[];
      }>;
    }>;
    iconSystem?: {
      library?: string | null;
      sizeScale?: number[];
      strokeWidth?: number | null;
      colorMode?: string;
      totalCount?: number;
      labeledPercentage?: number;
    } | null;
    meta?: {
      framework?: {
        tailwind?: { detected: boolean } | null;
        uiFramework?: string | null;
      };
    };
    darkMode?: { supported: boolean; detectionMethod: string };
  };
  report: unknown;
  // Phase 3 artifacts written to output/<slug>/ and served via /api/output.
  // Null when generation was skipped (withPhase3: false) or failed gracefully.
  artifacts?: {
    tokensJsonUrl: string;
    previewHtmlUrl: string | null;
    proofHtmlUrl: string | null;
    reportHtmlUrl: string | null;
    promptPackUrl: string | null;
    designMdUrl: string | null;
  };
  // proof.ts ΔE<12 pixel coverage, 0..1. Null when proof step skipped/failed.
  proofCoverage?: number | null;
  phase3?: { preview: boolean; proof: boolean; report: boolean; prompts: boolean; designmd: boolean };
  warnings?: string[];
  /**
   * Engine diagnostics from lib/engine/diagnostics.ts. Surfaces things the
   * engine flagged as suspicious or low-confidence (low pixel coverage,
   * single-page noise, primary-is-grey, framework miscall, etc.). Always
   * an array — empty means clean extraction.
   */
  diagnostics?: Diagnostic[];
}

export function ExtractClient() {
  const searchParams = useSearchParams();
  const [url, setUrl] = useState(searchParams.get("url") ?? "");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ExtractResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [stages, setStages] = useState<Record<StageKey, StageState>>(
    () => structuredClone(INITIAL_STAGES),
  );
  // Allow aborting an in-flight stream if the user resubmits or navigates.
  const abortRef = useRef<AbortController | null>(null);
  // Ensures the on-mount auto-extraction only fires once per mount, even
  // if React strict-mode runs the effect twice in dev.
  const autoFiredRef = useRef(false);

  // Core extraction logic, parameterised on the target URL. Both the form
  // submit handler and the auto-fire effect call this. Lets the auto-fire
  // path use the URL pulled directly from searchParams without depending
  // on the input state having been hydrated by React first.
  async function runExtraction(targetUrl: string) {
    const trimmed = targetUrl.trim();
    if (!trimmed) return;

    // Cancel any prior in-flight request so a fast double-submit doesn't
    // leave two streams racing.
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setResult(null);
    setError(null);
    setStages(structuredClone(INITIAL_STAGES));

    try {
      const res = await fetch("/api/extract", {
        // maxPages intentionally omitted — the API route's default is 8,
        // matching the CLI default. Hard-coding 5 here would silently
        // override that.
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: trimmed }),
        signal: controller.signal,
      });

      // Server may reject before opening the stream (400 / 500 with a JSON
      // body). Detect that path and surface the message directly.
      if (!res.ok) {
        const fallback = `Request failed (${res.status})`;
        try {
          const data = await res.json();
          setError(typeof data?.error === "string" ? data.error : fallback);
        } catch {
          setError(fallback);
        }
        return;
      }

      if (!res.body) {
        setError("Server response had no body.");
        return;
      }

      // Track terminal events locally — React state updates inside the
      // onEvent callback are async, so we can't read `result`/`error`
      // state immediately after readSse returns. These locals give us a
      // reliable signal to detect a dropped connection mid-stream.
      let resultReceived = false;
      let errorReceived = false;

      await readSse(res.body, (event, data) => {
        if (event === "stage" && data && typeof data === "object") {
          const ev = data as { kind?: string; label?: string; durationMs?: number; detail?: { message?: string } };
          const parsed = ev.kind ? parseStageKind(ev.kind) : null;
          if (!parsed) return;
          setStages((prev) => ({
            ...prev,
            [parsed.key]: {
              status:
                parsed.phase === "start"
                  ? "running"
                  : parsed.phase === "done"
                  ? "done"
                  : "error",
              label: ev.label ?? prev[parsed.key].label,
              durationMs: ev.durationMs ?? prev[parsed.key].durationMs,
              message: ev.detail?.message ?? prev[parsed.key].message,
            },
          }));
        } else if (event === "result" && data && typeof data === "object") {
          resultReceived = true;
          setResult(data as ExtractResponse);
        } else if (event === "error" && data && typeof data === "object") {
          errorReceived = true;
          const ev = data as { message?: string };
          setError(ev.message ?? "Unknown server error.");
        }
        // 'done' is just a stream sentinel — no UI action needed.
      });

      // Stream ended without a terminal event. Connection dropped between
      // a heartbeat and the `result`/`error` payload, or the server crashed
      // before emitting. Surface this clearly instead of leaving the user
      // staring at a stuck loading panel.
      if (!resultReceived && !errorReceived) {
        setError(
          "The extraction stream ended unexpectedly. Check the server logs and try again.",
        );
      }
    } catch (err) {
      // AbortError happens on intentional cancel — don't surface as an error.
      if (err instanceof DOMException && err.name === "AbortError") return;
      // Same guard as the finally block: only surface our own error if we
      // are still the current request. A superseded request must not write
      // to shared state.
      if (abortRef.current === controller) {
        setError(err instanceof Error ? err.message : String(err));
      }
    } finally {
      // Only finalize state if we are still the current request. A fast
      // double-submit aborts us; the newer handleSubmit invocation already
      // set abortRef.current to its own controller and setLoading(true).
      // If we set loading=false / null abortRef here, we'd clobber the
      // newer request's tracking and cause a "not loading" flicker.
      if (abortRef.current === controller) {
        setLoading(false);
        abortRef.current = null;
      }
    }
  }

  // Thin form wrapper — just prevents default and delegates to runExtraction
  // with the current input state.
  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    await runExtraction(url);
  }

  // ── Auto-fire on mount when ?url= is present in the URL ─────────────
  // The homepage hero submits its form as `GET /extract?url=...`, so users
  // arrive here with a URL already chosen. Pre-filling the input is good
  // but not enough — the visual signal of having clicked GENERATE on the
  // homepage implies the work should already be in flight. We start it
  // automatically the moment this client component hydrates.
  //
  // `autoFiredRef` is a useRef (survives re-renders, not affected by
  // strict-mode double-invocation) so the request only fires once per
  // genuine mount. The user can re-extract by editing the URL and
  // re-submitting — the ref doesn't block that path.
  useEffect(() => {
    const initial = searchParams.get("url");
    if (initial && !autoFiredRef.current) {
      autoFiredRef.current = true;
      runExtraction(initial);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <article className="mx-auto w-full max-w-3xl px-6 pt-12 pb-24 sm:pt-16">
      <Header url={result?.url ?? url} hasResult={!!result} />

      <form
        onSubmit={handleSubmit}
        role="search"
        aria-label="Extract DESIGN.md from a URL"
        aria-busy={loading}
        className="mt-10 flex w-full items-center gap-2 border border-white/20 px-2 py-2"
      >
        <label htmlFor="extract-url" className="sr-only">
          Website URL
        </label>
        <input
          id="extract-url"
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="stripe.com  or  https://stripe.com"
          disabled={loading}
          autoComplete="url"
          inputMode="url"
          className="min-w-0 flex-1 appearance-none bg-transparent px-3 py-2 text-sm text-white caret-white placeholder-white/50 outline-none disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={loading || !url.trim()}
          aria-label={
            loading
              ? "Extracting DESIGN.md"
              : "Extract DESIGN.md from this URL"
          }
          className="clip-btn shrink-0 disabled:opacity-40"
        >
          <span aria-hidden="true" className="clip-btn__shadow">
            {loading ? "EXTRACTING" : "EXTRACT"}
          </span>
          <span aria-hidden="true" className="clip-btn__face">
            {loading ? "EXTRACTING" : "EXTRACT"}
          </span>
        </button>
      </form>

      {/* Exclusive ordering: result wins over error wins over loading.
          Prevents a brief double-render when the SSE `result` event arrives
          and `setLoading(false)` is still scheduled. */}
      {result ? (
        <ResultState result={result} />
      ) : error ? (
        <ErrorState message={error} />
      ) : loading ? (
        <LoadingState stages={stages} />
      ) : null}
    </article>
  );
}

function Header({ url, hasResult }: { url: string; hasResult: boolean }) {
  const displayUrl = (url || "no url yet")
    .replace(/^https?:\/\//, "")
    .replace(/\/$/, "");

  return (
    <header>
      <p className="mb-4 inline-flex items-center gap-2 font-pixel text-xs uppercase tracking-widest text-white/55">
        <span aria-hidden="true" className="size-1.5 rounded-full bg-primary" />
        {hasResult ? "extracted from" : "extract from"}
      </p>
      <h1 className="wrap-break-word font-pixel text-4xl leading-[1.05] tracking-tight sm:text-6xl">
        {displayUrl.split(".").map((part, i, arr) => (
          <span key={`${part}-${i}`}>
            {part}
            {i < arr.length - 1 && <span className="text-primary">.</span>}
          </span>
        ))}
      </h1>
    </header>
  );
}

function LoadingState({
  stages,
}: {
  stages: Record<StageKey, StageState>;
}) {
  // Pick a coarse current-stage label for the panel header. The first
  // running stage wins; if none are running yet we say "starting".
  const runningKey = STAGE_ORDER.find((k) => stages[k].status === "running");
  const headerLabel = runningKey ? stages[runningKey].label : "starting up";

  return (
    <Panel
      label="status"
      tone="info"
      className="mt-10"
      role="status"
      ariaLive="polite"
    >
      <p className="font-pixel text-sm uppercase tracking-widest text-white">
        {headerLabel}
      </p>
      <p className="mt-3 text-sm text-white/70">
        Crawling up to 8 pages, capturing styles, clustering tokens, applying
        visibility-and-importance weighting, running the pixel-fidelity proof,
        and assembling the report. Usually 90–240 seconds.
      </p>

      <ul role="list" className="mt-6 divide-y divide-white/10 border border-white/10">
        {STAGE_ORDER.map((key, i) => (
          <StageRow
            key={key}
            index={i + 1}
            state={stages[key]}
          />
        ))}
      </ul>
    </Panel>
  );
}

function StageRow({
  index,
  state,
}: {
  index: number;
  state: StageState;
}) {
  const indicator = (() => {
    switch (state.status) {
      case "done":
        return (
          <span
            aria-hidden="true"
            className="grid size-5 place-items-center bg-primary text-[10px] font-pixel text-black"
          >
            ✓
          </span>
        );
      case "running":
        return (
          <span aria-hidden="true" className="relative grid size-5 place-items-center">
            <span className="absolute inset-0 animate-ping rounded-full border border-primary/60" />
            <span className="size-2 rounded-full bg-primary" />
          </span>
        );
      case "error":
        return (
          <span
            aria-hidden="true"
            className="grid size-5 place-items-center bg-red-500/20 text-[10px] font-pixel text-red-300"
          >
            !
          </span>
        );
      default:
        return (
          <span
            aria-hidden="true"
            className="grid size-5 place-items-center border border-white/15 text-[10px] font-pixel text-white/30"
          />
        );
    }
  })();

  const accent =
    state.status === "done"
      ? "text-white"
      : state.status === "running"
      ? "text-white"
      : state.status === "error"
      ? "text-red-300"
      : "text-white/60";

  return (
    <li
      aria-label={`Stage ${index} ${state.label}: ${state.status}`}
      className="grid grid-cols-[auto_1fr_auto] items-center gap-4 px-4 py-3"
    >
      <div className="flex items-center gap-3">
        <span
          aria-hidden="true"
          className="font-pixel text-[10px] uppercase tracking-widest text-white/55"
        >
          {String(index).padStart(2, "0")}
        </span>
        {indicator}
      </div>

      <div className="min-w-0">
        <p className={`font-pixel text-xs uppercase tracking-widest ${accent}`}>
          {state.label}
        </p>
        {state.status === "error" && state.message && (
          <p className="mt-1 truncate font-mono text-[11px] text-red-300">
            {state.message}
          </p>
        )}
      </div>

      <span
        aria-hidden="true"
        className="font-mono text-[11px] text-white/60"
      >
        {state.durationMs !== undefined
          ? `${(state.durationMs / 1000).toFixed(1)}s`
          : state.status === "running"
          ? "…"
          : ""}
      </span>
    </li>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <Panel
      label="error"
      tone="error"
      className="mt-10"
      role="alert"
      ariaLive="assertive"
    >
      <p className="font-pixel text-sm uppercase tracking-widest text-white">
        extraction failed
      </p>
      <p className="mt-3 text-sm wrap-break-word text-white/80">{message}</p>
    </Panel>
  );
}

function ResultState({ result }: { result: ExtractResponse }) {
  const { tokens, durationMs, outputDir, artifacts, proofCoverage, diagnostics } =
    result;
  const colors = tokens.colorTokens ?? [];
  // Show named colors in role-priority order — Primary first, then Accent,
  // then brand-dark/soft, then text/surface/structural. Within each role,
  // ties break on the engine's existing frequency. The visibility-weighted
  // order on `colors` is preserved for the long-tail block below.
  const namedColors = colors
    .filter((c) => c.roleLabel)
    .slice()
    .sort((a, b) => {
      const pa = rolePriority(a.role as ColorRole | null | undefined);
      const pb = rolePriority(b.role as ColorRole | null | undefined);
      if (pa !== pb) return pa - pb;
      return b.frequency - a.frequency;
    });
  const longTailColors = colors.filter((c) => !c.roleLabel);
  const typography = tokens.typographyLevels ?? [];

  // Replace "framework" with "fidelity" when proof.ts ran successfully — it's
  // the wedge stat (regenerated ramps & visible accuracy, plan-v1.md §2). Falls
  // back to framework name when proof is unavailable so we never show a blank.
  const fidelityStat =
    typeof proofCoverage === "number"
      ? { label: "ΔE<12 fidelity", value: `${(proofCoverage * 100).toFixed(1)}%` }
      : {
          label: "framework",
          value:
            tokens.meta?.framework?.uiFramework ??
            (tokens.meta?.framework?.tailwind?.detected ? "tailwind" : "—"),
        };

  return (
    <div className="mt-12 space-y-16">
      <Stats
        items={[
          { label: "duration", value: `${(durationMs / 1000).toFixed(1)}s` },
          { label: "colors", value: String(colors.length) },
          { label: "type levels", value: String(typography.length) },
          fidelityStat,
        ]}
      />

      {/* Engine diagnostics moved BELOW (just before the full-tokens.json
          details) — they're "things to verify" notes, not the headline.
          Surfacing them under the stats made them feel like a problem with
          the result; they're more useful as a tucked-away review aid. */}

      {namedColors.length > 0 && (
        <SectionHeader index={1} label="named colors" count={namedColors.length}>
          <div className="grid grid-cols-2 gap-px overflow-hidden border border-white/10 bg-white/10 sm:grid-cols-3 md:grid-cols-4">
            {namedColors.map((c, i) => (
              <ColorCell key={`${c.hex}-${i}`} hex={c.hex} label={c.roleLabel!} frequency={c.frequency} layer={c.stability?.layer} />
            ))}
          </div>
        </SectionHeader>
      )}

      {longTailColors.length > 0 && (
        <CollapsibleSection
          index={2}
          label="long-tail colors"
          count={longTailColors.length}
          subtitle="Unlabelled colors below the role-naming threshold. Review for clustering accuracy."
          defaultOpen={false}
        >
          <ul
            role="list"
            className="grid grid-cols-4 gap-2 sm:grid-cols-6 md:grid-cols-8"
          >
            {longTailColors.slice(0, 16).map((c, i) => (
              <li
                key={`${c.hex}-${i}`}
                className="border border-white/10 p-2"
              >
                <div
                  aria-hidden="true"
                  className="aspect-square w-full"
                  style={{ background: c.hex }}
                />
                <p className="mt-2 truncate font-mono text-[10px] text-white/70">
                  {c.hex}
                </p>
              </li>
            ))}
          </ul>
        </CollapsibleSection>
      )}

      {typography.length > 0 && (
        <SectionHeader
          index={namedColors.length > 0 ? (longTailColors.length > 0 ? 3 : 2) : 1}
          label="typography"
          count={typography.length}
        >
          <ul
            role="list"
            className="divide-y divide-white/10 border border-white/15"
          >
            {typography.slice(0, 16).map((t, i) => (
              <TypographyRow key={`${t.fontFamily}-${i}`} index={i + 1} t={t} />
            ))}
          </ul>
        </SectionHeader>
      )}

      {/* Native render of the report data (was previously an iframe-loaded
          report.html). Each section uses the SPA's design language so the
          result reads as one coherent page instead of an embedded foreign
          document. The standalone report.html is still produced on disk
          and available via the Downloads bar below. */}
      <SpacingSection spacingSystem={tokens.spacingSystem} />
      <RadiusSection radiusTokens={tokens.radiusTokens} />
      <ShadowsSection shadowTokens={tokens.shadowTokens} />
      <MotionSection motionSystem={tokens.motionSystem} />
      <LiveComponentsSection components={tokens.components} />
      <AccessibilitySection a11yTokens={tokens.a11yTokens} />
      <ResponsiveSection breakpoints={tokens.breakpoints} />
      <IconographySection iconSystem={tokens.iconSystem} />

      {/* The fidelity-proof side-by-side is still iframe-loaded because its
          value IS the pixel-rendered side-by-side comparison — there's no
          better native equivalent. Keeping it inline below the rendered
          tokens so users can verify what they're seeing. */}
      {artifacts?.proofHtmlUrl && (
        <ProofPreviewSection proofHtmlUrl={artifacts.proofHtmlUrl} />
      )}

      {artifacts?.promptPackUrl && (
        <PromptPackSection promptPackUrl={artifacts.promptPackUrl} />
      )}

      {artifacts && (
        <Downloads
          artifacts={artifacts}
          outputDir={outputDir}
        />
      )}

      {/* WarningsList replaced by DiagnosticsPanel up top — pipeline
          warnings are now folded into the diagnostics module as
          pipeline-warning-* entries (see lib/engine/diagnostics.ts §1). */}

      {/* Engine diagnostics — review aid positioned after the primary
          result content so they don't dominate the page. Accordion-style:
          each row collapsed by default, expand for the full reason. */}
      {diagnostics && diagnostics.length > 0 && (
        <DiagnosticsPanel diagnostics={diagnostics} />
      )}

      <details className="overflow-hidden border border-white/15">
        <summary className="flex cursor-pointer items-center justify-between bg-white/3 px-4 py-3 font-pixel text-xs uppercase tracking-widest text-white/70">
          full tokens.json
          <ArrowIcon className="size-4 rotate-90 text-white/50" aria-hidden="true" focusable="false" />
        </summary>
        <pre className="overflow-x-auto px-5 py-4 font-mono text-[11px] leading-relaxed text-white/70">
          <code>{JSON.stringify(tokens, null, 2)}</code>
        </pre>
      </details>

      <p className="text-xs text-white/60">
        files written to{" "}
        <code className="font-mono text-white/80">{outputDir}/</code>
      </p>
    </div>
  );
}

// ─── Small copy-to-clipboard chip used inline next to tokens ──────────────
// Single-button UX: shows "copy" by default, flips to "copied ✓" for 1.5s
// after a successful write. Fails silently — the visible value is always
// readable so the user can copy by hand if clipboard API isn't available.
function CopyValue({
  value,
  label,
}: {
  value: string;
  label?: string;
}) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // No-op — assistive UX fallback is the visible value itself.
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      aria-label={`Copy ${label ?? value} to clipboard`}
      className={`shrink-0 px-2 py-1 font-pixel text-[10px] uppercase tracking-widest transition-colors ${
        copied
          ? "text-primary"
          : "text-white/55 hover:text-white"
      }`}
    >
      {copied ? "copied ✓" : "copy"}
    </button>
  );
}

// ─── Reusable section header for the new native sections ─────────────────
// Mirrors the existing SectionHeader pattern (pixel index + horizontal rule
// + label + count) but takes a `subtitle` slot for short human-readable
// blurbs, and lets the section body live as its children.
function PanelHeader({
  label,
  count,
  subtitle,
  rightSlot,
}: {
  label: string;
  count?: number | string;
  subtitle?: string;
  rightSlot?: ReactNode;
}) {
  const headingId = `panel-${label.replace(/\s+/g, "-").replace(/[^a-z0-9-]/gi, "")}`;
  return (
    <header className="mb-4">
      <div className="flex items-center gap-3">
        <span aria-hidden="true" className="h-px flex-1 bg-white/10" />
        <h2
          id={headingId}
          className="font-pixel text-xs uppercase tracking-widest text-white"
        >
          {label}
          {count !== undefined && (
            <span className="sr-only"> ({count} items)</span>
          )}
        </h2>
        {count !== undefined && (
          <span
            aria-hidden="true"
            className="font-pixel text-xs text-white/60"
          >
            {count}
          </span>
        )}
        {rightSlot}
      </div>
      {subtitle && (
        <p className="mt-2 text-xs text-white/60">{subtitle}</p>
      )}
    </header>
  );
}

// ─── Spacing scale — actual gaps between two blocks, t-shirt-named ────────
function SpacingSection({
  spacingSystem,
}: {
  spacingSystem?: ExtractResponse["tokens"]["spacingSystem"];
}) {
  if (!spacingSystem || !spacingSystem.scale || spacingSystem.scale.length === 0) {
    return null;
  }
  const base = spacingSystem.baseUnit;

  // Map a px step to a t-shirt size relative to the base unit. Familiar
  // vocabulary (xs/sm/md/lg/xl) communicates intent better than "2×".
  function tShirt(step: number): string {
    const ratio = step / base;
    if (ratio <= 0.25) return "2xs";
    if (ratio <= 0.5) return "xs";
    if (ratio < 1) return "sm";
    if (ratio === 1) return "base";
    if (ratio <= 1.5) return "md";
    if (ratio <= 2) return "lg";
    if (ratio <= 4) return "xl";
    return "2xl";
  }

  return (
    <section>
      <PanelHeader
        label="spacing"
        count={spacingSystem.scale.length}
        subtitle={`Each row shows the actual gap you'd get between two elements. Base unit ${base}px.`}
      />
      <ul
        role="list"
        className="grid grid-cols-1 gap-px overflow-hidden border border-white/10 bg-white/10 sm:grid-cols-2"
      >
        {spacingSystem.scale.map((step) => (
          <li
            key={step}
            className="flex items-center gap-5 bg-black px-5 py-5"
          >
            <div
              aria-hidden="true"
              className="flex h-10 shrink-0 items-center"
            >
              <span className="size-6 bg-white/20" />
              <span
                className="h-px bg-primary"
                style={{
                  width: `${Math.min(step, 120)}px`,
                }}
              />
              <span className="size-6 bg-white/20" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-pixel text-lg tracking-tight text-white">
                {step}
                <span className="ml-1 font-pixel text-[10px] uppercase tracking-widest text-white/55">
                  px
                </span>
              </p>
              <p className="mt-1 font-pixel text-[10px] uppercase tracking-widest text-primary">
                {tShirt(step)}
              </p>
            </div>
          </li>
        ))}
      </ul>
      {spacingSystem.sectionSpacing && spacingSystem.sectionSpacing.length > 0 && (
        <p className="mt-4 text-xs text-white/60">
          Section gaps:{" "}
          <code className="font-mono text-white/80">
            {spacingSystem.sectionSpacing.map((n) => `${n}px`).join(" · ")}
          </code>
        </p>
      )}
    </section>
  );
}

// ─── Border radius scale — actual rounded swatches per value ──────────────
function RadiusSection({
  radiusTokens,
}: {
  radiusTokens?: ExtractResponse["tokens"]["radiusTokens"];
}) {
  if (!radiusTokens || radiusTokens.length === 0) return null;

  // Map a numeric radius (px) to a t-shirt label. Pills/full-rounds map to
  // "pill" explicitly. Otherwise we bucket by px to match a familiar scale.
  function radiusLabel(value: string): string {
    const num = parseFloat(value);
    if (value.includes("9999") || value.includes("50%") || num >= 500) return "pill";
    if (num === 0) return "none";
    if (num <= 4) return "sm";
    if (num <= 8) return "md";
    if (num <= 16) return "lg";
    if (num <= 24) return "xl";
    return "2xl";
  }

  return (
    <section>
      <PanelHeader
        label="border radius"
        count={radiusTokens.length}
        subtitle="Each swatch is the actual corner rounding used on the site."
      />
      <ul
        role="list"
        className="grid grid-cols-2 gap-px overflow-hidden border border-white/10 bg-white/10 sm:grid-cols-3 md:grid-cols-4"
      >
        {radiusTokens.slice(0, 12).map((r) => (
          <li
            key={r.value}
            className="flex flex-col items-center gap-4 bg-black px-5 py-6"
          >
            <div
              aria-hidden="true"
              className="size-16 shrink-0 border border-white/25 bg-white/8"
              style={{ borderRadius: r.value }}
            />
            <div className="text-center">
              <p className="font-pixel text-base tracking-tight text-white">
                {r.value}
              </p>
              <p className="mt-1 font-pixel text-[10px] uppercase tracking-widest text-primary">
                {radiusLabel(r.value)}
              </p>
              <p className="mt-2 font-pixel text-[10px] uppercase tracking-widest text-white/55">
                {r.frequency}× used
              </p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

// ─── Shadow tokens — real shadow-rendered cards ───────────────────────────
function ShadowsSection({
  shadowTokens,
}: {
  shadowTokens?: ExtractResponse["tokens"]["shadowTokens"];
}) {
  if (!shadowTokens || shadowTokens.length === 0) return null;
  return (
    <section>
      <PanelHeader
        label="shadows + elevation"
        count={shadowTokens.length}
        subtitle="Each card has the extracted box-shadow applied so you see the real elevation, not a description of it."
      />
      <ul
        role="list"
        className="grid grid-cols-1 gap-px overflow-hidden border border-white/10 bg-white/10 sm:grid-cols-2 lg:grid-cols-3"
      >
        {shadowTokens.slice(0, 9).map((s) => (
          <li key={s.value} className="flex flex-col gap-4 bg-black p-5">
            <div className="grid place-items-center rounded-sm bg-white px-4 py-7">
              <span
                aria-hidden="true"
                className="block h-14 w-full max-w-32 rounded-sm bg-white"
                style={{ boxShadow: s.value }}
              />
            </div>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 font-pixel text-[10px] uppercase tracking-widest text-white">
                  <span>{s.type ?? "shadow"}</span>
                  <span aria-hidden="true" className="text-white/35">
                    ·
                  </span>
                  <span className="text-primary">{s.frequency}× used</span>
                </p>
                <code className="mt-2 block break-all font-mono text-[11px] text-white/70">
                  {s.value}
                </code>
              </div>
              <CopyValue
                value={s.value}
                label={`${s.type ?? "shadow"} CSS`}
              />
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

// ─── Motion — duration scale + easing ─────────────────────────────────────
function MotionSection({
  motionSystem,
}: {
  motionSystem?: ExtractResponse["tokens"]["motionSystem"];
}) {
  if (!motionSystem) return null;
  const durations = motionSystem.durationScale ?? [];
  const easings = motionSystem.timingFunctions ?? [];
  if (durations.length === 0 && easings.length === 0 && !motionSystem.primaryTimingFunction) {
    return null;
  }
  return (
    <section>
      <PanelHeader
        label="motion"
        count={durations.length + easings.length}
        subtitle={`Reduced-motion: ${motionSystem.prefersReducedMotion ? "supported" : "not detected"}`}
      />
      <div className="grid grid-cols-1 gap-px overflow-hidden border border-white/10 bg-white/10 lg:grid-cols-2">
        <div className="bg-black p-5">
          <p className="mb-3 font-pixel text-[10px] uppercase tracking-widest text-white/70">
            duration scale
          </p>
          {durations.length === 0 ? (
            <p className="text-xs text-white/50">No duration tokens extracted.</p>
          ) : (
            <ul role="list" className="space-y-2">
              {durations.slice(0, 8).map((d) => (
                <li
                  key={d.label + d.value}
                  className="grid grid-cols-[5rem_1fr_auto] items-center gap-3 text-xs"
                >
                  <span className="font-pixel uppercase tracking-widest text-white/70">
                    {d.label}
                  </span>
                  <span className="font-mono text-white/85">{d.value}</span>
                  <span className="font-mono text-[10px] text-white/60">
                    {d.frequency}×
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="bg-black p-5">
          <p className="mb-3 font-pixel text-[10px] uppercase tracking-widest text-white/70">
            easing
          </p>
          {motionSystem.primaryTimingFunction && (
            <p className="mb-3 break-all font-mono text-xs text-white/85">
              <span className="font-pixel text-[10px] uppercase tracking-widest text-primary">
                primary:
              </span>{" "}
              {motionSystem.primaryTimingFunction}
            </p>
          )}
          {easings.length > 1 && (
            <ul role="list" className="space-y-2">
              {easings.slice(0, 6).map((t, i) => (
                <li
                  key={t.value + i}
                  className="grid grid-cols-[1fr_auto] items-center gap-3 text-xs"
                >
                  <span className="truncate font-mono text-white/70">
                    {t.value}
                  </span>
                  <span className="font-mono text-[10px] text-white/40">
                    {t.frequency}×
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}

// ─── Live component preview — actual rendered buttons / cards ──────────────
// The wedge: render real DOM elements using the extracted style dicts so
// users see the real component, not a screenshot. Hover applies the
// extracted hoverChanges via React state.
function LiveComponentsSection({
  components,
}: {
  components?: ExtractResponse["tokens"]["components"];
}) {
  if (!components || components.length === 0) return null;
  return (
    <section>
      <PanelHeader
        label="components (live)"
        count={components.reduce((n, g) => n + g.variants.length, 0)}
        subtitle="Real components rendered with the captured CSS. Hover to see hover-state changes. Layout-heavy components (cards, footer, hero, nav) may render incomplete — the engine only captures visual props, not internal structure."
      />
      <div className="space-y-6">
        {components.map((g) => (
          <div
            key={g.type}
            className="overflow-hidden border border-white/10"
          >
            <header className="flex items-center justify-between gap-3 border-b border-white/10 bg-white/3 px-4 py-2.5">
              <h3 className="font-pixel text-xs uppercase tracking-widest text-white">
                {g.type}
              </h3>
              <span
                aria-hidden="true"
                className="font-pixel text-[10px] uppercase tracking-widest text-white/60"
              >
                {g.variants.length}{" "}
                {g.variants.length === 1 ? "variant" : "variants"}
              </span>
            </header>
            <ul
              role="list"
              className="flex flex-wrap items-center gap-x-6 gap-y-4 bg-white/2 p-6"
            >
              {g.variants.slice(0, 6).map((v) => (
                <li
                  key={v.name}
                  className="flex flex-col items-start gap-1.5"
                >
                  <LiveVariant type={g.type} variant={v} />
                  <span className="font-pixel text-[9px] uppercase tracking-widest text-white/55">
                    {v.name}
                    {v.count > 1 && (
                      <span className="ml-1.5 text-primary">{v.count}×</span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}

// Style fields we copy onto the rendered element. Visual-only — we
// deliberately exclude layout / positioning fields (width/height/position/
// transform) so the preview can flow inside our grid.
const SAFE_STYLE_PROPS = [
  "backgroundColor",
  "color",
  "borderRadius",
  "border",
  "borderTopWidth",
  "borderRightWidth",
  "borderBottomWidth",
  "borderLeftWidth",
  "borderStyle",
  "borderColor",
  "borderTopColor",
  "borderRightColor",
  "borderBottomColor",
  "borderLeftColor",
  "padding",
  "paddingTop",
  "paddingRight",
  "paddingBottom",
  "paddingLeft",
  "fontSize",
  "fontWeight",
  "fontFamily",
  "lineHeight",
  "letterSpacing",
  "textTransform",
  "textDecoration",
  "boxShadow",
  "outline",
  "outlineColor",
  "outlineWidth",
  "outlineOffset",
  "opacity",
  "cursor",
  "transition",
] as const;

function styleFromDict(dict: Record<string, string>): React.CSSProperties {
  const out: Record<string, string> = {};
  for (const key of SAFE_STYLE_PROPS) {
    const v = dict[key];
    if (v && v !== "none" && v !== "normal" && v !== "auto") {
      out[key] = v;
    }
  }
  return out as React.CSSProperties;
}

function LiveVariant({
  type,
  variant,
}: {
  type: string;
  variant: NonNullable<ExtractResponse["tokens"]["components"]>[number]["variants"][number];
}) {
  const [hover, setHover] = useState(false);
  const baseStyle = styleFromDict(variant.style);
  const hoverOverride = hover && variant.hoverChanges ? styleFromDict(variant.hoverChanges) : {};
  const mergedStyle = { ...baseStyle, ...hoverOverride };

  const sample = variant.sampleTexts && variant.sampleTexts[0]
    ? variant.sampleTexts[0].slice(0, 24)
    : variant.name;

  // Pick a render shape based on the component type. Buttons / links get
  // semantic elements; cards just get a div. Falls back to a generic
  // bordered container for unknown types.
  const t = type.toLowerCase();
  const sharedProps = {
    style: mergedStyle,
    onMouseEnter: () => setHover(true),
    onMouseLeave: () => setHover(false),
    "aria-label": `${type} · ${variant.name}`,
  };

  if (t.includes("button")) {
    return (
      <button type="button" {...sharedProps}>
        {sample}
      </button>
    );
  }
  if (t.includes("link")) {
    return (
      <a href="#preview" onClick={(e) => e.preventDefault()} {...sharedProps}>
        {sample}
      </a>
    );
  }
  if (t.includes("card")) {
    return (
      <div className="min-w-48" {...sharedProps}>
        <p style={{ margin: 0 }}>{sample}</p>
      </div>
    );
  }
  return <div {...sharedProps}>{sample}</div>;
}

// ─── Accessibility — contrast pairs + focus + touch target ────────────────
function AccessibilitySection({
  a11yTokens,
}: {
  a11yTokens?: ExtractResponse["tokens"]["a11yTokens"];
}) {
  if (!a11yTokens) return null;
  const pairs = a11yTokens.contrastPairs ?? [];
  // Group failing pairs first so they're impossible to miss.
  const failing = pairs.filter((p) => !p.meetsAA);
  const passing = pairs.filter((p) => p.meetsAA);
  const orderedPairs = [...failing, ...passing].slice(0, 9);

  return (
    <section>
      <PanelHeader
        label="accessibility"
        count={pairs.length}
        subtitle="WCAG 2.2 AA: text must hit 4.5:1 contrast against its background (3:1 for large text). Anything failing is flagged below in red."
      />

      {failing.length > 0 && (
        <p
          role="alert"
          className="mb-4 border border-red-500/25 bg-red-500/5 px-4 py-3 text-sm text-red-300/90"
        >
          <span className="font-pixel text-[10px] uppercase tracking-widest text-red-300">
            {failing.length} {failing.length === 1 ? "pair" : "pairs"} fail AA ·
          </span>{" "}
          Low contrast makes text hard to read for users with low vision or in
          bright sunlight. Pick darker text or a lighter background.
        </p>
      )}

      {pairs.length === 0 ? (
        <p className="text-xs text-white/60">No contrast pairs extracted.</p>
      ) : (
        <ul
          role="list"
          className="grid grid-cols-1 gap-px overflow-hidden border border-white/10 bg-white/10 sm:grid-cols-2 lg:grid-cols-3"
        >
          {orderedPairs.map((p, i) => (
            <li
              key={`${p.foreground}-${p.background}-${i}`}
              className="flex flex-col gap-3 bg-black p-4"
            >
              <div
                aria-hidden="true"
                className="grid h-20 place-items-center border border-white/10 px-3 text-sm font-medium"
                style={{ background: p.background, color: p.foreground }}
              >
                The quick brown fox
              </div>
              <div className="flex items-center justify-between gap-2">
                <span
                  className={`font-pixel text-xs uppercase tracking-widest ${
                    p.meetsAA ? "text-emerald-300" : "text-red-300"
                  }`}
                >
                  {p.meetsAA ? "pass" : "fail"}
                </span>
                <span className="font-mono text-sm text-white">
                  {p.ratio.toFixed(2)}:1
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <span
                  className={`border px-1.5 py-0.5 font-pixel text-[9px] uppercase tracking-widest ${
                    p.meetsAA
                      ? "border-emerald-500/40 text-emerald-300"
                      : "border-red-500/40 text-red-300"
                  }`}
                >
                  AA {p.meetsAA ? "✓" : "✗"}
                </span>
                <span
                  className={`border px-1.5 py-0.5 font-pixel text-[9px] uppercase tracking-widest ${
                    p.meetsAAA
                      ? "border-emerald-500/40 text-emerald-300"
                      : "border-white/15 text-white/55"
                  }`}
                >
                  AAA {p.meetsAAA ? "✓" : "—"}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2 font-mono text-[10px] text-white/60">
                <span className="truncate">text {p.foreground}</span>
                <span className="truncate">bg {p.background}</span>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-6">
        <p className="mb-3 font-pixel text-[10px] uppercase tracking-widest text-white">
          site-wide checks
        </p>
        <ul
          role="list"
          className="grid grid-cols-2 gap-px overflow-hidden border border-white/10 bg-white/10 sm:grid-cols-4"
        >
          <A11yFact
            label="touch target"
            hint="Tap-area for buttons (WCAG 2.5.5 wants ≥ 24×24px)."
            value={
              a11yTokens.minTouchTarget
                ? `${a11yTokens.minTouchTarget.width}×${a11yTokens.minTouchTarget.height}px`
                : "—"
            }
            tone={
              a11yTokens.minTouchTarget &&
              a11yTokens.minTouchTarget.width >= 24 &&
              a11yTokens.minTouchTarget.height >= 24
                ? "good"
                : a11yTokens.minTouchTarget
                ? "bad"
                : "neutral"
            }
          />
          <A11yFact
            label="alt-text"
            hint="% of images that have a usable alt attribute."
            value={
              a11yTokens.altTextCoverage
                ? `${a11yTokens.altTextCoverage.percentage.toFixed(0)}%`
                : "—"
            }
            tone={
              a11yTokens.altTextCoverage
                ? a11yTokens.altTextCoverage.percentage >= 90
                  ? "good"
                  : a11yTokens.altTextCoverage.percentage >= 60
                  ? "warn"
                  : "bad"
                : "neutral"
            }
          />
          <A11yFact
            label="reduced motion"
            hint="Does the site respect prefers-reduced-motion?"
            value={
              a11yTokens.reducedMotionSupport === undefined
                ? "—"
                : a11yTokens.reducedMotionSupport
                ? "yes"
                : "no"
            }
            tone={
              a11yTokens.reducedMotionSupport === undefined
                ? "neutral"
                : a11yTokens.reducedMotionSupport
                ? "good"
                : "warn"
            }
          />
          <A11yFact
            label="skip link"
            hint="Hidden 'skip to content' link for keyboard users."
            value={
              a11yTokens.skipLinkDetected === undefined
                ? "—"
                : a11yTokens.skipLinkDetected
                ? "yes"
                : "no"
            }
            tone={
              a11yTokens.skipLinkDetected === undefined
                ? "neutral"
                : a11yTokens.skipLinkDetected
                ? "good"
                : "warn"
            }
          />
        </ul>
      </div>
    </section>
  );
}

function A11yFact({
  label,
  value,
  hint,
  tone = "neutral",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "good" | "bad" | "warn" | "neutral";
}) {
  const valueClass =
    tone === "good"
      ? "text-emerald-300"
      : tone === "bad"
      ? "text-red-300"
      : tone === "warn"
      ? "text-amber-300"
      : "text-white";
  return (
    <li className="bg-black px-4 py-4">
      <p className="font-pixel text-[10px] uppercase tracking-widest text-white">
        {label}
      </p>
      <p className={`mt-2 font-mono text-sm ${valueClass}`}>{value}</p>
      {hint && (
        <p className="mt-1.5 text-[10px] leading-relaxed text-white/55">
          {hint}
        </p>
      )}
    </li>
  );
}

// ─── Responsive — breakpoints visualised on a horizontal scale ────────────
function ResponsiveSection({
  breakpoints,
}: {
  breakpoints?: ExtractResponse["tokens"]["breakpoints"];
}) {
  if (!breakpoints || breakpoints.length === 0) return null;
  return (
    <CollapsibleSection
      label="responsive"
      count={breakpoints.length}
      subtitle="Each row is a media-query breakpoint with the number of CSS rules that scope under it."
      defaultOpen={false}
    >
      <ul role="list" className="divide-y divide-white/10 border border-white/15">
        {breakpoints.slice(0, 12).map((bp, i) => (
          <li
            key={`${bp.type}-${bp.value}-${i}`}
            className="grid grid-cols-[6rem_1fr_auto] items-center gap-4 px-5 py-3"
          >
            <span className="font-pixel text-[10px] uppercase tracking-widest text-white/70">
              {bp.type}
            </span>
            <span className="font-mono text-xs text-white/85">{bp.value}</span>
            <span className="font-mono text-[10px] text-white/60">
              {bp.ruleCount} rules
            </span>
          </li>
        ))}
      </ul>
    </CollapsibleSection>
  );
}

// ─── Iconography ──────────────────────────────────────────────────────────
function IconographySection({
  iconSystem,
}: {
  iconSystem?: ExtractResponse["tokens"]["iconSystem"];
}) {
  if (!iconSystem) return null;
  return (
    <CollapsibleSection
      label="iconography"
      subtitle={`${iconSystem.library ?? "custom / unknown"} · ${iconSystem.totalCount ?? 0} icons observed`}
      defaultOpen={false}
    >
      <div className="grid grid-cols-2 gap-px overflow-hidden border border-white/10 bg-white/10 sm:grid-cols-4">
        <A11yFact label="library" value={iconSystem.library ?? "custom"} />
        <A11yFact
          label="stroke width"
          value={
            iconSystem.strokeWidth !== null && iconSystem.strokeWidth !== undefined
              ? String(iconSystem.strokeWidth)
              : "—"
          }
        />
        <A11yFact label="color mode" value={iconSystem.colorMode ?? "—"} />
        <A11yFact
          label="labeled %"
          value={
            iconSystem.labeledPercentage !== undefined
              ? `${iconSystem.labeledPercentage.toFixed(0)}%`
              : "—"
          }
        />
      </div>
      {iconSystem.sizeScale && iconSystem.sizeScale.length > 0 && (
        <p className="mt-3 text-xs text-white/60">
          Sizes:{" "}
          <code className="font-mono text-white/80">
            {iconSystem.sizeScale.map((n) => `${n}px`).join(" · ")}
          </code>
        </p>
      )}
    </CollapsibleSection>
  );
}

// ─── Proof preview — pixel side-by-side stays iframed (only sensible way) ─
function ProofPreviewSection({ proofHtmlUrl }: { proofHtmlUrl: string }) {
  return (
    <section>
      <PanelHeader
        label="fidelity proof"
        subtitle="Pixel-level side-by-side between the live site and our extracted palette (ΔE<12)."
        rightSlot={
          <a
            href={proofHtmlUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="font-pixel text-[10px] uppercase tracking-widest text-white/70 underline-offset-2 hover:text-primary hover:underline"
          >
            open in new tab ↗
          </a>
        }
      />
      <div className="overflow-hidden border border-white/15 bg-white/3">
        <iframe
          src={proofHtmlUrl}
          title="Pixel-fidelity proof"
          className="h-205 w-full border-0 bg-white"
          sandbox="allow-scripts allow-same-origin"
        />
      </div>
    </section>
  );
}

function PromptPackSection({ promptPackUrl }: { promptPackUrl: string }) {
  // Copy-to-clipboard status. Brief visual feedback ("COPIED ✓") then revert
  // to idle. Network errors flag as "COPY FAILED" so the user knows to use
  // the download link as a fallback.
  const [status, setStatus] = useState<"idle" | "copying" | "copied" | "failed">(
    "idle",
  );

  async function handleCopy() {
    setStatus("copying");
    try {
      const res = await fetch(promptPackUrl);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      // navigator.clipboard requires a secure context (https or localhost).
      // Local dev is localhost so this always works in our use case; on
      // file:// or insecure http the API throws and we fall back to error.
      await navigator.clipboard.writeText(text);
      setStatus("copied");
      setTimeout(() => setStatus("idle"), 2000);
    } catch {
      setStatus("failed");
      setTimeout(() => setStatus("idle"), 3000);
    }
  }

  const buttonLabel =
    status === "copied"
      ? "COPIED ✓"
      : status === "failed"
      ? "COPY FAILED"
      : status === "copying"
      ? "COPYING…"
      : "COPY PROMPT";

  return (
    <section aria-labelledby="panel-build-ui">
      <div className="mb-4 flex items-center gap-3">
        <span aria-hidden="true" className="h-px flex-1 bg-white/10" />
        <h2
          id="panel-build-ui"
          className="font-pixel text-xs uppercase tracking-widest text-white"
        >
          build ui with this design
        </h2>
      </div>
      <div className="border border-white/15 p-6">
        <p className="font-pixel text-sm tracking-tight text-white">
          Paste this into any AI agent, then ask it to build.
        </p>
        <p className="mt-2 text-sm text-white/60">
          A short prompt with the extracted colors, typography, spacing,
          radius, and shadows. Drop it into Claude Code, Cursor, v0, Lovable,
          Replit Agent, Windsurf, ChatGPT, Codex, or Copilot and append a
          one-liner like &ldquo;build a pricing page with this design&rdquo;
          your agent ships UI grounded in the extracted brand, not generic
          AI defaults.
        </p>
        <div className="mt-6 flex flex-wrap items-center gap-4">
          <button
            type="button"
            onClick={handleCopy}
            disabled={status === "copying"}
            aria-live="polite"
            className="clip-btn shrink-0 disabled:opacity-40"
          >
            <span aria-hidden="true" className="clip-btn__shadow">
              {buttonLabel}
            </span>
            <span className="clip-btn__face">{buttonLabel}</span>
          </button>
          <a
            href={promptPackUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="font-pixel text-xs uppercase tracking-widest text-white/50 underline-offset-2 hover:text-primary hover:underline"
          >
            view in new tab ↗
          </a>
          <a
            href={promptPackUrl}
            download="universal.md"
            className="font-pixel text-xs uppercase tracking-widest text-white/50 underline-offset-2 hover:text-primary hover:underline"
          >
            download universal.md ↓
          </a>
        </div>
      </div>
    </section>
  );
}

function Downloads({
  artifacts,
  outputDir,
}: {
  artifacts: NonNullable<ExtractResponse["artifacts"]>;
  outputDir: string;
}) {
  const items: Array<{ label: string; url: string }> = [
    { label: "tokens.json", url: artifacts.tokensJsonUrl },
  ];
  if (artifacts.previewHtmlUrl) {
    items.push({ label: "preview.html", url: artifacts.previewHtmlUrl });
  }
  if (artifacts.proofHtmlUrl) {
    items.push({ label: "proof.html", url: artifacts.proofHtmlUrl });
  }
  if (artifacts.reportHtmlUrl) {
    items.push({ label: "report.html", url: artifacts.reportHtmlUrl });
  }
  if (artifacts.promptPackUrl) {
    items.push({ label: "prompts/universal.md", url: artifacts.promptPackUrl });
  }
  if (artifacts.designMdUrl) {
    items.push({ label: "DESIGN.md", url: artifacts.designMdUrl });
  }

  return (
    <section aria-labelledby="panel-downloads">
      <div className="mb-4 flex items-center gap-3">
        <span aria-hidden="true" className="h-px flex-1 bg-white/10" />
        <h2
          id="panel-downloads"
          className="font-pixel text-xs uppercase tracking-widest text-white"
        >
          downloads
          <span className="sr-only"> ({items.length} files)</span>
        </h2>
        <span
          aria-hidden="true"
          className="font-pixel text-xs text-white/60"
        >
          {items.length}
        </span>
      </div>
      {/* Render each artifact as the project's canonical BubbleButton CTA —
          same style as the navbar / hero / gallery buttons — so the
          Downloads block reads as primary actions instead of table cells.
          Flex-wrap lets long filenames flow naturally onto a second row. */}
      <ul role="list" className="flex flex-wrap gap-3">
        {items.map((it) => (
          <li key={it.label}>
            <BubbleButton
              href={it.url}
              icon="↓"
              download
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Download ${it.label}`}
            >
              {it.label}
            </BubbleButton>
          </li>
        ))}
      </ul>
      <p className="mt-4 text-xs text-white/60">
        on disk at{" "}
        <code className="font-mono text-white/80">{outputDir}/</code>
      </p>
    </section>
  );
}

// Diagnostics panel — accordion-style review aid positioned at the bottom
// of the result panel. Each row shows just the headline + severity by
// default; expanding reveals the technical message + recommended action.
// This is intentionally quieter than the previous "loud alert under stats"
// placement: diagnostics are a "things to verify" list, not a problem
// report. Rule IDs (e.g. `low-proof-samples`) are dropped from the visible
// UI — they remain on the Diagnostic object for testing.
function DiagnosticsPanel({ diagnostics }: { diagnostics: Diagnostic[] }) {
  const errors = diagnostics.filter((d) => d.severity === "error");
  const warnings = diagnostics.filter((d) => d.severity === "warning");
  const infos = diagnostics.filter((d) => d.severity === "info");

  // Quiet panel chrome — the row contents do the differentiation.
  return (
    <section
      aria-labelledby="panel-diagnostics"
      className="overflow-hidden border border-white/15"
    >
      <header className="flex items-center justify-between border-b border-white/10 bg-white/3 px-4 py-2.5">
        <h2
          id="panel-diagnostics"
          className="font-pixel text-xs uppercase tracking-widest text-white"
        >
          things to verify
        </h2>
        <span
          aria-hidden="true"
          className="font-pixel text-[10px] uppercase tracking-widest text-white/60"
        >
          {errors.length > 0 && <>{errors.length} {errors.length === 1 ? "error" : "errors"} · </>}
          {warnings.length > 0 && <>{warnings.length} {warnings.length === 1 ? "warning" : "warnings"} · </>}
          {infos.length > 0 && <>{infos.length} info</>}
        </span>
      </header>
      <ul role="list" className="divide-y divide-white/10">
        {diagnostics.map((d) => (
          <DiagnosticRow key={d.id} diagnostic={d} />
        ))}
      </ul>
    </section>
  );
}

// Per-severity color palette for the dot + the severity pill. Kept quiet
// so warnings/info don't visually shout at users.
const SEVERITY_STYLE = {
  error:   { dot: "bg-red-400",    pill: "text-red-300/80    border-red-500/25",   pillLabel: "error" },
  warning: { dot: "bg-amber-400",  pill: "text-amber-300/80  border-amber-500/25", pillLabel: "warn"  },
  info:    { dot: "bg-white/40",   pill: "text-white/55      border-white/15",     pillLabel: "info"  },
} as const;

// Accordion row using native <details>/<summary> — no React state needed.
// Collapsed default shows just dot + title + severity pill + chevron.
// Expanded reveals the engine's technical message, optional next-action,
// and any supporting detail bullets.
function DiagnosticRow({ diagnostic }: { diagnostic: Diagnostic }) {
  const style = SEVERITY_STYLE[diagnostic.severity];
  return (
    <li>
      <details className="group">
        <summary className="flex cursor-pointer list-none items-center gap-3 px-5 py-3 transition-colors hover:bg-white/2">
          <span
            aria-hidden="true"
            className={`size-2 shrink-0 rounded-full ${style.dot}`}
          />
          <span className="min-w-0 flex-1 text-sm text-white/85">
            {diagnostic.title}
          </span>
          <span
            className={`shrink-0 border px-2 py-0.5 font-pixel text-[9px] uppercase tracking-widest ${style.pill}`}
          >
            {style.pillLabel}
          </span>
          <ArrowIcon
            aria-hidden="true"
            focusable="false"
            className="size-3 shrink-0 rotate-90 text-white/30 transition-transform group-open:-rotate-90"
          />
        </summary>
        <div className="space-y-2 px-5 pb-4 pl-10 text-xs leading-relaxed text-white/55">
          <p>{diagnostic.message}</p>
          {diagnostic.action && (
            <p className="text-white/70">
              <span className="font-pixel text-[10px] uppercase tracking-widest text-primary">
                what to do:
              </span>{" "}
              {diagnostic.action}
            </p>
          )}
          {diagnostic.details && diagnostic.details.length > 0 && (
            <ul role="list" className="space-y-0.5 font-mono text-[11px] text-white/60">
              {diagnostic.details.map((d, i) => (
                <li key={i}>· {d}</li>
              ))}
            </ul>
          )}
        </div>
      </details>
    </li>
  );
}

function Stats({
  items,
}: {
  items: Array<{ label: string; value: string }>;
}) {
  return (
    <ul
      role="list"
      className="grid grid-cols-2 gap-px overflow-hidden border border-white/10 bg-white/10 sm:grid-cols-4"
    >
      {items.map((s, i) => (
        <li
          key={s.label}
          className="group relative bg-black p-6 transition-colors hover:bg-white/2"
        >
          <span
            aria-hidden="true"
            className="absolute top-0 left-0 h-px w-10 bg-primary transition-all group-hover:w-full"
          />
          <p
            aria-hidden="true"
            className="mb-2 font-pixel text-[10px] uppercase tracking-widest text-white/60"
          >
            {String(i + 1).padStart(2, "0")}
          </p>
          <p className="font-pixel text-4xl leading-none tracking-tight text-white sm:text-5xl">
            {s.value}
          </p>
          <p className="mt-3 font-pixel text-[10px] uppercase tracking-widest text-white/55">
            {s.label}
          </p>
        </li>
      ))}
    </ul>
  );
}

// Collapsible variant of SectionHeader / PanelHeader. Same visual chrome —
// numbered prefix, hairline rule, white H2 label, count — but wraps the
// section in a native <details> so it folds down to just the header bar.
// Used for non-headline sections (long-tail colors, responsive breakpoints,
// iconography) that are review-aid material, not the primary result.
function CollapsibleSection({
  index,
  label,
  count,
  subtitle,
  defaultOpen = false,
  children,
}: {
  index?: number;
  label: string;
  count?: number;
  subtitle?: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const headingId = `collapsible-${label.replace(/\s+/g, "-").replace(/[^a-z0-9-]/gi, "")}`;
  return (
    <section aria-labelledby={headingId}>
      <details open={defaultOpen} className="group">
        <summary className="-mx-2 cursor-pointer list-none px-2 py-1 transition-colors hover:bg-white/2">
          <div className="flex items-center gap-3">
            {index !== undefined && (
              <span
                aria-hidden="true"
                className="font-pixel text-xs uppercase tracking-widest text-primary"
              >
                {String(index).padStart(2, "0")}
              </span>
            )}
            <span aria-hidden="true" className="h-px flex-1 bg-white/10" />
            <h2
              id={headingId}
              className="font-pixel text-xs uppercase tracking-widest text-white"
            >
              {label}
              {count !== undefined && (
                <span className="sr-only"> ({count} items)</span>
              )}
            </h2>
            {count !== undefined && (
              <span
                aria-hidden="true"
                className="font-pixel text-xs text-white/60"
              >
                {count}
              </span>
            )}
            <ArrowIcon
              aria-hidden="true"
              focusable="false"
              className="size-3 shrink-0 rotate-90 text-white/55 transition-transform group-open:-rotate-90"
            />
          </div>
          {subtitle && (
            <p className="mt-2 text-xs text-white/60">{subtitle}</p>
          )}
        </summary>
        <div className="mt-4">{children}</div>
      </details>
    </section>
  );
}

// Renders one typography row with a live preview of the role name in the
// extracted style — same font-family, size, weight as captured. Browsers
// fall back gracefully when the font isn't installed locally; the metadata
// row below still announces the exact tokens.
function TypographyRow({
  index,
  t,
}: {
  index: number;
  t: NonNullable<ExtractResponse["tokens"]["typographyLevels"]>[number];
}) {
  const previewLabel = t.roleLabel
    ? t.roleLabel.charAt(0).toUpperCase() + t.roleLabel.slice(1)
    : "Aa Bb Cc";
  // Cap visual size so a 96px display headline doesn't make one row
  // dominate the section. Token-truth stays in the metadata line.
  const previewStyle = {
    fontFamily: t.fontFamily,
    fontSize: `min(${t.fontSize}, 3rem)`,
    fontWeight: t.fontWeight,
    lineHeight: 1.1,
  } as const;
  return (
    <li className="flex items-center gap-5 px-5 py-5">
      <span
        aria-hidden="true"
        className="w-6 shrink-0 font-pixel text-[10px] uppercase tracking-widest text-primary"
      >
        {String(index).padStart(2, "0")}
      </span>
      <div className="min-w-0 flex-1">
        <p
          aria-hidden="true"
          style={previewStyle}
          className="truncate text-white"
        >
          {previewLabel}
        </p>
        <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="font-pixel text-[10px] uppercase tracking-widest text-white">
            {t.roleLabel ?? "—"}
          </span>
          <span aria-hidden="true" className="font-mono text-xs text-white/35">
            ·
          </span>
          <span className="font-mono text-xs text-white/80">{t.fontSize}</span>
          <span aria-hidden="true" className="font-mono text-xs text-white/35">
            ·
          </span>
          <span className="font-mono text-xs text-white/80">
            w{t.fontWeight}
          </span>
          <span aria-hidden="true" className="font-mono text-xs text-white/35">
            ·
          </span>
          <span className="truncate font-mono text-xs text-white/60">
            {t.fontFamily}
          </span>
        </p>
      </div>
      <span
        aria-hidden="true"
        className="shrink-0 font-pixel text-[10px] uppercase tracking-widest text-primary"
      >
        {t.frequency}×
      </span>
    </li>
  );
}

function SectionHeader({
  index,
  label,
  count,
  children,
}: {
  index: number;
  label: string;
  count: number;
  children: ReactNode;
}) {
  const headingId = `section-${label.replace(/\s+/g, "-")}`;
  return (
    <section aria-labelledby={headingId}>
      <div className="mb-4 flex items-center gap-3">
        <span
          aria-hidden="true"
          className="font-pixel text-xs uppercase tracking-widest text-primary"
        >
          {String(index).padStart(2, "0")}
        </span>
        <span aria-hidden="true" className="h-px flex-1 bg-white/10" />
        <h2
          id={headingId}
          className="font-pixel text-xs uppercase tracking-widest text-white"
        >
          {label}
          <span className="sr-only"> ({count} items)</span>
        </h2>
        <span
          aria-hidden="true"
          className="font-pixel text-xs text-white/60"
        >
          {count}
        </span>
      </div>
      {children}
    </section>
  );
}

function ColorCell({
  hex,
  label,
  frequency,
  layer,
}: {
  hex: string;
  label: string;
  frequency: number;
  layer?: string;
}) {
  return (
    <div className="group relative flex flex-col bg-black transition-colors hover:bg-white/2">
      <div
        className="relative aspect-4/3 w-full overflow-hidden"
        style={{ background: hex }}
      >
        <div
          aria-hidden="true"
          className="absolute inset-0 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06),inset_0_-1px_24px_rgba(0,0,0,0.18)]"
        />
      </div>

      <div className="flex flex-col gap-2 border-t border-white/10 p-4">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate font-pixel text-sm tracking-wide text-white">
            {label}
          </p>
          <span className="shrink-0 font-pixel text-[10px] uppercase tracking-widest text-primary">
            <span aria-hidden="true">{frequency}×</span>
            <span className="sr-only">used {frequency} times</span>
          </span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <code className="truncate font-mono text-[11px] text-white/70">
            {hex}
          </code>
          {layer && (
            <span
              aria-hidden="true"
              className="shrink-0 font-mono text-[10px] uppercase tracking-widest text-white/55"
            >
              {layer}
            </span>
          )}
        </div>
        <CopyValue value={hex} label={`color ${label} hex`} />
      </div>
    </div>
  );
}

function Panel({
  label,
  tone,
  className = "",
  role,
  ariaLive,
  children,
}: {
  label: string;
  tone: "info" | "error";
  className?: string;
  role?: "status" | "alert";
  ariaLive?: "polite" | "assertive";
  children: ReactNode;
}) {
  const accent = tone === "error" ? "text-red-400" : "text-primary";
  return (
    <section
      role={role}
      aria-live={ariaLive}
      className={`overflow-hidden border ${
        tone === "error" ? "border-red-500/30" : "border-white/15"
      } ${className}`}
    >
      <header className="flex items-center justify-between border-b border-white/10 bg-white/3 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span
            aria-hidden="true"
            className="size-3 rounded-full bg-[#ff5f57]"
          />
          <span
            aria-hidden="true"
            className="size-3 rounded-full bg-[#febc2e]"
          />
          <span
            aria-hidden="true"
            className="size-3 rounded-full bg-[#28c840]"
          />
          <span className="ml-3 font-mono text-xs text-white/80">extract.log</span>
        </div>
        <span
          aria-hidden="true"
          className={`font-pixel text-xs uppercase tracking-widest ${accent}`}
        >
          {label}
        </span>
      </header>
      <div className="px-5 py-5">{children}</div>
    </section>
  );
}

