import { NextResponse } from 'next/server';
import { hasServiceRole, supabaseAdmin } from '@/lib/server/supabaseAdmin';
import { getLiveGroup, isUuid } from '@/lib/server/groups';
import {
    INVITE_TTL_MS, MIGRATION_MESSAGE, STALE_CLAIM_MS, isExpiredInvite, isMissingTable, type InviteRow, SERVICE_KEY_MESSAGE } from '@/lib/server/invites';
import { createLimiter } from '@/lib/server/rateLimit';
import { isHex64 } from '@/lib/invites';
import { sanitizePublicJwk } from '@/lib/signing';

const overLimit = createLimiter(20, 60_000);

// POST /api/invites/claim: the person holding an invite link takes it. This is the moment it
// burns: the server accepts exactly one claim and records who claimed (their public key).
export async function POST(request: Request) {
    try {
        if (!hasServiceRole) return NextResponse.json({ error: SERVICE_KEY_MESSAGE }, { status: 503 });
        if (overLimit(request)) {
            return NextResponse.json({ error: 'Too many attempts. Wait a minute and try again.' }, { status: 429 });
        }

        const body = await request.json().catch(() => ({}));
        const pub = sanitizePublicJwk(body?.pub);
        if (!isUuid(body?.groupId) || !isHex64(body?.tokenHash) || !pub || !isHex64(body?.mac)) {
            return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
        }
        const { groupId } = body as { groupId: string };
        const tokenHash = (body.tokenHash as string).toLowerCase();

        const group = await getLiveGroup(groupId);
        if (!group) {
            return NextResponse.json({ error: 'This room no longer exists.', ended: true }, { status: 404 });
        }

        const now = Date.now();
        const claim = {
            status: 'claimed',
            claimed_at: new Date(now).toISOString(),
            claim_pub: pub,
            claim_mac: (body.mac as string).toLowerCase(),
            delivery: null,
        };
        const notExpired = new Date(now - INVITE_TTL_MS).toISOString();

        // 1) take an unused invite (atomic: only one caller can flip unused -> claimed)
        let { data: won, error } = await supabaseAdmin
            .from('group_invites')
            .update(claim)
            .eq('group_id', groupId)
            .eq('token_hash', tokenHash)
            .eq('status', 'unused')
            .gt('created_at', notExpired)
            .select('id');
        if (error) {
            if (isMissingTable(error)) return NextResponse.json({ error: MIGRATION_MESSAGE }, { status: 503 });
            throw error;
        }

        // 2) or take over a claim that was never answered
        if (!won || won.length === 0) {
            ({ data: won, error } = await supabaseAdmin
                .from('group_invites')
                .update(claim)
                .eq('group_id', groupId)
                .eq('token_hash', tokenHash)
                .eq('status', 'claimed')
                .lt('claimed_at', new Date(now - STALE_CLAIM_MS).toISOString())
                .gt('created_at', notExpired)
                .select('id'));
            if (error) throw error;
        }

        if (won && won.length > 0) {
            return NextResponse.json({ inviteId: won[0].id, staleAfterMs: STALE_CLAIM_MS });
        }

        // Lost: say why, without revealing more than needed.
        const { data: row } = await supabaseAdmin
            .from('group_invites')
            .select('*')
            .eq('group_id', groupId)
            .eq('token_hash', tokenHash)
            .maybeSingle();

        if (!row) return NextResponse.json({ error: 'This invite is not valid.' }, { status: 404 });
        if ((row as InviteRow).status === 'unused' && isExpiredInvite(row as InviteRow, now)) {
            return NextResponse.json({ error: 'This invite has expired.' }, { status: 410 });
        }
        return NextResponse.json({ error: 'This invite has already been used.' }, { status: 409 });
    } catch (err) {
        console.error('Claim invite error:', err);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
