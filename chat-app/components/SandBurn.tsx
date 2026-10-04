"use client";

import { useEffect, useRef } from "react";
import {
  EDGE, MAX_GRAINS, SWEEP_MS, frontX, grainAlpha, spawnGrains, stepGrains, sweepProgress,
  type Box, type Grain,
} from "@/lib/sand";

/**
 * Burns the message it sits in. Drop it inside a `position: relative` message row and mark:
 *   data-burn-target  the part that should disintegrate (name, time and bubble)
 *   data-burn-bubble  the bubble itself (its colours become the sand)
 *
 * When `burning` turns true a soft-edged front sweeps across the target, wiping it away, and sheds
 * grains of sand in the bubble's colours that the wind blows off and gravity pulls down.
 * Calls `onDone` once the last grain has fallen. With reduced-motion preferences it just fades.
 */
export default function SandBurn({ burning, onDone, windDir = 1 }: { burning: boolean; onDone: () => void; windDir?: 1 | -1 }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const doneRef = useRef(onDone);

  useEffect(() => {
    doneRef.current = onDone;
  }, [onDone]);

  useEffect(() => {
    if (!burning) return;
    const canvas = canvasRef.current;
    const host = canvas?.parentElement;
    const target = host?.querySelector<HTMLElement>("[data-burn-target]") ?? null;
    const ctx = canvas?.getContext("2d") ?? null;

    // Nothing to animate (or an old browser): finish without fuss
    if (!canvas || !host || !target || !ctx) {
      const t = setTimeout(() => doneRef.current(), 0);
      return () => clearTimeout(t);
    }

    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      target.style.transition = "opacity 300ms ease";
      target.style.opacity = "0";
      const t = setTimeout(() => doneRef.current(), 320);
      return () => clearTimeout(t);
    }

    const hostRect = host.getBoundingClientRect();
    const tRect = target.getBoundingClientRect();
    const box: Box = { x: tRect.left - hostRect.left, y: tRect.top - hostRect.top, w: tRect.width, h: tRect.height };

    // Room below the row for the sand to fall into
    const cssW = hostRect.width;
    const cssH = hostRect.height + 60;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    canvas.style.width = `${cssW}px`;
    canvas.style.height = `${cssH}px`;
    ctx.scale(dpr, dpr);

    // The sand takes the bubble's own colours, so it suits both themes and both kinds of bubble
    const bubble = target.querySelector<HTMLElement>("[data-burn-bubble]") ?? target;
    const style = getComputedStyle(bubble);
    const solid = (c: string) => c && c !== "transparent" && c !== "rgba(0, 0, 0, 0)";
    const palette = [style.backgroundColor, style.backgroundColor, style.color, style.borderTopColor].filter(solid);
    if (palette.length === 0) palette.push(getComputedStyle(target).color);

    const density = Math.min(MAX_GRAINS * 0.9, Math.max(160, (box.w * box.h) / 16)); // grains over the whole sweep
    let grains: Grain[] = [];
    let lastTime = performance.now();
    const startTime = lastTime;
    let lastProgress = 0;
    let raf = 0;
    let finished = false;

    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - lastTime) / 1000);
      lastTime = now;
      const elapsed = now - startTime;
      const p = sweepProgress(elapsed);

      // The soft edge runs a little ahead of the erased part and clears the far side at p = 1
      const f = p * (1 + EDGE);
      const from = (f - EDGE) * 100;
      const to = f * 100;
      const mask = `linear-gradient(to ${windDir === 1 ? "right" : "left"}, transparent ${from}%, #000 ${to}%)`;
      target.style.maskImage = mask;
      target.style.webkitMaskImage = mask;

      const spawn = Math.round((p - lastProgress) * density);
      lastProgress = p;
      if (spawn > 0 && grains.length < MAX_GRAINS) {
        const front = frontX(box, Math.min(1, Math.max(0, f - EDGE / 2)), windDir);
        grains.push(...spawnGrains(box, front, spawn, windDir, palette.length));
      }
      grains = stepGrains(grains, dt, windDir);

      ctx.clearRect(0, 0, cssW, cssH);
      for (const g of grains) {
        // Fade grains out as they near the edge of the chat area instead of cutting them off
        const toEdge = windDir === 1 ? cssW - g.x : g.x;
        ctx.globalAlpha = grainAlpha(g) * Math.min(1, Math.max(0, toEdge / 80));
        ctx.fillStyle = palette[g.tone];
        ctx.fillRect(g.x, g.y, g.size, g.size);
      }
      ctx.globalAlpha = 1;

      if (elapsed >= SWEEP_MS && grains.length === 0) {
        if (!finished) {
          finished = true;
          doneRef.current();
        }
        return;
      }
      raf = requestAnimationFrame(frame);
    };

    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [burning, windDir]);

  // Zero-sized until a burn starts so it never affects layout or scrolling
  return <canvas aria-hidden className="pointer-events-none absolute left-0 top-0 z-30" ref={canvasRef} style={{ width: 0, height: 0 }} />;
}
