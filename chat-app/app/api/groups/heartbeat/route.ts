import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/server/supabaseAdmin';
import { extractProof, getLiveGroup, isUuid, verifyRoomProof } from '@/lib/server/groups';

export async function POST(request: Request) {
    try {
        const body = await request.json().catch(() => ({}));
        const groupId = body?.groupId;

        if (!isUuid(groupId)) {
            return NextResponse.json({ error: 'Missing groupId' }, { status: 400 });
        }

        const group = await getLiveGroup(groupId);
        if (!group) {
            return NextResponse.json({ success: true, ended: true });
        }

        if (!verifyRoomProof(group, extractProof(request, body))) {
            return NextResponse.json({ error: 'Not allowed' }, { status: 403 });
        }

        const { error } = await supabaseAdmin
            .from('groups')
            .update({ last_active_at: new Date().toISOString() })
            .eq('id', groupId);

        if (error) {
            console.error('Heartbeat update failed:', error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ success: true });
    } catch (err) {
        console.error('Heartbeat error:', err);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
