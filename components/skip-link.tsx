// Shared skip-to-content anchor. `sr-only` keeps it invisible until it
// gets keyboard focus, at which point it pops to the top-left corner in
// the pixel-font pill style that matches the rest of the brand. Targets
// `#main`  every page that uses this should have a `<main id="main">`.
export function SkipLink() {
  return (
    <a
      href="#main"
      className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-100 focus:bg-primary focus:px-3 focus:py-1.5 focus:font-pixel focus:text-[10px] focus:tracking-widest focus:text-white focus:uppercase"
    >
      Skip to content
    </a>
  );
}
