-- =====================================================================================
-- Nullchat security hardening
--
-- ORDER MATTERS. Do these in this order, or the app will stop working:
--   1. Add SUPABASE_SERVICE_ROLE_KEY to your server environment (Vercel project settings
--      and chat-app/.env.local). Supabase Dashboard -> Project Settings -> API -> service_role.
--      NEVER prefix it with NEXT_PUBLIC_ and never commit it.
--   2. Deploy the new code.
--   3. Run this file in the Supabase SQL editor.
--
-- What it does:
--   * adds groups.proof_hash (lets the server check callers know the room key without storing it)
--   * wipes the room keys that older versions stored in the database
--   * turns on row-level security so the public (anon) key can no longer read/modify groups
--   * locks the membership RPCs to the server
--   * removes anon access to the chat-images bucket (public image URLs keep working)
-- =====================================================================================

-- 1. Proof column -------------------------------------------------------------------
-- (Also available on its own as proof_hash.sql, which is safe to run before everything else.)
alter table public.groups add column if not exists proof_hash text;

-- 2. Stop keeping room keys in the database ------------------------------------------
-- Rooms created by older versions lose their stored key. Their invite links (which carry the
-- key in the #fragment) keep working; only the "Your Groups" shortcut for those rooms is lost.
update public.groups set key = null where key is not null;

-- 3. Row-level security --------------------------------------------------------------
alter table public.groups enable row level security;
alter table public.site_visits enable row level security;

drop policy if exists "anyone can record a visit" on public.site_visits;
create policy "anyone can record a visit"
  on public.site_visits for insert
  to anon, authenticated
  with check (true);

-- Replace the e-mail below with your admin account. Left as-is, nobody gets admin access.
-- (Also disable public sign-ups in Authentication settings so nobody can create an account.)
drop policy if exists "admin reads visits" on public.site_visits;
create policy "admin reads visits"
  on public.site_visits for select
  to authenticated
  using ((auth.jwt() ->> 'email') in ('REPLACE_WITH_ADMIN_EMAIL'));

drop policy if exists "admin manages groups" on public.groups;
create policy "admin manages groups"
  on public.groups for all
  to authenticated
  using ((auth.jwt() ->> 'email') in ('REPLACE_WITH_ADMIN_EMAIL'))
  with check ((auth.jwt() ->> 'email') in ('REPLACE_WITH_ADMIN_EMAIL'));

-- The server uses the service_role key, which bypasses RLS, so it needs no policy.

-- 4. Membership RPCs: server only -----------------------------------------------------
revoke execute on function public.increment_active_users(uuid) from public, anon, authenticated;
revoke execute on function public.decrement_active_users(uuid) from public, anon, authenticated;
grant execute on function public.increment_active_users(uuid) to service_role;
grant execute on function public.decrement_active_users(uuid) to service_role;

-- 5. Storage: no anonymous listing / writing / deleting in chat-images ---------------------
-- A public bucket serves /object/public/... URLs without any policy, so images still display.
do $$
declare pol record;
begin
  for pol in
    select policyname
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and (coalesce(qual, '') ilike '%chat-images%' or coalesce(with_check, '') ilike '%chat-images%')
  loop
    execute format('drop policy %I on storage.objects', pol.policyname);
  end loop;
end $$;
