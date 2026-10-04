import { describe, expect, it } from 'vitest';
import {
  createJoinerKeys, inviteMac, inviteTokenHash, isInviteToken, newInviteToken, sanitizeDelivery,
  unwrapRoomKey, verifyInviteMac, wrapRoomKey,
} from '@/lib/invites';

const ROOM_KEY = JSON.stringify({ alg: 'A256GCM', k: 'super-secret-room-key', kty: 'oct' });
const INVITE_ID = '11111111-1111-1111-1111-111111111111';

describe('invite tokens', () => {
  it('are random, url-safe and the right shape', () => {
    const tokens = Array.from({ length: 200 }, newInviteToken);
    expect(new Set(tokens).size).toBe(200);
    tokens.forEach(t => expect(isInviteToken(t)).toBe(true));
    expect(isInviteToken('short')).toBe(false);
    expect(isInviteToken('a'.repeat(22) + '!')).toBe(false);
    expect(isInviteToken(null)).toBe(false);
  });

  it('are stored only as a hash that differs from the token', async () => {
    const t = newInviteToken();
    const h = await inviteTokenHash(t);
    expect(h).toMatch(/^[0-9a-f]{64}$/);
    expect(h).not.toContain(t);
    expect(await inviteTokenHash(t)).toBe(h);
    expect(await inviteTokenHash(newInviteToken())).not.toBe(h);
  });
});

describe('claim proof (mac)', () => {
  it('verifies for the real token and public key', async () => {
    const t = newInviteToken();
    const { publicJwk } = await createJoinerKeys();
    const mac = await inviteMac(t, publicJwk);
    expect(await verifyInviteMac(t, publicJwk, mac)).toBe(true);
  });

  it('fails for the wrong token, a swapped public key, or junk', async () => {
    const t = newInviteToken();
    const a = (await createJoinerKeys()).publicJwk;
    const b = (await createJoinerKeys()).publicJwk;
    const mac = await inviteMac(t, a);
    expect(await verifyInviteMac(newInviteToken(), a, mac)).toBe(false); // someone who does not hold the link
    expect(await verifyInviteMac(t, b, mac)).toBe(false); // a server (or attacker) swapping in its own key
    expect(await verifyInviteMac(t, a, 'zz')).toBe(false);
    expect(await verifyInviteMac(t, a, '00'.repeat(32))).toBe(false);
    expect(await verifyInviteMac(t, a, '')).toBe(false);
  });
});

describe('key delivery', () => {
  it('lets only the intended joiner recover the room key', async () => {
    const joiner = await createJoinerKeys();
    const other = await createJoinerKeys();
    const delivery = await wrapRoomKey(ROOM_KEY, joiner.publicJwk, INVITE_ID);

    expect(await unwrapRoomKey(delivery, joiner.privateKey, INVITE_ID)).toBe(ROOM_KEY);
    await expect(unwrapRoomKey(delivery, other.privateKey, INVITE_ID)).rejects.toThrow();
  });

  it('is bound to the invite it was made for', async () => {
    const joiner = await createJoinerKeys();
    const delivery = await wrapRoomKey(ROOM_KEY, joiner.publicJwk, INVITE_ID);
    await expect(unwrapRoomKey(delivery, joiner.privateKey, '22222222-2222-2222-2222-222222222222')).rejects.toThrow();
  });

  it('never exposes the room key in what the server stores', async () => {
    const joiner = await createJoinerKeys();
    const delivery = await wrapRoomKey(ROOM_KEY, joiner.publicJwk, INVITE_ID);
    const stored = JSON.stringify(delivery);
    expect(stored).not.toContain('super-secret');
    expect(stored).not.toContain(Buffer.from(ROOM_KEY).toString('base64'));
  });

  it('detects tampering', async () => {
    const joiner = await createJoinerKeys();
    const d = await wrapRoomKey(ROOM_KEY, joiner.publicJwk, INVITE_ID);
    const flipped = { ...d, ct: (d.ct[0] === 'A' ? 'B' : 'A') + d.ct.slice(1) };
    await expect(unwrapRoomKey(flipped, joiner.privateKey, INVITE_ID)).rejects.toThrow();
  });

  it('uses a fresh ephemeral key and iv each time', async () => {
    const joiner = await createJoinerKeys();
    const a = await wrapRoomKey(ROOM_KEY, joiner.publicJwk, INVITE_ID);
    const b = await wrapRoomKey(ROOM_KEY, joiner.publicJwk, INVITE_ID);
    expect(a.iv).not.toBe(b.iv);
    expect(a.epk.x).not.toBe(b.epk.x);
  });
});

describe('sanitizeDelivery (server-side shape check)', () => {
  it('accepts a real delivery and rejects malformed ones', async () => {
    const joiner = await createJoinerKeys();
    const d = await wrapRoomKey(ROOM_KEY, joiner.publicJwk, INVITE_ID);
    expect(sanitizeDelivery(d)).toEqual(d);
    expect(sanitizeDelivery(null)).toBeNull();
    expect(sanitizeDelivery({ ...d, iv: 'short' })).toBeNull();
    expect(sanitizeDelivery({ ...d, ct: '<script>' })).toBeNull();
    expect(sanitizeDelivery({ ...d, ct: 'A'.repeat(5000) })).toBeNull();
    expect(sanitizeDelivery({ ...d, epk: { kty: 'oct' } })).toBeNull();
    expect(sanitizeDelivery({ ...d, extra: 'dropped' })).toEqual(d);
  });
});
