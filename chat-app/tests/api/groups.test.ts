import { beforeEach, describe, expect, it } from 'vitest';
import { GET, POST } from '@/app/api/groups/route';
import { freshIp, getDb, jsonRequest } from '../helpers/api';
import { hashProof } from '@/lib/server/groups';

const proof = 'a'.repeat(64);
const creator = '11111111-1111-1111-1111-111111111111';
const create = (body: Record<string, unknown>, ip = freshIp()) =>
  POST(jsonRequest('/api/groups', 'POST', { name: 'room', proof, creator_id: creator, ...body }, ip));

beforeEach(async () => (await getDb()).reset());

describe('POST /api/groups validation', () => {
  it('requires a name, a creator id and a proof', async () => {
    expect((await create({ name: '   ' })).status).toBe(400);
    expect((await create({ name: undefined })).status).toBe(400);
    expect((await create({ creator_id: 'not-a-uuid' })).status).toBe(400);
    expect((await create({ proof: undefined })).status).toBe(400);
    expect((await create({ proof: 'short' })).status).toBe(400);
  });

  it('creates a room, stores only a hash of the proof, and never stores a key', async () => {
    const res = await create({ name: '  My Room  ', key: 'leak-me-if-you-can' });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.name).toBe('My Room');
    expect(body).not.toHaveProperty('proof_hash');
    expect(body).not.toHaveProperty('key');

    const row = (await getDb()).tables.groups[0];
    expect(row.proof_hash).toBe(hashProof(proof));
    expect(row.proof_hash).not.toBe(proof);
    expect(row).not.toHaveProperty('key');
  });

  it('trims long names and tags', async () => {
    await create({ name: 'x'.repeat(100), tags: Array.from({ length: 9 }, (_, i) => `t${i}${'y'.repeat(50)}`) });
    const row = (await getDb()).tables.groups[0];
    expect(row.name).toHaveLength(30);
    expect(row.tags).toHaveLength(5);
    expect(row.tags[0].length).toBeLessThanOrEqual(20);
  });

  it('limits each creator to 10 rooms', async () => {
    for (let i = 0; i < 10; i++) expect((await create({})).status).toBe(201);
    expect((await create({})).status).toBe(403);
  });

  it('rate-limits one address creating rooms', async () => {
    const ip = freshIp();
    let limited = false;
    for (let i = 0; i < 25 && !limited; i++) {
      const res = await create({ creator_id: crypto.randomUUID() }, ip);
      limited = res.status === 429;
    }
    expect(limited).toBe(true);
  });
});

describe('room options on create', () => {
  it('accepts a timer, a member limit and a password flag', async () => {
    const before = Date.now();
    const res = await create({ expires_in_minutes: 60, max_members: 5, password_protected: true });
    expect(res.status).toBe(201);
    const row = (await getDb()).tables.groups[0];
    expect(row.max_members).toBe(5);
    expect(row.has_password).toBe(true);
    const expires = Date.parse(row.expires_at);
    expect(expires).toBeGreaterThanOrEqual(before + 60 * 60_000 - 1000);
    expect(expires).toBeLessThanOrEqual(Date.now() + 60 * 60_000 + 1000);
  });

  it('rejects values outside the allowed choices', async () => {
    expect((await create({ expires_in_minutes: 7 })).status).toBe(400);
    expect((await create({ expires_in_minutes: '60' })).status).toBe(400);
    expect((await create({ max_members: 0 })).status).toBe(400);
    expect((await create({ max_members: -4 })).status).toBe(400);
    expect((await create({ max_members: 2.5 })).status).toBe(400);
    expect((await create({ max_members: '5' })).status).toBe(400);
    expect((await create({ max_members: 2_147_483_648 })).status).toBe(400);
    expect((await getDb()).tables.groups).toHaveLength(0);
  });

  it('accepts any member limit the host picks, with no preset list or small cap', async () => {
    for (const n of [1, 3, 7, 100, 101, 250, 10_000]) {
      const res = await create({ max_members: n, creator_id: crypto.randomUUID() });
      expect(res.status, `limit ${n}`).toBe(201);
    }
    const stored = (await getDb()).tables.groups.map(g => g.max_members);
    expect(stored).toEqual([1, 3, 7, 100, 101, 250, 10_000]);
  });

  it('treats null options as "not set"', async () => {
    expect((await create({ expires_in_minutes: null, max_members: null })).status).toBe(201);
    const row = (await getDb()).tables.groups[0];
    expect(row).not.toHaveProperty('expires_at');
    expect(row).not.toHaveProperty('max_members');
  });

  it('refuses (instead of silently dropping) options when the database has not been migrated', async () => {
    const db = await getDb();
    db.missingColumns = new Set(['expires_at']);
    const res = await create({ expires_in_minutes: 15 });
    expect(res.status).toBe(503);
    expect((await res.json()).error).toMatch(/room_options\.sql/);
    expect(db.tables.groups).toHaveLength(0);
  });

  it('still creates plain rooms when the proof_hash column is missing', async () => {
    const db = await getDb();
    db.missingColumns = new Set(['proof_hash']);
    expect((await create({})).status).toBe(201);
    expect(db.tables.groups).toHaveLength(1);
  });
});

describe('GET /api/groups', () => {
  it('returns only the caller\'s rooms and never exposes proof_hash', async () => {
    const db = await getDb();
    db.seedGroup({ creator_id: creator, proof_hash: 'secret-hash', name: 'mine' });
    db.seedGroup({ name: 'someone elses' });
    const res = await GET(new Request(`http://localhost/api/groups?creator_id=${creator}`));
    const list = await res.json();
    expect(list).toHaveLength(1);
    expect(list[0].name).toBe('mine');
    expect(list[0]).not.toHaveProperty('proof_hash');
    expect(list[0]).not.toHaveProperty('creator_id');
  });

  it('returns an empty list for a missing or invalid creator id', async () => {
    expect(await (await GET(new Request('http://localhost/api/groups'))).json()).toEqual([]);
    expect(await (await GET(new Request('http://localhost/api/groups?creator_id=zzz'))).json()).toEqual([]);
  });
});
