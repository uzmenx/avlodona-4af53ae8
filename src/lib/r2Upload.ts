import { supabase } from '@/integrations/supabase/client';

/**
 * Compress an image file using Canvas API
 */
export async function compressImage(
  file: File,
  maxWidth = 1920,
  maxHeight = 1920,
  quality = 0.8
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
 * Upload a file to Cloudflare R2 via edge function (with 1 retry)
 */
export async function uploadToR2(
  file: File | Blob,
  folder: string,
  fileName?: string
): Promise<string> {
  const ext = file instanceof File
    ? file.name.split('.').pop() || 'bin'
    : (file.type === 'image/webp' ? 'webp' : file.type.split('/')[1] || 'bin');

  const name = fileName || `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  const path = `${folder}/${name}.${ext}`;

  const formData = new FormData();
  formData.append('file', file instanceof Blob && !(file instanceof File)
    ? new File([file], `${name}.${ext}`, { type: file.type })
    : file
  );
  formData.append('path', path);

  const { data: { session } } = await supabase.auth.getSession();

  const doUpload = async (): Promise<string> => {
    const res = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/r2-upload?action=upload`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: formData,
      }
    );

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
      throw new Error(err.error || `Upload failed: ${res.status}`);
    }

    const data = await res.json();
    return data.url;
  };

  // Try once, retry on failure
  try {
    return await doUpload();
  } catch (firstError) {
    console.warn('R2 upload first attempt failed, retrying...', firstError);
    return await doUpload();
  }
}

/**
 * Upload media: compresses images, uploads videos/audio raw
 */
export async function uploadMedia(
  file: File,
  folder: string,
  userId: string
): Promise<string> {
  const isImage = file.type.startsWith('image/');
  const isGif = file.type === 'image/gif' || file.name.toLowerCase().endsWith('.gif');
  const userFolder = `${folder}/${userId}`;

  if (isImage) {
    if (isGif) {
      return uploadToR2(file, userFolder);
    }
    const compressed = await compressImage(file);
    return uploadToR2(compressed, userFolder);
  }

  // Videos, audio (mp3, wav, ogg, m4a), and other files uploaded raw
  return uploadToR2(file, userFolder);
}
