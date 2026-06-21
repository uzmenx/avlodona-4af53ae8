# Parolni tiklash xatosini tuzatish — Reja

## Muammoning sababi (diagnostika)

`verify-otp` Edge Function `purpose: 'reset'` rejimida bir nechta nozik nuqtalarda yiqilishi mumkin, lekin `catch` bloki har qanday xatoni umumiy `"An error occurred. Please try again."` ga aylantirib qaytaradi — shuning uchun foydalanuvchi aniq sababni ko'rmaydi. Ehtimoliy sabablar:

1. **`listUsers({ perPage: 1000 })` cheklovi** — foydalanuvchilar 1000 dan ko'p bo'lsa yoki email harf registri farqlansa, mavjud user topilmay "Foydalanuvchi topilmadi" qaytariladi.
2. **`signInWithPassword` muvaffaqiyatsizligi** — agar foydalanuvchi avval faqat Google OAuth orqali ro'yxatdan o'tgan bo'lsa, `email_confirmed_at` to'g'ri o'rnatilmagan bo'lishi mumkin va parol yangilangach ham login bermaydi.
3. **Metadata aralashishi** — reset paytida `username: undefined` user_metadata ga yozilib, mavjud username ni o'chirib yuborishi mumkin.
4. **Xato xabarlari yutilmoqda** — `catch (error: any)` faqat `error.message` ni log qiladi, batafsil `error` obyektini emas, shuning uchun nima yiqilganini bilish qiyin.
5. **Frontend `data.error` ni 200 javobda tekshirmaydi** — agar funksiya 200 bilan `{ error: ... }` qaytarsa ham, frontend "access_token yo'q" deb umumiy xato bersa, asl xabar ko'rinmaydi.

## Yechim — bajariladigan o'zgarishlar

### 1. `supabase/functions/verify-otp/index.ts` — tuzatish va kuchaytirish
- `listUsers` o'rniga paginatsiyali qidiruv yoki `filter` bilan email bo'yicha qidirish (perPage 200, kerak bo'lsa keyingi sahifa). Qisqartirilgan, `email` ni normalize qilingan holatda taqqoslash.
- `purpose === 'reset'` rejimida:
  - Faqat `password` ni yangilash, `user_metadata` ga tegmaslik.
  - `email_confirm: true` ni majburiy o'rnatish (agar `email_confirmed_at` null bo'lsa) — shunda `signInWithPassword` ishlaydi.
  - Agar `signInWithPassword` baribir yiqilsa, `generateLink({ type: 'magiclink' })` orqali zaxira session olish (yoki tushunarli xato qaytarish).
- Har bir `throw` da aniq, foydalanuvchiga ko'rinadigan xabar (uzbek tilida): "Parolni yangilab bo'lmadi", "Foydalanuvchi topilmadi", "Sessiyani boshlab bo'lmadi".
- `console.error` ga `error.message`, `error.status`, `error.code` va `stack` ni to'liq log qilish — keyin `edge_function_logs` orqali tekshirish uchun.
- `email_otp_codes` qidiruvida `.maybeSingle()` ishlatish (`.single()` 0 yoki ko'p qator bo'lsa yiqiladi).

### 2. `supabase/functions/send-otp/index.ts` — kichik aniqlik
- Reset rejimida user topilmasa hozir success qaytaradi (xavfsizlik uchun yaxshi), lekin bu holatda OTP yozilmasligi kerak — aks holda ko'r-ko'rona kod yuboriladi degan illyuziya. Hozirgi kod qaytadan tekshirilib, return mantig'i to'g'rilanadi.

### 3. `src/pages/ResetPassword.tsx` — xato xabarlari va UX
- `response.data?.error` ni har doim oldinroq tekshirish (access_token yo'q xatosidan oldin).
- Sukkes holatida `setSession` dan keyin `refreshProfile` chaqirish va `/` ga emas, `/settings` yoki bosh sahifaga toza navigatsiya.
- Yangi parol va **"Parolni tasdiqlash"** maydonini qo'shish (ikkala parol mos kelishi shart) — Instagram/standart UX.
- Parol kuchini ko'rsatkichi (kamida 6 ta belgi, harf+raqam tavsiya).
- Aniq xato matnlarini ko'rsatish (`Noto'g'ri kod`, `Kod muddati tugagan`, `Foydalanuvchi topilmadi`).

### 4. `src/pages/ForgotPassword.tsx` — kichik tekshiruv
- Email mavjudligini frontda zod bilan validatsiya (bo'sh/noto'g'ri formatda toast).
- Yuborilgandan keyin email ni ResetPassword sahifasiga `location.state` orqali to'g'ri o'tkazilayotganini tasdiqlash (allaqachon shunday, faqat tasdiqlanadi).

## Sinov rejasi
1. Mavjud parolli foydalanuvchi → kod yuborish → kod kiritish → yangi parol → `/` ga login.
2. Faqat Google bilan kirgan foydalanuvchi → reset orqali parol o'rnatish → keyin email+parol bilan login.
3. Mavjud bo'lmagan email → kod yuborilgandek ko'rinadi, lekin verify 400 "Foydalanuvchi topilmadi" beradi.
4. Noto'g'ri kod, eski kod, mos kelmaydigan parollar — aniq xato xabarlari.
5. `supabase__edge_function_logs verify-otp` orqali yangi batafsil log ko'rinishini tekshirish.

## Tahrirlanadigan fayllar
- `supabase/functions/verify-otp/index.ts`
- `supabase/functions/send-otp/index.ts`
- `src/pages/ResetPassword.tsx`
- `src/pages/ForgotPassword.tsx`

Login, signup va Google auth oqimlariga **tegilmaydi**.