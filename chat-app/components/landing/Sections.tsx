"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion, useInView, useMotionValue, useReducedMotion, useScroll, useSpring, useTransform, type MotionValue } from "framer-motion";
import {
  ArrowUpRight,
  AudioLines,
  BarChart3,
  CalendarClock,
  Fingerprint,
  Flame,
  ImagePlus,
  Inbox,
  Link2,
  Lock,
  MessageCircleQuestion,
  MessageSquareReply,
  PartyPopper,
  Plus,
  Users,
  type LucideIcon,
} from "lucide-react";
import { FAQ, USE_CASES } from "@/lib/siteContent";
import { InkParagraph, Kicker, RiseWords, Stamp, ease } from "@/components/landing/ui";
import { DropLetters } from "@/components/landing/Moments";

const wrap = "mx-auto max-w-7xl px-5 sm:px-8";
const serif = "font-[family-name:var(--font-serif)]";

/* ------------------------------------------------------------------ */
/* Features: an index you can run your cursor down                     */
/* ------------------------------------------------------------------ */

const FEATURES: [LucideIcon, string, string][] = [
  [Fingerprint, "Anonymous names", "A temporary name that lasts for the session and disappears when you leave."],
  [Flame, "Burn mode", "Every message turns to sand after the time you choose, for everyone in the room."],
  [Link2, "One-time links", "Give each person a link that works once. Forwarded or copied, it's already dead."],
  [Lock, "Room passwords", "Put a password on top of the link for rooms that need a second lock."],
  [Users, "Member limits", "Cap the room at any size, or make it invite-only."],
  [ImagePlus, "Images up to 25MB", "Share pictures freely. They're deleted when the room ends."],
  [AudioLines, "Voice messages", "Record and send voice notes without leaving the chat."],
  [BarChart3, "Live polls", "Single or multiple choice, with results landing in real time."],
  [MessageSquareReply, "Replies & mentions", "Reply to a message or mention someone so busy rooms stay readable."],
];

function FeatureRow({ i, icon: Icon, title, body, onHover }: { i: number; icon: LucideIcon; title: string; body: string; onHover: (i: number | null) => void }) {
  return (
    <motion.li
      className="group relative cursor-default overflow-hidden"
      initial="off"
      onMouseEnter={() => onHover(i)}
      onMouseLeave={() => onHover(null)}
      viewport={{ once: true, margin: "-8% 0px" }}
      whileInView="on"
    >
      <motion.span
        className="absolute inset-x-0 top-0 h-px origin-left bg-[#171412]/20"
        transition={{ duration: 0.9, ease, delay: 0.05 }}
        variants={{ off: { scaleX: 0 }, on: { scaleX: 1 } }}
      />
      {/* ink floods up from the bottom on hover */}
      <span className="absolute inset-0 origin-bottom scale-y-0 bg-[#171412] transition-transform duration-500 ease-[cubic-bezier(0.2,0.7,0.2,1)] group-hover:scale-y-100" />
      <motion.div
        className="relative grid grid-cols-[2.5rem_1fr_auto] items-center gap-4 px-2 py-6 transition-colors duration-500 group-hover:text-[#f1ece3] md:grid-cols-[4rem_1.1fr_1fr_3rem] md:gap-8 md:px-4 md:py-8"
        transition={{ duration: 0.8, ease, delay: 0.1 }}
        variants={{ off: { opacity: 0, y: 24 }, on: { opacity: 1, y: 0 } }}
      >
        <span className="font-mono text-[11px] tracking-[0.2em] text-[#171412]/45 transition-colors duration-500 group-hover:text-[#ff5b1f]">
          {String(i + 1).padStart(2, "0")}
        </span>
        <span className={`${serif} text-3xl leading-none tracking-[-0.01em] transition-transform duration-500 group-hover:translate-x-3 md:text-5xl`}>{title}</span>
        <span className="hidden text-[15px] leading-relaxed text-[#171412]/60 transition-colors duration-500 group-hover:text-[#f1ece3]/70 md:block">{body}</span>
        <Icon className="h-6 w-6 justify-self-end text-[#171412]/60 transition-all duration-500 group-hover:rotate-12 group-hover:scale-125 group-hover:text-[#ff5b1f]" strokeWidth={1.5} />
      </motion.div>
    </motion.li>
  );
}

