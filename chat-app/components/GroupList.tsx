"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button, Card, CardContent } from './ui/basic';
import { motion } from 'framer-motion';
import { ArrowLeft, ArrowRight, Check, KeyRound, Link2, Plus, Search, Timer, Users } from 'lucide-react';
import CreateGroupModal from './CreateGroupModal';
import ModeToggle from './ModeToggle';
import { loadRoomKey, pruneRoomKeys } from '@/lib/roomAuth';

interface Group {
    id: string;
    name: string;
    tags: string[];
    active_user_count: number;
    key?: string;
    expires_at?: string | null;
    max_members?: number | null;
    has_password?: boolean;
}

export default function GroupList() {
    const [groups, setGroups] = useState<Group[]>([]);
    const [loading, setLoading] = useState(true);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [creatorId, setCreatorId] = useState<string>('');
    const [cursor, setCursor] = useState({ x: -600, y: -600 });
    const [query, setQuery] = useState('');

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
                if (Array.isArray(data)) {
                    setGroups(data);
                    pruneRoomKeys(data.map((g: Group) => g.id));
                }
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!creatorId) return;
        
        fetchGroups();

        const fetchInterval = setInterval(fetchGroups, 5000);

        return () => {
            clearInterval(fetchInterval);
        };
    }, [creatorId]);

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            setCursor({ x: e.clientX, y: e.clientY });
        };

        window.addEventListener('mousemove', handleMouseMove);
        return () => window.removeEventListener('mousemove', handleMouseMove);
    }, []);

    const q = query.trim().toLowerCase();
    const filtered = q
        ? groups.filter(
            (g) =>
                g.name.toLowerCase().includes(q) ||
                g.tags?.some((t) => t.toLowerCase().includes(q))
        )
        : groups;
    const totalOnline = groups.reduce((n, g) => n + (g.active_user_count || 0), 0);

    const steps = [
        { icon: Plus, title: 'Create', body: 'Name your group and add a few tags.' },
        { icon: Link2, title: 'Share', body: 'Send the link. Only people with it can join.' },
        { icon: Timer, title: 'Vanish', body: 'When the room ends, everything is wiped.' },
    ];

    return (
        <div className="relative min-h-screen overflow-x-hidden bg-background text-foreground selection:bg-foreground selection:text-background">
            <div
                className="pointer-events-none fixed inset-0 z-0 opacity-[0.05] dark:opacity-[0.07]"
                style={{
                    backgroundImage:
                        'linear-gradient(currentColor 1px, transparent 1px), linear-gradient(90deg, currentColor 1px, transparent 1px)',
                    backgroundSize: '56px 56px',
                    maskImage: 'radial-gradient(ellipse at 50% 30%, black 20%, transparent 75%)',
                    WebkitMaskImage: 'radial-gradient(ellipse at 50% 30%, black 20%, transparent 75%)',
                }}
            />
            <div
                className="pointer-events-none fixed z-0 hidden h-[560px] w-[560px] -translate-x-1/2 -translate-y-1/2 rounded-full sm:block"
                style={{
                    left: cursor.x,
                    top: cursor.y,
                    background: 'radial-gradient(circle, hsl(var(--foreground) / 0.07) 0%, transparent 70%)',
                }}
            />

            <nav className="fixed top-0 z-50 w-full border-b border-border/60 bg-background/70 backdrop-blur-xl">
                <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3.5 sm:px-6 md:px-8">
                    <Link href="/" className="flex items-center gap-2">
                        <span className="grid h-7 w-7 place-items-center rounded-full bg-foreground">
                            <span className="h-2.5 w-2.5 rounded-full bg-background" />
                        </span>
                        <span className="text-lg font-bold tracking-tighter">Nullchat</span>
                    </Link>
                    <div className="flex items-center gap-4 sm:gap-6">
                        <Link
                            href="/"
                            className="hidden items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground sm:flex"
                        >
                            <ArrowLeft className="h-4 w-4" /> Home
                        </Link>
                        <Link
                            href="/about"
                            className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                        >
                            About
                        </Link>
                        <ModeToggle />
                        <Button
                            onClick={() => setShowCreateModal(true)}
                            className="hidden rounded-full bg-foreground px-5 font-bold text-background hover:bg-foreground/90 sm:inline-flex"
                        >
                            <Plus className="mr-1.5 h-4 w-4" /> New group
                        </Button>
                    </div>
                </div>
            </nav>

            <main className="relative z-10 mx-auto flex min-h-screen max-w-7xl flex-col px-4 pb-40 pt-28 sm:px-6 md:px-8 md:pt-36">
                {loading ? (
                    <div className="grid w-full grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
                        {[1, 2, 3, 4, 5, 6].map((i) => (
                            <div
                                key={i}
                                className="h-52 animate-pulse rounded-3xl border border-border bg-card/60"
                            />
                        ))}
                    </div>
                ) : groups.length === 0 ? (
                    <div className="flex flex-1 flex-col items-center justify-center text-center">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ duration: 0.6 }}
                            className="relative mb-12 grid h-44 w-44 place-items-center"
                        >
                            {[0, 1, 2].map((i) => (
                                <motion.span
                                    key={i}
                                    className="absolute inset-0 rounded-full border border-foreground/30"
                                    animate={{ scale: [0.5, 1.25], opacity: [0.6, 0] }}
                                    transition={{ duration: 3, repeat: Infinity, delay: i, ease: 'easeOut' }}
                                />
                            ))}
                            <button
                                type="button"
                                aria-label="Start a group"
                                onClick={() => setShowCreateModal(true)}
                                className="relative grid h-24 w-24 place-items-center rounded-[1.75rem] bg-foreground text-background shadow-2xl transition-transform hover:scale-105 active:scale-95"
                            >
                                <Plus className="h-10 w-10" strokeWidth={1.75} />
                            </button>
                        </motion.div>

                        <div className="mb-5 flex items-center gap-3 font-mono text-[11px] uppercase tracking-[0.25em] text-muted-foreground">
                            <span className="h-px w-8 bg-foreground/40" />
                            0 rooms open
                            <span className="h-px w-8 bg-foreground/40" />
                        </div>
                        <h1 className="mb-5 text-5xl font-bold leading-[0.95] tracking-tighter md:text-7xl">
                            It&apos;s quiet.
                            <br />
                            <span className="text-muted-foreground">Start something.</span>
                        </h1>
                        <p className="mx-auto mb-10 max-w-md text-lg leading-relaxed text-muted-foreground">
                            Create a private group and share the link with friends.
                            Only those with the link can join.
                        </p>

                        <Button
                            onClick={() => setShowCreateModal(true)}
                            className="group h-auto rounded-full bg-foreground px-8 py-4 text-base font-bold text-background transition-transform hover:scale-[1.03] hover:bg-foreground active:scale-95"
                        >
                            Start a Group
                            <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" />
                        </Button>

                        <div className="mt-20 grid w-full max-w-3xl gap-px overflow-hidden rounded-3xl border border-border bg-border text-left sm:grid-cols-3">
                            {steps.map((s, i) => (
                                <div key={s.title} className="bg-background p-6 transition-colors hover:bg-card">
                                    <div className="mb-6 flex items-center justify-between">
                                        <span className="grid h-10 w-10 place-items-center rounded-xl bg-foreground text-background">
                                            <s.icon className="h-4 w-4" />
                                        </span>
                                        <span className="font-mono text-xs text-muted-foreground">
                                            0{i + 1}
                                        </span>
                                    </div>
                                    <h3 className="mb-1 font-bold tracking-tight">{s.title}</h3>
                                    <p className="text-sm leading-relaxed text-muted-foreground">{s.body}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                ) : (
                    <div className="w-full space-y-10">
                        <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
                            <div>
                                <div className="mb-4 flex items-center gap-3 font-mono text-[11px] uppercase tracking-[0.25em] text-muted-foreground">
                                    <span className="h-px w-8 bg-foreground/40" />
                                    {groups.length} {groups.length === 1 ? 'room' : 'rooms'} · {totalOnline} online
                                </div>
                                <h2 className="text-4xl font-bold leading-[0.95] tracking-tighter md:text-6xl">
                                    Your Groups
                                </h2>
                                <p className="mt-3 text-muted-foreground">
                                    Jump back into active conversations.
                                </p>
                            </div>
                            <div className="relative w-full md:max-w-xs">
                                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                <input
                                    value={query}
                                    onChange={(e) => setQuery(e.target.value)}
                                    placeholder="Search groups or tags"
                                    className="h-11 w-full rounded-full border border-border bg-card/60 pl-11 pr-4 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-foreground/50"
                                />
                            </div>
                        </div>

                        {filtered.length === 0 ? (
                            <div className="rounded-3xl border border-dashed border-border py-20 text-center text-muted-foreground">
                                No groups match &ldquo;{query}&rdquo;.
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
                                {filtered.map((group, idx) => {
                                    const live = group.active_user_count > 0;
                                    return (
                                        <motion.div
                                            key={group.id}
                                            initial={{ opacity: 0, y: 20 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ duration: 0.45, delay: Math.min(idx, 8) * 0.05 }}
                                        >
                                            <Card className="group relative h-full overflow-hidden rounded-3xl border border-border bg-card/60 shadow-none transition-all duration-300 hover:-translate-y-1 hover:border-foreground/40">
                                                <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-foreground/5 transition-transform duration-700 group-hover:scale-[2.5]" />
                                                <CardContent className="relative z-10 flex h-full flex-col justify-between p-7">
                                                    <div className="space-y-5">
                                                        <div className="flex items-start justify-between gap-3">
                                                            <h3 className="min-w-0 truncate text-2xl font-bold tracking-tight">
                                                                {group.name}
                                                            </h3>
                                                            <div
                                                                className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold ${live
                                                                    ? 'border-foreground/30 bg-foreground/10 text-foreground'
                                                                    : 'border-border bg-muted text-muted-foreground'
                                                                    }`}
                                                            >
                                                                <span className="relative flex h-2 w-2 shrink-0">
                                                                    {live && (
                                                                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-foreground opacity-75" />
                                                                    )}
                                                                    <span
                                                                        className={`relative inline-flex h-2 w-2 rounded-full ${live ? 'bg-foreground' : 'bg-muted-foreground'}`}
                                                                    />
                                                                </span>
                                                                <Users className="h-3 w-3" />
                                                                <span>{group.active_user_count}</span>
                                                            </div>
                                                        </div>

                                                        <div className="flex min-h-[2rem] flex-wrap gap-2">
                                                            {group.has_password && (
                                                                <span className="flex items-center gap-1 rounded-full bg-foreground px-2.5 py-1 font-mono text-[10px] uppercase tracking-wide text-background" title="Password protected">
                                                                    <KeyRound className="h-3 w-3" /> Password
                                                                </span>
                                                            )}
                                                            {group.expires_at && (
                                                                <span className="flex items-center gap-1 rounded-full border border-border px-2.5 py-1 font-mono text-[10px] uppercase tracking-wide text-muted-foreground" title="Closes automatically">
                                                                    <Timer className="h-3 w-3" /> {new Date(group.expires_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                                                </span>
                                                            )}
                                                            {group.max_members && (
                                                                <span className="flex items-center gap-1 rounded-full border border-border px-2.5 py-1 font-mono text-[10px] uppercase tracking-wide text-muted-foreground" title="Member limit">
                                                                    <Users className="h-3 w-3" /> {group.active_user_count}/{group.max_members}
                                                                </span>
                                                            )}
                                                            {group.tags?.slice(0, 3).map((tag, i) => (
                                                                <span
                                                                    key={i}
                                                                    className="rounded-full border border-border px-3 py-1 font-mono text-[10px] uppercase tracking-wide text-muted-foreground"
                                                                >
                                                                    #{tag}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    </div>

                                                    <div className="mt-auto pt-8">
                                                        <Button
                                                            asChild
                                                            className="group/btn h-12 w-full rounded-full bg-foreground font-bold text-background transition-transform hover:scale-[1.02] hover:bg-foreground active:scale-95"
                                                        >
                                                            <Link href={`/chat/${group.id}#key=${encodeURIComponent(loadRoomKey(group.id) || group.key || '')}`}>
                                                                <span className="hidden sm:inline">Join Conversation</span>
                                                                <span className="sm:hidden">Join</span>
                                                                <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover/btn:translate-x-1" />
                                                            </Link>
                                                        </Button>
                                                    </div>
                                                </CardContent>
                                            </Card>
                                        </motion.div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}

                <footer className="mt-auto flex flex-col items-center gap-2 pt-24 text-center text-[11px] tracking-wide text-muted-foreground">
                    <p className="flex flex-wrap justify-center gap-x-2">
                        <span>Ideas, bugs, or bold takes?</span>
                        <a className="text-foreground underline underline-offset-2 hover:opacity-80" href="mailto:feedback@nullchat.tech">
                            feedback@nullchat.tech
                        </a>
                    </p>
                    <p className="flex flex-wrap justify-center gap-x-2">
                        <span>Need help right now?</span>
                        <a className="text-foreground underline underline-offset-2 hover:opacity-80" href="mailto:support@nullchat.tech">
                            support@nullchat.tech
                        </a>
                    </p>
                    <p className="mt-2 flex items-center gap-1.5 font-mono uppercase tracking-[0.2em]">
                        <Check className="h-3 w-3" /> No accounts · No logs
                    </p>
                </footer>
            </main>

            <Button
                size="icon"
                aria-label="Create group"
                onClick={() => setShowCreateModal(true)}
                className="fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full bg-foreground text-background shadow-2xl transition-transform duration-200 hover:scale-110 hover:bg-foreground active:scale-90 sm:hidden"
            >
                <Plus className="h-7 w-7" />
            </Button>

            {showCreateModal && <CreateGroupModal onClose={() => setShowCreateModal(false)} creatorId={creatorId} onSuccess={() => { setShowCreateModal(false); fetchGroups(); }} />}
        </div>
    );
}
