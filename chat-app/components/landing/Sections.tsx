"use client";

import { useRef, useState } from "react";
import { motion, useReducedMotion, useScroll, useTransform, type MotionValue } from "framer-motion";
import {
  AudioLines,
  BarChart3,
  Check,
  Fingerprint,
  Flame,
  Globe,
  ImagePlus,
  Link2,
  Lock,
  MessageSquare,
  MessageSquareReply,
  Minus,
  TimerOff,
  UserCheck,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import { FAQ, USE_CASES } from "@/lib/siteContent";
import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Hatch, Heading, Note, Rings, Spot, Threads } from "@/components/landing/parts";

function Reveal({ children, delay = 0, className }: { children: React.ReactNode; delay?: number; className?: string }) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 28 }}
      transition={{ duration: 0.7, delay, ease: [0.21, 0.6, 0.35, 1] }}
      viewport={{ once: true, margin: "-80px" }}
      whileInView={{ opacity: 1, y: 0 }}
    >
      {children}
    </motion.div>
  );
}

const wrap = "mx-auto max-w-6xl px-5 sm:px-8";

/* ------------------------------------------------------------------ */
/* Spotlight: "what's stored? nothing."                                */
/* ------------------------------------------------------------------ */

function Bars({ widths }: { widths: string[] }) {
  return (
    <div className="mt-2.5 space-y-1.5">
      {widths.map((w, i) => (
        <div className="h-[5px] rounded-full bg-white/10" key={i} style={{ width: w }} />
      ))}
    </div>
  );
}

const REPORT_ROWS = [
  { icon: Fingerprint, t: "Anonymous names", chip: "No account", box: "border-red-400/25 bg-red-400/[0.06]", text: "text-red-300", bars: ["88%", "64%"] },
  { icon: Flame, t: "Burn mode", chip: "5 min", box: "border-amber-400/25 bg-amber-400/[0.05]", text: "text-amber-300", bars: ["80%", "52%"] },
  { icon: Link2, t: "One-time invite links", chip: "3 live", box: "border-sky-400/25 bg-sky-400/[0.05]", text: "text-sky-300", bars: ["70%"] },
  { icon: TimerOff, t: "Media cleanup", chip: "Automatic", box: "border-emerald-400/25 bg-emerald-400/[0.05]", text: "text-emerald-300", bars: ["46%"] },
];

