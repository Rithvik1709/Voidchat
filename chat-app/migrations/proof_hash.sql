-- =====================================================================================
-- Room proof column (the safe, additive first step of the security hardening)
--
-- Run in the Supabase SQL editor, or push with `supabase db push`. Safe to run more than once.
--
-- The server stores a hash of a "proof" of each room's key here, so it can check that a caller
-- really knows the key (to end a room, join, upload, verify a room password) without ever
-- storing the key itself. Without this column rooms still work, but password rooms cannot
-- say "Wrong password" and the server cannot tell members from outsiders.
--
-- It only ADDS a nullable column: no data changes, nothing breaks, and no service-role key is
-- needed. The rest of the hardening (row-level security, locking the join/leave functions,
-- wiping stored keys) stays in security_hardening.sql, which must wait until the server has
-- SUPABASE_SERVICE_ROLE_KEY.
-- =====================================================================================

alter table public.groups add column if not exists proof_hash text;
