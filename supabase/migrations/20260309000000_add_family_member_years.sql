alter table public.family_tree_members
add column if not exists birth_year integer,
add column if not exists death_year integer;
