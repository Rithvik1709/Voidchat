import { supabaseAdmin } from './supabaseAdmin';

/** An unclaimed invite stops working after this long. */
export const INVITE_TTL_MS = 24 * 60 * 60 * 1000;
/**
 * A claim that is not completed (the inviter never answered) is released after this long, so a
 * link is not lost just because the inviter was away for a moment.
 */
export const STALE_CLAIM_MS = 2 * 60 * 1000;
/** Unused + waiting invites a room may have at once. */
export const MAX_ACTIVE_INVITES = 25;

export const MIGRATION_MESSAGE = 'One-time invites are not enabled yet: the database needs migrations/invites.sql.';

export const isMissingTable = (error: { code?: string } | null | undefined) =>
    Boolean(error) && (error!.code === '42P01' || error!.code === 'PGRST205');

export type InviteRow = {
    id: string;
    group_id: string;
    token_hash: string;
    status: 'unused' | 'claimed' | 'used';
    created_at: string;
    claimed_at?: string | null;
    claim_pub?: unknown;
    claim_mac?: string | null;
    delivery?: unknown;
};

export const isStaleClaim = (row: Pick<InviteRow, 'status' | 'claimed_at'>, now = Date.now()) =>
    row.status === 'claimed' && Boolean(row.claimed_at) && now - new Date(row.claimed_at as string).getTime() >= STALE_CLAIM_MS;

export const isExpiredInvite = (row: Pick<InviteRow, 'created_at'>, now = Date.now()) =>
    now - new Date(row.created_at).getTime() > INVITE_TTL_MS;

/** What a caller should see: a claim nobody answered looks unused again. */
export const effectiveStatus = (row: InviteRow, now = Date.now()): InviteRow['status'] =>
    isStaleClaim(row, now) ? 'unused' : row.status;

export async function getInvite(inviteId: string): Promise<{ row: InviteRow | null; missingTable: boolean }> {
    const { data, error } = await supabaseAdmin.from('group_invites').select('*').eq('id', inviteId).maybeSingle();
    if (error) {
        if (isMissingTable(error)) return { row: null, missingTable: true };
        throw error;
    }
    return { row: (data as InviteRow) ?? null, missingTable: false };
}
