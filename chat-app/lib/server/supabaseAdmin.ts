import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Server-only Supabase client.
 *
 * Uses SUPABASE_SERVICE_ROLE_KEY when it is configured (required once row-level security
 * is enabled, see migrations/security_hardening.sql). Falls back to the anon key so local
 * development keeps working before the service key is added.
 */
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const hasServiceRole = Boolean(serviceKey);

if (!serviceKey && process.env.NODE_ENV === 'production') {
    console.warn('SUPABASE_SERVICE_ROLE_KEY is not set: server routes are using the anon key.');
}

export const supabaseAdmin: SupabaseClient = createClient(url, serviceKey || anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
});

export const MEDIA_BUCKET = 'chat-images';
