import { beforeEach, describe, expect, it } from 'vitest';
import { GET as listInvites, POST as createInvite } from '@/app/api/groups/[groupId]/invites/route';
import { DELETE as revokeInvite } from '@/app/api/groups/[groupId]/invites/[inviteId]/route';
import { POST as deliver } from '@/app/api/groups/[groupId]/invites/[inviteId]/deliver/route';
import { POST as claim } from '@/app/api/invites/claim/route';
import { GET as pollDelivery } from '@/app/api/invites/[inviteId]/delivery/route';
import { DELETE as endRoom } from '@/app/api/groups/[groupId]/end/route';
import { freshIp, getDb, jsonRequest, params } from '../helpers/api';
import { getRoomProof } from '@/lib/roomAuth';
import { hashProof } from '@/lib/server/groups';
import type { PublicJwk } from '@/lib/signing';
import {
  createJoinerKeys, inviteMac, inviteTokenHash, newInviteToken, unwrapRoomKey, verifyInviteMac, wrapRoomKey,
} from '@/lib/invites';

const ROOM_KEY = JSON.stringify({ alg: 'A256GCM', k: 'room-secret', kty: 'oct' });
const MIN = 60_000;

let proof: string;
beforeEach(async () => {
  (await getDb()).reset();
  proof = await getRoomProof(ROOM_KEY);
});

const seedRoom = async (over: Record<string, unknown> = {}) => (await getDb()).seedGroup({ proof_hash: hashProof(proof), ...over });
const member = { 'x-room-proof': '' };
const asMember = () => ({ ...member, 'x-room-proof': proof });

// ---- helpers that act like the browsers ----
async function makeInvite(groupId: string) {
  const token = newInviteToken();
  const res = await createInvite(
    jsonRequest(`/api/groups/${groupId}/invites`, 'POST', { tokenHash: await inviteTokenHash(token) }, asMember()),
    params(groupId)
  );
  return { token, res, id: res.status === 201 ? (await res.clone().json()).id as string : '' };
}

async function claimAs(groupId: string, token: string, ip = freshIp()) {
  const joiner = await createJoinerKeys();
  const mac = await inviteMac(token, joiner.publicJwk);
  const res = await claim(jsonRequest('/api/invites/claim', 'POST', {
    groupId, tokenHash: await inviteTokenHash(token), pub: joiner.publicJwk, mac,
  }, ip));
  return { res, joiner, mac };
}

type Listed = { id: string; status: string; claim_pub: PublicJwk; claim_mac: string; claimed_at: string | null };
const list = async (groupId: string) =>
  (await (await listInvites(jsonRequest(`/api/groups/${groupId}/invites`, 'GET', undefined, asMember()), params(groupId))).json()).invites as Listed[];

const poll = (inviteId: string, mac: string) =>
  pollDelivery(jsonRequest(`/api/invites/${inviteId}/delivery?mac=${mac}`, 'GET', undefined, freshIp()), { params: Promise.resolve({ inviteId }) });

const sendDelivery = (groupId: string, inviteId: string, delivery: unknown, headers = asMember()) =>
  deliver(jsonRequest(`/api/groups/${groupId}/invites/${inviteId}/deliver`, 'POST', { delivery }, headers), { params: Promise.resolve({ groupId, inviteId }) });

