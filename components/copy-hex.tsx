"use client";

import { useEffect, useState } from "react";

// Click-to-copy hex code, rendered as an underlined inline button. Sized
// to fit the color-card metadata row so it reads as "the hex, but it's
// also a button" without adding visual weight. Used on /gallery/<brand>.

export function CopyHex({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const id = setTimeout(() => setCopied(false), 1200);
    return () => clearTimeout(id);
  }, [copied]);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
    } catch {
      // Permissions-denied fallback. Same dance the MdActions component uses.
      const ta = document.createElement("textarea");
      ta.value = value;
      ta.style.position = "fixed";
      ta.style.left = "-9999px";
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand("copy");
        setCopied(true);
      } finally {
        document.body.removeChild(ta);
      }
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      aria-label={copied ? `Copied ${value}` : `Copy ${value}`}
      className="font-mono text-[11px] text-white/70 underline decoration-white/25 decoration-dotted underline-offset-4 transition hover:text-white hover:decoration-white/70 focus-visible:outline-none focus-visible:decoration-emerald-300"
    >
      {copied ? "copied ✓" : value}
    </button>
  );
}
