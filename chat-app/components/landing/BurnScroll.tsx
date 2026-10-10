"use client";

import { useRef } from "react";
import { motion, useReducedMotion, useScroll, useTransform, type MotionValue } from "framer-motion";
import { BurntEdge, Kicker } from "@/components/landing/ui";

const LOG: [string, string][] = [
  ["ghost_41", "you there? room's open."],
  ["moth", "here. who else is coming?"],
  ["ghost_41", "just sam. his link burns after one use."],
  ["sam", "in. so, the plan for saturday:"],
  ["sam", "8pm, back entrance, bring the cake."],
  ["moth", "she has no idea. perfect."],
  ["ghost_41", "closing the room. see you there."],
];

// sparks that fly off the burn line; fixed values so server and client agree
const SPARKS = Array.from({ length: 14 }, (_, i) => {
  const r = (n: number) => {
    const v = Math.sin(i * 91.7 + n * 47.3) * 43758.5453;
    return +(v - Math.floor(v)).toFixed(3);
  };
  return { left: 8 + r(1) * 84, rise: 30 + r(2) * 60, drift: (r(3) - 0.5) * 40, dur: 0.8 + r(4) * 0.9, delay: r(5) * 1.2 };
});

const START = 0.14;
const STEP = 0.095;
const windowFor = (i: number) => START + i * STEP;

function Char({ p, at, char }: { p: MotionValue<number>; at: number; char: string }) {
  const color = useTransform(p, [at, at + 0.012, at + 0.05], ["rgba(241,236,227,0.92)", "rgba(255,91,31,1)", "rgba(255,91,31,0)"]);
  const y = useTransform(p, [at, at + 0.06], [0, -16]);
  const filter = useTransform(p, [at + 0.01, at + 0.06], ["blur(0px)", "blur(5px)"]);
  const textShadow = useTransform(p, [at, at + 0.012, at + 0.05], ["0 0 0 rgba(255,91,31,0)", "0 0 12px rgba(255,91,31,0.9)", "0 0 0 rgba(255,91,31,0)"]);
  if (char === " ") return <span> </span>;
  return <motion.span className="inline-block" style={{ color, y, filter, textShadow }}>{char}</motion.span>;
}

function Line({ p, i, who, text }: { p: MotionValue<number>; i: number; who: string; text: string }) {
  const at = windowFor(i);
  const nameOpacity = useTransform(p, [at, at + 0.04], [0.5, 0]);
  const rule = useTransform(p, [at, at + 0.07], [1, 0]);
  return (
    <div className="relative py-3">
      <motion.div className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#f1ece3]" style={{ opacity: nameOpacity }}>
        {who}
      </motion.div>
      <div className="mt-1 text-lg md:text-xl">
        {text.split("").map((c, k) => {
          // chars catch at slightly different moments so the line crumbles unevenly
          const v = Math.sin((i + 1) * 12.9898 + k * 78.233) * 43758.5453;
          const jitter = +(v - Math.floor(v)).toFixed(3) * 0.045;
          return <Char at={at + jitter} char={c} key={k} p={p} />;
        })}
      </div>
      <motion.div className="absolute inset-x-0 bottom-0 h-px origin-left bg-[#f1ece3]/10" style={{ scaleX: rule }} />
    </div>
  );
}