describe('the whole one-time link flow', () => {
  it('delivers the room key to exactly the person who claimed, and the server never sees it', async () => {
    const room = await seedRoom();
    const { token, id } = await makeInvite(room.id);

    // The joiner claims
    const { res, joiner, mac } = await claimAs(room.id, token);
    expect(res.status).toBe(200);
    expect((await res.json()).inviteId).toBe(id);

    // The inviter's browser sees the waiting claim, checks it really came from the link holder, then delivers
    const [waiting] = await list(room.id);
    expect(waiting.status).toBe('claimed');
    expect(await verifyInviteMac(token, waiting.claim_pub, waiting.claim_mac)).toBe(true);
    const delivery = await wrapRoomKey(ROOM_KEY, waiting.claim_pub, id);
    expect((await sendDelivery(room.id, id, delivery)).status).toBe(200);

    // Joiner polls and recovers the key
    const polled = await (await poll(id, mac)).json();
    expect(polled.status).toBe('used');
    expect(await unwrapRoomKey(polled.delivery, joiner.privateKey, id)).toBe(ROOM_KEY);

    // Nothing the server holds contains the room key
    const stored = JSON.stringify((await getDb()).tables.group_invites);
    expect(stored).not.toContain('room-secret');
    expect(stored).not.toContain(token);
  });

  it('burns the link: a second person with a copy cannot claim it', async () => {
    const room = await seedRoom();
    const { token } = await makeInvite(room.id);
    expect((await claimAs(room.id, token)).res.status).toBe(200);
    const second = await claimAs(room.id, token);
    expect(second.res.status).toBe(409);
    expect((await second.res.json()).error).toMatch(/already been used/);
  });

  it('stays burned after delivery too', async () => {
    const room = await seedRoom();
    const { token, id } = await makeInvite(room.id);
    const { joiner } = await claimAs(room.id, token);
    await sendDelivery(room.id, id, await wrapRoomKey(ROOM_KEY, joiner.publicJwk, id));
    expect((await claimAs(room.id, token)).res.status).toBe(409);
  });

  it('only one of two simultaneous claimers wins', async () => {
    const room = await seedRoom();
    const { token } = await makeInvite(room.id);
    const results = await Promise.all([claimAs(room.id, token), claimAs(room.id, token), claimAs(room.id, token)]);
    const statuses = results.map(r => r.res.status).sort();
    expect(statuses).toEqual([200, 409, 409]);
  });

  it('a copy-holder cannot read the delivery meant for the real claimer', async () => {
    const room = await seedRoom();
    const { token, id } = await makeInvite(room.id);
    const real = await claimAs(room.id, token);
    const attacker = await claimAs(room.id, token); // 409, but they still hold the token
    expect(attacker.res.status).toBe(409);
    await sendDelivery(room.id, id, await wrapRoomKey(ROOM_KEY, real.joiner.publicJwk, id));

    // the attacker has the token, but not the real claimer's mac, so the poll is refused
    expect((await poll(id, attacker.mac)).status).toBe(404);
    // and even the ciphertext would be useless to them
    const stolen = (await (await poll(id, real.mac)).json()).delivery;
    await expect(unwrapRoomKey(stolen, attacker.joiner.privateKey, id)).rejects.toThrow();
  });

  it("the inviter refuses a claim whose key a malicious server swapped in", async () => {
    const room = await seedRoom();
    const { token } = await makeInvite(room.id);
    await claimAs(room.id, token);
    const serverOwnKey = (await createJoinerKeys()).publicJwk;
    const [waiting] = await list(room.id);
    // the server substitutes its own public key but cannot produce a mac for it
    expect(await verifyInviteMac(token, serverOwnKey, waiting.claim_mac)).toBe(false);
  });
});

describe('claiming rules', () => {
  it('rejects unknown tokens and malformed requests', async () => {
    const room = await seedRoom();
    expect((await claimAs(room.id, newInviteToken())).res.status).toBe(404);
    const bad = await claim(jsonRequest('/api/invites/claim', 'POST', { groupId: room.id }, freshIp()));
    expect(bad.status).toBe(400);
  });

  it('rejects a claim for a room that is gone or expired', async () => {
    const room = await seedRoom();
    const { token } = await makeInvite(room.id);
    (await getDb()).tables.groups[0].expires_at = new Date(Date.now() - 1000).toISOString();
    const r = await claimAs(room.id, token);
    expect(r.res.status).toBe(404);
    expect((await r.res.json()).ended).toBe(true);
  });

  it('expires unused invites after 24 hours', async () => {
    const room = await seedRoom();
    const { token } = await makeInvite(room.id);
    (await getDb()).tables.group_invites[0].created_at = new Date(Date.now() - 25 * 60 * MIN).toISOString();
    expect((await claimAs(room.id, token)).res.status).toBe(410);
    expect(await list(room.id)).toHaveLength(0); // expired invites are not listed
  });

  it('releases a claim nobody answered, so the link is not lost', async () => {
    const room = await seedRoom();
    const { token, id } = await makeInvite(room.id);
    const first = await claimAs(room.id, token);
    expect(first.res.status).toBe(200);
    expect((await claimAs(room.id, token)).res.status).toBe(409); // still held

    (await getDb()).tables.group_invites[0].claimed_at = new Date(Date.now() - 3 * MIN).toISOString();

    expect((await list(room.id))[0].status).toBe('unused'); // inviter sees it as open again
    expect(await (await poll(id, first.mac)).json()).toEqual({ status: 'released' });

    const retry = await claimAs(room.id, token);
    expect(retry.res.status).toBe(200); // someone can now take it
    expect((await poll(id, first.mac)).status).toBe(404); // the first claimer's old proof no longer matches
  });

  it('rate-limits repeated claim attempts from one address', async () => {
    const room = await seedRoom();
    const ip = freshIp();
    const statuses: number[] = [];
    for (let i = 0; i < 25; i++) statuses.push((await claimAs(room.id, newInviteToken(), ip)).res.status);
    expect(statuses.slice(0, 20).every(s => s === 404)).toBe(true);
    expect(statuses.slice(20).every(s => s === 429)).toBe(true);
  });
});

