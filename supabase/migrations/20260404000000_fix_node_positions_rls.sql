-- Drop old unique constraint if it exists
ALTER TABLE public.node_positions DROP CONSTRAINT IF EXISTS node_positions_member_id_key;

-- Add new composite unique constraint to allow per-user layouts
ALTER TABLE public.node_positions ADD CONSTRAINT node_positions_member_id_owner_id_key UNIQUE (member_id, owner_id);

-- Drop previous restrictive owner policies
DROP POLICY IF EXISTS "Owners can insert node positions" ON public.node_positions;
DROP POLICY IF EXISTS "Owners can update node positions" ON public.node_positions;

-- Create flexible INSERT policy allowing owners or linked members
CREATE POLICY "Users can insert node positions"
ON public.node_positions FOR INSERT
WITH CHECK (
  auth.uid() = owner_id 
  OR 
  member_id IN (SELECT id FROM public.family_tree_members WHERE linked_user_id = auth.uid())
);

-- Create flexible UPDATE policy allowing owners or linked members
CREATE POLICY "Users can update node positions"
ON public.node_positions FOR UPDATE
USING (
  auth.uid() = owner_id 
  OR 
  member_id IN (SELECT id FROM public.family_tree_members WHERE linked_user_id = auth.uid())
);

NOTIFY pgrst, 'reload schema';
