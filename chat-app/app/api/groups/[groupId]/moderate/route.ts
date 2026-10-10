import { NextResponse } from 'next/server';
import { createHash } from 'node:crypto';
import { deleteGroupAndMedia, extractProof, getGroup, isUuid, verifyRoomProof } from '@/lib/server/groups';
import { createLimiter } from '@/lib/server/rateLimit';
import { CONTEXT_LINES, MAX_BATCH, cleanItems } from '@/lib/moderation';

// A client checks every few seconds; this leaves room for several open tabs.
const overLimit = createLimiter(90, 60_000);

/**
 * POST /api/groups/:groupId/moderate - Room safety check.
 *
 * A member's browser sends recently decrypted message text. The guard service
 * (Llama Guard 3 1B) judges it, and if it finds a severe category the SERVER ends
 * the room itself, so a client can never close someone else's room by lying.
 * Message text is passed straight through and never stored or logged.
 */
export async function POST(request: Request, props: { params: Promise<{ groupId: string }> }) {
    try {
        const { groupId } = await props.params;
        if (!isUuid(groupId)) return NextResponse.json({ error: 'Invalid group' }, { status: 400 });
        if (overLimit(request)) return NextResponse.json({ error: 'Too many checks' }, { status: 429 });

        const body = await request.json().catch(() => null);
        const messages = cleanItems(body?.messages, MAX_BATCH);
        const context = cleanItems(body?.context, CONTEXT_LINES);
        if (messages.length === 0) return NextResponse.json({ error: 'Nothing to check' }, { status: 400 });

        const group = await getGroup(groupId);
        if (!group) return NextResponse.json({ terminate: false, ended: true });
        if (!verifyRoomProof(group, extractProof(request, body))) {
            return NextResponse.json({ error: 'Not a member of this room' }, { status: 403 });
        }

        const url = process.env.MODERATION_URL;
        const secret = process.env.MODERATION_SECRET;
        // Not configured (for example local development): the room carries on as normal
        if (!url || !secret) return NextResponse.json({ terminate: false, skipped: true });

        let verdict: { terminate?: boolean; categories?: string[] };
        try {
            const res = await fetch(`${url.replace(/\/+$/, '')}/check`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${secret}` },
                signal: AbortSignal.timeout(20_000),
                // the guard only needs a stable room key for caching, not the real id
                body: JSON.stringify({ room: createHash('sha256').update(groupId).digest('hex'), messages, context }),
            });
            if (!res.ok) throw new Error(`guard returned ${res.status}`);
            verdict = await res.json();
        } catch (err) {
            // Fail open: a guard outage must never take rooms down
            console.error('Room safety check unavailable:', err instanceof Error ? err.message : 'unknown');
            return NextResponse.json({ terminate: false, unavailable: true });
        }

        if (verdict.terminate === true) {
            await deleteGroupAndMedia(groupId);
            return NextResponse.json({ terminate: true });
        }
        return NextResponse.json({ terminate: false });
    } catch (err) {
        console.error('Moderation error:', err instanceof Error ? err.message : 'unknown');
        return NextResponse.json({ error: 'Check failed' }, { status: 500 });
    }
}
