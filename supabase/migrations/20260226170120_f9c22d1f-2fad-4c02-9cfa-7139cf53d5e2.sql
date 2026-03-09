
CREATE TABLE public.tree_post_likes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tree_post_id UUID NOT NULL REFERENCES public.tree_posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(tree_post_id, user_id)
);

ALTER TABLE public.tree_post_likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view tree post likes" ON public.tree_post_likes FOR SELECT USING (true);
CREATE POLICY "Users can like tree posts" ON public.tree_post_likes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can unlike tree posts" ON public.tree_post_likes FOR DELETE USING (auth.uid() = user_id);
