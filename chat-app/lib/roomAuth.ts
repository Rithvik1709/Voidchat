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

/**
 * Rooms can also have a password "on top of the link". The password is mixed into the proof,
 * so a wrong password fails the server's check, and into the encryption key (deriveRoomKey),
 * so a wrong password cannot decrypt anything either.
 */
export function getRoomProof(keyString: string, password?: string): Promise<string> {
    return sha256Hex(password ? `nullchat-proof:${keyString}:pw:${password}` : `nullchat-proof:${keyString}`);
}

const PBKDF2_ITERATIONS = 210_000;

/**
 * Encryption key for a password-protected room: PBKDF2(password, salt = link key). Without the
 * link the password alone is useless, and without the password the link alone is useless.
 */
export async function deriveRoomKey(keyString: string, password: string): Promise<CryptoKey> {
    const enc = new TextEncoder();
    const material = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey(
        { name: 'PBKDF2', salt: enc.encode(`nullchat-room:${keyString}`), iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
        material,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt']
    );
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
