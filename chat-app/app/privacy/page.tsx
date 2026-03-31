import type { Metadata } from "next";
import Link from "next/link";
import ModeToggle from "@/components/ModeToggle";

export const metadata: Metadata = {
  title: "Privacy Policy — Nullchat",
  description:
    "How Nullchat handles ephemeral rooms, encryption, temporary identifiers, and media lifecycle.",
};

const sections = [
  {
    title: "1. Core privacy model",
    body: "Nullchat is built for temporary conversations. Rooms are designed to be short-lived, and we minimize persistent data by default.",
  },
  {
    title: "2. What we collect",
    body: "We do not require account creation for standard use. Temporary identifiers may be stored locally in your browser to make room management and re-entry smoother.",
  },
  {
    title: "3. Messages and encryption",
    body: "Messages are encrypted for transit and intended for ephemeral use. Session links include cryptographic context required to join a room.",
  },
  {
    title: "4. Media uploads",
    body: "Images and shared media are stored only to support active room usage. Cleanup routines remove files when rooms end or become inactive.",
  },
  {
    title: "5. Analytics",
    body: "We may use lightweight analytics to understand overall usage trends and improve reliability. We do not build advertising profiles.",
  },
  {
    title: "6. Your controls",
    body: "You can leave a room at any time, clear browser storage, and stop sharing links. If you need help or data clarifications, contact support.",
  },
];

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-[#f6f7f8] text-[#1f2328] dark:bg-[#131313] dark:text-[#e2e2e2]">
      <nav className="sticky top-0 z-30 border-b border-black/10 bg-white/70 backdrop-blur-xl dark:border-white/10 dark:bg-[#1B1B1B]/60">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 sm:px-6">
          <Link className="text-lg font-bold tracking-tight" href="/">
            Nullchat
          </Link>
          <div className="flex items-center gap-3">
            <ModeToggle className="h-10 w-10 border-border bg-transparent text-foreground hover:border-foreground/40" />
            <Link
              className="rounded-full bg-foreground px-4 py-2 text-sm font-bold text-background"
              href="/groups"
            >
              Launch App
            </Link>
          </div>
        </div>
      </nav>

      <section className="mx-auto max-w-5xl px-4 py-12 sm:px-6 md:py-16">
        <p className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-[#5e6368] dark:text-[#c7c6c6]">
          Nullchat Legal
        </p>
        <h1 className="mb-4 text-4xl font-black tracking-tight sm:text-5xl">
          Privacy Policy
        </h1>
        <p className="max-w-3xl text-base leading-relaxed text-[#4f555c] dark:text-[#c4c7c8] sm:text-lg">
          This page explains how Nullchat handles privacy, temporary room data,
          and user safety controls.
        </p>

        <div className="mt-10 space-y-4">
          {sections.map((section) => (
            <article
              key={section.title}
              className="rounded-2xl border border-black/10 bg-white/70 p-6 dark:border-white/10 dark:bg-[#1f1f1f]"
            >
              <h2 className="mb-2 text-xl font-bold">{section.title}</h2>
              <p className="leading-relaxed text-[#4f555c] dark:text-[#c4c7c8]">
                {section.body}
              </p>
            </article>
          ))}
        </div>

        <p className="mt-10 text-sm text-[#4f555c] dark:text-[#c4c7c8]">
          Questions? Contact us at{" "}
          <a className="underline" href="mailto:support@nullchat.tech">
            support@nullchat.tech
          </a>
          .
        </p>
      </section>
    </main>
  );
}
