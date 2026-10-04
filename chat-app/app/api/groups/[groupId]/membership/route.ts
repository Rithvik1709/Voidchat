import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/server/supabaseAdmin';
import { deleteGroupAndMedia, extractProof, getGroup, getLiveGroup, isUuid, maybeSweep, verifyRoomProof } from '@/lib/server/groups';

// Handle Join/Leave actions. The proof travels in the body so navigator.sendBeacon can use it.
export async function POST(
    request: Request,
    props: { params: Promise<{ groupId: string }> }
) {
    try {
        const { groupId } = await props.params;
        const body = await request.json().catch(() => ({}));
        const action = body?.action;

        if (!isUuid(groupId) || (action !== 'join' && action !== 'leave')) {
            return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
        }

        // An expired room is deleted on the spot and reported as ended
        const group = await getLiveGroup(groupId);
        if (!group) {
            return NextResponse.json({ success: true, ended: true });
        }

        if (!verifyRoomProof(group, extractProof(request, body))) {
            return NextResponse.json({ error: 'Not allowed' }, { status: 403 });
        }

        if (action === 'join') {
            const limit = group.max_members ?? null;

            if (limit !== null && (group.active_user_count ?? 0) >= limit) {
                return NextResponse.json({ error: 'This room is full.', full: true }, { status: 409 });
            }

            // Atomic: only takes a seat while one is free (needs migrations/room_options.sql)
            const { data: joined, error: joinError } = await supabaseAdmin.rpc('try_join_group', { group_id: groupId });

            if (!joinError) {
                if (joined === false) {
                    return NextResponse.json({ error: 'This room is full.', full: true }, { status: 409 });
                }
            } else {
                // Function not installed yet: fall back to the plain counter
                const { error } = await supabaseAdmin.rpc('increment_active_users', { group_id: groupId });

                if (error) {
                    console.error('RPC increment failed, falling back manually:', error);
                    await supabaseAdmin
                        .from('groups')
                        .update({
                            active_user_count: (group.active_user_count || 0) + 1,
                            last_active_at: new Date().toISOString(),
                        })
                        .eq('id', groupId);
                }
            }
            maybeSweep();
        } else {
            const { error } = await supabaseAdmin.rpc('decrement_active_users', { group_id: groupId });

            if (error) {
                console.error('RPC decrement failed, falling back manually:', error);
                await supabaseAdmin
                    .from('groups')
                    .update({
                        active_user_count: Math.max(0, (group.active_user_count || 1) - 1),
                        last_active_at: new Date().toISOString(),
                    })
                    .eq('id', groupId);
            }

            // The decrement RPC deletes an empty room's row; make sure its media goes too.
            const after = await getGroup(groupId);
            if (!after || (after.active_user_count ?? 0) <= 0) {
                await deleteGroupAndMedia(groupId);
            }
        }

        return NextResponse.json({ success: true });
    } catch (err) {
        console.error('Membership error:', err);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