describe('creating, listing, delivering and revoking (members only)', () => {
  it('needs the room proof to create or list', async () => {
    const room = await seedRoom();
    const noProof = await createInvite(jsonRequest(`/api/groups/${room.id}/invites`, 'POST', { tokenHash: await inviteTokenHash(newInviteToken()) }), params(room.id));
    expect(noProof.status).toBe(403);
    const wrong = await listInvites(jsonRequest(`/api/groups/${room.id}/invites`, 'GET', undefined, { 'x-room-proof': 'f'.repeat(64) }), params(room.id));
    expect(wrong.status).toBe(403);
  });

  it('validates the token hash and caps open invites per room', async () => {
    const room = await seedRoom();
    const bad = await createInvite(jsonRequest(`/api/groups/${room.id}/invites`, 'POST', { tokenHash: 'nope' }, asMember()), params(room.id));
    expect(bad.status).toBe(400);
    for (let i = 0; i < 25; i++) expect((await makeInvite(room.id)).res.status).toBe(201);
    expect((await makeInvite(room.id)).res.status).toBe(429);
  });

  it('only exposes a claimant\'s key while the claim is live', async () => {
    const room = await seedRoom();
    const { token } = await makeInvite(room.id);
    expect((await list(room.id))[0]).toMatchObject({ status: 'unused', claim_pub: null, claim_mac: null });
    await claimAs(room.id, token);
    const [claimed] = await list(room.id);
    expect(claimed.status).toBe('claimed');
    expect(claimed.claim_pub.kty).toBe('EC');
    expect(claimed).not.toHaveProperty('token_hash');
  });

  it('only accepts a delivery for a live claim, from a member, and only once', async () => {
    const room = await seedRoom();
    const { token, id } = await makeInvite(room.id);
    const { joiner } = await claimAs(room.id, token);
    const delivery = await wrapRoomKey(ROOM_KEY, joiner.publicJwk, id);

    expect((await sendDelivery(room.id, id, delivery, { 'x-room-proof': '' })).status).toBe(403);
    expect((await sendDelivery(room.id, id, { epk: 1 })).status).toBe(400);
    expect((await sendDelivery(room.id, id, delivery)).status).toBe(200);
    expect((await sendDelivery(room.id, id, delivery)).status).toBe(409); // already used
  });

  it('refuses to deliver to an invite nobody claimed', async () => {
    const room = await seedRoom();
    const { id } = await makeInvite(room.id);
    const joiner = await createJoinerKeys();
    expect((await sendDelivery(room.id, id, await wrapRoomKey(ROOM_KEY, joiner.publicJwk, id))).status).toBe(409);
  });

  it('lets a member revoke an open invite, but not a used one', async () => {
    const room = await seedRoom();
    const open = await makeInvite(room.id);
    const used = await makeInvite(room.id);
    const { joiner } = await claimAs(room.id, used.token);
    await sendDelivery(room.id, used.id, await wrapRoomKey(ROOM_KEY, joiner.publicJwk, used.id));

    const del = (inviteId: string) => revokeInvite(
      jsonRequest(`/api/groups/${room.id}/invites/${inviteId}`, 'DELETE', undefined, asMember()),
      { params: Promise.resolve({ groupId: room.id, inviteId }) }
    );
    expect((await del(open.id)).status).toBe(200);
    expect((await claimAs(room.id, open.token)).res.status).toBe(404); // revoked links are dead
    expect((await del(used.id)).status).toBe(404);
  });

  it('deletes every invite when the room ends', async () => {
    const room = await seedRoom();
    await makeInvite(room.id);
    await makeInvite(room.id);
    const res = await endRoom(jsonRequest(`/api/groups/${room.id}/end`, 'DELETE', undefined, asMember()), params(room.id));
    expect(res.status).toBe(200);
    expect((await getDb()).tables.group_invites).toHaveLength(0);
  });
});

describe('before the migration is run', () => {
  it('answers with a clear 503 instead of crashing', async () => {
    const db = await getDb();
    db.missingTables = new Set(['group_invites']);
    const room = await seedRoom();
    expect((await makeInvite(room.id)).res.status).toBe(503);
    const r = await claimAs(room.id, newInviteToken());
    expect(r.res.status).toBe(503);
    expect((await r.res.json()).error).toMatch(/invites\.sql/);
  });
});
