-- Create table for storing web push subscriptions
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(user_id, endpoint)
);

-- RLS setup
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert their own push subscriptions"
ON public.push_subscriptions FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own push subscriptions"
ON public.push_subscriptions FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own push subscriptions"
ON public.push_subscriptions FOR DELETE
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own push subscriptions"
ON public.push_subscriptions FOR UPDATE
USING (auth.uid() = user_id);

-- Optional notification payload table (if needed for history)
-- We will use direct Edge Function invocation for real push but subscriptions exist here.

NOTIFY pgrst, 'reload schema';
