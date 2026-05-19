"use client";

import { useEffect } from "react";

// Tab-blur "come back" pattern. The browser-tab title stays canonical
// (and SEO-safe) while the user is reading. Only when the tab loses focus
// do we swap in an attention-pull message — that's the moment the change
// is actually useful and least intrusive. When the user comes back, the
// original per-route title is restored.
//
// Why this shape and not a constant rotation:
//   • Screen readers don't announce title changes for *inactive* tabs.
//   • SEO sees the SSR <title> (untouched).
//   • Per-route titles ("Extract · design.md", "Why · design.md") survive
//     the blur/focus dance — we capture whatever title was visible at the
//     moment of blur and restore it byte-for-byte.
//   • Reduce-motion users get a single static message, no cycling.
//
// The emoji prefix gives the tab favicon-area a little visual pop in the
// user's tab strip when they glance over from another tab.

// Cute · funny · on-brand. Kept tight — every message ≤ 20 chars so narrow
// tabs don't truncate the emoji or the punch line. Rotation order matters:
// first message is the attention pull, last is the soft close.
const BLURRED_MESSAGES = [
  "👀  good UI waiting",
  "🤖  agent misses you",
  "🎨  paste a URL",
  "✨  ship the spec",
  "🥺  come back",
];

const ROTATION_MS = 3500;

export function DynamicTitle() {
  useEffect(() => {
    let titleAtBlur = "";
    let messageIndex = 0;
    let intervalId: ReturnType<typeof setInterval> | null = null;

    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    const tick = () => {
      document.title = BLURRED_MESSAGES[messageIndex];
      messageIndex = (messageIndex + 1) % BLURRED_MESSAGES.length;
    };

    const startBlurAnimation = () => {
      // Capture the live, route-specific title at the moment the user
      // tabs away — not whatever was set on initial mount.
      titleAtBlur = document.title;
      tick();
      // Reduce-motion users get the first message and nothing else.
      if (!reduceMotion) {
        intervalId = setInterval(tick, ROTATION_MS);
      }
    };

    const stopBlurAnimation = () => {
      if (intervalId !== null) {
        clearInterval(intervalId);
        intervalId = null;
      }
      if (titleAtBlur) {
        document.title = titleAtBlur;
        titleAtBlur = "";
        messageIndex = 0;
      }
    };

    const onVisibility = () => {
      if (document.hidden) {
        startBlurAnimation();
      } else {
        stopBlurAnimation();
      }
    };

    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      stopBlurAnimation();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return null;
}
