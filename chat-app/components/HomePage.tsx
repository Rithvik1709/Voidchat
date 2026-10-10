"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useMotionValueEvent, useReducedMotion, useScroll, useSpring, useTransform, type MotionValue } from "framer-motion";
import { ArrowDown, ArrowUpRight, Menu, X } from "lucide-react";
import BurnNote from "@/components/landing/BurnNote";
import BurnScroll from "@/components/landing/BurnScroll";
import ProtocolMesh from "@/components/landing/ProtocolMesh";
import Steps from "@/components/landing/Steps";
import { Facts, RAIL, SectionRail, ZoomThrough } from "@/components/landing/Moments";
import { Closing, Faq, Features, Ledger, UseCases } from "@/components/landing/Sections";
import { BurntEdge, EmberCursor, Embers, FillStatement, Kicker, Magnetic, MatchIntro, PaperGrain, RiseWords, RollText, SmoothScroll, VelocityMarquee, ease } from "@/components/landing/ui";
import { serif } from "@/components/landing/fonts";
import { SITE } from "@/lib/site";

const X_URL = "https://x.com/Bngrithvik";

const NAV = [
  ["How it works", "how"],
  ["Features", "features"],
  ["Use cases", "use-cases"],
  ["Mesh", "mesh"],
  ["FAQ", "faq"],
];

const FOOTER_COLS = [
  { title: "Product", links: [["Launch app", "/groups"], ["How it works", "#how"], ["Features", "#features"], ["FAQ", "#faq"]] },
  { title: "Company", links: [["About", "/about"], ["Status", "/status"], ["Support", "mailto:support@nullchat.tech"], ["Feedback", "mailto:feedback@nullchat.tech"]] },
  { title: "Legal", links: [["Privacy", "/privacy"], ["Terms", "/terms"]] },
  { title: "Social", links: [["X / Twitter", X_URL]] },
];

const TICKER = ["no accounts", "no history", "no phone numbers", "no tracking", "no trace"];

