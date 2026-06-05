-- Media registry: fayllar dublikatini tekshirish uchun hash-based deduplication jadvali
-- Har bir noyob fayl (sha256 hash bo'yicha) faqat bir marta R2'ga yuklanadi

create table if not exists public.media_registry (
  hash       text        primary key,           -- SHA-256 hex, e.g. "a3f9..."
  url        text        not null,              -- R2 / Supabase Storage to'liq URL
  file_size  bigint      not null default 0,   -- Baytlarda o'lchami
  mime_type  text        not null default '',  -- video/mp4, image/webp, audio/ogg va hk
  created_at timestamptz not null default now()
);

-- RLS (Row Level Security) yoqish
alter table public.media_registry enable row level security;

-- Authenticated foydalanuvchilar o'qishi mumkin (keshdan URL olish uchun)
create policy "authenticated users can read media_registry"
  on public.media_registry
  for select
  to authenticated
  using (true);

-- Authenticated foydalanuvchilar yozishi mumkin (yangi hash qo'shish uchun)
create policy "authenticated users can insert media_registry"
  on public.media_registry
  for insert
  to authenticated
  with check (true);

-- Indeks: hash orqali tezkor qidiruv uchun (primary key allaqachon indeks, lekin explicit)
comment on table public.media_registry is 
  'Yuklangan media fayllarning SHA-256 hashlari va URLlari. Bir xil faylni ikki marta yuklashni oldini oladi.';
