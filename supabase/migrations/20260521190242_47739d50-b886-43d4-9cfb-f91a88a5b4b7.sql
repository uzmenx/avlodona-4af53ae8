
-- 1. family_invites
DROP POLICY IF EXISTS "Authenticated users can update invite status" ON public.family_invites;

-- 2. messages realtime bypass policies
DROP POLICY IF EXISTS "Authenticated users can receive realtime messages" ON public.messages;
DROP POLICY IF EXISTS "Authenticated users can send realtime messages" ON public.messages;

-- 3. fcm_token — drop unused exposed column
ALTER TABLE public.profiles DROP COLUMN IF EXISTS fcm_token;

-- 4. unfollow_history insert policy
DROP POLICY IF EXISTS "Users can record unfollow events" ON public.unfollow_history;
CREATE POLICY "Actor records their own unfollow"
  ON public.unfollow_history FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = unfollowed_user_id);

-- 5. user_usage — remove user-facing UPDATE
DROP POLICY IF EXISTS "Users update own usage" ON public.user_usage;

-- 6. group_message_reactions — members only
DROP POLICY IF EXISTS "Anyone can view message reactions" ON public.group_message_reactions;
CREATE POLICY "Group members can view message reactions"
  ON public.group_message_reactions FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.group_messages gm
    WHERE gm.id = group_message_reactions.message_id
      AND (public.is_group_owner(auth.uid(), gm.group_id)
           OR public.is_group_member(auth.uid(), gm.group_id))
  ));

-- 7. Revoke EXECUTE on internal SECURITY DEFINER functions (triggers/cron)
REVOKE EXECUTE ON FUNCTION public.reset_daily_usage() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.cleanup_old_notifications() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.create_user_usage_on_signup() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.create_message_notification() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.handle_story_like_notification() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.update_post_comments_count() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.update_comment_likes_count() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.update_post_likes_count() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.update_memorial_post_views_count() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.update_memorial_post_likes_count() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.update_memorial_post_comments_count() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.increment_post_views() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.decrement_post_views() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.update_conversation_last_message() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.update_group_chat_last_message() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM anon, authenticated, public;

-- 8. Public bucket listing prevention — drop broad SELECT policies and add file-name-only
DO $$
DECLARE pol record;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname='storage' AND tablename='objects'
      AND (
        policyname ILIKE '%publicly accessible%'
        OR policyname ILIKE 'Public can view%'
        OR policyname ILIKE 'Anyone can view%'
      )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', pol.policyname);
  END LOOP;
END $$;

-- Public buckets are served by the Supabase CDN without RLS; blocking direct API listing is the goal.
CREATE POLICY "Block listing of avatars bucket"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars' AND false);

CREATE POLICY "Block listing of post-media bucket"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'post-media' AND false);

CREATE POLICY "Block listing of group-avatars bucket"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'group-avatars' AND false);
