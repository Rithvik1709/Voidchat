import { NextResponse } from 'next/server';
import { deleteGroupAndMedia, extractProof, getGroup, isUuid, verifyRoomProof } from '@/lib/server/groups';

// DELETE /api/groups/:groupId/end - End the session: delete the room and all of its media.
export async function DELETE(
    request: Request,
    props: { params: Promise<{ groupId: string }> }
) {
    try {
        const { groupId } = await props.params;

        if (!isUuid(groupId)) {
            return NextResponse.json({ error: 'Invalid group' }, { status: 400 });
        }

        const group = await getGroup(groupId);

        // Already gone (for example the last person left): ending it again is a no-op.
        if (!group) {
            return NextResponse.json({ success: true, alreadyEnded: true });
        }

        if (!verifyRoomProof(group, extractProof(request))) {
            return NextResponse.json({ error: 'Not allowed to end this session.' }, { status: 403 });
        }

        await deleteGroupAndMedia(groupId);
        return NextResponse.json({ success: true });
    } catch (err) {
        console.error('End session error:', err);
        return NextResponse.json({ error: 'Failed to end the session' }, { status: 500 });
    }
}
