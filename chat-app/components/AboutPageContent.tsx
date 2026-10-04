"use client";

import {
    AudioLines,
    BarChart3,
    Fingerprint,
    ImagePlus,
    Link2,
    MessageSquareReply,
    TimerOff,
    Waves,
} from "lucide-react";
import { PageShell, Eyebrow, Reveal, CtaBand } from "@/components/SiteChrome";

const features = [
    {
        title: "Anonymous by design",
        description:
            "Use a temporary identity. Your display name is yours for the session and disappears when you leave.",
        icon: Fingerprint,
    },
    {
        title: "Ephemeral rooms",
        description:
            "Rooms live for the moment. When the session ends, the slate is clean for everyone, including all shared media.",
        icon: TimerOff,
    },
    {
        title: "Invite instantly",
        description:
            "Share a single link to bring people in. No logins, no friction. Just start talking.",
        icon: Link2,
    },
    {
        title: "Signal, not noise",
        description:
            "Clean UI and focused flow keep the chat calm and readable, even when the room is busy.",
        icon: Waves,
    },
    {
        title: "Share images & media",
        description:
            "Upload and share images up to 25MB. They're stored securely and automatically deleted when the room ends.",
        icon: ImagePlus,
    },
    {
        title: "Voice messages",
        description:
            "Send encrypted voice messages instantly. Record and share without leaving the chat.",
        icon: AudioLines,
    },
    {
        title: "Interactive polls",
        description:
            "Create single or multiple-choice polls. Gather opinions instantly and see real-time results.",
        icon: BarChart3,
    },
    {
        title: "Smart replies & mentions",
        description:
            "Reply to specific messages and mention users by name. Threads keep conversations organized.",
        icon: MessageSquareReply,
    },
];

const principles = [
    { n: "01", title: "Low barrier", body: "No accounts, no downloads. If you have a link, you're in." },
    { n: "02", title: "High privacy", body: "Temporary names, ephemeral rooms and encrypted messages by default." },
    { n: "03", title: "Leave no trace", body: "When the room ends, the conversation and its media go with it." },
];

export default function AboutPageContent() {
    return (
        <PageShell active="about">
            {/* Hero */}
            <section className="mx-auto max-w-7xl px-4 pb-24 pt-32 sm:px-6 md:px-8 md:pb-36 md:pt-44">
                <Eyebrow>About Nullchat</Eyebrow>
                <h1 className="max-w-5xl text-5xl font-bold leading-[0.92] tracking-tighter sm:text-6xl md:text-8xl">
                    Conversations,
                    <br />
                    <span className="text-muted-foreground">without the footprint.</span>
                </h1>
                <p className="mt-8 max-w-2xl text-lg leading-relaxed text-muted-foreground md:text-xl">
                    Nullchat is built for fast, private group conversations with rich
                    media support. Share images, voice messages and polls instantly.
                    No accounts. No profiles. Just a room, a link, and moments shared
                    together.
                </p>
            </section>

            {/* Principles */}
            <section className="mx-auto max-w-7xl px-4 pb-24 sm:px-6 md:px-8 md:pb-36">
                <div className="grid gap-px overflow-hidden rounded-3xl border border-border bg-border md:grid-cols-3">
                    {principles.map((p, i) => (
                        <Reveal className="h-full" delay={i * 0.1} key={p.n}>
                            <div className="group h-full bg-background p-8 transition-colors hover:bg-card md:p-10">
                                <div className="font-mono text-5xl font-bold tracking-tighter text-foreground/15 transition-colors group-hover:text-foreground/60">
                                    {p.n}
                                </div>
                                <h3 className="mb-3 mt-8 text-2xl font-bold tracking-tight">{p.title}</h3>
                                <p className="leading-relaxed text-muted-foreground">{p.body}</p>
                            </div>
                        </Reveal>
                    ))}
                </div>
            </section>

            {/* Features */}
            <section className="mx-auto max-w-7xl px-4 pb-24 sm:px-6 md:px-8 md:pb-36">
                <Reveal>
                    <Eyebrow>What&apos;s inside</Eyebrow>
                    <h2 className="mb-14 max-w-3xl text-4xl font-bold leading-[0.95] tracking-tighter md:text-6xl">
                        Everything you need.
                        <span className="text-muted-foreground"> Nothing you don&apos;t.</span>
                    </h2>
                </Reveal>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    {features.map((f, i) => (
                        <Reveal delay={(i % 4) * 0.07} key={f.title}>
                            <article className="group relative h-full overflow-hidden rounded-3xl border border-border bg-card/60 p-7 transition-all duration-500 hover:-translate-y-1 hover:border-foreground/40">
                                <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-foreground/5 transition-transform duration-700 group-hover:scale-[2.5]" />
                                <div className="relative mb-12 grid h-12 w-12 place-items-center rounded-2xl bg-foreground text-background">
                                    <f.icon className="h-5 w-5" />
                                </div>
                                <h3 className="relative mb-2 text-xl font-bold tracking-tight">{f.title}</h3>
                                <p className="relative text-sm leading-relaxed text-muted-foreground">
                                    {f.description}
                                </p>
                            </article>
                        </Reveal>
                    ))}
                </div>
            </section>

            {/* Why */}
            <section className="mx-auto max-w-4xl px-4 pb-24 text-center sm:px-6 md:px-8 md:pb-36">
                <Reveal>
                    <Eyebrow>Why Nullchat?</Eyebrow>
                    <p className="text-2xl font-medium leading-snug tracking-tight md:text-4xl">
                        Some conversations are better when they are temporary.
                        <span className="text-muted-foreground">
                            {" "}
                            Nullchat keeps the barrier low and the privacy high, so teams
                            can sync, friends can plan, and communities can brainstorm,
                            without leaving a trace.
                        </span>
                    </p>
                </Reveal>
            </section>

            <CtaBand
                title={
                    <>
                        Ready when you are.
                        <br />
                        <span className="opacity-50">Gone when you&apos;re done.</span>
                    </>
                }
                sub="Open a room and share the link in under three seconds."
                label="Start chatting"
            />
        </PageShell>
    );
}
