import type { Metadata } from "next";
import Link from "next/link";
import { BubbleButton } from "@/components/bubble-button";
import { Footer } from "@/components/footer";
import { Navbar } from "@/components/navbar";
import { SkipLink } from "@/components/skip-link";
import { ArrowLineIcon } from "@/icons/arrow-line";
import { EyesIcon } from "@/icons/eyes";

export const metadata: Metadata = {
  title: "Why design.md",
  description:
    "What DESIGN.md is, why every AI-built website looks the same, and how one markdown file fixes it.",
};

const YAML_EXAMPLE = `---
name: Your Brand
colors:
  primary: "#0039ff"
  ink: "#0a0a0a"
  canvas: "#fafafa"
typography:
  display-lg:
    fontFamily: Geist
    fontSize: 56px
    fontWeight: 500
    letterSpacing: -1.5px
  body-md:
    fontFamily: Geist
    fontSize: 16px
    fontWeight: 400
    lineHeight: 1.6
rounded:
  md: 8px
  lg: 16px
spacing:
  base: 16px
  section: 80px
---`;

const PROSE_EXAMPLE = `## Overview
Your Brand reads like a serious tool that
respects the user's attention. Display type
stays large but modest in weight. One blue
accent, used scarcely so it never dilutes.

## Colors
- **Primary** (#0039ff): The single brand
  color. Used for primary CTAs and active
  states only. Never as a section background
  it should feel precious.

- **Ink** (#0a0a0a): Body text. Pure black
  is too harsh; this almost-black keeps the
  warmth.`;

const BENEFITS = [
  {
    title: "Your site stops looking generic",
    body: "The agent stops averaging. Every UI it generates uses your colors, your typography, your spacing not the internet's.",
  },
  {
    title: "Every screen feels like one product",
    body: "Dashboard, settings, onboarding, error pages they all share the same DNA. Without DESIGN.md, each screen is its own little island.",
  },
  {
    title: "You stop repeating yourself",
    body: "No more 40-line preamble in every prompt. The agent already knows your tokens it's reading them off disk.",
  },
  {
    title: "It works with the tools you have",
    body: "Claude Code. Cursor. Windsurf. Copilot. They all read markdown and respect repo-level context. Drop the file in. They pick it up.",
  },
  {
    title: "It evolves like code",
    body: "Brand changes? Edit the file. PR it. Diff it. Ship it. No more Figma libraries drifting out of sync with what's actually deployed.",
  },
  {
    title: "It's a starting point, not a cage",
    body: "The file gives the agent a language to start in. You or the agent keep building on top. Drift happens. The system grows.",
  },
];

