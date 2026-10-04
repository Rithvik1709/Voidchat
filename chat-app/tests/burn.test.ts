import { describe, expect, it } from 'vitest';
import { dueIds, mediaPathFromUrl, trackMessages } from '@/lib/burn';
import {
  EDGE, MAX_GRAINS, SWEEP_MS, frontX, grainAlpha, spawnGrains, stepGrains, sweepProgress, type Box,
} from '@/lib/sand';
import { describeBurn, parseBurnSeconds } from '@/lib/roomOptions';
import { MEDIA } from './helpers/api';

describe('burn timing', () => {
  it('starts the clock when a message first appears and keeps it', () => {
    const seen = new Map<string, number>();
    trackMessages(seen, ['a', 'b'], 1000);
    trackMessages(seen, ['a', 'b', 'c'], 5000);
    expect(seen.get('a')).toBe(1000);
    expect(seen.get('c')).toBe(5000);
  });

  it('forgets messages that are gone, so the map cannot grow forever', () => {
    const seen = new Map<string, number>();
    trackMessages(seen, ['a', 'b'], 0);
    trackMessages(seen, ['b'], 10);
    expect([...seen.keys()]).toEqual(['b']);
  });

  it('burns a message exactly when it is old enough, and only once', () => {
    const seen = new Map<string, number>();
    trackMessages(seen, ['old', 'young'], 0);
    trackMessages(seen, ['old', 'young', 'new'], 20_000);
    const burning = new Set<string>();
    expect(dueIds(seen, burning, 29_999, 30_000)).toEqual([]);
    expect(dueIds(seen, burning, 30_000, 30_000).sort()).toEqual(['old', 'young']);
    burning.add('old');
    expect(dueIds(seen, burning, 30_000, 30_000)).toEqual(['young']);
    expect(dueIds(seen, burning, 50_000, 30_000).sort()).toEqual(['new', 'young']);
  });

  it('works for any duration', () => {
    const seen = new Map([['m', 0]]);
    expect(dueIds(seen, new Set(), 4_999, 5_000)).toEqual([]);
    expect(dueIds(seen, new Set(), 5_000, 5_000)).toEqual(['m']);
    expect(dueIds(seen, new Set(), 3_599_999, 3_600_000)).toEqual([]);
  });
});

describe('mediaPathFromUrl (which file to delete after an image burns)', () => {
  const room = '11111111-1111-1111-1111-111111111111';
  const file = `${room}/1700000000000-3f2b1c4e-9a7d-4e21-8b6a-0c5d9e1f2a34.png`;

  it('returns the storage path for a file in this room', () => {
    expect(mediaPathFromUrl(`${MEDIA}${file}`, room, MEDIA)).toBe(file);
  });

  it('refuses anything else: other rooms, other hosts, odd names', () => {
    expect(mediaPathFromUrl(`${MEDIA}22222222-2222-2222-2222-222222222222/1-3f2b1c4e-9a7d-4e21-8b6a-0c5d9e1f2a34.png`, room, MEDIA)).toBeNull();
    expect(mediaPathFromUrl(`https://evil.example/${file}`, room, MEDIA)).toBeNull();
    expect(mediaPathFromUrl(`${MEDIA}${room}/../secret.png`, room, MEDIA)).toBeNull();
    expect(mediaPathFromUrl(`${MEDIA}${room}/x.svg`, room, MEDIA)).toBeNull();
    expect(mediaPathFromUrl(undefined, room, MEDIA)).toBeNull();
  });
});

