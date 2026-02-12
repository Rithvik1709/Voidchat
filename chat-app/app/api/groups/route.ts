
import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// GET /api/groups - List active groups (filtered by creator_id)
export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const creatorId = searchParams.get('creator_id');

        if (!creatorId) {
            return NextResponse.json([]);
        }

        const { data: groups, error } = await supabase
            .from('groups')
            .select('*')
            .eq('creator_id', creatorId)
            .order('created_at', { ascending: false })
            .limit(10);

        if (error) throw error;

        return NextResponse.json(groups || []);
    } catch (err) {
        console.error('Error fetching groups:', err);
        return NextResponse.json({ error: 'Failed to fetch groups' }, { status: 500 });
    }
}

// POST /api/groups - Create a new group
export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { name, tags, key, creator_id } = body;

        if (!name || name.trim().length === 0) {
            return NextResponse.json({ error: 'Group name is required' }, { status: 400 });
        }

        if (!creator_id) {
            return NextResponse.json({ error: 'Creator ID is required' }, { status: 400 });
        }

        // Check max groups limit per creator
        const { count, error: countError } = await supabase
            .from('groups')
            .select('*', { count: 'exact', head: true })
            .eq('creator_id', creator_id);

        if (countError) throw countError;

        if (count !== null && count >= 10) {
            return NextResponse.json({ error: 'Maximum of 10 active groups per user reached.' }, { status: 403 });
        }

        // Create group
        const { data, error } = await supabase
            .from('groups')
            .insert([
                {
                    name: name.trim().slice(0, 30),
                    tags: Array.isArray(tags) ? tags.slice(0, 5) : [],
                    key: key, // Store the public key
                    creator_id: creator_id,
                    active_user_count: 0
                }
            ])
            .select()
            .single();

        if (error) throw error;

        return NextResponse.json(data, { status: 201 });
    } catch (err) {
        console.error('Error creating group:', err);
        return NextResponse.json({ error: 'Failed to create group' }, { status: 500 });
    }
}
