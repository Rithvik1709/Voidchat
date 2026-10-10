"use client";

import { useRef, useState } from "react";
import { motion, useMotionValueEvent, useReducedMotion, useScroll, useTransform, type MotionValue } from "framer-motion";
import { Kicker, Stamp, ease, useWide } from "@/components/landing/ui";

/* ------------------------------------------------------------------ */
/* Visuals                                                             */
/* ------------------------------------------------------------------ */

const notch = "radial-gradient(circle at 0 50%, transparent 14px, black 15px) left / 51% 100% no-repeat, radial-gradient(circle at 100% 50%, transparent 14px, black 15px) right / 51% 100% no-repeat";

function Ticket() {
  const rows: [string, string][] = [
    ["Name", "ghost_41"],
    ["Burn", "after 5 min"],
    ["Limit", "8 people"],
    ["Password", "off"],
  ];
  return (
    <div className="relative mx-auto w-full max-w-md">
      <div className="relative rounded-xl bg-[#fbf8f2] p-7 shadow-[0_30px_60px_-30px_rgba(60,40,20,0.5)]" style={{ mask: notch, WebkitMask: notch }}>
        <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#171412]/45">Room ticket</div>
        <div className="mt-2 font-[family-name:var(--font-serif)] text-5xl text-[#171412]">void-7x2k</div>
        <div className="my-6 border-t border-dashed border-[#171412]/20" />
        <dl className="grid grid-cols-2 gap-x-6 gap-y-4">
          {rows.map(([k, v]) => (
            <div key={k}>
              <dt className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#171412]/45">{k}</dt>
              <dd className="mt-1 text-[15px] text-[#171412]">{v}</dd>
            </div>
          ))}
        </dl>
      </div>
      <Stamp className="absolute -right-3 top-8 bg-[#fbf8f2]/40" delay={0.45}>
        Open
      </Stamp>
    </div>
  );
}

function Stub({ active }: { active: boolean }) {
  const reduce = useReducedMotion();
  const loop = { duration: 3.6, repeat: Infinity, times: [0, 0.35, 0.55, 0.9, 1], ease: "easeInOut" as const };
  return (
    <div className="relative mx-auto flex w-full max-w-lg items-stretch">
      <div className="flex-1 rounded-l-xl bg-[#fbf8f2] p-7 shadow-[0_30px_60px_-30px_rgba(60,40,20,0.5)]">
        <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#171412]/45">Room link</div>
        <div className="mt-2 truncate font-mono text-sm text-[#171412]">nullchat.tech/chat/void-7x2k</div>
        <div className="mt-6 font-[family-name:var(--font-serif)] text-3xl italic text-[#171412]">for Priya, only.</div>
        <div className="mt-2 text-sm text-[#171412]/55">This stub opens the room once.</div>
      </div>
      {/* perforation */}
      <div className="w-0 border-l-2 border-dashed border-[#171412]/25" />
      <motion.div
        animate={active && !reduce ? { x: [0, 0, 56, 56, 0], y: [0, 0, 18, 18, 0], rotate: [0, 0, 12, 12, 0] } : { x: 0, y: 0, rotate: 0 }}
        className="relative grid w-32 origin-top-left place-items-center rounded-r-xl bg-[#ff5b1f] p-4 text-center text-[#171412] shadow-[0_30px_60px_-30px_rgba(120,40,0,0.6)]"
        transition={loop}
      >
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.2em]">Admit</div>
          <div className="font-[family-name:var(--font-serif)] text-5xl leading-none">one</div>
          <div className="mt-2 font-mono text-[10px] uppercase tracking-[0.16em] opacity-70">works once</div>
        </div>
      </motion.div>
    </div>
  );
}

const CHAT = [
  { me: false, t: "you there? room's open." },
  { me: true, t: "yep. no signup, nothing." },
  { me: false, t: "send it before it burns" },
  { me: true, t: "sent. closing the room." },
];

