-- Fix RLS for incoming unfollow history
-- We store: user_id = owner of history (the user who was unfollowed)
--           unfollowed_user_id = actor who unfollowed
-- So INSERT must be allowed when auth.uid() = unfollowed_user_id.

ALTER TABLE public.unfollow_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can insert own unfollow history" ON public.unfollow_history;

CREATE POLICY "Users can record unfollow events"
ON public.unfollow_history
FOR INSERT
WITH CHECK (auth.uid() = unfollowed_user_id);
