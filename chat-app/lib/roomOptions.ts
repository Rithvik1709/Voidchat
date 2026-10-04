/** Room options shared by the create form, the API and the room itself. */

/** Auto-close choices, in minutes. */
export const EXPIRY_CHOICES = [
    { minutes: null, label: 'Never' },
    { minutes: 15, label: '15 min' },
    { minutes: 60, label: '1 hour' },
    { minutes: 360, label: '6 hours' },
    { minutes: 1440, label: '24 hours' },
] as const;

export const ALLOWED_EXPIRY_MINUTES: number[] = EXPIRY_CHOICES.flatMap(c => (c.minutes === null ? [] : [c.minutes]));

/**
 * The member limit is whatever the host types: there is no preset list and no product cap.
 * The only bounds are "at least one person" and the largest number the database's integer
 * column can store.
 */
export const MIN_MEMBERS = 1;
export const MAX_MEMBERS = 2_147_483_647;

/** Parses the limit field. Empty means "no limit"; anything else must be a whole number in range. */
export function parseMemberLimit(text: string): { value: number | null; error: string | null } {
    const trimmed = text.trim();
    if (trimmed === '') return { value: null, error: null };
    if (!/^\d+$/.test(trimmed)) return { value: null, error: 'Use a whole number, or leave it empty for no limit.' };
    const n = Number(trimmed);
    if (n < MIN_MEMBERS) return { value: null, error: `The limit must be at least ${MIN_MEMBERS}.` };
    if (n > MAX_MEMBERS) return { value: null, error: `That is too large. The most the database can store is ${MAX_MEMBERS.toLocaleString()}.` };
    return { value: n, error: null };
}

export const MIN_PASSWORD_LENGTH = 4;
export const MAX_PASSWORD_LENGTH = 64;

/** What the room page needs to know about a room before anyone joins. */
export type RoomOptions = {
    hasPassword: boolean;
    /** ISO time the room auto-closes, if it has a timer */
    expiresAt: string | null;
    /** Server clock at page load, so countdowns are not thrown off by a wrong device clock */
    serverNow: string;
    maxMembers: number | null;
};

export function formatCountdown(ms: number): string {
    const total = Math.max(0, Math.ceil(ms / 1000));
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    const mm = String(m).padStart(h > 0 ? 2 : 1, '0');
    const ss = String(s).padStart(2, '0');
    return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}
