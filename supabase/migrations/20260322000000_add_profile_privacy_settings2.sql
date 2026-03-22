-- Add privacy columns to profiles for hiding mentions and saved posts
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS hide_mentions boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS hide_saved_posts boolean NOT NULL DEFAULT false;
