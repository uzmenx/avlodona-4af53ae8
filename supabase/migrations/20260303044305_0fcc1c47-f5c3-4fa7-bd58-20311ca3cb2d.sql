
-- Add privacy columns to profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS is_private boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS hide_online_status boolean NOT NULL DEFAULT false;
