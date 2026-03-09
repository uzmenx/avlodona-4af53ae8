
-- Drop the old SELECT policy
DROP POLICY IF EXISTS "Users can view own events" ON public.family_events;

-- Create new SELECT policy that allows viewing events from users in the same family network
CREATE POLICY "Users can view network events" ON public.family_events
FOR SELECT TO authenticated
USING (
  owner_id = auth.uid()
  OR
  EXISTS (
    SELECT 1 FROM public.profiles p1
    JOIN public.profiles p2 ON p1.family_network_id = p2.family_network_id
    WHERE p1.id = auth.uid()
    AND p2.id = family_events.owner_id
    AND p1.family_network_id IS NOT NULL
  )
);
