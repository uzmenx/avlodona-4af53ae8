DROP POLICY IF EXISTS "Users view own or own-post views" ON public.post_views;
CREATE POLICY "Anyone authenticated can view post views"
  ON public.post_views FOR SELECT
  TO authenticated
  USING (true);