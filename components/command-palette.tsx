"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { useRouter } from "next/navigation";

// Cmd+K command palette. Opens with ⌘K / Ctrl+K from anywhere on the site,
// closes with ESC or click-outside. Keyboard-first: arrow keys move the
// highlight, Enter activates the selected row, typing filters in real time.
//
// Items are grouped into three sections:
//   Navigate       — internal routes
//   Extract        — one-click extraction for the gallery brands
//   Resources      — external links (GitHub, spec)
//
// The whole thing is a single client component mounted once at the body
// level (see layout.tsx) so the shortcut is global.

type Item = {
  id: string;
  label: string;
  hint?: string;
  keywords?: string;
  section: "Navigate" | "Extract" | "Resources";
  onSelect: () => void;
};

// Quick-extract shortcuts — wire each gallery brand to its real homepage so
// `Extract Stripe` actually hits stripe.com.
const BRANDS = [
  { name: "Stripe", url: "stripe.com" },
  { name: "Linear", url: "linear.app" },
  { name: "Vercel", url: "vercel.com" },
  { name: "Supabase", url: "supabase.com" },
] as const;

const REPO_URL = "https://github.com/sunil-dsb/design.md";
const SPEC_URL = "https://stitch.withgoogle.com/docs/design-md/overview";

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const openExternal = useCallback((url: string) => {
    window.open(url, "_blank", "noopener,noreferrer");
  }, []);

  const items: Item[] = useMemo(
    () => [
      {
        id: "nav-home",
        label: "Home",
        section: "Navigate",
        onSelect: () => router.push("/"),
      },
      {
        id: "nav-why",
        label: "Why design.md",
        section: "Navigate",
        onSelect: () => router.push("/why"),
      },
      {
        id: "nav-extract",
        label: "Extract from URL",
        hint: "paste any site",
        section: "Navigate",
        onSelect: () => router.push("/extract"),
      },
      {
        id: "nav-gallery",
        label: "Gallery",
        section: "Navigate",
        onSelect: () => router.push("/gallery"),
      },
      {
        id: "nav-scoreboard",
        label: "Scoreboard",
        section: "Navigate",
        onSelect: () => router.push("/scoreboard"),
      },

      ...BRANDS.map<Item>((b) => ({
        id: `brand-${b.url}`,
        label: `Extract ${b.name}`,
        hint: b.url,
        section: "Extract",
        keywords: `${b.name} ${b.url} brand`,
        onSelect: () => router.push(`/extract?url=${encodeURIComponent(b.url)}`),
      })),

      {
        id: "ext-github",
        label: "Star on GitHub",
        hint: "↗ external",
        section: "Resources",
        keywords: "github star repo open source",
        onSelect: () => openExternal(REPO_URL),
      },
      {
        id: "ext-spec",
        label: "Read the DESIGN.md spec",
        hint: "↗ Google Stitch",
        section: "Resources",
        keywords: "spec google stitch documentation",
        onSelect: () => openExternal(SPEC_URL),
      },
    ],
    [router, openExternal],
  );

  // Substring + keyword match. Cheap and predictable — no fuzzy matcher
  // dependency, no surprising ranking.
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((item) => {
      const haystack = `${item.label} ${item.section} ${item.keywords ?? ""} ${item.hint ?? ""}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [items, query]);

  // Group filtered items by section in their original section order.
  const grouped = useMemo(() => {
    const map = new Map<Item["section"], Item[]>();
    for (const item of filtered) {
      const arr = map.get(item.section) ?? [];
      arr.push(item);
      map.set(item.section, arr);
    }
    return Array.from(map.entries());
  }, [filtered]);

  // ─── Global open/close shortcut ──────────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // ⌘K on Mac, Ctrl+K elsewhere — also accept / when no input is focused
      // (Linear / GitHub pattern).
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
        return;
      }
      if (e.key === "Escape" && open) {
        e.preventDefault();
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // ─── Reset state on open; lock body scroll while open ────────────────────
  useEffect(() => {
    if (!open) return;
    setQuery("");
    setSelectedIndex(0);
    // Focus the input on the next tick so it's mounted.
    requestAnimationFrame(() => inputRef.current?.focus());
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Filter changed → reset selection to top.
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // ─── In-palette keyboard nav ─────────────────────────────────────────────
  const onInputKeyDown = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const item = filtered[selectedIndex];
      if (item) {
        item.onSelect();
        setOpen(false);
      }
    }
  };

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
      className="fixed inset-0 z-[60] flex items-start justify-center bg-black/60 pt-[15vh] backdrop-blur-sm"
      onClick={(e) => {
        // Click-outside to close — only fire when the click hits the
        // backdrop itself, not the panel inside.
        if (e.target === e.currentTarget) setOpen(false);
      }}
    >
      <div className="mx-4 w-full max-w-lg overflow-hidden border border-white/15 bg-black shadow-2xl">
        {/* Search input */}
        <div className="flex items-center gap-3 border-b border-white/10 px-4 py-3">
          <span
            aria-hidden="true"
            className="font-mono text-xs text-white/40 select-none"
          >
            {"›"}
          </span>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onInputKeyDown}
            placeholder="Type a command, brand, or page…"
            aria-label="Search commands"
            autoComplete="off"
            spellCheck={false}
            className="min-w-0 flex-1 appearance-none bg-transparent font-mono text-sm text-white caret-white outline-none placeholder:text-white/30 focus:outline-none focus-visible:outline-none"
          />
          <kbd className="border border-white/15 bg-white/5 px-1.5 py-0.5 font-mono text-[10px] text-white/50">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div ref={listRef} className="max-h-[60vh] overflow-y-auto py-2">
          {filtered.length === 0 ? (
            <div className="px-4 py-10 text-center font-mono text-sm text-white/40">
              No results for{" "}
              <span className="text-white/70">&quot;{query}&quot;</span>
            </div>
          ) : (
            grouped.map(([section, sectionItems]) => (
              <div key={section} className="mb-2 last:mb-0">
                <div className="px-4 py-1.5 font-pixel text-[10px] tracking-widest text-white/40 uppercase">
                  {section}
                </div>
                <ul role="listbox" aria-label={section}>
                  {sectionItems.map((item) => {
                    const flatIndex = filtered.indexOf(item);
                    const isSelected = flatIndex === selectedIndex;
                    return (
                      <li
                        key={item.id}
                        role="option"
                        aria-selected={isSelected}
                        className={
                          "flex cursor-pointer items-center justify-between px-4 py-2 font-mono text-sm transition-colors " +
                          (isSelected
                            ? "bg-primary text-white"
                            : "text-white/80 hover:bg-white/5")
                        }
                        onMouseEnter={() => setSelectedIndex(flatIndex)}
                        onClick={() => {
                          item.onSelect();
                          setOpen(false);
                        }}
                      >
                        <span className="truncate">{item.label}</span>
                        {item.hint ? (
                          <span
                            className={
                              "ml-3 shrink-0 font-mono text-[11px] " +
                              (isSelected ? "text-white/80" : "text-white/35")
                            }
                          >
                            {item.hint}
                          </span>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))
          )}
        </div>

        {/* Footer hint */}
        <div className="flex items-center justify-between border-t border-white/10 bg-white/[0.02] px-4 py-2 font-mono text-[10px] text-white/40">
          <span className="flex items-center gap-2">
            <kbd className="border border-white/15 bg-white/5 px-1.5 py-0.5">
              ↑↓
            </kbd>
            navigate
            <span className="mx-1 text-white/20">·</span>
            <kbd className="border border-white/15 bg-white/5 px-1.5 py-0.5">
              ↵
            </kbd>
            select
          </span>
          <span className="flex items-center gap-1">
            <kbd className="border border-white/15 bg-white/5 px-1.5 py-0.5">
              ⌘
            </kbd>
            <kbd className="border border-white/15 bg-white/5 px-1.5 py-0.5">
              K
            </kbd>
            to open
          </span>
        </div>
      </div>
    </div>
  );
}
