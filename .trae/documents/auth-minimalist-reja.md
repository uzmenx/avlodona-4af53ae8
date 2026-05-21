## Summary

Maqsad: login va roʻyxatdan oʻtish ekranlarini (AuthLogin + Signup) ilovaga birinchi kirgan odam darrov tushunadigan, sodda, qisqa va minimalist ko‘rinishga keltirish. Funksionallik (email/parol, Google sign-in, til almashtirish) saqlanadi; UI ortiqcha bloklar olib tashlanadi va takroriy kod qisqartiriladi.

## Current State Analysis

Manbalar:
- AuthLogin: [AuthLogin.tsx](file:///c:/Users/otabek/Desktop/avlodona/src/pages/AuthLogin.tsx)
- Signup: [Signup.tsx](file:///c:/Users/otabek/Desktop/avlodona/src/pages/Signup.tsx)
- Footer: [LegalFooter.tsx](file:///c:/Users/otabek/Desktop/avlodona/src/components/legal/LegalFooter.tsx)
- Til: [LangSwitcher.tsx](file:///c:/Users/otabek/Desktop/avlodona/src/components/LangSwitcher.tsx)
- Routing: [App.tsx](file:///c:/Users/otabek/Desktop/avlodona/src/App.tsx)

Kuzatuvlar:
- Login va Signup sahifalarida bir xil “background + glass card + header” ko‘p takrorlangan, fayllar uzunlashgan.
- “Animated bokeh” (bir nechta blur/pulse divlar) vizual jihatdan chiroyli va siz uni qoldirishni xohlaysiz; shuning uchun bu blok saqlanadi.
- Login/Signup’da “By continuing...” legal matni button ostida ham bor, pastda footer ham bor (redundant).
- Header’da back tugmasi bor; foydalanuvchi oqimi uchun shart emas (foydalanuvchi xohishi: faqat logo + til).
- Matnlar (landingH1/landingTagline) juda uzun, birinchi marta kirgan odam uchun “marketing” ko‘p.

## Decisions (User-confirmed)

- Sahifalar alohida qoladi: /auth va /signup.
- Signup’da “Ism + jins” (gender) saqlanadi.
- Header: faqat “logo/app nomi + til switcher”, back tugmasi olib tashlanadi.
- Legal: button ostidagi matn olib tashlanadi, faqat eng pastdagi footer qoldiriladi.

## Proposed Changes

### 1) Animated bokeh background’ni saqlab, faqat kontentni qisqartirish

Sizning talabingizga ko‘ra “Animated bokeh background” blokini olib tashlamaymiz va boshqa joyga ko‘chirmaymiz. Minimalizm faqat card ichidagi kontent/spacings hisobiga qilinadi.

### 2) AuthLogin UI’ni qisqartirish

Fayl:
- `src/pages/AuthLogin.tsx`

O‘zgarishlar:
- “Animated bokeh background” blokiga tegilmaydi (o‘z holicha qoladi).
- Back tugmasini olib tashlash (faqat `LangSwitcher` va “Avlodona” sarlavhasi qoladi).
- Uzoq “landingH1/landingTagline” blokini minimalga tushirish:
  - Login ekrani sarlavhasi: masalan “Kirish” (yoki `t('login')` ni vizual jihatdan mos ko‘rinishda).
  - Tagline’ni 1 qatordan oshirmaslik yoki butunlay olib tashlash (minimal variant).
- “By continuing…” legal paragrafini butunlay olib tashlash (footer qoldiriladi).
- Form spacing’ni qisqartirish:
  - input balandligi 12 → 11 (yoki 10) kabi
  - card padding p-5/p-6 → p-4 (mobilga qulay)
  - `space-y-*` larni kamaytirish
- Keraksiz importlarni olib tashlash (masalan `lovable` hozir ishlatilmasa).

### 3) Signup UI’ni qisqartirish

Fayl:
- `src/pages/Signup.tsx`

O‘zgarishlar:
- “Animated bokeh background” blokiga tegilmaydi (o‘z holicha qoladi).
- Uzoq landing matnlarini minimalga tushirish (login bilan bir xil uslub).
- “By continuing…” legal paragrafini olib tashlash (footer qoldiriladi).
- Ism va jins saqlanadi, lekin kompakt ko‘rinishda:
  - Ism input: placeholder qisqa, keraksiz bo‘sh joylarni kamaytirish
  - Gender toggle: tugmalar kichikroq, spacing kamayadi
- Pastdagi “Akkauntingiz bormi? Kirish” satri saqlanadi, lekin marginlar kichikroq.
- Keraksiz importlarni tozalash.

### 4) Matnlarni (copy) qisqartirish

Fayl:
- `src/contexts/LanguageContext.tsx`

O‘zgarishlar:
- `landingH1` va `landingTagline` ni ixchamroq qilish:
  - landingH1: “Avlodona”
  - tagline: 1 qisqa satr (“Oila daraxti va raqamli xotira” kabi)

Eslatma:
- Bu o‘zgarishlar faqat Auth ekranlarida ishlatilayotgan matnlar; boshqa sahifalarga ta’siri tekshiriladi.

### 5) Footer’ni yanada minimal qilish (ixtiyoriy, lekin tavsiya)

Fayl:
- `src/components/legal/LegalFooter.tsx`

O‘zgarishlar:
- `py-6` → `py-4` (yoki kichikroq) qilib ekran pastini ixchamlashtirish.
- Linklar matni qisqa qoladi (Terms / Privacy / Contact).

## Implementation Steps (Execution Checklist)

1) AuthLogin’da back tugmasini va legal paragrafni olib tashlash, spacing/copy qisqartirish (background’ga tegmasdan).
2) Signup’da legal paragrafni olib tashlash, spacing/copy qisqartirish, ism+jinsni kompaktlashtirish (background’ga tegmasdan).
3) `LanguageContext.tsx`dagi `landingH1/landingTagline` matnlarini qisqartirish.
4) `LegalFooter.tsx` paddingini minimalga tushirish (agar pastdagi bo‘sh joy ko‘p bo‘lsa).

## Verification

Build:
- `npm run build` muvaffaqiyatli o‘tishi.

Manual UI checks:
- Web: `/auth` va `/signup` da:
  - ko‘rinish “minimal, qisqa” (header: faqat Avlodona + til)
  - legal matn faqat footer’da
  - login/signup oqimi ishlaydi (email/parol + Google tugma)
- Android: yangi APK bilan ochib tekshirish (layout toza va tushunarli).

Regression checks:
- `App.tsx`dagi “first visit” oqimi buzilmagan (birinchi kirishda signup’ga yo‘naltirish).
