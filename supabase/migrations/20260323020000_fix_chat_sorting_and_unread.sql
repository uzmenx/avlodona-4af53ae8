-- Migration: 20260323020000_fix_chat_sorting_and_unread.sql

-- Add last_message_at and last_message_content to group_chats
ALTER TABLE public.group_chats 
ADD COLUMN IF NOT EXISTS last_message_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS last_message_content TEXT;

-- Add last_read_at to group_members
ALTER TABLE public.group_members
ADD COLUMN IF NOT EXISTS last_read_at TIMESTAMP WITH TIME ZONE;

-- For new memberships going forward
ALTER TABLE public.group_members
ALTER COLUMN last_read_at SET DEFAULT now();

-- Create function to update group_chats on new message
CREATE OR REPLACE FUNCTION public.update_group_chat_last_message()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.group_chats
  SET 
    last_message_at = NEW.created_at,
    last_message_content = NEW.content,
    updated_at = now()
  WHERE id = NEW.group_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger
DROP TRIGGER IF EXISTS trigger_update_group_chat_last_message ON public.group_messages;
CREATE TRIGGER trigger_update_group_chat_last_message
AFTER INSERT ON public.group_messages
FOR EACH ROW
EXECUTE FUNCTION public.update_group_chat_last_message();

-- Initialize existing group_chats with their latest message timestamp
UPDATE public.group_chats gc
SET 
  last_message_at = COALESCE(
    (SELECT created_at FROM public.group_messages gm WHERE gm.group_id = gc.id ORDER BY gm.created_at DESC LIMIT 1),
    gc.created_at
  ),
  last_message_content = (SELECT content FROM public.group_messages gm WHERE gm.group_id = gc.id ORDER BY gm.created_at DESC LIMIT 1);

-- Initialize last_read_at for existing memberships.
-- Use joined_at as a reasonable baseline, falling back to the membership created_at.
UPDATE public.group_members gm
SET last_read_at = COALESCE(gm.last_read_at, gm.joined_at, gm.created_at);