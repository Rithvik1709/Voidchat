import { beforeEach, describe, expect, it } from 'vitest';
import { DELETE as sweep } from '@/app/api/groups/cleanup/route';
import { POST as cleanupUploads } from '@/app/api/uploads/cleanup/route';
import { getDb } from '../helpers/api';

const MIN = 60_000;
const ago = (ms: number) => new Date(Date.now() - ms).toISOString();
const ahead = (ms: number) => new Date(Date.now() + ms).toISOString();
const run = async () => (await (await sweep()).json()) as { deleted: number; emptyGroups: number; inactiveGroups: number; expiredGroups: number };

beforeEach(async () => (await getDb()).reset());

describe('stale room sweep', () => {
  it('never deletes a brand-new empty room (the old bug)', async () => {
    const db = await getDb();
    db.seedGroup({ active_user_count: 0, last_active_at: ago(0) });
    db.seedGroup({ active_user_count: 0, last_active_at: ago(10 * MIN) });
    expect((await run()).deleted).toBe(0);
    expect(db.tables.groups).toHaveLength(2);
  });

  it('deletes empty rooms once they are past the grace period, along with their media', async () => {
    const db = await getDb();
    const old = db.seedGroup({ active_user_count: 0, last_active_at: ago(16 * MIN) });
    db.seedFile(old.id);
    const result = await run();
    expect(result.emptyGroups).toBe(1);
    expect(db.tables.groups).toHaveLength(0);
    expect(db.files[old.id]).toHaveLength(0);
  });

  it('deletes rooms with a stuck user count after 30 minutes without a heartbeat', async () => {
    const db = await getDb();
    db.seedGroup({ active_user_count: 3, last_active_at: ago(31 * MIN) });
    db.seedGroup({ active_user_count: 3, last_active_at: ago(5 * MIN) }); // someone is still there
    expect((await run()).inactiveGroups).toBe(1);
    expect(db.tables.groups).toHaveLength(1);
  });

  it('deletes rooms whose timer has run out, even with people inside, and keeps the rest', async () => {
    const db = await getDb();
    db.seedGroup({ active_user_count: 4, last_active_at: ago(0), expires_at: ago(1000) });
    db.seedGroup({ active_user_count: 4, last_active_at: ago(0), expires_at: ahead(MIN) });
    db.seedGroup({ active_user_count: 4, last_active_at: ago(0) });
    expect((await run()).expiredGroups).toBe(1);
    expect(db.tables.groups).toHaveLength(2);
  });

  it('is safe to run repeatedly', async () => {
    const db = await getDb();
    db.seedGroup({ active_user_count: 2, last_active_at: ago(0) });
    await run();
    await run();
    expect(db.tables.groups).toHaveLength(1);
  });
});

describe('upload cleanup', () => {
  const run2 = async () => (await (await cleanupUploads()).json()) as { cleaned: number };

  it('removes media left behind by rooms that no longer exist', async () => {
    const db = await getDb();
    const orphan = crypto.randomUUID();
    db.seedFile(orphan);
    db.seedFile(orphan);
    expect((await run2()).cleaned).toBe(2);
    expect(db.files[orphan]).toHaveLength(0);
  });

  it('keeps fresh files in live rooms and drops files older than 24 hours', async () => {
    const db = await getDb();
    const g = db.seedGroup();
    const fresh = db.seedFile(g.id, 60 * MIN);
    db.seedFile(g.id, 25 * 60 * MIN);
    expect((await run2()).cleaned).toBe(1);
    expect(db.files[g.id].map(f => f.name)).toEqual([fresh]);
  });

  it('ignores anything that is not a room folder', async () => {
    const db = await getDb();
    db.seedFile('not-a-uuid-folder', 99 * 60 * MIN);
    expect((await run2()).cleaned).toBe(0);
    expect(db.files['not-a-uuid-folder']).toHaveLength(1);
  });
});
