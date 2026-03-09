-- Create enum for group/channel type
CREATE TYPE public.chat_type AS ENUM ('group', 'channel');
CREATE TYPE public.chat_visibility AS ENUM ('public', 'private');

-- Create groups/channels table
CREATE TABLE public.group_chats (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  avatar_url TEXT,
  type chat_type NOT NULL DEFAULT 'group',
  visibility chat_visibility NOT NULL DEFAULT 'private',
  invite_link TEXT UNIQUE,
  owner_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create members table
CREATE TABLE public.group_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id UUID NOT NULL REFERENCES public.group_chats(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  role TEXT NOT NULL DEFAULT 'member',
  joined_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(group_id, user_id)
);

-- Create group messages table
CREATE TABLE public.group_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id UUID NOT NULL REFERENCES public.group_chats(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL,
  content TEXT NOT NULL,
  media_url TEXT,
  media_type TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.group_chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_messages ENABLE ROW LEVEL SECURITY;

-- RLS Policies for group_chats
CREATE POLICY "Public groups are viewable by everyone"
ON public.group_chats FOR SELECT
USING (visibility = 'public' OR owner_id = auth.uid() OR EXISTS (
  SELECT 1 FROM public.group_members WHERE group_id = group_chats.id AND user_id = auth.uid()
));

CREATE POLICY "Users can create groups"
ON public.group_chats FOR INSERT
WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Owners can update their groups"
ON public.group_chats FOR UPDATE
USING (auth.uid() = owner_id);

CREATE POLICY "Owners can delete their groups"
ON public.group_chats FOR DELETE
USING (auth.uid() = owner_id);

-- RLS Policies for group_members
CREATE POLICY "Members are viewable by group members"
ON public.group_members FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.group_members gm WHERE gm.group_id = group_members.group_id AND gm.user_id = auth.uid()
) OR EXISTS (
  SELECT 1 FROM public.group_chats gc WHERE gc.id = group_members.group_id AND gc.owner_id = auth.uid()
));

CREATE POLICY "Owners and admins can add members"
ON public.group_members FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM public.group_chats gc WHERE gc.id = group_id AND gc.owner_id = auth.uid()
) OR EXISTS (
  SELECT 1 FROM public.group_members gm WHERE gm.group_id = group_id AND gm.user_id = auth.uid() AND gm.role = 'admin'
));

CREATE POLICY "Owners can remove members"
ON public.group_members FOR DELETE
USING (EXISTS (
  SELECT 1 FROM public.group_chats gc WHERE gc.id = group_id AND gc.owner_id = auth.uid()
) OR user_id = auth.uid());

-- RLS Policies for group_messages
CREATE POLICY "Messages viewable by members"
ON public.group_messages FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.group_members gm WHERE gm.group_id = group_messages.group_id AND gm.user_id = auth.uid()
) OR EXISTS (
  SELECT 1 FROM public.group_chats gc WHERE gc.id = group_messages.group_id AND gc.owner_id = auth.uid()
));

CREATE POLICY "Members can send messages"
ON public.group_messages FOR INSERT
WITH CHECK (
  auth.uid() = sender_id AND (
    EXISTS (SELECT 1 FROM public.group_members gm WHERE gm.group_id = group_id AND gm.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.group_chats gc WHERE gc.id = group_id AND gc.owner_id = auth.uid())
  )
);

CREATE POLICY "Senders can update their messages"
ON public.group_messages FOR UPDATE
USING (auth.uid() = sender_id);

CREATE POLICY "Senders and owners can delete messages"
ON public.group_messages FOR DELETE
USING (auth.uid() = sender_id OR EXISTS (
  SELECT 1 FROM public.group_chats gc WHERE gc.id = group_id AND gc.owner_id = auth.uid()
));

-- Create storage bucket for group avatars
INSERT INTO storage.buckets (id, name, public) VALUES ('group-avatars', 'group-avatars', true);

CREATE POLICY "Anyone can view group avatars"
ON storage.objects FOR SELECT
USING (bucket_id = 'group-avatars');

CREATE POLICY "Authenticated users can upload group avatars"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'group-avatars' AND auth.role() = 'authenticated');

CREATE POLICY "Users can update their uploads"
ON storage.objects FOR UPDATE
USING (bucket_id = 'group-avatars' AND auth.role() = 'authenticated');

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.group_messages;

-- Trigger for updated_at
CREATE TRIGGER update_group_chats_updated_at
BEFORE UPDATE ON public.group_chats
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_group_messages_updated_at
BEFORE UPDATE ON public.group_messages
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();