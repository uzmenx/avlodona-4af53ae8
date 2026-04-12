-- ============================================================
-- Migration: Auto-create a notification row whenever a new
--            direct message is inserted into the messages table.
--
-- HOW TO RUN:
--   Supabase Dashboard → SQL Editor → paste & run this script
--   OR: supabase db push  (if using local CLI)
-- ============================================================

-- 1. Add fcm_token column so we can store device push tokens later
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS fcm_token TEXT;

-- 2. Function: inserts a 'message' notification for the recipient
CREATE OR REPLACE FUNCTION create_message_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER   -- runs with elevated rights so RLS won't block it
SET search_path = public
AS $$
DECLARE
  v_recipient_id UUID;
  v_participant1  UUID;
  v_participant2  UUID;
BEGIN
  -- Resolve with whom the sender is conversing
  SELECT participant1_id, participant2_id
    INTO v_participant1, v_participant2
    FROM conversations
   WHERE id = NEW.conversation_id;

  -- The recipient is the OTHER participant (not the sender)
  IF v_participant1 = NEW.sender_id THEN
    v_recipient_id := v_participant2;
  ELSE
    v_recipient_id := v_participant1;
  END IF;

  -- Guard: skip if we couldn't resolve a recipient or sender = recipient
  IF v_recipient_id IS NULL OR v_recipient_id = NEW.sender_id THEN
    RETURN NEW;
  END IF;

  -- Insert the notification (ignore duplicates on the same second)
  INSERT INTO notifications (user_id, actor_id, type, created_at)
  VALUES (v_recipient_id, NEW.sender_id, 'message', NOW())
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;

-- 3. Attach trigger to the messages table
DROP TRIGGER IF EXISTS trg_on_new_message_notify ON messages;

CREATE TRIGGER trg_on_new_message_notify
  AFTER INSERT ON messages
  FOR EACH ROW
  EXECUTE FUNCTION create_message_notification();
