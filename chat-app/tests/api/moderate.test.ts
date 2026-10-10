import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { POST } from '@/app/api/groups/[groupId]/moderate/route';
import { freshIp, getDb, jsonRequest, params } from '../helpers/api';
import { hashProof } from '@/lib/server/groups';

const proof = 'f'.repeat(64);
const check = (id: string, body: unknown, headers: Record<string, string> = {}) =>
  POST(jsonRequest(`/api/groups/${id}/moderate`, 'POST', body, { ...freshIp(), ...headers }), params(id));
const one = { messages: [{ id: 'm1', sender: 'ghost', text: 'hello' }] };

/** Pretend the guard service answered with this verdict. */
const guardSays = (verdict: unknown, status = 200) => {
  const fake = vi.fn(async () => new Response(JSON.stringify(verdict), { status }));
  vi.stubGlobal('fetch', fake);
  return fake;
};

beforeEach(async () => {
  (await getDb()).reset();
  process.env.MODERATION_URL = 'https://guard.example';
  process.env.MODERATION_SECRET = 'shh';
});
afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.MODERATION_URL;
  delete process.env.MODERATION_SECRET;
});

describe('POST /api/groups/:id/moderate', () => {
  it('rejects non-members without asking the guard', async () => {
    const db = await getDb();
    const g = db.seedGroup({ proof_hash: hashProof(proof) });
    const fake = guardSays({ terminate: true });
    const res = await check(g.id, one, { 'x-room-proof': 'e'.repeat(64) });
    expect(res.status).toBe(403);
    expect(fake).not.toHaveBeenCalled();
    expect(db.tables.groups).toHaveLength(1);
  });

  it('ends the room on the server when the guard says so', async () => {
    const db = await getDb();
    const g = db.seedGroup({ proof_hash: hashProof(proof) });
    db.seedFile(g.id);
    const fake = guardSays({ terminate: true, categories: ['S1'] });
    const res = await check(g.id, one, { 'x-room-proof': proof });
    expect(await res.json()).toEqual({ terminate: true });
    expect(db.tables.groups).toHaveLength(0);
    expect(db.files[g.id]).toHaveLength(0);
    // the guard gets the secret and a hashed room key, never the raw room id
    const [, init] = fake.mock.calls[0] as unknown as [string, RequestInit];
    expect((init.headers as Record<string, string>)['x-guard-secret']).toBe('shh');
    expect(String(init.body)).not.toContain(g.id);
  });

  it('keeps the room when the guard finds nothing severe', async () => {
    const db = await getDb();
    const g = db.seedGroup({ proof_hash: hashProof(proof) });
    guardSays({ terminate: false, categories: ['S12'] });
    const res = await check(g.id, one, { 'x-room-proof': proof });
    expect(await res.json()).toEqual({ terminate: false });
    expect(db.tables.groups).toHaveLength(1);
  });

  it('fails open when the guard is down', async () => {
    const db = await getDb();
    const g = db.seedGroup({ proof_hash: hashProof(proof) });
    guardSays({ error: 'boom' }, 502);
    const res = await check(g.id, one, { 'x-room-proof': proof });
    expect(await res.json()).toEqual({ terminate: false, unavailable: true });
    expect(db.tables.groups).toHaveLength(1);
  });

  it('does nothing when moderation is not configured', async () => {
    delete process.env.MODERATION_URL;
    const db = await getDb();
    const g = db.seedGroup({ proof_hash: hashProof(proof) });
    const fake = guardSays({ terminate: true });
    const res = await check(g.id, one, { 'x-room-proof': proof });
    expect(await res.json()).toEqual({ terminate: false, skipped: true });
    expect(fake).not.toHaveBeenCalled();
    expect(db.tables.groups).toHaveLength(1);
  });

  it('validates input', async () => {
    expect((await check('not-a-uuid', one)).status).toBe(400);
    const db = await getDb();
    const g = db.seedGroup({ proof_hash: hashProof(proof) });
    expect((await check(g.id, { messages: [] }, { 'x-room-proof': proof })).status).toBe(400);
    expect(await (await check(crypto.randomUUID(), one)).json()).toEqual({ terminate: false, ended: true });
  });
});
