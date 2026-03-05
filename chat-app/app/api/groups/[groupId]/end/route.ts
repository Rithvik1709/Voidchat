import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

const BUCKET_NAME = 'chat-images';

// DELETE /api/groups/:groupId/end - End session and delete group
export async function DELETE(
    _request: Request,
    props: { params: Promise<{ groupId: string }> }
) {
    try {
        const params = await props.params;

        // Delete all images for this group from Supabase Storage
        try {
            const { data: files, error: listError } = await supabase.storage
                .from(BUCKET_NAME)
                .list(params.groupId);

            if (!listError && files && files.length > 0) {
                // Build array of file paths to delete
                const filesToDelete = files.map(file => `${params.groupId}/${file.name}`);
                
                const { error: deleteError } = await supabase.storage
                    .from(BUCKET_NAME)
                    .remove(filesToDelete);

                if (deleteError) {
                    console.error('Failed to delete images:', deleteError);
                    // Continue anyway - don't fail the group deletion
                }
            }
        } catch (storageErr) {
            console.error('Storage cleanup error:', storageErr);
            // Continue anyway - don't fail the group deletion
        }

        // Delete the group from database
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
