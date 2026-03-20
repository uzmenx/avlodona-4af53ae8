-- Fix RLS policy for group_chats to correctly handle visibility and membership
-- Drop the potentially buggy or outdated policy
DROP POLICY IF EXISTS "Public groups are viewable by everyone" ON public.group_chats;
DROP POLICY IF EXISTS "Members see group chats" ON public.group_chats;

-- Create the new corrected policy
CREATE POLICY "Members see group chats" ON public.group_chats
FOR SELECT USING (
  visibility = 'public'
  OR
  EXISTS (
    SELECT 1 FROM public.group_members gm
    WHERE gm.group_id = group_chats.id
    AND gm.user_id = auth.uid()
  )
);
