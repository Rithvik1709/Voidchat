"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowLeft, ArrowUpRight, Check, Flame, KeyRound, Link2, Plus, Search, Timer, Users } from 'lucide-react';
import CreateGroupModal from './CreateGroupModal';
import ModeToggle from './ModeToggle';
import { describeBurn } from '@/lib/roomOptions';
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
    invite_only?: boolean;
    burn_seconds?: number | null;
}

export default function GroupList() {
    const [groups, setGroups] = useState<Group[]>([]);
    const [loading, setLoading] = useState(true);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [creatorId, setCreatorId] = useState<string>('');
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

    const serif = 'font-[family-name:var(--font-serif)]';
    const chip = 'flex items-center gap-1 rounded-full border border-border px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground';

    return (
        <div className="relative min-h-screen overflow-x-hidden bg-background text-foreground selection:bg-ember selection:text-[#171412]">
            {/* warm ember light in the corner, like the landing page */}
            <div
                aria-hidden
                className="pointer-events-none fixed inset-0 z-0"
                style={{ background: 'radial-gradient(45% 40% at 85% 85%, hsl(var(--ember) / 0.14), transparent 70%)' }}
            />

            {/* floating pill nav */}
            <nav className="fixed inset-x-0 top-4 z-50 flex justify-center px-4">
                <div className="flex w-full max-w-4xl items-center justify-between gap-3 rounded-full border border-border bg-background/75 py-2 pl-5 pr-2 backdrop-blur-xl">
                    <Link href="/" className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-ember shadow-[0_0_10px_2px_hsl(var(--ember)/0.6)]" />
                        <span className={`${serif} text-2xl italic leading-none`}>nullchat</span>
                    </Link>
                    <div className="flex items-center gap-1 sm:gap-2">
                        <Link
                            href="/"
                            className="hidden items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] text-muted-foreground transition-colors hover:text-foreground sm:flex"
                        >
                            <ArrowLeft className="h-3.5 w-3.5" /> Home
                        </Link>
                        <Link
                            href="/about"
                            className="rounded-full px-3 py-1.5 text-[13px] text-muted-foreground transition-colors hover:text-foreground"
                        >
                            About
                        </Link>
                        <ModeToggle className="h-9 w-9 border-border bg-transparent text-foreground hover:border-ember/60" />
                        <button
                            type="button"
                            onClick={() => setShowCreateModal(true)}
                            className="hidden items-center gap-1.5 rounded-full bg-ember px-4 py-2 text-[13px] font-medium text-[#171412] transition-transform hover:-translate-y-px sm:flex"
                        >
                            <Plus className="h-3.5 w-3.5" /> New room
                        </button>
                    </div>
                </div>
            </nav>

            <main className="relative z-10 mx-auto flex min-h-screen max-w-7xl flex-col px-5 pb-40 pt-32 sm:px-8 md:pt-40">
                {loading ? (
                    <div className="grid w-full grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
                        {[1, 2, 3, 4, 5, 6].map((i) => (
                            <div key={i} className="h-56 animate-pulse rounded-[22px] bg-card shadow-[0_20px_40px_-30px_rgba(60,40,20,0.4)]" />
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
                                    className="absolute inset-0 rounded-full border border-ember/50"
                                    animate={{ scale: [0.5, 1.25], opacity: [0.7, 0] }}
                                    transition={{ duration: 3, repeat: Infinity, delay: i, ease: 'easeOut' }}
                                />
                            ))}
                            <button
                                type="button"
                                aria-label="Start a room"
                                onClick={() => setShowCreateModal(true)}
                                className="relative grid h-24 w-24 place-items-center rounded-full bg-primary text-primary-foreground shadow-[0_20px_40px_-16px_rgba(23,20,18,0.7)] transition-transform hover:scale-105 active:scale-95"
                            >
                                <Plus className="h-10 w-10" strokeWidth={1.5} />
                                <span className="absolute right-3 top-3 h-2.5 w-2.5 rounded-full bg-ember shadow-[0_0_10px_2px_hsl(var(--ember)/0.7)]" />
                            </button>
                        </motion.div>

                        <div className="mb-6 flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                            <span className="h-1.5 w-1.5 rounded-full bg-ember" /> 0 rooms open
                        </div>
                        <h1 className={`${serif} mb-6 text-6xl leading-[0.9] tracking-[-0.02em] md:text-8xl`}>
                            It&apos;s quiet.
                            <br />
                            <span className="italic text-ember">Start something.</span>
                        </h1>
                        <p className="mx-auto mb-10 max-w-md text-lg leading-relaxed text-muted-foreground">
                            Open a private room and share the link. Only people with it can get in, and nothing stays once it ends.
                        </p>

                        <button
                            type="button"
                            onClick={() => setShowCreateModal(true)}
                            className="group inline-flex items-center gap-3 rounded-full bg-primary py-2.5 pl-6 pr-2.5 text-[15px] font-medium text-primary-foreground shadow-[0_14px_30px_-14px_rgba(23,20,18,0.8)] transition-transform hover:-translate-y-0.5"
                        >
                            Start a room
                            <span className="grid h-9 w-9 place-items-center rounded-full bg-ember text-[#171412] transition-transform duration-500 group-hover:rotate-45">
                                <ArrowUpRight className="h-4 w-4" />
                            </span>
                        </button>

                        <div className="mt-24 grid w-full max-w-4xl gap-4 text-left sm:grid-cols-3">
                            {steps.map((s, i) => (
                                <motion.div
                                    key={s.title}
                                    initial={{ opacity: 0, y: 24 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ duration: 0.7, delay: 0.3 + i * 0.1 }}
                                    className="group rounded-[22px] bg-card p-6 shadow-[0_24px_50px_-34px_rgba(60,40,20,0.55)] transition-transform hover:-translate-y-1"
                                >
                                    <div className="mb-8 flex items-center justify-between">
                                        <span className={`${serif} text-5xl leading-none text-transparent [-webkit-text-stroke:1px_hsl(var(--foreground))]`}>0{i + 1}</span>
                                        <s.icon className="h-5 w-5 text-muted-foreground transition-colors group-hover:text-ember" strokeWidth={1.5} />
                                    </div>
                                    <h3 className={`${serif} mb-1 text-3xl leading-none`}>{s.title}</h3>
                                    <p className="text-sm leading-relaxed text-muted-foreground">{s.body}</p>
                                </motion.div>
                            ))}
                        </div>
                    </div>
                ) : (
                    <div className="w-full space-y-12">
                        <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
                            <div>
                                <div className="mb-5 flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                                    <span className="h-1.5 w-1.5 rounded-full bg-ember" />
                                    {groups.length} {groups.length === 1 ? 'room' : 'rooms'} · {totalOnline} online
                                </div>
                                <h2 className={`${serif} text-6xl leading-[0.9] tracking-[-0.02em] md:text-8xl`}>
                                    Your <span className="italic text-ember">rooms.</span>
                                </h2>
                                <p className="mt-4 text-muted-foreground">Jump back in before they burn.</p>
                            </div>
                            <div className="relative w-full md:max-w-xs">
                                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                <input
                                    value={query}
                                    onChange={(e) => setQuery(e.target.value)}
                                    placeholder="Search rooms or tags"
                                    className="h-12 w-full rounded-full border border-border bg-card pl-11 pr-4 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-ember/70"
                                />
                            </div>
                        </div>

                        {filtered.length === 0 ? (
                            <div className={`${serif} rounded-[22px] border border-dashed border-border py-20 text-center text-3xl italic text-muted-foreground`}>
                                No rooms match &ldquo;{query}&rdquo;.
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
                                {filtered.map((group, idx) => {
                                    const live = group.active_user_count > 0;
                                    return (
                                        <motion.div
                                            key={group.id}
                                            initial={{ opacity: 0, y: 24, rotate: idx % 2 ? 1.5 : -1.5 }}
                                            animate={{ opacity: 1, y: 0, rotate: 0 }}
                                            transition={{ duration: 0.6, delay: Math.min(idx, 8) * 0.06, ease: [0.2, 0.7, 0.2, 1] }}
                                        >
                                            {/* each room is a ticket: paper card, perforation, stub */}
                                            <div className="group relative flex h-full flex-col rounded-[22px] bg-card shadow-[0_24px_50px_-34px_rgba(60,40,20,0.6)] transition-transform duration-300 hover:-translate-y-1">
                                                <div className="flex flex-1 flex-col gap-5 p-7">
                                                    <div className="flex items-start justify-between gap-3">
                                                        <div className="min-w-0">
                                                            <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Room</div>
                                                            <h3 className={`${serif} mt-1 truncate text-4xl leading-none`}>{group.name}</h3>
                                                        </div>
                                                        <div
                                                            className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 font-mono text-[11px] ${live ? 'bg-ember/15 text-ember' : 'bg-muted text-muted-foreground'}`}
                                                        >
                                                            <span className="relative flex h-2 w-2 shrink-0">
                                                                {live && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-ember opacity-75" />}
                                                                <span className={`relative inline-flex h-2 w-2 rounded-full ${live ? 'bg-ember' : 'bg-muted-foreground'}`} />
                                                            </span>
                                                            <Users className="h-3 w-3" />
                                                            <span>{group.active_user_count}</span>
                                                        </div>
                                                    </div>

                                                    <div className="flex min-h-[2rem] flex-wrap gap-2">
                                                        {group.has_password && (
                                                            <span className="flex items-center gap-1 rounded-full bg-primary px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-primary-foreground" title="Password protected">
                                                                <KeyRound className="h-3 w-3" /> Password
                                                            </span>
                                                        )}
                                                        {group.burn_seconds && (
                                                            <span className="flex items-center gap-1 rounded-full border border-ember/40 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-ember" title="Messages burn after this long">
                                                                <Flame className="h-3 w-3" /> Burns {describeBurn(group.burn_seconds)}
                                                            </span>
                                                        )}
                                                        {group.invite_only && (
                                                            <span className={chip} title="People get in through one-time links">
                                                                <Link2 className="h-3 w-3" /> One-time links
                                                            </span>
                                                        )}
                                                        {group.expires_at && (
                                                            <span className={chip} title="Closes automatically">
                                                                <Timer className="h-3 w-3" /> {new Date(group.expires_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                                            </span>
                                                        )}
                                                        {group.max_members && (
                                                            <span className={chip} title="Member limit">
                                                                <Users className="h-3 w-3" /> {group.active_user_count}/{group.max_members}
                                                            </span>
                                                        )}
                                                        {group.tags?.slice(0, 3).map((tag, i) => (
                                                            <span key={i} className={chip}>
                                                                #{tag}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </div>

                                                {/* perforation with notches */}
                                                <div className="relative mx-7 border-t border-dashed border-border">
                                                    <span className="absolute -left-[38px] -top-3 h-6 w-6 rounded-full bg-background" />
                                                    <span className="absolute -right-[38px] -top-3 h-6 w-6 rounded-full bg-background" />
                                                </div>

                                                <div className="p-4">
                                                    <Link
                                                        href={`/chat/${group.id}#key=${encodeURIComponent(loadRoomKey(group.id) || group.key || '')}`}
                                                        className="group/btn flex items-center justify-between rounded-full bg-primary py-2 pl-5 pr-2 text-[15px] font-medium text-primary-foreground transition-transform active:scale-[0.98]"
                                                    >
                                                        <span>
                                                            <span className="hidden sm:inline">Join conversation</span>
                                                            <span className="sm:hidden">Join</span>
                                                        </span>
                                                        <span className="grid h-9 w-9 place-items-center rounded-full bg-ember text-[#171412] transition-transform duration-500 group-hover/btn:rotate-45">
                                                            <ArrowUpRight className="h-4 w-4" />
                                                        </span>
                                                    </Link>
                                                </div>
                                            </div>
                                        </motion.div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}

                <footer className="mt-auto flex flex-col items-center gap-2 pt-24 text-center text-[12px] text-muted-foreground">
                    <p className="flex flex-wrap justify-center gap-x-2">
                        <span>Ideas, bugs, or bold takes?</span>
                        <a className="text-foreground underline decoration-ember underline-offset-4 hover:text-ember" href="mailto:feedback@nullchat.tech">
                            feedback@nullchat.tech
                        </a>
                    </p>
                    <p className="flex flex-wrap justify-center gap-x-2">
                        <span>Need help right now?</span>
                        <a className="text-foreground underline decoration-ember underline-offset-4 hover:text-ember" href="mailto:support@nullchat.tech">
                            support@nullchat.tech
                        </a>
                    </p>
                    <p className="mt-2 flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.2em]">
                        <Check className="h-3 w-3 text-ember" /> No accounts · No logs
                    </p>
                </footer>
            </main>

            <button
                type="button"
                aria-label="Create room"
                onClick={() => setShowCreateModal(true)}
                className="fixed bottom-6 right-6 z-50 grid h-14 w-14 place-items-center rounded-full bg-ember text-[#171412] shadow-[0_18px_36px_-12px_rgba(120,40,0,0.6)] transition-transform duration-200 hover:scale-110 active:scale-90 sm:hidden"
            >
                <Plus className="h-7 w-7" />
            </button>

            {showCreateModal && <CreateGroupModal onClose={() => setShowCreateModal(false)} creatorId={creatorId} onSuccess={() => { setShowCreateModal(false); fetchGroups(); }} />}
        </div>
    );
}
