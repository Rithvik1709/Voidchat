import { NextResponse } from 'next/server';
import { sendAlert } from '@/lib/server/alerts';
import { scrub } from '@/lib/monitor';

const MAX_BODY = 4000;
const MAX_REPORTS_PER_HOUR = 30;
const hits = new Map<string, number[]>();

function limited(req: Request): boolean {
    const ip = (req.headers.get('x-forwarded-for') || 'unknown').split(',')[0].trim();
    const now = Date.now();
    const recent = (hits.get(ip) || []).filter(t => now - t < 60 * 60 * 1000);
    recent.push(now);
    hits.set(ip, recent);
    if (hits.size > 5000) hits.clear();
    return recent.length > MAX_REPORTS_PER_HOUR;
}

const clip = (v: unknown, n: number) => (typeof v === 'string' ? scrub(v).slice(0, n) : '');

// POST /api/monitor/error: receives scrubbed client errors. Nothing is stored; it goes to the
// server log (visible in your host's log viewer) and, optionally, a chat webhook.
export async function POST(req: Request) {
    try {
        const raw = await req.text();
        if (raw.length > MAX_BODY) {
            return NextResponse.json({ error: 'Too large' }, { status: 413 });
        }
        if (limited(req)) {
            return NextResponse.json({ error: 'Rate limited' }, { status: 429 });
        }

        let body: Record<string, unknown>;
        try {
            body = JSON.parse(raw);
        } catch {
            return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
        }

        // Scrub again on the server: never trust the client to have done it
        const report = {
            message: clip(body.message, 300),
            stack: clip(body.stack, 1500),
            context: clip(body.context, 60),
            path: clip(body.path, 120),
        };
        if (!report.message) {
            return NextResponse.json({ error: 'Missing message' }, { status: 400 });
        }

        console.error(JSON.stringify({ type: 'client-error', at: new Date().toISOString(), ...report }));
        await sendAlert(
            `Nullchat client error (${report.context || 'client'}) on ${report.path || '/'}: ${report.message}`,
            `${report.context}|${report.message}`
        );

        return NextResponse.json({ ok: true });
    } catch (err) {
        console.error('Monitor route failed:', err);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
