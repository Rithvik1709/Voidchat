import { beforeEach, describe, expect, it } from 'vitest';
import { POST } from '@/app/api/groups/[groupId]/log/route';
import { freshIp, getDb, jsonRequest, params } from '../helpers/api';
import { hashProof } from '@/lib/server/groups';

const proof = 'f'.repeat(64);
const log = (id: string, body: unknown, headers: Record<string, string> = {}) =>
  POST(jsonRequest(`/api/groups/${id}/log`, 'POST', body, { ...freshIp(), ...headers }), params(id));
const msg = { id: 'm1', sender: 'ghost', timestamp: '2026-10-13T10:00:00.000Z', content: { text: 'hello', from: 'ghost' } };

beforeEach(async () => {
  (await getDb()).reset();
});

describe('POST /api/groups/:id/log', () => {
  it('stores the message under the room id', async () => {
    const db = await getDb();
    const g = db.seedGroup({ proof_hash: hashProof(proof) });
    const res = await log(g.id, msg, { 'x-room-proof': proof });
    expect(res.status).toBe(200);
    expect(db.tables.chat_logs).toHaveLength(1);
    expect(db.tables.chat_logs[0]).toMatchObject({
      id: 'm1', group_id: g.id, sender: 'ghost', sent_at: msg.timestamp, content: { text: 'hello', from: 'ghost' },
    });
  });

  it('does not duplicate a retried message', async () => {
    const db = await getDb();
    const g = db.seedGroup({ proof_hash: hashProof(proof) });
    await log(g.id, msg, { 'x-room-proof': proof });
    await log(g.id, msg, { 'x-room-proof': proof });
    expect(db.tables.chat_logs).toHaveLength(1);
  });

  it('rejects non-members', async () => {
    const db = await getDb();
    const g = db.seedGroup({ proof_hash: hashProof(proof) });
    const res = await log(g.id, msg, { 'x-room-proof': 'e'.repeat(64) });
    expect(res.status).toBe(403);
    expect(db.tables.chat_logs ?? []).toHaveLength(0);
  });

  it('rejects malformed messages and unknown rooms', async () => {
    const db = await getDb();
    const g = db.seedGroup({ proof_hash: hashProof(proof) });
    expect((await log(g.id, { ...msg, content: { text: 1 } }, { 'x-room-proof': proof })).status).toBe(400);
    expect((await log(g.id, { ...msg, timestamp: 'nope' }, { 'x-room-proof': proof })).status).toBe(400);
    expect((await log(crypto.randomUUID(), msg, { 'x-room-proof': proof })).status).toBe(404);
    expect(db.tables.chat_logs ?? []).toHaveLength(0);
  });
});
