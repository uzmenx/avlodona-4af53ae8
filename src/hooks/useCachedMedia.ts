import { useState, useEffect } from 'react';
import { Capacitor } from '@capacitor/core';

// ─── Konstantalar ────────────────────────────────────────────────────────────
const CACHE_NAME = 'avlodona-media-cache-v1';
// IndexedDB orqali URL → localPath xaritasini saqlaymiz
const DB_NAME = 'avlodona-media-cache-db';
const DB_STORE = 'cache_map';
const DB_VERSION = 1;

// ─── IndexedDB yordamchi funksiyalari ────────────────────────────────────────
let _db: IDBDatabase | null = null;

async function openDb(): Promise<IDBDatabase> {
  if (_db) return _db;
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(DB_STORE)) {
        db.createObjectStore(DB_STORE);
      }
    };
    req.onsuccess = (e) => {
      _db = (e.target as IDBOpenDBRequest).result;
      resolve(_db);
    };
    req.onerror = () => reject(req.error);
  });
}

async function dbGet(key: string): Promise<string | null> {
  try {
    const db = await openDb();
    return new Promise((resolve) => {
      const tx = db.transaction(DB_STORE, 'readonly');
      const req = tx.objectStore(DB_STORE).get(key);
      req.onsuccess = () => resolve(req.result ?? null);
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

async function dbSet(key: string, value: string): Promise<void> {
  try {
    const db = await openDb();
    return new Promise((resolve) => {
      const tx = db.transaction(DB_STORE, 'readwrite');
      tx.objectStore(DB_STORE).put(value, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch {
    // non-fatal
  }
}

async function dbGetAll(): Promise<{ key: string; value: string }[]> {
  try {
    const db = await openDb();
    return new Promise((resolve) => {
      const tx = db.transaction(DB_STORE, 'readonly');
      const store = tx.objectStore(DB_STORE);
      const keysReq = store.getAllKeys();
      const valsReq = store.getAll();
      tx.oncomplete = () => {
        const keys = keysReq.result as string[];
        const vals = valsReq.result as string[];
        resolve(keys.map((k, i) => ({ key: k, value: vals[i] })));
      };
      tx.onerror = () => resolve([]);
    });
  } catch {
    return [];
  }
}

async function dbDelete(key: string): Promise<void> {
  try {
    const db = await openDb();
    return new Promise((resolve) => {
      const tx = db.transaction(DB_STORE, 'readwrite');
      tx.objectStore(DB_STORE).delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch {
    // non-fatal
  }
}

// ─── Cache Storage API (Web) ─────────────────────────────────────────────────
async function getFromCacheStorage(url: string): Promise<string | null> {
  try {
    if (!('caches' in window)) return null;
    const cache = await caches.open(CACHE_NAME);
    const response = await cache.match(url);
    if (!response) return null;
    // Blob URL yaratib qaytaramiz
    const blob = await response.blob();
    return URL.createObjectURL(blob);
  } catch {
    return null;
  }
}

async function saveToCacheStorage(url: string): Promise<string | null> {
  try {
    if (!('caches' in window)) return null;
    const response = await fetch(url);
    if (!response.ok) return null;
    const cache = await caches.open(CACHE_NAME);
    await cache.put(url, response.clone());
    const blob = await response.blob();
    return URL.createObjectURL(blob);
  } catch {
    return null;
  }
}

// ─── Capacitor (Mobil) Kesh ─────────────────────────────────────────────────
async function getFromCapacitorCache(url: string): Promise<string | null> {
  try {
    const { Filesystem, Directory } = await import('@capacitor/filesystem');
    const safeKey = btoa(url).replace(/[^a-zA-Z0-9]/g, '').slice(0, 60);
    const path = `media_cache/${safeKey}`;
    await Filesystem.stat({ path, directory: Directory.Cache });
    // Mavjud bo'lsa, mahalliy URL qaytarish
    const result = await Filesystem.getUri({ path, directory: Directory.Cache });
    return Capacitor.convertFileSrc(result.uri);
  } catch {
    return null;
  }
}

async function saveToCapacitorCache(url: string): Promise<string | null> {
  try {
    const { Filesystem, Directory } = await import('@capacitor/filesystem');
    const safeKey = btoa(url).replace(/[^a-zA-Z0-9]/g, '').slice(0, 60);
    const path = `media_cache/${safeKey}`;

    // fetch + base64 yozish — barcha Capacitor versiyalarida ishlaydi
    const response = await fetch(url);
    if (!response.ok) return null;
    const blob = await response.blob();
    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve((reader.result as string).split(',')[1]);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });

    await Filesystem.writeFile({
      path,
      data: base64,
      directory: Directory.Cache,
      recursive: true,
    });

    const uriResult = await Filesystem.getUri({ path, directory: Directory.Cache });
    return Capacitor.convertFileSrc(uriResult.uri);
  } catch {
    return null;
  }
}

// ─── Sentinel constants ─────────────────────────────────────────────────────
// Blob URL'lar sessiya tugaganda eskiradi.
// IndexedDB ga blob URL o'rniga sentinel saqlaymiz, keyin Cache Storage dan qayta o'qiymiz.
const WEB_CACHED_SENTINEL = 'web-cached';

export function useCachedMedia(mediaUrl: string | null | undefined): {
  cachedUrl: string;
  isLoading: boolean;
} {
  const original = mediaUrl ?? '';
  const [cachedUrl, setCachedUrl] = useState<string>(original);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!original) return;

    let cancelled = false;
    let blobObjectUrl: string | null = null;

    const resolve = async () => {
      // 1. IndexedDB dan sentinel yoki native path tekshiramiz
      const cached = await dbGet(original);

      if (cached && !cancelled) {
        if (cached === WEB_CACHED_SENTINEL) {
          // Web kesh: Cache Storage dan YANGI blob URL olamiz (eskisi eskirgan bo'lishi mumkin)
          const freshBlob = await getFromCacheStorage(original);
          if (freshBlob && !cancelled) {
            blobObjectUrl = freshBlob;
            setCachedUrl(freshBlob);
            return; // Tayyor — tarmoqqa ulanmadik
          }
          // Cache Storage tozalangan bo'lsa — sentinel o'chirib, qayta yuklaymiz
          await dbDelete(original);
        } else if (!cached.startsWith('blob:')) {
          // Native (Capacitor) fayl yo'li — doimiy, to'g'ridan-to'g'ri ishlatamiz
          setCachedUrl(cached);
          return;
        } else {
          // Eskirgan blob URL — IndexedDB ni tozalab, qayta yuklaymiz
          await dbDelete(original);
        }
      }

      setIsLoading(true);

      // 2. Platforma bo'yicha yangi kesh yaratamiz
      const isNative = Capacitor.isNativePlatform();
      let localUrl: string | null = null;

      if (isNative) {
        // Mobil: avval mavjudligini tekshiramiz, yo'q bo'lsa saqlaymiz
        localUrl = await getFromCapacitorCache(original);
        if (!localUrl && !cancelled) {
          localUrl = await saveToCapacitorCache(original);
        }
        if (localUrl && !cancelled) {
          setCachedUrl(localUrl);
          await dbSet(original, localUrl); // Native path — doimiy
        } else if (!cancelled) {
          setCachedUrl(original);
        }
      } else {
        // Web/PWA: Cache Storage ishlatamiz
        localUrl = await getFromCacheStorage(original);
        if (!localUrl && !cancelled) {
          localUrl = await saveToCacheStorage(original);
        }
        blobObjectUrl = localUrl;
        if (localUrl && !cancelled) {
          setCachedUrl(localUrl);
          // IndexedDB ga blob URL EMAS, sentinel saqlaymiz
          await dbSet(original, WEB_CACHED_SENTINEL);
        } else if (!cancelled) {
          setCachedUrl(original);
        }
      }

      if (!cancelled) setIsLoading(false);
    };

    resolve().catch(() => {
      if (!cancelled) {
        setCachedUrl(original);
        setIsLoading(false);
      }
    });

    return () => {
      cancelled = true;
      // Blob URL'larni tozalash (memory leak oldini olish)
      if (blobObjectUrl) URL.revokeObjectURL(blobObjectUrl);
    };
  }, [original]);

  return { cachedUrl, isLoading };
}

// ─── Kesh hajmini hisoblash va tozalash (Settings uchun) ────────────────────

export interface CacheStats {
  /** Jami kesh o'lchami (baytlarda) */
  totalBytes: number;
  /** Kesh elementlari soni */
  count: number;
}

/**
 * Brauzer Cache Storage dagi avlodona-media-cache keshining hajmini hisoblaydi.
 */
export async function getMediaCacheStats(): Promise<CacheStats> {
  try {
    if (!('caches' in window)) return { totalBytes: 0, count: 0 };
    const cache = await caches.open(CACHE_NAME);
    const keys = await cache.keys();
    let totalBytes = 0;
    await Promise.all(
      keys.map(async (req) => {
        const res = await cache.match(req);
        if (res) {
          const blob = await res.blob();
          totalBytes += blob.size;
        }
      })
    );
    return { totalBytes, count: keys.length };
  } catch {
    return { totalBytes: 0, count: 0 };
  }
}

/**
 * Barcha keshni tozalaydi (Cache Storage + IndexedDB xaritasi).
 */
export async function clearMediaCache(): Promise<void> {
  try {
    if ('caches' in window) {
      await caches.delete(CACHE_NAME);
    }
  } catch { /* non-fatal */ }

  // IndexedDB xaritasini ham tozalaymiz
  try {
    const all = await dbGetAll();
    for (const { key } of all) {
      await dbDelete(key);
    }
  } catch { /* non-fatal */ }

  // Capacitor keshlari tozalash
  if (Capacitor.isNativePlatform()) {
    try {
      const { Filesystem, Directory } = await import('@capacitor/filesystem');
      await Filesystem.rmdir({
        path: 'media_cache',
        directory: Directory.Cache,
        recursive: true,
      });
    } catch { /* non-fatal */ }
  }
}

/**
 * Muayyan turdagi kesh elementlarini tozalaydi (URL pattern bo'yicha).
 */
export async function clearCacheByType(mimePrefix: string): Promise<number> {
  let cleared = 0;
  try {
    if (!('caches' in window)) return 0;
    const cache = await caches.open(CACHE_NAME);
    const keys = await cache.keys();
    for (const req of keys) {
      const res = await cache.match(req);
      if (res) {
        const ct = res.headers.get('content-type') || '';
        if (ct.startsWith(mimePrefix)) {
          await cache.delete(req);
          await dbDelete(req.url);
          cleared++;
        }
      }
    }
  } catch { /* non-fatal */ }
  return cleared;
}
