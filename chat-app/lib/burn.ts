/**
 * Burn mode: every message disappears a fixed time after it appears on screen.
 *
 * Time is measured on each person's own device, from the moment the message reached it, so no
 * clocks have to agree. The pure helpers here decide *what* burns *when*; components do the rest.
 */

/** Remember when each message first appeared, and forget messages that are gone. */
export function trackMessages(seen: Map<string, number>, ids: readonly string[], now: number): void {
    const live = new Set(ids);
    for (const id of ids) {
        if (!seen.has(id)) seen.set(id, now);
    }
    for (const id of [...seen.keys()]) {
        if (!live.has(id)) seen.delete(id);
    }
}

/** Messages old enough to burn that are not already burning. */
export function dueIds(seen: ReadonlyMap<string, number>, burning: ReadonlySet<string>, now: number, burnMs: number): string[] {
    const due: string[] = [];
    for (const [id, since] of seen) {
        if (!burning.has(id) && now - since >= burnMs) due.push(id);
    }
    return due;
}

/**
 * If `url` is a file in this room's folder of the media bucket, return its storage path
 * ("<room>/<file>"); otherwise null. Used to delete an image once its message has burned.
 */
export function mediaPathFromUrl(url: string | undefined, groupId: string, bucketUrlPrefix: string): string | null {
    if (!url || !url.startsWith(bucketUrlPrefix)) return null;
    const path = url.slice(bucketUrlPrefix.length);
    return new RegExp(`^${groupId}/[0-9]+-[0-9a-f-]{36}\\.(jpg|png|gif|webp)$`, 'i').test(path) ? path : null;
}
