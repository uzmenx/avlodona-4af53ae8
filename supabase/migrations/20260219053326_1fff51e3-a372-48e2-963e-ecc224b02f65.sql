-- Add last_seen column to profiles
ALTER TABLE public.profiles ADD COLUMN last_seen timestamp with time zone DEFAULT now();

-- Create index for quick lookups
CREATE INDEX idx_profiles_last_seen ON public.profiles(last_seen);

-- Initialize last_seen with updated_at for existing rows
UPDATE public.profiles SET last_seen = updated_at WHERE last_seen IS NULL;