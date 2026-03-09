
-- Create email_otp_codes table for OTP verification
CREATE TABLE public.email_otp_codes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL,
  otp_hash TEXT NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  verified BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.email_otp_codes ENABLE ROW LEVEL SECURITY;

-- Only service role can access this table
CREATE POLICY "Service role only"
  ON public.email_otp_codes
  FOR ALL
  USING (false)
  WITH CHECK (false);

-- Index for fast lookups
CREATE INDEX idx_email_otp_codes_email ON public.email_otp_codes (email);
