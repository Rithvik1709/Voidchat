-- Add creator_id column to groups table
ALTER TABLE public.groups
ADD COLUMN creator_id text;

-- Create index for faster queries by creator_id
CREATE INDEX idx_groups_creator_id ON public.groups(creator_id);
