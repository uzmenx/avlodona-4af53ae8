
-- Story Highlights (yillar kesimida stories arxivi)
CREATE TABLE public.story_highlights (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  cover_url TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.story_highlights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Highlights viewable by everyone" ON public.story_highlights FOR SELECT USING (true);
CREATE POLICY "Users can create own highlights" ON public.story_highlights FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own highlights" ON public.story_highlights FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own highlights" ON public.story_highlights FOR DELETE USING (auth.uid() = user_id);

-- Highlight items (which stories belong to which highlight)
CREATE TABLE public.story_highlight_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  highlight_id UUID NOT NULL REFERENCES public.story_highlights(id) ON DELETE CASCADE,
  story_id UUID NOT NULL REFERENCES public.stories(id) ON DELETE CASCADE,
  media_url TEXT NOT NULL,
  media_type TEXT NOT NULL DEFAULT 'image',
  caption TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(highlight_id, story_id)
);

ALTER TABLE public.story_highlight_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Highlight items viewable by everyone" ON public.story_highlight_items FOR SELECT USING (true);
CREATE POLICY "Owners can insert highlight items" ON public.story_highlight_items FOR INSERT 
  WITH CHECK (EXISTS (SELECT 1 FROM public.story_highlights h WHERE h.id = highlight_id AND h.user_id = auth.uid()));
CREATE POLICY "Owners can delete highlight items" ON public.story_highlight_items FOR DELETE 
  USING (EXISTS (SELECT 1 FROM public.story_highlights h WHERE h.id = highlight_id AND h.user_id = auth.uid()));

-- Post Collections (foydalanuvchi yaratgan ro'yxatlar)
CREATE TABLE public.post_collections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  cover_url TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.post_collections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Collections viewable by everyone" ON public.post_collections FOR SELECT USING (true);
CREATE POLICY "Users can create own collections" ON public.post_collections FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own collections" ON public.post_collections FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own collections" ON public.post_collections FOR DELETE USING (auth.uid() = user_id);

-- Post collection items
CREATE TABLE public.post_collection_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  collection_id UUID NOT NULL REFERENCES public.post_collections(id) ON DELETE CASCADE,
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(collection_id, post_id)
);

ALTER TABLE public.post_collection_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Collection items viewable by everyone" ON public.post_collection_items FOR SELECT USING (true);
CREATE POLICY "Owners can insert collection items" ON public.post_collection_items FOR INSERT 
  WITH CHECK (EXISTS (SELECT 1 FROM public.post_collections c WHERE c.id = collection_id AND c.user_id = auth.uid()));
CREATE POLICY "Owners can delete collection items" ON public.post_collection_items FOR DELETE 
  USING (EXISTS (SELECT 1 FROM public.post_collections c WHERE c.id = collection_id AND c.user_id = auth.uid()));

-- Profile visibility settings
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS hide_highlights BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS hide_collections BOOLEAN NOT NULL DEFAULT false;
