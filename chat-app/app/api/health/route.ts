import { NextResponse } from 'next/server';
import { supabaseAdmin, MEDIA_BUCKET } from '@/lib/server/supabaseAdmin';

export const dynamic = 'force-dynamic';

type Check = { ok: boolean; ms: number };

async function timed(fn: () => PromiseLike<{ error: unknown }>): Promise<Check> {
    const started = Date.now();
    try {
        const result = await Promise.race([
            fn(),
            new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 5000)),
        ]);
        return { ok: !result.error, ms: Date.now() - started };
    } catch {
        return { ok: false, ms: Date.now() - started };
    }
}

// GET /api/health: public, read-only, and deliberately tells you nothing but up/down + latency.
export async function GET() {
    const [database, storage] = await Promise.all([
        timed(() => supabaseAdmin.from('groups').select('id', { head: true, count: 'exact' }).limit(1)),
        timed(() => supabaseAdmin.storage.from(MEDIA_BUCKET).list('', { limit: 1 })),
    ]);

    const failing = [database, storage].filter(c => !c.ok).length;
    const status = failing === 0 ? 'operational' : failing === 2 ? 'down' : 'degraded';

    return NextResponse.json(
        { status, checks: { database, storage }, checkedAt: new Date().toISOString() },
        { status: status === 'operational' ? 200 : 503, headers: { 'Cache-Control': 'no-store' } }
    );
}
