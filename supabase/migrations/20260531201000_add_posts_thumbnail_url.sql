-- Migration: 20260531201000_add_posts_thumbnail_url.sql
-- Purpose: Add lightweight thumbnail_url for fast grid rendering (Instagram-style).

ALTER TABLE public.posts
ADD COLUMN IF NOT EXISTS thumbnail_url TEXT;

-- Optional: small index for debugging/search (not required for performance)
-- CREATE INDEX IF NOT EXISTS idx_posts_thumbnail_url ON public.posts(thumbnail_url);

