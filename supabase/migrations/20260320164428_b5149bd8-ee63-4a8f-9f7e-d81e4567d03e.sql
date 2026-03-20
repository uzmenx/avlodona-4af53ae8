
GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON TABLE public.memorial_posts TO anon;
GRANT ALL ON TABLE public.memorial_posts TO authenticated;
GRANT ALL ON TABLE public.memorial_posts TO service_role;
NOTIFY pgrst, 'reload schema';