export default function WhyPage() {
  return (
    <>
      <SkipLink />
      <Navbar />

      <main id="main" tabIndex={-1} className="flex flex-1 flex-col outline-none">
        <article className="mx-auto w-full max-w-3xl px-6 pt-16 pb-24 sm:pt-24">
          <header className="mb-20">
            <p className="mb-4 font-pixel text-xs uppercase tracking-widest text-white/60">
              Why we exist
            </p>
            <h1 className="font-pixel text-4xl leading-[1.05] tracking-tight sm:text-6xl">
              One .md file. <br />
              Your site stops{" "}
              <span aria-hidden="true">
                l
                <EyesIcon className="inline-block size-[0.85em] translate-y-[-0.05em] align-middle" />
                king
              </span>
              <span className="sr-only">looking</span>{" "}
              <span className="text-primary">generic</span>.
            </h1>
            <p className="mt-8 max-w-xl text-lg leading-7 text-white/70">
              Every AI-generated landing page looks the same. Rounded cards. A
              purple-to-blue gradient. A centered hero. A &quot;Get
              Started&quot; button. It works. It also looks like everything
              else. This page is about how to escape that.
            </p>
          </header>

          <Section heading="The problem">
            <p>
              Tell any AI agent to build you a landing page and you already know
              what comes back: rounded cards, a purple-to-blue gradient, a
              centered hero, a Get Started button. The result is technically
              correct. It also looks like every other vibe-coded site on the
              internet.
            </p>
            <p>
              This is not the agent&apos;s fault. When it builds your page, it
              averages millions of pages it&apos;s seen during training. The
              average of millions of designs is a generic design.
            </p>
            <p>
              It has no clue why Vercel uses 1px borders instead of shadows. Why
              Linear keeps letter-spacing punishingly tight. Why Stripe picks
              one bright accent and uses it like it&apos;s rationed. Those
              decisions live in the brands&apos; heads not in the agent&apos;s
              training data.
            </p>
            <p className="text-white">
              So you&apos;re stuck with two bad options:
            </p>
            <ol className="list-decimal space-y-3 pl-6 marker:text-white/40">
              <li>
                Write a 40-line prompt every time{" "}
                <em className="text-white/90">
                  &quot;use #0070f3 for links, -0.02em letter-spacing on
                  headings, 8px corners, no drop shadows just hairline
                  borders…&quot;
                </em>{" "}
                and still get half wrong.
              </li>
              <li>
                Paste a screenshot and say{" "}
                <em className="text-white/90">
                  &quot;make it look like this.&quot;
                </em>{" "}
                The agent copies the pixels but misses the system underneath.
              </li>
            </ol>
            <p>Neither scales. Both burn hours.</p>
          </Section>

          <Section heading="What DESIGN.md is">
            <p>
              A plain-text file that describes your brand&apos;s visual
              language. The agent reads it before it writes any UI. The format
              was introduced by Google&apos;s design agent, Stitch.
            </p>
            <p>
              It sits in your repo root, next to the two files you already have:
            </p>
            <FileTable />
            <p>
              No Figma plugin. No JSON schema. No CLI. Just one markdown file
              the agent reads before it writes anything.
            </p>
          </Section>

          <Section heading="What's inside the file">
            <p>
              Every DESIGN.md has two layers. The first is YAML at the top of
              the file the exact values.
            </p>

            <CodeBlock filename="DESIGN.md" label="tokens">
              {YAML_EXAMPLE}
            </CodeBlock>

            <p>
              These are <em>tokens</em>. The agent uses them as precise
              references the primary blue is{" "}
              <code className="text-white">#0039ff</code>, not something close
              to it.
            </p>
            <p>
              The second layer is everything below the closing{" "}
              <code className="text-white">---</code> plain markdown, explaining
              what each token is for and when to use it.
            </p>

            <CodeBlock filename="DESIGN.md" label="prose">
              {PROSE_EXAMPLE}
            </CodeBlock>

            <p>
              The tokens give the agent{" "}
              <strong className="text-white">what</strong>. The prose gives it{" "}
              <strong className="text-white">why</strong>. Without the why, the
              agent has values but no instinct it can&apos;t make the right call
              when the file doesn&apos;t explicitly cover the situation.
            </p>
          </Section>

          <Section heading="What this changes">
            <p>
              A DESIGN.md is small. Maybe 200 lines of YAML and prose. The
              effect is disproportionate.
            </p>

            <div className="my-8 grid gap-px border border-white/10 bg-white/10 sm:grid-cols-2">
              {BENEFITS.map((b, i) => (
                <Benefit
                  key={b.title}
                  index={i + 1}
                  title={b.title}
                  body={b.body}
                />
              ))}
            </div>
          </Section>

          <Section heading="How you use it">
            <ol className="divide-y divide-white/15 border border-white/15">
              <Step
                index={1}
                title="Extract"
                body={
                  <>
                    Paste any public URL on the{" "}
                    <Link
                      href="/"
                      className="text-white underline underline-offset-4 hover:text-primary"
                    >
                      home page
                    </Link>
                    . We crawl the live site, read its colors, typography,
                    spacing, and component patterns, and write a DESIGN.md from
                    what&apos;s actually shipping. Try Stripe. Try Linear. Try a
                    competitor.
                  </>
                }
              />
              <Step
                index={2}
                title="Drop it in your repo"
                body={
                  <>
                    Save the file as{" "}
                    <code className="text-white">DESIGN.md</code> at the root of
                    your project, next to{" "}
                    <code className="text-white">README.md</code> and{" "}
                    <code className="text-white">AGENTS.md</code>. Commit it.
                    Treat it like code.
                  </>
                }
              />
              <Step
                index={3}
                title="Tell your agent"
                body={
                  <>
                    <em className="text-white/90">
                      &quot;Read DESIGN.md before you write any UI.&quot;
                    </em>{" "}
                    That&apos;s the entire instruction. From this point on,
                    every component the agent generates uses your tokens and
                    follows your rules.
                  </>
                }
              />
            </ol>
          </Section>

          <Section heading="The mental model">
            <p>
              You used to hire a designer and say{" "}
              <em className="text-white/90">
                &quot;you know Linear, right? Give me that feel.&quot;
              </em>{" "}
              It worked because the designer already carried Linear in their
              head. That shared context sat underneath every conversation.
            </p>
            <p>An AI agent doesn&apos;t have that shared context.</p>
            <p>
              DESIGN.md writes the context into a file and drops it into the
              agent&apos;s head. The reference pool you spent years building
              with a designer, you set up with an agent in two minutes.
            </p>
          </Section>

          <Section heading="What it isn't">
            <p>
              <strong className="text-white">Not a theme.</strong> There&apos;s
              no code inside. You or your agent still build the components. The
              file describes <em>what</em> a button looks like; the agent still
              has to write the JSX.
            </p>
            <p>
              <strong className="text-white">Not a brand PDF.</strong> Brand
              guidelines are written for humans and use phrases like
              &quot;approachable yet premium.&quot; An agent can&apos;t act on
              that. DESIGN.md has to be specific enough to drive the next
              decision exact hex values, exact font sizes.
            </p>
            <p>
              <strong className="text-white">Not a Figma export.</strong> A
              tokens.json export tells you the values but skips the reasoning.
              DESIGN.md is structured so the prose travels with the tokens.
            </p>
            <p>
              <strong className="text-white">Not static.</strong> When the brand
              evolves, the file evolves. It&apos;s versioned, reviewed, merged.
              It behaves like code, because it is.
            </p>
          </Section>

          <section className="mt-20 border border-white/15 bg-white/2 px-6 py-14 text-center sm:px-12 sm:py-16">
            <p className="mb-3 font-pixel text-xs uppercase tracking-widest text-white">
              start now
            </p>
            <h2 className="font-pixel text-2xl tracking-tight sm:text-4xl">
              Ready to stop being <span className="text-primary">generic</span>?
            </h2>
            <p className="mx-auto mt-5 max-w-md text-white/60">
              Paste any URL. Get a DESIGN.md back. Drop it in your repo. Watch
              the agent stop averaging.
            </p>
            <div className="mt-8 flex justify-center">
              <BubbleButton
                href="/"
                size="lg"
                icon={<ArrowLineIcon className="size-5" />}
              >
                TRY IT NOW
              </BubbleButton>
            </div>
          </section>

          <section
            aria-labelledby="disclaimer-heading"
            className="mt-12 text-sm leading-6 text-white/55"
          >
            <h2
              id="disclaimer-heading"
              className="mb-3 font-pixel text-xs uppercase tracking-widest text-white/70"
            >
              Disclaimer
            </h2>
            <p>
              The DESIGN.md files generated by this site are not official design
              systems from the listed brands. They are extracted starting points
              based on publicly observable design patterns. All trademarks,
              brand names, and design elements belong to their respective
              owners. These files document publicly observable design patterns
              for educational and development purposes only.
            </p>
          </section>
        </article>
      </main>

      <Footer />
    </>
  );
}

