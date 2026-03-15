-- Add family_member_id column to post_mentions for memorial posts
ALTER TABLE post_mentions
ADD COLUMN IF NOT EXISTS family_member_id UUID REFERENCES family_tree_members(id) ON DELETE CASCADE;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_post_mentions_family_member_id
ON post_mentions(family_member_id)
WHERE family_member_id IS NOT NULL;
