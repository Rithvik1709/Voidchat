import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

const BUCKET_NAME = 'chat-images';
const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB
const ALLOWED_MIMES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];

export async function POST(req: Request) {
    try {
        const formData = await req.formData();
        const file = formData.get('file') as File;
        const groupId = formData.get('groupId') as string;

        if (!file) {
            return NextResponse.json(
                { error: 'No file provided' },
                { status: 400 }
            );
        }

        if (!groupId) {
            return NextResponse.json(
                { error: 'Group ID is required' },
                { status: 400 }
            );
        }

        // Validate file type
        if (!ALLOWED_MIMES.includes(file.type)) {
            return NextResponse.json(
                { error: 'Invalid file type. Only images are allowed.' },
                { status: 400 }
            );
        }

        // Validate file size
        if (file.size > MAX_FILE_SIZE) {
            return NextResponse.json(
                { error: 'File size exceeds 25MB limit' },
                { status: 413 }
            );
        }

        // Generate unique filename with groupId prefix for easy cleanup
        const timestamp = Date.now();
        const random = Math.random().toString(36).substring(2, 10);
        const ext = file.name.split('.').pop() || 'jpg';
        const filename = `${groupId}/${timestamp}-${random}.${ext}`;

        // Convert file to buffer
        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);

        // Upload to Supabase Storage
        const { data, error: uploadError } = await supabase.storage
            .from(BUCKET_NAME)
            .upload(filename, buffer, {
                contentType: file.type,
                cacheControl: '3600', // 1 hour cache
                upsert: false
            });

        if (uploadError) {
            console.error('Supabase upload error:', uploadError);
            return NextResponse.json(
                { error: 'Failed to upload image to storage' },
                { status: 500 }
            );
        }

        // Get public URL
        const { data: urlData } = supabase.storage
            .from(BUCKET_NAME)
            .getPublicUrl(filename);

        const imageUrl = urlData.publicUrl;

        return NextResponse.json(
            { 
                url: imageUrl,
                filename: filename,
                size: file.size,
                type: file.type,
                path: data?.path
            },
            { status: 200 }
        );
    } catch (error) {
        console.error('Upload error:', error);
        return NextResponse.json(
            { error: 'Failed to upload file' },
            { status: 500 }
        );
    }
}
