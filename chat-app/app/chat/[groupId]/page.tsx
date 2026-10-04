import type { Metadata } from "next";
import ChatRoom from "@/components/ChatRoom";
import RoomEnded from "@/components/RoomEnded";
import { supabaseAdmin } from "@/lib/server/supabaseAdmin";
import { deleteGroupAndMedia, isExpired, isUuid } from "@/lib/server/groups";
import type { RoomOptions } from "@/lib/roomOptions";

interface PageProps {
    params: Promise<{ groupId: string }>;
}

// Room links should never be indexed, and this page must never be served from a cache.
export const metadata: Metadata = {
    robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

type Lookup =
    | { state: 'found'; name: string; options: RoomOptions }
    | { state: 'missing' }
    | { state: 'unknown' };

async function lookupGroup(groupId: string): Promise<Lookup> {
    if (!isUuid(groupId)) return { state: 'missing' };

    try {
        // select('*') so this works whether or not the room-options migration has been run
        const { data, error } = await supabaseAdmin
            .from('groups')
            .select('*')
            .eq('id', groupId)
            .maybeSingle();

        if (error) {
            // Could not check (e.g. database policy / network). Do not lock people out of a live room.
            console.error('Error fetching group:', error);
            return { state: 'unknown' };
        }

        if (!data) return { state: 'missing' };

        // Timer ran out: the room is over even if nobody has swept it yet
        if (isExpired(data)) {
            deleteGroupAndMedia(groupId).catch(() => undefined);
            return { state: 'missing' };
        }

        return {
            state: 'found',
            name: data.name,
            options: {
                hasPassword: Boolean(data.has_password),
                expiresAt: data.expires_at ?? null,
                serverNow: new Date().toISOString(),
                maxMembers: data.max_members ?? null,
            },
        };
    } catch (error) {
        console.error('Error fetching group:', error);
        return { state: 'unknown' };
    }
}

export default async function ChatPage({ params }: PageProps) {
    const { groupId } = await params;
    const lookup = await lookupGroup(groupId);

    // The room has ended (or never existed): do not open a live channel for it.
    if (lookup.state === 'missing') {
        return <RoomEnded />;
    }

    return (
        <ChatRoom
            groupId={groupId}
            groupName={lookup.state === 'found' ? lookup.name : 'Chat Room'}
            options={lookup.state === 'found' ? lookup.options : undefined}
        />
    );
}
