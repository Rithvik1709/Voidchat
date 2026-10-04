/**
 * Per-session message signing.
 *
 * Everyone in a room shares one AES key, which only proves "a member sent this". To prove WHICH
 * member, each browser makes an ECDSA P-256 key pair when it joins. The private key never
 * leaves the tab; the public key is announced through presence next to the username. Every
 * message and vote is signed, and receivers check the signature against the key pinned to
 * that username.
 */

const ALGO = { name: 'ECDSA', namedCurve: 'P-256' } as const;
const SIGN_PARAMS = { name: 'ECDSA', hash: 'SHA-256' } as const;
const COORD_RE = /^[A-Za-z0-9_-]{43}$/; // a P-256 coordinate in base64url

export type PublicJwk = { kty: 'EC'; crv: 'P-256'; x: string; y: string };

export type Signer = {
    /** Safe to publish. */
    publicJwk: PublicJwk;
    sign: (data: string) => Promise<string>;
};

const toBase64 = (bytes: Uint8Array) => {
    let bin = '';
    bytes.forEach(b => { bin += String.fromCharCode(b); });
    return btoa(bin);
};

const fromBase64 = (b64: string): Uint8Array | null => {
    try {
        const bin = atob(b64);
        const out = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
        return out;
    } catch {
        return null;
    }
};

export async function createSigner(): Promise<Signer> {
    const pair = await crypto.subtle.generateKey(ALGO, false, ['sign', 'verify']);
    const jwk = await crypto.subtle.exportKey('jwk', pair.publicKey);
    const publicJwk = sanitizePublicJwk(jwk);
    if (!publicJwk) throw new Error('Could not create a signing key.');

    return {
        publicJwk,
        sign: async (data: string) => {
            const sig = await crypto.subtle.sign(SIGN_PARAMS, pair.privateKey, new TextEncoder().encode(data));
            return toBase64(new Uint8Array(sig));
        },
    };
}

/** Accept only a well-formed P-256 public key; returns a clean copy or null. */
export function sanitizePublicJwk(raw: unknown): PublicJwk | null {
    if (typeof raw !== 'object' || raw === null) return null;
    const { kty, crv, x, y } = raw as Record<string, unknown>;
    if (kty !== 'EC' || crv !== 'P-256') return null;
    if (typeof x !== 'string' || typeof y !== 'string' || !COORD_RE.test(x) || !COORD_RE.test(y)) return null;
    return { kty, crv, x, y };
}

export const canonicalPub = (jwk: PublicJwk) => `${jwk.x}.${jwk.y}`;

export async function importPublicKey(jwk: PublicJwk): Promise<CryptoKey | null> {
    try {
        return await crypto.subtle.importKey('jwk', jwk, ALGO, false, ['verify']);
    } catch {
        return null;
    }
}

export async function verifySignature(publicKey: CryptoKey, data: string, signatureB64: string): Promise<boolean> {
    if (typeof signatureB64 !== 'string' || signatureB64.length > 128) return false;
    const sig = fromBase64(signatureB64);
    if (!sig || sig.length !== 64) return false; // P-256 signatures are exactly 64 bytes here
    try {
        return await crypto.subtle.verify(SIGN_PARAMS, publicKey, sig as BufferSource, new TextEncoder().encode(data));
    } catch {
        return false;
    }
}

// What gets signed. A JSON array keeps the fields unambiguous, and the room id stops a
// signed message from being replayed into another room.
export const messageSigData = (
    groupId: string,
    m: { id: string; sender: string; timestamp: string; encryptedPayload: string }
) => JSON.stringify(['msg', groupId, m.id, m.sender, m.timestamp, m.encryptedPayload]);

export const voteSigData = (
    groupId: string,
    v: { messageId: string; sender: string; encryptedPayload: string }
) => JSON.stringify(['vote', groupId, v.messageId, v.sender, v.encryptedPayload]);

// ---- Name -> public key pinning ---------------------------------------------------------

export type PinResult = {
    /** username -> canonical public key currently trusted for that name */
    pins: Map<string, string>;
    /** names with several different keys and no previously trusted one: nothing is accepted */
    contested: Set<string>;
    /** canonical key -> sanitized public key, for importing */
    jwkByCanon: Map<string, PublicJwk>;
};

/**
 * Decide which key to trust for each name currently in the room.
 *
 *  - A key that was already trusted stays trusted while it is still present, so someone
 *    joining later under the same name cannot take it over.
 *  - If a name has exactly one key, that key is trusted (new name, or the owner reconnected).
 *  - If a name has several keys and none was trusted before, it is "contested": rather than
 *    guess, messages under that name are rejected.
 */
export function updatePins(prev: Map<string, string>, presence: Record<string, unknown[]>): PinResult {
    const pins = new Map<string, string>();
    const contested = new Set<string>();
    const jwkByCanon = new Map<string, PublicJwk>();

    for (const [name, metas] of Object.entries(presence)) {
        if (!name || name === 'undefined') continue;

        const found = new Set<string>();
        for (const meta of Array.isArray(metas) ? metas : []) {
            const jwk = sanitizePublicJwk((meta as { pub?: unknown } | null)?.pub);
            if (!jwk) continue;
            const canon = canonicalPub(jwk);
            found.add(canon);
            jwkByCanon.set(canon, jwk);
        }
        if (found.size === 0) continue;

        const before = prev.get(name);
        if (before && found.has(before)) pins.set(name, before);
        else if (found.size === 1) pins.set(name, [...found][0]);
        else contested.add(name);
    }

    return { pins, contested, jwkByCanon };
}
