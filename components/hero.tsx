import { SiGoogle } from "@icons-pack/react-simple-icons";
import { ArrowIcon } from "@/icons/arrow";
import { HeroInteractive } from "./hero-interactive";

// Hero: the H1, tagline, and the URL-paste form that POSTs to /extract.
// One h1 per page lives here. The form submits as `GET /extract?url=…`,
// where the extract page reads useSearchParams and prefills its input.
export function Hero() {
  return (
    <HeroInteractive>
      <a
        href="https://stitch.withgoogle.com/docs/design-md/overview"
        target="_blank"
        rel="noopener noreferrer"
        className="absolute top-1/2 right-0 z-10 hidden -translate-y-1/2 items-center gap-1.5 bg-primary px-2 py-3 font-pixel text-[10px] tracking-widest text-white uppercase transition [writing-mode:vertical-rl] hover:brightness-110 sm:flex"
      >
        <span>Built on</span>
        <SiGoogle
          aria-hidden="true"
          focusable="false"
          className="size-3 shrink-0 rotate-90"
        />
        <span className="sr-only">Google</span>
        <span>DESIGN.md spec</span>
      </a>

      <p className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/15 px-3 py-1 text-xs text-white/70">
        <span aria-hidden="true" className="size-1.5 rounded-full bg-primary" />
        v1 · open source
      </p>

      <h1
        id="hero-heading"
        className="font-pixel text-6xl leading-[1.05] tracking-tight sm:text-8xl md:text-9xl"
      >
        design<span className="text-primary">.</span>md
      </h1>

      <p className="mt-8 max-w-xl text-base leading-7 text-white/70 sm:text-lg">
        Paste a URL. Get a DESIGN.md with colors, typography, spacing, and
        tokens ready for your AI agent to read.
      </p>

      <form
        action="/extract"
        method="GET"
        role="search"
        aria-label="Generate DESIGN.md from a URL"
        className="mt-10 flex w-full max-w-xl items-center gap-2 border border-white/20 px-2 py-2"
      >
        <label htmlFor="url" className="sr-only">
          Website URL
        </label>
        <input
          id="url"
          name="url"
          type="url"
          inputMode="url"
          required
          autoComplete="url"
          placeholder="paste any website URL e.g. stripe.com"
          className="min-w-0 flex-1 appearance-none bg-transparent px-3 py-2 text-sm text-white caret-white placeholder-white/30 outline-none focus:outline-none focus-visible:outline-none [-webkit-tap-highlight-color:transparent]"
        />
        <button
          type="submit"
          aria-label="Generate DESIGN.md"
          className="clip-btn shrink-0"
        >
          <span aria-hidden="true" className="clip-btn__shadow">
            GENERATE .md
          </span>
          <span className="clip-btn__face">GENERATE .md</span>
        </button>
      </form>
    </HeroInteractive>
  );
}
