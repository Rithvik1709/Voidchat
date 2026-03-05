import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

const BUCKET_NAME = 'chat-images';
const IMAGE_RETENTION_TIME = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

export async function POST(req: Request) {
    try {
        // List all files in the bucket
        const { data: files, error: listError } = await supabase.storage
            .from(BUCKET_NAME)
            .list('', {
                limit: 100,
                offset: 0
            });

        if (listError) {
            console.error('Supabase list error:', listError);
            return NextResponse.json(
                { error: 'Failed to list files' },
                { status: 500 }
            );
        }

        if (!files || files.length === 0) {
            return NextResponse.json({ 
                cleaned: 0,
                timestamp: new Date().toISOString()
            });
        }

        const now = Date.now();
        const filesToDelete: string[] = [];

        // Check each file's metadata
        for (const file of files) {
            if (file.metadata?.timeCreated) {
                const fileAge = now - new Date(file.metadata.timeCreated).getTime();
                
                // Delete files older than retention time
                if (fileAge > IMAGE_RETENTION_TIME) {
                    filesToDelete.push(file.name);
                }
            }
        }

        // Delete old files
        let cleanedCount = 0;
        if (filesToDelete.length > 0) {
            const { error: deleteError } = await supabase.storage
                .from(BUCKET_NAME)
                .remove(filesToDelete);

            if (deleteError) {
                console.error('Supabase delete error:', deleteError);
                return NextResponse.json(
                    { error: 'Failed to delete files' },
                    { status: 500 }
                );
            }

            cleanedCount = filesToDelete.length;
        }

        return NextResponse.json({ 
            cleaned: cleanedCount,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Cleanup error:', error);
        return NextResponse.json(
            { error: 'Cleanup failed' },
            { status: 500 }
        );
    }
}
