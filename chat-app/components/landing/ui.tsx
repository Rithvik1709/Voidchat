"use client";

import { useEffect, useRef, useState, type MouseEvent, type ReactNode } from "react";
import Lenis from "lenis";
import "lenis/dist/lenis.css";
import {
  motion,
  useAnimationFrame,
  useInView,
  useMotionValue,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
  useVelocity,
  type MotionValue,
} from "framer-motion";

/** Palette: warm paper, soft ink, one ember accent. */
export const PAPER = "#f1ece3";
export const INK = "#171412";
export const EMBER = "#ff5b1f";

export const ease = [0.2, 0.7, 0.2, 1] as const;

/* ------------------------------------------------------------------ */
/* Texture                                                             */
/* ------------------------------------------------------------------ */

const NOISE =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='240' height='240'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")";

/** Paper fibre over everything. */
export function PaperGrain() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-[80] opacity-[0.13] mix-blend-multiply"
      style={{ backgroundImage: NOISE }}
    />
  );
}

/* ------------------------------------------------------------------ */
/* Type                                                                */
/* ------------------------------------------------------------------ */

/** Small mono label like "(02) How it works". */
export function Kicker({ n, children, dark = false }: { n?: string; children: ReactNode; dark?: boolean }) {
  return (
    <div className={`flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.2em] ${dark ? "text-[#f1ece3]/55" : "text-[#171412]/55"}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-[#ff5b1f]" />
      {n && <span>({n})</span>}
      <span>{typeof children === "string" ? <Decode text={children} /> : children}</span>
    </div>
  );
}

const GLYPHS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ#%&*+=/<>";

/** Text that resolves out of random glyphs, left to right, when it scrolls into view. */
export function Decode({ text }: { text: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-5% 0px" });
  const reduce = useReducedMotion();
  const [out, setOut] = useState(text);
  useEffect(() => {
    if (!inView || reduce) return;
    let frame = 0;
    const total = text.length + 8;
    const id = setInterval(() => {
      frame += 1;
      setOut(
        text
          .split("")
          .map((c, i) => (c === " " || i < frame - 6 ? c : GLYPHS[Math.floor(Math.random() * GLYPHS.length)]))
          .join(""),
      );
      if (frame >= total) {
        clearInterval(id);
        setOut(text);
      }
    }, 38);
    return () => clearInterval(id);
  }, [inView, reduce, text]);
  return (
    <span aria-label={text} ref={ref}>
      {out}
    </span>
  );
}

/** Words rise out of a mask when they scroll into view. */
export function RiseWords({ text, className = "", delay = 0, once = true }: { text: string; className?: string; delay?: number; once?: boolean }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once, margin: "-10% 0px" });
  const reduce = useReducedMotion();
  if (reduce) return <span className={className}>{text}</span>;
  const words = text.split(" ");
  return (
    <span className={className} ref={ref}>
      {words.map((w, i) => (
        <span key={i}>
          <span className="inline-block overflow-hidden pb-[0.14em] align-bottom">
            <motion.span
              animate={inView ? { y: "0%" } : { y: "105%" }}
              className="inline-block"
              initial={{ y: "105%" }}
              transition={{ duration: 0.85, delay: delay + i * 0.07, ease }}
            >
              {w}
            </motion.span>
          </span>
          {i < words.length - 1 && " "}
        </span>
      ))}
    </span>
  );
}

function InkWord({ p, range, children }: { p: MotionValue<number>; range: [number, number]; children: string }) {
  const opacity = useTransform(p, range, [0.14, 1]);
  return <motion.span style={{ opacity }}>{children}</motion.span>;
}

/** Paragraph that inks in word by word as you read down the page. */
export function InkParagraph({ text, className = "" }: { text: string; className?: string }) {
  const ref = useRef<HTMLParagraphElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 0.85", "end 0.45"] });
  if (reduce) return <p className={className}>{text}</p>;
  const words = text.split(" ");
  return (
    <p className={className} ref={ref}>
      {words.map((w, i) => (
        <span key={i}>
          <InkWord p={scrollYProgress} range={[i / words.length, (i + 1) / words.length]}>
            {w}
          </InkWord>{" "}
        </span>
      ))}
    </p>
  );
}

/* ------------------------------------------------------------------ */
/* Motion helpers                                                      */
/* ------------------------------------------------------------------ */

/** A ticker whose speed and direction follow how fast you scroll. */
export function VelocityMarquee({ children, base = 2.2, className = "" }: { children: ReactNode; base?: number; className?: string }) {
  const reduce = useReducedMotion();
  const x = useMotionValue(0);
  const { scrollY } = useScroll();
  const velocity = useSpring(useVelocity(scrollY), { damping: 50, stiffness: 400 });
  const boost = useTransform(velocity, [-1500, 0, 1500], [-5, 0, 5], { clamp: false });
  const skew = useTransform(velocity, [-2000, 2000], [8, -8]);
  const dir = useRef(1);
  useAnimationFrame((_, delta) => {
    if (reduce) return;
    const b = boost.get();
    if (b < -0.05) dir.current = -1;
    else if (b > 0.05) dir.current = 1;
    let next = x.get() - dir.current * base * (delta / 1000) * (1 + Math.abs(b));
    // the strip is two identical halves, so wrap at half its width
    if (next <= -50) next += 50;
    if (next > 0) next -= 50;
    x.set(next);
  });
  const tx = useTransform(x, (v) => `${v}%`);
  return (
    <div className={`overflow-hidden ${className}`}>
      <motion.div className="flex w-max whitespace-nowrap" style={reduce ? undefined : { x: tx, skewX: skew }}>
        <div className="flex shrink-0">{children}</div>
        <div aria-hidden className="flex shrink-0">
          {children}
        </div>
      </motion.div>
    </div>
  );
}

/** Leans toward the cursor while it hovers, then springs back. */
export function Magnetic({ children, strength = 0.3 }: { children: ReactNode; strength?: number }) {
  const reduce = useReducedMotion();
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const sx = useSpring(x, { stiffness: 240, damping: 15, mass: 0.4 });
  const sy = useSpring(y, { stiffness: 240, damping: 15, mass: 0.4 });
  const move = (e: MouseEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    x.set((e.clientX - r.left - r.width / 2) * strength);
    y.set((e.clientY - r.top - r.height / 2) * strength);
  };
  if (reduce) return <>{children}</>;
  return (
    <motion.div
      className="inline-block"
      onMouseLeave={() => {
        x.set(0);
        y.set(0);
      }}
      onMouseMove={move}
      style={{ x: sx, y: sy }}
    >
      {children}
    </motion.div>
  );
}

/** Ink stamp that slams down when it comes into view. */
export function Stamp({ children, className = "", rotate = -9, delay = 0.2 }: { children: ReactNode; className?: string; rotate?: number; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-15% 0px" });
  return (
    <motion.div
      animate={inView ? { scale: 1, opacity: 1, rotate } : undefined}
      className={`pointer-events-none select-none rounded-md border-[3px] border-[#ff5b1f] px-4 py-1.5 font-mono text-xl font-bold uppercase tracking-[0.18em] text-[#ff5b1f] mix-blend-multiply ${className}`}
      initial={{ scale: 2.4, opacity: 0, rotate: rotate - 14 }}
      ref={ref}
      style={{ maskImage: NOISE.replace("0.8", "2.2"), WebkitMaskImage: NOISE.replace("0.8", "2.2"), maskSize: "160px", WebkitMaskSize: "160px" }}
      transition={{ delay, type: "spring", stiffness: 520, damping: 22 }}
    >
      {children}
    </motion.div>
  );
}

/** A small ember dot that trails the cursor and swells over anything clickable. */
export function EmberCursor() {
  const [enabled, setEnabled] = useState(false);
  const [hot, setHot] = useState(false);
  const x = useMotionValue(-100);
  const y = useMotionValue(-100);
  const sx = useSpring(x, { stiffness: 900, damping: 50, mass: 0.3 });
  const sy = useSpring(y, { stiffness: 900, damping: 50, mass: 0.3 });
  const rx = useSpring(x, { stiffness: 180, damping: 22 });
  const ry = useSpring(y, { stiffness: 180, damping: 22 });
  useEffect(() => {
    const fine = window.matchMedia("(pointer: fine)").matches;
    const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!fine || calm) return;
    // switch on with the first real mouse movement
    const move = (e: globalThis.MouseEvent) => {
      setEnabled(true);
      x.set(e.clientX);
      y.set(e.clientY);
      setHot(!!(e.target as HTMLElement | null)?.closest?.("a, button, [data-hot]"));
    };
    window.addEventListener("mousemove", move);
    return () => window.removeEventListener("mousemove", move);
  }, [x, y]);
  if (!enabled) return null;
  return (
    <>
      <motion.div
        aria-hidden
        className="pointer-events-none fixed left-0 top-0 z-[90] h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#ff5b1f]"
        style={{ x: sx, y: sy }}
      />
      <motion.div
        animate={{ scale: hot ? 1.9 : 1, opacity: hot ? 0.9 : 0.45 }}
        aria-hidden
        className="pointer-events-none fixed left-0 top-0 z-[90] h-8 w-8 -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#ff5b1f]"
        style={{ x: rx, y: ry }}
        transition={{ type: "spring", stiffness: 300, damping: 20 }}
      />
    </>
  );
}

/** Media query that is false during SSR and resolves after mount. */
export function useWide(query = "(min-width: 1024px)") {
  const [wide, setWide] = useState(false);
  useEffect(() => {
    const m = window.matchMedia(query);
    const set = () => setWide(m.matches);
    set();
    m.addEventListener("change", set);
    return () => m.removeEventListener("change", set);
  }, [query]);
  return wide;
}

/* ------------------------------------------------------------------ */
/* Page-level touches                                                  */
/* ------------------------------------------------------------------ */

/** Smooth, weighted scrolling. Skipped when the visitor prefers less motion. */
export function SmoothScroll() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const html = document.documentElement;
    const before = html.style.scrollBehavior;
    // the site-wide CSS smooth scrolling would fight Lenis
    html.style.scrollBehavior = "auto";
    const lenis = new Lenis({ duration: 1.15, anchors: { offset: -20 }, autoRaf: true });
    return () => {
      lenis.destroy();
      html.style.scrollBehavior = before;
    };
  }, []);
  return null;
}

