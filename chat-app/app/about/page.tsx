import type { Metadata } from "next";
import Link from "next/link";
import { Button, Card } from "@/components/ui/basic";

export const metadata: Metadata = {
    title: "About Nullchat — Private, Ephemeral Group Chat",
    description:
        "Nullchat is a privacy-first group chat where messages are ephemeral and identity is temporary. Create rooms, invite instantly, and stay anonymous.",
    openGraph: {
        title: "About Nullchat — Private, Ephemeral Group Chat",
        description:
            "Nullchat is a privacy-first group chat where messages are ephemeral and identity is temporary. Create rooms, invite instantly, and stay anonymous.",
        url: "/about",
        siteName: "Nullchat",
        type: "website",
    },
    twitter: {
        card: "summary",
        title: "About Nullchat — Private, Ephemeral Group Chat",
        description:
            "Nullchat is a privacy-first group chat where messages are ephemeral and identity is temporary. Create rooms, invite instantly, and stay anonymous.",
    },
};

export default function AboutPage() {
    return (
        <main className="min-h-screen bg-background selection:bg-primary selection:text-primary-foreground">
            <div className="mx-auto max-w-4xl px-6 py-12 sm:py-16 lg:py-20 space-y-10">
                <header className="space-y-4">
                    <p className="text-xs uppercase tracking-wider text-muted-foreground">About</p>
                    <h1 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight text-foreground">
                        Conversations, without the footprint.
                    </h1>
                    <p className="text-base sm:text-lg text-muted-foreground max-w-2xl">
                        Nullchat is built for fast, private group conversations. No accounts. No profiles. Just a room,
                        a link, and a moment shared.
                    </p>
                </header>

                <section className="grid gap-6 sm:grid-cols-2">
                    <Card className="group p-6 rounded-2xl border border-border bg-card/60 backdrop-blur transition-all duration-300 ease-out hover:-translate-y-1.5 hover:bg-white hover:border-white/60 hover:shadow-2xl">
                        <h2 className="text-lg font-semibold text-foreground transition-colors duration-300 group-hover:text-black">Anonymous by design</h2>
                        <p className="text-sm text-muted-foreground mt-2 transition-colors duration-300 group-hover:text-black/80">
                            Use a temporary identity. Your display name is yours for the session and disappears when you leave.
                        </p>
                    </Card>
                    <Card className="group p-6 rounded-2xl border border-border bg-card/60 backdrop-blur transition-all duration-300 ease-out hover:-translate-y-1.5 hover:bg-white hover:border-white/60 hover:shadow-2xl">
                        <h2 className="text-lg font-semibold text-foreground transition-colors duration-300 group-hover:text-black">Ephemeral rooms</h2>
                        <p className="text-sm text-muted-foreground mt-2 transition-colors duration-300 group-hover:text-black/80">
                            Rooms live for the moment. When the session ends, the slate is clean for everyone.
                        </p>
                    </Card>
                    <Card className="group p-6 rounded-2xl border border-border bg-card/60 backdrop-blur transition-all duration-300 ease-out hover:-translate-y-1.5 hover:bg-white hover:border-white/60 hover:shadow-2xl">
                        <h2 className="text-lg font-semibold text-foreground transition-colors duration-300 group-hover:text-black">Invite instantly</h2>
                        <p className="text-sm text-muted-foreground mt-2 transition-colors duration-300 group-hover:text-black/80">
                            Share a single link to bring people in. No logins, no friction—just start talking.
                        </p>
                    </Card>
                    <Card className="group p-6 rounded-2xl border border-border bg-card/60 backdrop-blur transition-all duration-300 ease-out hover:-translate-y-1.5 hover:bg-white hover:border-white/60 hover:shadow-2xl">
                        <h2 className="text-lg font-semibold text-foreground transition-colors duration-300 group-hover:text-black">Signal, not noise</h2>
                        <p className="text-sm text-muted-foreground mt-2 transition-colors duration-300 group-hover:text-black/80">
                            Clean UI and focused flow keep the chat calm and readable, even when the room is busy.
                        </p>
                    </Card>
                </section>

                <section className="space-y-3">
                    <h2 className="text-xl font-bold text-foreground">Why Nullchat?</h2>
                    <p className="text-sm sm:text-base text-muted-foreground">
                        Some conversations are better when they are temporary. Nullchat keeps the barrier low and the privacy high,
                        so teams can sync, friends can plan, and communities can brainstorm—without leaving a trace.
                    </p>
                </section>

                <section className="flex flex-wrap items-center gap-3">
                    <Button asChild className="rounded-full px-6">
                        <Link href="/groups">Start chatting</Link>
                    </Button>
                    <Button asChild variant="secondary" className="rounded-full px-6">
                        <Link href="mailto:feedback@nullchat.tech">Share feedback</Link>
                    </Button>
                </section>
            </div>
        </main>
    );
}
