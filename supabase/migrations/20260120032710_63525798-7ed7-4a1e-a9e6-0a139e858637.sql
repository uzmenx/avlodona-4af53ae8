-- Create OTP codes table for phone verification
CREATE TABLE public.phone_otp_codes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  phone_number TEXT NOT NULL,
  otp_hash TEXT NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  verified BOOLEAN NOT NULL DEFAULT false
);

-- Create index for faster lookups
CREATE INDEX idx_phone_otp_phone ON public.phone_otp_codes(phone_number);
CREATE INDEX idx_phone_otp_expires ON public.phone_otp_codes(expires_at);

-- Enable RLS
ALTER TABLE public.phone_otp_codes ENABLE ROW LEVEL SECURITY;

-- Only edge functions with service role can access this table
-- No public access needed since OTP verification happens server-side