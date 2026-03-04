
-- Create a persistent cache table for YouTube shorts
CREATE TABLE public.shorts_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cache_key text NOT NULL UNIQUE,
  shorts jsonb NOT NULL DEFAULT '[]'::jsonb,
  next_page_token text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  expires_at timestamp with time zone NOT NULL DEFAULT (now() + interval '2 hours')
);

-- Index for fast lookups and cleanup
CREATE INDEX idx_shorts_cache_key ON public.shorts_cache (cache_key);
CREATE INDEX idx_shorts_cache_expires ON public.shorts_cache (expires_at);

-- Enable RLS but allow service role full access
ALTER TABLE public.shorts_cache ENABLE ROW LEVEL SECURITY;

-- Public read access (edge function uses service role for writes)
CREATE POLICY "Anyone can read shorts cache"
ON public.shorts_cache FOR SELECT
USING (true);

-- Only service role can insert/update/delete (handled by edge function)
CREATE POLICY "Service role can manage cache"
ON public.shorts_cache FOR ALL
USING (true)
WITH CHECK (true);
