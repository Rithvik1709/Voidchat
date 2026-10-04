import { beforeEach, describe, expect, it } from 'vitest';
import { DELETE } from '@/app/api/groups/[groupId]/end/route';
import { POST as verify } from '@/app/api/groups/[groupId]/verify/route';
import { freshIp, getDb, jsonRequest, params } from '../helpers/api';
import { hashProof } from '@/lib/server/groups';

const proof = 'd'.repeat(64);
const end = (id: string, headers: Record<string, string> = {}) =>
  DELETE(jsonRequest(`/api/groups/${id}/end`, 'DELETE', undefined, headers), params(id));

beforeEach(async () => (await getDb()).reset());

describe('DELETE /api/groups/:id/end', () => {
  it('refuses callers without the proof and leaves the room alone', async () => {
    const db = await getDb();
    const g = db.seedGroup({ proof_hash: hashProof(proof) });
    expect((await end(g.id)).status).toBe(403);
    expect((await end(g.id, { 'x-room-proof': 'e'.repeat(64) })).status).toBe(403);
    expect(db.tables.groups).toHaveLength(1);
  });

  it('deletes the room and every uploaded file for a member', async () => {
    const db = await getDb();
    const g = db.seedGroup({ proof_hash: hashProof(proof) });
    db.seedFile(g.id);
    db.seedFile(g.id);
    const res = await end(g.id, { 'x-room-proof': proof });
    expect(res.status).toBe(200);
    expect(db.tables.groups).toHaveLength(0);
    expect(db.files[g.id]).toHaveLength(0);
  });

  it('is idempotent and rejects invalid ids', async () => {
    const id = crypto.randomUUID();
    const again = await end(id);
    expect(again.status).toBe(200);
    expect((await again.json()).alreadyEnded).toBe(true);
    expect((await end('not-a-uuid')).status).toBe(400);
  });

  it('lets a member end a room even after its timer has run out', async () => {
    const db = await getDb();
    const g = db.seedGroup({ proof_hash: hashProof(proof), expires_at: new Date(Date.now() - 1000).toISOString() });
    expect((await end(g.id, { 'x-room-proof': proof })).status).toBe(200);
    expect(db.tables.groups).toHaveLength(0);
  });
});

describe('POST /api/groups/:id/verify (password check)', () => {
  const check = (id: string, body: unknown, ip = freshIp()) =>
    verify(jsonRequest(`/api/groups/${id}/verify`, 'POST', body, ip), params(id));

  it('says yes only for the right proof', async () => {
    const g = (await getDb()).seedGroup({ proof_hash: hashProof(proof), has_password: true });
    expect((await check(g.id, { proof })).status).toBe(200);
    const wrong = await check(g.id, { proof: 'f'.repeat(64) });
    expect(wrong.status).toBe(403);
    expect((await wrong.json()).error).toBe('Wrong password.');
    expect((await check(g.id, {})).status).toBe(403);
  });

  it('answers 404 for rooms that do not exist or have expired', async () => {
    expect((await check(crypto.randomUUID(), { proof })).status).toBe(404);
    const g = (await getDb()).seedGroup({ expires_at: new Date(Date.now() - 1000).toISOString() });
    expect((await check(g.id, { proof })).status).toBe(404);
  });

  it('slows down repeated guessing from one address', async () => {
    const g = (await getDb()).seedGroup({ proof_hash: hashProof(proof) });
    const ip = freshIp();
    const statuses: number[] = [];
    for (let i = 0; i < 20; i++) statuses.push((await check(g.id, { proof: `${i}`.repeat(30) }, ip)).status);
    expect(statuses.slice(0, 15).every(s => s === 403)).toBe(true);
    expect(statuses.slice(15).every(s => s === 429)).toBe(true);
  });
});
