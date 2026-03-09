
-- 1. Unfollow history
CREATE TABLE public.unfollow_history (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  unfollowed_user_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
ALTER TABLE public.unfollow_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own unfollow history" ON public.unfollow_history FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own unfollow history" ON public.unfollow_history FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own unfollow history" ON public.unfollow_history FOR DELETE USING (auth.uid() = user_id);

-- 2. Blocked users
CREATE TABLE public.blocked_users (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  blocker_id uuid NOT NULL,
  blocked_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(blocker_id, blocked_id)
);
ALTER TABLE public.blocked_users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own blocks" ON public.blocked_users FOR SELECT USING (auth.uid() = blocker_id);
CREATE POLICY "Users can block" ON public.blocked_users FOR INSERT WITH CHECK (auth.uid() = blocker_id);
CREATE POLICY "Users can unblock" ON public.blocked_users FOR DELETE USING (auth.uid() = blocker_id);

-- 3. Media hashes for duplicate detection
CREATE TABLE public.media_hashes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  file_hash text NOT NULL,
  file_url text NOT NULL,
  file_size bigint,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(user_id, file_hash)
);
ALTER TABLE public.media_hashes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own hashes" ON public.media_hashes FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own hashes" ON public.media_hashes FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 4. Family events / calendar
CREATE TABLE public.family_events (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id uuid NOT NULL,
  member_id uuid REFERENCES public.family_tree_members(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  event_date date NOT NULL,
  event_type text NOT NULL DEFAULT 'custom',
  recurring boolean NOT NULL DEFAULT false,
  notify boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);
ALTER TABLE public.family_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own events" ON public.family_events FOR SELECT USING (auth.uid() = owner_id);
CREATE POLICY "Users can create events" ON public.family_events FOR INSERT WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "Users can update own events" ON public.family_events FOR UPDATE USING (auth.uid() = owner_id);
CREATE POLICY "Users can delete own events" ON public.family_events FOR DELETE USING (auth.uid() = owner_id);
