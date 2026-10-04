import { describe, expect, it } from 'vitest';
import { ALLOWED_EXPIRY_MINUTES, EXPIRY_CHOICES, MAX_MEMBERS, formatCountdown, parseMemberLimit } from '@/lib/roomOptions';

describe('formatCountdown', () => {
  it.each([
    [0, '0:00'],
    [-5000, '0:00'],
    [999, '0:01'], // rounds up so it never shows 0:00 while time remains
    [59_000, '0:59'],
    [61_000, '1:01'],
    [10 * 60_000, '10:00'],
    [3_600_000, '1:00:00'],
    [3_661_000, '1:01:01'],
    [24 * 3_600_000, '24:00:00'],
  ])('%d ms -> %s', (ms, text) => {
    expect(formatCountdown(ms)).toBe(text);
  });
});

describe('timer choices', () => {
  it('only offers sane values', () => {
    expect(ALLOWED_EXPIRY_MINUTES).toEqual([15, 60, 360, 1440]);
    expect(EXPIRY_CHOICES[0].minutes).toBeNull(); // "Never" is the first, default choice
  });
});

describe('parseMemberLimit (the host types any number)', () => {
  it('treats an empty field as no limit', () => {
    expect(parseMemberLimit('')).toEqual({ value: null, error: null });
    expect(parseMemberLimit('   ')).toEqual({ value: null, error: null });
  });

  it.each(['1', '2', '7', '100', '101', '5000', '1000000'])('accepts %s with no preset list or cap', text => {
    expect(parseMemberLimit(text)).toEqual({ value: Number(text), error: null });
  });

  it('trims spaces', () => {
    expect(parseMemberLimit('  42 ').value).toBe(42);
  });

  it.each(['0', '-3', '2.5', '1e3', 'ten', '5 people', '+4', '٣'])('rejects %s with a message', text => {
    const r = parseMemberLimit(text);
    expect(r.value).toBeNull();
    expect(r.error).toBeTruthy();
  });

  it('only stops at what the database integer can store', () => {
    expect(parseMemberLimit(String(MAX_MEMBERS)).value).toBe(MAX_MEMBERS);
    expect(parseMemberLimit(String(MAX_MEMBERS + 1)).error).toMatch(/too large/);
    expect(parseMemberLimit('99999999999999999999').error).toMatch(/too large/);
  });
});
