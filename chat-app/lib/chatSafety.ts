/**
 * Pure helpers for handling chat messages. Everything that arrives over the room channel is
 * untrusted, so it is validated here before the UI ever sees it.
 */

export interface ReplyContext {
    id: string;
    sender: string;
    text: string;
}

export interface PollData {
    question: string;
    options: string[];
    votes: { [option: string]: string[] }; // option -> array of usernames who voted
    creator: string;
    type: 'single' | 'multiple'; // single or multiple choice
}

export interface MessageContent {
    text: string;
    replyTo?: ReplyContext;
    poll?: PollData;
    audio?: string; // base64 encoded audio data
    image?: string; // URL to uploaded image
    from?: string; // sender name, bound inside the encrypted payload
}

// ---------------------------------------------------------------------------
// Input hardening: everything that arrives over the room channel is untrusted.
// ---------------------------------------------------------------------------
export const MAX_TEXT_LENGTH = 4000;
export const MAX_NAME_LENGTH = 15;
export const MAX_AUDIO_RECEIVE_B64 = 400_000;
export const MAX_AUDIO_SEND_B64 = 160_000; // keeps the encrypted broadcast under realtime payload limits
export const MEDIA_URL_PREFIX = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/chat-images/`;

export const newId = () =>
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

export const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const isRecord = (v: unknown): v is Record<string, unknown> =>
    typeof v === 'object' && v !== null && !Array.isArray(v);

export const isMediaUrl = (v: unknown): v is string =>
    typeof v === 'string' && v.startsWith(MEDIA_URL_PREFIX) && !/\s/.test(v) && v.length < 600;

export function sanitizePoll(raw: unknown): PollData | null {
    if (!isRecord(raw)) return null;
    const { question, options, votes, creator, type } = raw;
    if (typeof question !== 'string' || !question || question.length > 200) return null;
    if (!Array.isArray(options) || options.length < 2 || options.length > 10) return null;
    if (!options.every(o => typeof o === 'string' && o.length > 0 && o.length <= 100)) return null;
    const opts = Array.from(new Set(options as string[]));
    if (opts.length < 2) return null;
    if (type !== 'single' && type !== 'multiple') return null;

    const safeVotes: PollData['votes'] = {};
    const rawVotes = isRecord(votes) ? votes : {};
    for (const o of opts) {
        const v = rawVotes[o];
        safeVotes[o] = Array.isArray(v)
            ? Array.from(new Set(v.filter((u): u is string => typeof u === 'string' && u.length > 0 && u.length <= MAX_NAME_LENGTH))).slice(0, 200)
            : [];
    }
    return {
        question,
        options: opts,
        votes: safeVotes,
        creator: typeof creator === 'string' ? creator.slice(0, MAX_NAME_LENGTH) : '',
        type,
    };
}

export function sanitizeContent(raw: unknown): MessageContent | null {
    if (!isRecord(raw)) return null;
    if (typeof raw.text !== 'string' || raw.text.length > MAX_TEXT_LENGTH) return null;

    const content: MessageContent = { text: raw.text };

    if (typeof raw.from === 'string') content.from = raw.from;

    if (isRecord(raw.replyTo)) {
        const r = raw.replyTo;
        if (typeof r.id === 'string' && typeof r.sender === 'string' && typeof r.text === 'string') {
            content.replyTo = { id: r.id.slice(0, 64), sender: r.sender.slice(0, MAX_NAME_LENGTH), text: r.text.slice(0, 80) };
        }
    }
    if (raw.poll !== undefined) {
        const poll = sanitizePoll(raw.poll);
        if (!poll) return null;
        content.poll = poll;
    }
    if (typeof raw.audio === 'string' && raw.audio.length <= MAX_AUDIO_RECEIVE_B64 && /^[A-Za-z0-9+/=]+$/.test(raw.audio)) {
        content.audio = raw.audio;
    }
    if (isMediaUrl(raw.image)) content.image = raw.image;

    return content;
}

/** Apply one person's selections to a poll without touching anyone else's votes. */
export function applyVote(poll: PollData, voter: string, selections: string[]): PollData {
    const chosen = new Set(selections.filter(o => poll.options.includes(o)));
    const picked = poll.type === 'single' ? Array.from(chosen).slice(0, 1) : Array.from(chosen);
    const votes: PollData['votes'] = {};
    for (const o of poll.options) {
        const others = (poll.votes[o] || []).filter(u => u !== voter);
        votes[o] = picked.includes(o) ? [...others, voter] : others;
    }
    return { ...poll, votes };
}
