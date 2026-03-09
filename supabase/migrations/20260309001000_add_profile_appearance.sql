alter table public.profiles
add column if not exists theme_mode text,
add column if not exists bg_theme text;
