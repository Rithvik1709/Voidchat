import { vi } from 'vitest';

// Fake environment so modules that read Supabase config at import time load without a real project.
process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://localhost:54321';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key';

// Every server route talks to Supabase through this module; swap it for the in-memory fake.
vi.mock('@/lib/server/supabaseAdmin', async () => {
  const { FakeSupabase } = await import('./helpers/fakeSupabase');
  const db = new FakeSupabase();
  db.reset();
  return { supabaseAdmin: db, MEDIA_BUCKET: 'chat-images', hasServiceRole: true };
});
