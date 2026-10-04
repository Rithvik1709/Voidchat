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
