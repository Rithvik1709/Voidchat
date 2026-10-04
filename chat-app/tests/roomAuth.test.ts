import { describe, expect, it } from 'vitest';
import { deriveRoomKey, getRoomProof } from '@/lib/roomAuth';
import { decryptMessage, encryptMessage } from '@/lib/crypto';
import { hashProof, verifyRoomProof } from '@/lib/server/groups';

// lib/crypto.ts reads window.crypto; point it at Node's WebCrypto
(globalThis as unknown as { window: unknown }).window = globalThis;

const KEY = JSON.stringify({ alg: 'A256GCM', k: 'abc', kty: 'oct' });

describe('room proof', () => {
  it('is deterministic and depends on the key', async () => {
    expect(await getRoomProof(KEY)).toBe(await getRoomProof(KEY));
    expect(await getRoomProof(KEY)).not.toBe(await getRoomProof('another key'));
  });

  it('changes with the password, and a password-less proof is unchanged', async () => {
    const plain = await getRoomProof(KEY);
    expect(await getRoomProof(KEY, '')).toBe(plain);
    expect(await getRoomProof(KEY, 'hunter2')).not.toBe(plain);
    expect(await getRoomProof(KEY, 'hunter2')).not.toBe(await getRoomProof(KEY, 'hunter3'));
  });
});

describe('server-side proof check', () => {
  it('accepts the right proof and rejects wrong, empty and oversized ones', async () => {
    const proof = await getRoomProof(KEY, 'pw');
    const group = { id: 'x', name: 'n', proof_hash: hashProof(proof) };
    expect(verifyRoomProof(group, proof)).toBe(true);
    expect(verifyRoomProof(group, await getRoomProof(KEY, 'wrong'))).toBe(false);
    expect(verifyRoomProof(group, await getRoomProof(KEY))).toBe(false);
    expect(verifyRoomProof(group, '')).toBe(false);
    expect(verifyRoomProof(group, 'a'.repeat(200))).toBe(false);
  });

  it('does not accept the stored hash as a proof', async () => {
    const proof = await getRoomProof(KEY);
    const group = { id: 'x', name: 'n', proof_hash: hashProof(proof) };
    expect(verifyRoomProof(group, group.proof_hash)).toBe(false);
  });

  it('lets legacy rooms without a hash through', () => {
    expect(verifyRoomProof({ id: 'x', name: 'n', proof_hash: null }, '')).toBe(true);
  });
});

describe('password-derived encryption key', () => {
  it('decrypts with the right password only', async () => {
    const right = await deriveRoomKey(KEY, 'correct horse');
    const wrong = await deriveRoomKey(KEY, 'wrong horse');
    const cipher = await encryptMessage('secret hello', right);
    expect(await decryptMessage(cipher, right)).toBe('secret hello');
    await expect(decryptMessage(cipher, wrong)).rejects.toThrow();
  });

  it('depends on the link key too, not just the password', async () => {
    const a = await deriveRoomKey(KEY, 'same password');
    const b = await deriveRoomKey('a different link key', 'same password');
    const cipher = await encryptMessage('hello', a);
    await expect(decryptMessage(cipher, b)).rejects.toThrow();
  });
}, 30_000);
