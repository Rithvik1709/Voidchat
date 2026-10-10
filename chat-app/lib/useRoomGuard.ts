"use client";

import { useEffect, useRef, type MutableRefObject } from 'react';
import type { MessageContent } from './chatSafety';
import { nextBatch } from './moderation';

interface GuardMessage {
    id: string;
    sender: string;
    content: MessageContent;
    isSystem?: boolean;
}

const INTERVAL_MS = 3000;
const BACKOFF_MS = 15_000;

/**
 * Room safety check. Every few seconds, sends any new message text this browser has
 * decrypted to the room's moderate endpoint. Every member runs it, so a member who
 * switches it off in their own browser is still checked by everyone else's.
 * The server ends the room itself when the guard finds a severe category; this hook
 * only learns about it and tells the rest of the room.
 */
export function useRoomGuard({
    groupId,
    active,
    messages,
    proofRef,
    onTerminate,
}: {
    groupId: string;
    active: boolean;
    messages: GuardMessage[];
    proofRef: MutableRefObject<string>;
    onTerminate: () => void;
}) {
    const latest = useRef(messages);
    const onTerminateRef = useRef(onTerminate);
    const checked = useRef(new Set<string>());

    useEffect(() => {
        latest.current = messages;
        onTerminateRef.current = onTerminate;
    });

    useEffect(() => {
        if (!active) return;
        let busy = false;
        let stopped = false;
        let quietUntil = 0;

        const tick = async () => {
            if (busy || stopped || Date.now() < quietUntil) return;
            const next = nextBatch(latest.current, checked.current);
            if (!next) return;
            busy = true;
            try {
                const res = await fetch(`/api/groups/${groupId}/moderate`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'x-room-proof': proofRef.current },
                    body: JSON.stringify({ messages: next.batch, context: next.context }),
                });
                if (res.status === 403) {
                    stopped = true;
                    return;
                }
                if (!res.ok) {
                    quietUntil = Date.now() + BACKOFF_MS;
                    return;
                }
                const data = await res.json().catch(() => ({}));
                if (data.terminate) {
                    stopped = true;
                    onTerminateRef.current();
                    return;
                }
                if (data.ended) {
                    stopped = true;
                    return;
                }
                if (data.unavailable) {
                    // guard is down: try these messages again a little later
                    quietUntil = Date.now() + BACKOFF_MS;
                    return;
                }
                next.batch.forEach(m => checked.current.add(m.id));
            } catch {
                quietUntil = Date.now() + BACKOFF_MS;
            } finally {
                busy = false;
            }
        };

        const id = setInterval(tick, INTERVAL_MS);
        return () => {
            stopped = true;
            clearInterval(id);
        };
    }, [active, groupId, proofRef]);
}
