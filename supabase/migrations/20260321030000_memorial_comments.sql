-- Add comments_count to memorial_posts
ALTER TABLE public.memorial_posts
  ADD COLUMN IF NOT EXISTS comments_count INTEGER DEFAULT 0;

-- Memorial post comments
CREATE TABLE IF NOT EXISTS public.memorial_post_comments (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  memorial_post_id uuid NOT NULL REFERENCES public.memorial_posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content text NOT NULL,
  parent_id uuid REFERENCES public.memorial_post_comments(id) ON DELETE CASCADE,
  likes_count INTEGER DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Memorial post comment likes
CREATE TABLE IF NOT EXISTS public.memorial_post_comment_likes (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  comment_id uuid NOT NULL REFERENCES public.memorial_post_comments(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(comment_id, user_id)
);

ALTER TABLE public.memorial_post_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.memorial_post_comment_likes ENABLE ROW LEVEL SECURITY;

-- Policies for comments
CREATE POLICY "Anyone can view memorial post comments"
ON public.memorial_post_comments FOR SELECT USING (true);

CREATE POLICY "Authenticated users can comment on memorial posts"
ON public.memorial_post_comments FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own memorial post comments"
ON public.memorial_post_comments FOR DELETE
USING (auth.uid() = user_id);

-- Policies for comment likes
CREATE POLICY "Anyone can view memorial post comment likes"
ON public.memorial_post_comment_likes FOR SELECT USING (true);

CREATE POLICY "Authenticated users can like memorial post comments"
ON public.memorial_post_comment_likes FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can unlike memorial post comments"
ON public.memorial_post_comment_likes FOR DELETE
USING (auth.uid() = user_id);

-- Trigger: update comments_count on memorial_posts
CREATE OR REPLACE FUNCTION public.update_memorial_post_comments_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.memorial_posts SET comments_count = COALESCE(comments_count, 0) + 1 WHERE id = NEW.memorial_post_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.memorial_posts SET comments_count = GREATEST(COALESCE(comments_count, 0) - 1, 0) WHERE id = OLD.memorial_post_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_memorial_post_comment_change
AFTER INSERT OR DELETE ON public.memorial_post_comments
FOR EACH ROW EXECUTE FUNCTION public.update_memorial_post_comments_count();

-- Grant access
GRANT ALL ON TABLE public.memorial_post_comments TO authenticated;
GRANT ALL ON TABLE public.memorial_post_comment_likes TO authenticated;
GRANT ALL ON TABLE public.memorial_post_comments TO anon;
GRANT ALL ON TABLE public.memorial_post_comment_likes TO anon;

NOTIFY pgrst, 'reload schema';
