-- Add RLS policy for phone_otp_codes - only service role can access
CREATE POLICY "Service role only" 
ON public.phone_otp_codes 
FOR ALL 
USING (false)
WITH CHECK (false);