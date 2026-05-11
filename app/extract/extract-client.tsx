"use client";

import { useSearchParams } from "next/navigation";
import { useState, type FormEvent, type ReactNode } from "react";
import { ArrowIcon } from "@/icons/arrow";

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
    spacingSystem?: { baseUnit: number; scale: number[] };
    radiusTokens?: Array<{ value: string; frequency: number }>;
    shadowTokens?: Array<{ value: string; frequency: number }>;
    meta?: {
      framework?: {
        tailwind?: { detected: boolean } | null;
        uiFramework?: string | null;
      };
    };
    darkMode?: { supported: boolean; detectionMethod: string };
  };
  report: unknown;
}

interface ErrorResponse {
  error: string;
}

export function ExtractClient() {
  const searchParams = useSearchParams();
  const [url, setUrl] = useState(searchParams.get("url") ?? "");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ExtractResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setResult(null);
    setError(null);

    try {
      const res = await fetch("/api/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, maxPages: 5 }),
      });
      const data: ExtractResponse | ErrorResponse = await res.json();
      if (!res.ok || "error" in data) {
        setError(
          "error" in data ? data.error : `Request failed (${res.status})`,
        );
        return;
      }
      setResult(data as ExtractResponse);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <article className="mx-auto w-full max-w-3xl px-6 pt-12 pb-24 sm:pt-16">
      <Header url={result?.url ?? url} hasResult={!!result} />

      <form
        onSubmit={handleSubmit}
        role="search"
        aria-label="Extract DESIGN.md from a URL"
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
          className="min-w-0 flex-1 appearance-none bg-transparent px-3 py-2 text-sm text-white caret-white placeholder-white/30 outline-none disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={loading || !url.trim()}
          aria-label="Extract"
          className="clip-btn shrink-0 disabled:opacity-40"
        >
          <span aria-hidden="true" className="clip-btn__shadow">
            {loading ? "EXTRACTING" : "EXTRACT"}
          </span>
          <span className="clip-btn__face">
            {loading ? "EXTRACTING" : "EXTRACT"}
          </span>
        </button>
      </form>

      {loading && <LoadingState />}
      {error && <ErrorState message={error} />}
      {result && <ResultState result={result} />}
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
      <h1 className="break-words font-pixel text-4xl leading-[1.05] tracking-tight sm:text-6xl">
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

function LoadingState() {
  return (
    <Panel label="status" tone="info" className="mt-10">
      <p className="font-pixel text-sm uppercase tracking-widest text-white">
        crawling page
      </p>
      <p className="mt-3 text-sm text-white/60">
        Capturing styles, clustering tokens, naming roles. This usually takes
        30–120 seconds depending on page complexity.
      </p>
      <div className="mt-5 flex items-center gap-2 font-pixel text-[10px] uppercase tracking-widest text-white/50">
        <DotsPulse />
        <span>working</span>
      </div>
    </Panel>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <Panel label="error" tone="error" className="mt-10">
      <p className="font-pixel text-sm uppercase tracking-widest text-white">
        extraction failed
      </p>
      <p className="mt-3 text-sm break-words text-white/70">{message}</p>
    </Panel>
  );
}

function ResultState({ result }: { result: ExtractResponse }) {
  const { tokens, durationMs, outputDir } = result;
  const colors = tokens.colorTokens ?? [];
  const namedColors = colors.filter((c) => c.roleLabel);
  const longTailColors = colors.filter((c) => !c.roleLabel);
  const typography = tokens.typographyLevels ?? [];

  return (
    <div className="mt-12 space-y-16">
      <Stats
        items={[
          { label: "duration", value: `${(durationMs / 1000).toFixed(1)}s` },
          { label: "colors", value: String(colors.length) },
          { label: "type levels", value: String(typography.length) },
          {
            label: "framework",
            value:
              tokens.meta?.framework?.uiFramework ??
              (tokens.meta?.framework?.tailwind?.detected
                ? "tailwind"
                : "—"),
          },
        ]}
      />

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
        <SectionHeader
          index={2}
          label="long-tail colors"
          count={longTailColors.length}
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
        </SectionHeader>
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
              <li
                key={`${t.fontFamily}-${i}`}
                className="grid grid-cols-[1fr_auto] items-center gap-4 px-5 py-4"
              >
                <div className="min-w-0">
                  <p className="font-pixel text-xs uppercase tracking-widest text-white">
                    {t.roleLabel ?? "—"}
                  </p>
                  <p className="mt-1 truncate font-mono text-xs text-white/55">
                    {t.fontFamily}
                  </p>
                </div>
                <div className="flex items-center gap-3 font-mono text-xs text-white/60">
                  <span className="text-white/80">{t.fontSize}</span>
                  <span className="text-white/30">·</span>
                  <span>{t.fontWeight}</span>
                  <span className="text-white/30">·</span>
                  <span className="text-primary">{t.frequency}×</span>
                </div>
              </li>
            ))}
          </ul>
        </SectionHeader>
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

      <p className="text-xs text-white/40">
        files written to{" "}
        <code className="font-mono text-white/70">{outputDir}/</code>
      </p>
    </div>
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
      {items.map((s) => (
        <li key={s.label} className="bg-black px-5 py-5">
          <p className="font-pixel text-2xl tracking-tight text-primary sm:text-3xl">
            {s.value}
          </p>
          <p className="mt-1 font-pixel text-[10px] uppercase tracking-widest text-white/50">
            {s.label}
          </p>
        </li>
      ))}
    </ul>
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
  return (
    <section>
      <div className="mb-4 flex items-center gap-3">
        <span className="font-pixel text-xs uppercase tracking-widest text-primary">
          {String(index).padStart(2, "0")}
        </span>
        <span aria-hidden="true" className="h-px flex-1 bg-white/10" />
        <span className="font-pixel text-xs uppercase tracking-widest text-white/55">
          {label}
        </span>
        <span className="font-pixel text-xs text-white/40">{count}</span>
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
    <div className="flex flex-col gap-3 bg-black p-4">
      <div
        aria-hidden="true"
        className="aspect-[5/3] w-full border border-white/10"
        style={{ background: hex }}
      />
      <div>
        <p className="truncate font-pixel text-xs uppercase tracking-widest text-white">
          {label}
        </p>
        <p className="mt-1 truncate font-mono text-[11px] text-white/55">
          {hex}
        </p>
        <p className="mt-1 font-mono text-[10px] text-white/35">
          {frequency}× {layer ? `· ${layer}` : ""}
        </p>
      </div>
    </div>
  );
}

function Panel({
  label,
  tone,
  className = "",
  children,
}: {
  label: string;
  tone: "info" | "error";
  className?: string;
  children: ReactNode;
}) {
  const accent = tone === "error" ? "text-red-400" : "text-primary";
  return (
    <section
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
          <span className="ml-3 font-mono text-xs text-white/70">extract.log</span>
        </div>
        <span
          className={`font-pixel text-xs uppercase tracking-widest ${accent}`}
        >
          {label}
        </span>
      </header>
      <div className="px-5 py-5">{children}</div>
    </section>
  );
}

function DotsPulse() {
  return (
    <span aria-hidden="true" className="inline-flex gap-1">
      <span className="size-1.5 animate-pulse rounded-full bg-primary" />
      <span
        className="size-1.5 animate-pulse rounded-full bg-primary"
        style={{ animationDelay: "150ms" }}
      />
      <span
        className="size-1.5 animate-pulse rounded-full bg-primary"
        style={{ animationDelay: "300ms" }}
      />
    </span>
  );
}
