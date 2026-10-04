import { NextResponse } from 'next/server';
import { hasServiceRole, supabaseAdmin } from '@/lib/server/supabaseAdmin';
import { extractProof, getLiveGroup, isUuid, verifyRoomProof } from '@/lib/server/groups';
import {
    INVITE_TTL_MS, MAX_ACTIVE_INVITES, MIGRATION_MESSAGE, effectiveStatus, isExpiredInvite, isMissingTable, type InviteRow, SERVICE_KEY_MESSAGE } from '@/lib/server/invites';
import { isHex64 } from '@/lib/invites';

type Props = { params: Promise<{ groupId: string }> };

// POST /api/groups/:id/invites: a member registers a new one-time invite. The server only ever
// receives a hash of the link's token.
export async function POST(request: Request, props: Props) {
    try {
        if (!hasServiceRole) return NextResponse.json({ error: SERVICE_KEY_MESSAGE }, { status: 503 });
        const { groupId } = await props.params;
        const body = await request.json().catch(() => ({}));

        if (!isUuid(groupId) || !isHex64(body?.tokenHash)) {
            return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
        }

        const group = await getLiveGroup(groupId);
        if (!group) return NextResponse.json({ error: 'This room no longer exists.' }, { status: 404 });
        if (!verifyRoomProof(group, extractProof(request, body))) {
            return NextResponse.json({ error: 'Not allowed' }, { status: 403 });
        }

        const { data: existing, error: listError } = await supabaseAdmin
            .from('group_invites')
            .select('*')
            .eq('group_id', groupId);
        if (listError) {
            if (isMissingTable(listError)) return NextResponse.json({ error: MIGRATION_MESSAGE }, { status: 503 });
            throw listError;
        }

        const now = Date.now();
        const active = ((existing ?? []) as InviteRow[]).filter(r => r.status !== 'used' && !isExpiredInvite(r, now));
        if (active.length >= MAX_ACTIVE_INVITES) {
            return NextResponse.json({ error: `This room already has ${MAX_ACTIVE_INVITES} open invites. Revoke or use some first.` }, { status: 429 });
        }

        const { data, error } = await supabaseAdmin
            .from('group_invites')
            .insert([{ group_id: groupId, token_hash: body.tokenHash.toLowerCase() }])
            .select('id')
            .single();
        if (error) {
            if (isMissingTable(error)) return NextResponse.json({ error: MIGRATION_MESSAGE }, { status: 503 });
            if (error.code === '23505') return NextResponse.json({ error: 'That invite already exists.' }, { status: 409 });
            throw error;
        }

        return NextResponse.json({ id: data!.id, expiresInMs: INVITE_TTL_MS }, { status: 201 });
    } catch (err) {
        console.error('Create invite error:', err);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

// GET /api/groups/:id/invites: a member lists open invites and any claims waiting for the room key.
export async function GET(request: Request, props: Props) {
    try {
        if (!hasServiceRole) return NextResponse.json({ error: SERVICE_KEY_MESSAGE }, { status: 503 });
        const { groupId } = await props.params;
        if (!isUuid(groupId)) return NextResponse.json({ error: 'Invalid request' }, { status: 400 });

        const group = await getLiveGroup(groupId);
        if (!group) return NextResponse.json({ error: 'This room no longer exists.' }, { status: 404 });
        if (!verifyRoomProof(group, extractProof(request))) {
            return NextResponse.json({ error: 'Not allowed' }, { status: 403 });
        }

        const { data, error } = await supabaseAdmin
            .from('group_invites')
            .select('*')
            .eq('group_id', groupId)
            .order('created_at', { ascending: true });
        if (error) {
            if (isMissingTable(error)) return NextResponse.json({ error: MIGRATION_MESSAGE }, { status: 503 });
            throw error;
        }

        const now = Date.now();
        const invites = ((data ?? []) as InviteRow[])
            .filter(r => !(r.status === 'unused' && isExpiredInvite(r, now)))
            .map(r => {
                const status = effectiveStatus(r, now);
                return {
                    id: r.id,
                    status,
                    created_at: r.created_at,
                    claimed_at: status === 'claimed' ? r.claimed_at ?? null : null,
                    // only a live claim exposes the joiner's (public) key and proof, so the inviter can answer it
                    claim_pub: status === 'claimed' ? r.claim_pub ?? null : null,
                    claim_mac: status === 'claimed' ? r.claim_mac ?? null : null,
                };
            });

        return NextResponse.json({ invites }, { headers: { 'Cache-Control': 'no-store' } });
    } catch (err) {
        console.error('List invites error:', err);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
