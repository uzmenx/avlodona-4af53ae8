-- Add theme index for post collections (for consistent color across users/devices)
ALTER TABLE public.post_collections
ADD COLUMN IF NOT EXISTS theme INTEGER;

-- Backfill existing rows
UPDATE public.post_collections
SET theme = COALESCE(theme, 0);

-- Enforce default + not null
ALTER TABLE public.post_collections
ALTER COLUMN theme SET DEFAULT 0;

ALTER TABLE public.post_collections
ALTER COLUMN theme SET NOT NULL;
