"use client";

import { useEffect, useRef } from "react";

type DigitRainProps = {
  fontSize?: number;
  speed?: number;
  intensity?: number;
  hoverRadius?: number;
  hoverBoost?: number;
  pushStrength?: number;
  rippleDuration?: number;
  rippleSpeed?: number;
  rippleThickness?: number;
  ripplePush?: number;
  accentColor?: [number, number, number];
};

type Ripple = { x: number; y: number; t0: number };

export function DigitRain({
  fontSize = 11,
  speed = 0.01,
  intensity = 0.85,
  hoverRadius = 180,
  hoverBoost = 1.1,
  pushStrength = 28,
  rippleDuration = 1.5,
  rippleSpeed = 360,
  rippleThickness = 40,
  ripplePush = 18,
  accentColor = [0, 57, 255],
}: DigitRainProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef = useRef({ x: -9999, y: -9999, active: false });
  const ripplesRef = useRef<Ripple[]>([]);

  // Destructure the array prop into primitives BEFORE the effect so the
  // deps array sees stable values. Otherwise the default `[0, 57, 255]`
  // gets a new reference every render → effect re-runs every parent
  // render → animation restarts continuously.
  const [aR, aG, aB] = accentColor;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    let t = 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    const resize = () => {
      const w = canvas.offsetWidth;
      const h = canvas.offsetHeight;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const draw = () => {
      const w = canvas.offsetWidth;
      const h = canvas.offsetHeight;
      const now = performance.now();

      ctx.clearRect(0, 0, w, h);

      ctx.font = `${fontSize}px ui-monospace, SFMono-Regular, Menlo, monospace`;
      ctx.textBaseline = "top";

      const cols = Math.ceil(w / fontSize);
      const rows = Math.ceil(h / fontSize);
      const m = mouseRef.current;

      ripplesRef.current = ripplesRef.current.filter(
        (r) => (now - r.t0) / 1000 < rippleDuration,
      );
      const ripples = ripplesRef.current;

      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          const n =
            Math.sin(x * 0.07 + t * 0.5) * Math.cos(y * 0.09 + t * 0.3) +
            Math.sin((x + y * 0.5) * 0.05 + t * 0.2) +
            Math.sin(x * 0.13 - y * 0.08 + t * 0.7);
          const vBase = (n + 3) / 6;
          let vInteract = 0;

          const baseX = x * fontSize;
          const baseY = y * fontSize;
          let drawX = baseX;
          let drawY = baseY;

          if (m.active) {
            const dx = baseX - m.x;
            const dy = baseY - m.y;
            const d = Math.hypot(dx, dy);
            if (d < hoverRadius && d > 0.001) {
              const proximity = 1 - d / hoverRadius;
              const falloff = proximity * proximity;
              vInteract += proximity * hoverBoost;
              const force = falloff * pushStrength;
              drawX += (dx / d) * force;
              drawY += (dy / d) * force;
            }
          }

          for (let i = 0; i < ripples.length; i++) {
            const r = ripples[i];
            const age = (now - r.t0) / 1000;
            const radius = age * rippleSpeed;
            const dx = baseX - r.x;
            const dy = baseY - r.y;
            const dCenter = Math.hypot(dx, dy);
            const dr = Math.abs(dCenter - radius);
            if (dr < rippleThickness && dCenter > 0.001) {
              const wave = 1 - dr / rippleThickness;
              const fade = 1 - age / rippleDuration;
              vInteract += wave * fade * 1.5;
              const push = wave * fade * ripplePush;
              drawX += (dx / dCenter) * push;
              drawY += (dy / dCenter) * push;
            }
          }

          const v = vBase + vInteract;

          if (v > 0.3) {
            const digit = Math.floor(v * 10) % 10;
            const opacity = Math.min(v * 1.2, 1) * intensity;
            const blend = Math.min(vInteract / 1.2, 1);
            const r = Math.round(255 + (aR - 255) * blend);
            const g = Math.round(255 + (aG - 255) * blend);
            const b = Math.round(255 + (aB - 255) * blend);
            ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${opacity})`;
            ctx.fillText(digit.toString(), drawX, drawY);
          }
        }
      }

      if (!reduceMotion) t += speed;
      raf = requestAnimationFrame(draw);
    };

    const onMove = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouseRef.current.x = e.clientX - rect.left;
      mouseRef.current.y = e.clientY - rect.top;
      mouseRef.current.active = true;
    };
    const onLeave = () => {
      mouseRef.current.active = false;
    };
    const onClick = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      ripplesRef.current.push({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
        t0: performance.now(),
      });
    };

    resize();
    window.addEventListener("resize", resize);
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerleave", onLeave);
    canvas.addEventListener("pointerdown", onClick);
    draw();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerleave", onLeave);
      canvas.removeEventListener("pointerdown", onClick);
    };
  }, [
    fontSize,
    speed,
    intensity,
    hoverRadius,
    hoverBoost,
    pushStrength,
    rippleDuration,
    rippleSpeed,
    rippleThickness,
    ripplePush,
    aR,
    aG,
    aB,
  ]);

  return (
    <canvas
      ref={canvasRef}
      className="block h-full w-full cursor-crosshair touch-none"
      aria-hidden="true"
    />
  );
}
