-- Fix memorial_posts foreign key for created_by
ALTER TABLE public.memorial_posts
DROP CONSTRAINT IF EXISTS memorial_posts_created_by_fkey;

ALTER TABLE public.memorial_posts
ADD CONSTRAINT memorial_posts_created_by_fkey 
FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- Make mentioned_user_id nullable in post_mentions
-- To allow family_member_id only mentions (memorial)
ALTER TABLE public.post_mentions
ALTER COLUMN mentioned_user_id DROP NOT NULL;

-- Fix node_positions uniqueness if needed (seen in logs sometimes)
-- This is a general tree fix but good to include if we are fixing schema
-- ALTER TABLE public.node_positions
-- DROP CONSTRAINT IF EXISTS node_positions_member_id_key;
-- CREATE UNIQUE INDEX IF NOT EXISTS node_positions_member_id_owner_id_idx ON public.node_positions(member_id, owner_id);

NOTIFY pgrst, 'reload schema';
