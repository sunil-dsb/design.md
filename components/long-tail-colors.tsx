"use client";

import { useState } from "react";
import { CopyHex } from "./copy-hex";

// Compact long-tail color grid. First row is always visible; remaining
// rows hide behind a "view N more" toggle so the page doesn't drown in
// fifty near-identical greys when the user opens a brand with a busy
// palette.

interface LongTailEntry {
  hex: string;
  frequency: number;
}

export function LongTailColors({ colors }: { colors: LongTailEntry[] }) {
  // Cards-per-row at the widest breakpoint we render at. Matches the
  // `lg:grid-cols-12` class below. The first `firstRow` cards are always
  // visible; the rest go behind the toggle.
  const FIRST_ROW = 12;
  const [expanded, setExpanded] = useState(false);

  if (colors.length === 0) return null;
  const firstRow = colors.slice(0, FIRST_ROW);
  const rest = colors.slice(FIRST_ROW);

  return (
    <div className="mt-6 border border-white/10">
      <header className="flex items-center justify-between border-b border-white/10 bg-white/3 px-4 py-2">
        <p className="font-pixel text-[10px] uppercase tracking-widest text-white/60">
          long-tail · {colors.length}
        </p>
        <p className="font-mono text-[10px] text-white/40">click to copy</p>
      </header>

      <ul
        role="list"
        className="grid grid-cols-4 gap-px overflow-hidden bg-white/10 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-12"
      >
        {firstRow.map((c, i) => (
          <CompactSwatch key={`first-${c.hex}-${i}`} hex={c.hex} />
        ))}
      </ul>

      {rest.length > 0 && (
        <>
          {expanded && (
            <ul
              role="list"
              className="grid grid-cols-4 gap-px overflow-hidden border-t border-white/10 bg-white/10 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-12"
            >
              {rest.map((c, i) => (
                <CompactSwatch key={`rest-${c.hex}-${i}`} hex={c.hex} />
              ))}
            </ul>
          )}
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
            className="block w-full border-t border-white/10 px-4 py-2.5 text-center font-pixel text-[10px] uppercase tracking-widest text-white/60 transition hover:bg-white/3 hover:text-white"
          >
            {expanded ? "show less" : `view ${rest.length} more`}
          </button>
        </>
      )}
    </div>
  );
}

// Single compact swatch  smaller than the named-color cards on purpose,
// since long-tail entries are usually decorative / gradient stops the
// user only needs to glance at.
function CompactSwatch({ hex }: { hex: string }) {
  return (
    <li className="flex flex-col items-stretch bg-black">
      <div
        aria-hidden="true"
        className="aspect-square w-full"
        style={{ background: hex }}
      />
      <div className="border-t border-white/10 px-1.5 py-1.5 text-center">
        <CopyHex value={hex} />
      </div>
    </li>
  );
}
