-- Create update policy for group_members to allow users to update their own fields (like last_read_at)
CREATE POLICY "Users can update their own group membership" ON public.group_members
FOR UPDATE USING (
  user_id = auth.uid()
) WITH CHECK (
  user_id = auth.uid()
);
