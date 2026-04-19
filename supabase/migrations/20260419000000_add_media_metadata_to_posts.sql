-- Add media_metadata column to posts table
-- This stores GIF overlay data per media item (Instagram-style animated stickers)
ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS media_metadata jsonb DEFAULT NULL;

-- Add a comment to explain the column structure
COMMENT ON COLUMN public.posts.media_metadata IS 
  'Array of metadata per media item, e.g. [{"gifOverlays": [{"id":"..","url":"..","x":50,"y":50,"scale":1,"rotation":0}]}]';
