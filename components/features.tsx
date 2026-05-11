const FEATURES = [
  {
    title: "One URL in",
    description:
      "Paste any public website. The extractor reads colors, typography, spacing, and component patterns.",
  },
  {
    title: "Tokens + rationale",
    description:
      "YAML front matter for machines, markdown body for humans. Exact values plus the why behind them.",
  },
  {
    title: "Drop-in ready",
    description:
      "Save DESIGN.md to your repo root. Point your agent at it. Every UI follows the same rules.",
  },
];

export function Features() {
  return (
    <section
      id="features"
      aria-labelledby="features-heading"
      className="mx-auto w-full max-w-5xl px-6 pb-24 sm:px-10"
    >
      <h2 id="features-heading" className="sr-only">
        Features
      </h2>
      <ul
        role="list"
        className="grid grid-cols-1 gap-px overflow-hidden border border-white/10 bg-white/10 sm:grid-cols-3"
      >
        {FEATURES.map((f, i) => (
          <li key={f.title} className="bg-black">
            <article className="flex h-full flex-col gap-6 p-6 transition-colors hover:bg-white/2 sm:p-8">
              <span
                aria-hidden="true"
                className="font-pixel text-5xl leading-none tracking-tight text-primary sm:text-6xl"
              >
                {String(i + 1).padStart(2, "0")}
              </span>
              <div>
                <h3 className="font-pixel text-base tracking-wide text-white">
                  {f.title}
                </h3>
                <p className="mt-3 text-sm leading-6 text-white/60">
                  {f.description}
                </p>
              </div>
            </article>
          </li>
        ))}
      </ul>
    </section>
  );
}