function RoomReport({ pressed }: { pressed?: MotionValue<number> }) {
  return (
    <div className="relative overflow-hidden rounded-b-2xl border border-t-0 border-white/10 bg-[#0c0c0d] shadow-[0_40px_120px_-50px_#000]">
      <div className="flex items-start justify-between gap-4 border-b border-white/[0.07] p-5">
        <div>
          <div className="text-base font-medium text-white">Room report</div>
          <div className="mt-1 font-mono text-[10px] text-white/35">void-7x2k · ephemeral</div>
        </div>
        <div className="flex items-center gap-3">
          <span className="grid h-12 w-12 place-items-center rounded-full border-2 border-emerald-500/80 font-mono text-sm text-white">0</span>
          <div className="text-right">
            <div className="text-sm font-medium text-white">Bytes kept</div>
            <div className="font-mono text-[10px] text-white/35">after the room closes</div>
          </div>
        </div>
      </div>

      <div className="space-y-2.5 p-3">
        {REPORT_ROWS.map((r) => (
          <div className={`rounded-xl border px-4 py-3.5 ${r.box}`} key={r.t}>
            <div className="flex items-center justify-between">
              <span className={`flex items-center gap-2 text-sm font-medium ${r.text}`}>
                <r.icon className="h-4 w-4" />
                {r.t}
              </span>
              <span className="rounded-md bg-white/[0.06] px-2 py-0.5 font-mono text-[10px] text-white/55">{r.chip}</span>
            </div>
            <Bars widths={r.bars} />
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between border-t border-white/[0.07] px-3 py-3">
        <span className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-white/70">Invite</span>
        <div className="flex gap-2">
          <span className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-white/70">One-time link</span>
          <motion.span
            className="flex items-center gap-1.5 rounded-lg border border-orange-400/30 bg-orange-400/10 px-3 py-1.5 text-xs text-orange-200"
            style={pressed ? { scale: pressed } : undefined}
          >
            <Flame className="h-3.5 w-3.5" /> Close room
          </motion.span>
        </div>
      </div>
    </div>
  );
}

function Cursor() {
  return (
    <svg fill="none" height="26" viewBox="0 0 24 26" width="24">
      <path d="M3 2 L3 20 L8 15.5 L11.5 23 L14.5 21.6 L11 14.4 L18 14.2 Z" fill="#fff" stroke="#000" strokeLinejoin="round" strokeWidth="1.4" />
    </svg>
  );
}

/**
 * Pinned while you scroll: a small button stretches into a slot, then the room
 * report prints out of it bottom-first, then the notes and a cursor arrive.
 */
export function Spotlight() {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress: p } = useScroll({ target: ref, offset: ["start start", "end end"] });

  const slotW = useTransform(p, [0.02, 0.16], [176, 704]);
  const slotH = useTransform(p, [0.02, 0.16], [44, 22]);
  const slotBg = useTransform(p, [0.06, 0.16], ["rgb(232,232,234)", "rgb(26,26,28)"]);
  const labelO = useTransform(p, [0.02, 0.07], [1, 0]);
  const headO = useTransform(p, [0.08, 0.2], [0, 1]);
  const headY = useTransform(p, [0.08, 0.2], [24, 0]);
  const cardY = useTransform(p, [0.18, 0.7], ["-101%", "0%"]);
  const glowO = useTransform(p, [0.4, 0.7], [0, 1]);
  const notesO = useTransform(p, [0.72, 0.8], [0, 1]);
  const cursorO = useTransform(p, [0.8, 0.84], [0, 1]);
  const cursorX = useTransform(p, [0.8, 0.92], [190, 0]);
  const cursorY = useTransform(p, [0.8, 0.92], [150, 0]);
  const pressed = useTransform(p, [0.92, 0.95, 0.98], [1, 0.9, 1]);

  // with reduced motion, show the finished state and skip the choreography
  const at = <T,>(v: MotionValue<T>, done: T) => (reduce ? done : v);

  return (
    <div className="relative h-[300vh]" ref={ref}>
      <section className="sticky top-0 flex min-h-screen flex-col items-center overflow-x-clip px-5 pt-24 md:h-screen md:overflow-hidden md:pt-[max(6rem,11vh)]">
        <Rings />

        <motion.div className="relative" style={{ opacity: at(headO, 1), y: at(headY, 0) }}>
          <Heading
            soft="Nothing is stored."
            strong="Talk without a trail."
            sub="Nullchat keeps nothing once the room ends, and the room only exists while you're in it."
          />
        </motion.div>

        <div className="relative mt-12 w-full max-w-xl">
          {/* the slot the report prints out of */}
          <motion.div
            aria-hidden
            className="absolute left-1/2 top-0 z-20 grid -translate-y-1/2 place-items-center rounded-full border border-white/15 shadow-[0_10px_30px_-10px_rgba(0,0,0,0.9),inset_0_1px_0_rgba(255,255,255,0.18)]"
            style={{ width: at(slotW, 704), height: at(slotH, 22), backgroundColor: at(slotBg, "rgb(26,26,28)"), x: "-50%", maxWidth: "calc(100vw - 2.5rem)" }}
          >
            <motion.span className="whitespace-nowrap text-sm font-semibold text-black" style={{ opacity: at(labelO, 0) }}>
              What&apos;s stored?
            </motion.span>
          </motion.div>

          <motion.div aria-hidden className="absolute -inset-10 -z-10 rounded-full bg-white/[0.05] blur-3xl" style={{ opacity: at(glowO, 1) }} />

          {/* clip: anything above the slot stays hidden, so the bottom of the card shows first */}
          <div className="relative overflow-hidden">
            <motion.div style={{ y: at(cardY, "0%") }}>
              <RoomReport pressed={reduce ? undefined : pressed} />
            </motion.div>
          </div>

          <motion.div className="pointer-events-none absolute inset-0" style={{ opacity: at(notesO, 1) }}>
            <Note className="-left-48 top-[104px]" color="#ff8f8f">
              no accounts
            </Note>
            <Note arrow="left" className="-right-[17rem] top-[190px]" color="#f0a35e">
              burns on schedule
            </Note>
            <Note className="-left-44 top-[268px]" color="#7cc4ff">
              works once
            </Note>
            <Note arrow="left" className="-right-[15.5rem] top-[340px]" color="#6ee7a8">
              wiped on close
            </Note>
          </motion.div>

          {!reduce && (
            <motion.div className="pointer-events-none absolute bottom-1 right-12 z-30" style={{ opacity: cursorO, x: cursorX, y: cursorY }}>
              <Cursor />
            </motion.div>
          )}
        </div>
      </section>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Bento                                                               */
/* ------------------------------------------------------------------ */

function BurnMock() {
  const msgs = [
    { t: "send the doc before it expires", o: 1, b: 0, me: false },
    { t: "sent. dropping the link after this.", o: 0.55, b: 1, me: true },
    { t: "got it. closing the room.", o: 0.22, b: 3, me: false },
  ];
  return (
    <div className="rounded-xl border border-white/10 bg-[#0b0b0c] p-4">
      <div className="mb-3 flex items-center justify-between font-mono text-[10px] text-white/40">
        <span>burn mode</span>
        <span className="rounded-full border border-amber-400/30 px-2 py-0.5 text-amber-300">sand in 04:59</span>
      </div>
      <div className="space-y-2">
        {msgs.map((m) => (
          <div className={m.me ? "flex justify-end" : "flex"} key={m.t}>
            <span
              className={`rounded-2xl px-3.5 py-2 text-xs ${m.me ? "bg-white text-black" : "bg-white/10 text-white"}`}
              style={{ opacity: m.o, filter: `blur(${m.b}px)` }}
            >
              {m.t}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function LinksMock() {
  return (
    <div className="space-y-2 rounded-xl border border-white/10 bg-[#0b0b0c] p-4 font-mono text-[11px]">
      {[
        ["/j/8f3k…", "burned", "text-red-300 border-red-400/30 bg-red-400/10"],
        ["/j/2m9q…", "ready", "text-emerald-300 border-emerald-400/30 bg-emerald-400/10"],
        ["/j/x71d…", "ready", "text-emerald-300 border-emerald-400/30 bg-emerald-400/10"],
      ].map(([u, s, c]) => (
        <div className="flex items-center justify-between rounded-lg border border-white/[0.07] px-3 py-2" key={u}>
          <span className={s === "burned" ? "text-white/25 line-through" : "text-white/70"}>nullchat.tech{u}</span>
          <span className={`rounded-full border px-2 py-0.5 ${c}`}>{s}</span>
        </div>
      ))}
    </div>
  );
}

function MediaMock() {
  const bars = [6, 14, 9, 20, 12, 24, 8, 18, 26, 10, 16, 7, 21, 13, 9, 17, 11, 6];
  return (
    <div className="grid grid-cols-[1.1fr_1fr] gap-3 rounded-xl border border-white/10 bg-[#0b0b0c] p-4">
      <div className="relative aspect-[4/3] overflow-hidden rounded-lg border border-white/10 bg-white/5">
        <Image alt="A shared photo of a lone tree above misty hills" className="object-cover" fill sizes="(min-width: 768px) 260px, 45vw" src="/landing/shared-photo-2.webp" />
        <span className="absolute left-1.5 top-1.5 rounded bg-black/60 px-1.5 py-0.5 font-mono text-[9px] text-white/70 backdrop-blur">ghost_41</span>
        <span className="absolute bottom-1.5 right-1.5 rounded bg-black/60 px-1.5 py-0.5 font-mono text-[9px] text-white/70 backdrop-blur">IMG_2087.jpg · 3.8MB</span>
      </div>
      <div className="flex flex-col justify-center gap-2">
        <div className="flex h-8 items-center gap-[3px] rounded-full bg-white/10 px-3">
          {bars.map((h, i) => (
            // each bar breathes on its own rhythm so the note looks like it's playing
            <motion.span
              animate={{ scaleY: [0.35, 1, 0.55, 0.9, 0.35] }}
              className="w-[2px] rounded-full bg-white/70"
              key={i}
              style={{ height: h }}
              transition={{ duration: 0.9 + (i % 5) * 0.17, delay: (i * 0.07) % 0.6, ease: "easeInOut", repeat: Infinity }}
            />
          ))}
        </div>
        <div className="flex items-center gap-1.5 font-mono text-[10px] text-white/40">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
          voice note · 0:12
        </div>
      </div>
    </div>
  );
}

function PollMock() {
  return (
    <div className="space-y-2.5 rounded-xl border border-white/10 bg-[#0b0b0c] p-4">
      <div className="text-xs font-medium text-white">Friday plan?</div>
      {[
        ["Pizza", 62],
        ["Movie night", 28],
        ["Skip it", 10],
      ].map(([l, p]) => (
        <div className="relative overflow-hidden rounded-lg border border-white/10 px-3 py-2 text-xs text-white" key={l}>
          <motion.span
            className="absolute inset-y-0 left-0 bg-white/15"
            initial={{ width: 0 }}
            transition={{ duration: 1, ease: "easeOut" }}
            viewport={{ once: true }}
            whileInView={{ width: `${p}%` }}
          />
          <span className="relative flex justify-between">
            {l}
            <span className="font-mono text-white/50">{p}%</span>
          </span>
        </div>
      ))}
    </div>
  );
}

const BENTO = [
  { mock: <BurnMock />, title: "Messages that turn to sand", body: "Set burn mode and every message disappears after the time you choose, for everyone in the room." },
  { mock: <LinksMock />, title: "Invite links that burn", body: "Make a one-time link for each person. It works once, then it's dead, even if someone copied it." },
  { mock: <MediaMock />, title: "Images and voice, gone with the room", body: "Share pictures up to 25MB and record voice notes. All of it is deleted when the room ends." },
  { mock: <PollMock />, title: "Polls, replies and mentions", body: "Run single or multiple choice polls, reply to specific messages and mention people by name." },
];

export function Bento() {
  return (
    <section className="relative overflow-hidden border-t border-white/[0.06] py-24 md:py-36" id="features">
      <Spot />
      <div className={wrap}>
        <Reveal>
          <Heading align="right" soft="to stay private" strong="Everything your room needs" />
        </Reveal>
        <div className="mt-14 grid gap-4 md:grid-cols-2">
          {BENTO.map((b, i) => (
            <Reveal delay={(i % 2) * 0.1} key={b.title}>
              <div className="relative h-full overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-b from-white/[0.05] to-white/[0.01] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.07)] transition-colors duration-500 hover:border-white/20 md:p-6">
                <Hatch className={i % 2 ? "-left-2 top-6 h-44 w-12" : "-right-2 top-6 h-44 w-12"} />
                <div className="relative">{b.mock}</div>
                <h3 className="mt-6 text-xl font-medium tracking-[-0.02em] text-white">{b.title}</h3>
                <p className="mt-2 max-w-md text-sm leading-relaxed text-white/45">{b.body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Capability grid                                                     */
/* ------------------------------------------------------------------ */

const GROUPS: { label: string; items: [LucideIcon, string][] }[] = [
  { label: "Privacy", items: [[Fingerprint, "Anonymous names"], [TimerOff, "Ephemeral rooms"], [Flame, "Burn mode"], [Lock, "Room passwords"]] },
  { label: "Access", items: [[Link2, "One-time links"], [UserCheck, "Invite-only rooms"], [Users, "Member limits"], [Globe, "Runs in the browser"]] },
  { label: "Conversation", items: [[ImagePlus, "Images up to 25MB"], [AudioLines, "Voice messages"], [BarChart3, "Live polls"], [MessageSquareReply, "Replies and mentions"]] },
];

export function Capabilities() {
  return (
    <section className="py-12 md:py-20">
      <div className={wrap}>
        <Reveal>
          <Heading align="left" soft="nothing you don't." strong="Everything you need," />
        </Reveal>
        <div className="mt-12 space-y-8">
          {GROUPS.map((g) => (
            <Reveal key={g.label}>
              <div className="mb-3 flex items-center gap-3 font-mono text-[11px] uppercase tracking-[0.25em] text-white/50">
                {g.label}
                <span className="h-px flex-1 bg-white/[0.08]" />
              </div>
              <div className="grid grid-cols-2 border border-white/[0.08] md:grid-cols-4">
                {g.items.map(([Icon, label]) => (
                  <div className="flex items-center gap-3 border-b border-r border-white/[0.08] px-5 py-5 text-sm text-white transition-colors hover:bg-white/[0.04]" key={label}>
                    <Icon className="h-[18px] w-[18px] shrink-0 text-white/70" />
                    {label}
                  </div>
                ))}
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Use cases                                                           */
/* ------------------------------------------------------------------ */

export function UseCases() {
  return (
    <section className="border-t border-white/[0.06] py-24 md:py-36" id="use-cases">
      <div className={wrap}>
        <Reveal>
          <Heading strong="Conversations that" soft="shouldn't stick around." />
        </Reveal>
        <div className="mt-14 grid border border-white/[0.08] sm:grid-cols-2">
          {USE_CASES.map((u, i) => (
            <Reveal className="border-b border-r border-white/[0.08]" delay={(i % 2) * 0.08} key={u.title}>
              <article className="group h-full p-7 transition-colors hover:bg-white/[0.03] md:p-9">
                <div className="mb-10 flex items-center justify-between font-mono text-[11px] text-white/35">
                  <span>0{i + 1}</span>
                  <MessageSquare className="h-4 w-4 transition-colors group-hover:text-white/80" />
                </div>
                <h3 className="mb-2 text-xl font-medium tracking-[-0.02em] text-white">{u.title}</h3>
                <p className="text-sm leading-relaxed text-white/45">{u.body}</p>
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Compare                                                             */
/* ------------------------------------------------------------------ */

const COMPARE: { label: string; them: boolean; us: boolean }[] = [
  { label: "Requires phone number or email", them: true, us: false },
  { label: "Permanent message history", them: true, us: false },
  { label: "Profile tied to a real identity", them: true, us: false },
  { label: "Works instantly from a link", them: false, us: true },
  { label: "Media deleted when the chat ends", them: false, us: true },
];

export function Compare() {
  return (
    <section className="relative overflow-hidden border-t border-white/[0.06] py-24 md:py-36">
      <Threads className="-left-56 bottom-6 h-[26rem] w-[72rem] opacity-70 [mask-image:linear-gradient(to_bottom,transparent,black_35%,black_80%,transparent)]" />
      <div className={`${wrap} relative grid items-center gap-14 lg:grid-cols-[0.9fr_1.1fr]`}>
        <Reveal>
          <h2 className="text-[2.5rem] font-medium leading-[1.0] tracking-[-0.05em] text-white md:text-[3.6rem]">
            Most chat apps
            <br />
            remember everything.
            <br />
            <span className="bg-gradient-to-b from-white/55 to-white/30 bg-clip-text text-transparent">We forget on purpose.</span>
          </h2>
          <p className="mt-6 max-w-md text-base text-white/50 md:text-lg">
            No phone number, no profile, no archive. Just a room that exists while you need it.
          </p>
          <Link
            className="mt-9 inline-flex items-center gap-2 rounded-full border border-white/25 px-6 py-3.5 text-sm font-medium text-white transition-colors hover:border-white/60 hover:bg-white/[0.04]"
            href="/groups"
          >
            Open a room <ArrowUpRight className="h-4 w-4" />
          </Link>
        </Reveal>
        <Reveal delay={0.1}>
          <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#0c0c0d]/90 shadow-[0_40px_120px_-50px_#000,inset_0_1px_0_rgba(255,255,255,0.07)] backdrop-blur">
            <div className="grid grid-cols-[1fr_auto_auto] items-center gap-x-6 border-b border-white/10 bg-white/[0.03] px-5 py-4 font-mono text-[11px] uppercase tracking-[0.2em] text-white/40 sm:gap-x-10 sm:px-7">
              <span />
              <span className="w-14 text-center sm:w-20">Typical</span>
              <span className="w-14 text-center text-white sm:w-20">Nullchat</span>
            </div>
            {COMPARE.map((row) => (
              <div className="grid grid-cols-[1fr_auto_auto] items-center gap-x-6 border-b border-white/[0.07] px-5 py-5 transition-colors last:border-b-0 hover:bg-white/[0.02] sm:gap-x-10 sm:px-7" key={row.label}>
                <span className="text-sm text-white sm:text-[15px]">{row.label}</span>
                <span className="grid w-14 place-items-center text-white/50 sm:w-20">
                  {row.them ? <Check className="h-4 w-4" /> : <Minus className="h-4 w-4 opacity-40" />}
                </span>
                <span className="grid w-14 place-items-center sm:w-20">
                  {row.us ? (
                    <span className="grid h-7 w-7 place-items-center rounded-full bg-white text-black shadow-[0_0_16px_rgba(255,255,255,0.35)]">
                      <Check className="h-4 w-4" />
                    </span>
                  ) : (
                    <span className="grid h-7 w-7 place-items-center rounded-full border border-white/15 text-white/40">
                      <X className="h-4 w-4" />
                    </span>
                  )}
                </span>
              </div>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* FAQ: question list on the right, the active answer on the left      */
/* ------------------------------------------------------------------ */

export function Faq() {
  const [open, setOpen] = useState(0);
  const total = String(FAQ.length).padStart(2, "0");
  return (
    <section className="relative scroll-mt-20 overflow-hidden border-t border-white/[0.07] py-24 md:py-36" id="faq">
      <Spot />
      <div className={`${wrap} relative grid gap-12 lg:grid-cols-[1fr_1.15fr] lg:gap-20`}>
        <div className="lg:sticky lg:top-28 lg:self-start">
          <div className="flex items-center justify-between border-t border-white/[0.08] pt-4 font-mono text-[10px] uppercase tracking-[0.2em] text-white/35">
            <span>FAQs</span>
            <span>
              {String(open + 1).padStart(2, "0")} / {total}
            </span>
          </div>
          <motion.div animate={{ opacity: 1, y: 0 }} initial={{ opacity: 0, y: 10 }} key={open} transition={{ duration: 0.35 }}>
            <h2 className="mt-8 text-4xl font-medium leading-[1.02] tracking-[-0.045em] text-white md:text-5xl">{FAQ[open].q}</h2>
            <p className="mt-6 max-w-md text-base leading-relaxed text-white/55">{FAQ[open].a}</p>
          </motion.div>
        </div>

        <div className="border-t border-white/[0.08]">
          {FAQ.map((item, i) => (
            <button
              aria-pressed={open === i}
              className={`relative flex w-full items-center justify-between gap-6 border-b border-white/[0.08] px-6 py-6 text-left text-base tracking-tight transition-colors md:text-lg ${
                open === i ? "bg-white/[0.04] text-white" : "text-white/55 hover:text-white"
              }`}
              key={item.q}
              onClick={() => setOpen(i)}
              type="button"
            >
              {open === i && <span className="absolute inset-y-0 left-0 w-px bg-white" />}
              {item.q}
              <span className="font-mono text-[10px] text-white/30">{String(i + 1).padStart(2, "0")}</span>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
