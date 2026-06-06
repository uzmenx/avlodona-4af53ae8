-- jadvalni yaratish
create table public.fcm_tokens (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  token text not null,
  platform text default 'android',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(user_id, token)
);

-- RLS siyosatlari (Row Level Security)
alter table public.fcm_tokens enable row level security;

-- Foydalanuvchi o'zining tokenlarini ko'rishi mumkin
create policy "Users can view own fcm tokens."
  on public.fcm_tokens for select
  using ( auth.uid() = user_id );

-- Foydalanuvchi o'ziga token qo'sha oladi
create policy "Users can insert own fcm tokens."
  on public.fcm_tokens for insert
  with check ( auth.uid() = user_id );

-- Foydalanuvchi o'z tokenini o'chira oladi
create policy "Users can delete own fcm tokens."
  on public.fcm_tokens for delete
  using ( auth.uid() = user_id );
