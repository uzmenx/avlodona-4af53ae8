-- Drop the email column to fix the leak
ALTER TABLE public.profiles DROP COLUMN IF EXISTS email;

-- Update the handle_new_user function so it doesn't try to insert email
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id)
    VALUES (NEW.id);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