describe('sand physics', () => {
  const box: Box = { x: 100, y: 50, w: 300, h: 40 };
  const seq = (...values: number[]) => { let i = 0; return () => values[i++ % values.length]; };

  it('sweeps from 0 to 1 over the sweep time and stays clamped', () => {
    expect(sweepProgress(-50)).toBe(0);
    expect(sweepProgress(0)).toBe(0);
    expect(sweepProgress(SWEEP_MS / 2)).toBeCloseTo(0.5, 5);
    expect(sweepProgress(SWEEP_MS)).toBe(1);
    expect(sweepProgress(SWEEP_MS * 5)).toBe(1);
    expect(sweepProgress(SWEEP_MS * 0.25)).toBeLessThan(0.25); // eased in
  });

  it('puts the front on the wind side first', () => {
    expect(frontX(box, 0, 1)).toBe(100);
    expect(frontX(box, 1, 1)).toBe(400);
    expect(frontX(box, 0, -1)).toBe(400);
    expect(frontX(box, 1, -1)).toBe(100);
  });

  it('sheds grains along the front, inside the message box', () => {
    const grains = spawnGrains(box, 250, 500, 1, 3);
    expect(grains).toHaveLength(500);
    for (const g of grains) {
      expect(g.x).toBeGreaterThanOrEqual(box.x);
      expect(g.x).toBeLessThanOrEqual(box.x + box.w);
      expect(g.x).toBeGreaterThanOrEqual(250 - box.w * EDGE);
      expect(g.x).toBeLessThanOrEqual(250 + box.w * EDGE);
      expect(g.y).toBeGreaterThanOrEqual(box.y);
      expect(g.y).toBeLessThanOrEqual(box.y + box.h);
      expect(g.tone).toBeLessThan(3);
    }
  });

  it('blows grains the way the wind goes', () => {
    const right = spawnGrains(box, 250, 50, 1, 2);
    const left = spawnGrains(box, 250, 50, -1, 2);
    expect(right.every(g => g.vx > 0)).toBe(true);
    expect(left.every(g => g.vx < 0)).toBe(true);
    const moved = stepGrains(right, 0.1, 1);
    moved.forEach((g, i) => expect(g.x).toBeGreaterThan(right[i].x));
    const movedLeft = stepGrains(left, 0.1, -1);
    movedLeft.forEach((g, i) => expect(g.x).toBeLessThan(left[i].x));
  });

  it('pulls grains down over time', () => {
    const [g] = spawnGrains(box, 250, 1, 1, 1, seq(0.5));
    const later = stepGrains([g], 0.5, 1)[0];
    expect(later.vy).toBeGreaterThan(g.vy);
  });

  it('drops grains once their life is over, and fades them as they go', () => {
    const [g] = spawnGrains(box, 250, 1, 1, 1, seq(0.5));
    expect(grainAlpha(g)).toBe(1);
    const old = stepGrains([g], g.life * 0.9, 1)[0];
    expect(grainAlpha(old)).toBeLessThan(0.4);
    expect(stepGrains([g], g.life + 0.01, 1)).toEqual([]);
  });

  it('keeps the grain budget sane', () => {
    expect(MAX_GRAINS).toBeGreaterThan(300);
    expect(MAX_GRAINS).toBeLessThanOrEqual(3000);
  });
});

describe('parseBurnSeconds', () => {
  it.each(['5', '30', '90', '3600', '86400', '1000000'])('accepts %s', text => {
    expect(parseBurnSeconds(text)).toEqual({ value: Number(text), error: null });
  });

  it.each(['', '  ', '4', '0', '-30', '2.5', '30s', 'abc', '1e2'])('rejects %j', text => {
    const r = parseBurnSeconds(text);
    expect(r.value).toBeNull();
    expect(r.error).toBeTruthy();
  });

  it('only stops at the database limit', () => {
    expect(parseBurnSeconds('2147483647').value).toBe(2_147_483_647);
    expect(parseBurnSeconds('2147483648').error).toMatch(/too large/);
  });
});

describe('describeBurn', () => {
  it.each([[5, '5s'], [30, '30s'], [60, '1m'], [90, '1.5m'], [600, '10m'], [3600, '1h'], [5400, '1.5h']])('%d -> %s', (s, text) => {
    expect(describeBurn(s)).toBe(text);
  });
});
