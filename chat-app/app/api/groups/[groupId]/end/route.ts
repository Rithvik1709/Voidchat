import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// DELETE /api/groups/:groupId/end - End session and delete group
export async function DELETE(
    _request: Request,
    props: { params: Promise<{ groupId: string }> }
) {
    try {
        const params = await props.params;

        const { error } = await supabase
            .from('groups')
            .delete()
            .eq('id', params.groupId);

        if (error) {
            console.error('End session delete failed:', error);
            return NextResponse.json({ error: 'Failed to delete group' }, { status: 500 });
        }

        return NextResponse.json({ success: true });
    } catch (err) {
        console.error('End session error:', err);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
