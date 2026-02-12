import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function DELETE(request: Request) {
    try {
        // Delete groups with 0 active users
        const { data: emptyGroups, error: emptyError } = await supabase
            .from('groups')
            .delete()
            .lte('active_user_count', 0)
            .select();

        if (emptyError) {
            console.error('Empty group cleanup failed:', emptyError);
        }

        // Delete groups with 1 user that have been inactive for more than 30 minutes
        const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
        
        const { data: inactiveGroups, error: inactiveError } = await supabase
            .from('groups')
            .delete()
            .eq('active_user_count', 1)
            .lt('last_active_at', thirtyMinutesAgo)
            .select();

        if (inactiveError) {
            console.error('Inactive group cleanup failed:', inactiveError);
        }

        const totalDeleted = (emptyGroups?.length || 0) + (inactiveGroups?.length || 0);

        return NextResponse.json({ 
            success: true, 
            deleted: totalDeleted,
            emptyGroups: emptyGroups?.length || 0,
            inactiveGroups: inactiveGroups?.length || 0
        });
    } catch (err) {
        console.error('Cleanup error:', err);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