/**
 * First-visit intro: a match strikes, then the paper burns away upward.
 * Pure CSS so it finishes even before scripts load; skipped on repeat visits.
 */
export function MatchIntro() {
  const [show, setShow] = useState(true);
  useEffect(() => {
    try {
      if (sessionStorage.getItem("nc-intro")) setTimeout(() => setShow(false), 0);
      else sessionStorage.setItem("nc-intro", "1");
    } catch {
      // storage blocked: the CSS timeline still removes the overlay
    }
    const t = setTimeout(() => setShow(false), 2600);
    return () => clearTimeout(t);
  }, []);
  if (!show) return null;
  return (
    <div aria-hidden className="nc-intro fixed inset-0 z-[100] flex items-center justify-center bg-[#f1ece3]">
      <style>{`
        .nc-intro { animation: nc-rise 0.95s cubic-bezier(.7,0,.3,1) 1.35s forwards; }
        .nc-intro .nc-flame { transform-origin: 50% 100%; animation: nc-ignite .5s cubic-bezier(.2,.8,.2,1) .25s both, nc-flicker .18s ease-in-out .75s infinite alternate; }
        .nc-intro .nc-word { animation: nc-fade .6s ease .55s both; }
        .nc-intro .nc-edge { animation: nc-glow .9s ease 1.2s both; }
        @keyframes nc-ignite { from { transform: scale(0); opacity: 0 } to { transform: scale(1); opacity: 1 } }
        @keyframes nc-flicker { from { transform: scale(1) rotate(-2deg) } to { transform: scale(1.08, .94) rotate(2deg) } }
        @keyframes nc-fade { from { opacity: 0; transform: translateY(8px) } to { opacity: 1; transform: none } }
        @keyframes nc-glow { from { opacity: 0 } to { opacity: 1 } }
        @keyframes nc-rise { to { transform: translateY(-115%); visibility: hidden } }
        @media (prefers-reduced-motion: reduce) { .nc-intro { display: none } }
      `}</style>
      <div className="flex flex-col items-center gap-5">
        <div className="relative flex flex-col items-center">
          <svg className="nc-flame -mb-1" height="34" viewBox="0 0 24 34" width="24">
            <path d="M12 1 C 16 9, 22 14, 22 22 A 10 10 0 0 1 2 22 C 2 15, 8 12, 12 1 Z" fill="#ff5b1f" />
            <path d="M12 12 C 14 17, 17 19, 17 24 A 5 5 0 0 1 7 24 C 7 20, 10 18, 12 12 Z" fill="#ffd2a0" />
          </svg>
          <span className="h-14 w-[5px] rounded-full bg-[#171412]" />
        </div>
        <span className="nc-word font-[family-name:var(--font-serif)] text-4xl italic text-[#171412]">nullchat</span>
      </div>
      {/* the burning lower edge of the rising sheet */}
      <div className="nc-edge absolute inset-x-0 -bottom-6">
        <BurntEdge flip />
      </div>
    </div>
  );
}

