import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { MIGRATION_MESSAGE, effectiveStatus, getInvite } from '@/lib/server/invites';
import { createLimiter } from '@/lib/server/rateLimit';
import { isHex64 } from '@/lib/invites';
import { isUuid } from '@/lib/server/groups';

const overLimit = createLimiter(120, 60_000); // a joiner polls about every 2 seconds

const sameHex = (a: string, b: string) => {
    const x = Buffer.from(a.toLowerCase(), 'hex');
    const y = Buffer.from(b.toLowerCase(), 'hex');
    return x.length === y.length && timingSafeEqual(x, y);
};

// GET /api/invites/:inviteId/delivery?mac=...: the claimer polls for the encrypted room key.
// Only the claimer can read it: they hold the mac they claimed with.
export async function GET(
    request: Request,
    props: { params: Promise<{ inviteId: string }> }
) {
    try {
        if (overLimit(request)) {
            return NextResponse.json({ error: 'Slow down.' }, { status: 429 });
        }

        const { inviteId } = await props.params;
        const mac = new URL(request.url).searchParams.get('mac');
        if (!isUuid(inviteId) || !isHex64(mac)) {
            return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
        }

        const { row, missingTable } = await getInvite(inviteId);
        if (missingTable) return NextResponse.json({ error: MIGRATION_MESSAGE }, { status: 503 });
        if (!row || !row.claim_mac || !sameHex(row.claim_mac, mac)) {
            return NextResponse.json({ error: 'No such claim.' }, { status: 404 });
        }

        // The claim lapsed (nobody answered in time), or someone else took the invite over
        if (effectiveStatus(row) === 'unused') {
            return NextResponse.json({ status: 'released' }, { headers: { 'Cache-Control': 'no-store' } });
        }

        return NextResponse.json(
            { status: row.status, delivery: row.status === 'used' ? row.delivery ?? null : null },
            { headers: { 'Cache-Control': 'no-store' } }
        );
    } catch (err) {
        console.error('Invite delivery error:', err);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
