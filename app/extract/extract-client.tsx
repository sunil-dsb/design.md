"use client";

import { useRouter, useSearchParams } from "next/navigation";
import {
  createElement,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
  type ReactNode,
} from "react";
import { ArrowIcon } from "@/icons/arrow";
import { BubbleButton } from "@/components/bubble-button";
import { LongTailColors } from "@/components/long-tail-colors";
import { StabilityChip, StabilityLegend } from "@/components/stability-chip";
import type { Diagnostic } from "@/lib/engine/diagnostics";
import { rolePriority, type ColorRole } from "@/lib/engine/role-namer";
import type { ComponentNode } from "@/lib/engine/types";
import { resolveUserInput } from "@/lib/url-resolver";

//  Stage-tracking types
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

type StageKey =
  | "extract"
  | "weighting"
  | "buttons"
  | "ramps"
  | "tailwind"
  | "shadcn"
  | "preview"
  | "proof"
  | "report"
  | "prompts"
  | "designmd";

const STAGE_ORDER: StageKey[] = [
  "extract",
  "weighting",
  "buttons",
  "ramps",
  "tailwind",
  "shadcn",
  "preview",
  "proof",
  "report",
  "prompts",
  "designmd",
];

const INITIAL_STAGES: Record<StageKey, StageState> = {
  extract: { status: "pending", label: "extracting tokens" },
  weighting: { status: "pending", label: "applying visibility weighting" },
  buttons: { status: "pending", label: "clustering button variants" },
  ramps: { status: "pending", label: "regenerating brand + neutral ramps" },
  tailwind: { status: "pending", label: "emitting tailwind v4 @theme" },
  shadcn: { status: "pending", label: "emitting shadcn 17-slot theme" },
  preview: { status: "pending", label: "generating preview" },
  proof: { status: "pending", label: "running pixel-fidelity proof" },
  report: { status: "pending", label: "generating report" },
  prompts: { status: "pending", label: "preparing prompt pack" },
  designmd: { status: "pending", label: "writing deterministic DESIGN.md" },
};

// Server emits stage kinds like "extract:start" / "preview:done" /
// "proof:error". Strip the suffix to get the StageKey.
function parseStageKind(
  kind: string,
): { key: StageKey; phase: "start" | "done" | "error" } | null {
  const [base, phase] = kind.split(":");
  if (!STAGE_ORDER.includes(base as StageKey)) return null;
  if (phase !== "start" && phase !== "done" && phase !== "error") return null;
  return { key: base as StageKey, phase };
}

//  SSE reader
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
            // Comment line  heartbeat or note. Skip.
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
      stability?: { layer: string; confidence: number; signals?: string[] };
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
      stability?: { layer: string; confidence: number; signals?: string[] };
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
      stability?: { layer: string; confidence: number; signals?: string[] };
    }>;
    shadowTokens?: Array<{
      value: string;
      frequency: number;
      type?: string;
      typicalElements?: string[];
      stability?: { layer: string; confidence: number; signals?: string[] };
    }>;
    motionSystem?: {
      durationScale?: Array<{
        label: string;
        value: string;
        frequency: number;
      }>;
      primaryTimingFunction?: string;
      timingFunctions?: Array<{ value: string; frequency: number }>;
      keyframeAnimations?: Array<{
        name: string;
        type: string;
        duration: string;
        properties?: string[];
      }>;
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
      altTextCoverage?: {
        withAlt: number;
        withoutAlt: number;
        total: number;
        percentage: number;
      };
      tabOrder?: {
        tabbableCount: number;
        hasPositiveTabindex: boolean;
        positiveTabindexCount: number;
      };
      skipLinkDetected?: boolean;
      reducedMotionSupport?: boolean;
    };
    breakpoints?: Array<{
      query?: string;
      type: string;
      value: string;
      ruleCount: number;
    }>;
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
        // Captured DOM tree for composed types (Card / PricingTier).
        // Rendered as a copyable HTML+CSS code snippet, never as live DOM.
        tree?: ComponentNode;
        // Relative path to a Playwright screenshot of the representative
        // element. Combined with `/api/output/<slug>` at render time.
        screenshotUrl?: string;
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
    regeneratedRampUrl: string | null;
    tailwindCssUrl: string | null;
    shadcnThemeUrl: string | null; // shadcn-theme.css when gates passed
    shadcnOmitReasonUrl: string | null; // shadcn-omit-reason.md when gates failed
    previewHtmlUrl: string | null;
    proofHtmlUrl: string | null;
    reportHtmlUrl: string | null;
    promptPackUrl: string | null;
    designMdUrl: string | null;
  };
  // proof.ts ΔE<12 pixel coverage, 0..1. Null when proof step skipped/failed.
  proofCoverage?: number | null;
  phase3?: {
    ramps: boolean;
    tailwind: boolean;
    shadcnCss: boolean;
    shadcnOmit: boolean;
    preview: boolean;
    proof: boolean;
    report: boolean;
    prompts: boolean;
    designmd: boolean;
  };
  warnings?: string[];
  /**
   * Engine diagnostics from lib/engine/diagnostics.ts. Surfaces things the
   * engine flagged as suspicious or low-confidence (low pixel coverage,
   * single-page noise, primary-is-grey, framework miscall, etc.). Always
   * an array  empty means clean extraction.
   */
  diagnostics?: Diagnostic[];
}

