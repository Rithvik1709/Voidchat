import type { Metadata } from "next";
import ChatRoom from "@/components/ChatRoom";
import RoomEnded from "@/components/RoomEnded";
import { supabaseAdmin } from "@/lib/server/supabaseAdmin";
import { isUuid } from "@/lib/server/groups";

interface PageProps {
    params: Promise<{ groupId: string }>;
}

// Room links should never be indexed.
export const metadata: Metadata = {
    robots: { index: false, follow: false },
};

type Lookup = { state: 'found'; name: string } | { state: 'missing' } | { state: 'unknown' };

async function lookupGroup(groupId: string): Promise<Lookup> {
    if (!isUuid(groupId)) return { state: 'missing' };

    try {
        const { data, error } = await supabaseAdmin
            .from('groups')
            .select('name')
            .eq('id', groupId)
            .maybeSingle();

        if (error) {
            // Could not check (e.g. database policy / network). Do not lock people out of a live room.
            console.error('Error fetching group:', error);
            return { state: 'unknown' };
        }

        return data ? { state: 'found', name: data.name } : { state: 'missing' };
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

    return <ChatRoom groupId={groupId} groupName={lookup.state === 'found' ? lookup.name : 'Chat Room'} />;
}
