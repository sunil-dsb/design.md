import type { SVGProps } from "react";

// Diagonal arrow pointer (originally pointing to the bottom-right; we flip
// it horizontally via the inner <g> matrix so the visible direction is
// top-right same orientation as the source SVG with its outer
// `transform="matrix(-1,0,0,1,0,0)"`). `fill="currentColor"` means the icon
// picks up whatever CSS `color` is on its container so the bubble-btn's
// `color: #ffffff` paints it white automatically.
export function ArrowIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 200.981 200.981"
      fill="currentColor"
      aria-hidden
      {...props}
    >
      <g transform="matrix(-1 0 0 1 200.981 0)">
        <polygon points="17.511,10.264 129.068,10.264 129.068,0 0.007,0 0.007,129.068 10.257,129.068 10.271,17.515 193.72,200.981 200.974,193.727" />
      </g>
    </svg>
  );
}
