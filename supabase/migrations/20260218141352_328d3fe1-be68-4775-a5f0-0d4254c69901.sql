-- Allow users to delete their own conversations
CREATE POLICY "Users can delete their conversations"
ON public.conversations
FOR DELETE
USING (auth.uid() = participant1_id OR auth.uid() = participant2_id);

-- Also allow deleting messages in a conversation (for cascade delete)
-- messages already has delete policy for sender, but we need broader for conversation cleanup