/** A small ember card that trails the cursor over the list, showing the row's icon. */
function HoverPreview({ index, x, y }: { index: number | null; x: MotionValue<number>; y: MotionValue<number> }) {
  const Icon = index === null ? null : FEATURES[index][0];
  return (
    <motion.div
      animate={{ opacity: index === null ? 0 : 1, scale: index === null ? 0.6 : 1, rotate: index === null ? -8 : -4 }}
      className="pointer-events-none absolute left-0 top-0 z-20 hidden h-36 w-28 -translate-x-1/2 -translate-y-1/2 flex-col justify-between rounded-2xl bg-[#ff5b1f] p-3 text-[#171412] shadow-[0_24px_50px_-20px_rgba(120,40,0,0.7)] md:flex"
      style={{ x, y }}
      transition={{ type: "spring", stiffness: 300, damping: 24 }}
    >
      <span className="font-mono text-[10px] tracking-[0.2em]">{index === null ? "" : String(index + 1).padStart(2, "0")}</span>
      <AnimatePresence mode="popLayout">
        {Icon && (
          <motion.span animate={{ opacity: 1, y: 0, rotate: 0 }} className="self-center" exit={{ opacity: 0, y: -16, rotate: 20 }} initial={{ opacity: 0, y: 16, rotate: -20 }} key={index}>
            <Icon className="h-12 w-12" strokeWidth={1.2} />
          </motion.span>
        )}
      </AnimatePresence>
      <span className="font-mono text-[9px] uppercase tracking-[0.16em] opacity-70">0 bytes kept</span>
    </motion.div>
  );
}

