import { beforeEach, describe, expect, it } from 'vitest';
import { DELETE, POST } from '@/app/api/upload/route';
import { getDb } from '../helpers/api';
import { hashProof } from '@/lib/server/groups';

const proof = '1'.repeat(64);

// Smallest valid files for each type
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
const JPG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(20)]);
const GIF = Buffer.concat([Buffer.from('GIF89a'), Buffer.alloc(20)]);
const WEBP = Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBP'), Buffer.alloc(8)]);

function upload(opts: { groupId?: string; proof?: string; bytes?: Buffer; type?: string; name?: string }) {
  const form = new FormData();
  form.append('file', new File([new Uint8Array(opts.bytes ?? PNG)], opts.name ?? 'pic.png', { type: opts.type ?? 'image/png' }));
  if (opts.groupId) form.append('groupId', opts.groupId);
  if (opts.proof) form.append('proof', opts.proof);
  return POST(new Request('http://localhost/api/upload', { method: 'POST', body: form }));
}

beforeEach(async () => (await getDb()).reset());

describe('POST /api/upload', () => {
  it('stores a real image in a server-chosen path and returns its public url', async () => {
    const db = await getDb();
    const g = db.seedGroup({ proof_hash: hashProof(proof) });
    const res = await upload({ groupId: g.id, proof, name: '../../evil name.png' });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.url).toContain(`/chat-images/${g.id}/`);
    expect(body.filename).toMatch(new RegExp(`^${g.id}/\\d+-[0-9a-f-]{36}\\.png$`)); // nothing from the client's filename
    expect(db.files[g.id]).toHaveLength(1);
  });

  it.each([
    ['image/jpeg', JPG, 'jpg'],
    ['image/gif', GIF, 'gif'],
    ['image/webp', WEBP, 'webp'],
  ])('accepts %s', async (type, bytes, ext) => {
    const g = (await getDb()).seedGroup({ proof_hash: hashProof(proof) });
    const res = await upload({ groupId: g.id, proof, bytes, type, name: `x.${ext}` });
    expect(res.status).toBe(200);
    expect((await res.json()).filename.endsWith(`.${ext}`)).toBe(true);
  });

  it('blocks SVG and other non-image types', async () => {
    const g = (await getDb()).seedGroup({ proof_hash: hashProof(proof) });
    const svg = await upload({ groupId: g.id, proof, bytes: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'), type: 'image/svg+xml', name: 'a.svg' });
    expect(svg.status).toBe(400);
    expect((await upload({ groupId: g.id, proof, type: 'text/html', name: 'a.html' })).status).toBe(400);
  });

  it('rejects files whose bytes do not match the claimed type', async () => {
    const g = (await getDb()).seedGroup({ proof_hash: hashProof(proof) });
    const res = await upload({ groupId: g.id, proof, bytes: Buffer.from('<script>alert(1)</script>'), type: 'image/png' });
    expect(res.status).toBe(400);
    expect((await getDb()).files[g.id] ?? []).toHaveLength(0);
  });

  it('only accepts uploads to an existing room, from a member', async () => {
    const db = await getDb();
    const g = db.seedGroup({ proof_hash: hashProof(proof) });
    expect((await upload({ groupId: crypto.randomUUID(), proof })).status).toBe(404);
    expect((await upload({ groupId: 'not-a-uuid', proof })).status).toBe(400);
    expect((await upload({ proof })).status).toBe(400);
    expect((await upload({ groupId: g.id })).status).toBe(403);
    expect((await upload({ groupId: g.id, proof: '2'.repeat(64) })).status).toBe(403);
    expect(db.files[g.id] ?? []).toHaveLength(0);
  });

  it('refuses uploads to an expired room', async () => {
    const g = (await getDb()).seedGroup({ proof_hash: hashProof(proof), expires_at: new Date(Date.now() - 1000).toISOString() });
    expect((await upload({ groupId: g.id, proof })).status).toBe(404);
  });

  it('caps the number of images per room', async () => {
    const db = await getDb();
    const g = db.seedGroup({ proof_hash: hashProof(proof) });
    for (let i = 0; i < 50; i++) db.seedFile(g.id);
    expect((await upload({ groupId: g.id, proof })).status).toBe(429);
  });
});

describe('DELETE /api/upload (an image whose message burned)', () => {
  const removeFile = (body: unknown, headers: Record<string, string> = {}) =>
    DELETE(new Request('http://localhost/api/upload', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(body),
    }));

  const fileName = () => `${Date.now()}-${crypto.randomUUID()}.png`;

  it('lets a member delete a file in their room', async () => {
    const db = await getDb();
    const g = db.seedGroup({ proof_hash: hashProof(proof) });
    const name = db.seedFile(g.id, 0, fileName());
    const keep = db.seedFile(g.id, 0, fileName());
    const res = await removeFile({ groupId: g.id, path: `${g.id}/${name}`, proof });
    expect(res.status).toBe(200);
    expect(db.files[g.id].map(f => f.name)).toEqual([keep]);
  });

  it('accepts the proof in a header too', async () => {
    const db = await getDb();
    const g = db.seedGroup({ proof_hash: hashProof(proof) });
    const name = db.seedFile(g.id, 0, fileName());
    expect((await removeFile({ groupId: g.id, path: `${g.id}/${name}` }, { 'x-room-proof': proof })).status).toBe(200);
    expect(db.files[g.id]).toHaveLength(0);
  });

  it('refuses callers without the proof, and leaves the file', async () => {
    const db = await getDb();
    const g = db.seedGroup({ proof_hash: hashProof(proof) });
    const name = db.seedFile(g.id, 0, fileName());
    expect((await removeFile({ groupId: g.id, path: `${g.id}/${name}` })).status).toBe(403);
    expect((await removeFile({ groupId: g.id, path: `${g.id}/${name}`, proof: '9'.repeat(64) })).status).toBe(403);
    expect(db.files[g.id]).toHaveLength(1);
  });

  it('only deletes files shaped like ones this server made, inside the named room', async () => {
    const db = await getDb();
    const g = db.seedGroup({ proof_hash: hashProof(proof) });
    const other = db.seedGroup({ proof_hash: hashProof(proof) });
    const theirs = db.seedFile(other.id, 0, fileName());
    for (const path of [`${other.id}/${theirs}`, `${g.id}/../${other.id}/${theirs}`, `${g.id}/anything.png`, `${g.id}/`, '../x', `${g.id}/${fileName().replace('.png', '.svg')}`]) {
      const res = await removeFile({ groupId: g.id, path, proof });
      expect(res.status, path).toBe(400);
    }
    expect(db.files[other.id]).toHaveLength(1);
  });

  it('rejects malformed requests and treats a vanished room as already done', async () => {
    expect((await removeFile({ groupId: 'nope', path: 'x', proof })).status).toBe(400);
    expect((await removeFile({ groupId: crypto.randomUUID() })).status).toBe(400);
    const gone = crypto.randomUUID();
    const res = await removeFile({ groupId: gone, path: `${gone}/${fileName()}`, proof });
    expect(res.status).toBe(200);
    expect((await res.json()).alreadyGone).toBe(true);
  });
});
