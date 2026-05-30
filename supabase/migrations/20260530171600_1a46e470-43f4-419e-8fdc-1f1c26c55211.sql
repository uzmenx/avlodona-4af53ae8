-- Fix unfollow_history INSERT policy: was checking unfollowed_user_id instead of user_id
DROP POLICY IF EXISTS "Actor records their own unfollow" ON public.unfollow_history;
DROP POLICY IF EXISTS "Users can record unfollow events" ON public.unfollow_history;

CREATE POLICY "Actor records their own unfollow"
ON public.unfollow_history
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);