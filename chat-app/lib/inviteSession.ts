/**
 * Tab-scoped storage (sessionStorage) for one-time invites.
 *
 * Joiner: a person who got in through a one-time link has no key in their URL, so the key they
 * were handed is kept for this tab only, letting a refresh work. Closing the tab ends their access.
 * Inviter: the secret tokens of invites they made, so they can still answer a claim after a refresh.
 */
const KEY_PREFIX = 'nullchat_joined_key_';
const INVITES_PREFIX = 'nullchat_my_invites_';

export type StoredInvite = { id: string; token: string };

function read(name: string): string | null {
    try {
        return sessionStorage.getItem(name);
    } catch {
        return null;
    }
}

function write(name: string, value: string | null) {
    try {
        if (value === null) sessionStorage.removeItem(name);
        else sessionStorage.setItem(name, value);
    } catch {
        /* storage unavailable: everything still works for this page view */
    }
}

export const loadJoinedKey = (groupId: string) => read(KEY_PREFIX + groupId);
export const saveJoinedKey = (groupId: string, key: string) => write(KEY_PREFIX + groupId, key);

export function loadMyInvites(groupId: string): StoredInvite[] {
    try {
        const parsed = JSON.parse(read(INVITES_PREFIX + groupId) || '[]');
        return Array.isArray(parsed)
            ? parsed.filter((i): i is StoredInvite => typeof i?.id === 'string' && typeof i?.token === 'string')
            : [];
    } catch {
        return [];
    }
}

export function saveMyInvites(groupId: string, invites: StoredInvite[]) {
    write(INVITES_PREFIX + groupId, invites.length ? JSON.stringify(invites) : null);
}
