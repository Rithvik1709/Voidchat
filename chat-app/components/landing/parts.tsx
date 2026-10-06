"use client";

import { useRef, type ReactNode } from "react";
import { motion, useReducedMotion, useScroll, useTransform, type MotionValue } from "framer-motion";
import { LayoutGrid, Link2, MessageSquare, Settings, Shield, Timer, Users } from "lucide-react";

/* ------------------------------------------------------------------ */
/* Film grain over the whole page                                      */
/* ------------------------------------------------------------------ */

const GRAIN =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='220' height='220'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")";

export function Grain({ opacity = 0.07 }: { opacity?: number }) {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-[70] mix-blend-overlay"
      style={{ backgroundImage: GRAIN, opacity }}
    />
  );
}

/* ------------------------------------------------------------------ */
/* Device frame: a double bezel around an app window                   */
/* ------------------------------------------------------------------ */

const SIDEBAR = [MessageSquare, Link2, LayoutGrid, Users, Timer, Shield, Settings];

export function AppWindow({
  url,
  status = "Live",
  children,
  className = "",
  sidebar = false,
}: {
  url: string;
  status?: string;
  children: ReactNode;
  className?: string;
  sidebar?: boolean;
}) {
  return (
    <div
      className={`rounded-[2rem] border border-white/[0.14] bg-gradient-to-b from-white/[0.10] to-white/[0.03] p-2 shadow-[0_50px_140px_-40px_rgba(0,0,0,0.95),inset_0_1px_0_rgba(255,255,255,0.12)] ${className}`}
    >
      <div className="overflow-hidden rounded-[1.55rem] border border-black/60 bg-[#0c0c0d] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.05)]">
        <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-3.5">
          <div className="flex gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
          </div>
          <span className="truncate px-3 font-mono text-[10px] tracking-wide text-white/25">{url}</span>
          <span className="flex items-center gap-1.5 font-mono text-[10px] text-white/55">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399]" />
            {status}
          </span>
        </div>
        <div className="flex">
          {sidebar && (
            <div className="hidden w-16 shrink-0 flex-col items-center gap-5 border-r border-white/[0.06] bg-white/[0.015] py-5 sm:flex">
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-white text-sm font-bold text-black">n</span>
              {SIDEBAR.map((Icon, i) => (
                <Icon className={`h-4 w-4 ${i === 0 ? "text-white/80" : "text-white/30"}`} key={i} />
              ))}
            </div>
          )}
          <div className="min-w-0 flex-1">{children}</div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Handwritten annotation with a hand-drawn arrow                      */
/* ------------------------------------------------------------------ */

export function Note({
  children,
  className = "",
  color = "#f0a35e",
  arrow = "right",
}: {
  children: ReactNode;
  className?: string;
  color?: string;
  arrow?: "right" | "left";
}) {
  const arrowEl = (
    <svg className={arrow === "left" ? "-scale-x-100" : ""} fill="none" height="26" stroke={color} strokeLinecap="round" strokeWidth="1.6" viewBox="0 0 90 26" width="90">
      <path d="M2 8 C 26 0, 48 22, 84 13" />
      <path d="M74 6 L85 13 L73 19" />
    </svg>
  );
  return (
    <div
      className={`pointer-events-none absolute z-10 hidden -rotate-3 items-center gap-2 font-[family-name:var(--font-hand)] text-[1.7rem] lg:flex ${className}`}
      style={{ color }}
    >
      {arrow === "left" && arrowEl}
      <span className="whitespace-nowrap underline decoration-1 underline-offset-[10px]" style={{ textDecorationColor: `${color}66` }}>
        {children}
      </span>
      {arrow === "right" && arrowEl}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Section heading: two tones, like the rest of the page               */
/* ------------------------------------------------------------------ */

export function Heading({
  strong,
  soft,
  sub,
  align = "center",
  still = false,
}: {
  strong: string;
  soft: string;
  sub?: string;
  align?: "center" | "right" | "left";
  /** skip the word-by-word reveal (for headings a parent already animates) */
  still?: boolean;
}) {
  const a = align === "center" ? "text-center mx-auto" : align === "right" ? "text-right ml-auto" : "text-left";
  return (
    <div className={`max-w-3xl ${a}`}>
      <h2 className="text-[2.5rem] font-medium leading-[1.0] tracking-[-0.05em] text-white md:text-[4rem]">
        {still ? strong : <ScrollWords text={strong} />}
        <br />
        {still ? (
          <span className="bg-gradient-to-b from-white/55 to-white/30 bg-clip-text text-transparent">{soft}</span>
        ) : (
          <ScrollWords className="text-white/45" from={0.08} text={soft} />
        )}
      </h2>
      {sub && <p className="mt-5 text-base text-white/50 md:text-lg">{sub}</p>}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Scroll-linked motion                                                */
/* ------------------------------------------------------------------ */

function Word({ p, range, from, children }: { p: MotionValue<number>; range: [number, number]; from: number; children: string }) {
  const opacity = useTransform(p, range, [from, 1]);
  const y = useTransform(p, range, [8, 0]);
  return (
    <motion.span className="inline-block" style={{ opacity, y }}>
      {children}
    </motion.span>
  );
}

/** Words brighten one after another as the line scrolls up the screen. */
export function ScrollWords({ text, className = "", from = 0.15 }: { text: string; className?: string; from?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 0.92", "start 0.5"] });
  if (reduce) return <span className={className}>{text}</span>;
  const words = text.split(" ");
  return (
    <span className={className} ref={ref}>
      {words.map((w, i) => (
        <span key={i}>
          <Word from={from} p={scrollYProgress} range={[i / words.length, Math.min(1, (i + 1.6) / words.length)]}>
            {w}
          </Word>
          {i < words.length - 1 && " "}
        </span>
      ))}
    </span>
  );
}

/** Rises and tilts up into place, tied to scroll position rather than a timer. */
export function ScrollRise({ children, className = "", lag = 0 }: { children: ReactNode; className?: string; lag?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress: p } = useScroll({ target: ref, offset: ["start end", "start 0.62"] });
  const y = useTransform(p, [0, 1], [110 + lag * 70, 0]);
  const rotateX = useTransform(p, [0, 1], [16, 0]);
  const scale = useTransform(p, [0, 1], [0.92, 1]);
  const opacity = useTransform(p, [0, 0.55], [0, 1]);
  return (
    <div className={className} ref={ref} style={{ perspective: 1400 }}>
      <motion.div className="h-full" style={reduce ? undefined : { y, rotateX, scale, opacity, transformOrigin: "50% 100%" }}>
        {children}
      </motion.div>
    </div>
  );
}

function SandChar({ p, i, n, char }: { p: MotionValue<number>; i: number; n: number; char: string }) {
  // scrambled order so the line erodes from random spots instead of left to right
  const v = Math.sin(i * 91.7 + n) * 43758.5453;
  const order = +(v - Math.floor(v)).toFixed(3);
  const start = 0.46 + order * 0.2;
  const end = start + 0.12;
  const opacity = useTransform(p, [0.08, 0.28, start, end], [0, 1, 1, 0]);
  const y = useTransform(p, [start, end], [0, -18 - order * 26]);
  const x = useTransform(p, [start, end], [0, (order - 0.5) * 30]);
  const filter = useTransform(p, [start, end], ["blur(0px)", "blur(10px)"]);
  if (char === " ") return <span> </span>;
  return (
    <motion.span className="inline-block" style={{ opacity, y, x, filter }}>
      {char}
    </motion.span>
  );
}

/** Fades in, then dissolves letter by letter like sand as it scrolls away. */
export function VanishText({ text, className = "" }: { text: string; className?: string }) {
  const ref = useRef<HTMLHeadingElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  if (reduce) return <h2 className={className}>{text}</h2>;
  return (
    <h2 aria-label={text} className={className} ref={ref}>
      {text.split("").map((c, i) => (
        <SandChar char={c} i={i} key={i} n={text.length} p={scrollYProgress} />
      ))}
    </h2>
  );
}

/* ------------------------------------------------------------------ */
/* Backdrops                                                           */
/* ------------------------------------------------------------------ */

export function Rings({ at = "50% 100%" }: { at?: string }) {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0"
      style={{
        backgroundImage: `repeating-radial-gradient(circle at ${at}, transparent 0 120px, rgba(255,255,255,0.05) 121px 122px)`,
        maskImage: "radial-gradient(ellipse at 50% 60%, black 20%, transparent 75%)",
        WebkitMaskImage: "radial-gradient(ellipse at 50% 60%, black 20%, transparent 75%)",
      }}
    />
  );
}

/** Soft studio light falling across a dark section. */
export function Spot({ className = "" }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={`pointer-events-none absolute inset-0 ${className}`}
      style={{
        background:
          "radial-gradient(60% 50% at 15% 35%, rgba(255,255,255,0.075), transparent 70%), radial-gradient(50% 40% at 85% 75%, rgba(255,255,255,0.035), transparent 70%)",
      }}
    />
  );
}

/** Diagonal hatching used as a quiet decoration at card edges. */
export function Hatch({ className = "" }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={`pointer-events-none absolute ${className}`}
      style={{
        backgroundImage: "repeating-linear-gradient(135deg, rgba(255,255,255,0.11) 0 1px, transparent 1px 7px)",
        maskImage: "linear-gradient(to bottom, transparent, black 30%, black 70%, transparent)",
        WebkitMaskImage: "linear-gradient(to bottom, transparent, black 30%, black 70%, transparent)",
      }}
    />
  );
}

/** A bundle of flowing threads, like a long exposure of the conversation. */
export function Threads({ className = "", progress }: { className?: string; progress?: MotionValue<number> }) {
  const lines = Array.from({ length: 42 }, (_, i) => {
    const k = i / 41;
    const amp = 70 + 120 * Math.sin(k * Math.PI);
    const phase = k * 1.6;
    const pts: string[] = [];
    for (let x = 0; x <= 1200; x += 20) {
      const t = x / 1200;
      const y = 260 + Math.sin(t * Math.PI * 2.2 + phase) * amp * (0.35 + t * 0.9) - (t - 0.5) * 120;
      pts.push(`${x},${y.toFixed(1)}`);
    }
    // rounded so the server and browser render identical attributes
    return { d: `M${pts.join(" L")}`, o: +(0.05 + 0.18 * Math.sin(k * Math.PI)).toFixed(3) };
  });
  return (
    <svg aria-hidden className={`pointer-events-none absolute ${className}`} fill="none" preserveAspectRatio="none" viewBox="0 0 1200 520">
      <defs>
        <linearGradient id="thread-fade" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor="#fff" stopOpacity="0" />
          <stop offset="0.35" stopColor="#fff" stopOpacity="1" />
          <stop offset="1" stopColor="#fff" stopOpacity="0.2" />
        </linearGradient>
      </defs>
      {lines.map((l, i) => (
        <motion.path d={l.d} key={i} stroke="url(#thread-fade)" strokeOpacity={l.o} strokeWidth="0.8" style={progress ? { pathLength: progress } : undefined} />
      ))}
    </svg>
  );
}

/** Sparse, slowly twinkling stars. Positions are fixed so server and client agree. */
export function Stars({ count = 70 }: { count?: number }) {
  const stars = Array.from({ length: count }, (_, i) => {
    const r = (n: number) => {
      const v = Math.sin(i * 127.1 + n * 311.7) * 43758.5453;
      return +(v - Math.floor(v)).toFixed(4);
    };
    return { x: +(r(1) * 100).toFixed(2), y: +(r(2) * 100).toFixed(2), s: r(3) > 0.85 ? 2 : 1, d: +(r(4) * 6).toFixed(2), o: +(0.2 + r(5) * 0.6).toFixed(2) };
  });
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0">
      {stars.map((s, i) => (
        <span
          className="absolute animate-pulse rounded-full bg-white"
          key={i}
          style={{ left: `${s.x}%`, top: `${s.y}%`, width: s.s, height: s.s, opacity: s.o, animationDelay: `${s.d}s`, animationDuration: "4s" }}
        />
      ))}
    </div>
  );
}
