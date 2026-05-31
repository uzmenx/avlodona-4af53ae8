const DEFAULT_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 kun

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

/**
 * Oddiy cache (default TTL = 7 kun).
 */
export function getCache<T>(key: string): T | null {
  return getCacheWithTTL<T>(key, DEFAULT_TTL_MS);
}

/**
 * TTL’li cache (localStorage).
 * - ttlMs: millisekund
 * - TTL tugasa item o‘chiriladi va null qaytadi
 */
export function getCacheWithTTL<T>(key: string, ttlMs: number): T | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const entry: CacheEntry<T> = JSON.parse(raw);
    if (!entry || typeof entry.timestamp !== 'number') return null;

    if (Date.now() - entry.timestamp > ttlMs) {
      localStorage.removeItem(key);
      return null;
    }
    return entry.data;
  } catch {
    return null;
  }
}

export function setCache<T>(key: string, data: T): void {
  try {
    const entry: CacheEntry<T> = { data, timestamp: Date.now() };
    localStorage.setItem(key, JSON.stringify(entry));
  } catch (e) {
    // Xotira to‘lsa — jim (UX buzilmasin)
    console.warn('Cache write failed:', e);
  }
}

export function removeCache(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    // ignore
  }
}
