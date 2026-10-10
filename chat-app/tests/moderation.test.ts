import { describe, expect, it } from 'vitest';
import { cleanItems, nextBatch, textOf } from '@/lib/moderation';

const msg = (id: string, text: string, extra: Record<string, unknown> = {}) => ({ id, sender: 'a', content: { text, ...extra } });

describe('room safety check helpers', () => {
  it('reads message text, including poll questions and options', () => {
    expect(textOf({ text: '  hi   there ' })).toBe('hi there');
    expect(textOf({ text: '', poll: { question: 'plan?', options: ['a', 'b'], votes: {}, creator: 'x', type: 'single' } })).toBe('plan? a b');
    expect(textOf(undefined)).toBe('');
  });

  it('batches unchecked messages oldest first, with earlier lines as context', () => {
    const checked = new Set(['1', '2']);
    const messages = [msg('1', 'one'), msg('2', 'two'), msg('3', 'three'), msg('4', 'four')];
    const next = nextBatch(messages, checked)!;
    expect(next.batch.map(m => m.id)).toEqual(['3', '4']);
    expect(next.context.map(m => m.id)).toEqual(['1', '2']);
  });

  it('skips system notices and media-only messages, and returns null when nothing is new', () => {
    const checked = new Set<string>();
    const messages = [{ ...msg('s', 'ghost joined'), isSystem: true }, msg('img', '', { image: 'https://x/y.png' })];
    expect(nextBatch(messages, checked)).toBeNull();
    expect(checked.has('img')).toBe(true);
  });

  it('drops malformed items and caps lengths', () => {
    const items = cleanItems([{ id: 'x', sender: 'a', text: 'ok' }, { text: '' }, null, 'nope', { text: 'y'.repeat(5000) }], 10);
    expect(items).toHaveLength(2);
    expect(items[1].text.length).toBe(2000);
    expect(cleanItems('not an array', 5)).toEqual([]);
  });
});
