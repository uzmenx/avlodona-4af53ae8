-- ============================================================
-- Reactions Feature Migration
-- Run this SQL in your Supabase SQL Editor or dashboard
-- ============================================================

-- 1. post_reactions table
CREATE TABLE IF NOT EXISTS public.post_reactions (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id     UUID REFERENCES public.posts(id) ON DELETE CASCADE NOT NULL,
  user_id     UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  emoji       TEXT NOT NULL,
  created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  UNIQUE (post_id, user_id)          -- each user can have ONE active reaction per post
);

CREATE INDEX IF NOT EXISTS idx_post_reactions_post_id
  ON public.post_reactions (post_id);

-- RLS
ALTER TABLE public.post_reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view reactions"
  ON public.post_reactions FOR SELECT USING (true);

CREATE POLICY "Authenticated users can react"
  ON public.post_reactions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own reaction"
  ON public.post_reactions FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can remove their own reaction"
  ON public.post_reactions FOR DELETE
  USING (auth.uid() = user_id);


-- 2. group_message_reactions table
CREATE TABLE IF NOT EXISTS public.group_message_reactions (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  message_id  UUID REFERENCES public.group_messages(id) ON DELETE CASCADE NOT NULL,
  user_id     UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  emoji       TEXT NOT NULL,
  created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  UNIQUE (message_id, user_id)       -- each user can have ONE active reaction per message
);

CREATE INDEX IF NOT EXISTS idx_gm_reactions_message_id
  ON public.group_message_reactions (message_id);

-- RLS
ALTER TABLE public.group_message_reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view message reactions"
  ON public.group_message_reactions FOR SELECT USING (true);

CREATE POLICY "Authenticated users can react to messages"
  ON public.group_message_reactions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own message reaction"
  ON public.group_message_reactions FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can remove their own message reaction"
  ON public.group_message_reactions FOR DELETE
  USING (auth.uid() = user_id);

-- 3. group_message_comments table
CREATE TABLE IF NOT EXISTS public.group_message_comments (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  message_id  UUID REFERENCES public.group_messages(id) ON DELETE CASCADE NOT NULL,
  user_id     UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  content     TEXT NOT NULL,
  created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_gm_comments_message_id
  ON public.group_message_comments (message_id);

-- RLS
ALTER TABLE public.group_message_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view message comments"
  ON public.group_message_comments FOR SELECT USING (true);

CREATE POLICY "Authenticated users can comment"
  ON public.group_message_comments FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own comment"
  ON public.group_message_comments FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own comment"
  ON public.group_message_comments FOR DELETE
  USING (auth.uid() = user_id);

-- Add comments_count to group_messages for performance
ALTER TABLE public.group_messages ADD COLUMN IF NOT EXISTS comments_count INTEGER DEFAULT 0 NOT NULL;

-- 4. message_reactions table (for 1-on-1 private chats)
CREATE TABLE IF NOT EXISTS public.message_reactions (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  message_id  UUID REFERENCES public.messages(id) ON DELETE CASCADE NOT NULL,
  user_id     UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  emoji       TEXT NOT NULL,
  created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  UNIQUE (message_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_msg_reactions_message_id
  ON public.message_reactions (message_id);

-- RLS
ALTER TABLE public.message_reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone in chat can view message reactions"
  ON public.message_reactions FOR SELECT USING (true);

CREATE POLICY "Authenticated users can react to private messages"
  ON public.message_reactions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own private message reaction"
  ON public.message_reactions FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can remove their own private message reaction"
  ON public.message_reactions FOR DELETE
  USING (auth.uid() = user_id);
