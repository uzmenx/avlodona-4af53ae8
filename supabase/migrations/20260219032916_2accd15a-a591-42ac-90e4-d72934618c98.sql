
-- Post mentions table
CREATE TABLE public.post_mentions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  mentioned_user_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Unique constraint to prevent duplicate mentions
CREATE UNIQUE INDEX idx_post_mentions_unique ON public.post_mentions(post_id, mentioned_user_id);

ALTER TABLE public.post_mentions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Mentions viewable by everyone" ON public.post_mentions FOR SELECT USING (true);
CREATE POLICY "Post author can add mentions" ON public.post_mentions FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.posts WHERE id = post_id AND user_id = auth.uid())
);
CREATE POLICY "Post author can delete mentions" ON public.post_mentions FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.posts WHERE id = post_id AND user_id = auth.uid())
);

-- Post collabs table
CREATE TABLE public.post_collabs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_post_collabs_unique ON public.post_collabs(post_id, user_id);

ALTER TABLE public.post_collabs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Collabs viewable by everyone" ON public.post_collabs FOR SELECT USING (true);
CREATE POLICY "Post author can add collabs" ON public.post_collabs FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.posts WHERE id = post_id AND user_id = auth.uid())
);
CREATE POLICY "Collab user can update status" ON public.post_collabs FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Post author can delete collabs" ON public.post_collabs FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.posts WHERE id = post_id AND user_id = auth.uid())
);

-- Enable realtime for collabs (for live accept/reject)
ALTER PUBLICATION supabase_realtime ADD TABLE public.post_collabs;
