import { NextResponse } from 'next/server';
import { extractProof, getLiveGroup, isUuid, verifyRoomProof } from '@/lib/server/groups';

// Lets the join screen check a room password before entering. A wrong password and a wrong
// link both fail here; the answer is only ever yes or no.
const attempts = new Map<string, number[]>();
const MAX_ATTEMPTS_PER_MINUTE = 15;

function tooMany(req: Request): boolean {
    const ip = (req.headers.get('x-forwarded-for') || 'unknown').split(',')[0].trim();
    const now = Date.now();
    const recent = (attempts.get(ip) || []).filter(t => now - t < 60_000);
    recent.push(now);
    attempts.set(ip, recent);
    if (attempts.size > 5000) attempts.clear();
    return recent.length > MAX_ATTEMPTS_PER_MINUTE;
}

export async function POST(
    request: Request,
    props: { params: Promise<{ groupId: string }> }
) {
    try {
        const { groupId } = await props.params;
        const body = await request.json().catch(() => ({}));

        if (!isUuid(groupId)) {
            return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
        }

        if (tooMany(request)) {
            return NextResponse.json({ error: 'Too many attempts. Wait a minute and try again.' }, { status: 429 });
        }

        const group = await getLiveGroup(groupId);
        if (!group) {
            return NextResponse.json({ error: 'This room no longer exists.', ended: true }, { status: 404 });
        }

        if (!verifyRoomProof(group, extractProof(request, body))) {
            return NextResponse.json({ error: 'Wrong password.' }, { status: 403 });
        }

        return NextResponse.json({ ok: true });
    } catch (err) {
        console.error('Verify error:', err);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
