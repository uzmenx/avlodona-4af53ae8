-- Add cover_url column to family_tree_members for custom cover images
ALTER TABLE public.family_tree_members 
ADD COLUMN IF NOT EXISTS cover_url TEXT;
