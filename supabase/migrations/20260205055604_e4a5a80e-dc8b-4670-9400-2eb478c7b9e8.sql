-- Add cover_url and social_links columns to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS cover_url TEXT,
ADD COLUMN IF NOT EXISTS social_links JSONB DEFAULT '[]'::jsonb;

-- Add comment for documentation
COMMENT ON COLUMN public.profiles.social_links IS 'Array of social links, max 3 items: [{type: string, url: string, label: string}]';