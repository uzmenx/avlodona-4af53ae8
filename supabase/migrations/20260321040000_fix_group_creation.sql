-- Fix RLS policy for group_chats to ensure owners always have access
-- This fixes the issue where owners can't see private groups they just created, 
-- which causes .select().single() and member addition to fail.

-- Update group_chats SELECT policy
DROP POLICY IF EXISTS "Members see group chats" ON public.group_chats;
CREATE POLICY "Members see group chats" ON public.group_chats
FOR SELECT USING (
  visibility = 'public'
  OR
  owner_id = auth.uid()
  OR
  EXISTS (
    SELECT 1 FROM public.group_members gm
    WHERE gm.group_id = group_chats.id
    AND gm.user_id = auth.uid()
  )
);

-- Ensure created_by column exists in group_chats (matching types.ts)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'group_chats' AND column_name = 'created_by') THEN
        ALTER TABLE public.group_chats ADD COLUMN created_by UUID;
        UPDATE public.group_chats SET created_by = owner_id WHERE created_by IS NULL;
        ALTER TABLE public.group_chats ALTER COLUMN created_by SET NOT NULL;
    END IF;
END $$;

-- Update group_chats INSERT policy to use created_by if needed, or stick to owner_id
-- The code provides both.
DROP POLICY IF EXISTS "Users can create groups" ON public.group_chats;
CREATE POLICY "Users can create groups" ON public.group_chats
FOR INSERT WITH CHECK (auth.uid() = owner_id OR auth.uid() = created_by);

-- Update group_members INSERT policy to allow owners to add members (including themselves)
DROP POLICY IF EXISTS "Owners and admins can add members" ON public.group_members;
CREATE POLICY "Owners and admins can add members" ON public.group_members
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.group_chats gc 
    WHERE gc.id = group_id 
    AND (gc.owner_id = auth.uid() OR gc.created_by = auth.uid())
  ) 
  OR 
  EXISTS (
    SELECT 1 FROM public.group_members gm 
    WHERE gm.group_id = group_id 
    AND gm.user_id = auth.uid() 
    AND gm.role = 'admin'
  )
);