/** A ragged, glowing burnt-paper edge. Fill matches the section it belongs to. */
export function BurntEdge({ flip = false, fill = "#171412", className = "" }: { flip?: boolean; fill?: string; className?: string }) {
  const pts: string[] = [];
  for (let x = 0; x <= 1440; x += 24) {
    const v = Math.sin(x * 12.9898) * 43758.5453;
    const n = v - Math.floor(v);
    const y = 14 + Math.sin(x / 90) * 6 + n * 14;
    pts.push(`${x},${y.toFixed(1)}`);
  }
  const edge = `M0,40 L${pts.join(" L")} L1440,40 Z`;
  const line = `M${pts.join(" L")}`;
  return (
    <svg
      aria-hidden
      className={`pointer-events-none block h-10 w-full ${flip ? "rotate-180" : ""} ${className}`}
      preserveAspectRatio="none"
      viewBox="0 0 1440 40"
    >
      <path d={edge} fill={fill} />
      <path className="animate-pulse" d={line} fill="none" stroke="#ff5b1f" strokeOpacity="0.85" strokeWidth="2" style={{ filter: "drop-shadow(0 0 6px rgba(255,91,31,0.9))" }} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

/** Sparks drifting upward. Positions are fixed so server and client agree. */
export function Embers({ count = 26, height = 420, className = "" }: { count?: number; height?: number; className?: string }) {
  const reduce = useReducedMotion();
  if (reduce) return null;
  const sparks = Array.from({ length: count }, (_, i) => {
    const r = (n: number) => {
      const v = Math.sin(i * 127.1 + n * 311.7) * 43758.5453;
      return +(v - Math.floor(v)).toFixed(3);
    };
    return { left: r(1) * 100, size: 2 + r(2) * 3, dur: 5 + r(3) * 6, delay: r(4) * 6, drift: (r(5) - 0.5) * 80 };
  });
  return (
    <div aria-hidden className={`pointer-events-none absolute overflow-hidden ${className}`}>
      {sparks.map((sp, i) => (
        <motion.span
          animate={{ y: [0, -height], x: [0, sp.drift], opacity: [0, 1, 0] }}
          className="absolute bottom-0 rounded-full bg-[#ff5b1f] shadow-[0_0_8px_2px_rgba(255,91,31,0.6)]"
          key={i}
          style={{ left: `${sp.left}%`, width: sp.size, height: sp.size }}
          transition={{ duration: sp.dur, delay: sp.delay, repeat: Infinity, ease: "easeOut" }}
        />
      ))}
    </div>
  );
}

function FillWord({ p, range, word, hot }: { p: MotionValue<number>; range: [number, number]; word: string; hot: boolean }) {
  const clip = useTransform(p, range, ["inset(0 100% 0 0)", "inset(0 0% 0 0)"]);
  return (
    <span className="relative inline-block">
      <span className={`text-transparent ${hot ? "italic [-webkit-text-stroke:1px_#ff5b1f]" : "[-webkit-text-stroke:1px_rgba(23,20,18,0.35)]"}`}>{word}</span>
      <motion.span aria-hidden className={`absolute inset-0 ${hot ? "italic text-[#ff5b1f]" : "text-[#171412]"}`} style={{ clipPath: clip }}>
        {word}
      </motion.span>
    </span>
  );
}

/** Big statement whose words fill in from outline to ink as you scroll. Words in *stars* catch fire. */
export function FillStatement({ text, className = "" }: { text: string; className?: string }) {
  const ref = useRef<HTMLParagraphElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 0.85", "end 0.4"] });
  const words = text.split(" ");
  const plain = text.replace(/\*/g, "");
  if (reduce) return <p className={className}>{plain}</p>;
  return (
    <p aria-label={plain} className={className} ref={ref}>
      {words.map((w, i) => {
        const hot = w.startsWith("*");
        const clean = w.replace(/\*/g, "");
        return (
          <span aria-hidden key={i}>
            <FillWord hot={hot} p={scrollYProgress} range={[i / words.length, (i + 1) / words.length]} word={clean} />{" "}
          </span>
        );
      })}
    </p>
  );
}
