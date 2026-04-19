-- Add media_metadata column to stories table
-- This enables Instagram-style animated GIF overlays: GIFs are stored as JSON metadata
-- (not baked into the media file) and rendered as live HTML <img> overlays in StoryViewer.

ALTER TABLE stories
ADD COLUMN IF NOT EXISTS media_metadata jsonb DEFAULT NULL;

-- Add a comment describing the column structure for future developers
COMMENT ON COLUMN stories.media_metadata IS
  'JSON metadata for media overlays. Structure: { "gifOverlays": [{ "id", "url", "originalUrl", "x", "y", "scale", "rotation" }] }. GIFs are NOT baked into the media file – they are rendered as animated HTML images on top of the media at display time (Instagram-style).';
