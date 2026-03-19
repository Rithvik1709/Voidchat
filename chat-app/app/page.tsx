"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  Lock,
  Moon,
  Play,
  ShieldCheck,
  TimerOff,
  Zap,
} from "lucide-react";

export default function Home() {
  const [cursor, setCursor] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setCursor({ x: e.clientX, y: e.clientY });
    };

    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[#131313] text-[#e2e2e2]">
      <div
        className="pointer-events-none fixed inset-0 z-20 opacity-[0.03]"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E\")",
        }}
      />

      <div
        className="pointer-events-none fixed z-10 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{
          left: `${cursor.x}px`,
          top: `${cursor.y}px`,
          background:
            "radial-gradient(circle, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0) 70%)",
        }}
      />

      <nav className="fixed top-0 z-50 w-full bg-[#1B1B1B]/60 backdrop-blur-xl shadow-[0_40px_60px_rgba(226,222,222,0.06)]">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-8 py-4">
          <div className="text-xl font-bold tracking-tighter text-white">
            Nullchat
          </div>
          <div className="hidden items-center gap-8 text-sm font-medium tracking-tight md:flex">
            <a
              className="font-semibold text-white transition-colors duration-300 hover:text-white"
              href="#features"
            >
              Features
            </a>
            <a
              className="text-[#C7C6C6] transition-colors duration-300 hover:text-white"
              href="#security"
            >
              Security
            </a>
            <a
              className="text-[#C7C6C6] transition-colors duration-300 hover:text-white"
              href="#pricing"
            >
              Pricing
            </a>
          </div>
          <div className="flex items-center gap-4 md:gap-6">
            <button className="text-white transition-opacity hover:opacity-70" aria-label="Theme mode">
              <Moon className="h-5 w-5" />
            </button>
            <Link
              className="rounded-full bg-white px-5 py-2 text-sm font-bold text-black transition-transform active:scale-95"
              href="/groups"
            >
              Launch App
            </Link>
          </div>
        </div>
      </nav>

      <main className="relative z-30 pt-32">
        <section className="mx-auto mb-48 max-w-7xl px-8">
          <div className="flex flex-col items-center text-center">
            <div className="mb-8 inline-flex items-center rounded-full border border-[#444748]/30 bg-[#2a2a2a] px-3 py-1">
              <span className="mr-2 text-[10px] font-bold uppercase tracking-widest text-white">
                New
              </span>
              <span className="text-xs font-medium text-[#c4c7c8]">
                Encrypted V2 protocol is live
              </span>
            </div>

            <h1 className="mb-8 max-w-4xl text-6xl font-bold leading-[0.9] tracking-tighter text-white md:text-8xl">
              Conversations, <br />
              <span className="text-[#c7c6c6]">
                without the footprint.
              </span>
            </h1>

            <p className="mb-12 max-w-2xl text-lg leading-relaxed text-[#c4c7c8] md:text-xl">
              The ultra-minimalist messaging protocol for those who
              value absolute anonymity. No logs, no data, no trace.
              Just pure, ephemeral dialogue.
            </p>

            <div className="flex flex-col gap-4 sm:flex-row">
              <Link
                className="flex items-center gap-2 rounded-full bg-white px-8 py-4 text-lg font-bold text-black transition-all hover:scale-[1.02] active:scale-95"
                href="/groups"
              >
                Start Chatting
                <ArrowRight className="h-5 w-5" />
              </Link>
              <a
                className="rounded-full bg-[#2a2a2a] px-8 py-4 text-lg font-bold text-white transition-all hover:bg-[#353535]"
                href="#"
              >
                View Source
              </a>
            </div>
          </div>

          <div className="relative mt-24 overflow-hidden rounded-xl border border-[#444748]/30 bg-[#1b1b1b] p-4">
            <div className="flex aspect-video w-full items-center justify-center overflow-hidden rounded-lg bg-[#0e0e0e]">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.14),transparent_45%),radial-gradient(circle_at_80%_75%,rgba(255,255,255,0.1),transparent_40%)]" />
              <div className="absolute inset-0 bg-gradient-to-t from-[#131313] via-transparent to-transparent" />
              <div className="relative z-10 flex flex-col items-center justify-center p-8 text-center">
                <div className="mb-4 flex h-20 w-20 cursor-pointer items-center justify-center rounded-full border border-white/20 bg-white/10 backdrop-blur-md transition-transform hover:scale-110">
                  <Play className="h-10 w-10 fill-current text-white" />
                </div>
                <span className="text-xs font-bold uppercase tracking-widest text-white/50">
                  Watch the protocol in action
                </span>
              </div>
            </div>
          </div>
        </section>

        <section
          className="mx-auto mb-48 max-w-7xl rounded-[3rem] bg-[#1b1b1b] px-8 py-24"
          id="features"
        >
          <div className="grid grid-cols-1 gap-6 md:grid-cols-12">
            <div className="group flex flex-col justify-between rounded-3xl border border-[#444748]/20 bg-[#1f1f1f] p-10 transition-all duration-500 hover:bg-[#2a2a2a] md:col-span-8">
              <div>
                <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-xl bg-white text-black">
                  <ShieldCheck className="h-6 w-6" />
                </div>
                <h3 className="mb-4 text-3xl font-bold tracking-tight text-white">
                  Anonymous by design
                </h3>
                <p className="max-w-md leading-relaxed text-[#c4c7c8]">
                  No email, no phone number, no metadata. We
                  don&apos;t even log your IP address. Your identity
                  is a void.
                </p>
              </div>
              <div className="mt-12 flex h-40 items-end overflow-hidden rounded-2xl bg-[#1b1b1b] px-6">
                <div className="mx-1 h-[80%] flex-1 rounded-t-lg bg-[#444748]/50 transition-all group-hover:h-[90%]" />
                <div className="mx-1 h-[40%] flex-1 rounded-t-lg bg-[#444748]/50 transition-all group-hover:h-[60%]" />
                <div className="mx-1 h-[60%] flex-1 rounded-t-lg bg-white transition-all group-hover:h-[75%]" />
                <div className="mx-1 h-[30%] flex-1 rounded-t-lg bg-[#444748]/50 transition-all group-hover:h-[50%]" />
                <div className="mx-1 h-[50%] flex-1 rounded-t-lg bg-[#444748]/50 transition-all group-hover:h-[70%]" />
              </div>
            </div>

            <div className="flex flex-col rounded-3xl border border-[#444748]/20 bg-[#1f1f1f] p-10 transition-all duration-500 hover:bg-[#2a2a2a] md:col-span-4">
              <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-xl bg-[#353535] text-white">
                <Zap className="h-6 w-6" />
              </div>
              <h3 className="mb-4 text-2xl font-bold tracking-tight text-white">
                Instant Invites
              </h3>
              <p className="mb-8 leading-relaxed text-[#c4c7c8]">
                Generate a unique one-time link and start talking.
                Links burn after use.
              </p>
              <div className="mt-auto border-t border-[#444748]/30 pt-6">
                <div className="truncate rounded-xl bg-[#1b1b1b] p-4 font-mono text-xs text-[#c7c6c6]">
                  nullchat.io/temp/8xK2-pL9q-mN5v
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-[#444748]/20 bg-[#1f1f1f] p-10 transition-all duration-500 hover:bg-[#2a2a2a] md:col-span-4">
              <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-xl bg-[#353535] text-white">
                <TimerOff className="h-6 w-6" />
              </div>
              <h3 className="mb-4 text-2xl font-bold tracking-tight text-white">
                Ephemeral Rooms
              </h3>
              <p className="leading-relaxed text-[#c4c7c8]">
                Data exists only in RAM. Once the tab closes, the
                room and its history vanish forever.
              </p>
            </div>

            <div
              className="flex flex-row items-center justify-between rounded-3xl border border-[#444748]/20 bg-[#1f1f1f] p-10 transition-all duration-500 hover:bg-[#2a2a2a] md:col-span-8"
              id="security"
            >
              <div className="max-w-sm">
                <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-xl bg-[#353535] text-white">
                  <Lock className="h-6 w-6" />
                </div>
                <h3 className="mb-4 text-2xl font-bold tracking-tight text-white">
                  Post-Quantum Crypto
                </h3>
                <p className="leading-relaxed text-[#c4c7c8]">
                  Prepared for the future of decryption. Your
                  messages are wrapped in industry-leading
                  quantum-resistant layers.
                </p>
              </div>
              <div className="relative hidden h-48 w-48 lg:block">
                <div className="absolute inset-0 animate-pulse rounded-full border-[10px] border-white/10" />
                <div className="absolute inset-8 rounded-full border-[10px] border-white/20" />
                <div className="absolute inset-16 rounded-full bg-white/30" />
              </div>
            </div>
          </div>
        </section>

        <section
          className="mx-auto mb-24 max-w-4xl px-8 py-32 text-center"
          id="pricing"
        >
          <h2 className="mb-8 text-5xl font-bold leading-tight tracking-tighter text-white md:text-6xl">
            Privacy is not a feature.
            <br />
            <span className="text-[#c4c7c8]">It&apos;s the foundation.</span>
          </h2>
          <p className="mx-auto mb-12 max-w-xl text-lg text-[#c7c6c6]">
            Join the silent revolution. Start your first anonymous
            session in less than 3 seconds.
          </p>
          <Link
            className="inline-block rounded-full bg-white px-12 py-5 text-xl font-bold text-black shadow-xl transition-all hover:-translate-y-1 hover:shadow-white/10"
            href="/groups"
          >
            Open Nullchat
          </Link>
        </section>
      </main>

      <footer className="w-full border-t border-white/5 bg-[#131313] py-20">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-8 px-8 md:flex-row">
          <div className="flex flex-col items-center gap-4 md:items-start">
            <div className="text-lg font-bold text-white">Nullchat</div>
            <p className="text-xs font-light leading-relaxed text-[#C4C7C8]">
              © 2026 Nullchat. Anonymous by design.
            </p>
          </div>
          <div className="flex gap-8 text-xs font-light text-[#C4C7C8]">
            <a
              className="transition-all hover:underline decoration-white/30"
              href="#"
            >
              Privacy
            </a>
            <a
              className="transition-all hover:underline decoration-white/30"
              href="#"
            >
              Terms
            </a>
            <a
              className="transition-all hover:underline decoration-white/30"
              href="#"
            >
              Github
            </a>
            <a
              className="transition-all hover:underline decoration-white/30"
              href="#"
            >
              Status
            </a>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex -space-x-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-[#131313] bg-[#1f1f1f] text-[10px] font-bold">
                JD
              </div>
              <div className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-[#131313] bg-[#1f1f1f] text-[10px] font-bold">
                MK
              </div>
              <div className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-[#131313] bg-[#1f1f1f] text-[10px] font-bold">
                AS
              </div>
            </div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-[#c4c7c8]">
              12k Active Nodes
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
