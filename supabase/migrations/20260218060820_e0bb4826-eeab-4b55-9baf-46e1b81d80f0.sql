
-- Add ring_id column to stories table for custom ring colors
ALTER TABLE public.stories ADD COLUMN ring_id text NOT NULL DEFAULT 'default';
