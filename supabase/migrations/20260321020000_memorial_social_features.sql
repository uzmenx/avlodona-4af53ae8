-- Add likes_count and views_count to memorial_posts
ALTER TABLE public.memorial_posts
  ADD COLUMN IF NOT EXISTS likes_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS views_count INTEGER DEFAULT 0;

-- Memorial post likes
CREATE TABLE IF NOT EXISTS public.memorial_post_likes (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  memorial_post_id uuid NOT NULL REFERENCES public.memorial_posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(memorial_post_id, user_id)
);

ALTER TABLE public.memorial_post_likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view memorial post likes"
ON public.memorial_post_likes FOR SELECT USING (true);

CREATE POLICY "Authenticated users can like memorial posts"
ON public.memorial_post_likes FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can unlike memorial posts"
ON public.memorial_post_likes FOR DELETE
USING (auth.uid() = user_id);

-- Memorial post views
CREATE TABLE IF NOT EXISTS public.memorial_post_views (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  memorial_post_id uuid NOT NULL REFERENCES public.memorial_posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(memorial_post_id, user_id)
);

ALTER TABLE public.memorial_post_views ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view memorial post views"
ON public.memorial_post_views FOR SELECT USING (true);

CREATE POLICY "Authenticated users can add memorial post views"
ON public.memorial_post_views FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Memorial post saves
CREATE TABLE IF NOT EXISTS public.memorial_post_saves (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  memorial_post_id uuid NOT NULL REFERENCES public.memorial_posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(memorial_post_id, user_id)
);

ALTER TABLE public.memorial_post_saves ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own memorial post saves"
ON public.memorial_post_saves FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Authenticated users can save memorial posts"
ON public.memorial_post_saves FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can unsave memorial posts"
ON public.memorial_post_saves FOR DELETE
USING (auth.uid() = user_id);

-- Trigger: update likes_count on memorial_posts
CREATE OR REPLACE FUNCTION public.update_memorial_post_likes_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.memorial_posts SET likes_count = COALESCE(likes_count, 0) + 1 WHERE id = NEW.memorial_post_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.memorial_posts SET likes_count = GREATEST(COALESCE(likes_count, 0) - 1, 0) WHERE id = OLD.memorial_post_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_memorial_post_like_change
AFTER INSERT OR DELETE ON public.memorial_post_likes
FOR EACH ROW EXECUTE FUNCTION public.update_memorial_post_likes_count();

-- Trigger: update views_count on memorial_posts
CREATE OR REPLACE FUNCTION public.update_memorial_post_views_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.memorial_posts SET views_count = COALESCE(views_count, 0) + 1 WHERE id = NEW.memorial_post_id;
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_memorial_post_view_change
AFTER INSERT ON public.memorial_post_views
FOR EACH ROW EXECUTE FUNCTION public.update_memorial_post_views_count();

-- Grant access
GRANT ALL ON TABLE public.memorial_post_likes TO authenticated;
GRANT ALL ON TABLE public.memorial_post_views TO authenticated;
GRANT ALL ON TABLE public.memorial_post_saves TO authenticated;
GRANT ALL ON TABLE public.memorial_post_likes TO anon;
GRANT ALL ON TABLE public.memorial_post_views TO anon;
GRANT ALL ON TABLE public.memorial_post_saves TO anon;
NOTIFY pgrst, 'reload schema';
