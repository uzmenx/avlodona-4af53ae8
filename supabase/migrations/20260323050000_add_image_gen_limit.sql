-- Add last_image_gen_at column to profiles table to track AI image generations
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_image_gen_at TIMESTAMPTZ;

-- Ensure RLS allows users to update their own profile (which includes this column)
-- Assuming a policy already exists for updating own profile, if not, we would add:
-- CREATE POLICY "Users can update their own profile" ON public.profiles
-- FOR UPDATE USING (auth.uid() = id);

COMMENT ON COLUMN public.profiles.last_image_gen_at IS 'Saves the timestamp of the last AI image generation to enforce a 15-hour limit.';
