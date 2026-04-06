-- Clean up orphaned post_views where the user no longer exists in auth.users
DELETE FROM public.post_views 
WHERE user_id NOT IN (SELECT id FROM auth.users);

-- Now we can safely add the foreign key constraint
ALTER TABLE public.post_views
ADD CONSTRAINT post_views_user_id_fkey 
FOREIGN KEY (user_id) 
REFERENCES auth.users(id) 
ON DELETE CASCADE;

-- Also let's fix views_count in posts table to reflect the actual count of post_views
-- This ensures the number matches the reality if some users were deleted.
UPDATE public.posts p
SET views_count = (
    SELECT count(*) 
    FROM public.post_views pv 
    WHERE pv.post_id = p.id
)
WHERE views_count != (
    SELECT count(*) 
    FROM public.post_views pv 
    WHERE pv.post_id = p.id
);

-- And also we should trigger decrease in views_count when a view is deleted 
-- (e.g. via cascade when user is deleted)
CREATE OR REPLACE FUNCTION public.decrement_post_views()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.posts SET views_count = GREATEST(COALESCE(views_count, 0) - 1, 0) WHERE id = OLD.post_id;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS on_post_view_delete ON public.post_views;
CREATE TRIGGER on_post_view_delete
AFTER DELETE ON public.post_views
FOR EACH ROW
EXECUTE FUNCTION public.decrement_post_views();
