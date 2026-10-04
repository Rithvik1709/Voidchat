import type { FakeSupabase } from './fakeSupabase';

export const MEDIA = 'http://localhost:54321/storage/v1/object/public/chat-images/';

export function jsonRequest(url: string, method: string, body?: unknown, headers: Record<string, string> = {}) {
  return new Request(`http://localhost${url}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

export const params = (groupId: string) => ({ params: Promise.resolve({ groupId }) });

let ipCounter = 0;
/** A fresh client address so per-IP rate limits never leak between tests. */
export const freshIp = () => ({ 'x-forwarded-for': `10.0.${Math.floor(++ipCounter / 250)}.${ipCounter % 250}` });

export async function getDb(): Promise<FakeSupabase> {
  const mod = (await import('@/lib/server/supabaseAdmin')) as unknown as { supabaseAdmin: FakeSupabase };
  return mod.supabaseAdmin;
}
