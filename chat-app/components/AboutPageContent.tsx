"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import ModeToggle from "@/components/ModeToggle";
import {
    AudioLines,
    BotMessageSquare,
    Fingerprint,
    ImagePlus,
    Link2,
    MessageSquareReply,
    Waves,
} from "lucide-react";

export default function AboutPageContent() {
    const [cursor, setCursor] = useState({ x: 0, y: 0 });

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
                "Rooms live for the moment. When the session ends, the slate is clean for everyone—including all shared media.",
            icon: BotMessageSquare,
        },
        {
            title: "Invite instantly",
            description:
                "Share a single link to bring people in. No logins, no friction—just start talking.",
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
            icon: BotMessageSquare,
        },
        {
            title: "Smart replies & mentions",
            description:
                "Reply to specific messages and mention users by name. Threads keep conversations organized.",
            icon: MessageSquareReply,
        },
    ];

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            setCursor({ x: e.clientX, y: e.clientY });
        };

        window.addEventListener("mousemove", handleMouseMove);
        return () => window.removeEventListener("mousemove", handleMouseMove);
    }, []);

    return (
        <div className="relative min-h-screen overflow-hidden bg-[#f6f7f8] font-sans text-[#1f2328] selection:bg-black selection:text-white dark:bg-[#131313] dark:text-[#e2e2e2] dark:selection:bg-white dark:selection:text-[#2f3131]">
            <div
                className="pointer-events-none fixed inset-0 z-[60] opacity-[0.018] dark:opacity-[0.03]"
                style={{
                    backgroundImage:
                        "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E\")",
                }}
            />

            <div
                className="pointer-events-none fixed z-[2] h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full dark:hidden"
                style={{
                    left: `${cursor.x}px`,
                    top: `${cursor.y}px`,
                    background:
                        "radial-gradient(circle, rgba(0,0,0,0.06) 0%, rgba(0,0,0,0) 70%)",
                }}
            />
            <div
                className="pointer-events-none fixed z-[2] hidden h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full dark:block"
                style={{
                    left: `${cursor.x}px`,
                    top: `${cursor.y}px`,
                    background:
                        "radial-gradient(circle, rgba(255,255,255,0.035) 0%, rgba(255,255,255,0) 70%)",
                }}
            />

            <nav className="fixed top-0 z-50 flex h-20 w-full items-center justify-between bg-white/70 px-4 shadow-[0_20px_50px_-20px_rgba(0,0,0,0.2)] backdrop-blur-xl dark:bg-[#1B1B1B]/60 dark:shadow-[0_40px_60px_-15px_rgba(226,226,226,0.06)] sm:px-6 md:px-24">
                <div className="text-2xl font-black tracking-tighter text-foreground">
                    Nullchat
                </div>
                <div className="hidden items-center gap-6 md:flex">
                    <Link
                        className="border-b-2 border-foreground pb-1 font-bold tracking-tight text-foreground"
                        href="/about"
                    >
                        About
                    </Link>
                    <ModeToggle className="h-10 w-10 border-border bg-transparent text-foreground hover:border-foreground/40" />
                    <Link
                        href="/groups"
                        className="rounded-full bg-foreground px-8 py-3 font-bold text-background transition-transform duration-200 ease-out hover:scale-[1.02] active:scale-95"
                    >
                        Launch App
                    </Link>
                </div>
                <div className="flex items-center gap-3 md:hidden">
                    <ModeToggle className="h-10 w-10 border-border bg-transparent text-foreground hover:border-foreground/40" />
                    <Link
                        href="/groups"
                        className="rounded-full bg-foreground px-4 py-2 text-sm font-bold text-background"
                    >
                        Launch
                    </Link>
                </div>
            </nav>

            <main className="relative z-10 overflow-hidden pb-24 pt-32">
                <section className="mx-auto mb-20 max-w-7xl px-4 sm:px-6 md:mb-32 md:px-24">
                    <div className="max-w-4xl">
                        <h1 className="mb-6 text-4xl font-black leading-[0.9] tracking-tighter text-foreground sm:text-5xl md:mb-8 md:text-8xl">
                            Conversations, <br />
                            <span className="text-[#5e6368] dark:text-[#c7c6c6]">without the footprint.</span>
                        </h1>
                        <p className="max-w-2xl text-base font-medium leading-relaxed text-[#4f555c] dark:text-[#c4c7c8] sm:text-lg md:text-2xl">
                            Nullchat is built for fast, private group conversations
                            with rich media support. Share images, voice messages,
                            and polls instantly. No accounts. No profiles. Just a
                            room, a link, and moments shared together.
                        </p>
                    </div>
                </section>

                <section className="mx-auto max-w-7xl px-4 sm:px-6 md:px-24">
                    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                        {features.map((feature, idx) => {
                            const Icon = feature.icon;
                            return (
                                <article
                                    key={idx}
                                    className="group h-full rounded-xl border border-black/10 bg-white/60 p-6 backdrop-blur-[12px] transition-all duration-300 ease-out hover:scale-[1.01] hover:border-black/25 hover:bg-white/80 hover:-translate-y-1 dark:border-[#444748]/15 dark:bg-[rgba(31,31,31,0.4)] dark:hover:border-white/20 dark:hover:bg-[rgba(42,42,42,0.6)] sm:p-10"
                                >
                                    <div className="mb-8 flex h-12 w-12 items-center justify-center rounded-lg bg-black/5 dark:bg-[#2a2a2a]">
                                        <Icon className="h-6 w-6 text-foreground" />
                                    </div>
                                    <h3 className="mb-4 text-xl font-bold tracking-tight text-foreground sm:text-2xl">
                                        {feature.title}
                                    </h3>
                                    <p className="leading-relaxed text-[#4f555c] dark:text-[#c4c7c8]">
                                        {feature.description}
                                    </p>
                                </article>
                            );
                        })}
                    </div>
                </section>

                <section className="mx-auto mt-24 max-w-7xl px-4 text-center sm:px-6 md:mt-40 md:px-24">
                    <div className="mx-auto max-w-3xl">
                        <h2 className="mb-8 text-3xl font-black tracking-tighter text-foreground md:text-5xl">
                            Why Nullchat?
                        </h2>
                        <p className="mb-12 text-base leading-relaxed text-[#4f555c] dark:text-[#c4c7c8] sm:text-lg md:text-2xl">
                            Some conversations are better when they are temporary.
                            Nullchat keeps the barrier low and the privacy high, so
                            teams can sync, friends can plan, and communities can
                            brainstorm—without leaving a trace.
                        </p>
                        <div className="flex flex-col items-center justify-center gap-4 md:flex-row">
                            <Link
                                href="/groups"
                                className="w-full rounded-full bg-foreground px-12 py-5 text-center text-lg font-bold text-background transition-transform duration-300 hover:scale-105 md:w-auto"
                            >
                                Start chatting
                            </Link>
                            <Link
                                href="mailto:feedback@nullchat.tech"
                                className="w-full rounded-full border border-black/15 bg-black/5 px-12 py-5 text-center text-lg font-bold text-foreground transition-colors hover:bg-black/10 dark:border-[#444748]/25 dark:bg-[#2a2a2a] dark:hover:bg-[#353535] md:w-auto"
                            >
                                Share feedback
                            </Link>
                        </div>
                    </div>
                </section>
            </main>

            <footer className="w-full border-t border-black/10 bg-[#f6f7f8] py-20 text-sm leading-relaxed dark:border-[#444748]/15 dark:bg-[#131313]">
                <div className="flex w-full flex-col items-center justify-between px-4 sm:px-6 md:flex-row md:px-24">
                    <div className="flex flex-col items-center gap-4 md:items-start">
                        <div className="text-lg font-bold text-foreground">Nullchat</div>
                        <p className="text-[#4f555c] opacity-80 dark:text-[#C4C7C8]">
                            © 2024 Nullchat. Crafted in the void.
                        </p>
                    </div>
                    <div className="mt-12 flex flex-wrap justify-center gap-5 md:mt-0 md:gap-8">
                        <a className="text-[#4f555c] transition-colors hover:text-foreground dark:text-[#C4C7C8] dark:hover:text-white" href="#">
                            Privacy
                        </a>
                        <a className="text-[#4f555c] transition-colors hover:text-foreground dark:text-[#C4C7C8] dark:hover:text-white" href="#">
                            Terms
                        </a>
                        <a className="text-[#4f555c] transition-colors hover:text-foreground dark:text-[#C4C7C8] dark:hover:text-white" href="#">
                            Github
                        </a>
                        <a className="text-[#4f555c] transition-colors hover:text-foreground dark:text-[#C4C7C8] dark:hover:text-white" href="#">
                            Status
                        </a>
                    </div>
                </div>
            </footer>

            <div className="pointer-events-none fixed -right-[5%] -top-[10%] -z-10 h-[50vw] w-[50vw] rounded-full bg-black/10 blur-[120px] dark:bg-white/5" />
            <div className="pointer-events-none fixed -bottom-[10%] -left-[5%] -z-10 h-[40vw] w-[40vw] rounded-full bg-black/10 blur-[100px] dark:bg-white/5" />
        </div>
    );
}