export default function BurnScroll() {
  const ref = useRef<HTMLElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress: p } = useScroll({ target: ref, offset: ["start start", "end end"] });
  const lineTop = useTransform(p, [START - 0.02, windowFor(LOG.length - 1) + 0.06], ["-3%", "103%"]);
  const lineOpacity = useTransform(p, [START - 0.04, START, windowFor(LOG.length - 1) + 0.05, windowFor(LOG.length - 1) + 0.08], [0, 1, 1, 0]);
  const left = useTransform(p, (v) => String(LOG.filter((_, i) => windowFor(i) + 0.03 > v).length));
  const done = useTransform(p, [windowFor(LOG.length - 1) + 0.05, windowFor(LOG.length - 1) + 0.1], [0, 1]);

  return (
    <section className="relative h-[280vh] bg-[#171412] text-[#f1ece3]" data-nav="dark" id="burn" ref={ref}>
      <BurntEdge className="absolute inset-x-0 -top-10" />
      <BurntEdge className="absolute inset-x-0 -bottom-10 z-10" flip />
      <div
        className="sticky top-0 flex h-screen items-center overflow-hidden"
        onMouseMove={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          e.currentTarget.style.setProperty("--mx", `${e.clientX - r.left}px`);
          e.currentTarget.style.setProperty("--my", `${e.clientY - r.top}px`);
        }}
      >
        {/* a warm glow that follows the cursor, like holding a match up in the dark */}
        <div aria-hidden className="pointer-events-none absolute inset-0 hidden md:block" style={{ background: "radial-gradient(380px circle at var(--mx, 70%) var(--my, 50%), rgba(255,91,31,0.10), transparent 60%)" }} />
        <div aria-hidden className="pointer-events-none absolute inset-0" style={{ background: "radial-gradient(50% 60% at 75% 55%, rgba(255,91,31,0.10), transparent 70%)" }} />
        <div className="relative mx-auto grid w-full max-w-7xl items-center gap-10 px-5 sm:px-8 lg:grid-cols-[0.9fr_1.1fr] lg:gap-20">
          <div>
            <Kicker dark n="03">
              Burn mode
            </Kicker>
            <h2 className="mt-6 font-[family-name:var(--font-serif)] text-5xl leading-[0.95] tracking-[-0.02em] md:text-7xl lg:text-8xl">
              Nothing survives
              <br />
              <span className="italic text-[#ff5b1f]">the night.</span>
            </h2>
            <p className="mt-6 hidden max-w-sm text-base leading-relaxed text-[#f1ece3]/55 md:block">
              Scroll, and watch a real conversation go the way every Nullchat room does. When it ends, there&apos;s no history left to leak or dig up later.
            </p>
            <div className="mt-8 hidden items-end gap-4 md:flex">
              <motion.span className="font-[family-name:var(--font-serif)] text-8xl leading-none tabular-nums text-[#f1ece3]">{reduce ? "0" : left}</motion.span>
              <span className="pb-3 font-mono text-[11px] uppercase tracking-[0.2em] text-[#f1ece3]/50">
                messages
                <br />
                still stored
              </span>
            </div>
          </div>

          <div className="relative rounded-2xl border border-[#f1ece3]/10 bg-[#f1ece3]/[0.03] px-6 py-4 md:px-8">
            {reduce ? (
              <p className="py-16 text-center font-mono text-xs uppercase tracking-[0.2em] text-[#f1ece3]/45">room closed · 0 messages kept</p>
            ) : (
              <>
                {LOG.map(([who, text], i) => (
                  <Line i={i} key={i} p={p} text={text} who={who} />
                ))}
                {/* the burn line sweeping down the conversation */}
                <motion.div className="pointer-events-none absolute inset-x-0 h-0" style={{ top: lineTop, opacity: lineOpacity }}>
                  <div className="h-[2px] w-full bg-gradient-to-r from-transparent via-[#ff5b1f] to-transparent shadow-[0_0_24px_6px_rgba(255,91,31,0.55)]" />
                  {SPARKS.map((sp, k) => (
                    <motion.span
                      animate={{ y: [0, -sp.rise], x: [0, sp.drift], opacity: [0, 1, 0] }}
                      className="absolute top-0 h-[3px] w-[3px] rounded-full bg-[#ffb27a] shadow-[0_0_6px_2px_rgba(255,91,31,0.8)]"
                      key={k}
                      style={{ left: `${sp.left}%` }}
                      transition={{ duration: sp.dur, delay: sp.delay, repeat: Infinity, ease: "easeOut" }}
                    />
                  ))}
                  <div className="h-16 w-full bg-gradient-to-b from-[#ff5b1f]/20 to-transparent" />
                </motion.div>
                <motion.div className="absolute inset-0 grid place-items-center" style={{ opacity: done }}>
                  <div className="text-center">
                    <div className="font-[family-name:var(--font-serif)] text-4xl italic text-[#f1ece3]">gone.</div>
                    <div className="mt-2 font-mono text-[11px] uppercase tracking-[0.2em] text-[#f1ece3]/45">room closed · 0 messages kept</div>
                  </div>
                </motion.div>
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
