CREATE TABLE public.groups (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  tags text[] DEFAULT '{}'::text[],
  key text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  active_user_count integer DEFAULT 0,
  last_active_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT groups_pkey PRIMARY KEY (id)
);

CREATE TABLE public.site_visits (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  visited_at timestamp with time zone DEFAULT now(),
  page text DEFAULT '/'::text,
  visitor_id uuid,
  CONSTRAINT site_visits_pkey PRIMARY KEY (id)
);

-- RPC: Increment active users
CREATE OR REPLACE FUNCTION public.increment_active_users(group_id uuid)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE public.groups
  SET active_user_count = COALESCE(active_user_count, 0) + 1,
      last_active_at = now()
  WHERE id = group_id;
END;
$$;

-- RPC: Decrement active users and delete if empty
CREATE OR REPLACE FUNCTION public.decrement_active_users(group_id uuid)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  new_count integer;
BEGIN
  UPDATE public.groups
  SET active_user_count = GREATEST(COALESCE(active_user_count, 0) - 1, 0),
      last_active_at = now()
  WHERE id = group_id
  RETURNING active_user_count INTO new_count;

  IF new_count IS NOT NULL AND new_count <= 0 THEN
    DELETE FROM public.groups WHERE id = group_id;
  END IF;
END;
$$;