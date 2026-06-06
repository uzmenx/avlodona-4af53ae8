
-- Helper: check conversation participation (SECURITY DEFINER, avoids RLS recursion)
CREATE OR REPLACE FUNCTION public.is_conversation_participant(_user_id uuid, _conversation_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.conversations
    WHERE id = _conversation_id
      AND (participant1_id = _user_id OR participant2_id = _user_id)
  )
$$;

-- Replace overly-broad realtime.messages policies with topic-scoped ones
DROP POLICY IF EXISTS "Authenticated users can receive broadcasts" ON realtime.messages;
DROP POLICY IF EXISTS "Authenticated users can send broadcasts" ON realtime.messages;
DROP POLICY IF EXISTS "authenticated can read" ON realtime.messages;
DROP POLICY IF EXISTS "authenticated can write" ON realtime.messages;
DROP POLICY IF EXISTS "Allow authenticated SELECT" ON realtime.messages;
DROP POLICY IF EXISTS "Allow authenticated INSERT" ON realtime.messages;
DROP POLICY IF EXISTS "Allow listening to topics" ON realtime.messages;
DROP POLICY IF EXISTS "Allow broadcasting to topics" ON realtime.messages;
DROP POLICY IF EXISTS "Realtime messages select" ON realtime.messages;
DROP POLICY IF EXISTS "Realtime messages insert" ON realtime.messages;

-- SELECT (subscribe): topic must be authorized for this user
CREATE POLICY "Topic-scoped realtime subscribe"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  -- Own presence channel
  (realtime.topic() = 'presence-' || auth.uid()::text)
  -- Typing indicator scoped to a conversation the user participates in
  OR (
    realtime.topic() LIKE 'typing-%'
    AND public.is_conversation_participant(
      auth.uid(),
      NULLIF(substring(realtime.topic() from 8), '')::uuid
    )
  )
  -- Shared family tree sync channel (intentionally global to authenticated users)
  OR (realtime.topic() = 'family_tree_sync')
);

-- INSERT (broadcast): same scoping
CREATE POLICY "Topic-scoped realtime broadcast"
ON realtime.messages
FOR INSERT
TO authenticated
WITH CHECK (
  (realtime.topic() = 'presence-' || auth.uid()::text)
  OR (
    realtime.topic() LIKE 'typing-%'
    AND public.is_conversation_participant(
      auth.uid(),
      NULLIF(substring(realtime.topic() from 8), '')::uuid
    )
  )
  OR (realtime.topic() = 'family_tree_sync')
);
