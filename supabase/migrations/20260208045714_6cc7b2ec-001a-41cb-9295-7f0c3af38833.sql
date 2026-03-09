-- Add merged_into column to track merges WITHOUT destroying relation_type
ALTER TABLE public.family_tree_members 
ADD COLUMN IF NOT EXISTS merged_into UUID REFERENCES public.family_tree_members(id);

-- Create index for faster merged lookups
CREATE INDEX IF NOT EXISTS idx_family_tree_members_merged_into 
ON public.family_tree_members(merged_into) WHERE merged_into IS NOT NULL;

-- Fix broken records: restore relation_type for merged records
-- First, get all records with merged_into_X relation_type and extract the target ID
-- This is a cleanup migration