export function Features() {
  const reduce = useReducedMotion();
  const [hover, setHover] = useState<number | null>(null);
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const x = useSpring(mx, { stiffness: 260, damping: 26, mass: 0.5 });
  const y = useSpring(my, { stiffness: 260, damping: 26, mass: 0.5 });
  return (
    <section className="py-28 md:py-40" id="features">
      <div className={wrap}>
        <div className="grid gap-8 md:grid-cols-2 md:items-end">
          <div>
            <Kicker n="04">Features</Kicker>
            <h2 className={`${serif} mt-6 text-6xl leading-[0.9] tracking-[-0.02em] text-[#171412] md:text-8xl`}>
              <RiseWords text="Small features." />
              <br />
              <RiseWords className="italic text-[#ff5b1f]" delay={0.15} text="Zero residue." />
            </h2>
          </div>
          <InkParagraph
            className="max-w-md text-lg leading-relaxed text-[#171412] md:justify-self-end"
            text="Everything a group chat needs, and nothing that outlives it. No profile to fill in, no archive to clean up, no settings buried three menus deep."
          />
        </div>
        <ul
          className="relative mt-16 border-b border-[#171412]/20"
          onMouseMove={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            mx.set(e.clientX - r.left + 90);
            my.set(e.clientY - r.top);
          }}
        >
          {FEATURES.map(([icon, title, body], i) => (
            <FeatureRow body={body} i={i} icon={icon} key={title} onHover={setHover} title={title} />
          ))}
          {!reduce && <HoverPreview index={hover} x={x} y={y} />}
        </ul>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Use cases: cards that stack as you scroll                           */
/* ------------------------------------------------------------------ */

const TONES = [
  { bg: "#ff5b1f", fg: "#171412", sub: "rgba(23,20,18,0.72)", icon: MessageCircleQuestion },
  { bg: "#171412", fg: "#f1ece3", sub: "rgba(241,236,227,0.62)", icon: PartyPopper },
  { bg: "#d9cebc", fg: "#171412", sub: "rgba(23,20,18,0.66)", icon: CalendarClock },
  { bg: "#fbf8f2", fg: "#171412", sub: "rgba(23,20,18,0.62)", icon: Inbox },
];

function StackCard({ i, p, total }: { i: number; p: MotionValue<number>; total: number }) {
  const u = USE_CASES[i];
  const t = TONES[i % TONES.length];
  const Icon = t.icon;
  const scale = useTransform(p, [i / total, 1], [1, 1 - (total - i) * 0.045]);
  const iconRotate = useTransform(p, [Math.max(0, (i - 1) / total), i / total], [-24, 0]);
  return (
    <div className="sticky top-0 flex h-screen items-center justify-center">
      <motion.article
        className="relative flex h-[62vh] min-h-[22rem] w-full max-w-5xl origin-top flex-col justify-between overflow-hidden rounded-[28px] p-7 shadow-[0_-20px_60px_-30px_rgba(23,20,18,0.45)] md:p-12"
        style={{ scale, top: `calc(-4vh + ${i * 26}px)`, backgroundColor: t.bg, color: t.fg }}
      >
        <div className="flex items-start justify-between">
          <span className="font-mono text-[11px] uppercase tracking-[0.2em]" style={{ color: t.sub }}>
            Use case {String(i + 1).padStart(2, "0")} / {String(total).padStart(2, "0")}
          </span>
          <motion.span style={{ rotate: iconRotate }}>
            <Icon className="h-14 w-14 md:h-24 md:w-24" strokeWidth={1} />
          </motion.span>
        </div>
        <div className="max-w-2xl">
          <h3 className={`${serif} text-4xl leading-[0.95] tracking-[-0.01em] md:text-7xl`}>{u.title}</h3>
          <p className="mt-5 max-w-xl text-base leading-relaxed md:text-lg" style={{ color: t.sub }}>
            {u.body}
          </p>
        </div>
      </motion.article>
    </div>
  );
}

export function UseCases() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });
  return (
    <section className="pt-28 md:pt-40" id="use-cases">
      <div className={wrap}>
        <Kicker n="05">Use cases</Kicker>
        <h2 className={`${serif} mt-6 max-w-4xl text-6xl leading-[0.9] tracking-[-0.02em] text-[#171412] md:text-8xl`}>
          <RiseWords text="For conversations that" />{" "}
          <RiseWords className="italic text-[#ff5b1f]" delay={0.2} text="shouldn't stick around." />
        </h2>
      </div>
      <div className="relative px-5 pb-[8vh] sm:px-8" ref={ref}>
        {USE_CASES.map((u, i) => (
          <StackCard i={i} key={u.title} p={scrollYProgress} total={USE_CASES.length} />
        ))}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* The receipt: everything we kept, which is nothing                   */
/* ------------------------------------------------------------------ */

/** Digits shuffle for a moment, then settle on the real value. */
function Scramble({ value, active, delay }: { value: string; active: boolean; delay: number }) {
  const reduce = useReducedMotion();
  const [shown, setShown] = useState(value);
  useEffect(() => {
    if (!active || reduce) return;
    let tick: ReturnType<typeof setInterval> | undefined;
    const start = setTimeout(() => {
      tick = setInterval(() => setShown(String(Math.floor(Math.random() * 9000) + 100)), 45);
    }, delay * 1000);
    const stop = setTimeout(() => {
      if (tick) clearInterval(tick);
      setShown(value);
    }, (delay + 0.75) * 1000);
    return () => {
      clearTimeout(start);
      clearTimeout(stop);
      if (tick) clearInterval(tick);
    };
  }, [active, delay, value, reduce]);
  return <span className="tabular-nums">{shown}</span>;
}

const RECEIPT: [string, string, string][] = [
  ["Messages", "0", ""],
  ["Photos & voice notes", "0", "MB"],
  ["Accounts", "0", ""],
  ["Phone numbers", "0", ""],
  ["Message history", "0", "days"],
];

const scallop =
  "radial-gradient(circle at 9px 0, transparent 6px, black 6.5px) top / 18px 51% repeat-x, radial-gradient(circle at 9px 100%, transparent 6px, black 6.5px) bottom / 18px 51% repeat-x";

export function Ledger() {
  const ref = useRef<HTMLDivElement>(null);
  const sectionRef = useRef<HTMLElement>(null);
  const inView = useInView(ref, { once: true, margin: "-20% 0px" });
  const reduce = useReducedMotion();
  // the receipt drifts and tilts as it passes, like paper caught in a draft
  const { scrollYProgress } = useScroll({ target: sectionRef, offset: ["start end", "end start"] });
  const floatY = useTransform(scrollYProgress, [0, 1], [80, -80]);
  const floatRotate = useTransform(scrollYProgress, [0, 0.5, 1], [5, -2, -7]);
  return (
    <section className="py-28 md:py-40" id="receipt" ref={sectionRef}>
      <div className={`${wrap} grid items-center gap-16 lg:grid-cols-[1fr_0.9fr]`}>
        <div>
          <Kicker n="07">The receipt</Kicker>
          <h2 className={`${serif} mt-6 text-6xl leading-[0.9] tracking-[-0.02em] text-[#171412] md:text-8xl`}>
            <RiseWords text="Most apps keep everything." />
            <br />
            <RiseWords className="italic text-[#ff5b1f]" delay={0.2} text="We print zeros." />
          </h2>
          <InkParagraph
            className="mt-8 max-w-md text-lg leading-relaxed text-[#171412]"
            text="No phone number to sign up, no profile tied to who you are, no archive waiting on a server. When a room closes, this is the whole bill."
          />
        </div>

        <motion.div
          className="relative mx-auto w-full max-w-sm"
          initial={{ opacity: 0 }}
          ref={ref}
          transition={{ duration: 1, ease }}
          viewport={{ once: true, margin: "-15% 0px" }}
          whileInView={{ opacity: 1 }}
        >
          <motion.div style={reduce ? undefined : { y: floatY, rotate: floatRotate }}>
          <div className="bg-[#fbf8f2] px-7 py-10 font-mono text-[13px] text-[#171412] shadow-[0_40px_80px_-40px_rgba(60,40,20,0.55)]" style={{ mask: scallop, WebkitMask: scallop }}>
            <div className="text-center">
              <div className={`${serif} text-3xl italic`}>nullchat</div>
              <div className="mt-1 text-[10px] uppercase tracking-[0.2em] text-[#171412]/50">room void-7x2k · closed</div>
            </div>
            <div className="my-6 border-t border-dashed border-[#171412]/30" />
            <ul className="space-y-3">
              {RECEIPT.map(([label, value, unit], i) => (
                <motion.li
                  animate={inView ? { opacity: 1, x: 0 } : undefined}
                  className="flex items-baseline gap-2"
                  initial={{ opacity: 0, x: -8 }}
                  key={label}
                  transition={{ delay: 0.3 + i * 0.18, duration: 0.4 }}
                >
                  <span className="uppercase">{label}</span>
                  <span className="mb-1 flex-1 border-b border-dotted border-[#171412]/35" />
                  <span>
                    <Scramble active={inView} delay={0.3 + i * 0.18} value={value} /> {unit}
                  </span>
                </motion.li>
              ))}
            </ul>
            <div className="my-6 border-t border-dashed border-[#171412]/30" />
            <div className="flex items-baseline justify-between text-base font-bold uppercase">
              <span>Total kept</span>
              <span>
                <Scramble active={inView} delay={1.4} value="0" /> B
              </span>
            </div>
            <div
              aria-hidden
              className="mx-auto mt-8 h-12 w-48"
              style={{ backgroundImage: "repeating-linear-gradient(90deg, #171412 0 2px, transparent 2px 4px, #171412 4px 5px, transparent 5px 8px, #171412 8px 11px, transparent 11px 13px)" }}
            />
            <div className="mt-4 text-center text-[10px] uppercase tracking-[0.2em] text-[#171412]/50">thanks for leaving nothing behind</div>
          </div>
          </motion.div>
          <div className="absolute left-1/2 top-[44%] -translate-x-1/2">
            <Stamp className="bg-[#fbf8f2]/30 text-2xl" delay={2.2} rotate={-12}>
              Forgotten
            </Stamp>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* FAQ                                                                 */
/* ------------------------------------------------------------------ */

export function Faq() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <section className="border-t border-[#171412]/15 py-28 md:py-40" id="faq">
      <div className={`${wrap} grid gap-14 lg:grid-cols-[0.8fr_1.2fr]`}>
        <div className="lg:sticky lg:top-32 lg:self-start">
          <Kicker n="08">FAQ</Kicker>
          <h2 className={`${serif} mt-6 text-6xl leading-[0.9] tracking-[-0.02em] text-[#171412] md:text-8xl`}>
            <RiseWords text="Asked" />
            <br />
            <RiseWords className="italic text-[#ff5b1f]" delay={0.1} text="anonymously." />
          </h2>
          <p className="mt-6 max-w-xs text-[15px] leading-relaxed text-[#171412]/60">
            Still curious? Write to{" "}
            <a className="underline decoration-[#ff5b1f] underline-offset-4" href="mailto:support@nullchat.tech">
              support@nullchat.tech
            </a>
            .
          </p>
        </div>
        <div className="border-t border-[#171412]/20">
          {FAQ.map((item, i) => {
            const isOpen = open === i;
            return (
              <div className="border-b border-[#171412]/20" key={item.q}>
                <button
                  aria-expanded={isOpen}
                  className="group flex w-full items-center justify-between gap-6 py-7 text-left"
                  onClick={() => setOpen(isOpen ? null : i)}
                  type="button"
                >
                  <span className={`${serif} text-2xl leading-tight text-[#171412] transition-transform duration-500 group-hover:translate-x-2 md:text-4xl`}>{item.q}</span>
                  <motion.span
                    animate={{ rotate: isOpen ? 45 : 0, backgroundColor: isOpen ? "#ff5b1f" : "rgba(23,20,18,0)" }}
                    className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-[#171412]/25 text-[#171412]"
                    transition={{ type: "spring", stiffness: 400, damping: 22 }}
                  >
                    <Plus className="h-4 w-4" />
                  </motion.span>
                </button>
                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      animate={{ height: "auto", opacity: 1 }}
                      className="overflow-hidden"
                      exit={{ height: 0, opacity: 0 }}
                      initial={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.45, ease }}
                    >
                      <p className="max-w-2xl pb-8 text-lg leading-relaxed text-[#171412]/65">{item.a}</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Closing call to action                                              */
/* ------------------------------------------------------------------ */

export function Closing() {
  return (
    <section className="relative overflow-hidden py-28 text-center md:py-44">
      <div aria-hidden className="pointer-events-none absolute inset-0" style={{ background: "radial-gradient(40% 50% at 50% 100%, rgba(255,91,31,0.18), transparent 70%)" }} />
      <div className="relative px-5">
        <DropLetters className={`${serif} text-[clamp(4rem,13vw,12rem)] leading-[0.85] tracking-[-0.03em] text-[#171412]`} text="Say it once." />
        <p className="mx-auto mt-6 max-w-md text-lg text-[#171412]/60">Your first room is three seconds away. No account, no download.</p>
        <Link
          className="group mt-10 inline-flex items-center gap-3 rounded-full bg-[#171412] py-3 pl-7 pr-3 text-base font-medium text-[#f1ece3] transition-transform hover:-translate-y-0.5"
          href="/groups"
        >
          Start a room
          <span className="grid h-10 w-10 place-items-center rounded-full bg-[#ff5b1f] text-[#171412] transition-transform duration-500 group-hover:rotate-45">
            <ArrowUpRight className="h-5 w-5" />
          </span>
        </Link>
      </div>
    </section>
  );
}
