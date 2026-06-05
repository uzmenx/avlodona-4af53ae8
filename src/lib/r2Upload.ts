import { supabase } from '@/integrations/supabase/client';

// ─── SHA-256 Hesh Hisoblash ────────────────────────────────────────────────
/**
 * Fayl yoki Blob uchun SHA-256 hesh hisoblab, hex string qaytaradi.
 * Web Crypto API (SubtleCrypto) ishlatiladi — tez va natijali.
 */
export async function getFileHash(file: File | Blob): Promise<string> {
  const buffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

// ─── Deduplication: Media Registry Tekshirish ─────────────────────────────
/**
 * media_registry jadvalida hash bo'yicha qidiradi.
 * Topilsa — URL qaytaradi, topilmasa — null.
 */
async function lookupRegistry(hash: string): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from('media_registry')
      .select('url')
      .eq('hash', hash)
      .maybeSingle();
    if (error) return null;
    return data?.url ?? null;
  } catch {
    return null;
  }
}

/**
 * Muvaffaqiyatli yuklangan faylning hash va URL'ini media_registry'ga yozadi.
 * Xato bo'lsa — jimgina o'tib ketadi (non-fatal).
 */
async function saveToRegistry(
  hash: string,
  url: string,
  fileSize: number,
  mimeType: string
): Promise<void> {
  try {
    await supabase.from('media_registry').upsert(
      { hash, url, file_size: fileSize, mime_type: mimeType },
      { onConflict: 'hash' }
    );
  } catch {
    // non-fatal
  }
}

/**
 * Compress an image file using Canvas API
 */
export async function compressImage(
  file: File,
  maxWidth = 3200,
  maxHeight = 3200,
  quality = 0.95
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;
      if (width > maxWidth || height > maxHeight) {
        const ratio = Math.min(maxWidth / width, maxHeight / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d')!;
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else reject(new Error('Canvas toBlob failed'));
        },
        'image/webp',
        quality
      );
    };
    img.onerror = () => reject(new Error('Image load failed'));
    img.src = URL.createObjectURL(file);
  });
}

/**
 * Create a square WEBP thumbnail with center-crop (Instagram-like cover).
 * - size: output px (e.g., 300)
 * - quality: webp quality (0..1)
 */
export async function createSquareThumbnailWebp(
  file: File,
  size = 300,
  quality = 0.78
): Promise<Blob> {
  // Try createImageBitmap (faster, doesn't block layout as much)
  const canUseBitmap = typeof createImageBitmap === 'function';
  const objectUrl = URL.createObjectURL(file);

  try {
    let srcWidth = 0;
    let srcHeight = 0;
    let drawSource: CanvasImageSource;

    if (canUseBitmap) {
      const bitmap = await createImageBitmap(file);
      srcWidth = bitmap.width;
      srcHeight = bitmap.height;
      drawSource = bitmap;
    } else {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const el = new Image();
        el.onload = () => resolve(el);
        el.onerror = () => reject(new Error('Image load failed'));
        el.src = objectUrl;
      });
      srcWidth = img.width;
      srcHeight = img.height;
      drawSource = img;
    }

    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    // center-crop to square
    const side = Math.min(srcWidth, srcHeight);
    const sx = Math.floor((srcWidth - side) / 2);
    const sy = Math.floor((srcHeight - side) / 2);

    ctx.drawImage(drawSource, sx, sy, side, side, 0, 0, size, size);

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error('Canvas toBlob failed'))),
        'image/webp',
        quality
      );
    });

    return blob;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

/**
 * Upload a file to Cloudflare R2 via edge function (with 1 retry).
 * Deduplication: faylni yuklashdan oldin SHA-256 hash orqali media_registry'da tekshiradi.
 * Agar topilsa — yuklamasdan tayyor URL'ni qaytaradi (internet va vaqt tejash).
 */
