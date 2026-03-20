-- Fix RLS policy for group_members to securely limit visibility to co-members
-- Drop existing problematic policies
DROP POLICY IF EXISTS "Members are viewable by group members" ON public.group_members;
DROP POLICY IF EXISTS "Members see group members" ON public.group_members;

-- Create the new policy to restrict visibility to group members
CREATE POLICY "Members see group members" ON public.group_members
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.group_members gm2
    WHERE gm2.group_id = group_members.group_id
    AND gm2.user_id::text = auth.uid()::text
  )
);
