

# R2 Storage va MVP Tayyor Qilish Rejasi

## Muammo Tahlili

Loglardan ko'rinib turibdiki, asosiy xato: **`SignatureDoesNotMatch` (403)** - bu imzo (signature) xatosi. 

Sabablari:
1. **`R2_SECRET_ACCESS_KEY` noto'g'ri** - siz bergan kalit 63 belgidan iborat, lekin Cloudflare R2 kalitlari doimo 64 belgi bo'ladi. Bitta belgi yetishmayapti
2. **aws4fetch kutubxonasi** ba'zan Cloudflare R2 bilan mos kelmaydi - `@aws-sdk/client-s3` ishonchliroq

## Reja

### 1-qadam: R2 Secret Key ni to'g'rilash

Cloudflare Dashboard-dan yangi API Token yarating:
- **R2 Object Storage** > **Manage R2 API Tokens** > **Create API Token**
- **Permissions**: Object Read & Write
- **Bucket**: `qarindoshlar`
- Hosil bo'lgan **Secret Access Key** ni to'liq nusxalang (64 belgi bo'lishi kerak)

Men secretni yangilayman - siz faqat to'g'ri qiymatni kiritasiz.

### 2-qadam: Edge Function ni `@aws-sdk/client-s3` ga o'tkazish

`aws4fetch` o'rniga `@aws-sdk/client-s3` kutubxonasidan foydalanamiz. Bu Cloudflare R2 bilan ishlash uchun rasmiy tavsiya etilgan usul:

- `forcePathStyle: true` - R2 uchun majburiy
- `region: "auto"` - Cloudflare uchun
- `PutObjectCommand` - fayl yuklash uchun

Bu `SignatureDoesNotMatch` xatosini to'liq bartaraf etadi.

### 3-qadam: Client kodini mustahkamlash

`src/lib/r2Upload.ts` faylida:
- Xato bo'lganda aniqroq xabar ko'rsatish
- Retry logikasi qo'shish (1 marta qayta urinish)
- URL yaratishni to'g'rilash

### 4-qadam: Barcha upload joylarni tekshirish

Loyihada R2 upload quyidagi joylarda ishlatiladi:
- **Post yaratish** (`CreatePost.tsx`) - rasm/video yuklash
- **Profil tahrirlash** (`EditProfile.tsx`) - avatar va cover rasm
- **Story yaratish** (`CreateStory.tsx`) - story media
- **Chat xabarlari** (`ChatInput.tsx`) - rasm, video, ovozli xabar

Barchasi `uploadMedia()` va `uploadToR2()` funksiyalaridan foydalanadi - shu sababli edge function tuzatilsa, hammasi ishlaydi.

---

## Texnik Tafsilotlar

### Edge Function yangi kodi (asosiy o'zgarishlar):

```text
aws4fetch (eski)  -->  @aws-sdk/client-s3 (yangi)
```

- `S3Client` konfiguratsiyasi: `endpoint`, `region: "auto"`, `forcePathStyle: true`
- `PutObjectCommand` orqali yuklash
- Content-Type ni to'g'ri uzatish
- Xato holatlarda batafsil log

### O'zgartiriladigan fayllar:
1. `supabase/functions/r2-upload/index.ts` - to'liq qayta yozish
2. `src/lib/r2Upload.ts` - retry va xato xabarlarini yaxshilash
3. `R2_SECRET_ACCESS_KEY` secretni yangilash

### Sizdan kerak:
- Cloudflare Dashboard-dan **yangi R2 API Token** yaratib, **Secret Access Key** ni (64 belgi) kiritish

