-- Add network_id to node_positions
ALTER TABLE public.node_positions 
ADD COLUMN IF NOT EXISTS network_id UUID REFERENCES public.family_networks(id);

-- Backfill network_id based on the owner's profile
UPDATE public.node_positions np
SET network_id = p.family_network_id
FROM public.profiles p
WHERE np.owner_id = p.id AND np.network_id IS NULL;

-- If there are any stray rows with no network_id, they are invalid for shared layouts.
-- We must delete them to enforce NOT NULL and a full UNIQUE constraint.
DELETE FROM public.node_positions WHERE network_id IS NULL;

ALTER TABLE public.node_positions ALTER COLUMN network_id SET NOT NULL;

-- Drop the old constraint that separated positions by owner_id
ALTER TABLE public.node_positions DROP CONSTRAINT IF EXISTS node_positions_member_id_owner_id_key;

-- Add a standard unique constraint for Supabase upsert ON CONFLICT resolution
ALTER TABLE public.node_positions ADD CONSTRAINT node_positions_member_id_network_id_key UNIQUE (member_id, network_id);

-- Update the RLS policy to allow users in the same network to update
DROP POLICY IF EXISTS "Users can update node positions" ON public.node_positions;
CREATE POLICY "Users can update node positions"
ON public.node_positions FOR UPDATE
USING (
  auth.uid() = owner_id 
  OR 
  network_id IN (SELECT family_network_id FROM public.profiles WHERE id = auth.uid())
);

DROP POLICY IF EXISTS "Users can insert node positions" ON public.node_positions;
CREATE POLICY "Users can insert node positions"
ON public.node_positions FOR INSERT
WITH CHECK (
  auth.uid() = owner_id 
  OR 
  network_id IN (SELECT family_network_id FROM public.profiles WHERE id = auth.uid())
);

NOTIFY pgrst, 'reload schema';