function Section({
  heading,
  children,
}: {
  heading: string;
  children: React.ReactNode;
}) {
  const id = heading.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  return (
    <section
      aria-labelledby={id}
      className="mb-20 space-y-5 text-base leading-7 text-white/70 sm:text-lg"
    >
      <h2
        id={id}
        className="mb-6 font-pixel text-2xl tracking-tight text-white sm:text-3xl"
      >
        {heading}
      </h2>
      {children}
    </section>
  );
}

function FileTable() {
  const rows = [
    {
      file: "README.md",
      reader: "Humans",
      tells: "what the project is",
      accent: false,
    },
    {
      file: "AGENTS.md",
      reader: "Coding agents",
      tells: "how to build it",
      accent: false,
    },
    {
      file: "DESIGN.md",
      reader: "Design agents",
      tells: "how it should look and feel",
      accent: true,
    },
  ];

  return (
    <div className="my-8 border border-white/15">
      <div className="grid grid-cols-[1fr_1fr_1.4fr] border-b border-white/15 bg-white/3 font-pixel text-xs uppercase tracking-widest text-white/55">
        <span className="border-r border-white/15 px-5 py-3">File</span>
        <span className="border-r border-white/15 px-5 py-3">Reader</span>
        <span className="px-5 py-3">Tells them</span>
      </div>
      {rows.map((row, i) => (
        <div
          key={row.file}
          className={`grid grid-cols-[1fr_1fr_1.4fr] text-sm ${
            i < rows.length - 1 ? "border-b border-white/10" : ""
          } ${row.accent ? "bg-primary/10" : ""}`}
        >
          <span
            className={`flex items-center border-r border-white/10 px-5 py-4 font-mono ${
              row.accent ? "text-white" : "text-white/80"
            }`}
          >
            {row.file}
          </span>
          <span
            className={`flex items-center border-r border-white/10 px-5 py-4 ${
              row.accent ? "text-white/90" : "text-white/65"
            }`}
          >
            {row.reader}
          </span>
          <span
            className={`flex items-center px-5 py-4 ${
              row.accent ? "text-white/90" : "text-white/65"
            }`}
          >
            {row.tells}
          </span>
        </div>
      ))}
    </div>
  );
}

