import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/server/supabaseAdmin';
import { hashProof, isUuid, maybeSweep } from '@/lib/server/groups';

const MAX_GROUPS_PER_CREATOR = 10;
const CREATE_LIMIT_PER_HOUR = 20;

// Best-effort, in-memory only (never persisted): caps how fast one address can create rooms,
// since creator_id is chosen by the client and cannot be trusted on its own.
const createLog = new Map<string, number[]>();
function rateLimited(req: Request): boolean {
    const ip = (req.headers.get('x-forwarded-for') || 'unknown').split(',')[0].trim();
    const now = Date.now();
    const recent = (createLog.get(ip) || []).filter(t => now - t < 60 * 60 * 1000);
    if (recent.length >= CREATE_LIMIT_PER_HOUR) {
        createLog.set(ip, recent);
        return true;
    }
    recent.push(now);
    createLog.set(ip, recent);
    if (createLog.size > 5000) createLog.clear();
    return false;
}

// GET /api/groups - List active groups (filtered by creator_id)
export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const creatorId = searchParams.get('creator_id');

        if (!isUuid(creatorId)) {
            return NextResponse.json([]);
        }

        // `key` is only returned for legacy rooms that still have one stored; new rooms never do.
        const { data: groups, error } = await supabaseAdmin
            .from('groups')
            .select('id, name, tags, active_user_count, created_at, last_active_at, key')
            .eq('creator_id', creatorId)
            .order('created_at', { ascending: false })
            .limit(MAX_GROUPS_PER_CREATOR);

        if (error) throw error;

        return NextResponse.json(groups || []);
    } catch (err) {
        console.error('Error fetching groups:', err);
        return NextResponse.json({ error: 'Failed to fetch groups' }, { status: 500 });
    }
}

// POST /api/groups - Create a new group. The room key is NEVER sent here: only a proof of it.
export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { name, tags, proof, creator_id } = body;

        if (typeof name !== 'string' || name.trim().length === 0) {
            return NextResponse.json({ error: 'Group name is required' }, { status: 400 });
        }

        if (!isUuid(creator_id)) {
            return NextResponse.json({ error: 'Creator ID is required' }, { status: 400 });
        }

        if (typeof proof !== 'string' || proof.length < 16 || proof.length > 128) {
            return NextResponse.json({ error: 'Room proof is required' }, { status: 400 });
        }

        if (rateLimited(req)) {
            return NextResponse.json({ error: 'Too many rooms created. Try again later.' }, { status: 429 });
        }

        const { count, error: countError } = await supabaseAdmin
            .from('groups')
            .select('*', { count: 'exact', head: true })
            .eq('creator_id', creator_id);

        if (countError) throw countError;

        if (count !== null && count >= MAX_GROUPS_PER_CREATOR) {
            return NextResponse.json({ error: 'Maximum of 10 active groups per user reached.' }, { status: 403 });
        }

        const row = {
            name: name.trim().slice(0, 30),
            tags: Array.isArray(tags)
                ? tags.filter((t: unknown) => typeof t === 'string').map((t: string) => t.slice(0, 20)).slice(0, 5)
                : [],
            creator_id,
            active_user_count: 0,
        };

        let { data, error } = await supabaseAdmin
            .from('groups')
            .insert([{ ...row, proof_hash: hashProof(proof) }])
            .select('id, name, tags, active_user_count, created_at')
            .single();

        // Database not migrated yet (no proof_hash column): create the room without it.
        if (error && (error.code === 'PGRST204' || error.code === '42703')) {
            console.warn('groups.proof_hash is missing. Run migrations/security_hardening.sql.');
            ({ data, error } = await supabaseAdmin
                .from('groups')
                .insert([row])
                .select('id, name, tags, active_user_count, created_at')
                .single());
        }

        if (error) throw error;

        maybeSweep();
        return NextResponse.json(data, { status: 201 });
    } catch (err) {
        console.error('Error creating group:', err);
        return NextResponse.json({ error: 'Failed to create group' }, { status: 500 });
    }
}
