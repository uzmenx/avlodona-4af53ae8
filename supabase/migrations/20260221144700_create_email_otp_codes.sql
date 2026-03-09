-- Create OTP codes table for email verification
CREATE TABLE public.email_otp_codes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL,
  otp_hash TEXT NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  verified BOOLEAN NOT NULL DEFAULT false
);

-- Create index for faster lookups
CREATE INDEX idx_email_otp_email ON public.email_otp_codes(email);
CREATE INDEX idx_email_otp_expires ON public.email_otp_codes(expires_at);

-- Enable RLS
ALTER TABLE public.email_otp_codes ENABLE ROW LEVEL SECURITY;

-- Only edge functions with service role can access this table
CREATE POLICY "Service role only" 
ON public.email_otp_codes 
FOR ALL 
USING (false)
WITH CHECK (false);
