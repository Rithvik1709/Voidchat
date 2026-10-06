"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import { ArrowRight, ArrowUpRight, DoorClosed, EyeOff, Flame, Ghost, History, MessagesSquare, PhoneOff, UserX } from "lucide-react";
import ProtocolMesh from "@/components/landing/ProtocolMesh";
import Story from "@/components/landing/Story";
import { Bento, Capabilities, Compare, Faq, Spotlight, UseCases } from "@/components/landing/Sections";
import { Grain, Heading, Stars } from "@/components/landing/parts";
import { hand } from "@/components/landing/fonts";
import { SITE } from "@/lib/site";

const NAV = [
  ["How it works", "how"],
  ["Features", "features"],
  ["Use cases", "use-cases"],
  ["Mesh", "mesh"],
  ["FAQ", "faq"],
];

const MARQUEE = [
  [UserX, "No accounts"],
  [PhoneOff, "No phone numbers"],
  [History, "No message history"],
  [EyeOff, "No tracking"],
  [Ghost, "No trace"],
  [DoorClosed, "Rooms that vanish"],
  [Flame, "Links that burn"],
] as const;

const X_URL = "https://x.com/Bngrithvik";

function XLogo({ className = "h-3.5 w-3.5" }: { className?: string }) {
  return (
    <svg aria-label="X" className={className} fill="currentColor" role="img" viewBox="0 0 24 24">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

const FOOTER_COLS = [
  {
    title: "Product",
    links: [
      ["Launch app", "/groups"],
      ["How it works", "#how"],
      ["Features", "#features"],
      ["FAQ", "#faq"],
    ],
  },
  {
    title: "Company",
    links: [
      ["About", "/about"],
      ["Status", "/status"],
      ["Support", "mailto:support@nullchat.tech"],
      ["Feedback", "mailto:feedback@nullchat.tech"],
    ],
  },
  {
    title: "Legal",
    links: [
      ["Privacy", "/privacy"],
      ["Terms", "/terms"],
    ],
  },
  {
    title: "Social",
    links: [["X / Twitter", X_URL]],
  },
];

/** Nav turns dark over the dark sections and highlights the section in view. */
function useNavState(darkRef: React.RefObject<HTMLElement | null>) {
  const [dark, setDark] = useState(false);
  const [active, setActive] = useState<string | null>(null);
  useEffect(() => {
    const onScroll = () => {
      const r = darkRef.current?.getBoundingClientRect();
      setDark(!!r && r.top < 72 && r.bottom > 72);
      let current: string | null = null;
      for (const [, id] of NAV) {
        const el = document.getElementById(id);
        if (el && el.getBoundingClientRect().top < window.innerHeight * 0.4) current = id;
      }
      setActive(current);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [darkRef]);
  return { dark, active };
}

function SmartLink({ href, className, children }: { href: string; className: string; children: React.ReactNode }) {
  return href.startsWith("/") ? (
    <Link className={className} href={href}>{children}</Link>
  ) : (
    <a className={className} href={href}>{children}</a>
  );
}

export default function HomePage() {
  const mainRef = useRef<HTMLElement>(null);
  const { dark, active } = useNavState(mainRef);
  const { scrollY } = useScroll();
  const sceneY = useTransform(scrollY, [0, 800], [0, 90]);
  const copyY = useTransform(scrollY, [0, 600], [0, -40]);

  return (
    <div className={`${hand.variable} relative min-h-screen overflow-x-clip bg-[#070707] selection:bg-black selection:text-white`}>
      <Grain />

      {/* nav */}
      <nav
        className={`sticky top-0 z-50 border-b backdrop-blur-xl transition-colors duration-500 ${
          dark ? "border-white/[0.06] bg-[#070707]/70 text-white" : "border-black/[0.05] bg-[#f7f7f7]/75 text-neutral-900"
        }`}
      >
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-3 sm:px-8">
          <Link className="text-[1.65rem] font-medium tracking-[-0.06em]" href="/">
            nullchat
          </Link>
          <div className="hidden items-center gap-1 md:flex">
            {NAV.map(([label, id]) => {
              const on = active === id;
              return (
                <a
                  className={`flex items-center gap-2 rounded-full px-3.5 py-1.5 text-sm transition-all ${
                    on
                      ? dark
                        ? "bg-white/10 font-medium text-white"
                        : "bg-black/[0.06] font-medium text-black"
                      : dark
                        ? "text-white/55 hover:text-white"
                        : "text-neutral-600 hover:text-black"
                  }`}
                  href={`#${id}`}
                  key={id}
                >
                  {on && <span className="h-1.5 w-1.5 rounded-full bg-[#1479c9]" />}
                  {label}
                </a>
              );
            })}
            <span className={`mx-3 h-5 w-px ${dark ? "bg-white/15" : "bg-black/10"}`} />
            <Link className={`rounded-full px-3.5 py-1.5 text-sm ${dark ? "text-white/55 hover:text-white" : "text-neutral-600 hover:text-black"}`} href="/about">
              About
            </Link>
          </div>
          <a
            className={`inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold transition-all active:scale-95 ${
              dark ? "bg-white text-black" : "bg-neutral-950 text-white shadow-[0_8px_20px_-8px_rgba(0,0,0,0.6)]"
            }`}
            href={X_URL}
            rel="noopener noreferrer"
            target="_blank"
          >
            Follow on <XLogo />
          </a>
        </div>
      </nav>

      {/* HERO */}
      <section className="relative -mt-[61px] flex min-h-[100svh] flex-col items-center overflow-hidden bg-[#f8f8f8] px-5 pt-40 text-center text-neutral-900 md:pt-48">
        <motion.div className="relative z-10 flex flex-col items-center" style={{ y: copyY }}>
          <motion.h1
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            className="text-[2.7rem] font-medium leading-[1.0] tracking-[-0.065em] sm:text-6xl md:text-7xl lg:text-[5.6rem]"
            initial={{ opacity: 0, y: 24, filter: "blur(8px)" }}
            transition={{ duration: 0.9, ease: [0.21, 0.6, 0.35, 1] }}
          >
            <span className="bg-gradient-to-b from-neutral-500 to-neutral-600 bg-clip-text text-transparent">Talk freely.</span>
            <br />
            <span className="font-semibold text-neutral-950">Leave nothing behind</span>
          </motion.h1>

          <motion.p
            animate={{ opacity: 1, y: 0 }}
            className="mt-6 max-w-xl text-base text-neutral-600 md:text-lg"
            initial={{ opacity: 0, y: 16 }}
            transition={{ duration: 0.8, delay: 0.2 }}
          >
            Group chat with no accounts and no history. Open a room, share a link, and when it ends it&apos;s gone for everyone.
          </motion.p>

          <motion.div
            animate={{ opacity: 1, y: 0 }}
            className="mt-9 flex flex-wrap items-center justify-center gap-3"
            initial={{ opacity: 0, y: 16 }}
            transition={{ duration: 0.8, delay: 0.35 }}
          >
            <Link
              className="group flex items-center gap-3 rounded-[14px] bg-gradient-to-b from-neutral-700 via-neutral-900 to-black py-3 pl-4 pr-2.5 font-mono text-[13px] text-white shadow-[0_0_0_2px_#f8f8f8,0_0_0_3.5px_#62b0ff,0_0_24px_2px_rgba(98,176,255,0.45),0_16px_30px_-12px_rgba(0,0,0,0.8)] transition-transform hover:scale-[1.02] active:scale-95"
              href="/groups"
            >
              <span className="flex -space-x-1">
                <MessagesSquare className="h-4 w-4" />
              </span>
              Start a room
              <span className="ml-10 grid h-7 w-7 place-items-center rounded-lg border border-white/15 bg-white/10 transition-transform group-hover:translate-x-0.5">
                <ArrowRight className="h-3.5 w-3.5" />
              </span>
            </Link>
            <a
              className="group flex items-center gap-3 rounded-[14px] border border-neutral-900 bg-white/80 py-2.5 pl-5 pr-2.5 text-sm font-medium backdrop-blur transition-colors hover:bg-white"
              href="#how"
            >
              See how it works
              <span className="grid h-8 w-8 place-items-center rounded-full bg-neutral-200/80 transition-transform group-hover:translate-y-0.5">
                <ArrowRight className="h-3.5 w-3.5 rotate-90" />
              </span>
            </a>
          </motion.div>
        </motion.div>

        <motion.div
          className="absolute inset-x-0 bottom-0 h-[46%] min-h-[16rem] sm:h-[64%] sm:min-h-[20rem] [mask-image:linear-gradient(to_bottom,transparent,black_22%)]"
          style={{ y: sceneY }}
        >
          <Image alt="" className="object-cover object-bottom" fill priority sizes="100vw" src="/landing/scene-hero.webp" />
        </motion.div>
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-b from-transparent via-[#f8f8f8]/70 to-[#f8f8f8]" />
      </section>

      {/* marquee strip */}
      <div className="relative z-10 bg-[#f8f8f8] pb-16 pt-14 text-neutral-900">
        <p className="mb-10 text-center font-mono text-xs tracking-[0.12em] text-neutral-500">Built so there&apos;s nothing to find</p>
        <div className="overflow-hidden [mask-image:linear-gradient(90deg,transparent,black_14%,black_86%,transparent)]">
          <motion.div
            animate={{ x: ["0%", "-50%"] }}
            className="flex w-max gap-16 whitespace-nowrap"
            transition={{ duration: 40, ease: "linear", repeat: Infinity }}
          >
            {[...MARQUEE, ...MARQUEE, ...MARQUEE, ...MARQUEE].map(([Icon, t], i) => (
              <span className="flex items-center gap-2.5 text-[1.35rem] font-semibold tracking-[-0.04em] text-neutral-500" key={i}>
                <Icon className="h-6 w-6" strokeWidth={2.2} />
                {t}
              </span>
            ))}
          </motion.div>
        </div>
      </div>

      {/* DARK: product story */}
      <main className="dark relative bg-[#080808] text-white" ref={mainRef}>
        <Story />
        <Spotlight />
        <Bento />
        <Capabilities />
        <UseCases />

        <section className="scroll-mt-20 border-t border-white/[0.06] py-24 md:py-36" id="mesh">
          <div className="mx-auto max-w-6xl px-5 sm:px-8">
            <Heading
              soft="None are recorded."
              strong="Every voice is a node."
              sub="Type a message below and watch it join the mesh. Then refresh the page. It's gone, just like a real room."
            />
            <div className="mt-12 rounded-[2rem] border border-white/[0.12] bg-gradient-to-b from-white/[0.08] to-white/[0.02] p-2">
              <ProtocolMesh />
            </div>
          </div>
        </section>

        <Compare />
        <Faq />

        {/* closing line under a quiet starfield; the footer slides up over it */}
        <div className="relative overflow-hidden px-5 pb-20 pt-28 text-center">
          <Stars />
          <h2 className="relative text-4xl font-medium tracking-[-0.05em] text-white sm:text-5xl">Say it. Then it&apos;s gone.</h2>
          <p className="relative mt-4 text-white/45">Your first room is three seconds away.</p>
        </div>
      </main>

      {/* LIGHT: footer, a pier walking off into the fog */}
      <footer className="relative -mt-2 overflow-hidden rounded-t-[1.75rem] bg-[#f4f4f4] text-neutral-900">
        <div className="absolute inset-x-0 bottom-0 h-[52%] [mask-image:linear-gradient(to_bottom,transparent,black_28%)] sm:h-[78%]">
          <Image alt="" className="object-cover object-[55%_100%] sm:object-[60%_100%]" fill sizes="100vw" src="/landing/scene-pier.webp" />
          {/* deepen the water so the wordmark and the bottom bar read clearly */}
          <div className="absolute inset-x-0 bottom-0 h-[55%] bg-gradient-to-b from-transparent via-black/20 to-black/55" />
        </div>

        <div className="relative z-10 mx-auto max-w-7xl px-5 pt-12 sm:px-8 md:pt-16">
          <div className="grid gap-12 lg:grid-cols-[1.1fr_1.4fr]">
            <div>
              <h2 className="text-[2.4rem] font-medium leading-[1.0] tracking-[-0.055em] md:text-[3.4rem]">
                <span className="text-neutral-400">Say what you need to.</span>
                <br />
                Leave nothing behind.
              </h2>
              <p className="mt-5 max-w-sm text-[15px] text-neutral-600">{SITE.tagline}</p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  className="inline-flex items-center gap-2 rounded-full bg-neutral-950 px-6 py-3 text-sm font-semibold text-white shadow-[0_10px_24px_-10px_rgba(0,0,0,0.6)] transition-transform active:scale-95"
                  href="/groups"
                >
                  Open Nullchat <ArrowUpRight className="h-4 w-4" />
                </Link>
                <a
                  className="inline-flex items-center gap-2 rounded-full border border-neutral-900/80 bg-white/60 px-6 py-3 text-sm font-semibold backdrop-blur transition-colors hover:bg-white"
                  href={X_URL}
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  Follow on <XLogo />
                </a>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-8 sm:grid-cols-4">
              {FOOTER_COLS.map((c) => (
                <div key={c.title}>
                  <div className="mb-5 font-mono text-[11px] uppercase tracking-[0.18em] text-neutral-500">{c.title}</div>
                  <ul className="space-y-3 text-[15px]">
                    {c.links.map(([l, h]) => {
                      const external = !h.startsWith("/") && !h.startsWith("#");
                      return (
                        <li key={l}>
                          {h.startsWith("http") ? (
                            <a className="group inline-flex items-center text-neutral-800 transition-colors hover:text-black" href={h} rel="noopener noreferrer" target="_blank">
                              {l}
                              <ArrowUpRight className="ml-1 h-3 w-3 text-neutral-400 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                            </a>
                          ) : (
                            <SmartLink className="group inline-flex items-center text-neutral-800 transition-colors hover:text-black" href={h}>
                              {l}
                              {external && <ArrowUpRight className="ml-1 h-3 w-3 text-neutral-400" />}
                            </SmartLink>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
          </div>

          {/* room for the scene to breathe, then the wordmark etched over the water */}
          <div className="h-[7rem] sm:h-[11rem] md:h-[13rem]" />
          <div
            aria-hidden
            className="select-none bg-clip-text text-center font-mono text-[clamp(4rem,17vw,14rem)] font-extrabold leading-[0.8] tracking-[-0.07em] text-transparent"
            style={{ backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.92) 1.6px, transparent 2px)", backgroundSize: "6px 6px" }}
          >
            nullchat
          </div>

          <div className="mt-4 flex flex-col items-center justify-between gap-3 border-t border-white/30 py-5 font-mono text-[11px] text-white/85 sm:flex-row">
            <span>© 2026 Nullchat · Anonymous by design.</span>
            <div className="flex items-center gap-5">
              <Link className="flex items-center gap-2 transition-colors hover:text-white" href="/status">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399]" />
                System status
              </Link>
              <a
                className="transition-colors hover:text-white"
                href="#top"
                onClick={(e) => {
                  e.preventDefault();
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
              >
                Back to top ↑
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
