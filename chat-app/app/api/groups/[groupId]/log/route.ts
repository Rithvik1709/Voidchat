import { NextResponse } from 'next/server';
import { extractProof, getGroup, isUuid, verifyRoomProof } from '@/lib/server/groups';
import { createLimiter } from '@/lib/server/rateLimit';
import { supabaseAdmin } from '@/lib/server/supabaseAdmin';
import { MAX_NAME_LENGTH, sanitizeContent } from '@/lib/chatSafety';

// One call per sent message; generous enough for fast typists across a few tabs.
const overLimit = createLimiter(120, 60_000);

/**
 * POST /api/groups/:groupId/log - Store one sent message in the room's chat log.
 *
 * The sender's browser calls this after broadcasting a message, with the decrypted
 * content. Rows land in public.chat_logs keyed by message id, so a retry is a no-op.
 * Logs are kept after the room ends (see migrations/chat_logs.sql).
 */
export async function POST(request: Request, props: { params: Promise<{ groupId: string }> }) {
    try {
        const { groupId } = await props.params;
        if (!isUuid(groupId)) return NextResponse.json({ error: 'Invalid group' }, { status: 400 });
        if (overLimit(request)) return NextResponse.json({ error: 'Too many messages' }, { status: 429 });

        const body = await request.json().catch(() => null);
        const { id, sender, timestamp } = body ?? {};
        const content = sanitizeContent(body?.content);
        const sentAt = typeof timestamp === 'string' ? new Date(timestamp) : null;
        if (
            typeof id !== 'string' || !id || id.length > 64 ||
            typeof sender !== 'string' || !sender || sender.length > MAX_NAME_LENGTH ||
            !content || !sentAt || Number.isNaN(sentAt.getTime())
        ) {
            return NextResponse.json({ error: 'Invalid message' }, { status: 400 });
        }

        const group = await getGroup(groupId);
        if (!group) return NextResponse.json({ error: 'Room not found' }, { status: 404 });
        if (!verifyRoomProof(group, extractProof(request, body))) {
            return NextResponse.json({ error: 'Not a member of this room' }, { status: 403 });
        }

        // A plain insert, not an upsert: ON CONFLICT needs SELECT, which the insert-only
        // policy deliberately does not grant. A duplicate id (23505) is a retry, so it is fine.
        const { error } = await supabaseAdmin
            .from('chat_logs')
            .insert({ id, group_id: groupId, sender, content, sent_at: sentAt.toISOString() });
        if (error && error.code !== '23505') throw new Error(error.message);

        return NextResponse.json({ success: true });
    } catch (err) {
        console.error('Chat log error:', err instanceof Error ? err.message : 'unknown');
        return NextResponse.json({ error: 'Failed to log message' }, { status: 500 });
    }
}
