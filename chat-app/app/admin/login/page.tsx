'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Input, Button } from '@/components/ui/basic';
import { GridBackground, Logo } from '@/components/SiteChrome';
import { Lock } from 'lucide-react';

export default function AdminLogin() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const router = useRouter();

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            const { error } = await supabase.auth.signInWithPassword({
                email,
                password,
            });

            if (error) {
                throw error;
            }

            router.push('/admin');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Login failed');
        } finally {
            setLoading(false);
        }
    };

    const inputCls =
        'h-12 rounded-full border-border bg-background/60 px-5 focus-visible:ring-foreground/30';

    return (
        <div className="relative flex min-h-screen items-center justify-center bg-background p-4 text-foreground">
            <GridBackground origin="50% 40%" />
            <div className="absolute left-4 top-4 z-10 sm:left-8 sm:top-6"><Logo /></div>

            <div className="relative z-10 w-full max-w-sm">
                <div className="absolute -inset-6 -z-10 rounded-[2.5rem] bg-gradient-to-b from-foreground/10 to-transparent blur-2xl" />
                <div className="rounded-3xl border border-border bg-card/80 p-8 shadow-[0_30px_80px_-30px_rgba(0,0,0,0.4)] backdrop-blur">
                    <div className="mb-8 text-center">
                        <div className="mx-auto mb-6 grid h-14 w-14 place-items-center rounded-2xl bg-foreground text-background">
                            <Lock className="h-6 w-6" />
                        </div>
                        <h1 className="text-3xl font-bold tracking-tighter">Admin login</h1>
                        <p className="mt-2 font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                            Restricted area
                        </p>
                    </div>
                    <form onSubmit={handleLogin} className="space-y-4">
                        {error && (
                            <div className="rounded-2xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive animate-in slide-in-from-top-1">
                                {error}
                            </div>
                        )}
                        <Input
                            type="email"
                            placeholder="Email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            className={inputCls}
                        />
                        <Input
                            type="password"
                            placeholder="Password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            className={inputCls}
                        />
                        <Button type="submit" disabled={loading} className="h-12 w-full rounded-full bg-foreground font-bold text-background transition-transform hover:scale-[1.02] hover:bg-foreground active:scale-95">
                            {loading ? 'Logging in…' : 'Login'}
                        </Button>
                    </form>
                </div>
            </div>
        </div>
    );
}
