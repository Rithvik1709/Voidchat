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
