
-- Add views_count column to posts table
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS views_count INTEGER DEFAULT 0;

-- Create post_views table for unique view tracking
CREATE TABLE IF NOT EXISTS public.post_views (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(post_id, user_id)
);

ALTER TABLE public.post_views ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view post_views" ON public.post_views FOR SELECT USING (true);
CREATE POLICY "Authenticated users can insert views" ON public.post_views FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Trigger to auto-increment views_count
CREATE OR REPLACE FUNCTION public.increment_post_views()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.posts SET views_count = COALESCE(views_count, 0) + 1 WHERE id = NEW.post_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_post_view_insert
AFTER INSERT ON public.post_views
FOR EACH ROW
EXECUTE FUNCTION public.increment_post_views();
