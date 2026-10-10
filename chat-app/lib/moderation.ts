import type { MessageContent } from './chatSafety';

/** What the room safety check sends for one message. Only text is ever checked, never media. */
export interface CheckItem {
    id: string;
    sender: string;
    text: string;
}

export const MAX_BATCH = 20;
export const CONTEXT_LINES = 6;
const MAX_TEXT = 2000;

/** The readable text of a message: the body, plus a poll's question and options. */
export function textOf(content: MessageContent | undefined): string {
    if (!content) return '';
    const parts = [content.text || ''];
    if (content.poll) parts.push(content.poll.question, ...content.poll.options);
    return parts.join(' ').replace(/\s+/g, ' ').trim().slice(0, MAX_TEXT);
}

interface ChatMessage {
    id: string;
    sender: string;
    content: MessageContent;
    isSystem?: boolean;
}

/**
 * Picks the next messages to check (oldest first, up to MAX_BATCH) plus a few earlier
 * lines as context. Messages without text (images, voice notes) are skipped and marked done.
 */
export function nextBatch(messages: ChatMessage[], checked: Set<string>) {
    const readable = messages
        .filter(m => !m.isSystem)
        .map(m => ({ id: m.id, sender: m.sender, text: textOf(m.content) }));

    for (const m of readable) if (!m.text) checked.add(m.id);

    const firstNew = readable.findIndex(m => m.text && !checked.has(m.id));
    if (firstNew === -1) return null;

    const batch = readable.slice(firstNew).filter(m => m.text && !checked.has(m.id)).slice(0, MAX_BATCH);
    const context = readable.slice(Math.max(0, firstNew - CONTEXT_LINES), firstNew).filter(m => m.text);
    return { batch, context };
}

/** Validates check items arriving at the server. Anything malformed is dropped. */
export function cleanItems(value: unknown, max: number): CheckItem[] {
    if (!Array.isArray(value)) return [];
    const out: CheckItem[] = [];
    for (const v of value.slice(0, max)) {
        if (!v || typeof v !== 'object') continue;
        const { id, sender, text } = v as Record<string, unknown>;
        if (typeof text !== 'string' || !text.trim()) continue;
        out.push({
            id: typeof id === 'string' ? id.slice(0, 64) : '',
            sender: typeof sender === 'string' ? sender.slice(0, 32) : '?',
            text: text.slice(0, MAX_TEXT),
        });
    }
    return out;
}