export function ExtractClient() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [url, setUrl] = useState(searchParams.get("url") ?? "");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ExtractResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [stages, setStages] = useState<Record<StageKey, StageState>>(() =>
    structuredClone(INITIAL_STAGES),
  );
  // Diagnostics streamed via SSE during the extraction (per plan-v1.md §4
  // "separate SSE events"). Shown in the loading panel so the user sees
  // engine concerns as they're detected; once `result` lands, ResultState
  // renders the canonical merged list from result.diagnostics instead.
  const [streamedDiagnostics, setStreamedDiagnostics] = useState<Diagnostic[]>(
    [],
  );
  // Allow aborting an in-flight stream if the user resubmits or navigates.
  const abortRef = useRef<AbortController | null>(null);
  // Ensures the on-mount auto-extraction only fires once per mount, even
  // if React strict-mode runs the effect twice in dev.
  const autoFiredRef = useRef(false);
  // Tracks whether we've already fired the "extraction complete" chime +
  // notification for the current result. Without this, every re-render
  // while `result` is set would refire the chime — annoying.
  const notifiedRef = useRef(false);

  // Browser notification + audible chime when an extraction completes.
  // Fires once per result. Notification only appears if the user granted
  // permission (we ask on submit). The chime is unconditional — works
  // without permission, just a brief A5 → E6 tone via Web Audio.
  useEffect(() => {
    if (!result || notifiedRef.current) return;
    notifiedRef.current = true;

    // Show the system notification (when permission was granted).
    if (
      typeof Notification !== "undefined" &&
      Notification.permission === "granted"
    ) {
      try {
        const host = result.url
          .replace(/^https?:\/\//, "")
          .replace(/^www\./, "")
          .replace(/\/.*$/, "");
        new Notification("design.md extraction complete", {
          body: `Your DESIGN.md for ${host} is ready.`,
          icon: "/favicon_io/favicon-32x32.png",
          tag: "design-md-extraction",
        });
      } catch {
        // Notification constructor throws in some sandboxed contexts
        // (iframes with no allow-popups, file://). Falls through to
        // the chime — which is the more universally-supported half of
        // this duo.
      }
    }

    // Brief two-note chime via Web Audio. Generated in-browser so no
    // audio asset needs shipping. Skipped silently when the audio
    // context is blocked by autoplay policy (rare — user invoked the
    // extract by clicking Submit, which counts as a user gesture).
    try {
      const Ctx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (!Ctx) return;
      const ctx = new Ctx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain).connect(ctx.destination);
      osc.type = "sine";
      // A5 (880Hz) ramping up to E6 (1318Hz) over 150ms — a friendly
      // ascending chirp. Gain peaks at 0.15 and decays out by 0.5s.
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1318.5, ctx.currentTime + 0.15);
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
      osc.start();
      osc.stop(ctx.currentTime + 0.5);
      // Release the AudioContext once the sound has finished playing.
      // Without this, every chime leaks a context — modern browsers GC
      // eventually but explicit close is the right pattern. 100ms buffer
      // past the stop time ensures the final sample renders.
      osc.onended = () => {
        ctx.close().catch(() => undefined);
      };
    } catch {
      // Autoplay-blocked browsers throw; not fatal.
    }
  }, [result]);

  // Core extraction logic, parameterised on the target URL. Both the form
  // submit handler and the auto-fire effect call this. Lets the auto-fire
  // path use the URL pulled directly from searchParams without depending
  // on the input state having been hydrated by React first.
  async function runExtraction(targetUrl: string) {
    // Reset the once-per-result notification gate so the new extraction's
    // completion fires its own chime + browser notification.
    notifiedRef.current = false;
    // Ask for notification permission here (not in handleSubmit) so BOTH
    // entry points get it — manual submits AND the auto-fire effect that
    // runs on mount when `?url=` is in the URL. Browsers only prompt once
    // per origin lifetime; repeat calls are no-ops after a decision.
    if (
      typeof Notification !== "undefined" &&
      Notification.permission === "default"
    ) {
      Notification.requestPermission().catch(() => undefined);
    }
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
    setStreamedDiagnostics([]);

    try {
      // Forward the page's `?key=` query param to the API route so the
      // owner can bypass their own rate limit by visiting the SPA with
      // ?key=<RATE_LIMIT_BYPASS_KEY>. Anyone without the secret still
      // hits the 5/IP/24h cap server-side.
      const ownerKey = new URLSearchParams(window.location.search).get("key");
      const apiUrl = ownerKey
        ? `/api/extract?key=${encodeURIComponent(ownerKey)}`
        : "/api/extract";

      const res = await fetch(apiUrl, {
        // maxPages intentionally omitted  the API route's default is 8,
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

      // Track terminal events locally  React state updates inside the
      // onEvent callback are async, so we can't read `result`/`error`
      // state immediately after readSse returns. These locals give us a
      // reliable signal to detect a dropped connection mid-stream.
      let resultReceived = false;
      let errorReceived = false;

      await readSse(res.body, (event, data) => {
        if (event === "stage" && data && typeof data === "object") {
          const ev = data as {
            kind?: string;
            label?: string;
            durationMs?: number;
            detail?: { message?: string };
          };
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
        } else if (
          event === "diagnostic" &&
          data &&
          typeof data === "object"
        ) {
          // Streamed by the API route at two checkpoints (early after
          // weighting, late after Phase 3). Dedup by id so a misbehaving
          // server resending the same diagnostic doesn't double-render.
          const d = data as Diagnostic;
          if (typeof d.id === "string" && d.id.length > 0) {
            setStreamedDiagnostics((prev) =>
              prev.some((p) => p.id === d.id) ? prev : [...prev, d],
            );
          }
        } else if (event === "result" && data && typeof data === "object") {
          resultReceived = true;
          setResult(data as ExtractResponse);
        } else if (event === "error" && data && typeof data === "object") {
          errorReceived = true;
          const ev = data as { message?: string };
          setError(ev.message ?? "Unknown server error.");
        }
        // 'done' is just a stream sentinel  no UI action needed.
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
      // AbortError happens on intentional cancel  don't surface as an error.
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

  // Thin form wrapper. Two branches, both via the shared resolver:
  //   gallery   user typed a curated brand (or its host). Skip the
  //              extraction entirely and route to the curated page.
  //   extract   real URL to crawl. Hand the normalised string to
  //              runExtraction so the SSE pipeline sees a clean value.
  // Invalid input keeps the user where they are with no submit  the
  // resolver returns 'invalid' for empty/malformed strings, which is
  // also what the original `if (!trimmed) return` in runExtraction did.
  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const resolved = resolveUserInput(url);
    if (resolved.kind === "invalid") return;
    if (resolved.kind === "gallery") {
      router.push(resolved.href);
      return;
    }
    await runExtraction(resolved.normalizedUrl);
  }

  //  Auto-fire on mount when ?url= is present in the URL
  // The homepage hero submits its form as `GET /extract?url=...`, so users
  // arrive here with a URL already chosen. Pre-filling the input is good
  // but not enough  the visual signal of having clicked GENERATE on the
  // homepage implies the work should already be in flight. We start it
  // automatically the moment this client component hydrates.
  //
  // `autoFiredRef` is a useRef (survives re-renders, not affected by
  // strict-mode double-invocation) so the request only fires once per
  // genuine mount. The user can re-extract by editing the URL and
  // re-submitting  the ref doesn't block that path.
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
            loading ? "Extracting DESIGN.md" : "Extract DESIGN.md from this URL"
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
        <LoadingState
          stages={stages}
          streamedDiagnostics={streamedDiagnostics}
        />
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

// Per-stage descriptions used as the active body copy in LoadingState. Each
// reads as plain English so users understand what's happening without
// engineering jargon. Falls back to a generic starting message before
// the first stage report arrives.
const STAGE_DESCRIPTIONS: Record<StageKey, string> = {
  extract:
    "Spinning up a headless browser, loading your site, and reading every painted style from the live DOM  colors, fonts, spacing, the lot.",
  weighting:
    "Promoting the tokens that appear on visible, above-the-fold elements above background noise so the brand-defining colors actually rank first.",
  buttons:
    "Re-clustering every button by visual signature (background, text, border, radius) in OKLCH color space, then naming each variant by matching it to the brand color roles — Primary, Accent, Outline, Ghost, Destructive — and picking the most visible example as the canonical one.",
  ramps:
    "Anchoring on the brand-primary, holding the hue, walking a 12-stop OKLCH lightness curve  and tapering chroma at the extremes so each step is in-gamut.",
  tailwind:
    "Packing the regenerated ramps + your type, spacing, radius, and shadow scales into a paste-ready Tailwind v4 @theme block.",
  shadcn:
    "Mapping the brand + neutral ramps onto shadcn's 17 slots, WCAG-AA verifying every foreground pairing. Skipped with a written reason when the source uses neither Tailwind nor shadcn.",
  preview:
    "Rendering a real HTML preview from the extracted tokens so you can see your design system come back to life on the right side of the screen.",
  proof:
    "Pixel-level side-by-side: the live site versus our extracted palette. Anywhere we miss a color by more than ΔE 12, it gets flagged.",
  report:
    "Building the human-readable report.html that explains every token decision  the value picked, the alternatives, and why.",
  prompts:
    "Packing the universal prompt  your tokens.json embedded with the full v2 spec  so any AI agent can take it from here.",
  designmd:
    "Final pass: writing the deterministic DESIGN.md with all canonical sections. This is the file you drop in your repo.",
};

// Rotating reassurance copy under the extraction header. Reinforces "yes
// this takes a moment, but it's worth waiting" so users don't drop off
// during the ~4-7 minute extraction window. Each entry leans on a
// different angle (accuracy, completeness, real DOM) so the message
// stays interesting even on the slowest sites.
const REASSURANCE_MESSAGES = [
  "Great things take time, we're reading every painted style from your site.",
  "Pixel-perfect accuracy means a full DOM walk + real interaction capture. Worth the wait.",
  "Real tokens, not guesses. Every value below comes from your actual rendered CSS.",
  "Analyzing colors, fonts, spacing, shadows, and motion. Hold tight, almost there.",
] as const;

function LoadingState({
  stages,
  streamedDiagnostics,
}: {
  stages: Record<StageKey, StageState>;
  streamedDiagnostics: Diagnostic[];
}) {
  // Current stage drives the headline + body copy. Falls back to a generic
  // "starting" state before any stage report arrives.
  const runningKey = STAGE_ORDER.find((k) => stages[k].status === "running");
  const headerLabel = runningKey ? stages[runningKey].label : "starting up";
  const description = runningKey
    ? STAGE_DESCRIPTIONS[runningKey]
    : "Warming up the engine. The browser is about to load your site and start reading.";

  const doneCount = STAGE_ORDER.filter(
    (k) => stages[k].status === "done",
  ).length;

  // Percentage complete based on stages done. Floored at 2% so an empty
  // start state still shows a visible green sliver — feels active even
  // before the first stage finishes.
  const pct = Math.max(2, Math.round((doneCount / STAGE_ORDER.length) * 100));

  // Rotate the reassurance message every ~6s so the copy doesn't feel
  // static on long-running extractions. Index cycles through the list
  // forever; the setInterval cleans up on unmount.
  const [reassureIdx, setReassureIdx] = useState(0);
  useEffect(() => {
    const id = setInterval(
      () => setReassureIdx((i) => (i + 1) % REASSURANCE_MESSAGES.length),
      6000,
    );
    return () => clearInterval(id);
  }, []);

  return (
    <section
      role="status"
      aria-live="polite"
      className="mt-10 overflow-hidden border border-white/15"
    >
      <header className="grid grid-cols-[1fr_auto] items-start gap-6 border-b border-white/15 bg-white/3 px-6 py-5">
        <div className="min-w-0">
          <p className="font-pixel text-[10px] uppercase tracking-widest text-white/70">
            extracting · step {Math.max(1, doneCount + 1)} of{" "}
            {STAGE_ORDER.length}
          </p>
          <h2 className="mt-2 font-pixel text-base uppercase tracking-tight text-white sm:text-lg">
            {headerLabel}
          </h2>
        </div>
        <Countdown startSeconds={300} />
      </header>

      {/* Linear progress bar — green fill, width = doneCount / total. Sits
          flush against the header bottom border so it reads as a single
          progress strip rather than a separate band. The shimmer keeps it
          visually alive even while a single stage is running for a while.
          Visual styles (gradient + shimmer animation + reduced-motion
          opt-out) live on `.progress-shimmer-fill` in globals.css; only
          the dynamic `width` stays inline here. */}
      <div
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Extraction progress: ${pct}% complete`}
        className="relative h-1 w-full bg-white/[0.06]"
      >
        <div
          className="progress-shimmer-fill absolute inset-y-0 left-0 transition-[width] duration-500 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>

      <div className="px-6 py-5">
        <p className="text-sm leading-relaxed text-white/75">{description}</p>
        <p
          className="mt-3 text-xs leading-relaxed text-white/55"
          aria-live="polite"
        >
          {REASSURANCE_MESSAGES[reassureIdx]}
        </p>

        <ul
          role="list"
          className="mt-6 divide-y divide-white/10 border border-white/10"
        >
          {STAGE_ORDER.map((key, i) => (
            <StageRow key={key} index={i + 1} state={stages[key]} />
          ))}
        </ul>

        {streamedDiagnostics.length > 0 && (
          <StreamingDiagnostics diagnostics={streamedDiagnostics} />
        )}
      </div>
    </section>
  );
}

// In-flight diagnostics rendered below the stage list. Compact one-row-per
// diagnostic strip: severity dot + title. Full details (message, action,
// signals) land in the post-result `DiagnosticsPanel`; here we just signal
// "these were flagged as the engine ran" so the user has early context.
function StreamingDiagnostics({
  diagnostics,
}: {
  diagnostics: Diagnostic[];
}) {
  const SEVERITY_TONE: Record<Diagnostic["severity"], string> = {
    error: "text-red-300",
    warning: "text-amber-300",
    info: "text-sky-300",
  };
  return (
    <section
      aria-label="Engine diagnostics streaming in"
      className="mt-6 border border-white/10"
    >
      <header className="border-b border-white/10 bg-white/3 px-4 py-2 font-pixel text-[10px] uppercase tracking-widest text-white/55">
        diagnostics · {diagnostics.length}
      </header>
      <ul role="list" className="divide-y divide-white/5">
        {diagnostics.map((d) => (
          <li
            key={d.id}
            className="flex items-center gap-3 px-4 py-2.5 text-xs"
          >
            <span
              aria-hidden="true"
              className={`size-1.5 shrink-0 rounded-full bg-current ${SEVERITY_TONE[d.severity]}`}
            />
            <span className={`shrink-0 font-mono text-[10px] uppercase tracking-widest ${SEVERITY_TONE[d.severity]}`}>
              {d.severity}
            </span>
            <span className="min-w-0 flex-1 truncate text-white/80">
              {d.title}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

// 5-minute soft countdown shown in the loading header. After the timer hits
// zero we display "any moment" instead of going negative  most extractions
// finish in 90–240 s, so 5 min is a generous ceiling. State is local and
// resets on unmount, so re-submitting an extraction restarts the clock.
function Countdown({ startSeconds }: { startSeconds: number }) {
  const [remaining, setRemaining] = useState(startSeconds);

  useEffect(() => {
    if (remaining <= 0) return;
    const id = setInterval(() => {
      setRemaining((s) => Math.max(0, s - 1));
    }, 1000);
    return () => clearInterval(id);
  }, [remaining]);

  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;
  const formatted = `${minutes}:${seconds.toString().padStart(2, "0")}`;
  const live = remaining > 0;

  return (
    <div className="text-right">
      <p className="font-pixel text-[10px] uppercase tracking-widest text-white/60">
        est. remaining
      </p>
      <p
        className={`mt-1 font-pixel text-3xl tracking-tight tabular-nums ${
          live ? "text-white" : "text-primary"
        }`}
        aria-live="off"
      >
        {live ? formatted : "any moment"}
      </p>
    </div>
  );
}

function StageRow({ index, state }: { index: number; state: StageState }) {
  const indicator = (() => {
    switch (state.status) {
      case "done":
        // Bright emerald green tick  completion deserves a different colour
        // from "in progress" (primary blue) so users instantly read the
        // status without reading the label.
        return (
          <span
            aria-hidden="true"
            className="grid size-5 place-items-center bg-emerald-400 text-[11px] font-pixel text-white"
          >
            ✓
          </span>
        );
      case "running":
        return (
          <span
            aria-hidden="true"
            className="relative grid size-5 place-items-center"
          >
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
            className="grid size-5 place-items-center border border-white/20 text-[10px] font-pixel text-white/40"
          />
        );
    }
  })();

  const accent =
    state.status === "done"
      ? "text-emerald-300"
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

      <span aria-hidden="true" className="font-mono text-[11px] text-white/60">
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

//  Result-section nav
// Grouped table-of-contents for the long extract result. Order inside each
// group matches render order so the nav reads top-to-bottom. Headline tokens
// (Colors → Typography → Components) sit at the top of the first group so
// they're the first thing the user sees.
type NavItem = { id: string; label: string };
type NavGroup = { label: string; items: NavItem[] };

const NAV_GROUPS: NavGroup[] = [
  {
    label: "tokens",
    items: [
      { id: "section-named-colors", label: "Colors" },
      { id: "section-typography", label: "Typography" },
      // Buttons surface ahead of Spacing — they're the highest-signal
      // interactive element a user wants to grab from an extraction.
      { id: "panel-buttons", label: "Buttons" },
      { id: "panel-spacing", label: "Spacing" },
      { id: "panel-border-radius", label: "Radius" },
      { id: "panel-shadows-elevation", label: "Shadows" },
      // Cards live between Shadows and Motion — cards lean on elevation
      // tokens above and motion tokens below (hover lift / transition).
      { id: "panel-cards", label: "Cards" },
      { id: "panel-motion", label: "Motion" },
      // "Other" leaf components (badges / links / inputs) round out the
      // tokens group at the end.
      { id: "panel-components", label: "Components" },
    ],
  },
  {
    label: "audit",
    items: [
      { id: "panel-accessibility", label: "Accessibility" },
      { id: "panel-fidelity-proof", label: "Fidelity proof" },
    ],
  },
  {
    label: "ship",
    items: [{ id: "panel-downloads", label: "Downloads" }],
  },
  {
    label: "review",
    items: [
      { id: "section-long-tail-colors", label: "Long-tail colors" },
      { id: "panel-responsive", label: "Responsive" },
      { id: "panel-iconography", label: "Iconography" },
      { id: "panel-diagnostics", label: "Things to verify" },
    ],
  },
];

// IntersectionObserver-driven active-section tracker. Triggers when a target
// crosses the band 20–80% down the viewport  the "user is reading here" zone.
// Picks the lowest-on-page id that is currently intersecting so the active
// item moves DOWN the nav as you scroll, never jumps.
function useActiveSection(ids: string[]): string | null {
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const visible = new Set<string>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) visible.add(e.target.id);
          else visible.delete(e.target.id);
        }
        // Pick the first id (by document order) that's currently visible.
        const next = ids.find((id) => visible.has(id));
        if (next) setActiveId(next);
      },
      { rootMargin: "-20% 0px -70% 0px" },
    );
    const observed: Element[] = [];
    for (const id of ids) {
      const el = document.getElementById(id);
      if (el) {
        observer.observe(el);
        observed.push(el);
      }
    }
    return () => {
      for (const el of observed) observer.unobserve(el);
      observer.disconnect();
    };
  }, [ids]);

  return activeId;
}

function ResultNav() {
  const allIds = [
    "extract-overview",
    ...NAV_GROUPS.flatMap((g) => g.items.map((i) => i.id)),
  ];
  const activeId = useActiveSection(allIds);

  return (
    <nav aria-label="Result sections" className="flex flex-col gap-6 text-left">
      {/* Eyebrow + total count gives users a sense of scope */}
      <div className="flex items-baseline justify-between">
        <p className="font-pixel text-[10px] uppercase tracking-widest text-white">
          report
        </p>
        <p className="font-pixel text-[9px] uppercase tracking-widest text-white/45">
          {allIds.length} sections
        </p>
      </div>

      {/* Top-level: Overview link sits alone above the groups so it's
          always the first thing the eye lands on. */}
      <NavLink
        href="#extract-overview"
        label="Overview"
        isActive={activeId === "extract-overview"}
      />

      {NAV_GROUPS.map((group) => (
        <div key={group.label}>
          <p className="mb-2 font-pixel text-[9px] uppercase tracking-widest text-white/40">
            {group.label}
          </p>
          <ul role="list" className="flex flex-col">
            {group.items.map((item) => (
              <li key={item.id}>
                <NavLink
                  href={`#${item.id}`}
                  label={item.label}
                  isActive={activeId === item.id}
                />
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}

// Individual nav link with a status-dot prefix. Dot fills primary blue when
// the section is in view; soft white otherwise. Active item also gets a
// faint primary-tinted background pill so the active state is unmistakable
// at a glance.
function NavLink({
  href,
  label,
  isActive,
}: {
  href: string;
  label: string;
  isActive: boolean;
}) {
  return (
    <a
      href={href}
      aria-current={isActive ? "true" : undefined}
      className={`group flex items-center gap-2.5 px-2 py-1.5 font-pixel text-[10px] uppercase tracking-widest transition-colors ${
        isActive
          ? "bg-primary/10 text-white"
          : "text-white/60 hover:bg-white/3 hover:text-white"
      }`}
    >
      <span
        aria-hidden="true"
        className={`size-1.5 shrink-0 transition-all ${
          isActive ? "bg-primary" : "bg-white/25 group-hover:bg-white/55"
        }`}
      />
      <span className="truncate">{label}</span>
    </a>
  );
}

function ResultState({ result }: { result: ExtractResponse }) {
  const {
    tokens,
    durationMs,
    outputDir,
    artifacts,
    proofCoverage,
    diagnostics,
  } = result;
  const colors = tokens.colorTokens ?? [];
  // Show named colors in role-priority order  Primary first, then Accent,
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

  // Replace "framework" with "fidelity" when proof.ts ran successfully  it's
  // the wedge stat (regenerated ramps & visible accuracy, plan-v1.md §2). Falls
  // back to framework name when proof is unavailable so we never show a blank.
  const fidelityStat =
    typeof proofCoverage === "number"
      ? {
          label: "ΔE<12 fidelity",
          value: `${(proofCoverage * 100).toFixed(1)}%`,
        }
      : {
          label: "framework",
          value:
            tokens.meta?.framework?.uiFramework ??
            (tokens.meta?.framework?.tailwind?.detected ? "tailwind" : ""),
        };

  return (
    <div className="mt-12 space-y-16">
      <aside
        aria-label="Report navigation"
        className="hidden xl:fixed xl:top-32 xl:bottom-8 xl:left-6 xl:flex xl:w-48 xl:flex-col xl:pr-2"
      >
        {/* Scrollable nav list takes the available height; the CTA below
            stays pinned to the bottom of the aside. The whole aside is
            already vertically constrained (top-32 → bottom-8), so the
            flex-1 child + shrink-0 CTA divide that height. */}
        <div className="min-h-0 flex-1 overflow-y-auto">
          <ResultNav />
        </div>
        {artifacts?.designMdUrl && (
          /* Sticky primary CTA — DESIGN.md is the canonical output users
              came here for, so it earns the most-prominent slot in the
              sidebar. Green tone matches the Downloads-section "download
              all" button so the visual language for "download action"
              stays consistent. `download` attribute saves directly
              instead of opening the file in a new tab. */
          <div className="mt-4 shrink-0 border-t border-white/10 pt-4">
            <BubbleButton
              href={artifacts.designMdUrl}
              icon="↓"
              tone="green"
              download
              aria-label="Download DESIGN.md"
            >
              DESIGN.md
            </BubbleButton>
          </div>
        )}
      </aside>

      <section
        id="extract-overview"
        aria-label="Extraction overview"
        className="scroll-mt-24"
      >
        <Stats
          items={[
            { label: "duration", value: `${(durationMs / 1000).toFixed(1)}s` },
            { label: "colors", value: String(colors.length) },
            { label: "type levels", value: String(typography.length) },
            fidelityStat,
          ]}
        />
      </section>

      {/* Engine diagnostics moved BELOW (just before the full-tokens.json
          details)  they're "things to verify" notes, not the headline.
          Surfacing them under the stats made them feel like a problem with
          the result; they're more useful as a tucked-away review aid. */}

      {namedColors.length > 0 && (
        <SectionHeader
          index={1}
          label="named colors"
          count={namedColors.length}
          info={{
            summary:
              "The colors used most often on the page, grouped by what they do. The chip below each color tells you which layer of the design system it belongs to.",
            glossary: [
              {
                label: "primary",
                meaning: "The main brand color. Usually buttons, links, accents.",
              },
              {
                label: "canvas",
                meaning: "Page or large-surface background color.",
              },
              { label: "ink", meaning: "Default text color." },
              {
                label: "439×",
                meaning: "How many times this color appears across crawled pages.",
              },
              { label: "copy", meaning: "Click to copy the hex value." },
              {
                label: "▲ Core",
                meaning:
                  "Page background, body text, base font — almost never changes.",
              },
              {
                label: "■ System",
                meaning:
                  "Brand design system — primary, accent, hairline. Stable across the product.",
              },
              {
                label: "◆ Campaign",
                meaning:
                  "Launch-specific — promo gradients, one-off highlights. Will change.",
              },
              {
                label: "● Content",
                meaning:
                  "Inside imagery — not really part of the design system. Treat with caution.",
              },
            ],
          }}
        >
          {/* Discoverable legend for the stability chips that appear on
              every colour / typography / radius / shadow card below. Native
              <details> — collapsed by default, no client JS, keyboard-
              accessible. Placed at the top of the first chip-bearing
              section so users see "what do these labels mean?" before they
              encounter the chips themselves. */}
          <div className="mb-4">
            <StabilityLegend />
          </div>
          <div className="grid grid-cols-2 gap-px overflow-hidden border border-white/10 bg-white/10 sm:grid-cols-3 md:grid-cols-4">
            {namedColors.map((c, i) => (
              <ColorCell
                key={`${c.hex}-${i}`}
                hex={c.hex}
                label={c.roleLabel!}
                frequency={c.frequency}
                layer={c.stability?.layer}
                confidence={c.stability?.confidence}
                signals={c.stability?.signals}
              />
            ))}
          </div>
        </SectionHeader>
      )}

      {longTailColors.length > 0 && (
        <SectionHeader
          index={2}
          label="long-tail colors"
          count={longTailColors.length}
          info={{
            summary:
              "Less common colors found on the page — usually gradient stops, hover tints, or one-off decorative bits. Review for clustering accuracy.",
            glossary: [
              {
                label: "first row",
                meaning: "Always visible — the most-frequent long-tail colors.",
              },
              {
                label: "view N more",
                meaning: "Expand to see every long-tail color we captured.",
              },
              {
                label: "click swatch",
                meaning: "Copies the hex value to your clipboard.",
              },
            ],
          }}
        >
          {/* Shared <LongTailColors> from components/ — same component used on
              /gallery/<brand>. First row always shown, rest behind a
              "view N more" toggle, so a busy palette doesn't drown the page
              in fifty near-identical greys. */}
          <LongTailColors
            colors={longTailColors.slice(0, 32).map((c) => ({
              hex: c.hex,
              frequency: c.frequency,
            }))}
          />
        </SectionHeader>
      )}

      {typography.length > 0 && (
        <SectionHeader
          index={
            namedColors.length > 0 ? (longTailColors.length > 0 ? 3 : 2) : 1
          }
          label="typography"
          count={typography.length}
          info={{
            summary:
              "Every text style on the page, ordered from biggest to smallest.",
            glossary: [
              { label: "display", meaning: "Largest text — hero headlines." },
              {
                label: "h1 / h2 / h3",
                meaning: "Section headings, from largest to smallest.",
              },
              { label: "body", meaning: "Default paragraph text." },
              { label: "16px", meaning: "Font size in pixels." },
              { label: "700", meaning: "Weight: 400 = normal, 700 = bold." },
              { label: "copy", meaning: "Click to copy the font family." },
            ],
          }}
        >
          <TypographyList typography={typography.slice(0, 16)} />
        </SectionHeader>
      )}

      {/* Native render of the report data (was previously an iframe-loaded
          report.html). Each section uses the SPA's design language so the
          result reads as one coherent page instead of an embedded foreign
          document. The standalone report.html is still produced on disk
          and available via the Downloads bar below. */}
      {/* Section ordering rationale: Buttons surface first (after Colors +
          Typography) because they're the highest-signal interactive
          element users want to see immediately. Cards then sit between
          Shadows and Motion — natural pairing with the elevation /
          surface tokens above them, and Motion belongs near Cards
          because motion is most visible on hover/lift interactions.
          "Other components" (badges / links / inputs) goes at the end
          since they're smaller leaf elements. */}
      <LiveComponentsSection
        components={tokens.components}
        baseUrl={deriveOutputBaseUrl(artifacts)}
        mode="buttons"
      />
      <SpacingSection spacingSystem={tokens.spacingSystem} />
      <RadiusSection radiusTokens={tokens.radiusTokens} />
      <ShadowsSection shadowTokens={tokens.shadowTokens} />
      <LiveComponentsSection
        components={tokens.components}
        baseUrl={deriveOutputBaseUrl(artifacts)}
        mode="cards"
      />
      <MotionSection motionSystem={tokens.motionSystem} />
      <LiveComponentsSection
        components={tokens.components}
        baseUrl={deriveOutputBaseUrl(artifacts)}
        mode="other"
      />
      <AccessibilitySection a11yTokens={tokens.a11yTokens} />
      <ResponsiveSection breakpoints={tokens.breakpoints} />
      <IconographySection iconSystem={tokens.iconSystem} />

      {/* The fidelity-proof side-by-side is still iframe-loaded because its
          value IS the pixel-rendered side-by-side comparison  there's no
          better native equivalent. Keeping it inline below the rendered
          tokens so users can verify what they're seeing. */}
      {artifacts?.proofHtmlUrl && (
        <ProofPreviewSection proofHtmlUrl={artifacts.proofHtmlUrl} />
      )}

      {artifacts && <Downloads artifacts={artifacts} outputDir={outputDir} />}

      {/* WarningsList replaced by DiagnosticsPanel up top  pipeline
          warnings are now folded into the diagnostics module as
          pipeline-warning-* entries (see lib/engine/diagnostics.ts §1). */}

      {/* Engine diagnostics  review aid positioned after the primary
          result content so they don't dominate the page. Accordion-style:
          each row collapsed by default, expand for the full reason. */}
      {diagnostics && diagnostics.length > 0 && (
        <DiagnosticsPanel diagnostics={diagnostics} />
      )}

      <details className="overflow-hidden border border-white/15">
        <summary className="flex cursor-pointer items-center justify-between bg-white/3 px-4 py-3 font-pixel text-xs uppercase tracking-widest text-white/70">
          full tokens.json
          <ArrowIcon
            className="size-4 rotate-90 text-white/50"
            aria-hidden="true"
            focusable="false"
          />
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

//  Small copy-to-clipboard chip used inline next to tokens
// Single-button UX: shows "copy" by default, flips to "copied ✓" for 1.5s
// after a successful write. Fails silently  the visible value is always
// readable so the user can copy by hand if clipboard API isn't available.
function CopyValue({ value, label }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // No-op  assistive UX fallback is the visible value itself.
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      aria-label={`Copy ${label ?? value} to clipboard`}
      className={`shrink-0 px-2 py-1 font-pixel text-[10px] uppercase tracking-widest transition-colors ${
        copied ? "text-primary" : "text-white/55 hover:text-white"
      }`}
    >
      {copied ? "copied ✓" : "copy"}
    </button>
  );
}

// Engine writes component screenshots to `output/<slug>/components/<file>.png`
// and emits `screenshotUrl` as the relative path (`components/<file>.png`).
// We need the `/api/output/<slug>` prefix to load them — derive that from
// `artifacts.tokensJsonUrl`, which always has the form `${base}/tokens.json`.
// Empty string when artifacts haven't materialised yet (the renderer treats
// that as "no screenshot available" and falls back to the code-only view).
function deriveOutputBaseUrl(
  artifacts?: ExtractResponse["artifacts"],
): string {
  if (!artifacts?.tokensJsonUrl) return "";
  return artifacts.tokensJsonUrl.replace(/\/tokens\.json$/, "");
}

//  Reusable section header for the new native sections
// Mirrors the existing SectionHeader pattern (pixel index + horizontal rule
// + label + count) but takes a `subtitle` slot for short human-readable
// blurbs, and lets the section body live as its children.
function PanelHeader({
  label,
  count,
  subtitle,
  rightSlot,
  info,
}: {
  label: string;
  count?: number | string;
  subtitle?: string;
  rightSlot?: ReactNode;
  // Same shape used by SectionHeader. When provided, renders a
  // "what's this?" toggle on the right and a help drawer below the
  // header line when expanded.
  info?: SectionInfo;
}) {
  // Build a URL-safe id from the label. The final `.replace(/-+/g, "-")`
  // collapses consecutive dashes that result from labels containing
  // special characters between words (e.g. "shadows + elevation" goes
  // space-plus-space → "-+-" → "--" after the `+` strip, which would
  // produce `panel-shadows--elevation` and break the nav-link match).
  const headingId = `panel-${label
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/gi, "")
    .replace(/-+/g, "-")}`;
  const [infoOpen, setInfoOpen] = useState(false);
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
          <span aria-hidden="true" className="font-pixel text-xs text-white/60">
            {count}
          </span>
        )}
        {info && (
          <SectionInfoToggle
            open={infoOpen}
            onToggle={() => setInfoOpen(!infoOpen)}
          />
        )}
        {rightSlot}
      </div>
      {subtitle && <p className="mt-2 text-xs text-white/60">{subtitle}</p>}
      {info && infoOpen && (
        <div className="mt-3">
          <SectionInfoPanel info={info} />
        </div>
      )}
    </header>
  );
}

//  Spacing scale  actual gaps between two blocks, t-shirt-named
function SpacingSection({
  spacingSystem,
}: {
  spacingSystem?: ExtractResponse["tokens"]["spacingSystem"];
}) {
  if (
    !spacingSystem ||
    !spacingSystem.scale ||
    spacingSystem.scale.length === 0
  ) {
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
        info={{
          summary:
            "How the site spaces things out. Every gap, padding, and margin is built from one 'base unit' value.",
          glossary: [
            {
              label: "base unit",
              meaning: "The pixel value every other spacing step is built from.",
            },
            {
              label: "xs / sm / md / lg / xl",
              meaning: "T-shirt names for relative size.",
            },
            {
              label: "8px row",
              meaning: "An actual spacing step found on the site.",
            },
          ],
        }}
      />
      <ul
        role="list"
        className="grid grid-cols-1 gap-px overflow-hidden border border-white/10 bg-white/10 sm:grid-cols-2"
      >
        {spacingSystem.scale.map((step) => (
          <li key={step} className="flex items-center gap-5 bg-black px-5 py-5">
            <div aria-hidden="true" className="flex h-10 shrink-0 items-center">
              <span className="size-6 bg-white/80" />
              {/* White bar instead of primary blue — at 1px height on a
                  black surface the primary-blue line was hard to spot.
                  White reads cleanly against black and matches the white
                  bookend blocks on either side, so the spacing reads as
                  one continuous element. */}
              <span
                className="h-px bg-white"
                style={{
                  width: `${Math.min(step, 120)}px`,
                }}
              />
              <span className="size-6 bg-white/80" />
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
      {spacingSystem.sectionSpacing &&
        spacingSystem.sectionSpacing.length > 0 && (
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

//  Border radius scale  actual rounded swatches per value
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
    if (value.includes("9999") || value.includes("50%") || num >= 500)
      return "pill";
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
        info={{
          summary:
            "Corner-rounding values found on buttons, cards, badges, and other elements.",
          glossary: [
            { label: "0px", meaning: "Sharp, square corners." },
            { label: "4–8px", meaning: "Subtle rounding — typical for buttons." },
            { label: "12–24px", meaning: "Card-style rounded corners." },
            { label: "pill", meaning: "Fully rounded (radius equals element height)." },
          ],
        }}
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
            <div className="flex flex-col items-center text-center">
              <p className="font-pixel text-base tracking-tight text-white">
                {r.value}
              </p>
              <p className="mt-1 font-pixel text-[10px] uppercase tracking-widest text-primary">
                {radiusLabel(r.value)}
              </p>
              <p className="mt-2 font-pixel text-[10px] uppercase tracking-widest text-white/55">
                {r.frequency}× used
              </p>
              {r.stability?.layer && (
                <div className="mt-2">
                  <StabilityChip
                    layer={r.stability.layer}
                    confidence={r.stability.confidence}
                    signals={r.stability.signals}
                  />
                </div>
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

//  Shadow tokens  real shadow-rendered cards
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
        info={{
          summary:
            "Every box-shadow used on the site. The type tells you what the shadow is for.",
          glossary: [
            { label: "elevation", meaning: "Lifts a card off the page." },
            {
              label: "border-shadow",
              meaning: "A thin outline replacement (no separate border).",
            },
            {
              label: "ring",
              meaning: "Focus indicator around inputs and buttons.",
            },
            { label: "inset", meaning: "Inner shadow — pressed-in look." },
            {
              label: "complex-stack",
              meaning: "Two or more shadows layered for depth.",
            },
            {
              label: "234× used",
              meaning: "How many elements share this shadow value.",
            },
          ],
        }}
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
                <p className="flex flex-wrap items-center gap-x-2 gap-y-1 font-pixel text-[10px] uppercase tracking-widest text-white">
                  <span>{s.type ?? "shadow"}</span>
                  <span aria-hidden="true" className="text-white/35">
                    ·
                  </span>
                  <span className="text-primary">{s.frequency}× used</span>
                  {s.stability?.layer && (
                    <>
                      <span aria-hidden="true" className="text-white/35">
                        ·
                      </span>
                      <StabilityChip
                        layer={s.stability.layer}
                        confidence={s.stability.confidence}
                        signals={s.stability.signals}
                      />
                    </>
                  )}
                </p>
                <code className="mt-2 block break-all font-mono text-[11px] text-white/70">
                  {s.value}
                </code>
              </div>
              <CopyValue value={s.value} label={`${s.type ?? "shadow"} CSS`} />
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

//  Motion  duration scale + easing
function MotionSection({
  motionSystem,
}: {
  motionSystem?: ExtractResponse["tokens"]["motionSystem"];
}) {
  if (!motionSystem) return null;
  const durations = motionSystem.durationScale ?? [];
  const easings = motionSystem.timingFunctions ?? [];
  if (
    durations.length === 0 &&
    easings.length === 0 &&
    !motionSystem.primaryTimingFunction
  ) {
    return null;
  }
  return (
    <section>
      <PanelHeader
        label="motion"
        count={durations.length + easings.length}
        subtitle={`Reduced-motion: ${
          motionSystem.prefersReducedMotion ? "supported" : "not detected"
        }. Hover any duration row to play the animation at the captured timing.`}
        info={{
          summary:
            "Animation timing values used on the site — how long things move, and the curve of the motion.",
          glossary: [
            {
              label: "duration",
              meaning: "How long the animation runs (in milliseconds).",
            },
            {
              label: "easing curve",
              meaning: "The shape of the motion — slow-start, slow-end, bouncy, etc.",
            },
            {
              label: "reduced-motion",
              meaning:
                "Whether the site honors the user's 'reduce motion' OS setting.",
            },
            {
              label: "hover the row",
              meaning: "Plays the animation at the captured timing.",
            },
          ],
        }}
      />

      {durations.length > 0 && (
        <div className="mb-6 overflow-hidden border border-white/15">
          <header className="flex items-center justify-between border-b border-white/10 bg-white/3 px-4 py-2.5">
            <h3 className="font-pixel text-xs uppercase tracking-widest text-white">
              duration scale
            </h3>
            <span
              aria-hidden="true"
              className="font-pixel text-[10px] uppercase tracking-widest text-white/60"
            >
              {durations.length} {durations.length === 1 ? "step" : "steps"}
            </span>
          </header>
          <ul role="list" className="divide-y divide-white/10">
            {durations.slice(0, 8).map((d) => (
              <DurationRow
                key={d.label + d.value}
                d={d}
                easing={motionSystem.primaryTimingFunction ?? "ease"}
              />
            ))}
          </ul>
        </div>
      )}

      {(motionSystem.primaryTimingFunction || easings.length > 0) && (
        <div className="overflow-hidden border border-white/15">
          <header className="flex items-center justify-between border-b border-white/10 bg-white/3 px-4 py-2.5">
            <h3 className="font-pixel text-xs uppercase tracking-widest text-white">
              easing curves
            </h3>
            {easings.length > 0 && (
              <span
                aria-hidden="true"
                className="font-pixel text-[10px] uppercase tracking-widest text-white/60"
              >
                {easings.length} {easings.length === 1 ? "curve" : "curves"}
              </span>
            )}
          </header>

          {motionSystem.primaryTimingFunction && (
            <div className="flex items-start gap-4 border-b border-white/10 px-4 py-4">
              <BezierCurve
                value={motionSystem.primaryTimingFunction}
                size={56}
                accent="primary"
              />
              <div className="min-w-0 flex-1">
                <p className="font-pixel text-[10px] uppercase tracking-widest text-primary">
                  primary
                </p>
                <code className="mt-1 block break-all font-mono text-xs text-white">
                  {motionSystem.primaryTimingFunction}
                </code>
              </div>
            </div>
          )}

          {easings.length > 1 && (
            <ul role="list" className="divide-y divide-white/10">
              {easings.slice(0, 6).map((t, i) => (
                <li
                  key={t.value + i}
                  className="flex items-center gap-4 px-4 py-3"
                >
                  <BezierCurve value={t.value} size={40} />
                  <code className="min-w-0 flex-1 truncate font-mono text-xs text-white/85">
                    {t.value}
                  </code>
                  <span
                    aria-hidden="true"
                    className="shrink-0 font-mono text-[10px] text-white/60"
                  >
                    {t.frequency}×
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}

// One row in the duration table. Hovering the row plays a small bar
// animation across the track at the row's captured duration + easing  gives
// users an actual feel for what "200ms ease-in-out" looks like, not just a
// number on a screen.
function DurationRow({
  d,
  easing,
}: {
  d: { label: string; value: string; frequency: number };
  easing: string;
}) {
  const [playing, setPlaying] = useState(false);
  return (
    <li
      onMouseEnter={() => setPlaying(true)}
      onMouseLeave={() => setPlaying(false)}
      onFocus={() => setPlaying(true)}
      onBlur={() => setPlaying(false)}
      tabIndex={0}
      className="grid cursor-default grid-cols-[5rem_1fr_auto] items-center gap-4 px-4 py-3 transition-colors hover:bg-white/2 focus-visible:outline-2 focus-visible:outline-primary"
    >
      <span className="font-pixel text-[10px] uppercase tracking-widest text-white">
        {d.label}
      </span>
      <div
        aria-hidden="true"
        className="relative h-1.5 overflow-hidden bg-white/10"
      >
        <span
          className="absolute top-0 left-0 h-full w-3 bg-primary"
          style={{
            transition: playing
              ? `transform ${d.value} ${easing}`
              : "transform 0.2s linear",
            transform: playing ? "translateX(2400%)" : "translateX(0)",
          }}
        />
      </div>
      <div className="flex items-center gap-3">
        <code className="font-mono text-xs text-white">{d.value}</code>
        <span
          aria-hidden="true"
          className="font-mono text-[10px] text-white/60"
        >
          {d.frequency}×
        </span>
      </div>
    </li>
  );
}

// Visualises a cubic-bezier(x1,y1,x2,y2) or named easing as an SVG curve.
// Falls back to a straight (linear) line when the value isn't parseable.
function BezierCurve({
  value,
  size = 48,
  accent = "white",
}: {
  value: string;
  size?: number;
  accent?: "white" | "primary";
}) {
  const [x1, y1, x2, y2] = parseEasing(value);
  const stroke = accent === "primary" ? "#0039ff" : "#ffffff";
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      aria-hidden="true"
      className="shrink-0 border border-white/15 bg-white/3"
    >
      {/* Diagonal reference (linear easing) */}
      <line
        x1="0"
        y1="100"
        x2="100"
        y2="0"
        stroke="rgba(255,255,255,0.12)"
        strokeWidth="1"
      />
      {/* Captured easing curve. Y is inverted because SVG origin is top-left
          but easing graphs are conventionally bottom-up. */}
      <path
        d={`M 0 100 C ${x1 * 100} ${(1 - y1) * 100}, ${x2 * 100} ${
          (1 - y2) * 100
        }, 100 0`}
        fill="none"
        stroke={stroke}
        strokeWidth="2"
      />
    </svg>
  );
}

function parseEasing(value: string): [number, number, number, number] {
  // Named CSS easings → their canonical cubic-bezier equivalents.
  const NAMED: Record<string, [number, number, number, number]> = {
    linear: [0, 0, 1, 1],
    ease: [0.25, 0.1, 0.25, 1],
    "ease-in": [0.42, 0, 1, 1],
    "ease-out": [0, 0, 0.58, 1],
    "ease-in-out": [0.42, 0, 0.58, 1],
  };
  const trimmed = value.trim().toLowerCase();
  if (NAMED[trimmed]) return NAMED[trimmed];
  const match = trimmed.match(
    /cubic-bezier\s*\(\s*([-\d.]+)\s*,\s*([-\d.]+)\s*,\s*([-\d.]+)\s*,\s*([-\d.]+)\s*\)/,
  );
  if (match) {
    return [
      parseFloat(match[1]),
      parseFloat(match[2]),
      parseFloat(match[3]),
      parseFloat(match[4]),
    ];
  }
  return [0, 0, 1, 1]; // linear fallback
}

//  Live component preview  actual rendered buttons / cards
// The wedge: render real DOM elements using the extracted style dicts so
// users see the real component, not a screenshot. Hover applies the
// extracted hoverChanges via React state.
// Per-mode metadata for the three split rendering passes. `mode` decides
// which component types to surface plus the panel chrome (label, subtitle,
// info drawer). Splitting LiveComponentsSection this way lets us interleave
// Buttons / Cards / "other components" between Spacing / Shadows / Motion
// rather than dumping everything into one giant block far down the page.
//
// Typed explicitly (instead of `as const`) so each preset's `info` field
// matches the mutable `SectionInfo` shape PanelHeader expects.
type ComponentModePreset = {
  label: string;
  typeKeys: Set<string> | null;
  subtitle: string;
  info: SectionInfo;
};

const COMPONENT_MODE_PRESETS: Record<
  "buttons" | "cards" | "other",
  ComponentModePreset
> = {
  buttons: {
    label: "buttons",
    typeKeys: new Set(["button"]),
    subtitle:
      "Every button variant detected on the site, rendered with its captured CSS. Hover any variant to trigger its hover-state styles.",
    info: {
      summary:
        "Button variants the site uses, each rendered as a real <button> with its captured CSS so the look matches the source.",
      glossary: [
        {
          label: "primary / secondary / ghost / outline / destructive",
          meaning:
            "Variant name — auto-classified from the button's background + text contrast.",
        },
        {
          label: "12×",
          meaning: "How many times this variant appears across the site.",
        },
        {
          label: "hover",
          meaning:
            "Triggers hover-state styles where the engine captured them.",
        },
      ],
    },
  },
  cards: {
    label: "cards",
    typeKeys: new Set(["card", "pricingtier"]),
    subtitle:
      "Cards and pricing tiers from the site. Toggle between a pixel-perfect screenshot of the source element and the captured HTML+CSS structure.",
    info: {
      summary:
        "Composed components (Cards + Pricing Tiers). Source-tab shows a screenshot of the live element; Code-tab shows the captured HTML + CSS structure.",
      glossary: [
        {
          label: "source",
          meaning: "Pixel-perfect screenshot of the element as the site renders it.",
        },
        {
          label: "code",
          meaning: "Captured DOM tree with inline styles — paste-ready snippet.",
        },
        { label: "copy", meaning: "Copies the code snippet to your clipboard." },
        {
          label: "pricing tier",
          meaning:
            "Card-shaped element containing a price signal ($/mo, per month) + list + CTA — split out from generic cards.",
        },
      ],
    },
  },
  other: {
    label: "components",
    // Anything that isn't Button / Card / PricingTier / Footer / Navigation.
    // We don't enumerate explicitly because the engine can grow new types;
    // exclusion list is more future-proof.
    typeKeys: null,
    subtitle:
      "Smaller captured components — badges, links, inputs — rendered with their captured CSS.",
    info: {
      summary:
        "Smaller leaf components from the site (badges, links, inputs). Each rendered with the captured CSS — hover for hover-state styles where captured.",
      glossary: [
        {
          label: "badge / link / input",
          meaning: "Element type — captured outer styles applied to a real element.",
        },
        {
          label: "primary / outline / ghost",
          meaning: "Variant name auto-classified from background + text contrast.",
        },
        {
          label: "12×",
          meaning: "How many times this variant appears across the site.",
        },
      ],
    },
  },
};

// Excluded from every mode (full-page layout regions whose captured
// outer-chrome render isn't useful on its own). Engine still extracts
// them for downstream consumers; the UI just doesn't surface them.
const ALWAYS_SKIP_TYPES = new Set(["footer", "navigation"]);

function LiveComponentsSection({
  components,
  baseUrl,
  mode,
}: {
  components?: ExtractResponse["tokens"]["components"];
  baseUrl: string;
  // Which slice of the captured components this instance renders. The same
  // component is mounted three times in the result page (buttons /
  // cards / other) so each slice gets its own panel + sidebar entry.
  mode: keyof typeof COMPONENT_MODE_PRESETS;
}) {
  const preset = COMPONENT_MODE_PRESETS[mode];
  // Filter: drop always-skipped types, then keep only what this mode owns.
  // `other` mode has typeKeys=null and uses the inverse — anything NOT
  // claimed by buttons / cards. Non-null assertions are safe by
  // construction: buttons and cards always declare their typeKeys; only
  // `other` is null. The TypeScript type allows null because the union
  // needs it for the `other` preset.
  const claimedByOtherModes = new Set<string>([
    ...COMPONENT_MODE_PRESETS.buttons.typeKeys!,
    ...COMPONENT_MODE_PRESETS.cards.typeKeys!,
  ]);
  const filtered = (components ?? []).filter((g) => {
    const k = g.type.toLowerCase();
    if (ALWAYS_SKIP_TYPES.has(k)) return false;
    if (preset.typeKeys) return preset.typeKeys.has(k);
    // `other` mode: keep anything not already claimed by another preset.
    return !claimedByOtherModes.has(k);
  });
  if (filtered.length === 0) return null;
  return (
    <section>
      <PanelHeader
        label={preset.label}
        count={filtered.reduce((n, g) => n + g.variants.length, 0)}
        subtitle={preset.subtitle}
        info={preset.info}
      />
      <div className="space-y-10">
        {filtered.map((g) => {
          // Engine emits capitalized types (Button / Badge / Card / Hero /
          // Input / Navigation / Link / Footer / PricingTier). Wide layout
          // types get a 1-up grid so the sample has room to breathe;
          // chip-sized components tile in a 2/3-up grid.
          const typeKey = g.type.toLowerCase();
          const isComposed = typeKey === "card" || typeKey === "pricingtier";
          const isWide =
            isComposed ||
            typeKey === "hero" ||
            typeKey === "navigation" ||
            typeKey === "footer" ||
            typeKey === "input" ||
            typeKey === "textarea" ||
            typeKey === "form";
          const gridCols = isWide
            ? "grid-cols-1"
            : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3";
          // Humanize PricingTier → "Pricing Tier" in the section header.
          const displayType = g.type.replace(/([a-z])([A-Z])/g, "$1 $2");

          return (
            <div key={g.type}>
              <header className="mb-3 flex items-baseline justify-between gap-3">
                <h3 className="font-pixel text-xs uppercase tracking-widest text-white">
                  {displayType}
                </h3>
                <span
                  aria-hidden="true"
                  className="font-pixel text-[10px] uppercase tracking-widest text-white/55"
                >
                  {g.variants.length}{" "}
                  {g.variants.length === 1 ? "variant" : "variants"}
                </span>
              </header>

              <ul role="list" className={`grid gap-3 ${gridCols}`}>
                {g.variants.slice(0, 6).map((v, idx) =>
                  isComposed ? (
                    <ComposedVariantCard
                      // Index-suffixed key: the engine can emit two variants
                      // that share the same `name` (button-cluster sometimes
                      // produces "Ghost sm" twice after size-based splitting),
                      // and React would warn / behave unpredictably with a
                      // duplicate key. The index makes the key stable within
                      // the rendered slice.
                      key={`${v.name}-${idx}`}
                      variant={v}
                      baseUrl={baseUrl}
                    />
                  ) : (
                    <li
                      key={`${v.name}-${idx}`}
                      className="group relative flex flex-col border border-white/10 bg-white/[0.02] transition-colors hover:border-white/25"
                    >
                      {/* Inner preview surface is white so captured
                          components (which mostly assume a light page bg)
                          look natural. The outer card stays on the dark
                          translucent surface so the footer text (which
                          uses `text-white` for the variant name) stays
                          readable — earlier we accidentally made the
                          outer container white too, which collapsed the
                          footer to white-on-white invisibility. */}
                      <div className="flex min-h-32 flex-1 items-center justify-center bg-white p-8">
                        <LiveVariant type={g.type} variant={v} />
                      </div>
                      <footer className="flex items-center justify-between gap-2 border-t border-white/10 px-4 py-3">
                        <p className="truncate font-pixel text-[10px] uppercase tracking-widest text-white">
                          {v.name}
                        </p>
                        {v.count > 1 && (
                          <span
                            aria-hidden="true"
                            className="shrink-0 font-pixel text-[10px] uppercase tracking-widest text-white/55"
                          >
                            {v.count}×
                          </span>
                        )}
                      </footer>
                    </li>
                  ),
                )}
              </ul>
            </div>
          );
        })}
      </div>
    </section>
  );
}

// Variant card for composed types (Card / PricingTier). Tab toggle between
// the captured source screenshot (pixel-perfect) and the captured DOM tree
// rendered as a copyable HTML+CSS snippet. When the engine couldn't
// capture either (older fixtures, screenshot pass failure), the card
// degrades gracefully to whichever view is available, then to a "no
// preview" plaque so the variant still surfaces in the section.
function ComposedVariantCard({
  variant,
  baseUrl,
}: {
  variant: NonNullable<
    ExtractResponse["tokens"]["components"]
  >[number]["variants"][number];
  baseUrl: string;
}) {
  const hasScreenshot = !!variant.screenshotUrl && !!baseUrl;
  const hasTree = !!variant.tree;
  // Default tab order of preference: live > source > code.
  //   - Live is the primary view because it's actionable (real DOM the
  //     user can inspect via DevTools / fork into a .tsx file).
  //   - Source is the pixel-truth screenshot from the original site —
  //     fallback when no tree was captured.
  //   - Code is the paste-into-codebase text artifact — fallback when
  //     no screenshot exists either.
  const initialTab: "live" | "source" | "code" = hasTree
    ? "live"
    : hasScreenshot
      ? "source"
      : "code";
  const [tab, setTab] = useState<"live" | "source" | "code">(initialTab);
  // HTML is the default format because the captured tree is closer to
  // generic markup than to any specific framework. JSX is the toggle for
  // users dropping the snippet into a React / Next.js codebase.
  const [format, setFormat] = useState<"html" | "jsx">("html");
  const [copied, setCopied] = useState(false);

  const snippet = hasTree
    ? format === "jsx"
      ? stringifyComponentTreeJsx(variant.tree!)
      : stringifyComponentTree(variant.tree!)
    : "";

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(snippet);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard requires secure context — fall back to the visible snippet.
    }
  }

  const screenshotSrc = hasScreenshot
    ? `${baseUrl}/${variant.screenshotUrl}`
    : null;

  return (
    <li className="group relative flex flex-col border border-white/10 bg-white/[0.02] transition-colors hover:border-white/25">
      {/* Tab strip — only renders both tabs if both views are available. */}
      {(hasScreenshot || hasTree) && (
        <div
          role="tablist"
          aria-label={`${variant.name} preview mode`}
          className="flex items-stretch border-b border-white/10 bg-black/30"
        >
          {/* Tab order is fixed: live | source | code. Each button only
              renders if its underlying data is available — older fixtures
              missing a tree fall back to source-only, etc. */}
          {hasTree && (
            <button
              type="button"
              role="tab"
              aria-selected={tab === "live"}
              onClick={() => setTab("live")}
              className={`px-4 py-2 font-pixel text-[10px] uppercase tracking-widest transition-colors ${
                tab === "live"
                  ? "bg-white text-black"
                  : "text-white/55 hover:text-white"
              }`}
            >
              live
            </button>
          )}
          {hasScreenshot && (
            <button
              type="button"
              role="tab"
              aria-selected={tab === "source"}
              onClick={() => setTab("source")}
              className={`px-4 py-2 font-pixel text-[10px] uppercase tracking-widest transition-colors ${
                tab === "source"
                  ? "bg-white text-black"
                  : "text-white/55 hover:text-white"
              }`}
            >
              source
            </button>
          )}
          {hasTree && (
            <button
              type="button"
              role="tab"
              aria-selected={tab === "code"}
              onClick={() => setTab("code")}
              className={`px-4 py-2 font-pixel text-[10px] uppercase tracking-widest transition-colors ${
                tab === "code"
                  ? "bg-white text-black"
                  : "text-white/55 hover:text-white"
              }`}
            >
              code
            </button>
          )}
          <span className="flex-1" aria-hidden="true" />
          {tab === "code" && hasTree && (
            <>
              {/* Format toggle — visible only on the code tab. Resets `copied`
                  via re-render so the user gets fresh feedback when they
                  switch format and copy again. */}
              <button
                type="button"
                aria-pressed={format === "html"}
                onClick={() => setFormat("html")}
                className={`px-3 py-2 font-pixel text-[10px] uppercase tracking-widest transition-colors ${
                  format === "html"
                    ? "text-white"
                    : "text-white/45 hover:text-white"
                }`}
              >
                html
              </button>
              <button
                type="button"
                aria-pressed={format === "jsx"}
                onClick={() => setFormat("jsx")}
                className={`px-3 py-2 font-pixel text-[10px] uppercase tracking-widest transition-colors ${
                  format === "jsx"
                    ? "text-white"
                    : "text-white/45 hover:text-white"
                }`}
              >
                jsx
              </button>
              <button
                type="button"
                onClick={handleCopy}
                aria-label={copied ? "Snippet copied" : "Copy snippet"}
                className={`px-4 py-2 font-pixel text-[10px] uppercase tracking-widest transition-colors ${
                  copied ? "text-primary" : "text-white/55 hover:text-white"
                }`}
              >
                {copied ? "copied ✓" : "copy"}
              </button>
            </>
          )}
        </div>
      )}

      <div className="relative flex min-h-48 flex-1 flex-col">
        {tab === "live" && hasTree && (
          /* Live render — captured DOM tree rendered as actual React
             elements via the LiveTree component. White background +
             centered + scrollable matches the source-tab framing so the
             user can compare the two views without layout shift.
             max-h-[640px] caps the height; taller cards get a scroll
             affordance instead of pushing the page down. The inner
             `max-w-full` keeps captured elements that asked for their
             own width-fitting (rare; layout fields aren't captured) from
             escaping the card. */
          <div className="flex max-h-[640px] overflow-auto bg-white p-8">
            <div className="m-auto max-w-full">
              <LiveTree node={variant.tree!} />
            </div>
          </div>
        )}
        {tab === "source" && screenshotSrc && (
          /* Padded white frame around the screenshot so the captured
              element has breathing room — without this the image fills
              the card edge-to-edge and reads as a zoomed crop instead of
              a framed preview. Same `p-8` padding as the live-tree view
              above so both tabs feel like one stage when toggled. */
          <div className="flex max-h-[640px] items-start justify-center overflow-auto bg-white p-8">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={screenshotSrc}
              alt={`${variant.name} source render`}
              className="block h-auto max-w-full object-contain"
              loading="lazy"
            />
          </div>
        )}
        {tab === "code" && hasTree && (
          <pre className="overflow-x-auto bg-black px-4 py-4 font-mono text-[11px] leading-relaxed text-white/85">
            <code>{snippet}</code>
          </pre>
        )}
        {!hasScreenshot && !hasTree && (
          <div className="flex flex-1 items-center justify-center bg-white p-8">
            <p className="font-pixel text-[10px] uppercase tracking-widest text-white/45">
              no preview captured
            </p>
          </div>
        )}
      </div>

      <footer className="flex items-center justify-between gap-2 border-t border-white/10 px-4 py-3">
        <p className="truncate font-pixel text-[10px] uppercase tracking-widest text-white">
          {variant.name}
        </p>
        {variant.count > 1 && (
          <span
            aria-hidden="true"
            className="shrink-0 font-pixel text-[10px] uppercase tracking-widest text-white/55"
          >
            {variant.count}×
          </span>
        )}
      </footer>
    </li>
  );
}

// HTML void elements (self-closing). The stringifier emits `<img />` for
// these and `<div>...</div>` for everything else.
const TREE_VOID_TAGS = new Set([
  "br",
  "hr",
  "img",
  "input",
  "meta",
  "link",
  "source",
  "area",
  "embed",
  "track",
  "wbr",
  "col",
]);

// Subset of void tags safe to render as actual DOM in the "live" preview.
// iframe / object / embed / link / meta / source / track / area / col are
// excluded — they can load external resources or affect document structure
// in ways we don't want from captured arbitrary-site content. <img> and
// <input> are intentionally included because cards routinely contain them
// and we've already captured src/alt/type via the engine's allowlist.
const LIVE_VOID_TAGS = new Set(["br", "hr", "img", "input", "wbr"]);

// Tags we refuse to render in the live preview even if they slip past the
// engine's TREE_SKIP_TAGS filter. Defense-in-depth — the tree builder in
// cluster.ts already filters these at capture time.
const LIVE_UNSAFE_TAGS = new Set([
  "script",
  "style",
  "iframe",
  "object",
  "embed",
  "link",
  "meta",
  "base",
  "form",
]);

// Tags that require a specific parent to be valid HTML — substituted with
// <div> at depth 0 so they don't produce invalid nesting inside the
// ComposedVariantCard <li> wrapper (li-in-li, tr without tbody, etc.).
// React surfaces these as hydration warnings; browsers silently fix them
// in ways that break captured styles. Only swapped at the root because
// internal structure (captured by the engine as a complete subtree) is
// self-consistent.
const LIVE_ROOT_NEEDS_PARENT = new Set([
  "li",
  "tr",
  "td",
  "th",
  "thead",
  "tbody",
  "tfoot",
  "caption",
  "colgroup",
  "dt",
  "dd",
  "option",
  "optgroup",
  "legend",
  "summary",
]);

/**
 * Recursive React component that renders a captured ComponentNode tree as
 * actual DOM. Used by the "live" tab on Card / PricingTier variants — the
 * engine captures `variant.tree` for COMPOSED_TYPES only (see
 * lib/engine/cluster.ts COMPOSED_TYPES), so this is unreachable for
 * Button / Badge / etc. which render via LiveVariant from their captured
 * style dict.
 *
 * Safety posture (layered):
 *   1. Tag is regex-validated (lowercase + hyphen + digit only). Anything
 *      else collapses to <div>.
 *   2. Tags in LIVE_UNSAFE_TAGS are dropped entirely.
 *   3. `on*` attributes are stripped (already filtered by the tree builder,
 *      but redundant guard).
 *   4. `javascript:` URLs in href / src are dropped.
 *   5. Style is applied via React's `style` prop — React rejects unsafe
 *      values like `expression(...)` automatically, and the engine's
 *      TREE_STYLE_FIELDS allowlist excludes `backgroundImage`, so there's
 *      no `url(javascript:...)` vector either.
 *   6. Depth capped at 16 — engine emits at most MAX_TREE_DEPTH=8, so
 *      this is generous headroom in case the cap is ever loosened.
 *
 * Fidelity limits (these are the same caveats the user sees in the
 * "code" tab — documented in lib/engine/cluster.ts:63-98 TREE_STYLE_FIELDS):
 *   - Layout fields (width/height/position/transform) intentionally NOT
 *     captured, so card sizing flows from content, not the original
 *     dimensions. Most cards still look right because flex / grid
 *     parent contexts are captured.
 *   - Web fonts not embedded — system fallback used.
 *   - CSS variables (`var(--brand-primary)`) referenced from the source
 *     site's parent stylesheets won't resolve; affected properties fall
 *     to browser defaults.
 *   - Pseudo-elements (`::before`, `::after`) not captured.
 *   - Cross-origin <img src> may be blocked by source CSP / hotlink rules.
 */
function LiveTree({
  node,
  depth = 0,
}: {
  node: ComponentNode;
  depth?: number;
}): ReactNode {
  if (depth > 16) return null;

  let tag = /^[a-z][a-z0-9-]*$/.test(node.tag) ? node.tag : "div";
  if (LIVE_UNSAFE_TAGS.has(tag)) return null;
  // Root nesting fix: ComposedVariantCard wraps every variant in <li>, so a
  // captured <li> root would produce li-in-li (invalid, React warns,
  // browsers silently re-parent it). Same for <tr>/<td>/<dt> needing a
  // table or <dl> parent. Substitute <div> at depth 0 only — internal
  // structure stays intact since the engine captures complete subtrees.
  if (depth === 0 && LIVE_ROOT_NEEDS_PARENT.has(tag)) {
    tag = "div";
  }

  // Filter attrs: strip on* handlers and javascript: URLs. The tree
  // builder already does this at capture time, but redundant filtering
  // means the safety property holds even if a future engine change
  // loosens the upstream filter.
  const safeAttrs: Record<string, string> = {};
  for (const [k, v] of Object.entries(node.attrs ?? {})) {
    if (/^on/i.test(k)) continue;
    if ((k === "href" || k === "src") && /^javascript:/i.test(v)) continue;
    safeAttrs[k] = v;
  }

  // React's style prop takes a camelCase object — exactly how the engine
  // captures style keys from CSSStyleDeclaration property names. No
  // transform needed; the shape already matches CSSProperties.
  const styleObj = (node.style ?? {}) as CSSProperties;

  // Void tags self-render with no children. <img> gets loading="lazy" so a
  // dozen cards loading at once doesn't block the page paint; the browser
  // also won't show an alert dialog for a failed image, just the broken
  // icon — acceptable since the screenshot tab is the visual ground truth.
  if (LIVE_VOID_TAGS.has(tag)) {
    const voidExtras: Record<string, unknown> = {};
    if (tag === "img") voidExtras.loading = "lazy";
    return createElement(tag, {
      ...safeAttrs,
      ...voidExtras,
      style: styleObj,
    });
  }

  const text = node.text ? node.text : null;
  const kids = (node.children ?? []).map((c, i) => (
    <LiveTree key={i} node={c} depth={depth + 1} />
  ));

  // Render: tag + (safeAttrs + style) + (text first, then children).
  // The text-then-kids ordering matches the stringifier's HTML output and
  // matches dom-collector's `directText` capture, which represents only
  // the element's own immediate text (descendant text lives on the
  // descendant nodes, so no duplication).
  return createElement(
    tag,
    { ...safeAttrs, style: styleObj },
    text,
    ...kids,
  );
}

// Convert ComponentNode (engine-emitted tree) to a readable HTML+CSS
// string. Used for the "code" tab of composed variant cards. Never
// executed as DOM — rendered inside a <pre> as text. Safe by construction.
function stringifyComponentTree(
  node: ComponentNode,
  indent = 0,
): string {
  const pad = "  ".repeat(indent);
  const tag = /^[a-z][a-z0-9-]*$/.test(node.tag) ? node.tag : "div";

  const attrParts: string[] = [];
  for (const [k, v] of Object.entries(node.attrs ?? {})) {
    // Drop dangerous attr values up front: anything that could resolve
    // to JS execution context if a downstream consumer rendered this as
    // real HTML. We don't, but defense in depth.
    if (/^javascript:/i.test(v)) continue;
    if (/^on/i.test(k)) continue;
    attrParts.push(`${escapeAttr(k)}="${escapeAttr(v)}"`);
  }

  const styleStr = Object.entries(node.style ?? {})
    .map(([k, v]) => `${camelToKebab(k)}: ${v}`)
    .join("; ");
  if (styleStr) attrParts.push(`style="${escapeAttr(styleStr)}"`);

  const open = attrParts.length
    ? `<${tag} ${attrParts.join(" ")}>`
    : `<${tag}>`;

  if (TREE_VOID_TAGS.has(tag)) {
    return `${pad}${open.replace(/>$/, " />")}`;
  }

  const text = (node.text ?? "").trim();
  const kids = node.children ?? [];

  if (kids.length === 0 && !text) return `${pad}${open}</${tag}>`;
  if (kids.length === 0)
    return `${pad}${open}${escapeText(text)}</${tag}>`;

  const lines: string[] = [`${pad}${open}`];
  if (text) lines.push(`${pad}  ${escapeText(text)}`);
  for (const child of kids) {
    lines.push(stringifyComponentTree(child, indent + 1));
  }
  lines.push(`${pad}</${tag}>`);
  return lines.join("\n");
}

function camelToKebab(s: string): string {
  return s.replace(/[A-Z]/g, (m) => "-" + m.toLowerCase());
}

// JSX-flavour variant of stringifyComponentTree. Same captured tree, but:
//   - `style` becomes an inline object literal (`style={{ camelCase: "..." }}`).
//     The engine captures style keys in camelCase already (via
//     CSSStyleDeclaration property names in cluster.ts), so no transform.
//   - Text that contains `{`, `}`, `<`, or `>` is wrapped in
//     `{JSON.stringify(text)}` so the consumer can paste straight into a
//     `.tsx` file without JSX parse errors.
//   - `class` would map to `className` if the engine ever started capturing
//     it. Today only href / type / aria-label are captured, all of which
//     are valid JSX attribute names as-is.
//
// Same safety posture as the HTML stringifier: void tags self-close, on*
// attrs and javascript: URLs are dropped before emission.
function stringifyComponentTreeJsx(
  node: ComponentNode,
  indent = 0,
): string {
  const pad = "  ".repeat(indent);
  const tag = /^[a-z][a-z0-9-]*$/.test(node.tag) ? node.tag : "div";

  const attrParts: string[] = [];
  for (const [k, v] of Object.entries(node.attrs ?? {})) {
    if (/^javascript:/i.test(v)) continue;
    if (/^on/i.test(k)) continue;
    const jsxKey = k === "class" ? "className" : k;
    attrParts.push(`${escapeAttr(jsxKey)}="${escapeAttr(v)}"`);
  }

  const styleEntries = Object.entries(node.style ?? {});
  if (styleEntries.length > 0) {
    const inner = styleEntries
      .map(([k, v]) => `${k}: ${JSON.stringify(v)}`)
      .join(", ");
    attrParts.push(`style={{ ${inner} }}`);
  }

  const open = attrParts.length
    ? `<${tag} ${attrParts.join(" ")}>`
    : `<${tag}>`;

  if (TREE_VOID_TAGS.has(tag)) {
    return `${pad}${open.replace(/>$/, " />")}`;
  }

  const text = (node.text ?? "").trim();
  const kids = node.children ?? [];

  if (kids.length === 0 && !text) return `${pad}${open}</${tag}>`;
  if (kids.length === 0)
    return `${pad}${open}${escapeJsxText(text)}</${tag}>`;

  const lines: string[] = [`${pad}${open}`];
  if (text) lines.push(`${pad}  ${escapeJsxText(text)}`);
  for (const child of kids) {
    lines.push(stringifyComponentTreeJsx(child, indent + 1));
  }
  lines.push(`${pad}</${tag}>`);
  return lines.join("\n");
}

// JSX text escaping. `{`, `}`, `<`, `>` are all JSX-significant — easiest
// to round-trip them through a JS string literal when present. Plain text
// (the common case) emits unchanged so the snippet stays readable.
function escapeJsxText(s: string): string {
  if (/[{}<>]/.test(s)) {
    return `{${JSON.stringify(s)}}`;
  }
  return s;
}

function escapeAttr(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escapeText(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

//  WCAG contrast helpers (client-side, no engine import)
//
// Used by the Accessibility section to suggest a foreground colour that
// MEETS WCAG AA on a failing contrast pair. Implemented inline rather than
// imported from lib/engine/cluster.ts because pulling that module into the
// client bundle would drag in playwright + culori for ~30 lines of math we
// can reproduce in pure JS.

function hexToRgbLocal(hex: string): { r: number; g: number; b: number } | null {
  const m = /^#?([0-9a-fA-F]{6})$/.exec(hex.trim());
  if (!m) return null;
  return {
    r: parseInt(m[1].slice(0, 2), 16),
    g: parseInt(m[1].slice(2, 4), 16),
    b: parseInt(m[1].slice(4, 6), 16),
  };
}

function rgbToHexLocal(rgb: { r: number; g: number; b: number }): string {
  const h = (n: number) =>
    Math.max(0, Math.min(255, Math.round(n)))
      .toString(16)
      .padStart(2, "0");
  return `#${h(rgb.r)}${h(rgb.g)}${h(rgb.b)}`;
}

function relativeLuminanceLocal(rgb: {
  r: number;
  g: number;
  b: number;
}): number {
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * lin(rgb.r) + 0.7152 * lin(rgb.g) + 0.0722 * lin(rgb.b);
}

function contrastRatioLocal(
  fg: { r: number; g: number; b: number },
  bg: { r: number; g: number; b: number },
): number {
  const lF = relativeLuminanceLocal(fg);
  const lB = relativeLuminanceLocal(bg);
  const light = Math.max(lF, lB);
  const dark = Math.min(lF, lB);
  return (light + 0.05) / (dark + 0.05);
}

/**
 * Suggest a foreground hex that meets `targetRatio` against `bg` by blending
 * the original `fg` toward black (if bg is light) or white (if bg is dark).
 * Returns null on unparseable input. Falls back to pure black/white when no
 * blend achieves the target — that's a sign the bg itself is at an extreme
 * luminance and there's no in-family solution.
 *
 * The suggestion is intentionally minimal-blend (smallest step that hits) so
 * the colour stays as close to the original hue as the WCAG ratio allows.
 */
function suggestBetterForeground(
  fgHex: string,
  bgHex: string,
  targetRatio: number = 4.5,
): string | null {
  const fg = hexToRgbLocal(fgHex);
  const bg = hexToRgbLocal(bgHex);
  if (!fg || !bg) return null;

  // Already passes — nothing to suggest.
  if (contrastRatioLocal(fg, bg) >= targetRatio) return null;

  const bgLum = relativeLuminanceLocal(bg);
  const target = bgLum > 0.5 ? { r: 0, g: 0, b: 0 } : { r: 255, g: 255, b: 255 };

  for (let t = 0.05; t <= 1.0; t += 0.05) {
    const adj = {
      r: fg.r * (1 - t) + target.r * t,
      g: fg.g * (1 - t) + target.g * t,
      b: fg.b * (1 - t) + target.b * t,
    };
    if (contrastRatioLocal(adj, bg) >= targetRatio) {
      return rgbToHexLocal(adj);
    }
  }
  return rgbToHexLocal(target);
}

// Style fields we copy onto the rendered element. Visual-only  we
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
  variant: NonNullable<
    ExtractResponse["tokens"]["components"]
  >[number]["variants"][number];
}) {
  const [hover, setHover] = useState(false);
  const baseStyle = styleFromDict(variant.style);
  const hoverOverride =
    hover && variant.hoverChanges ? styleFromDict(variant.hoverChanges) : {};
  const mergedStyle = { ...baseStyle, ...hoverOverride };

  const sample =
    variant.sampleTexts && variant.sampleTexts[0]
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

//  Accessibility  contrast pairs + focus + touch target
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
        info={{
          summary:
            "Contrast checks for every text + background pair found on the site. Red rows mean the text is hard to read.",
          glossary: [
            {
              label: "AA",
              meaning:
                "WCAG 2.2 AA — text needs 4.5:1 contrast (3:1 for large text).",
            },
            {
              label: "4.5:1",
              meaning:
                "The contrast ratio between text and its background. Higher = easier to read.",
            },
            {
              label: "large text",
              meaning:
                "18px regular or 14px bold and bigger gets the easier 3:1 ratio.",
            },
            { label: "fails", meaning: "Below the AA bar — readability concern." },
            { label: "passes", meaning: "Meets or exceeds the AA bar." },
          ],
        }}
      />

      {pairs.length > 0 && (
        <div
          className={`mb-4 flex items-baseline gap-4 border px-4 py-3 ${
            failing.length === 0
              ? "border-emerald-500/25 bg-emerald-500/5"
              : "border-white/10 bg-white/3"
          }`}
          aria-label={`${passing.length} of ${pairs.length} contrast pairs pass WCAG AA`}
        >
          <div
            className={`font-pixel text-2xl ${
              failing.length === 0 ? "text-emerald-300" : "text-white"
            }`}
          >
            {passing.length} / {pairs.length}
          </div>
          <div>
            <p className="font-pixel text-[10px] uppercase tracking-widest text-white">
              pairs pass WCAG AA
            </p>
            <p className="mt-0.5 font-mono text-[11px] text-white/55">
              4.5:1 needed for normal text · 3:1 for large text
            </p>
          </div>
        </div>
      )}

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
                  AAA {p.meetsAAA ? "✓" : ""}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2 font-mono text-[10px] text-white/60">
                <span className="truncate">text {p.foreground}</span>
                <span className="truncate">bg {p.background}</span>
              </div>
              {!p.meetsAA &&
                (() => {
                  const suggested = suggestBetterForeground(
                    p.foreground,
                    p.background,
                    4.5,
                  );
                  if (
                    !suggested ||
                    suggested.toLowerCase() === p.foreground.toLowerCase()
                  ) {
                    return null;
                  }
                  return (
                    <div className="mt-1 flex items-center gap-2 border-t border-white/10 pt-2 font-mono text-[10px] text-white/65">
                      <span className="font-pixel text-[9px] uppercase tracking-widest text-emerald-300">
                        try
                      </span>
                      <span
                        aria-hidden="true"
                        className="inline-block size-3 border border-white/20"
                        style={{ background: suggested }}
                      />
                      <span className="text-white">{suggested}</span>
                      <span className="ml-auto text-white/45">
                        meets 4.5:1
                      </span>
                    </div>
                  );
                })()}
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
                : ""
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
                : ""
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
                ? ""
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
                ? ""
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

//  Responsive  breakpoints visualised on a horizontal scale
function ResponsiveSection({
  breakpoints,
}: {
  breakpoints?: ExtractResponse["tokens"]["breakpoints"];
}) {
  if (!breakpoints || breakpoints.length === 0) return null;
  return (
    <section>
      <PanelHeader
        label="responsive"
        count={breakpoints.length}
        subtitle="Each row is a media-query breakpoint with the number of CSS rules that scope under it."
        info={{
          summary:
            "Breakpoints where the layout changes — typically mobile / tablet / desktop boundaries.",
          glossary: [
            {
              label: "min-width / max-width",
              meaning: "Which side of the threshold the rules apply on.",
            },
            {
              label: "768px",
              meaning: "The actual breakpoint value from the source CSS.",
            },
            {
              label: "12 rules",
              meaning: "How many CSS rules scope under this media query.",
            },
          ],
        }}
      />
      <ResponsiveList breakpoints={breakpoints.slice(0, 12)} />
    </section>
  );
}

// First N rows always visible; the rest hide behind a "view N more" toggle.
// Same progressive-disclosure pattern as LongTailColors — keeps the section
// noticeable on first scroll without dumping a 12-row list on the user.
function ResponsiveList({
  breakpoints,
}: {
  breakpoints: NonNullable<ExtractResponse["tokens"]["breakpoints"]>;
}) {
  const FIRST_ROWS = 4;
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? breakpoints : breakpoints.slice(0, FIRST_ROWS);
  const remaining = breakpoints.length - FIRST_ROWS;

  return (
    <div className="border border-white/15">
      <ul role="list" className="divide-y divide-white/10">
        {visible.map((bp, i) => (
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
      {remaining > 0 && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          className="block w-full border-t border-white/10 px-4 py-2.5 text-center font-pixel text-[10px] uppercase tracking-widest text-white/60 transition hover:bg-white/3 hover:text-white"
        >
          {expanded ? "show less" : `view ${remaining} more`}
        </button>
      )}
    </div>
  );
}

//  Iconography
function IconographySection({
  iconSystem,
}: {
  iconSystem?: ExtractResponse["tokens"]["iconSystem"];
}) {
  if (!iconSystem) return null;
  return (
    <section>
      <PanelHeader
        label="iconography"
        subtitle={`${iconSystem.library ?? "custom / unknown"} · ${iconSystem.totalCount ?? 0} icons observed`}
        info={{
          summary:
            "SVG icons used on the page, plus the most common size and stroke width.",
          glossary: [
            {
              label: "library",
              meaning:
                "Detected icon library (lucide / heroicons / custom / etc).",
            },
            {
              label: "stroke width",
              meaning:
                "The pixel thickness of icon strokes. Empty when icons are solid (no stroke).",
            },
            {
              label: "color mode",
              meaning:
                "How icons are colored — monochrome / multi-color / inherits.",
            },
            {
              label: "labeled %",
              meaning:
                "How many icons have a screen-reader label (title or aria-label).",
            },
            {
              label: "sizes",
              meaning: "Pixel sizes the icons render at across the site.",
            },
          ],
        }}
      />
      <div className="grid grid-cols-2 gap-px overflow-hidden border border-white/10 bg-white/10 sm:grid-cols-4">
        <A11yFact label="library" value={iconSystem.library ?? "custom"} />
        <A11yFact
          label="stroke width"
          value={
            iconSystem.strokeWidth !== null &&
            iconSystem.strokeWidth !== undefined
              ? String(iconSystem.strokeWidth)
              : ""
          }
        />
        <A11yFact label="color mode" value={iconSystem.colorMode ?? ""} />
        <A11yFact
          label="labeled %"
          value={
            iconSystem.labeledPercentage !== undefined
              ? `${iconSystem.labeledPercentage.toFixed(0)}%`
              : ""
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
    </section>
  );
}

//  Proof preview  pixel side-by-side stays iframed (only sensible way)
function ProofPreviewSection({ proofHtmlUrl }: { proofHtmlUrl: string }) {
  return (
    <section>
      <PanelHeader
        label="fidelity proof"
        subtitle="Pixel-level side-by-side between the live site and our extracted palette (ΔE<12)."
        info={{
          summary:
            "Side-by-side: the live source site vs. the colors we extracted. Lets you see how close our palette matches what's actually rendered.",
          glossary: [
            {
              label: "ΔE < 12",
              meaning:
                "A color-difference threshold. ΔE measures perceived difference between two colors — under 12 means they look basically the same.",
            },
            {
              label: "coverage",
              meaning:
                "What percentage of sampled pixels we matched within the ΔE 12 threshold.",
            },
            {
              label: "unmatched swatches",
              meaning: "Colors we missed — usually image regions or gradients.",
            },
          ],
        }}
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
        {/* h-[820px] uses arbitrary-value syntax so the height is a literal
            CSS rule, not a spacing-derived utility. The previous `h-205`
            relied on Tailwind v4's JIT generating
            `height: calc(var(--spacing) * 205)` from the integer suffix;
            that path proved unreliable in production builds — the class
            sometimes failed to make it into the emitted CSS and the iframe
            collapsed to the browser default of 150 px, which clipped
            proof.html down to its empty top sliver. Arbitrary values are
            always emitted because Tailwind treats them as literal CSS. */}
        <iframe
          src={proofHtmlUrl}
          title="Pixel-fidelity proof"
          className="h-[820px] w-full border-0 bg-white"
          sandbox="allow-scripts allow-same-origin"
        />
      </div>
    </section>
  );
}

// PromptPackSection was removed — it surfaced `universal.md` as a
// separate "build UI with this design" panel, but DESIGN.md already
// serves that exact purpose (and is the canonical, agent-ready spec).
// Having both was misleading: users had to guess which one to actually
// paste into their AI agent. DESIGN.md wins; universal.md is still
// emitted to disk for downstream tooling but no longer surfaced in the
// UI.

function Downloads({
  artifacts,
  outputDir,
}: {
  artifacts: NonNullable<ExtractResponse["artifacts"]>;
  outputDir: string;
}) {
  // Curated download list — only the 4 unique artifacts a user actually
  // drops into a project. Skipped:
  //  - regenerated-ramp.json (internal)
  //  - preview/proof.html (debug aids)
  //  - prompts/universal.md (rolled into DESIGN.md now)
  //  - shadcn-omit-reason.md (only meaningful when shadcn-theme.css is
  //    skipped, which we surface via the absence of the shadcn entry)
  //  - report.html — DEMOTED to an "open in new tab" link below, because
  //    the inline UI on this page already renders the same data as the
  //    report. Keeping it as a download would duplicate content; surfacing
  //    it as an external-tab link still gives access without cluttering
  //    the downloads row.
  const items: Array<{ label: string; url: string }> = [];
  items.push({ label: "tokens.json", url: artifacts.tokensJsonUrl });
  if (artifacts.tailwindCssUrl) {
    items.push({ label: "tailwind.css", url: artifacts.tailwindCssUrl });
  }
  if (artifacts.shadcnThemeUrl) {
    items.push({ label: "shadcn-theme.css", url: artifacts.shadcnThemeUrl });
  }
  if (artifacts.designMdUrl) {
    items.push({ label: "DESIGN.md", url: artifacts.designMdUrl });
  }

  // "Download all" — sequentially trigger a <a download> click per file.
  // Browsers gate multi-download per user gesture (Chrome shows a one-time
  // permission prompt the first time); after that they flow straight to
  // disk. A server-side ZIP would be polished but requires a new API
  // endpoint; this is the smallest change that delivers the feature.
  function handleDownloadAll() {
    for (const [i, it] of items.entries()) {
      // Small stagger so each <a> click fires its own download dialog
      // instead of getting batch-suppressed. 80ms is below the human
      // perception threshold but comfortably above the browser's race
      // window for batching downloads.
      setTimeout(() => {
        const a = document.createElement("a");
        a.href = it.url;
        a.download = it.label;
        a.target = "_blank";
        a.rel = "noopener";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }, i * 80);
    }
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
        <span aria-hidden="true" className="font-pixel text-xs text-white/60">
          {items.length}
        </span>
      </div>
      <ul role="list" className="flex flex-wrap gap-3">
        <li>
          {/* Primary CTA — fires every download in `items` in one click.
              Omitting `href` makes BubbleButton render as <button>. Green
              tone visually distinguishes it from the per-file blue CTAs. */}
          <BubbleButton
            onClick={handleDownloadAll}
            icon="↓"
            tone="green"
            aria-label={`Download all ${items.length} files`}
          >
            download all
          </BubbleButton>
        </li>
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
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-white/60">
          on disk at{" "}
          <code className="font-mono text-white/80">{outputDir}/</code>
        </p>
        {/* report.html lives next to the others on disk but isn't a
            download CTA — the inline result page above already renders the
            same data. Surfacing it as a quiet open-in-new-tab link keeps
            access available for users who want the standalone HTML
            (sharing, archiving, offline reading). */}
        {artifacts.reportHtmlUrl && (
          <a
            href={artifacts.reportHtmlUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="font-pixel text-[10px] uppercase tracking-widest text-white/55 underline-offset-4 transition-colors hover:text-white hover:underline"
          >
            view report.html in new tab ↗
          </a>
        )}
      </div>
    </section>
  );
}

// Diagnostics panel  accordion-style review aid positioned at the bottom
// of the result panel. Each row shows just the headline + severity by
// default; expanding reveals the technical message + recommended action.
// This is intentionally quieter than the previous "loud alert under stats"
// placement: diagnostics are a "things to verify" list, not a problem
// report. Rule IDs (e.g. `low-proof-samples`) are dropped from the visible
// UI  they remain on the Diagnostic object for testing.
function DiagnosticsPanel({ diagnostics }: { diagnostics: Diagnostic[] }) {
  const errors = diagnostics.filter((d) => d.severity === "error");
  const warnings = diagnostics.filter((d) => d.severity === "warning");
  const infos = diagnostics.filter((d) => d.severity === "info");

  // Quiet panel chrome  the row contents do the differentiation.
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
          {errors.length > 0 && (
            <>
              {errors.length} {errors.length === 1 ? "error" : "errors"} ·{" "}
            </>
          )}
          {warnings.length > 0 && (
            <>
              {warnings.length} {warnings.length === 1 ? "warning" : "warnings"}{" "}
              ·{" "}
            </>
          )}
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
  error: {
    dot: "bg-red-400",
    pill: "text-red-300/80    border-red-500/25",
    pillLabel: "error",
  },
  warning: {
    dot: "bg-amber-400",
    pill: "text-amber-300/80  border-amber-500/25",
    pillLabel: "warn",
  },
  info: {
    dot: "bg-white/40",
    pill: "text-white/55      border-white/15",
    pillLabel: "info",
  },
} as const;

// Accordion row using native <details>/<summary>  no React state needed.
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
            <ul
              role="list"
              className="space-y-0.5 font-mono text-[11px] text-white/60"
            >
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

function Stats({ items }: { items: Array<{ label: string; value: string }> }) {
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

// CollapsibleSection (full <details> wrapper that hid the whole section)
// was removed once every consumer migrated to the always-visible pattern:
// long-tail colors / responsive / iconography now show their header +
// first row inline, with progressive disclosure (LongTailColors,
// ResponsiveList) for the rest. Users were missing the fully-collapsed
// sections entirely, so the pattern wasn't earning its complexity.

// Renders one typography row with a live preview of the role name in the
// extracted style  same font-family, size, weight as captured. Browsers
// fall back gracefully when the font isn't installed locally; the metadata
// row below still announces the exact tokens.
// Pangram: hits every letter of the alphabet, so the sample shows the user
// the font's full character set in one short string. Used when the token has
// no roleLabel to seed a more meaningful preview.
const TYPE_PANGRAM = "The quick brown fox jumps over the lazy dog";

function TypographyCard({
  t,
}: {
  t: NonNullable<ExtractResponse["tokens"]["typographyLevels"]>[number];
}) {
  // For display-tier tokens (h1-style, large headlines), use a short word so
  // the sample doesn't wrap awkwardly inside the card. For body tokens, use
  // the pangram so the user can judge rhythm + character coverage.
  const role = (t.roleLabel ?? "").toLowerCase();
  const isDisplay =
    role.includes("display") ||
    role.includes("h1") ||
    role.includes("hero") ||
    role.includes("title");
  const previewText = isDisplay
    ? "The quick brown fox"
    : role.includes("h2") || role.includes("heading")
      ? "The quick brown fox jumps"
      : TYPE_PANGRAM;

  // Compact preview cap — was 4rem, reduced to 2.5rem so the section
  // doesn't dominate the page when there are 8+ tiers. Big-enough to read
  // the font's character at a glance, small-enough that 3 cards fit above
  // the fold on a typical 1080px viewport.
  const previewStyle = {
    fontFamily: t.fontFamily,
    fontSize: `min(${t.fontSize}, 2.5rem)`,
    fontWeight: t.fontWeight,
    lineHeight: 1.15,
    letterSpacing: "-0.01em",
  } as const;

  // Strip CSS quotes from font-family stacks so the footer shows
  // "Geist Sans, sans-serif" not '"Geist Sans", sans-serif'.
  const familyDisplay = t.fontFamily.replace(/"/g, "").replace(/'/g, "");
  // Primary family — first entry in the comma-separated stack. This is
  // the one we surface in the top-right badge because it's the value a
  // designer / dev actually wants to read ("Geist Sans", not the whole
  // fallback chain).
  const primaryFamily = familyDisplay.split(",")[0]?.trim() || familyDisplay;

  return (
    <li className="group relative flex flex-col border border-white/10 bg-white/[0.02] transition-colors hover:border-white/25 hover:bg-white/[0.04]">
      {/* Top-right font-name badge — the most important data point on the
          card. Keeping it prominent so users can scan a stack of cards
          and read the family at a glance without dropping into the
          metadata row. */}
      <span
        aria-hidden="true"
        className="absolute right-3 top-3 z-10 max-w-[55%] truncate border border-white/15 bg-black/55 px-2 py-1 font-pixel text-[9px] uppercase tracking-widest text-white/85 backdrop-blur-sm"
      >
        {primaryFamily}
      </span>

      <div className="flex min-h-24 flex-1 items-center px-6 py-6 sm:px-8 sm:py-7">
        <p
          aria-hidden="true"
          style={previewStyle}
          className="line-clamp-2 break-words text-white"
        >
          {previewText}
        </p>
      </div>

      <footer className="flex items-center justify-between gap-4 border-t border-white/10 px-5 py-2.5">
        <p className="flex min-w-0 items-center gap-2.5 font-mono text-[11px] text-white/55">
          {t.roleLabel && (
            <span className="font-pixel text-[10px] uppercase tracking-widest text-white">
              {t.roleLabel}
            </span>
          )}
          <span className="shrink-0 text-white/75">{t.fontSize}</span>
          <span aria-hidden="true" className="text-white/25">·</span>
          {/* Weight as bare number (was "w600") — the "w" prefix added
              cognitive load. Now just "600". */}
          <span className="shrink-0 text-white/75">{t.fontWeight}</span>
        </p>
        {/* Underlined text-link copy affordance — quieter than the
            button style elsewhere; matches the inline tone of the
            metadata row. Copies the full family stack (not just the
            primary shown in the badge) so the developer gets the
            complete CSS-ready value. */}
        <CopyInlineLink
          value={familyDisplay}
          label={`font family ${t.fontFamily}`}
        />
      </footer>
    </li>
  );
}

// Inline copy affordance — same behavior as CopyValue but rendered as an
// underlined text link instead of a chip-shaped button. Used inside the
// typography card footer where the chip style felt too heavy next to the
// quiet metadata row.
function CopyInlineLink({
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
      // Clipboard requires secure context — fall back to the visible value.
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      aria-label={`Copy ${label ?? value} to clipboard`}
      className={`shrink-0 font-pixel text-[10px] uppercase tracking-widest underline-offset-4 transition-colors hover:underline ${
        copied ? "text-primary" : "text-white/55 hover:text-white"
      }`}
    >
      {copied ? "copied ✓" : "copy"}
    </button>
  );
}

// Generic-family names that aren't on Google Fonts — skipped when we build
// the Google Fonts CSS link. Web-safe stacks (Arial, Helvetica, Times, etc.)
// are also implicitly skipped since the request just 404s for unknown
// families and the browser falls back.
const GENERIC_FONT_FAMILIES =
  /^(serif|sans-serif|monospace|cursive|fantasy|system-ui|ui-(serif|sans-serif|monospace|rounded)|emoji|math|inherit|initial|unset|revert)$/i;

// Build a single Google Fonts CSS URL for every family+weight pair in the
// captured typography. Families that aren't on Google return 404 for that
// segment but the rest still load — the browser handles partial failures
// transparently.
function buildGoogleFontsHref(
  typography: NonNullable<ExtractResponse["tokens"]["typographyLevels"]>,
): string | null {
  const byFamily = new Map<string, Set<number>>();
  for (const t of typography) {
    const primary =
      t.fontFamily.split(",")[0]?.trim().replace(/^['"]|['"]$/g, "") ?? "";
    if (!primary) continue;
    if (GENERIC_FONT_FAMILIES.test(primary)) continue;
    const weight = Number(t.fontWeight);
    if (!Number.isFinite(weight)) continue;
    if (!byFamily.has(primary)) byFamily.set(primary, new Set());
    byFamily.get(primary)!.add(weight);
  }
  if (byFamily.size === 0) return null;
  const params = Array.from(byFamily.entries()).map(([family, weights]) => {
    const ws = Array.from(weights).sort((a, b) => a - b).join(";");
    return `family=${encodeURIComponent(family)}:wght@${ws}`;
  });
  return `https://fonts.googleapis.com/css2?${params.join("&")}&display=swap`;
}

// Typography list with progressive disclosure. Shows the top 3 tiers
// (almost always the ones that matter) and tucks the rest behind a
// "show all" toggle. Also injects a single Google Fonts stylesheet so
// the previews render in the actual captured font when it's hosted on
// Google Fonts; falls back to the browser default otherwise.
function TypographyList({
  typography,
}: {
  typography: NonNullable<ExtractResponse["tokens"]["typographyLevels"]>;
}) {
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    const href = buildGoogleFontsHref(typography);
    if (!href) return;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = href;
    document.head.appendChild(link);
    return () => {
      try {
        document.head.removeChild(link);
      } catch {
        // Element may have already been removed (e.g. fast remount).
      }
    };
  }, [typography]);

  const TOP_VISIBLE = 3;
  const visible = showAll ? typography : typography.slice(0, TOP_VISIBLE);
  const remaining = typography.length - TOP_VISIBLE;

  return (
    <>
      <ul role="list" className="grid grid-cols-1 gap-3">
        {visible.map((t, i) => (
          <TypographyCard key={`${t.fontFamily}-${i}`} t={t} />
        ))}
      </ul>
      {!showAll && remaining > 0 && (
        <button
          type="button"
          onClick={() => setShowAll(true)}
          className="mt-3 inline-flex items-center gap-2 border border-white/15 bg-white/[0.02] px-4 py-2 font-pixel text-[10px] uppercase tracking-widest text-white/70 transition-colors hover:border-white/30 hover:text-white"
        >
          show {remaining} more {remaining === 1 ? "tier" : "tiers"}
        </button>
      )}
    </>
  );
}

// Shape for the click-to-expand "what's this?" help affordance shown on the
// right of every section. `summary` is the one-sentence explanation;
// `glossary` lists what each label / number / chip in the section means.
// Keep copy short and jargon-free — users open this to *understand*, not
// to read documentation.
type SectionInfo = {
  summary: string;
  glossary?: Array<{ label: string; meaning: string }>;
};

// Help drawer rendered below a section header when the user clicks
// "what's this?". Two parts: a one-line summary, then an optional
// definition-list of the labels/badges used in that section. Shared
// between SectionHeader and PanelHeader so the visual treatment is
// identical everywhere.
function SectionInfoPanel({ info }: { info: SectionInfo }) {
  return (
    <div className="mb-4 border border-white/10 bg-white/[0.02] px-4 py-3">
      <p className="text-xs leading-relaxed text-white/75">{info.summary}</p>
      {info.glossary && info.glossary.length > 0 && (
        <dl className="mt-3 grid grid-cols-1 gap-y-1.5">
          {info.glossary.map((g) => (
            <div
              key={g.label}
              className="grid grid-cols-[6.5rem_1fr] gap-x-3 sm:grid-cols-[8rem_1fr]"
            >
              <dt className="truncate font-pixel text-[10px] uppercase tracking-widest text-white/60">
                {g.label}
              </dt>
              <dd className="font-mono text-[11px] leading-relaxed text-white/75">
                {g.meaning}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}

// "what's this?" trigger — small circular `i` icon plus a text label.
// The icon makes the affordance instantly recognisable; the text spells
// out the action for users who don't read the symbol as "info". Both
// part of one button so the click target stays generous and the keyboard
// focus ring covers the whole control.
function SectionInfoToggle({
  open,
  onToggle,
}: {
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      className="group inline-flex shrink-0 items-center gap-1.5 font-pixel text-[10px] uppercase tracking-widest text-white/55 underline-offset-4 transition-colors hover:text-white"
    >
      <span
        aria-hidden="true"
        className="inline-flex size-3.5 items-center justify-center rounded-full border border-current text-[9px] font-pixel leading-none transition-colors group-hover:border-white"
      >
        i
      </span>
      <span className="group-hover:underline">
        {open ? "hide" : "what's this?"}
      </span>
    </button>
  );
}

function SectionHeader({
  index,
  label,
  count,
  info,
  children,
}: {
  index: number;
  label: string;
  count: number;
  info?: SectionInfo;
  children: ReactNode;
}) {
  // Same id-safety treatment as PanelHeader: collapse special chars +
  // multiple dashes so labels with punctuation produce a stable, nav-
  // matching id regardless of how they're worded.
  const headingId = `section-${label
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/gi, "")
    .replace(/-+/g, "-")}`;
  const [infoOpen, setInfoOpen] = useState(false);
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
        <span aria-hidden="true" className="font-pixel text-xs text-white/60">
          {count}
        </span>
        {info && (
          <SectionInfoToggle
            open={infoOpen}
            onToggle={() => setInfoOpen(!infoOpen)}
          />
        )}
      </div>
      {info && infoOpen && <SectionInfoPanel info={info} />}
      {children}
    </section>
  );
}

// StabilityChip + STABILITY_COLORS moved to components/stability-chip.tsx
// (imported at top) so the brand-viewer route at /gallery/<brand> renders
// identical chips without duplicating the implementation.
//
// LongTailColors was also factored out to components/long-tail-colors.tsx
// so the extract page and the /gallery/<brand> page render the same UX:
// first row always visible, rest behind a "view N more" toggle.

function ColorCell({
  hex,
  label,
  frequency,
  layer,
  confidence,
  signals,
}: {
  hex: string;
  label: string;
  frequency: number;
  layer?: string;
  confidence?: number;
  signals?: string[];
}) {
  // Old card layout (label + hex + stability chip + copy) — the user prefers
  // this density over the 2-line minimal version. The "439× used" frequency
  // stays as a corner badge on the swatch (the new pattern they liked) rather
  // than competing with the label/hex inside the footer.
  return (
    <div className="group relative flex flex-col bg-black transition-colors hover:bg-white/[0.02]">
      <div
        className="relative aspect-4/3 w-full overflow-hidden"
        style={{ background: hex }}
      >
        <div
          aria-hidden="true"
          className="absolute inset-0 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08),inset_0_-1px_30px_rgba(0,0,0,0.22)]"
        />
        <span
          aria-hidden="true"
          className="absolute right-2 top-2 bg-black/55 px-1.5 py-0.5 font-pixel text-[9px] uppercase tracking-widest text-white/85 backdrop-blur-sm"
        >
          {frequency}×
        </span>
        <span className="sr-only">used {frequency} times</span>
      </div>

      <div className="flex flex-col gap-2 border-t border-white/10 p-4">
        <p className="truncate font-pixel text-sm tracking-wide text-white">
          {label}
        </p>
        <div className="flex items-center justify-between gap-2">
          <code className="truncate font-mono text-[11px] text-white/70">
            {hex}
          </code>
          <StabilityChip
            layer={layer}
            confidence={confidence}
            signals={signals}
          />
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
          <span className="ml-3 font-mono text-xs text-white/80">
            extract.log
          </span>
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
