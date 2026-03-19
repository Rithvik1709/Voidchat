"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button, Card, CardContent } from './ui/basic';
import { Users, LogIn, Zap, Plus } from 'lucide-react';
import CreateGroupModal from './CreateGroupModal';
import ModeToggle from './ModeToggle';

interface Group {
    id: string;
    name: string;
    tags: string[];
    active_user_count: number;
    key?: string;
}

export default function GroupList() {
    const [groups, setGroups] = useState<Group[]>([]);
    const [loading, setLoading] = useState(true);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [creatorId, setCreatorId] = useState<string>('');
    const [cursor, setCursor] = useState({ x: 0, y: 0 });

    useEffect(() => {
        // Get or create creator ID from localStorage
        let id = localStorage.getItem('creator_id');
        if (!id) {
            id = crypto.randomUUID();
            localStorage.setItem('creator_id', id);
        }
        setCreatorId(id);
    }, []);

    const fetchGroups = async () => {
        if (!creatorId) return;
        
        try {
            const res = await fetch(`/api/groups?creator_id=${encodeURIComponent(creatorId)}`);
            if (res.ok) {
                const data = await res.json();
                setGroups(data);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const cleanupEmptyGroups = async () => {
        try {
            await fetch('/api/groups/cleanup', { method: 'DELETE' });
        } catch (err) {
            console.error('Cleanup error:', err);
        }
    };

    useEffect(() => {
        if (!creatorId) return;
        
        fetchGroups();
        cleanupEmptyGroups();

        const fetchInterval = setInterval(fetchGroups, 5000);
        const cleanupInterval = setInterval(cleanupEmptyGroups, 60000);

        return () => {
            clearInterval(fetchInterval);
            clearInterval(cleanupInterval);
        };
    }, [creatorId]);

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            setCursor({ x: e.clientX, y: e.clientY });
        };

        window.addEventListener('mousemove', handleMouseMove);
        return () => window.removeEventListener('mousemove', handleMouseMove);
    }, []);

    return (
        <div className="relative min-h-screen overflow-hidden bg-[#f6f7f8] text-[#1f2328] dark:bg-[#131313] dark:text-[#e2e2e2] animate-in fade-in duration-700">
            <div
                className="pointer-events-none fixed inset-0 z-[1] opacity-[0.02] dark:opacity-[0.03]"
                style={{
                    backgroundImage:
                        "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E\")",
                }}
            />

            <div
                className="pointer-events-none fixed z-[2] h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full"
                style={{
                    left: `${cursor.x}px`,
                    top: `${cursor.y}px`,
                    background:
                        'radial-gradient(circle, rgba(0,0,0,0.06) 0%, rgba(0,0,0,0) 70%)',
                }}
            />

            <div
                className="pointer-events-none fixed z-[2] hidden h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full dark:block"
                style={{
                    left: `${cursor.x}px`,
                    top: `${cursor.y}px`,
                    background:
                        'radial-gradient(circle, rgba(255,255,255,0.035) 0%, rgba(255,255,255,0) 70%)',
                }}
            />

            <nav className="fixed top-0 z-50 w-full bg-white/70 shadow-2xl shadow-black/10 backdrop-blur-xl dark:bg-[#1B1B1B]/60 dark:shadow-black/20">
                <div className="mx-auto flex w-full max-w-screen-2xl items-center justify-between px-6 py-4">
                    <div className="flex items-center gap-2">
                        <Zap className="h-5 w-5 fill-current text-foreground" />
                        <span className="text-2xl font-black tracking-tight text-foreground">
                            Nullchat
                        </span>
                    </div>
                    <div className="flex items-center gap-6">
                        <Link
                            href="/about"
                            className="tracking-tight text-muted-foreground transition-colors duration-200 hover:text-foreground active:scale-95"
                        >
                            About
                        </Link>
                        <ModeToggle />
                    </div>
                </div>
            </nav>

            <main className="relative z-10 flex min-h-screen flex-col items-center justify-center px-6 pb-32 pt-24">
                {loading ? (
                    <div className="grid w-full max-w-screen-xl grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
                        {[1, 2, 3, 4, 5, 6].map((i) => (
                            <div
                                key={i}
                                className="h-52 animate-pulse rounded-[2rem] border border-border bg-card dark:border-[#444748]/40 dark:bg-[#1f1f1f]"
                            />
                        ))}
                    </div>
                ) : groups.length === 0 ? (
                    <div className="w-full max-w-lg text-center flex flex-col items-center">
                        <div className="relative mb-12">
                            <div className="absolute inset-0 rounded-full bg-black/10 blur-3xl dark:bg-white/10" />
                            <div className="relative flex h-32 w-32 items-center justify-center rounded-[2.5rem] bg-card shadow-2xl dark:bg-[#1b1b1b]">
                                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted dark:bg-[#353535]">
                                    <Plus className="h-10 w-10 text-foreground" strokeWidth={1.5} />
                                </div>
                            </div>
                        </div>

                        <h1 className="mb-6 text-4xl font-bold tracking-tight text-foreground md:text-5xl">
                            No groups yet
                        </h1>
                        <p className="mx-auto mb-10 max-w-sm text-lg leading-relaxed text-muted-foreground">
                            Create a private group and share the link with
                            friends. Only those with the link can join.
                        </p>

                        <Button
                            onClick={() => setShowCreateModal(true)}
                            className="group relative rounded-full bg-foreground px-8 py-4 font-bold text-background transition-all duration-300 hover:scale-[1.02] hover:shadow-[0_0_40px_rgba(0,0,0,0.12)] dark:hover:shadow-[0_0_40px_rgba(255,255,255,0.15)] active:scale-95"
                        >
                            <span className="relative z-10 flex items-center gap-2">
                                Start a Group
                            </span>
                        </Button>
                    </div>
                ) : (
                    <div className="w-full max-w-screen-xl space-y-8">
                        <div className="text-center">
                            <h2 className="text-3xl font-bold tracking-tight text-foreground md:text-4xl">
                                Your Groups
                            </h2>
                            <p className="mt-2 text-muted-foreground">
                                Jump back into active conversations.
                            </p>
                        </div>

                        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
                            {groups.map((group) => (
                                <Card
                                    key={group.id}
                                    className="group relative overflow-hidden rounded-[2rem] border border-border bg-card transition-all duration-300 hover:-translate-y-1 hover:border-foreground/30 hover:bg-accent dark:border-[#444748]/40 dark:bg-[#1f1f1f] dark:hover:border-white/40 dark:hover:bg-[#2a2a2a]"
                                >
                                    <CardContent className="relative z-10 flex h-full flex-col justify-between p-8">
                                        <div className="space-y-4">
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="min-w-0 flex-1 space-y-3 overflow-hidden">
                                                    <h3 className="truncate text-xl font-bold tracking-tight text-foreground transition-colors duration-300 group-hover:text-foreground/90">
                                                        {group.name}
                                                    </h3>
                                                    <div className="flex items-center gap-2">
                                                        <div
                                                            className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold transition-all duration-300 ${group.active_user_count > 0
                                                                ? 'border-foreground/30 bg-foreground/10 text-foreground'
                                                                : 'border-border bg-muted text-muted-foreground dark:border-[#444748] dark:bg-[#2a2a2a] dark:text-[#c4c7c8]'
                                                                }`}
                                                        >
                                                            <span className="relative flex h-2 w-2 shrink-0">
                                                                {group.active_user_count > 0 && (
                                                                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-foreground opacity-75" />
                                                                )}
                                                                <span
                                                                    className={`relative inline-flex h-2 w-2 rounded-full ${group.active_user_count > 0
                                                                        ? 'bg-foreground'
                                                                        : 'bg-muted-foreground'
                                                                        }`}
                                                                />
                                                            </span>
                                                            <Users className="h-3 w-3" />
                                                            <span>{group.active_user_count}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="flex flex-wrap gap-2">
                                                {group.tags?.slice(0, 3).map((tag, i) => (
                                                    <span
                                                        key={i}
                                                        className="rounded-full border border-border bg-muted px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide text-foreground dark:border-[#444748] dark:bg-[#2a2a2a] dark:text-[#e2e2e2]"
                                                    >
                                                        #{tag}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>

                                        <div className="mt-auto pt-6">
                                            <Button
                                                asChild
                                                className="group/btn h-12 w-full rounded-full border border-border bg-foreground font-bold text-background transition-all duration-300 hover:scale-[1.02] hover:bg-foreground/90 dark:border-[#444748]"
                                                variant="secondary"
                                            >
                                                <Link href={`/chat/${group.id}#key=${encodeURIComponent(group.key || '')}`}>
                                                    <span className="hidden sm:inline">
                                                        Join Conversation
                                                    </span>
                                                    <span className="sm:hidden">Join</span>
                                                    <LogIn className="ml-2 h-4 w-4 transition-transform group-hover/btn:translate-x-1" />
                                                </Link>
                                            </Button>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    </div>
                )}
            </main>

            <Button
                size="icon"
                onClick={() => setShowCreateModal(true)}
                className="fixed bottom-10 right-10 z-50 h-16 w-16 rounded-full bg-foreground text-background shadow-2xl transition-transform duration-200 hover:scale-110 active:scale-90"
            >
                <Plus className="h-8 w-8" />
            </Button>

            <div className="fixed bottom-0 left-0 z-50 flex w-full items-center justify-around rounded-t-[2rem] bg-white/70 px-8 pb-6 pt-2 shadow-[0_-8px_30px_rgb(0,0,0,0.12)] backdrop-blur-xl dark:bg-[#1B1B1B]/60 md:hidden">
                <a
                    className="flex items-center justify-center rounded-full bg-black/10 p-3 text-foreground transition-transform active:scale-90 dark:bg-white/10"
                    href="#"
                    aria-label="Chat"
                >
                    <Users className="h-5 w-5" />
                </a>
            </div>

            <footer className="pointer-events-none fixed bottom-0 z-40 w-full px-6 pb-8 pt-4">
                <div className="pointer-events-auto mx-auto flex max-w-screen-xl flex-col items-center justify-center gap-2 px-4 py-2">
                    <p className="flex flex-wrap justify-center gap-x-2 text-[11px] font-medium tracking-wide text-foreground/70 dark:text-[#c4c7c8]/70">
                        <span>Ideas, bugs, or bold takes?</span>
                        <a
                            className="text-foreground underline underline-offset-2 transition-all hover:opacity-80"
                            href="mailto:feedback@nullchat.tech"
                        >
                            feedback@nullchat.tech
                        </a>
                    </p>
                    <p className="flex flex-wrap justify-center gap-x-2 text-[11px] font-medium tracking-wide text-foreground/70 dark:text-[#c4c7c8]/70">
                        <span>Need help right now?</span>
                        <a
                            className="text-foreground underline underline-offset-2 transition-all hover:opacity-80"
                            href="mailto:support@nullchat.tech"
                        >
                            support@nullchat.tech
                        </a>
                    </p>
                </div>
            </footer>

            {showCreateModal && <CreateGroupModal onClose={() => setShowCreateModal(false)} creatorId={creatorId} onSuccess={() => { setShowCreateModal(false); fetchGroups(); }} />}
        </div>
    );
}