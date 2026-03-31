import type { Metadata } from "next";
import Link from "next/link";
import ModeToggle from "@/components/ModeToggle";

export const metadata: Metadata = {
  title: "Terms of Use — Nullchat",
  description:
    "Terms governing use of Nullchat, including acceptable use, room ownership, and limitations.",
};

const sections = [
  {
    title: "1. Acceptance of terms",
    body: "By using Nullchat, you agree to these terms and applicable laws. If you do not agree, do not use the service.",
  },
  {
    title: "2. Acceptable use",
    body: "Do not use Nullchat for unlawful, abusive, or harmful behavior. You are responsible for content shared in rooms you create or join.",
  },
  {
    title: "3. Room lifecycle",
    body: "Rooms are ephemeral by design. Content may be deleted automatically when a room ends or becomes inactive.",
  },
  {
    title: "4. Availability",
    body: "We aim for reliable uptime but cannot guarantee uninterrupted availability. Features may change or be removed.",
  },
  {
    title: "5. Limitation of liability",
    body: "Nullchat is provided as-is. To the extent allowed by law, we are not liable for indirect, incidental, or consequential damages.",
  },
  {
    title: "6. Contact",
    body: "For legal or support questions, reach out to support@nullchat.tech.",
  },
];

export default function TermsPage() {
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
          Terms of Use
        </h1>
        <p className="max-w-3xl text-base leading-relaxed text-[#4f555c] dark:text-[#c4c7c8] sm:text-lg">
          These terms describe the rules and responsibilities for using Nullchat.
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
      </section>
    </main>
  );
}
