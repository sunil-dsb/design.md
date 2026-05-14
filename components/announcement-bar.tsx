// Site-wide promo bar that sits ABOVE the navbar on every secondary page
// (extract, why, etc.). Intentionally omitted from the home page (the hero
// is the welcome surface) and the 404 page (no extra noise on errors).
//
// The whole bar is one anchor link to the promoted product, so any click
// inside it navigates  keyboard-accessible by default (Tab → Enter).
//
// Background animation is a thinner cousin of the footer's mesh-gradient:
// three blue blobs animated under the bar height, blurred + overflow-clipped
// to read as motion at the bar's top edge without being noisy text-side.
export function AnnouncementBar() {
  return (
    <a
      href="https://www.makemyaisite.com"
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Make My AI Site  drop your LinkedIn or resume, get a beautiful animated portfolio site in 20 seconds"
      className="announce-bar group relative block w-full overflow-hidden bg-black"
    >
      <div
        aria-hidden="true"
        className="announce-scene pointer-events-none absolute inset-0"
      >
        <span className="announce-blob announce-blob--1" />
        <span className="announce-blob announce-blob--2" />
        <span className="announce-blob announce-blob--3" />
      </div>

      <div className="relative mx-auto flex w-full max-w-6xl items-center justify-center gap-2 px-4 py-2.5 text-center font-pixel text-[10px] uppercase tracking-widest text-white sm:text-xs">
        <span className="hidden sm:inline">
          Drop your LinkedIn or resume, get a beautiful animated portfolio site
          in 20 sec.
        </span>
        <span className="sm:hidden">
          Portfolio site from your LinkedIn · 20s
        </span>
        <span
          aria-hidden="true"
          className="inline-block transition-transform duration-300 group-hover:translate-x-1"
        >
          →
        </span>
      </div>
    </a>
  );
}
