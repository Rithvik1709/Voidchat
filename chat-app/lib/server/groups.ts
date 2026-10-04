import { createHash, timingSafeEqual } from 'crypto';
import { supabaseAdmin, MEDIA_BUCKET } from './supabaseAdmin';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (v: unknown): v is string => typeof v === 'string' && UUID_RE.test(v);

const sha256Hex = (v: string) => createHash('sha256').update(v).digest('hex');

export type GroupRow = {
    id: string;
    name: string;
    proof_hash?: string | null;
    active_user_count?: number | null;
    last_active_at?: string | null;
    created_at?: string;
    expires_at?: string | null;
    max_members?: number | null;
    has_password?: boolean | null;
    invite_only?: boolean | null;
    burn_seconds?: number | null;
};

export const isExpired = (group: Pick<GroupRow, 'expires_at'>, now = Date.now()) =>
    Boolean(group.expires_at) && new Date(group.expires_at as string).getTime() <= now;

export async function getGroup(groupId: string): Promise<GroupRow | null> {
    if (!isUuid(groupId)) return null;
    const { data, error } = await supabaseAdmin
        .from('groups')
        .select('*')
        .eq('id', groupId)
        .maybeSingle();
    if (error) {
        console.error('getGroup failed:', error);
        return null;
    }
    return (data as GroupRow) ?? null;
}

/**
 * Like getGroup, but a room whose timer has run out is deleted (with its media) and reported as
 * gone, so an expired room can never be joined, uploaded to or kept alive.
 */
export async function getLiveGroup(groupId: string): Promise<GroupRow | null> {
    const group = await getGroup(groupId);
    if (!group) return null;
    if (isExpired(group)) {
        try {
            await deleteGroupAndMedia(groupId);
        } catch {
            /* logged inside */
        }
        return null;
    }
    return group;
}

/** Proof comes from the x-room-proof header or the request body. */
export function extractProof(req: Request, body?: { proof?: unknown } | null): string {
    const fromHeader = req.headers.get('x-room-proof');
    const fromBody = body && typeof body.proof === 'string' ? body.proof : '';
    return (fromHeader || fromBody || '').trim();
}

/**
 * Rooms created before proof_hash existed have no hash; they stay accessible (legacy).
 * Everything else requires the caller to know the room key.
 */
export function verifyRoomProof(group: GroupRow, proof: string): boolean {
    if (!group.proof_hash) return true;
    if (!proof || proof.length > 128) return false;
    const expected = Buffer.from(group.proof_hash, 'hex');
    const actual = Buffer.from(sha256Hex(proof), 'hex');
    return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export const hashProof = sha256Hex;

/** Remove every uploaded file for a room. */
export async function deleteGroupMedia(groupId: string): Promise<void> {
    try {
        for (let guard = 0; guard < 20; guard++) {
            const { data: files, error } = await supabaseAdmin.storage
                .from(MEDIA_BUCKET)
                .list(groupId, { limit: 1000 });
            if (error || !files || files.length === 0) return;

            const paths = files.map(f => `${groupId}/${f.name}`);
            const { error: removeError } = await supabaseAdmin.storage.from(MEDIA_BUCKET).remove(paths);
            if (removeError) {
                console.error('Failed to delete room media:', removeError);
                return;
            }
            if (files.length < 1000) return;
        }
    } catch (err) {
        console.error('Room media cleanup error:', err);
    }
}

/** Delete a room and its media. Returns whether a row was actually removed. */
export async function deleteGroupAndMedia(groupId: string): Promise<boolean> {
    await deleteGroupMedia(groupId);
    const { data, error } = await supabaseAdmin.from('groups').delete().eq('id', groupId).select('id');
    if (error) {
        console.error('Failed to delete group:', error);
        throw error;
    }
    return (data?.length ?? 0) > 0;
}

const EMPTY_GRACE_MS = 15 * 60 * 1000; // a new room may sit empty this long before it is swept
const STALE_MS = 30 * 60 * 1000; // no heartbeat for this long => nobody is really there

/**
 * Remove rooms nobody is using. Safe to call by anyone, any time: it only touches rooms that
 * are empty AND old, or that have not sent a heartbeat for a long time (stuck user counts).
 */
export async function sweepStaleGroups(): Promise<{ emptyGroups: number; inactiveGroups: number; expiredGroups: number }> {
    const now = Date.now();
    const emptyCutoff = new Date(now - EMPTY_GRACE_MS).toISOString();
    const staleCutoff = new Date(now - STALE_MS).toISOString();

    const { data: empty } = await supabaseAdmin
        .from('groups')
        .select('id')
        .lte('active_user_count', 0)
        .lt('last_active_at', emptyCutoff);

    // Rooms whose auto-close timer has run out (column only exists after migrations/room_options.sql)
    const { data: expired } = await supabaseAdmin
        .from('groups')
        .select('id')
        .not('expires_at', 'is', null)
        .lt('expires_at', new Date(now).toISOString());

    const { data: stale } = await supabaseAdmin
        .from('groups')
        .select('id')
        .gt('active_user_count', 0)
        .lt('last_active_at', staleCutoff);

    const remove = async (rows: { id: string }[] | null) => {
        let n = 0;
        for (const row of rows ?? []) {
            try {
                if (await deleteGroupAndMedia(row.id)) n++;
            } catch {
                /* logged inside */
            }
        }
        return n;
    };

    return {
        emptyGroups: await remove(empty),
        inactiveGroups: await remove(stale),
        expiredGroups: await remove(expired ?? []),
    };
}

let lastSweep = 0;
/** Throttled, fire-and-forget sweep that runs as a side effect of normal traffic. */
export function maybeSweep() {
    if (Date.now() - lastSweep < 5 * 60 * 1000) return;
    lastSweep = Date.now();
    sweepStaleGroups().catch(err => console.error('Background sweep failed:', err));
}
