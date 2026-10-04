import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { POST as report } from '@/app/api/monitor/error/route';
import { GET as health } from '@/app/api/health/route';
import { sendAlert } from '@/lib/server/alerts';
import { freshIp, jsonRequest } from '../helpers/api';

const UUID = '3f2b1c4e-9a7d-4e21-8b6a-0c5d9e1f2a34';

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  delete process.env.ERROR_WEBHOOK_URL;
});

describe('POST /api/monitor/error', () => {
  const send = (body: unknown, ip = freshIp()) => report(jsonRequest('/api/monitor/error', 'POST', body, ip));

  it('accepts a report, scrubs it again on the server, and logs one line', async () => {
    const res = await send({ message: `bad room ${UUID}`, stack: '#key=SECRET123', context: 'test', path: `/chat/${UUID}` });
    expect(res.status).toBe(200);
    const logged = (console.error as unknown as { mock: { calls: string[][] } }).mock.calls.map(c => c[0]).join('\n');
    expect(logged).toContain('client-error');
    expect(logged).not.toContain(UUID);
    expect(logged).not.toContain('SECRET123');
  });

  it('rejects empty, oversized and malformed reports', async () => {
    expect((await send({ stack: 'no message' })).status).toBe(400);
    expect((await send({ message: 'x'.repeat(5000) })).status).toBe(413);
    const bad = await report(new Request('http://localhost/api/monitor/error', { method: 'POST', body: '{nope', headers: freshIp() }));
    expect(bad.status).toBe(400);
  });

  it('rate-limits one address', async () => {
    const ip = freshIp();
    const statuses: number[] = [];
    for (let i = 0; i < 35; i++) statuses.push((await send({ message: `m${i}` }, ip)).status);
    expect(statuses.slice(0, 30).every(s => s === 200)).toBe(true);
    expect(statuses.slice(30).every(s => s === 429)).toBe(true);
  });

  it('forwards to the webhook only when one is configured, and suppresses repeats', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);
    expect(await sendAlert('no webhook set')).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();

    process.env.ERROR_WEBHOOK_URL = 'https://hooks.example/test';
    expect(await sendAlert('same alert', 'fp-1')).toBe(true);
    expect(await sendAlert('same alert', 'fp-1')).toBe(false); // identical alert inside 10 minutes
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const sent = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(sent.text).toBe('same alert');
    expect(sent.content).toBe('same alert'); // Discord reads `content`
  });
});

describe('GET /api/health', () => {
  it('reports operational with latency per component and no error details', async () => {
    const res = await health();
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('no-store');
    const body = await res.json();
    expect(body.status).toBe('operational');
    expect(body.checks.database.ok).toBe(true);
    expect(body.checks.storage.ok).toBe(true);
    expect(typeof body.checks.database.ms).toBe('number');
    expect(JSON.stringify(body)).not.toMatch(/error|message|stack/i);
  });
});
