import { describe, expect, it } from 'vitest';
import { buildReport, routePattern, scrub } from '@/lib/monitor';

const UUID = '3f2b1c4e-9a7d-4e21-8b6a-0c5d9e1f2a34';
const JWK = '{"alg":"A256GCM","ext":true,"k":"Zm9vYmFyYmF6cXV4MTIzNDU2Nzg5MGFiY2RlZmdoaWo","kty":"oct"}';

describe('scrub', () => {
  it('removes room keys from URLs and JSON', () => {
    expect(scrub(`failed at https://x.app/chat/abc#key=${encodeURIComponent(JWK)}`)).not.toMatch(/Zm9v|%22k%22/);
    expect(scrub(`bad key ${JWK}`)).not.toContain('Zm9vYmFy');
    expect(scrub('{"k":"secretvalue","kty":"oct"}')).toBe('{"k":"[removed]","kty":"oct"}');
    expect(scrub('?key=supersecretvalue&x=1')).toBe('key=[removed]&x=1');
  });

  it('hides room ids and long token-like strings', () => {
    expect(scrub(`room ${UUID} broke`)).toBe('room [id] broke');
    expect(scrub(`token ${'A'.repeat(60)}`)).toBe('token [redacted]');
  });

  it('leaves ordinary messages alone', () => {
    expect(scrub('TypeError: x is not a function')).toBe('TypeError: x is not a function');
  });
});

describe('routePattern', () => {
  it('never reports room ids, queries or hashes', () => {
    expect(routePattern(`/chat/${UUID}`)).toBe('/chat/[id]');
    expect(routePattern(`/chat/${UUID}?x=1#key=abc`)).toBe('/chat/[id]');
    expect(routePattern('/groups')).toBe('/groups');
  });
});

describe('buildReport', () => {
  it('caps lengths and scrubs message, stack and path', () => {
    const err = new Error(`boom ${UUID} ${'x'.repeat(2000)}`);
    const r = buildReport(err, 'ctx', `/chat/${UUID}`);
    expect(r.message.length).toBeLessThanOrEqual(300);
    expect(r.stack.length).toBeLessThanOrEqual(1500);
    expect(r.message).not.toContain(UUID);
    expect(r.path).toBe('/chat/[id]');
    expect(r.context).toBe('ctx');
  });

  it('copes with non-Error values', () => {
    expect(buildReport('plain string', 'c', '/').message).toBe('plain string');
    expect(buildReport({ weird: true }, 'c', '/').message).toBe('Unknown error');
  });
});
