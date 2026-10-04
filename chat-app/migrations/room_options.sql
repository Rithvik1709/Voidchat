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
