import type { SVGProps } from "react";

// Noto Emoji eyes (👀). Used to replace "oo" in the /why hero heading.
// The original export had two identical pupil gradients with auto-generated
// IDs (iconify quirk). Merged into one shared <linearGradient> with a
// static id  both pupils reference the same fill so the icon is safe to
// render multiple times on the same page without id collisions.
//
// `aria-hidden` is set by default: when this is used to substitute for
// letters inside a word, the surrounding markup should add a paired
// `sr-only` span with the full readable word for screen readers.
export function EyesIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 128 128" aria-hidden role="img" {...props}>
      <defs>
        <linearGradient
          id="eyes-pupil-gradient"
          gradientUnits="userSpaceOnUse"
          x1="0"
          y1="46.676"
          x2="0"
          y2="82.083"
        >
          <stop offset="0" stopColor="#424242" />
          <stop offset="1" stopColor="#212121" />
        </linearGradient>
      </defs>

      {/* Left eye */}
      <path
        d="M34.16 106.51C18.73 106.51 6.19 87.44 6.19 64c0-23.44 12.55-42.51 27.97-42.51c15.42 0 27.97 19.07 27.97 42.51c0 23.44-12.55 42.51-27.97 42.51z"
        fill="#fafafa"
      />
      <path
        d="M34.16 23.49c6.63 0 12.98 4 17.87 11.27c5.22 7.75 8.1 18.14 8.1 29.24s-2.88 21.49-8.1 29.24c-4.89 7.27-11.24 11.27-17.87 11.27s-12.98-4-17.87-11.27C11.06 85.49 8.19 75.1 8.19 64s2.88-21.49 8.1-29.24c4.89-7.27 11.23-11.27 17.87-11.27m0-4C17.61 19.49 4.19 39.42 4.19 64s13.42 44.51 29.97 44.51S64.13 88.58 64.13 64S50.71 19.49 34.16 19.49z"
        fill="#b0bec5"
      />
      <path
        d="M25.63 59.84c-2.7-2.54-2.1-7.58 1.36-11.26c.18-.19.36-.37.55-.54c-1.54-.87-3.23-1.36-5.01-1.36c-7.19 0-13.02 7.93-13.02 17.7s5.83 17.7 13.02 17.7s13.02-7.93 13.02-17.7c0-1.75-.19-3.45-.54-5.05c-3.24 2.33-7.11 2.64-9.38.51z"
        fill="url(#eyes-pupil-gradient)"
      />

      {/* Right eye */}
      <ellipse cx="93.84" cy="64" rx="29.97" ry="44.51" fill="#eee" />
      <path
        d="M93.84 106.51c-15.42 0-27.97-19.07-27.97-42.51c0-23.44 12.55-42.51 27.97-42.51c15.42 0 27.97 19.07 27.97 42.51c0 23.44-12.54 42.51-27.97 42.51z"
        fill="#fafafa"
      />
      <path
        d="M93.84 23.49c6.63 0 12.98 4 17.87 11.27c5.22 7.75 8.1 18.14 8.1 29.24s-2.88 21.49-8.1 29.24c-4.89 7.27-11.24 11.27-17.87 11.27s-12.98-4-17.87-11.27c-5.22-7.75-8.1-18.14-8.1-29.24s2.88-21.49 8.1-29.24c4.89-7.27 11.24-11.27 17.87-11.27m0-4c-16.55 0-29.97 19.93-29.97 44.51s13.42 44.51 29.97 44.51S123.81 88.58 123.81 64s-13.42-44.51-29.97-44.51z"
        fill="#b0bec5"
      />
      <path
        d="M85.31 59.84c-2.7-2.54-2.1-7.58 1.36-11.26c.18-.19.36-.37.55-.54c-1.54-.87-3.23-1.36-5.01-1.36c-7.19 0-13.02 7.93-13.02 17.7s5.83 17.7 13.02 17.7c7.19 0 13.02-7.93 13.02-17.7c0-1.75-.19-3.45-.54-5.05c-3.23 2.33-7.11 2.64-9.38.51z"
        fill="url(#eyes-pupil-gradient)"
      />
    </svg>
  );
}
