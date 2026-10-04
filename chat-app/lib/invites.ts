/**
 * One-time invites: how a room key reaches a person without the key ever being in the link.
 *
 *   link       = /chat/<room>#invite=<token>          (token is random, key is NOT in it)
 *   server     = stores sha256(token) only
 *   joiner     = makes a fresh ECDH key pair, claims the invite with:
 *                  pub, and mac = HMAC(token, pub)    (proves they hold the link)
 *   inviter    = (whose browser made the token) checks the mac, then sends the room key
 *                encrypted to that pub:  ECDH -> HKDF -> AES-GCM
 *   server     = only ever relays opaque ciphertext
 *
 * A malicious server cannot swap in its own key: it cannot produce a valid mac without the token,
 * which it never sees. A second person holding a copy of the link cannot get the key either, because
 * the server accepts only one claim.
 */
import { canonicalPub, sanitizePublicJwk, type PublicJwk } from './signing';

const ECDH = { name: 'ECDH', namedCurve: 'P-256' } as const;
const enc = new TextEncoder();
const dec = new TextDecoder();

export const INVITE_TOKEN_RE = /^[A-Za-z0-9_-]{22}$/;
export const isInviteToken = (v: unknown): v is string => typeof v === 'string' && INVITE_TOKEN_RE.test(v);

// ---- small encoding helpers (browser + Node) -------------------------------------------
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
const toHex = (bytes: Uint8Array) => Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
const fromHex = (hex: string): Uint8Array | null => {
    if (!/^([0-9a-f]{2})+$/i.test(hex)) return null;
    return Uint8Array.from(hex.match(/../g)!.map(h => parseInt(h, 16)));
};

// ---- tokens -----------------------------------------------------------------------------
export function newInviteToken(): string {
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    return toBase64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** What the server stores. The token itself never leaves the browsers that hold the link. */
export async function inviteTokenHash(token: string): Promise<string> {
    const digest = await crypto.subtle.digest('SHA-256', enc.encode(`nullchat-invite:${token}`));
    return toHex(new Uint8Array(digest));
}

// ---- joiner side ------------------------------------------------------------------------
export async function createJoinerKeys(): Promise<{ publicJwk: PublicJwk; privateKey: CryptoKey }> {
    const pair = await crypto.subtle.generateKey(ECDH, false, ['deriveBits']);
    const publicJwk = sanitizePublicJwk(await crypto.subtle.exportKey('jwk', pair.publicKey));
    if (!publicJwk) throw new Error('Could not create a key for this invite.');
    return { publicJwk, privateKey: pair.privateKey };
}

const macKey = (token: string, usage: 'sign' | 'verify') =>
    crypto.subtle.importKey('raw', enc.encode(`nullchat-invite-mac:${token}`), { name: 'HMAC', hash: 'SHA-256' }, false, [usage]);

/** Proof that the claimer holds the link, bound to the exact public key they are claiming with. */
export async function inviteMac(token: string, pub: PublicJwk): Promise<string> {
    const sig = await crypto.subtle.sign('HMAC', await macKey(token, 'sign'), enc.encode(canonicalPub(pub)));
    return toHex(new Uint8Array(sig));
}

export async function verifyInviteMac(token: string, pub: PublicJwk, mac: string): Promise<boolean> {
    const bytes = fromHex(mac);
    if (!bytes || bytes.length !== 32) return false;
    return crypto.subtle.verify('HMAC', await macKey(token, 'verify'), bytes as BufferSource, enc.encode(canonicalPub(pub)));
}

// ---- key wrapping -----------------------------------------------------------------------
export type KeyDelivery = { epk: PublicJwk; iv: string; ct: string };

async function deriveWrapKey(privateKey: CryptoKey, peerPub: PublicJwk, inviteId: string, usage: 'encrypt' | 'decrypt') {
    const peer = await crypto.subtle.importKey('jwk', peerPub, ECDH, false, []);
    const secret = await crypto.subtle.deriveBits({ name: 'ECDH', public: peer }, privateKey, 256);
    const hkdf = await crypto.subtle.importKey('raw', secret, 'HKDF', false, ['deriveKey']);
    return crypto.subtle.deriveKey(
        { name: 'HKDF', hash: 'SHA-256', salt: enc.encode(inviteId), info: enc.encode('nullchat-invite-wrap') },
        hkdf,
        { name: 'AES-GCM', length: 256 },
        false,
        [usage]
    );
}

/** Inviter: encrypt the room key so only the claimer's key pair can read it. */
export async function wrapRoomKey(roomKey: string, joinerPub: PublicJwk, inviteId: string): Promise<KeyDelivery> {
    const ephemeral = await crypto.subtle.generateKey(ECDH, false, ['deriveBits']);
    const epk = sanitizePublicJwk(await crypto.subtle.exportKey('jwk', ephemeral.publicKey));
    if (!epk) throw new Error('Could not wrap the room key.');
    const key = await deriveWrapKey(ephemeral.privateKey, joinerPub, inviteId, 'encrypt');
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(roomKey));
    return { epk, iv: toBase64(iv), ct: toBase64(new Uint8Array(ct)) };
}

/** Joiner: recover the room key. Throws if this delivery was not meant for this key pair. */
export async function unwrapRoomKey(delivery: KeyDelivery, joinerPrivate: CryptoKey, inviteId: string): Promise<string> {
    const iv = fromBase64(delivery.iv);
    const ct = fromBase64(delivery.ct);
    if (!iv || iv.length !== 12 || !ct) throw new Error('Malformed key delivery.');
    const key = await deriveWrapKey(joinerPrivate, delivery.epk, inviteId, 'decrypt');
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: iv as BufferSource }, key, ct as BufferSource);
    return dec.decode(plain);
}

/** Shape check used by the server before it stores a delivery. */
export function sanitizeDelivery(raw: unknown): KeyDelivery | null {
    if (typeof raw !== 'object' || raw === null) return null;
    const { epk, iv, ct } = raw as Record<string, unknown>;
    const cleanEpk = sanitizePublicJwk(epk);
    if (!cleanEpk) return null;
    if (typeof iv !== 'string' || !/^[A-Za-z0-9+/]{16}$/.test(iv)) return null; // 12 bytes
    if (typeof ct !== 'string' || ct.length < 24 || ct.length > 4000 || !/^[A-Za-z0-9+/]+={0,2}$/.test(ct)) return null;
    return { epk: cleanEpk, iv, ct };
}

export const isHex64 = (v: unknown): v is string => typeof v === 'string' && /^[0-9a-f]{64}$/i.test(v);
