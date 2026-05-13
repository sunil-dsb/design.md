import * as fs from "fs";
import * as path from "path";
import type { Metadata } from "next";
import { Footer } from "@/components/footer";
import { Navbar } from "@/components/navbar";
import { SkipLink } from "@/components/skip-link";
import { scoreTokens, goldPathFor, type OverallScore } from "../../eval/score";
import { assignColorRoles, assignTypeRoles } from "@/lib/engine/role-namer";
import type { DesignTokens } from "@/lib/engine/types";
import type { GoldTokens } from "../../eval/gold/types";

export const metadata: Metadata = {
  title: "Scoreboard",
  description:
    "Public accuracy scoreboard — our deterministic extraction scored against hand-curated gold tokens per brand.",
};

// Server-rendered: we score every brand that has both a gold file and an
// extraction (under examples/ or output/). Numbers are deterministic — same
// gold + same extraction → same score, every time. Plan-v1.md §10's
// reproducibility commitment depends on this.

// Force dynamic so we score fresh on every request (file system may have
// changed). Cheap — each score is ~50ms with no Playwright.
export const dynamic = "force-dynamic";

interface ScoreboardRow {
  brand: string;
  score: OverallScore | null;
  goldPath: string;
  tokensSource: string;
  error?: string;
}

function findTokensPath(brand: string, root: string): string | null {
  // Same resolution as bin/score.ts: prefer output/<brand>.com, then
  // examples/<brand>, then the second output fallback shape.
  const candidates = [
    path.join(root, "output", `${brand}.com`, "tokens.json"),
    path.join(root, "examples", brand, "tokens.json"),
    path.join(root, "output", brand, "tokens.json"),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return null;
}

function readBrandRows(): ScoreboardRow[] {
  const root = process.cwd();
  const goldDir = path.join(root, "eval", "gold");
  if (!fs.existsSync(goldDir)) return [];
  const files = fs
    .readdirSync(goldDir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => f.replace(/\.json$/, ""))
    .sort();

  const rows: ScoreboardRow[] = [];
  for (const brand of files) {
    const goldPath = goldPathFor(brand, root);
    const tokensPath = findTokensPath(brand, root);
    if (!tokensPath) {
      rows.push({
        brand,
        score: null,
        goldPath,
        tokensSource: "—",
        error: `No tokens.json found for ${brand}.`,
      });
      continue;
    }
    try {
      // Apply role-namer + type-namer in memory so primary scoring sees
      // the `role` field, then score directly via the in-memory function.
      // No temp files in committed directories — that pattern would write
      // .tokens-roled-*.json into examples/<brand>/ on every request.
      const tokens = JSON.parse(fs.readFileSync(tokensPath, "utf-8")) as DesignTokens;
      if (Array.isArray(tokens.colorTokens)) {
        tokens.colorTokens = assignColorRoles(tokens.colorTokens);
      }
      if (Array.isArray(tokens.typographyLevels)) {
        tokens.typographyLevels = assignTypeRoles(tokens.typographyLevels);
      }
      const gold = JSON.parse(fs.readFileSync(goldPath, "utf-8")) as GoldTokens;
      const score = scoreTokens(tokens, gold);
      rows.push({
        brand,
        score,
        goldPath,
        tokensSource: path.relative(root, tokensPath),
      });
    } catch (err) {
      rows.push({
        brand,
        score: null,
        goldPath,
        tokensSource: path.relative(root, tokensPath),
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
  return rows;
}

export default function ScoreboardPage() {
  const rows = readBrandRows();
  const scored = rows.filter((r) => r.score !== null);
  const avgComposite =
    scored.length === 0
      ? 0
      : Math.round(
          scored.reduce((s, r) => s + (r.score?.composite ?? 0), 0) / scored.length,
        );

  return (
    <>
      <SkipLink />
      <Navbar />

      <main
        id="main"
        tabIndex={-1}
        className="flex flex-1 flex-col outline-none"
      >
        <article className="mx-auto w-full max-w-5xl px-6 pt-12 pb-24 sm:pt-16">
          <header>
            <p className="mb-4 inline-flex items-center gap-2 font-pixel text-xs uppercase tracking-widest text-white/55">
              <span
                aria-hidden="true"
                className="size-1.5 rounded-full bg-primary"
              />
              accuracy scoreboard
            </p>
            <h1 className="font-pixel text-4xl leading-[1.05] tracking-tight sm:text-6xl">
              measured<span className="text-primary">.</span>not asserted
            </h1>
            <p className="mt-6 max-w-2xl text-base leading-7 text-white/70">
              Every extraction in this table is scored against{" "}
              <strong className="text-white">hand-curated gold tokens</strong>{" "}
              for that brand — the canonical primary color, font family,
              spacing base unit, and palette. The same scoring functions you
              see here run on every code change via{" "}
              <code className="font-mono text-white/85">pnpm engine:score</code>.
            </p>
          </header>

          <div className="mt-10 grid grid-cols-1 gap-px overflow-hidden border border-white/10 bg-white/10 sm:grid-cols-3">
            <Stat label="brands scored" value={String(scored.length)} />
            <Stat
              label="avg composite"
              value={`${avgComposite}/100`}
              accent={avgComposite >= 80 ? "good" : avgComposite >= 60 ? "warn" : "bad"}
            />
            <Stat
              label="primary matches"
              value={`${scored.filter((r) => r.score?.colors.primary.pass).length}/${scored.length}`}
            />
          </div>

          {scored.length === 0 ? (
            <p className="mt-10 text-sm text-white/55">
              No brands available to score yet. Add gold tokens under{" "}
              <code className="font-mono text-white/70">eval/gold/</code>{" "}
              and run an extraction.
            </p>
          ) : (
            <ScoreboardTable rows={rows} />
          )}

          <section className="mt-16">
            <h2 className="font-pixel text-xs uppercase tracking-widest text-white/55">
              methodology
            </h2>
            <div className="mt-4 space-y-4 text-sm leading-7 text-white/70">
              <p>
                Each row scores one (brand × extraction) pair across four
                dimensions. The composite is a weighted total out of 100.
              </p>
              <ul className="list-disc space-y-2 pl-6">
                <li>
                  <strong className="text-white">Primary (30 pts).</strong>{" "}
                  ΔE2000 distance in OKLCH space between the role-namer&apos;s
                  picked primary and the gold primary. Full credit when ΔE ≤ 5;
                  partial credit when ΔE ≤ 10; zero otherwise.
                </li>
                <li>
                  <strong className="text-white">Palette F1 (25 pts).</strong>{" "}
                  Precision × recall of extracted colors matching gold within
                  ΔE 5. Captures both noise (low precision) and missing
                  brand colors (low recall).
                </li>
                <li>
                  <strong className="text-white">Typography (20 pts).</strong>{" "}
                  Display family + body family canonical-name match against
                  gold. 10 points each.
                </li>
                <li>
                  <strong className="text-white">Spacing (15 pts).</strong>{" "}
                  Base unit exact match (7 pts) + scale recall against the
                  gold step list (8 pts).
                </li>
                <li>
                  <strong className="text-white">Coverage floor (10 pts).</strong>{" "}
                  Awarded when any colors were extracted, so a pipeline that
                  ran but missed everything still earns the lowest credit.
                </li>
              </ul>
              <p>
                Scoring is{" "}
                <strong className="text-white">deterministic</strong>: same
                gold + same extraction → same score. The functions live at{" "}
                <code className="font-mono text-white/85">eval/score.ts</code>{" "}
                and are covered by{" "}
                <code className="font-mono text-white/85">22 unit tests</code>.
              </p>
              <p>
                What this does <strong className="text-white">not</strong>{" "}
                measure: prose quality (Brand Context / Visual Theme sections
                are explicitly stubbed and require an AI agent), aesthetic
                judgement, or anything we can&apos;t verify against canonical
                brand assets.
              </p>
            </div>
          </section>
        </article>
      </main>

      <Footer />
    </>
  );
}

function Stat({
  label,
  value,
  accent = "neutral",
}: {
  label: string;
  value: string;
  accent?: "good" | "warn" | "bad" | "neutral";
}) {
  const accentClass =
    accent === "good"
      ? "text-emerald-300"
      : accent === "warn"
        ? "text-amber-300"
        : accent === "bad"
          ? "text-red-300"
          : "text-white";
  return (
    <div className="group relative bg-black p-6">
      <span
        aria-hidden="true"
        className="absolute top-0 left-0 h-px w-10 bg-primary transition-all group-hover:w-full"
      />
      <p className="mb-2 font-pixel text-[10px] uppercase tracking-widest text-white/40">
        {label}
      </p>
      <p className={`font-pixel text-4xl leading-none tracking-tight sm:text-5xl ${accentClass}`}>
        {value}
      </p>
    </div>
  );
}

function ScoreboardTable({ rows }: { rows: ScoreboardRow[] }) {
  return (
    <section className="mt-10 overflow-hidden border border-white/15">
      <header className="grid grid-cols-[10rem_5rem_1fr_1fr_1fr_1fr] gap-3 border-b border-white/10 bg-white/3 px-5 py-3 font-pixel text-[10px] uppercase tracking-widest text-white/55">
        <span>brand</span>
        <span className="text-right">composite</span>
        <span>primary (ΔE)</span>
        <span>palette F1</span>
        <span>typography</span>
        <span>spacing</span>
      </header>
      <ul role="list" className="divide-y divide-white/10">
        {rows.map((r) => (
          <ScoreboardRow key={r.brand} row={r} />
        ))}
      </ul>
    </section>
  );
}

function ScoreboardRow({ row }: { row: ScoreboardRow }) {
  if (!row.score) {
    return (
      <li className="grid grid-cols-[10rem_1fr] gap-3 px-5 py-3 text-xs">
        <span className="font-pixel text-sm uppercase tracking-wide text-white">
          {row.brand}
        </span>
        <span className="truncate text-red-300/80">
          {row.error ?? "no extraction"}
        </span>
      </li>
    );
  }
  const s = row.score;
  const compositeTone =
    s.composite >= 80
      ? "text-emerald-300"
      : s.composite >= 60
        ? "text-amber-300"
        : "text-red-300";

  return (
    <li className="grid grid-cols-[10rem_5rem_1fr_1fr_1fr_1fr] items-center gap-3 px-5 py-4">
      <span className="font-pixel text-sm uppercase tracking-wide text-white">
        {row.brand}
      </span>
      <span className={`text-right font-pixel text-lg ${compositeTone}`}>
        {s.composite}
      </span>
      <Cell
        primary={
          s.colors.primary.pass
            ? `${s.colors.primary.extracted} ✓`
            : `${s.colors.primary.extracted ?? "—"} ✗`
        }
        secondary={`Δ${s.colors.primary.deltaE === Infinity ? "∞" : s.colors.primary.deltaE.toFixed(1)} · gold ${s.colors.primary.gold}`}
        pass={s.colors.primary.pass}
      />
      <Cell
        primary={`${(s.colors.palette.f1 * 100).toFixed(0)}%`}
        secondary={`P ${(s.colors.palette.precision * 100).toFixed(0)}% · R ${(s.colors.palette.recall * 100).toFixed(0)}%`}
        pass={s.colors.palette.f1 >= 0.6}
      />
      <Cell
        primary={s.typography.display.extracted ?? "—"}
        secondary={`gold ${s.typography.display.gold}`}
        pass={s.typography.display.pass && s.typography.body.pass}
      />
      <Cell
        primary={s.spacing.baseUnit.extracted ? `${s.spacing.baseUnit.extracted}px base` : "—"}
        secondary={`scale ${(s.spacing.scaleRecall * 100).toFixed(0)}%`}
        pass={s.spacing.baseUnit.pass && s.spacing.scaleRecall >= 0.7}
      />
    </li>
  );
}

function Cell({
  primary,
  secondary,
  pass,
}: {
  primary: string;
  secondary?: string;
  pass: boolean;
}) {
  return (
    <div className="min-w-0">
      <p
        className={`truncate font-mono text-xs ${pass ? "text-white/85" : "text-red-300/85"}`}
      >
        {primary}
      </p>
      {secondary && (
        <p className="mt-0.5 truncate font-mono text-[10px] text-white/40">
          {secondary}
        </p>
      )}
    </div>
  );
}
