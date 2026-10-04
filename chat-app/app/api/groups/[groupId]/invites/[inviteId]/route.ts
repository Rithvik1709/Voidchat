import { NextResponse } from 'next/server';
import { hasServiceRole, supabaseAdmin } from '@/lib/server/supabaseAdmin';
import { extractProof, getLiveGroup, isUuid, verifyRoomProof } from '@/lib/server/groups';
import { MIGRATION_MESSAGE, isMissingTable, SERVICE_KEY_MESSAGE } from '@/lib/server/invites';

// DELETE /api/groups/:id/invites/:inviteId: revoke an invite that has not been used yet.
export async function DELETE(
    request: Request,
    props: { params: Promise<{ groupId: string; inviteId: string }> }
) {
    try {
        if (!hasServiceRole) return NextResponse.json({ error: SERVICE_KEY_MESSAGE }, { status: 503 });
        const { groupId, inviteId } = await props.params;
        if (!isUuid(groupId) || !isUuid(inviteId)) return NextResponse.json({ error: 'Invalid request' }, { status: 400 });

        const group = await getLiveGroup(groupId);
        if (!group) return NextResponse.json({ error: 'This room no longer exists.' }, { status: 404 });
        if (!verifyRoomProof(group, extractProof(request))) {
            return NextResponse.json({ error: 'Not allowed' }, { status: 403 });
        }

        const { data, error } = await supabaseAdmin
            .from('group_invites')
            .delete()
            .eq('id', inviteId)
            .eq('group_id', groupId)
            .neq('status', 'used')
            .select('id');
        if (error) {
            if (isMissingTable(error)) return NextResponse.json({ error: MIGRATION_MESSAGE }, { status: 503 });
            throw error;
        }

        if (!data || data.length === 0) {
            return NextResponse.json({ error: 'That invite is not open (it may already be used).' }, { status: 404 });
        }
        return NextResponse.json({ success: true });
    } catch (err) {
        console.error('Revoke invite error:', err);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
