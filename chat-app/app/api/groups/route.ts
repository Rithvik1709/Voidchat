import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/server/supabaseAdmin';
import { hashProof, isUuid, maybeSweep } from '@/lib/server/groups';
import { ALLOWED_EXPIRY_MINUTES, MAX_BURN_SECONDS, MAX_MEMBERS, MIN_BURN_SECONDS, MIN_MEMBERS } from '@/lib/roomOptions';

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

const PUBLIC_COLUMNS = [
    'id', 'name', 'tags', 'active_user_count', 'created_at', 'last_active_at',
    'key', 'expires_at', 'max_members', 'has_password', 'invite_only', 'burn_seconds',
] as const;

/** Never expose proof_hash or anything else outside the public column list. */
function shape(row: Record<string, unknown>) {
    return Object.fromEntries(PUBLIC_COLUMNS.filter(c => c in row).map(c => [c, row[c]]));
}

// GET /api/groups - List active groups (filtered by creator_id)
export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const creatorId = searchParams.get('creator_id');

        if (!isUuid(creatorId)) {
            return NextResponse.json([]);
        }

        // select('*') so the list keeps working before/after the room-options migration;
        // `key` is only present for legacy rooms that still have one stored.
        const { data: groups, error } = await supabaseAdmin
            .from('groups')
            .select('*')
            .eq('creator_id', creatorId)
            .order('created_at', { ascending: false })
            .limit(MAX_GROUPS_PER_CREATOR);

        if (error) throw error;

        return NextResponse.json((groups || []).map(g => shape(g as Record<string, unknown>)));
    } catch (err) {
        console.error('Error fetching groups:', err);
        return NextResponse.json({ error: 'Failed to fetch groups' }, { status: 500 });
    }
}

const isMissingColumn = (code?: string) => code === 'PGRST204' || code === '42703';

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

        // ---- Room options (all optional) ----
        const options: Record<string, unknown> = {};

        if (body.expires_in_minutes !== undefined && body.expires_in_minutes !== null) {
            if (!ALLOWED_EXPIRY_MINUTES.includes(body.expires_in_minutes)) {
                return NextResponse.json({ error: 'Invalid auto-close time.' }, { status: 400 });
            }
            options.expires_at = new Date(Date.now() + body.expires_in_minutes * 60_000).toISOString();
        }

        if (body.max_members !== undefined && body.max_members !== null) {
            const n = body.max_members;
            if (!Number.isInteger(n) || n < MIN_MEMBERS || n > MAX_MEMBERS) {
                return NextResponse.json({ error: `Member limit must be a whole number of at least ${MIN_MEMBERS}.` }, { status: 400 });
            }
            options.max_members = n;
        }

        if (body.password_protected === true) {
            options.has_password = true;
        }

        if (body.invite_only === true) {
            options.invite_only = true;
        }

        if (body.burn_seconds !== undefined && body.burn_seconds !== null) {
            const n = body.burn_seconds;
            if (!Number.isInteger(n) || n < MIN_BURN_SECONDS || n > MAX_BURN_SECONDS) {
                return NextResponse.json({ error: `Burn time must be a whole number of at least ${MIN_BURN_SECONDS} seconds.` }, { status: 400 });
            }
            options.burn_seconds = n;
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

        const wantsOptions = Object.keys(options).length > 0;
        let withProof: Record<string, unknown> = { ...row, ...options, proof_hash: hashProof(proof) };

        let { data, error } = await supabaseAdmin.from('groups').insert([withProof]).select('*').single();

        // proof_hash column missing (security migration not run yet): create without it
        if (error && isMissingColumn(error.code) && /proof_hash/.test(error.message || '')) {
            console.warn('groups.proof_hash is missing. Run migrations/security_hardening.sql.');
            withProof = { ...row, ...options };
            ({ data, error } = await supabaseAdmin.from('groups').insert([withProof]).select('*').single());
        }

        // Option columns missing: never silently drop a timer/limit/password the user asked for
        if (error && isMissingColumn(error.code) && wantsOptions) {
            console.warn('Room option columns are missing. Run migrations/room_options.sql.');
            return NextResponse.json(
                { error: 'Room options are not enabled yet: the database needs migrations/room_options.sql (plus migrations/invites.sql for one-time links and migrations/burn_mode.sql for burn mode).' },
                { status: 503 }
            );
        }

        if (error) throw error;

        maybeSweep();
        return NextResponse.json(shape(data as Record<string, unknown>), { status: 201 });
    } catch (err) {
        console.error('Error creating group:', err);
        return NextResponse.json({ error: 'Failed to create group' }, { status: 500 });
    }
}
