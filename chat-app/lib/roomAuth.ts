/**
 * Room proof: lets the server check that a caller knows the room key without the
 * server (or the database) ever storing the key itself.
 *
 *   proof      = sha256("nullchat-proof:" + keyString)      (computed in the browser)
 *   proof_hash = sha256(proof)                              (stored in the database)
 *
 * Someone who can only read the database sees proof_hash, which cannot be turned back
 * into a proof or into the key.
 */
async function sha256Hex(input: string): Promise<string> {
    const data = new TextEncoder().encode(input);
    const digest = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(digest))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
}

export function getRoomProof(keyString: string): Promise<string> {
    return sha256Hex(`nullchat-proof:${keyString}`);
}

// ---- Creator-side key storage -------------------------------------------------
// The server never stores room keys. The creator's browser remembers them so the
// "Your Groups" list can still build a working join link.
const KEYS_STORAGE = 'nullchat_room_keys';

function readKeys(): Record<string, string> {
    try {
        const parsed = JSON.parse(localStorage.getItem(KEYS_STORAGE) || '{}');
        return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
        return {};
    }
}

export function saveRoomKey(groupId: string, keyString: string) {
    try {
        localStorage.setItem(KEYS_STORAGE, JSON.stringify({ ...readKeys(), [groupId]: keyString }));
    } catch {
        /* storage unavailable: the invite link is still shown once at creation */
    }
}

export function loadRoomKey(groupId: string): string | undefined {
    return readKeys()[groupId];
}

/** Forget keys for rooms that no longer exist. */
export function pruneRoomKeys(liveGroupIds: string[]) {
    try {
        const keys = readKeys();
        const live = new Set(liveGroupIds);
        const kept = Object.fromEntries(Object.entries(keys).filter(([id]) => live.has(id)));
        if (Object.keys(kept).length !== Object.keys(keys).length) {
            localStorage.setItem(KEYS_STORAGE, JSON.stringify(kept));
        }
    } catch {
        /* ignore */
    }
}
