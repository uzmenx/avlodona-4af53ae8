
-- Memorial posts table
CREATE TABLE public.memorial_posts (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  family_member_id uuid REFERENCES public.family_tree_members(id) ON DELETE CASCADE NOT NULL,
  created_by uuid NOT NULL,
  media_url text,
  media_type text,
  caption text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.memorial_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view memorial posts"
ON public.memorial_posts FOR SELECT
USING (true);

CREATE POLICY "Authenticated users can insert"
ON public.memorial_posts FOR INSERT
WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can delete own memorial posts"
ON public.memorial_posts FOR DELETE
USING (auth.uid() = created_by);

-- Memorial media storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('memorial-media', 'memorial-media', true);

CREATE POLICY "Anyone can view memorial media"
ON storage.objects FOR SELECT
USING (bucket_id = 'memorial-media');

CREATE POLICY "Authenticated users can upload memorial media"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'memorial-media' AND auth.uid() IS NOT NULL);