function BurningChat({ active }: { active: boolean }) {
  const reduce = useReducedMotion();
  return (
    <div className="mx-auto w-full max-w-md rounded-2xl bg-[#171412] p-6 shadow-[0_40px_80px_-40px_rgba(0,0,0,0.8)]">
      <div className="mb-5 flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.18em] text-[#f1ece3]/45">
        <span>room/void-7x2k</span>
        <span className="text-[#ff5b1f]">burn · 5 min</span>
      </div>
      <div className="space-y-3">
        {CHAT.map((m, i) => (
          <div className={m.me ? "flex justify-end" : "flex"} key={m.t}>
            <motion.span
              animate={
                active && !reduce
                  ? {
                      opacity: [1, 1, 1, 0, 0, 1],
                      filter: ["blur(0px)", "blur(0px)", "blur(0px)", "blur(6px)", "blur(6px)", "blur(0px)"],
                      boxShadow: ["0 0 0 0 rgba(255,91,31,0)", "0 0 0 0 rgba(255,91,31,0)", "0 0 0 2px rgba(255,91,31,0.9), 0 0 24px 4px rgba(255,91,31,0.5)", "0 0 0 2px rgba(255,91,31,0)", "0 0 0 0 rgba(255,91,31,0)", "0 0 0 0 rgba(255,91,31,0)"],
                      y: [0, 0, 0, -14, -14, 0],
                    }
                  : undefined
              }
              className={`rounded-2xl px-4 py-2.5 text-sm ${m.me ? "rounded-br-sm bg-[#f1ece3] text-[#171412]" : "rounded-bl-sm bg-[#f1ece3]/10 text-[#f1ece3]"}`}
              transition={{ duration: 6, repeat: Infinity, delay: i * 0.45, times: [0, 0.3 + i * 0.08, 0.38 + i * 0.08, 0.5 + i * 0.08, 0.9, 1] }}
            >
              {m.t}
            </motion.span>
          </div>
        ))}
      </div>
      <div className="mt-6 rounded-full border border-[#f1ece3]/10 px-4 py-2.5 font-mono text-[11px] text-[#f1ece3]/35">message… nothing is stored</div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Section                                                             */
/* ------------------------------------------------------------------ */

const STEPS = [
  { n: "01", word: "open", title: "Open a room.", body: "One tap. No email, no phone number, no password. Pick a throwaway name and you're in." },
  { n: "02", word: "pass", title: "Pass the stub.", body: "Share the room link, or tear off a one-time stub for each person. Once it's used, it's dead, even if someone copied it." },
  { n: "03", word: "burn", title: "Watch it burn.", body: "Turn on burn mode and messages turn to ash for everyone. Close the room and the messages and files go with it." },
];

function Visual({ i, active }: { i: number; active: boolean }) {
  if (i === 0) return <Ticket />;
  if (i === 1) return <Stub active={active} />;
  return <BurningChat active={active} />;
}

function Panel({ i, p, active }: { i: number; p: MotionValue<number>; active: boolean }) {
  const s = STEPS[i];
  // the visual drifts slightly against the slide for depth
  const center = 0.08 + (0.84 * i) / 2;
  const vx = useTransform(p, [center - 0.42, center + 0.42], [140, -140]);
  // a giant word behind each panel slides faster than the panel itself
  const wx = useTransform(p, [center - 0.42, center + 0.42], [420, -420]);
  const titleY = useTransform(p, [center - 0.3, center], [60, 0]);
  const titleOpacity = useTransform(p, [center - 0.3, center - 0.08], [0, 1]);
  const visualScale = useTransform(p, [center - 0.35, center, center + 0.35], [0.82, 1.12, 0.9]);
  return (
    <div className="relative grid h-full w-screen shrink-0 grid-cols-[1fr_1.1fr] items-center gap-16 px-[7vw]">
      <motion.div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 select-none text-center font-[family-name:var(--font-serif)] text-[26vw] italic leading-none text-transparent [-webkit-text-stroke:1px_rgba(23,20,18,0.07)]"
        style={{ x: wx }}
      >
        {s.word}
      </motion.div>
      <motion.div className="relative" style={{ y: titleY, opacity: titleOpacity }}>
        <div className="font-[family-name:var(--font-serif)] text-[9rem] leading-none text-transparent [-webkit-text-stroke:1.5px_#171412]">{s.n}</div>
        <h3 className="mt-2 font-[family-name:var(--font-serif)] text-7xl leading-[0.95] tracking-[-0.02em] text-[#171412]">{s.title}</h3>
        <p className="mt-6 max-w-md text-lg leading-relaxed text-[#171412]/65">{s.body}</p>
      </motion.div>
      <motion.div className="relative" style={{ x: vx, scale: visualScale }}>
        <Visual active={active} i={i} />
      </motion.div>
    </div>
  );
}

export default function Steps() {
  const wide = useWide();
  const ref = useRef<HTMLElement>(null);
  const [active, setActive] = useState(0);
  const { scrollYProgress: p } = useScroll({ target: ref, offset: ["start start", "end end"] });
  const x = useTransform(p, [0.08, 0.92], ["0%", "-66.6667%"]);
  const bar = useTransform(p, [0.08, 0.92], [0, 1]);
  useMotionValueEvent(p, "change", (v) => setActive(Math.round(Math.min(1, Math.max(0, (v - 0.08) / 0.84)) * 2)));

  if (!wide) {
    // phones and tablets: the same three steps, stacked
    return (
      <section className="px-5 py-24 sm:px-8" id="how" ref={ref}>
        <Kicker n="02">How it works</Kicker>
        <div className="mt-10 space-y-24">
          {STEPS.map((s, i) => (
            <div key={s.n}>
              <div className="font-[family-name:var(--font-serif)] text-7xl leading-none text-transparent [-webkit-text-stroke:1.2px_#171412]">{s.n}</div>
              <h3 className="mt-2 font-[family-name:var(--font-serif)] text-5xl leading-[0.95] text-[#171412]">{s.title}</h3>
              <p className="mt-4 text-base leading-relaxed text-[#171412]/65">{s.body}</p>
              <div className="mt-10">
                <Visual active i={i} />
              </div>
            </div>
          ))}
        </div>
      </section>
    );
  }

  return (
    <section className="relative h-[340vh]" id="how" ref={ref}>
      <div className="sticky top-0 flex h-screen flex-col justify-center overflow-hidden">
        <div className="absolute inset-x-[7vw] top-28 flex items-center justify-between">
          <Kicker n="02">How it works</Kicker>
          <div className="flex items-center gap-4 font-mono text-[11px] tracking-[0.2em] text-[#171412]/55">
            <motion.span animate={{ opacity: 1 }} initial={{ opacity: 0 }} key={active} transition={{ duration: 0.4, ease }}>
              0{active + 1}
            </motion.span>
            <span className="relative h-px w-40 bg-[#171412]/15">
              <motion.span className="absolute inset-0 origin-left bg-[#ff5b1f]" style={{ scaleX: bar }} />
            </span>
            <span>03</span>
          </div>
        </div>
        <motion.div className="flex h-[70vh] w-[300vw]" style={{ x }}>
          {STEPS.map((s, i) => (
            <Panel active={active === i} i={i} key={s.n} p={p} />
          ))}
        </motion.div>
      </div>
    </section>
  );
}
