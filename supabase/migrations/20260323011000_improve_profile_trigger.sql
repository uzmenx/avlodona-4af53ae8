-- Enhance handle_new_user to extract name and avatar_url from metadata
-- Also generate a default username from email if not provided
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (
      id,
      name,
      username,
      avatar_url,
      email
    )
    VALUES (
      NEW.id,
      COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', 'Foydalanuvchi'),
      LOWER(SPLIT_PART(NEW.email, '@', 1)),
      NEW.raw_user_meta_data->>'avatar_url',
      NEW.email
    )
    ON CONFLICT (id) DO UPDATE SET
      name = COALESCE(profiles.name, EXCLUDED.name),
      username = COALESCE(profiles.username, EXCLUDED.username),
      avatar_url = COALESCE(profiles.avatar_url, EXCLUDED.avatar_url),
      email = COALESCE(profiles.email, EXCLUDED.email);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
