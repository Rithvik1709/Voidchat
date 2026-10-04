-- =====================================================================================
-- All room features in one script: timer / member limit / password, one-time invites, burn mode.
-- Paste into the Supabase SQL editor and run once. Safe to run again.
-- (security_hardening.sql is separate and should be run LAST, after adding the service-role key.)
-- =====================================================================================

-- ---------- room_options.sql ----------
-- =====================================================================================
-- Room options: auto-close timer, member limit, password flag
--
-- Run in the Supabase SQL editor. Safe to run more than once.
-- Until it is run, rooms can still be created without options; asking for a timer, member
-- limit or password returns a clear "database needs migration" error instead.
-- =====================================================================================

alter table public.groups add column if not exists expires_at timestamptz;
alter table public.groups add column if not exists max_members integer;

-- The host chooses any member limit they like; the only rule is "at least one person".
-- (An earlier version of this file capped it at 100. Drop that constraint if it exists.)
alter table public.groups drop constraint if exists groups_max_members_check;
alter table public.groups add constraint groups_max_members_check
  check (max_members is null or max_members >= 1);
alter table public.groups add column if not exists has_password boolean not null default false;

-- Atomic join: only increments when the room still has space, so two people cannot both take
-- the last seat.
create or replace function public.try_join_group(group_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  joined boolean;
begin
  update public.groups
     set active_user_count = coalesce(active_user_count, 0) + 1,
         last_active_at = now()
   where id = group_id
     and (max_members is null or coalesce(active_user_count, 0) < max_members)
  returning true into joined;

  return coalesce(joined, false);
end;
$$;

revoke execute on function public.try_join_group(uuid) from public, anon, authenticated;
grant execute on function public.try_join_group(uuid) to service_role;

create index if not exists idx_groups_expires_at on public.groups (expires_at) where expires_at is not null;

-- ---------- invites.sql ----------
-- =====================================================================================
-- One-time invite links
--
-- Run in the Supabase SQL editor. Safe to run more than once.
--
-- An invite link carries only a one-time token (never the room key). The server stores a hash
-- of that token. When someone claims the invite, the server records their public key and a
-- proof that they hold the token; the person who made the invite then sends the room key,
-- encrypted to that public key, through this table. The server never sees the room key.
-- =====================================================================================

create table if not exists public.group_invites (
  id          uuid primary key default gen_random_uuid(),
  group_id    uuid not null references public.groups(id) on delete cascade,
  token_hash  text not null,
  status      text not null default 'unused' check (status in ('unused', 'claimed', 'used')),
  created_at  timestamptz not null default now(),
  claimed_at  timestamptz,
  claim_pub   jsonb,   -- the joiner's public key (public data)
  claim_mac   text,    -- HMAC(token, public key): shows the claimer really holds the token
  delivery    jsonb,   -- the room key encrypted to claim_pub; opaque to the server
  used_at     timestamptz,
  unique (group_id, token_hash)
);

create index if not exists idx_group_invites_group on public.group_invites (group_id, status);

-- Only the server (service_role) touches this table. No policies = no public access.
alter table public.group_invites enable row level security;

-- Rooms can be "invite only": the app never offers a reusable link for them.
alter table public.groups add column if not exists invite_only boolean not null default false;

-- ---------- burn_mode.sql ----------
-- =====================================================================================
-- Burn mode: messages vanish a fixed number of seconds after they appear
--
-- Run in the Supabase SQL editor. Safe to run more than once.
-- Until it is run, creating a room with burn mode returns a clear "database needs migration"
-- error; everything else keeps working.
-- =====================================================================================

alter table public.groups add column if not exists burn_seconds integer;

-- At least 5 seconds (the sand animation needs a moment); no upper cap beyond the integer type.
alter table public.groups drop constraint if exists groups_burn_seconds_check;
alter table public.groups add constraint groups_burn_seconds_check
  check (burn_seconds is null or burn_seconds >= 5);

