import { supabase } from '@/integrations/supabase/client';

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
 * Upload a file to Cloudflare R2 via edge function (with 1 retry)
 */
export async function uploadToR2(
  file: File | Blob,
  folder: string,
  fileName?: string,
  onProgress?: (progress: number) => void
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

/**
 * Upload media: compresses images, uploads videos/audio raw
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
    return uploadToR2(compressed, userFolder, undefined, onProgress);
  }

  // Videos, audio (mp3, wav, ogg, m4a), and other files uploaded raw
  return uploadToR2(file, userFolder, undefined, onProgress);
}
