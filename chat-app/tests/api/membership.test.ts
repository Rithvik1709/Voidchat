import { beforeEach, describe, expect, it } from 'vitest';
import { POST } from '@/app/api/groups/[groupId]/membership/route';
import { POST as heartbeat } from '@/app/api/groups/heartbeat/route';
import { getDb, jsonRequest, params } from '../helpers/api';
import { hashProof } from '@/lib/server/groups';

const proof = 'b'.repeat(64);
const act = (id: string, body: Record<string, unknown>) =>
  POST(jsonRequest(`/api/groups/${id}/membership`, 'POST', body), params(id));

beforeEach(async () => (await getDb()).reset());

describe('membership', () => {
  it('requires the room proof once a room has one', async () => {
    const g = (await getDb()).seedGroup({ proof_hash: hashProof(proof) });
    expect((await act(g.id, { action: 'join' })).status).toBe(403);
    expect((await act(g.id, { action: 'join', proof: 'c'.repeat(64) })).status).toBe(403);
    expect((await act(g.id, { action: 'join', proof })).status).toBe(200);
    expect(g.active_user_count).toBe(1);
  });

  it('lets legacy rooms (no proof hash) through', async () => {
    const g = (await getDb()).seedGroup();
    expect((await act(g.id, { action: 'join' })).status).toBe(200);
  });

  it('rejects junk requests', async () => {
    expect((await act('nope', { action: 'join' })).status).toBe(400);
    const g = (await getDb()).seedGroup();
    expect((await act(g.id, { action: 'explode' })).status).toBe(400);
  });

  it('deletes the room and its media when the last person leaves', async () => {
    const db = await getDb();
    const g = db.seedGroup({ active_user_count: 1 });
    db.seedFile(g.id);
    expect((await act(g.id, { action: 'leave' })).status).toBe(200);
    expect(db.tables.groups).toHaveLength(0);
    expect(db.files[g.id] ?? []).toHaveLength(0);
  });

  it('keeps the room while others remain', async () => {
    const db = await getDb();
    const g = db.seedGroup({ active_user_count: 2 });
    await act(g.id, { action: 'leave' });
    expect(db.tables.groups).toHaveLength(1);
    expect(g.active_user_count).toBe(1);
  });
});

describe('member limit', () => {
  it('lets people in until the room is full, then answers 409', async () => {
    const g = (await getDb()).seedGroup({ max_members: 2 });
    expect((await act(g.id, { action: 'join' })).status).toBe(200);
    expect((await act(g.id, { action: 'join' })).status).toBe(200);
    const full = await act(g.id, { action: 'join' });
    expect(full.status).toBe(409);
    expect((await full.json()).full).toBe(true);
    expect(g.active_user_count).toBe(2);
  });

  it('frees a seat when someone leaves', async () => {
    const g = (await getDb()).seedGroup({ max_members: 2, active_user_count: 2 });
    expect((await act(g.id, { action: 'join' })).status).toBe(409);
    await act(g.id, { action: 'leave' });
    expect((await act(g.id, { action: 'join' })).status).toBe(200);
  });

  it('still enforces the limit when the atomic join function is not installed', async () => {
    const db = await getDb();
    db.hasTryJoin = false;
    const g = db.seedGroup({ max_members: 1, active_user_count: 1 });
    expect((await act(g.id, { action: 'join' })).status).toBe(409);
  });

  it('works for any limit the host chose, including 1 and large numbers', async () => {
    const db = await getDb();
    const solo = db.seedGroup({ max_members: 1 });
    expect((await act(solo.id, { action: 'join' })).status).toBe(200);
    expect((await act(solo.id, { action: 'join' })).status).toBe(409);

    const big = db.seedGroup({ max_members: 500, active_user_count: 499 });
    expect((await act(big.id, { action: 'join' })).status).toBe(200);
    expect((await act(big.id, { action: 'join' })).status).toBe(409);
  });

  it('has no limit when max_members is not set', async () => {
    const g = (await getDb()).seedGroup({ active_user_count: 500 });
    expect((await act(g.id, { action: 'join' })).status).toBe(200);
  });
});

describe('expired rooms', () => {
  it('cannot be joined, and are deleted with their media', async () => {
    const db = await getDb();
    const g = db.seedGroup({ expires_at: new Date(Date.now() - 1000).toISOString() });
    db.seedFile(g.id);
    const res = await act(g.id, { action: 'join' });
    expect((await res.json()).ended).toBe(true);
    expect(db.tables.groups).toHaveLength(0);
    expect(db.files[g.id] ?? []).toHaveLength(0);
  });

  it('can still be joined before the timer runs out', async () => {
    const g = (await getDb()).seedGroup({ expires_at: new Date(Date.now() + 60_000).toISOString() });
    const res = await act(g.id, { action: 'join' });
    expect((await res.json()).ended).toBeUndefined();
  });
});

describe('heartbeat', () => {
  it('requires the proof and refreshes last_active_at', async () => {
    const old = new Date(Date.now() - 3_600_000).toISOString();
    const g = (await getDb()).seedGroup({ proof_hash: hashProof(proof), last_active_at: old });
    const bad = await heartbeat(jsonRequest('/api/groups/heartbeat', 'POST', { groupId: g.id }));
    expect(bad.status).toBe(403);
    expect(g.last_active_at).toBe(old);
    const ok = await heartbeat(jsonRequest('/api/groups/heartbeat', 'POST', { groupId: g.id, proof }));
    expect(ok.status).toBe(200);
    expect(Date.parse(g.last_active_at)).toBeGreaterThan(Date.parse(old));
  });

  it('rejects invalid ids and does not keep expired rooms alive', async () => {
    expect((await heartbeat(jsonRequest('/api/groups/heartbeat', 'POST', { groupId: 'x' }))).status).toBe(400);
    const db = await getDb();
    const g = db.seedGroup({ expires_at: new Date(Date.now() - 1000).toISOString() });
    const res = await heartbeat(jsonRequest('/api/groups/heartbeat', 'POST', { groupId: g.id }));
    expect((await res.json()).ended).toBe(true);
    expect(db.tables.groups).toHaveLength(0);
  });
});
