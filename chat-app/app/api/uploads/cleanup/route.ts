import { NextResponse } from 'next/server';
import { supabaseAdmin, MEDIA_BUCKET } from '@/lib/server/supabaseAdmin';
import { deleteGroupMedia, getGroup, isUuid } from '@/lib/server/groups';

const IMAGE_RETENTION_MS = 24 * 60 * 60 * 1000;
const MAX_FOLDERS_PER_RUN = 200;

// Media lives in one folder per room. This removes folders whose room no longer exists and any
// file older than the retention window. It only ever deletes things that should already be gone,
// so it is safe for anyone (or a cron) to call.
async function run() {
    try {
        let cleaned = 0;
        let foldersChecked = 0;

        const { data: folders, error: listError } = await supabaseAdmin.storage
            .from(MEDIA_BUCKET)
            .list('', { limit: MAX_FOLDERS_PER_RUN });

        if (listError) {
            console.error('Supabase list error:', listError);
            return NextResponse.json({ error: 'Failed to list files' }, { status: 500 });
        }

        for (const entry of folders ?? []) {
            if (!isUuid(entry.name)) continue;
            foldersChecked++;

            const { data: files } = await supabaseAdmin.storage.from(MEDIA_BUCKET).list(entry.name, { limit: 1000 });
            const count = files?.length ?? 0;
            if (count === 0) continue;

            const group = await getGroup(entry.name);
            if (!group) {
                await deleteGroupMedia(entry.name);
                cleaned += count;
                continue;
            }

            const expired = (files ?? [])
                .filter(f => {
                    const created = f.created_at || f.updated_at;
                    return created && Date.now() - new Date(created).getTime() > IMAGE_RETENTION_MS;
                })
                .map(f => `${entry.name}/${f.name}`);

            if (expired.length > 0) {
                const { error } = await supabaseAdmin.storage.from(MEDIA_BUCKET).remove(expired);
                if (error) console.error('Supabase delete error:', error);
                else cleaned += expired.length;
            }
        }

        return NextResponse.json({ cleaned, foldersChecked, timestamp: new Date().toISOString() });
    } catch (error) {
        console.error('Cleanup error:', error);
        return NextResponse.json({ error: 'Cleanup failed' }, { status: 500 });
    }
}

export const POST = run;
export const GET = run;
