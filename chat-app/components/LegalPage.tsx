"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PageShell, Eyebrow } from "@/components/SiteChrome";

export type LegalSection = { title: string; body: string };

const slug = (title: string) =>
  title.toLowerCase().replace(/^\d+\.\s*/, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

export default function LegalPage({
  label,
  title,
  intro,
  sections,
  other,
}: {
  label: string;
  title: string;
  intro: string;
  sections: LegalSection[];
  other: { href: string; label: string };
}) {
  const [activeId, setActiveId] = useState(slug(sections[0].title));

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.find((e) => e.isIntersecting);
        if (visible) setActiveId(visible.target.id);
      },
      { rootMargin: "-30% 0px -60% 0px" }
    );
    sections.forEach((s) => {
      const el = document.getElementById(slug(s.title));
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [sections]);

  return (
    <PageShell>
      <section className="mx-auto max-w-7xl px-4 pb-28 pt-32 sm:px-6 md:px-8 md:pt-44">
        <Eyebrow>{label}</Eyebrow>
        <h1 className="text-5xl font-bold leading-[0.92] tracking-tighter md:text-7xl">
          {title}
        </h1>
        <p className="mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground">
          {intro}
        </p>

        <div className="mt-16 grid gap-12 lg:grid-cols-[260px_1fr]">
          <aside className="hidden lg:block">
            <nav className="sticky top-28 space-y-1 border-l border-border">
              {sections.map((s) => {
                const id = slug(s.title);
                const on = activeId === id;
                return (
                  <a
                    key={id}
                    href={`#${id}`}
                    className={`-ml-px block border-l py-2 pl-5 text-sm transition-colors ${
                      on
                        ? "border-foreground font-semibold text-foreground"
                        : "border-transparent text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {s.title}
                  </a>
                );
              })}
            </nav>
          </aside>

          <div className="max-w-3xl divide-y divide-border border-y border-border">
            {sections.map((s, i) => (
              <article className="scroll-mt-28 py-9" id={slug(s.title)} key={s.title}>
                <div className="mb-3 flex items-baseline gap-4">
                  <span className="font-mono text-xs text-muted-foreground">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <h2 className="text-2xl font-bold tracking-tight">
                    {s.title.replace(/^\d+\.\s*/, "")}
                  </h2>
                </div>
                <p className="pl-9 leading-relaxed text-muted-foreground">{s.body}</p>
              </article>
            ))}

            <div className="flex flex-col gap-4 py-9 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
              <span>
                Questions? Contact{" "}
                <a className="text-foreground underline underline-offset-2" href="mailto:support@nullchat.tech">
                  support@nullchat.tech
                </a>
              </span>
              <Link className="font-semibold text-foreground hover:underline" href={other.href}>
                {other.label} →
              </Link>
            </div>
          </div>
        </div>
      </section>
    </PageShell>
  );
}