function XLogo({ className = "h-3.5 w-3.5" }: { className?: string }) {
  return (
    <svg aria-label="X" className={className} fill="currentColor" role="img" viewBox="0 0 24 24">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

function SmartLink({ href, className, children }: { href: string; className: string; children: React.ReactNode }) {
  if (href.startsWith("/")) return <Link className={className} href={href}>{children}</Link>;
  const external = href.startsWith("http");
  return (
    <a className={className} href={href} rel={external ? "noopener noreferrer" : undefined} target={external ? "_blank" : undefined}>
      {children}
    </a>
  );
}

/** The pill turns to ink over dark sections and marks the section you're in. */
function useNavState() {
  const [dark, setDark] = useState(false);
  const [active, setActive] = useState<string | null>(null);
  const [section, setSection] = useState<string | null>("intro");
  useEffect(() => {
    const onScroll = () => {
      const probe = 40;
      setDark([...document.querySelectorAll<HTMLElement>("[data-nav='dark']")].some((el) => {
        const r = el.getBoundingClientRect();
        return r.top <= probe && r.bottom >= probe;
      }));
      let current: string | null = null;
      for (const [, id] of NAV) {
        const el = document.getElementById(id);
        if (el && el.getBoundingClientRect().top < window.innerHeight * 0.45) current = id;
      }
      setActive(current);
      let rail: string | null = "intro";
      for (const [id] of RAIL) {
        const el = document.getElementById(id);
        if (el && el.getBoundingClientRect().top < window.innerHeight * 0.5) rail = id;
      }
      setSection(rail);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  return { dark, active, section };
}

/** One letter of the footer wordmark: rises into place, then fills with fire from below. */
function FireLetter({ char, i, p, fire, reduce }: { char: string; i: number; p: MotionValue<number>; fire: MotionValue<string>; reduce: boolean }) {
  const y = useTransform(p, [0.15 + i * 0.05, 0.55 + i * 0.05], ["100%", "0%"]);
  return (
    <motion.span
      aria-hidden
      className="inline-block bg-clip-text pr-[0.02em] text-transparent transition-[filter] duration-300 hover:[filter:brightness(1.6)_drop-shadow(0_0_28px_rgba(255,91,31,0.85))]"
      style={{
        backgroundImage: "linear-gradient(to top, #ff5b1f 0%, #ff8a4c 14%, #ffd2b0 26%, rgba(241,236,227,0.12) 42%, rgba(241,236,227,0.12) 100%)",
        backgroundSize: "100% 300%",
        ...(reduce ? { backgroundPosition: "0% 100%" } : { backgroundPosition: fire, y }),
      }}
    >
      {char}
    </motion.span>
  );
}

export default function HomePage() {
  const reduce = useReducedMotion();
  const { dark, active, section } = useNavState();
  const { scrollY, scrollYProgress } = useScroll();
  const progress = useSpring(scrollYProgress, { stiffness: 140, damping: 28 });
  const [menuOpen, setMenuOpen] = useState(false);
  // phones: a start-a-room bar slides up once the hero's own button is gone, and hides at the end
  const [showBar, setShowBar] = useState(false);
  useMotionValueEvent(scrollYProgress, "change", (v) => setShowBar(v > 0.04 && v < 0.93));
  useEffect(() => {
    document.documentElement.style.overflow = menuOpen ? "hidden" : "";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMenuOpen(false);
    window.addEventListener("keydown", onKey);
    return () => {
      document.documentElement.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  // hero: the two lines drift apart as you scroll away
  const lineA = useTransform(scrollY, [0, 700], [0, -160]);
  const lineB = useTransform(scrollY, [0, 700], [0, 160]);
  const noteY = useTransform(scrollY, [0, 700], [0, -90]);
  const noteRotate = useTransform(scrollY, [0, 700], [0, -6]);

  // footer: the wordmark catches fire from below as it arrives
  const footRef = useRef<HTMLElement>(null);
  const { scrollYProgress: footP } = useScroll({ target: footRef, offset: ["start end", "end end"] });
  const fire = useTransform(footP, [0.2, 1], ["0% 0%", "0% 100%"]);

  return (
    <div className={`${serif.variable} relative min-h-screen overflow-x-clip bg-[#f1ece3] text-[#171412] selection:bg-[#ff5b1f] selection:text-[#171412]`}>
      <span className="absolute top-0" id="top" />
      <SmoothScroll />
      <MatchIntro />
      <PaperGrain />
      <EmberCursor />
      <SectionRail active={section} dark={dark} />

      {/* floating pill nav */}
      <nav className="fixed inset-x-0 top-4 z-50 flex justify-center px-4">
        <div
          className={`relative flex w-full max-w-4xl items-center justify-between gap-4 overflow-hidden rounded-full border py-2 pl-5 pr-2 backdrop-blur-xl transition-colors duration-500 ${
            dark ? "border-[#f1ece3]/10 bg-[#171412]/75 text-[#f1ece3]" : "border-[#171412]/10 bg-[#f1ece3]/75 text-[#171412]"
          }`}
        >
          <Link className="flex items-center gap-2" href="/">
            <span className="h-2 w-2 rounded-full bg-[#ff5b1f] shadow-[0_0_10px_2px_rgba(255,91,31,0.6)]" />
            <span className="font-[family-name:var(--font-serif)] text-2xl italic leading-none">nullchat</span>
          </Link>
          <div className="hidden items-center gap-1 md:flex">
            {NAV.map(([label, id]) => (
              <a
                className={`group relative rounded-full px-3 py-1.5 text-[13px] transition-colors ${active === id ? "" : "opacity-60 hover:opacity-100"}`}
                href={`#${id}`}
                key={id}
              >
                {active === id && (
                  <motion.span
                    className={`absolute inset-0 rounded-full ${dark ? "bg-[#f1ece3]/10" : "bg-[#171412]/[0.07]"}`}
                    layoutId="nav-active"
                    transition={{ type: "spring", stiffness: 400, damping: 34 }}
                  />
                )}
                <span className="relative">
                  <RollText>{label}</RollText>
                </span>
              </a>
            ))}
            <Link className="group rounded-full px-3 py-1.5 text-[13px] opacity-60 transition-opacity hover:opacity-100" href="/about">
              <RollText>About</RollText>
            </Link>
          </div>
          <div className="flex items-center gap-1.5">
            <a
              className="group flex items-center gap-2 rounded-full bg-[#ff5b1f] px-4 py-2 text-[13px] font-medium text-[#171412] transition-transform hover:-translate-y-px"
              href={X_URL}
              rel="noopener noreferrer"
              target="_blank"
            >
              <RollText>Follow on</RollText> <XLogo />
            </a>
            <button
              aria-expanded={menuOpen}
              aria-label="Open menu"
              className={`grid h-9 w-9 place-items-center rounded-full md:hidden ${dark ? "bg-[#f1ece3]/10" : "bg-[#171412]/[0.07]"}`}
              onClick={() => setMenuOpen(true)}
              type="button"
            >
              <Menu className="h-4 w-4" />
            </button>
          </div>
          <motion.span aria-hidden className="absolute inset-x-6 bottom-0 h-px origin-left bg-[#ff5b1f]" style={{ scaleX: progress }} />
        </div>
      </nav>

      {/* phone menu: ink sheet with big serif links */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            animate={{ clipPath: "circle(150% at calc(100% - 40px) 40px)" }}
            aria-label="Menu"
            aria-modal="true"
            className="fixed inset-0 z-[60] flex flex-col bg-[#171412] px-6 pb-10 pt-6 text-[#f1ece3] md:hidden"
            exit={{ clipPath: "circle(0% at calc(100% - 40px) 40px)" }}
            initial={{ clipPath: "circle(0% at calc(100% - 40px) 40px)" }}
            role="dialog"
            transition={{ duration: 0.6, ease }}
          >
            <div className="flex items-center justify-between">
              <span className="font-[family-name:var(--font-serif)] text-2xl italic">nullchat</span>
              <button aria-label="Close menu" className="grid h-10 w-10 place-items-center rounded-full bg-[#f1ece3]/10" onClick={() => setMenuOpen(false)} type="button">
                <X className="h-5 w-5" />
              </button>
            </div>
            <ul className="mt-14 space-y-2">
              {[...NAV, ["About", "/about"]].map(([label, id], i) => (
                <li className="overflow-hidden" key={id}>
                  <motion.a
                    animate={{ y: "0%" }}
                    className="flex items-baseline gap-4 font-[family-name:var(--font-serif)] text-5xl leading-tight"
                    href={id.startsWith("/") ? id : `#${id}`}
                    initial={{ y: "110%" }}
                    onClick={() => setMenuOpen(false)}
                    transition={{ delay: 0.15 + i * 0.06, duration: 0.6, ease }}
                  >
                    <span className="font-mono text-[11px] tracking-[0.2em] text-[#ff5b1f]">0{i + 1}</span>
                    {label}
                  </motion.a>
                </li>
              ))}
            </ul>
            <motion.div animate={{ opacity: 1 }} className="mt-auto space-y-3" initial={{ opacity: 0 }} transition={{ delay: 0.55 }}>
              <Link className="flex items-center justify-between rounded-full bg-[#ff5b1f] py-3 pl-6 pr-3 font-medium text-[#171412]" href="/groups">
                Start a room <ArrowUpRight className="h-5 w-5" />
              </Link>
              <a className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.18em] text-[#f1ece3]/55" href={X_URL} rel="noopener noreferrer" target="_blank">
                <XLogo /> @Bngrithvik
              </a>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* phones: a start-a-room bar that follows you down the page */}
      <AnimatePresence>
        {showBar && !menuOpen && (
          <motion.div
            animate={{ y: 0, opacity: 1 }}
            className="fixed inset-x-4 bottom-4 z-40 md:hidden"
            exit={{ y: 90, opacity: 0 }}
            initial={{ y: 90, opacity: 0 }}
            transition={{ type: "spring", stiffness: 320, damping: 30 }}
          >
            <Link className="flex items-center justify-between rounded-full bg-[#171412] py-2.5 pl-5 pr-2.5 text-[15px] font-medium text-[#f1ece3] shadow-[0_18px_40px_-14px_rgba(23,20,18,0.7)]" href="/groups">
              <span className="flex items-center gap-2">
                <span className="h-2 w-2 animate-pulse rounded-full bg-[#ff5b1f]" />
                Start a room · free, no signup
              </span>
              <span className="grid h-9 w-9 place-items-center rounded-full bg-[#ff5b1f] text-[#171412]">
                <ArrowUpRight className="h-4 w-4" />
              </span>
            </Link>
          </motion.div>
        )}
      </AnimatePresence>

      <main>
        {/* HERO */}
        <section className="relative flex min-h-[100svh] items-center overflow-hidden pb-24 pt-32" id="intro">
          {/* notebook paper: rules and a margin line draw in on load */}
          <div aria-hidden className="pointer-events-none absolute inset-0">
            {Array.from({ length: 14 }, (_, i) => (
              <motion.span
                animate={{ scaleX: 1 }}
                className="absolute inset-x-0 h-px origin-left bg-[#171412]/[0.06]"
                initial={{ scaleX: 0 }}
                key={i}
                style={{ top: `${10 + i * 6.4}%` }}
                transition={{ duration: 1.4, delay: 0.1 + i * 0.05, ease }}
              />
            ))}
            <motion.span
              animate={{ scaleY: 1 }}
              className="absolute bottom-0 left-[4.5%] top-0 w-px origin-top bg-[#ff5b1f]/35"
              initial={{ scaleY: 0 }}
              transition={{ duration: 1.6, delay: 0.3, ease }}
            />
          </div>
          <div aria-hidden className="pointer-events-none absolute inset-0" style={{ background: "radial-gradient(45% 45% at 85% 70%, rgba(255,91,31,0.16), transparent 70%)" }} />
          <Embers className="bottom-0 right-0 h-[80%] w-full lg:w-1/2" count={18} height={520} />
          <div className="relative mx-auto grid w-full max-w-7xl items-center gap-16 px-5 sm:px-8 lg:grid-cols-[1.2fr_1fr]">
            <div className="min-w-0">
              <Kicker n="01">Anonymous group chat</Kicker>
              <h1 className="mt-8 font-[family-name:var(--font-serif)] text-[clamp(3.6rem,9.5vw,9rem)] leading-[0.86] tracking-[-0.03em]">
                <motion.span className="block" style={reduce ? undefined : { x: lineA }}>
                  <RiseWords text="Say it once." />
                </motion.span>
                <motion.span className="block" style={reduce ? undefined : { x: lineB }}>
                  <RiseWords delay={0.2} text="Then let it" />{" "}
                  <span className="inline-block overflow-hidden pb-[0.14em] align-bottom">
                    <motion.span
                      animate={{ y: "0%" }}
                      className="inline-block italic text-[#ff5b1f]"
                      initial={{ y: "105%" }}
                      transition={{ duration: 0.9, delay: 0.45, ease }}
                    >
                      <motion.span
                        animate={reduce ? undefined : { textShadow: ["0 0 0px rgba(255,91,31,0)", "0 0 28px rgba(255,91,31,0.55)", "0 0 8px rgba(255,91,31,0.2)", "0 0 22px rgba(255,91,31,0.5)", "0 0 0px rgba(255,91,31,0)"] }}
                        className="inline-block"
                        transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
                      >
                        burn.
                      </motion.span>
                    </motion.span>
                  </span>
                </motion.span>
              </h1>
              <motion.p
                animate={{ opacity: 1, y: 0 }}
                className="mt-8 max-w-lg text-lg leading-relaxed text-[#171412]/65"
                initial={{ opacity: 0, y: 14 }}
                transition={{ delay: 0.7, duration: 0.8, ease }}
              >
                Nullchat is group chat with no accounts and no history. Open a room, share a link, and when it&apos;s over it&apos;s gone for everyone.
              </motion.p>
              <motion.div
                animate={{ opacity: 1, y: 0 }}
                className="mt-10 flex flex-wrap items-center gap-6"
                initial={{ opacity: 0, y: 14 }}
                transition={{ delay: 0.85, duration: 0.8, ease }}
              >
                <Magnetic>
                  <Link
                    className="group inline-flex items-center gap-3 rounded-full bg-[#171412] py-2.5 pl-6 pr-2.5 text-[15px] font-medium text-[#f1ece3] shadow-[0_14px_30px_-14px_rgba(23,20,18,0.8)]"
                    href="/groups"
                  >
                    Start a room
                    <span className="grid h-9 w-9 place-items-center rounded-full bg-[#ff5b1f] text-[#171412] transition-transform duration-500 group-hover:rotate-45">
                      <ArrowUpRight className="h-4 w-4" />
                    </span>
                  </Link>
                </Magnetic>
                <a className="group relative inline-flex items-center gap-2 text-[15px] font-medium" href="#how">
                  See how it works
                  <ArrowDown className="h-4 w-4 transition-transform group-hover:translate-y-0.5" />
                  <span className="absolute -bottom-1 left-0 h-px w-full origin-right scale-x-100 bg-[#171412] transition-transform duration-500 group-hover:origin-left group-hover:scale-x-0" />
                </a>
              </motion.div>
              <motion.div
                animate={{ opacity: 1 }}
                className="mt-12 flex flex-wrap gap-x-6 gap-y-2 font-mono text-[11px] uppercase tracking-[0.18em] text-[#171412]/45"
                initial={{ opacity: 0 }}
                transition={{ delay: 1.1, duration: 0.8 }}
              >
                <span>no signup</span>
                <span>·</span>
                <span>no phone number</span>
                <span>·</span>
                <span>free</span>
              </motion.div>
            </div>

            <motion.div
              animate={{ opacity: 1, y: 0, rotate: 0 }}
              className="min-w-0"
              initial={{ opacity: 0, y: 40, rotate: 4 }}
              transition={{ delay: 0.4, duration: 1.1, ease }}
            >
              <motion.div style={reduce ? undefined : { y: noteY, rotate: noteRotate }}>
                <BurnNote />
              </motion.div>
            </motion.div>
          </div>

          <div className="absolute bottom-8 left-1/2 hidden -translate-x-1/2 flex-col items-center gap-2 font-mono text-[10px] uppercase tracking-[0.25em] text-[#171412]/45 md:flex">
            scroll
            <span className="relative h-10 w-px overflow-hidden bg-[#171412]/15">
              <motion.span
                animate={reduce ? undefined : { y: ["-100%", "100%"] }}
                className="absolute inset-0 bg-[#ff5b1f]"
                transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
              />
            </span>
          </div>
        </section>

        {/* ticker that answers to your scroll speed */}
        <div className="border-y border-[#171412]/15 py-6">
          <VelocityMarquee>
            {TICKER.map((t, i) => (
              <span className="flex items-center" key={t}>
                <span
                  className={`px-8 font-[family-name:var(--font-serif)] text-[clamp(3rem,7vw,6.5rem)] leading-none ${
                    i % 2 ? "italic text-transparent [-webkit-text-stroke:1.2px_#171412]" : "text-[#171412]"
                  }`}
                >
                  {t}
                </span>
                <span className="text-[clamp(1.5rem,3vw,2.5rem)] text-[#ff5b1f]">✺</span>
              </span>
            ))}
          </VelocityMarquee>
        </div>

        <ZoomThrough />
        <Steps />
        <BurnScroll />

        {/* manifesto: words fill from outline to ink as you read */}
        <section className="py-28 md:py-44">
          <div className="mx-auto max-w-6xl px-5 sm:px-8">
            <Kicker>Why we built it</Kicker>
            <FillStatement
              className="mt-10 font-[family-name:var(--font-serif)] text-[clamp(2.4rem,6.2vw,5.8rem)] leading-[1.02] tracking-[-0.02em]"
              text="We built a chat app that *forgets.* No accounts, no phone numbers, no history. Just a room, a link, and a *fire* you control."
            />
          </div>
        </section>

        <Facts />
        <Features />
        <UseCases />

        {/* the interactive mesh */}
        <section className="py-28 md:py-40" id="mesh">
          <div className="mx-auto max-w-7xl px-5 sm:px-8">
            <div className="grid gap-8 md:grid-cols-2 md:items-end">
              <div>
                <Kicker n="06">Try it</Kicker>
                <h2 className="mt-6 font-[family-name:var(--font-serif)] text-6xl leading-[0.9] tracking-[-0.02em] md:text-8xl">
                  <RiseWords text="Every voice is a node." />
                  <br />
                  <RiseWords className="italic text-[#ff5b1f]" delay={0.2} text="None are recorded." />
                </h2>
              </div>
              <p className="max-w-sm text-lg leading-relaxed text-[#171412]/65 md:justify-self-end">
                Type a message and watch it join the mesh. Then refresh the page. It&apos;s gone, just like a real room.
              </p>
            </div>
            <motion.div
              className="mt-14 rounded-[28px] bg-[#171412] p-2 shadow-[0_40px_80px_-40px_rgba(23,20,18,0.7)]"
              initial={{ opacity: 0, y: 80, scale: 0.94 }}
              transition={{ duration: 1, ease }}
              viewport={{ once: true, margin: "-10% 0px" }}
              whileInView={{ opacity: 1, y: 0, scale: 1 }}
            >
              <ProtocolMesh />
            </motion.div>
          </div>
        </section>

        <Ledger />
        <Faq />
        <Closing />
      </main>

      {/* FOOTER: the name catches fire as you arrive */}
      <BurntEdge className="-mb-px" />
      <footer className="relative overflow-hidden bg-[#171412] text-[#f1ece3]" data-nav="dark" ref={footRef}>
        <Embers className="inset-x-0 bottom-0 h-[70%]" />
        <div className="relative mx-auto max-w-7xl px-5 pb-8 pt-20 sm:px-8 md:pt-28">
          <div className="grid gap-12 md:grid-cols-[1fr_1.4fr]">
            <div>
              <p className="max-w-xs font-[family-name:var(--font-serif)] text-4xl italic leading-tight">{SITE.tagline}</p>
              <a className="mt-6 inline-flex items-center gap-2 text-sm text-[#f1ece3]/60 transition-colors hover:text-[#ff5b1f]" href={X_URL} rel="noopener noreferrer" target="_blank">
                <XLogo /> @Bngrithvik
              </a>
            </div>
            <div className="grid grid-cols-2 gap-8 sm:grid-cols-4">
              {FOOTER_COLS.map((c) => (
                <div key={c.title}>
                  <div className="mb-5 font-mono text-[10px] uppercase tracking-[0.2em] text-[#f1ece3]/40">{c.title}</div>
                  <ul className="space-y-3 text-[15px]">
                    {c.links.map(([l, h]) => (
                      <li key={l}>
                        <SmartLink className="text-[#f1ece3]/80 transition-colors hover:text-[#ff5b1f]" href={h}>
                          {l}
                        </SmartLink>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>

          <div aria-label="nullchat" className="mt-20 flex cursor-default select-none justify-center overflow-hidden whitespace-nowrap pb-[0.08em] font-[family-name:var(--font-serif)] text-[clamp(5rem,23vw,22rem)] italic leading-[0.85] tracking-[-0.04em]">
            {"nullchat".split("").map((c, i) => (
              <FireLetter char={c} fire={fire} i={i} key={i} p={footP} reduce={!!reduce} />
            ))}
          </div>

          <div className="mt-8 flex flex-col items-center justify-between gap-3 border-t border-[#f1ece3]/10 pt-6 font-mono text-[11px] text-[#f1ece3]/50 sm:flex-row">
            <span>© 2026 Nullchat · Anonymous by design.</span>
            <div className="flex items-center gap-6">
              <Link className="transition-colors hover:text-[#f1ece3]" href="/status">
                Status
              </Link>
              <a className="transition-colors hover:text-[#f1ece3]" href="#top">
                Back to top ↑
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
