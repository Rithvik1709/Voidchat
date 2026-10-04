import { describe, expect, it } from 'vitest';
import {
  canonicalPub, createSigner, importPublicKey, messageSigData, sanitizePublicJwk, updatePins,
  verifySignature, voteSigData,
} from '@/lib/signing';

const room = '11111111-1111-1111-1111-111111111111';
const msg = { id: 'm1', sender: 'alice', timestamp: '2026-10-04T10:00:00.000Z', encryptedPayload: 'abc==' };

describe('message signatures', () => {
  it('accepts a genuine signed message', async () => {
    const alice = await createSigner();
    const pub = (await importPublicKey(alice.publicJwk))!;
    const sig = await alice.sign(messageSigData(room, msg));
    expect(await verifySignature(pub, messageSigData(room, msg), sig)).toBe(true);
  });

  it('rejects a tampered payload, a swapped sender, and another room', async () => {
    const alice = await createSigner();
    const pub = (await importPublicKey(alice.publicJwk))!;
    const sig = await alice.sign(messageSigData(room, msg));
    expect(await verifySignature(pub, messageSigData(room, { ...msg, encryptedPayload: 'xyz==' }), sig)).toBe(false);
    expect(await verifySignature(pub, messageSigData(room, { ...msg, sender: 'bob' }), sig)).toBe(false);
    expect(await verifySignature(pub, messageSigData('22222222-2222-2222-2222-222222222222', msg), sig)).toBe(false);
  });

  it("rejects someone else's key signing as alice", async () => {
    const alice = await createSigner();
    const mallory = await createSigner();
    const pub = (await importPublicKey(alice.publicJwk))!;
    const forged = await mallory.sign(messageSigData(room, msg));
    expect(await verifySignature(pub, messageSigData(room, msg), forged)).toBe(false);
  });

  it('rejects malformed signatures', async () => {
    const alice = await createSigner();
    const pub = (await importPublicKey(alice.publicJwk))!;
    for (const bad of ['', 'AAAA', '!!!', 'A'.repeat(500)]) {
      expect(await verifySignature(pub, 'x', bad)).toBe(false);
    }
  });

  it('does not accept a message signature as a vote signature', async () => {
    const alice = await createSigner();
    const pub = (await importPublicKey(alice.publicJwk))!;
    const vote = { messageId: 'm1', sender: 'alice', encryptedPayload: 'v==' };
    const sig = await alice.sign(messageSigData(room, msg));
    expect(await verifySignature(pub, voteSigData(room, vote), sig)).toBe(false);
    const vsig = await alice.sign(voteSigData(room, vote));
    expect(await verifySignature(pub, voteSigData(room, vote), vsig)).toBe(true);
  });
});

describe('public key validation', () => {
  it('only accepts well-formed P-256 keys', async () => {
    const { publicJwk } = await createSigner();
    expect(sanitizePublicJwk(publicJwk)).toEqual(publicJwk);
    expect(sanitizePublicJwk(null)).toBeNull();
    expect(sanitizePublicJwk({ kty: 'RSA' })).toBeNull();
    expect(sanitizePublicJwk({ kty: 'EC', crv: 'P-256', x: 'short', y: 'short' })).toBeNull();
    expect(sanitizePublicJwk({ ...publicJwk, crv: 'P-384' })).toBeNull();
  });
});

describe('name pinning', () => {
  const meta = (pub: unknown) => ({ online_at: 'x', pub });

  it('pins a single key', async () => {
    const a = (await createSigner()).publicJwk;
    const r = updatePins(new Map(), { alice: [meta(a)] });
    expect(r.pins.get('alice')).toBe(canonicalPub(a));
    expect(r.contested.size).toBe(0);
  });

  it('keeps the original key when an impostor joins later under the same name', async () => {
    const a = (await createSigner()).publicJwk;
    const m = (await createSigner()).publicJwk;
    const first = updatePins(new Map(), { alice: [meta(a)] });
    const second = updatePins(first.pins, { alice: [meta(a), meta(m)] });
    expect(second.pins.get('alice')).toBe(canonicalPub(a));
    expect(second.contested.has('alice')).toBe(false);
  });

  it('treats a name with two unknown keys as contested and trusts neither', async () => {
    const a = (await createSigner()).publicJwk;
    const m = (await createSigner()).publicJwk;
    const r = updatePins(new Map(), { alice: [meta(m), meta(a)] });
    expect(r.contested.has('alice')).toBe(true);
    expect(r.pins.has('alice')).toBe(false);
  });

  it('re-pins to the remaining key after the owner leaves, and releases names that vanish', async () => {
    const a = (await createSigner()).publicJwk;
    const m = (await createSigner()).publicJwk;
    const prev = new Map([['alice', canonicalPub(a)]]);
    expect(updatePins(prev, { alice: [meta(m)] }).pins.get('alice')).toBe(canonicalPub(m));
    expect(updatePins(prev, {}).pins.size).toBe(0);
  });

  it('never pins members without a valid key', () => {
    const r = updatePins(new Map(), { alice: [{ online_at: 'x' }], bob: [meta('junk')] });
    expect(r.pins.size).toBe(0);
    expect(r.contested.size).toBe(0);
  });
});
