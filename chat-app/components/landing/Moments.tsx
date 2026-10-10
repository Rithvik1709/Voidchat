"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { animate, motion, useInView, useMotionValue, useReducedMotion, useScroll, useTransform, type MotionValue } from "framer-motion";
import { Kicker, ease } from "@/components/landing/ui";

const serif = "font-[family-name:var(--font-serif)]";

/* ------------------------------------------------------------------ */
/* Zoom-through: the camera dives into the full stop                   */
/* ------------------------------------------------------------------ */

/**
 * "That's the whole point." Scrolling dives into the full stop until it
 * floods the screen with ember, a line appears on the ember, then it clears.
 */
export function ZoomThrough() {
  const ref = useRef<HTMLElement>(null);
  const textRef = useRef<HTMLHeadingElement>(null);
  const dotRef = useRef<HTMLSpanElement>(null);
  const reduce = useReducedMotion();
  const [origin, setOrigin] = useState("50% 50%");
  // how far the full stop sits from the centre of the heading, so the camera can pan to it
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const { scrollYProgress: p } = useScroll({ target: ref, offset: ["start start", "end end"] });

  // aim the zoom at the centre of the full stop
  useLayoutEffect(() => {
    const measure = () => {
      const t = textRef.current?.getBoundingClientRect();
      const d = dotRef.current?.getBoundingClientRect();
      if (!t || !d) return;
      // the glyph sits low in its box; aim at the dot itself, not the line box
      const ox = d.left - t.left + d.width * 0.42;
      const oy = d.top - t.top + d.height * 0.72;
      setOrigin(`${ox}px ${oy}px`);
      setOffset({ x: ox - t.width / 2, y: oy - t.height / 2 });
    };
    measure();
    window.addEventListener("resize", measure);
    document.fonts?.ready.then(measure).catch(() => {});
    return () => window.removeEventListener("resize", measure);
  }, []);

  // exponential so the dive accelerates like a camera push
  const zoom = useTransform(p, (v) => {
    const t = Math.min(1, Math.max(0, (v - 0.12) / 0.48));
    return Math.pow(180, t * t);
  });
  const pan = useTransform(p, [0.08, 0.4], [0, 1]);
  const panX = useTransform(pan, (v) => -offset.x * v);
  const panY = useTransform(pan, (v) => -offset.y * v);
  const flood = useTransform(p, [0.44, 0.54], [0, 1]);
  const lineOpacity = useTransform(p, [0.6, 0.68, 0.84, 0.9], [0, 1, 1, 0]);
  const lineY = useTransform(p, [0.6, 0.7], [30, 0]);
  const clear = useTransform(p, [0.88, 0.98], [1, 0]);
  const hint = useTransform(p, [0, 0.1], [1, 0]);
  const emberOpacity = useTransform([flood, clear] as MotionValue<number>[], ([a, b]: number[]) => a * b);

  if (reduce) {
    return (
      <section className="px-5 py-32 text-center">
        <h2 className={`${serif} text-[clamp(3.5rem,11vw,10rem)] leading-[0.9] tracking-[-0.03em]`}>
          That&apos;s the whole <span className="italic text-[#ff5b1f]">point.</span>
        </h2>
      </section>
    );
  }

  return (
    <section className="relative h-[320vh]" ref={ref}>
      <div className="sticky top-0 flex h-screen items-center justify-center overflow-hidden">
        <motion.div className="flex flex-col items-center" style={{ x: panX, y: panY }}>
          <motion.h2
            className={`${serif} text-center text-[clamp(3.5rem,12vw,11rem)] leading-[0.88] tracking-[-0.03em] text-[#171412]`}
            ref={textRef}
            style={{ scale: zoom, transformOrigin: origin }}
          >
            That&apos;s the
            <br />
            whole <span className="italic text-[#ff5b1f]">point</span>
            <span className="italic text-[#ff5b1f]" ref={dotRef}>
              .
            </span>
          </motion.h2>
        </motion.div>
        <motion.div className="absolute bottom-10 font-mono text-[10px] uppercase tracking-[0.25em] text-[#171412]/45" style={{ opacity: hint }}>
          keep scrolling
        </motion.div>

        {/* once the dot fills the screen, hold on ember */}
        <motion.div className="pointer-events-none absolute inset-0 bg-[#ff5b1f]" style={{ opacity: emberOpacity }} />
        <motion.div className="absolute inset-0 grid place-items-center px-6 text-center text-[#171412]" style={{ opacity: lineOpacity, y: lineY }}>
          <div>
            <p className={`${serif} text-[clamp(2.6rem,7vw,6.5rem)] leading-[0.95] tracking-[-0.02em]`}>
              One room. One link.
              <br />
              <span className="italic">No trace.</span>
            </p>
            <p className="mt-6 font-mono text-[11px] uppercase tracking-[0.25em] opacity-70">here&apos;s how it works ↓</p>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Section rail                                                        */
/* ------------------------------------------------------------------ */

export const RAIL: [string, string][] = [
  ["intro", "Intro"],
  ["how", "How it works"],
  ["burn", "Burn mode"],
  ["features", "Features"],
  ["use-cases", "Use cases"],
  ["mesh", "Try it"],
  ["receipt", "Receipt"],
  ["faq", "FAQ"],
];

/** Dots down the right edge: where you are, and a quick way to jump. */
export function SectionRail({ active, dark }: { active: string | null; dark: boolean }) {
  return (
    <nav aria-label="Sections" className="fixed right-5 top-1/2 z-40 hidden -translate-y-1/2 flex-col items-end gap-3 xl:flex">
      {RAIL.map(([id, label]) => {
        const on = active === id;
        return (
          <a className="group flex items-center gap-3" href={`#${id}`} key={id}>
            <span
              className={`pointer-events-none translate-x-2 rounded-full px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.18em] opacity-0 transition-all duration-300 group-hover:translate-x-0 group-hover:opacity-100 ${
                dark ? "bg-[#f1ece3] text-[#171412]" : "bg-[#171412] text-[#f1ece3]"
              }`}
            >
              {label}
            </span>
            <motion.span
              animate={{ height: on ? 22 : 6, backgroundColor: on ? "#ff5b1f" : dark ? "rgba(241,236,227,0.35)" : "rgba(23,20,18,0.25)" }}
              className="block w-1.5 rounded-full"
              transition={{ type: "spring", stiffness: 380, damping: 26 }}
            />
          </a>
        );
      })}
    </nav>
  );
}

/* ------------------------------------------------------------------ */
/* Facts band                                                          */
/* ------------------------------------------------------------------ */

function Counter({ from, to, suffix = "", active }: { from: number; to: number; suffix?: string; active: boolean }) {
  const reduce = useReducedMotion();
  const v = useMotionValue(reduce ? to : from);
  const text = useTransform(v, (n) => `${Math.round(n)}${suffix}`);
  useEffect(() => {
    if (!active || reduce) return;
    const c = animate(v, to, { duration: 1.8, ease: [0.16, 1, 0.3, 1] });
    return () => c.stop();
  }, [active, reduce, to, v]);
  return <motion.span>{text}</motion.span>;
}

const FACTS: { from: number; to: number; suffix?: string; label: string; note: string }[] = [
  { from: 99, to: 0, label: "accounts to create", note: "Pick a name. That's it." },
  { from: 0, to: 25, suffix: "MB", label: "per shared image", note: "Deleted with the room." },
  { from: 9, to: 1, label: "use per invite link", note: "Then it burns." },
  { from: 30, to: 3, suffix: "s", label: "to open a room", note: "From link to talking." },
];

export function Facts() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-15% 0px" });
  return (
    <section className="py-20 md:py-28">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <Kicker>By the numbers</Kicker>
        <div className="mt-10 grid grid-cols-2 lg:grid-cols-4" ref={ref}>
          {FACTS.map((f, i) => (
            <div className="relative px-1 py-8 pr-6 md:py-10" key={f.label}>
              {/* rules draw in, then each number runs to its value */}
              <motion.span
                animate={inView ? { scaleX: 1 } : undefined}
                className="absolute inset-x-0 top-0 h-px origin-left bg-[#171412]/25"
                initial={{ scaleX: 0 }}
                transition={{ duration: 1, delay: i * 0.12, ease }}
              />
              <motion.span
                animate={inView ? { scaleY: 1 } : undefined}
                className="absolute bottom-0 left-0 top-0 hidden w-px origin-top bg-[#171412]/12 lg:block"
                initial={{ scaleY: 0 }}
                transition={{ duration: 1, delay: 0.3 + i * 0.12, ease }}
              />
              <div className={`${serif} pl-0 text-[clamp(4rem,8vw,7.5rem)] leading-none tracking-[-0.03em] text-[#171412] lg:pl-6`}>
                <Counter active={inView} from={f.from} suffix={f.suffix} to={f.to} />
              </div>
              <div className="mt-3 font-mono text-[11px] uppercase tracking-[0.18em] text-[#171412]/60 lg:pl-6">{f.label}</div>
              <div className="mt-1 text-sm text-[#171412]/45 lg:pl-6">{f.note}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Letters that fall into place with your scroll                       */
/* ------------------------------------------------------------------ */

function DropChar({ p, i, n, char }: { p: MotionValue<number>; i: number; n: number; char: string }) {
  const v = Math.sin(i * 45.7 + n) * 43758.5453;
  const r = +(v - Math.floor(v)).toFixed(3);
  const start = (i / n) * 0.45;
  const y = useTransform(p, [start, start + 0.45], ["-120%", "0%"]);
  const rotate = useTransform(p, [start, start + 0.45], [(r - 0.5) * 70, 0]);
  const opacity = useTransform(p, [start, start + 0.15], [0, 1]);
  if (char === " ") return <span> </span>;
  return (
    <motion.span className="inline-block" style={{ y, rotate, opacity }}>
      {char}
    </motion.span>
  );
}

export function DropLetters({ text, className = "" }: { text: string; className?: string }) {
  const ref = useRef<HTMLHeadingElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 0.95", "start 0.35"] });
  if (reduce) return <h2 className={className}>{text}</h2>;
  return (
    <h2 aria-label={text} className={className} ref={ref}>
      {text.split("").map((c, i) => (
        <DropChar char={c} i={i} key={i} n={text.length} p={scrollYProgress} />
      ))}
    </h2>
  );
}
