-- Drop the existing UPDATE policy
DROP POLICY IF EXISTS "Owners and linked users can update family members" ON public.family_tree_members;
DROP POLICY IF EXISTS "Network members can update family members" ON public.family_tree_members;

-- Create a new UPDATE policy that allows updates by owners, linked users, OR anyone in the same family network (for placeholder accounts)
CREATE POLICY "Network members can update family members" ON public.family_tree_members
FOR UPDATE TO authenticated
USING (
  auth.uid() = owner_id 
  OR auth.uid() = linked_user_id
  OR (
    /* Also allow updates from users in the same family network for placeholder entries */
    is_placeholder = true 
    AND EXISTS (
      SELECT 1 FROM public.profiles p1
      JOIN public.profiles p2 ON p1.family_network_id = p2.family_network_id
      WHERE p1.id = auth.uid()
      AND p2.id = family_tree_members.owner_id
      AND p1.family_network_id IS NOT NULL
    )
  )
);
