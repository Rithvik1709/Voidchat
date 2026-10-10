"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Flame } from "lucide-react";

const NOTES = [
  ["meet at the north gate, 9pm.", "bring nothing. tell no one."],
  ["the doc is in the room.", "grab it before it's gone."],
  ["you were right about friday.", "let's never speak of it."],
];

type Mode = "typing" | "hold" | "burning" | "ash";
type Particle = { x: number; y: number; at: number; vx: number; vy: number; s: number };

const BURN_SECONDS = 1.9;
const H = 210;

/** Smooth 1D noise in [0, 1] built from a few random sine waves. */
function makeNoise() {
  const waves = Array.from({ length: 4 }, (_, i) => ({ f: 0.006 * (i + 1) * (1 + Math.random()), p: Math.random() * 10, a: 1 / (i + 1) }));
  const total = waves.reduce((t, w) => t + w.a, 0);
  return (x: number) => 0.5 + waves.reduce((t, w) => t + Math.sin(x * w.f + w.p) * w.a, 0) / (2 * total);
}

/**
 * A note that types itself, waits, then burns from the bottom up:
 * a ragged ember edge climbs the paper and the letters break into
 * sparks and ash. Loops through a few notes; you can burn it early.
 */
export default function BurnNote() {
  const reduce = useReducedMotion();
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fontRef = useRef<HTMLSpanElement>(null);
  const burnNow = useRef(false);
  const [mode, setMode] = useState<Mode>("typing");

  useEffect(() => {
    if (reduce) return;
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!wrap || !canvas || !ctx) return;

    let raf = 0;
    let visible = true;
    let W = 0;
    let fontPx = 32;
    let family = "serif";
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const st = { mode: "typing" as Mode, t0: performance.now(), note: 0, noise: makeNoise(), parts: [] as Particle[], paused: 0 };

    const setModeBoth = (m: Mode) => {
      st.mode = m;
      st.t0 = performance.now();
      setMode(m);
    };

    const size = () => {
      W = wrap.clientWidth;
      canvas.width = W * dpr;
      canvas.height = H * dpr;
      canvas.style.width = "100%";
      canvas.style.height = `${H}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      fontPx = Math.max(22, Math.min(38, W / 13));
    };

    const lines = () => NOTES[st.note % NOTES.length];
    const lineY = (i: number) => 58 + i * (fontPx * 1.55);
    const font = () => `italic ${fontPx}px ${family}`;

    const drawText = (chars: number) => {
      ctx.fillStyle = "#171412";
      ctx.font = font();
      ctx.textBaseline = "alphabetic";
      let left = chars;
      lines().forEach((ln, i) => {
        if (left <= 0) return;
        ctx.fillText(ln.slice(0, left), 28, lineY(i));
        left -= ln.length;
      });
    };

    const sampleParticles = () => {
      const off = document.createElement("canvas");
      off.width = W;
      off.height = H;
      const o = off.getContext("2d");
      if (!o) return [];
      o.fillStyle = "#000";
      o.font = font();
      lines().forEach((ln, i) => o.fillText(ln, 28, lineY(i)));
      const data = o.getImageData(0, 0, W, H).data;
      const out: Particle[] = [];
      for (let y = 0; y < H; y += 2) {
        for (let x = 0; x < W; x += 2) {
          if (data[(y * W + x) * 4 + 3] > 110) {
            out.push({
              x,
              y,
              at: 1 - y / H + 0.28 * st.noise(x),
              vx: (Math.random() - 0.5) * 22,
              vy: -(18 + Math.random() * 46),
              s: 1.2 + Math.random() * 1.3,
            });
          }
        }
      }
      return out;
    };

    // the edge of what has burned: y above which the paper is still intact
    const edgeY = (x: number, front: number) => H * (1 - front + 0.28 * st.noise(x));

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      if (!visible) {
        st.paused = now;
        return;
      }
      if (st.paused) {
        st.t0 += now - st.paused;
        st.paused = 0;
      }
      const t = (now - st.t0) / 1000;
      ctx.clearRect(0, 0, W, H);
      const total = lines().join("").length;

      if (st.mode === "typing") {
        const n = Math.floor(t / 0.055);
        drawText(n);
        // caret
        if (Math.floor(t * 2) % 2 === 0 || n < total) {
          ctx.fillStyle = "#ff5b1f";
          const li = lines();
          let left = Math.min(n, total);
          let row = 0;
          while (row < li.length - 1 && left > li[row].length) {
            left -= li[row].length;
            row += 1;
          }
          ctx.font = font();
          const w = ctx.measureText(li[row].slice(0, left)).width;
          ctx.fillRect(28 + w + 3, lineY(row) - fontPx * 0.8, 2, fontPx * 0.95);
        }
        if (n >= total + 6) setModeBoth("hold");
      } else if (st.mode === "hold") {
        drawText(total);
        if (t > 2.2 || burnNow.current) {
          burnNow.current = false;
          st.noise = makeNoise();
          st.parts = sampleParticles();
          setModeBoth("burning");
        }
      } else if (st.mode === "burning") {
        const front = Math.min(t / BURN_SECONDS, 1.4);
        // intact paper: crisp text clipped above the ragged edge
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(W, 0);
        for (let x = W; x >= 0; x -= 6) ctx.lineTo(x, edgeY(x, front));
        ctx.closePath();
        ctx.clip();
        drawText(total);
        ctx.restore();

        // glowing edge
        ctx.save();
        ctx.beginPath();
        for (let x = 0; x <= W; x += 6) {
          const y = edgeY(x, front);
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.shadowColor = "#ff5b1f";
        ctx.shadowBlur = 14;
        ctx.strokeStyle = "rgba(255,91,31,0.95)";
        ctx.lineWidth = 3;
        ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.strokeStyle = "rgba(255,226,160,0.9)";
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.restore();

        // sparks and ash
        let alive = 0;
        for (const p of st.parts) {
          if (front < p.at) continue;
          const age = (front - p.at) * BURN_SECONDS;
          if (age > 1.3) continue;
          alive += 1;
          const px = p.x + p.vx * age + Math.sin(age * 6 + p.x) * 3;
          const py = p.y + p.vy * age - 30 * age * age;
          const a = 1 - age / 1.3;
          ctx.fillStyle = age < 0.08 ? `rgba(255,240,190,${a})` : age < 0.45 ? `rgba(255,91,31,${a})` : `rgba(110,100,92,${a * 0.8})`;
          ctx.fillRect(px, py, p.s, p.s);
        }
        if (front >= 1.4 && alive === 0) setModeBoth("ash");
      } else if (st.mode === "ash" && t > 1.6) {
        st.note += 1;
        setModeBoth("typing");
      }
    };

    const start = async () => {
      if (fontRef.current) family = getComputedStyle(fontRef.current).fontFamily;
      try {
        await document.fonts.ready;
      } catch {
        // fall back to whatever face is available
      }
      size();
      st.t0 = performance.now();
      raf = requestAnimationFrame(frame);
    };
    start();

    const io = new IntersectionObserver(([e]) => (visible = e.isIntersecting));
    io.observe(wrap);
    const onResize = () => {
      size();
      if (st.mode === "burning") setModeBoth("ash");
    };
    window.addEventListener("resize", onResize);
    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      window.removeEventListener("resize", onResize);
    };
  }, [reduce]);

  return (
    <div className="relative min-w-0">
      {/* paper note */}
      <div className="relative rotate-[-1.5deg] rounded-[6px] bg-[#fbf8f2] shadow-[0_1px_0_rgba(0,0,0,0.04),0_30px_60px_-30px_rgba(60,40,20,0.45),0_10px_20px_-12px_rgba(60,40,20,0.25)]">
        <div className="flex items-center justify-between border-b border-[#171412]/10 px-6 py-3 font-mono text-[10px] uppercase tracking-[0.18em] text-[#171412]/50">
          <span>room/void-7x2k</span>
          <span className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#ff5b1f]" />
            burn mode · 5s
          </span>
        </div>
        <div
          className="relative"
          ref={wrapRef}
          style={{ backgroundImage: "repeating-linear-gradient(to bottom, transparent 0 51px, rgba(23,20,18,0.08) 51px 52px)", backgroundPosition: "0 18px" }}
        >
          <span aria-hidden className="pointer-events-none absolute font-[family-name:var(--font-serif)] opacity-0" ref={fontRef}>
            .
          </span>
          {reduce ? (
            <p className="px-7 py-10 font-[family-name:var(--font-serif)] text-3xl italic leading-[1.55] text-[#171412]">
              {NOTES[0][0]}
              <br />
              {NOTES[0][1]}
            </p>
          ) : (
            <canvas aria-label="A note that burns away after it is read" className="block w-full" ref={canvasRef} role="img" style={{ height: H }} />
          )}
          <AnimatePresence>
            {mode === "ash" && (
              <motion.div
                animate={{ opacity: 1, y: 0 }}
                className="absolute inset-0 grid place-items-center font-mono text-[11px] uppercase tracking-[0.2em] text-[#171412]/45"
                exit={{ opacity: 0 }}
                initial={{ opacity: 0, y: 6 }}
              >
                burned · 0 bytes kept
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {!reduce && (
        <button
          className="group absolute -bottom-5 right-6 flex items-center gap-2 rounded-full bg-[#171412] px-4 py-2 font-mono text-[11px] uppercase tracking-[0.16em] text-[#f1ece3] shadow-[0_10px_24px_-10px_rgba(0,0,0,0.6)] transition-transform hover:-translate-y-0.5 disabled:opacity-40"
          disabled={mode !== "hold" && mode !== "typing"}
          onClick={() => {
            burnNow.current = true;
          }}
          type="button"
        >
          <Flame className="h-3.5 w-3.5 text-[#ff5b1f] transition-transform group-hover:scale-125" />
          burn it now
        </button>
      )}
    </div>
  );
}
