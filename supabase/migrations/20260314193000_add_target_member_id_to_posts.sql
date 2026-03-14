-- Add target_member_id to link posts to family tree members
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS target_member_id UUID REFERENCES public.family_tree_members(id) ON DELETE CASCADE;

-- Add visibility to control post display
-- 'public': visible in main feed and creator profile
-- 'profile': visible ONLY in the target member/memorial profile view
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS visibility TEXT NOT NULL DEFAULT 'public';

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_posts_target_member_id ON public.posts(target_member_id);
CREATE INDEX IF NOT EXISTS idx_posts_visibility ON public.posts(visibility);

-- Add comment explaining visibility values
COMMENT ON COLUMN public.posts.visibility IS 'public: visible in main feed; profile: visible only on family member profile';
