
CREATE TABLE public.tree_posts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT DEFAULT 'Yangi daraxt',
  tree_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  positions_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  overlays JSONB NOT NULL DEFAULT '[]'::jsonb,
  caption TEXT,
  is_published BOOLEAN NOT NULL DEFAULT false,
  is_personal BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.tree_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own tree posts" ON public.tree_posts
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can view published tree posts" ON public.tree_posts
  FOR SELECT USING (is_published = true);

CREATE POLICY "Users can insert own tree posts" ON public.tree_posts
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own tree posts" ON public.tree_posts
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own non-personal tree posts" ON public.tree_posts
  FOR DELETE USING (auth.uid() = user_id AND is_personal = false);