export async function uploadToR2(
  file: File | Blob,
  folder: string,
  fileName?: string,
  onProgress?: (progress: number) => void,
  skipDedup = false
): Promise<string> {
  const ext = file instanceof File
    ? file.name.split('.').pop() || 'bin'
    : (file.type === 'image/webp' ? 'webp' : file.type.split('/')[1] || 'bin');

  const name = fileName || `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  const path = `${folder}/${name}.${ext}`;

  // ─── Deduplication tekshiruvi ───────────────────────────────────────────
  // Thumbnaillar uchun dedup o'tkazib yuboriladiganligini belgilash mumkin
  if (!skipDedup) {
    try {
      const hash = await getFileHash(file);
      const existingUrl = await lookupRegistry(hash);
      if (existingUrl) {
        // Bir xil fayl allaqachon yuklanган — qayta yuklamasdan tayyor URL qaytaramiz
        console.info('[r2Upload] Dedup hit — faylni qayta yuklamasdan keshdan oldik:', existingUrl);
        // 100% progress simulatsiya qilamiz (UI uchun)
        onProgress?.(100);
        return existingUrl;
      }
      // Yuklangandan keyin registry'ga yozamiz (quyida)
      const url = await doUploadWithRetry();
      void saveToRegistry(hash, url, file.size, file.type);
      return url;
    } catch (hashError) {
      // Hash hisoblash xato bo'lsa — odatdagi upload davom etadi
      console.warn('[r2Upload] Hash error, uploading without dedup:', hashError);
    }
  }

  return doUploadWithRetry();

  // ─── Ichki upload funksiyasi ────────────────────────────────────────────
  async function doUploadWithRetry(): Promise<string> {
    const formData = new FormData();
    formData.append('file', file instanceof Blob && !(file instanceof File)
      ? new File([file], `${name}.${ext}`, { type: file.type })
      : file
    );
    formData.append('path', path);

    const { data: { session } } = await supabase.auth.getSession();

    const doUpload = async (): Promise<string> => {
      return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/r2-upload?action=upload`);

        xhr.setRequestHeader('Authorization', `Bearer ${session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`);
        xhr.setRequestHeader('apikey', import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY);

        if (onProgress) {
          xhr.upload.onprogress = (event) => {
            if (event.lengthComputable) {
              const percentComplete = (event.loaded / event.total) * 100;
              onProgress(percentComplete);
            }
          };
        }

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const data = JSON.parse(xhr.responseText);
              resolve(data.url);
            } catch (e) {
              reject(new Error('Failed to parse upload response'));
            }
          } else {
            try {
              const err = JSON.parse(xhr.responseText);
              if (xhr.status === 403 && err.limit_reached) {
                window.dispatchEvent(new Event('show-plan-overlay'));
                reject(new Error(err.error || 'Xotira limiti tugadi. Pro rejaga o\'ting!'));
              } else {
                reject(new Error(err.error || `Upload failed: ${xhr.status}`));
              }
            } catch (e) {
              reject(new Error(`Upload failed: ${xhr.status}`));
            }
          }
        };

        xhr.onerror = () => reject(new Error('Network error during upload'));
        xhr.send(formData);
      });
    };

    // Try once, retry on failure
    try {
      return await doUpload();
    } catch (firstError) {
      console.warn('R2 upload first attempt failed, retrying...', firstError);
      return await doUpload();
    }
  }
}

/**
 * Upload media: compresses images, uploads videos/audio raw.
 * Deduplication yoqiq: bir xil fayl ikki marta yuborilsa, ikkinchi safar upload qilinmaydi.
 */
export async function uploadMedia(
  file: File,
  folder: string,
  userId: string,
  onProgress?: (progress: number) => void
): Promise<string> {
  const isImage = file.type.startsWith('image/');
  const isGif = file.type === 'image/gif' || file.name.toLowerCase().endsWith('.gif');
  const userFolder = `${folder}/${userId}`;

  if (isImage) {
    if (isGif) {
      return uploadToR2(file, userFolder, undefined, onProgress);
    }
    const compressed = await compressImage(file);
    // Compressed blob uchun dedup ham ishlaydi
    return uploadToR2(compressed, userFolder, undefined, onProgress);
  }

  // Videos, audio (mp3, wav, ogg, m4a), and other files uploaded raw
  return uploadToR2(file, userFolder, undefined, onProgress);
}

export type UploadPostMediaResult = {
  url: string;
  thumbnailUrl: string | null;
  mediaType: 'image' | 'video' | 'audio' | 'file';
};

/**
 * Post uchun media upload: image bo‘lsa 300x300 WEBP thumbnail ham yaratadi.
 * - thumbnailUrl faqat image (gif emas) uchun qaytadi
 * - boshqa media turlari: thumbnailUrl = null
 */
export async function uploadPostMedia(
  file: File,
  folder: 'posts' | 'memorial',
  userId: string,
  onProgress?: (progress: number) => void
): Promise<UploadPostMediaResult> {
  const isImage = file.type.startsWith('image/');
  const isVideo = file.type.startsWith('video/');
  const isAudio = file.type.startsWith('audio/');
  const isGif = file.type === 'image/gif' || file.name.toLowerCase().endsWith('.gif');

  const mediaType: UploadPostMediaResult['mediaType'] =
    isImage ? 'image' :
    isVideo ? 'video' :
    isAudio ? 'audio' :
    'file';

  const mainUrl = await uploadMedia(file, folder, userId, onProgress);

  // Thumbnail only for non-gif images (webp)
  if (!isImage || isGif) {
    return { url: mainUrl, thumbnailUrl: null, mediaType };
  }

  try {
    const thumbBlob = await createSquareThumbnailWebp(file, 300, 0.78);
    const thumbFolder = `${folder}-thumbs/${userId}`;
    const thumbnailUrl = await uploadToR2(thumbBlob, thumbFolder);
    return { url: mainUrl, thumbnailUrl, mediaType };
  } catch (e) {
    console.warn('[uploadPostMedia] thumbnail create/upload failed (non-fatal):', e);
    return { url: mainUrl, thumbnailUrl: null, mediaType };
  }
}
