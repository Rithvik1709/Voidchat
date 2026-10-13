-- =====================================================================================
-- Chat log: every message sent in a room, stored as readable text, grouped by room id
--
-- Run in the Supabase SQL editor, or push with `supabase db push`. Safe to run more than once.
--
-- The sender's browser posts each message (after encrypting and broadcasting it) to
-- /api/groups/:groupId/log, which writes one row here. Rows are NOT removed when a room ends,
-- so the log outlives the room. There is deliberately no foreign key to groups for that reason.
--
-- Row-level security is on with an insert-only policy: the public anon key can add rows (so
-- the API route works even before SUPABASE_SERVICE_ROLE_KEY is set) but nobody except the
-- service role can read them. Read a room's log in the SQL editor:
--
--   select sent_at, sender, content->>'text' as text, content
--   from public.chat_logs where group_id = '<room id>' order by sent_at;
-- =====================================================================================

create table if not exists public.chat_logs (
  id text primary key,                         -- the message id, so a retried log is not duplicated
  group_id uuid not null,
  sender text not null,
  content jsonb not null,                      -- { text, replyTo?, poll?, image?, audio? }
  sent_at timestamptz not null,                -- the sender's timestamp
  logged_at timestamptz not null default now()
);

create index if not exists chat_logs_group_sent_idx on public.chat_logs (group_id, sent_at);

alter table public.chat_logs enable row level security;

drop policy if exists "chat_logs insert only" on public.chat_logs;
create policy "chat_logs insert only" on public.chat_logs
  for insert to anon, authenticated with check (true);
