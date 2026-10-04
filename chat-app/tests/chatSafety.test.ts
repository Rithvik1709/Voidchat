import { describe, expect, it } from 'vitest';
import {
  applyVote, escapeRegExp, isMediaUrl, newId, sanitizeContent, sanitizePoll, MAX_TEXT_LENGTH, type PollData,
} from '@/lib/chatSafety';
import { MEDIA } from './helpers/api';

describe('escapeRegExp (usernames in the mention pattern)', () => {
  it.each(['[', 'a(b', 'x+', 'a.b', '$', '\\', 'bob'])('builds a valid pattern for username %s', name => {
    const re = new RegExp(`(@${escapeRegExp(name)})(?!\\w)`, 'gi');
    const parts = `hi @${name} and @${name}x`.split(re);
    expect(parts).toContain(`@${name}`); // matched exactly once, and not inside "@namex"
    expect(parts.filter(p => p === `@${name}`)).toHaveLength(1);
  });
});

describe('newId', () => {
  it('never repeats', () => {
    expect(new Set(Array.from({ length: 1000 }, newId)).size).toBe(1000);
  });
});

describe('isMediaUrl', () => {
  it('allows only files from our own bucket', () => {
    expect(isMediaUrl(`${MEDIA}room/pic.png`)).toBe(true);
    expect(isMediaUrl('https://evil.example/track.gif')).toBe(false);
    expect(isMediaUrl('javascript:alert(1)')).toBe(false);
    expect(isMediaUrl(`${MEDIA}room/a b.png`)).toBe(false);
    expect(isMediaUrl(42)).toBe(false);
  });
});

describe('sanitizeContent', () => {
  it('requires a text string and caps its length', () => {
    expect(sanitizeContent({ text: 'hi' })).toEqual({ text: 'hi' });
    expect(sanitizeContent({})).toBeNull();
    expect(sanitizeContent({ text: 5 })).toBeNull();
    expect(sanitizeContent('nope')).toBeNull();
    expect(sanitizeContent(null)).toBeNull();
    expect(sanitizeContent({ text: 'x'.repeat(MAX_TEXT_LENGTH + 1) })).toBeNull();
  });

  it('drops images that are not from our bucket but keeps the message', () => {
    const ok = sanitizeContent({ text: 'p', image: `${MEDIA}r/a.png` });
    expect(ok?.image).toBe(`${MEDIA}r/a.png`);
    const bad = sanitizeContent({ text: 'p', image: 'https://evil.example/x.gif' });
    expect(bad).toEqual({ text: 'p' });
  });

  it('only keeps well-formed audio', () => {
    expect(sanitizeContent({ text: 'v', audio: 'QUJD' })?.audio).toBe('QUJD');
    expect(sanitizeContent({ text: 'v', audio: '<script>' })?.audio).toBeUndefined();
    expect(sanitizeContent({ text: 'v', audio: 'A'.repeat(500_000) })?.audio).toBeUndefined();
  });

  it('shortens and validates reply context', () => {
    const c = sanitizeContent({ text: 'r', replyTo: { id: 'i', sender: 's', text: 'y'.repeat(500) } });
    expect(c?.replyTo?.text.length).toBe(80);
    expect(sanitizeContent({ text: 'r', replyTo: { id: 1 } })?.replyTo).toBeUndefined();
  });

  it('rejects the whole message when the poll is malformed', () => {
    expect(sanitizeContent({ text: 'p', poll: { question: 'q' } })).toBeNull();
  });
});

const poll = (over: Partial<PollData> = {}): PollData => ({
  question: 'Pizza?', options: ['yes', 'no'], votes: { yes: [], no: [] }, creator: 'a', type: 'single', ...over,
});

describe('sanitizePoll', () => {
  it('accepts a valid poll and fills missing vote lists', () => {
    expect(sanitizePoll({ ...poll(), votes: {} })?.votes).toEqual({ yes: [], no: [] });
  });

  it('rejects bad shapes', () => {
    expect(sanitizePoll(poll({ options: ['only one'] }))).toBeNull();
    expect(sanitizePoll(poll({ options: ['a', 'a'] }))).toBeNull(); // duplicates collapse below the minimum
    expect(sanitizePoll(poll({ question: '' }))).toBeNull();
    expect(sanitizePoll({ ...poll(), type: 'weird' })).toBeNull();
    expect(sanitizePoll(Array.from({ length: 3 }))).toBeNull();
    expect(sanitizePoll({ ...poll(), options: Array.from({ length: 11 }, (_, i) => `o${i}`) })).toBeNull();
  });

  it('strips non-string voters', () => {
    const p = sanitizePoll({ ...poll(), votes: { yes: ['a', 5, null, 'b'], no: 'oops' } });
    expect(p?.votes).toEqual({ yes: ['a', 'b'], no: [] });
  });
});

describe('applyVote', () => {
  it('moves a single-choice vote and leaves other people untouched', () => {
    const start = poll({ votes: { yes: ['bob'], no: ['carol'] } });
    const after = applyVote(start, 'alice', ['no']);
    expect(after.votes).toEqual({ yes: ['bob'], no: ['carol', 'alice'] });
    expect(applyVote(after, 'alice', ['yes']).votes).toEqual({ yes: ['bob', 'alice'], no: ['carol'] });
  });

  it('allows several choices on a multiple-choice poll and clearing a vote', () => {
    const start = poll({ type: 'multiple' });
    const two = applyVote(start, 'alice', ['yes', 'no']);
    expect(two.votes).toEqual({ yes: ['alice'], no: ['alice'] });
    expect(applyVote(two, 'alice', []).votes).toEqual({ yes: [], no: [] });
  });

  it('keeps only one choice on a single-choice poll and ignores unknown options', () => {
    const after = applyVote(poll(), 'alice', ['yes', 'no', 'bogus']);
    expect(Object.values(after.votes).flat()).toEqual(['alice']);
    expect(applyVote(poll(), 'alice', ['bogus']).votes).toEqual({ yes: [], no: [] });
  });

  it('never changes the question or the options (a vote cannot rewrite a poll)', () => {
    const start = poll();
    const after = applyVote(start, 'alice', ['yes']);
    expect(after.question).toBe(start.question);
    expect(after.options).toEqual(start.options);
    expect(after.creator).toBe(start.creator);
  });
});
