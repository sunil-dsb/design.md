"use client";

import { useEffect, useState } from "react";
import { BubbleButton } from "./bubble-button";

// Copy + Download buttons for a markdown source string. Used in the
// DESIGN.md section header on /gallery/<brand> so users can grab the
// file without scraping it from the rendered HTML.
//
// Both buttons use <BubbleButton>  the same primary-CTA component the
// navbar uses for "Sign in" and the /why hero uses for its main action.
// That keeps the SPA's CTA language consistent across surfaces.
//
// Client-only: the brand page itself is server-rendered, but Copy uses
// navigator.clipboard and Download uses Blob + URL.createObjectURL  both
// browser-only APIs. This component is the smallest island of interactivity
// inside an otherwise static page.

export function MdActions({
  source,
  filename,
}: {
  source: string;
  filename: string;
}) {
  const [copied, setCopied] = useState(false);

  // Auto-reset the "copied ✓" feedback after 1.5s. Cleanup if user
  // navigates away before the timer fires.
  useEffect(() => {
    if (!copied) return;
    const id = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(id);
  }, [copied]);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(source);
      setCopied(true);
    } catch {
      // Older browsers / permissions denied. Fall back to a hidden
      // textarea + document.execCommand, then surface the result.
      const ta = document.createElement("textarea");
      ta.value = source;
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

  function handleDownload() {
    // Blob with explicit markdown MIME so the OS opens the file in a
    // sensible default app (most editors recognise text/markdown).
    const blob = new Blob([source], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    // Defer revocation so very-fast UA navigation completes the download
    // first; 1s is plenty for a string Blob.
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <div className="flex items-center gap-2">
      <BubbleButton
        onClick={handleCopy}
        aria-live="polite"
        aria-label={copied ? "Copied" : "Copy DESIGN.md to clipboard"}
        icon={copied ? "✓" : "⧉"}
        tone={copied ? "green" : "blue"}
      >
        {copied ? "copied" : "copy"}
      </BubbleButton>
      <BubbleButton
        onClick={handleDownload}
        aria-label="Download DESIGN.md"
        icon="↓"
      >
        download
      </BubbleButton>
    </div>
  );
}
