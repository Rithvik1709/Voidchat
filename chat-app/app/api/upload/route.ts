import { NextResponse } from 'next/server';
import { supabaseAdmin, MEDIA_BUCKET } from '@/lib/server/supabaseAdmin';
import { extractProof, getLiveGroup, isUuid, verifyRoomProof } from '@/lib/server/groups';

const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB
const MAX_FILES_PER_ROOM = 50;

// SVG is intentionally not allowed: it can carry scripts and the bucket is public.
const EXT_BY_MIME: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/gif': 'gif',
    'image/webp': 'webp',
};

/** Make sure the bytes really are the image type the client claimed. */
function matchesMime(buf: Buffer, mime: string): boolean {
    switch (mime) {
        case 'image/jpeg':
            return buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
        case 'image/png':
            return buf.length > 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
        case 'image/gif':
            return buf.length > 6 && ['GIF87a', 'GIF89a'].includes(buf.subarray(0, 6).toString('ascii'));
        case 'image/webp':
            return buf.length > 12 && buf.subarray(0, 4).toString('ascii') === 'RIFF' && buf.subarray(8, 12).toString('ascii') === 'WEBP';
        default:
            return false;
    }
}

export async function POST(req: Request) {
    try {
        const formData = await req.formData();
        const file = formData.get('file');
        const groupId = formData.get('groupId');
        const proof = formData.get('proof');

        if (!(file instanceof File)) {
            return NextResponse.json({ error: 'No file provided' }, { status: 400 });
        }

        if (!isUuid(groupId)) {
            return NextResponse.json({ error: 'Group ID is required' }, { status: 400 });
        }

        const ext = EXT_BY_MIME[file.type];
        if (!ext) {
            return NextResponse.json({ error: 'Invalid file type. Only JPEG, PNG, GIF and WebP images are allowed.' }, { status: 400 });
        }

        if (file.size > MAX_FILE_SIZE) {
            return NextResponse.json({ error: 'File size exceeds 25MB limit' }, { status: 413 });
        }

        // Only a member of an existing room can upload to it.
        const group = await getLiveGroup(groupId);
        if (!group) {
            return NextResponse.json({ error: 'This room no longer exists.' }, { status: 404 });
        }
        if (!verifyRoomProof(group, extractProof(req, { proof: typeof proof === 'string' ? proof : '' }))) {
            return NextResponse.json({ error: 'Not allowed to upload to this room.' }, { status: 403 });
        }

        const { data: existing } = await supabaseAdmin.storage.from(MEDIA_BUCKET).list(groupId, { limit: MAX_FILES_PER_ROOM + 1 });
        if ((existing?.length ?? 0) >= MAX_FILES_PER_ROOM) {
            return NextResponse.json({ error: 'This room has reached its image limit.' }, { status: 429 });
        }

        const buffer = Buffer.from(await file.arrayBuffer());
        if (!matchesMime(buffer, file.type)) {
            return NextResponse.json({ error: 'File contents do not match an allowed image type.' }, { status: 400 });
        }

        // Server-chosen name: nothing from the client ends up in the storage path.
        const filename = `${groupId}/${Date.now()}-${crypto.randomUUID()}.${ext}`;

        const { data, error: uploadError } = await supabaseAdmin.storage
            .from(MEDIA_BUCKET)
            .upload(filename, buffer, {
                contentType: file.type,
                cacheControl: '3600',
                upsert: false,
            });

        if (uploadError) {
            console.error('Supabase upload error:', uploadError);
            return NextResponse.json({ error: 'Failed to upload image to storage' }, { status: 500 });
        }

        const { data: urlData } = supabaseAdmin.storage.from(MEDIA_BUCKET).getPublicUrl(filename);

        return NextResponse.json({
            url: urlData.publicUrl,
            filename,
            size: file.size,
            type: file.type,
            path: data?.path,
        });
    } catch (error) {
        console.error('Upload error:', error);
        return NextResponse.json({ error: 'Failed to upload file' }, { status: 500 });
    }
}
