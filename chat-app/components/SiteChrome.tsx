"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowUpRight } from "lucide-react";
import ModeToggle from "@/components/ModeToggle";

export function Logo({ className = "" }: { className?: string }) {
  return (
    <Link className={`flex items-center gap-2 ${className}`} href="/">
      <span className="grid h-7 w-7 place-items-center rounded-full bg-foreground">
        <span className="h-2.5 w-2.5 rounded-full bg-background" />
      </span>
      <span className="text-lg font-bold tracking-tighter">Nullchat</span>
    </Link>
  );
}

export function GridBackground({ origin = "50% 0%" }: { origin?: string }) {
  const mask = `radial-gradient(ellipse at ${origin}, black 15%, transparent 75%)`;
  return (
    <div
      className="pointer-events-none fixed inset-0 z-0 opacity-[0.05] dark:opacity-[0.07]"
      style={{
        backgroundImage:
          "linear-gradient(currentColor 1px, transparent 1px), linear-gradient(90deg, currentColor 1px, transparent 1px)",
        backgroundSize: "56px 56px",
        maskImage: mask,
        WebkitMaskImage: mask,
      }}
    />
  );
}

export function SiteNav({ active }: { active?: "about" }) {
  return (
    <nav className="fixed top-0 z-50 w-full border-b border-border/60 bg-background/70 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3.5 sm:px-6 md:px-8">
        <Logo />
        <div className="flex items-center gap-4 sm:gap-6">
          <Link
            className={`text-sm transition-colors hover:text-foreground ${
              active === "about" ? "font-semibold text-foreground" : "text-muted-foreground"
            }`}
            href="/about"
          >
            About
          </Link>
          <ModeToggle className="h-10 w-10 border-border bg-transparent text-foreground hover:border-foreground/40" />
          <Link
            className="rounded-full bg-foreground px-5 py-2 text-sm font-bold text-background transition-transform active:scale-95"
            href="/groups"
          >
            Launch App
          </Link>
        </div>
      </div>
    </nav>
  );
}

export function SiteFooter() {
  return (
    <footer className="relative z-10 border-t border-border">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-6 px-4 py-12 sm:px-6 md:flex-row md:px-8">
        <div className="flex items-center gap-2">
          <span className="grid h-6 w-6 place-items-center rounded-full bg-foreground">
            <span className="h-2 w-2 rounded-full bg-background" />
          </span>
          <span className="font-bold tracking-tighter">Nullchat</span>
          <span className="ml-3 text-xs text-muted-foreground">
            © 2026 · Anonymous by design.
          </span>
        </div>
        <div className="flex flex-wrap justify-center gap-8 text-sm text-muted-foreground">
          <Link className="transition-colors hover:text-foreground" href="/about">About</Link>
          <Link className="transition-colors hover:text-foreground" href="/privacy">Privacy</Link>
          <Link className="transition-colors hover:text-foreground" href="/terms">Terms</Link>
          <Link className="transition-colors hover:text-foreground" href="/status">Status</Link>
          <a className="transition-colors hover:text-foreground" href="mailto:support@nullchat.tech">Support</a>
        </div>
      </div>
    </footer>
  );
}

export function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-5 flex items-center gap-3 font-mono text-[11px] uppercase tracking-[0.25em] text-muted-foreground">
      <span className="h-px w-8 bg-foreground/40" />
      {children}
    </div>
  );
}

export function Reveal({
  children,
  delay = 0,
  className,
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.65, delay, ease: [0.21, 0.6, 0.35, 1] }}
    >
      {children}
    </motion.div>
  );
}

export function PageShell({
  children,
  active,
}: {
  children: React.ReactNode;
  active?: "about";
}) {
  return (
    <div className="relative min-h-screen overflow-x-hidden bg-background text-foreground selection:bg-foreground selection:text-background">
      <GridBackground />
      <SiteNav active={active} />
      <main className="relative z-10">{children}</main>
      <SiteFooter />
    </div>
  );
}

export function CtaBand({
  title,
  sub,
  href = "/groups",
  label = "Open Nullchat",
}: {
  title: React.ReactNode;
  sub: string;
  href?: string;
  label?: string;
}) {
  return (
    <section className="mx-auto max-w-7xl px-4 pb-24 sm:px-6 md:px-8 md:pb-32">
      <Reveal>
        <div className="relative overflow-hidden rounded-[2rem] bg-foreground px-6 py-16 text-center text-background md:rounded-[3rem] md:py-24">
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.08]"
            style={{
              backgroundImage:
                "linear-gradient(currentColor 1px, transparent 1px), linear-gradient(90deg, currentColor 1px, transparent 1px)",
              backgroundSize: "48px 48px",
            }}
          />
          <h2 className="relative mx-auto max-w-3xl text-4xl font-bold leading-[0.95] tracking-tighter sm:text-5xl md:text-6xl">
            {title}
          </h2>
          <p className="relative mx-auto mt-6 max-w-lg text-lg opacity-70">{sub}</p>
          <div className="relative mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              className="inline-flex items-center gap-2 rounded-full bg-background px-9 py-4 text-base font-bold text-foreground transition-transform hover:scale-[1.04] active:scale-95"
              href={href}
            >
              {label}
              <ArrowUpRight className="h-5 w-5" />
            </Link>
            <a
              className="inline-flex items-center gap-2 rounded-full border border-background/30 px-9 py-4 text-base font-semibold transition-colors hover:border-background/70"
              href="mailto:feedback@nullchat.tech"
            >
              Share feedback
            </a>
          </div>
        </div>
      </Reveal>
    </section>
  );
}
