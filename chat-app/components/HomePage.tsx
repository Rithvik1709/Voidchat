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
            href="https://x.com/Bngrithvik"
            rel="noopener noreferrer"
            target="_blank"
          >
            Follow on
            <svg aria-label="X" className="h-3.5 w-3.5" fill="currentColor" role="img" viewBox="0 0 24 24">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
            </svg>
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

      {/* LIGHT: footer */}
      <footer className="relative -mt-2 overflow-hidden rounded-t-[1.75rem] bg-[#f6f6f6] text-neutral-900">
        <div className="absolute inset-x-0 bottom-0 h-[78%] [mask-image:linear-gradient(to_bottom,transparent,black_30%)]">
          <Image alt="" className="object-cover object-bottom" fill sizes="100vw" src="/landing/scene-footer-2.webp" />
        </div>
        <div className="relative z-10 mx-auto grid max-w-7xl gap-12 px-5 pb-[22rem] pt-16 sm:px-8 md:grid-cols-[1.3fr_2fr] md:pb-[28rem] md:pt-20">
          <div>
            <div
              className="bg-clip-text font-mono text-[clamp(3.4rem,10vw,7.5rem)] font-extrabold leading-none tracking-[-0.06em] text-transparent"
              style={{ backgroundImage: "radial-gradient(circle, #141414 1.5px, transparent 1.9px)", backgroundSize: "5px 5px" }}
            >
              nullchat
            </div>
            <p className="mt-5 text-[15px] text-neutral-700">{SITE.tagline}</p>
            <Link
              className="mt-8 inline-flex items-center gap-2 rounded-full bg-neutral-950 px-6 py-3 text-sm font-semibold text-white transition-transform active:scale-95"
              href="/groups"
            >
              Open Nullchat <ArrowUpRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-8 sm:grid-cols-3">
            {FOOTER_COLS.map((c) => (
              <div key={c.title}>
                <div className="mb-5 font-mono text-[11px] text-neutral-500">{c.title}</div>
                <ul className="space-y-3.5 text-[15px]">
                  {c.links.map(([l, h]) => (
                    <li key={l}>
                      <SmartLink className="text-neutral-800 transition-colors hover:text-black" href={h}>
                        {l}
                        {h.startsWith("mailto:") && <ArrowUpRight className="ml-1 inline h-3 w-3 text-neutral-500" />}
                      </SmartLink>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
        <p className="absolute bottom-6 left-0 right-0 z-10 mx-auto max-w-7xl px-5 font-mono text-[11px] text-neutral-600 sm:px-8">
          © 2026 Nullchat · Anonymous by design.
        </p>
      </footer>
    </div>
  );
}
