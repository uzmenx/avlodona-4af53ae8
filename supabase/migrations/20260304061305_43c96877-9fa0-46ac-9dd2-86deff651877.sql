
-- Fix: Remove overly permissive ALL policy and add restrictive write policies
DROP POLICY "Service role can manage cache" ON public.shorts_cache;

-- Edge function uses service role key which bypasses RLS, so no write policies needed for regular users
-- Regular users should not be able to modify cache
CREATE POLICY "No user writes to shorts cache"
ON public.shorts_cache FOR INSERT
WITH CHECK (false);

CREATE POLICY "No user updates to shorts cache"
ON public.shorts_cache FOR UPDATE
USING (false);

CREATE POLICY "No user deletes from shorts cache"
ON public.shorts_cache FOR DELETE
USING (false);
