'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/basic';
import { GridBackground, Logo } from '@/components/SiteChrome';
import ModeToggle from '@/components/ModeToggle';
import { Trash2, Users, Eye, Layers, LogOut } from 'lucide-react';

interface Group {
    id: string;
    name: string;
    created_at: string;
    active_user_count: number;
}

interface Visit {
    count: number;
}

export default function AdminDashboard() {
    const [loading, setLoading] = useState(true);
    const [visitCount, setVisitCount] = useState(0);
    const [groups, setGroups] = useState<Group[]>([]);
    const router = useRouter();

    useEffect(() => {
        const checkAuthAndFetchData = async () => {
            const { data: { session } } = await supabase.auth.getSession();

            if (!session) {
                router.push('/admin/login');
                return;
            }

            // Fetch Unique Visits
            // Note: For large scale, use a database view or RPC. For MVP, we fetch distinct visitor_ids.
            const { data: visits } = await supabase
                .from('site_visits')
                .select('visitor_id');

            if (visits) {
                const uniqueVisitors = new Set(visits.map(v => v.visitor_id).filter(Boolean));
                setVisitCount(uniqueVisitors.size);
            } else {
                setVisitCount(0);
            }

            // Fetch Groups
            const { data: groupsData } = await supabase
                .from('groups')
                .select('*')
                .order('created_at', { ascending: false });

            if (groupsData) {
                setGroups(groupsData);
            }

            setLoading(false);
        };

        checkAuthAndFetchData();
    }, [router]);

    const handleDeleteGroup = async (groupId: string) => {
        if (!confirm('Are you sure you want to delete this group?')) return;

        const { error } = await supabase
            .from('groups')
            .delete()
            .eq('id', groupId);

        if (error) {
            alert('Failed to delete group: ' + error.message);
        } else {
            setGroups(groups.filter(g => g.id !== groupId));
        }
    };

    const handleLogout = async () => {
        await supabase.auth.signOut();
        router.push('/admin/login');
    };

    if (loading) {
        return (
            <div className="grid min-h-screen place-items-center bg-background text-foreground">
                <div className="flex items-center gap-3 font-mono text-xs uppercase tracking-[0.25em] text-muted-foreground">
                    <span className="h-2 w-2 animate-ping rounded-full bg-foreground" />
                    Loading dashboard
                </div>
            </div>
        );
    }

    const totalOnline = groups.reduce((n, g) => n + (g.active_user_count || 0), 0);
    const stats = [
        { label: 'Unique visitors', value: visitCount, icon: Eye },
        { label: 'Active groups', value: groups.length, icon: Layers },
        { label: 'Users online', value: totalOnline, icon: Users },
    ];

    return (
        <div className="relative min-h-screen bg-background text-foreground">
            <GridBackground />
            <header className="sticky top-0 z-30 border-b border-border/60 bg-background/70 backdrop-blur-xl">
                <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3.5 sm:px-6">
                    <div className="flex items-center gap-4">
                        <Logo />
                        <span className="hidden rounded-full border border-border px-3 py-1 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground sm:block">
                            Admin
                        </span>
                    </div>
                    <div className="flex items-center gap-3">
                        <ModeToggle className="h-10 w-10 border-border bg-transparent text-foreground hover:border-foreground/40" />
                        <Button onClick={handleLogout} variant="outline" className="rounded-full border-border bg-transparent hover:border-foreground/40">
                            <LogOut className="mr-2 h-4 w-4" /> Logout
                        </Button>
                    </div>
                </div>
            </header>

            <main className="relative z-10 mx-auto max-w-5xl px-4 pb-24 pt-12 sm:px-6">
                <h1 className="mb-10 text-4xl font-bold leading-[0.95] tracking-tighter md:text-6xl">
                    Dashboard
                </h1>

                <div className="mb-10 grid gap-4 sm:grid-cols-3">
                    {stats.map((st) => (
                        <div key={st.label} className="group relative overflow-hidden rounded-3xl border border-border bg-card/60 p-6 transition-colors hover:border-foreground/40">
                            <div className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-foreground/5 transition-transform duration-700 group-hover:scale-[2.5]" />
                            <div className="relative mb-8 grid h-10 w-10 place-items-center rounded-xl bg-foreground text-background">
                                <st.icon className="h-4 w-4" />
                            </div>
                            <div className="relative text-5xl font-bold tracking-tighter">{st.value}</div>
                            <div className="relative mt-2 font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                                {st.label}
                            </div>
                        </div>
                    ))}
                </div>

                <div className="mb-4 flex items-center justify-between">
                    <h2 className="text-xl font-bold tracking-tight">Manage groups</h2>
                    <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                        {groups.length} total
                    </span>
                </div>

                <div className="overflow-hidden rounded-3xl border border-border bg-card/60">
                    {groups.length === 0 ? (
                        <p className="py-16 text-center text-muted-foreground">No active groups.</p>
                    ) : (
                        <ul className="divide-y divide-border">
                            {groups.map((group) => (
                                <li key={group.id} className="flex items-center justify-between gap-4 px-5 py-4 transition-colors hover:bg-accent/50 sm:px-6">
                                    <div className="min-w-0">
                                        <h3 className="truncate font-semibold tracking-tight">{group.name}</h3>
                                        <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">
                                            {new Date(group.created_at).toLocaleDateString()} · {group.active_user_count || 0} online
                                        </p>
                                    </div>
                                    <Button
                                        variant="outline"
                                        size="icon"
                                        onClick={() => handleDeleteGroup(group.id)}
                                        title="Delete Group"
                                        className="shrink-0 rounded-full border-border bg-transparent text-muted-foreground hover:border-destructive/60 hover:bg-destructive/10 hover:text-destructive"
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </main>
        </div>
    );
}
