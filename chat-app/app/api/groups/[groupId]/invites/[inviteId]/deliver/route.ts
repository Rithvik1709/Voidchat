import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/server/supabaseAdmin';
import { extractProof, getLiveGroup, isUuid, verifyRoomProof } from '@/lib/server/groups';
import { MIGRATION_MESSAGE, STALE_CLAIM_MS, isMissingTable } from '@/lib/server/invites';
import { sanitizeDelivery } from '@/lib/invites';

// POST /api/groups/:id/invites/:inviteId/deliver: the inviter hands over the room key, encrypted
// to the claimer's public key. The server stores the opaque blob and marks the invite used.
export async function POST(
    request: Request,
    props: { params: Promise<{ groupId: string; inviteId: string }> }
) {
    try {
        const { groupId, inviteId } = await props.params;
        const body = await request.json().catch(() => ({}));
        if (!isUuid(groupId) || !isUuid(inviteId)) return NextResponse.json({ error: 'Invalid request' }, { status: 400 });

        const delivery = sanitizeDelivery(body?.delivery);
        if (!delivery) return NextResponse.json({ error: 'Invalid delivery' }, { status: 400 });

        const group = await getLiveGroup(groupId);
        if (!group) return NextResponse.json({ error: 'This room no longer exists.' }, { status: 404 });
        if (!verifyRoomProof(group, extractProof(request, body))) {
            return NextResponse.json({ error: 'Not allowed' }, { status: 403 });
        }

        // Only a claim that is still live can be completed, and only once.
        const { data, error } = await supabaseAdmin
            .from('group_invites')
            .update({ status: 'used', delivery, used_at: new Date().toISOString() })
            .eq('id', inviteId)
            .eq('group_id', groupId)
            .eq('status', 'claimed')
            .gt('claimed_at', new Date(Date.now() - STALE_CLAIM_MS).toISOString())
            .select('id');
        if (error) {
            if (isMissingTable(error)) return NextResponse.json({ error: MIGRATION_MESSAGE }, { status: 503 });
            throw error;
        }

        if (!data || data.length === 0) {
            return NextResponse.json({ error: 'There is no waiting claim for this invite.' }, { status: 409 });
        }
        return NextResponse.json({ success: true });
    } catch (err) {
        console.error('Deliver invite error:', err);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
