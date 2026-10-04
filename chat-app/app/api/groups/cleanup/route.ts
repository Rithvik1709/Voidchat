import { NextResponse } from 'next/server';
import { sweepStaleGroups } from '@/lib/server/groups';

// Safe for anyone to call: it only removes rooms that are empty AND older than a grace period,
// or that have not sent a heartbeat for 30 minutes. Brand-new rooms are never touched.
async function run() {
    try {
        const { emptyGroups, inactiveGroups, expiredGroups } = await sweepStaleGroups();
        return NextResponse.json({
            success: true,
            deleted: emptyGroups + inactiveGroups + expiredGroups,
            emptyGroups,
            inactiveGroups,
            expiredGroups,
        });
    } catch (err) {
        console.error('Cleanup error:', err);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export const DELETE = run;
export const GET = run;