function CodeBlock({
  filename,
  label,
  children,
}: {
  filename: string;
  label?: string;
  children: string;
}) {
  return (
    <div className="my-6 border border-white/15">
      <div className="flex items-center justify-between border-b border-white/15 bg-white/3 px-4 py-2.5">
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
            {filename}
          </span>
        </div>
        {label && (
          <span className="font-pixel text-xs uppercase tracking-widest text-primary">
            {label}
          </span>
        )}
      </div>
      <pre className="overflow-x-auto px-5 py-5 text-sm leading-relaxed text-white/85">
        <code>{children}</code>
      </pre>
    </div>
  );
}

function Benefit({
  index,
  title,
  body,
}: {
  index: number;
  title: string;
  body: string;
}) {
  return (
    <article className="bg-black p-6 transition-colors hover:bg-white/2">
      <div className="mb-4 flex items-center gap-3">
        <span className="font-pixel text-xs uppercase tracking-widest text-primary">
          {String(index).padStart(2, "0")}
        </span>
        <span aria-hidden="true" className="h-px flex-1 bg-white/10" />
      </div>
      <h3 className="font-pixel text-sm tracking-wide text-white">{title}</h3>
      <p className="mt-3 text-sm leading-6 text-white/60">{body}</p>
    </article>
  );
}

function Step({
  index,
  title,
  body,
}: {
  index: number;
  title: string;
  body: React.ReactNode;
}) {
  return (
    <li className="grid grid-cols-[64px_1fr] items-start gap-5 px-5 py-7 transition-colors hover:bg-white/2 sm:grid-cols-[120px_1fr] sm:gap-8 sm:px-8 sm:py-9">
      <div className="flex items-start">
        <span
          aria-hidden="true"
          className="font-pixel text-4xl tracking-tight text-primary sm:text-6xl"
        >
          {String(index).padStart(2, "0")}
        </span>
      </div>
      <div>
        <p className="font-pixel text-xs uppercase tracking-widest text-white/50">
          Step {String(index).padStart(2, "0")}
        </p>
        <h3 className="mt-2 font-pixel text-lg tracking-wide text-white sm:text-xl">
          {title}
        </h3>
        <p className="mt-3 text-base leading-7 text-white/70">{body}</p>
      </div>
    </li>
  );
}
