// Illustrative code preview: shows what a DESIGN.md looks like.
// Pre/code is keyboard-scrollable via tabIndex={0} since the content can
// overflow horizontally on narrow viewports.
const EXAMPLE = `---
name: Your Brand
colors:
  primary: "#0039ff"
  ink: "#0a0a0a"
typography:
  display-lg:
    fontFamily: Geist
    fontSize: 56px
    fontWeight: 500
rounded:
  md: 8px
---

## Overview
Your Brand reads like a serious tool that
respects the user's attention. One blue
accent, used scarcely.

## Colors
- **Primary** (#0039ff): The single brand
  color. Used for primary CTAs only.
- **Ink** (#0a0a0a): Body text.`;

export function SpecPreview() {
  return (
    <section
      id="spec"
      aria-labelledby="spec-heading"
      className="mx-auto w-full max-w-5xl px-6 pb-24 sm:px-10"
    >
      <h2 id="spec-heading" className="sr-only">
        Example DESIGN.md file
      </h2>
      <figure className="overflow-hidden border border-white/15">
        <figcaption className="flex items-center justify-between border-b border-white/15 bg-white/3 px-4 py-2.5">
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
            <span className="ml-3 font-mono text-xs text-white/70">
              DESIGN.md
            </span>
          </div>
          <span className="font-pixel text-xs uppercase tracking-widest text-primary">
            example
          </span>
        </figcaption>
        <pre
          tabIndex={0}
          className="overflow-x-auto px-5 py-5 text-sm leading-relaxed text-white/85 focus-visible:outline-2 focus-visible:outline-primary"
        >
          <code>{EXAMPLE}</code>
        </pre>
      </figure>
    </section>
  );
}
