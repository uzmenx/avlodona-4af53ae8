-- Migration: 20260531190000_add_conversations_last_message_fields.sql
-- Purpose: Speed up conversation list by denormalizing last message fields into conversations.

-- Add last message fields to conversations (1-to-1 chats)
ALTER TABLE public.conversations
ADD COLUMN IF NOT EXISTS last_message_content TEXT,
ADD COLUMN IF NOT EXISTS last_message_sender_id UUID,
ADD COLUMN IF NOT EXISTS last_message_status TEXT CHECK (last_message_status IN ('sent', 'delivered', 'seen'));

-- Update trigger function to keep last message fields in sync
CREATE OR REPLACE FUNCTION public.update_conversation_last_message()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.conversations
  SET
    last_message_at = NEW.created_at,
    last_message_content = NEW.content,
    last_message_sender_id = NEW.sender_id,
    last_message_status = NEW.status
  WHERE id = NEW.conversation_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Ensure trigger exists (created in initial migration, but keep idempotent)
DROP TRIGGER IF EXISTS trigger_update_conversation_last_message ON public.messages;
CREATE TRIGGER trigger_update_conversation_last_message
AFTER INSERT ON public.messages
FOR EACH ROW
EXECUTE FUNCTION public.update_conversation_last_message();

-- Backfill existing conversations with their latest message (if any)
UPDATE public.conversations c
SET
  last_message_at = COALESCE(sub.created_at, c.last_message_at, c.created_at),
  last_message_content = sub.content,
  last_message_sender_id = sub.sender_id,
  last_message_status = sub.status
FROM LATERAL (
  SELECT m.created_at, m.content, m.sender_id, m.status
  FROM public.messages m
  WHERE m.conversation_id = c.id
  ORDER BY m.created_at DESC
  LIMIT 1
) sub
WHERE TRUE;

-- Helpful index for sorting (already exists in initial migration, keep safe)
CREATE INDEX IF NOT EXISTS idx_conversations_last_message_at ON public.conversations(last_message_at DESC);
