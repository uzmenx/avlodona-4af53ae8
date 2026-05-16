/**
 * useGallery — @capacitor-community/media yordamida galereya rasmlarini
 * o'qish uchun custom hook. Ruxsatnomalar, pagination va albumlarni qo'llab-quvvatlaydi.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Capacitor, registerPlugin } from '@capacitor/core';
import { Media, MediaAlbum, MediaAsset } from '@capacitor-community/media';

const Gallery = registerPlugin<any>('Gallery');

export interface GalleryAsset {
  /** Noyob identifikator */
  identifier: string;
  /** WebView ko'rishi mumkin bo'lgan URL (convertFileSrc natijasi) */
  webUrl: string;
  /** Base64 thumbnail (galereya grid uchun tez yuklanadi) */
  thumbnail: string;
  /** Asl fayl yo'li (native) */
  path: string;
  /** Fayl turi */
  mediaType: 'image' | 'video' | 'unknown';
  /** Yaratilgan sana (timestamp) */
  creationDate?: number;
  /** Kenglik (px) */
  width?: number;
  /** Balandlik (px) */
  height?: number;
  /** Video davomiyligi (soniya) */
  duration?: number;
}

export interface GalleryAlbum {
  identifier: string;
  name: string;
  count?: number;
}

export type PermissionStatus = 'granted' | 'limited' | 'denied' | 'prompt' | 'unavailable';

const PAGE_SIZE = 30;

function toWebUrl(path: string): string {
  if (!path) return '';
  try {
    return Capacitor.convertFileSrc(path);
  } catch {
    return path;
  }
}

function mapAsset(raw: MediaAsset): GalleryAsset {
  // @capacitor-community/media v9 API or our custom GalleryPlugin
  const identifier = raw.identifier ?? (raw as any).id ?? '';
  // Our GalleryPlugin returns 'path' as content:// URI
  // @capacitor-community/media returns 'fullPath' as file path
  const rawPath: string = (raw as any).path ?? (raw as any).fullPath ?? (raw as any).filePath ?? '';
  
  // Convert content:// or file:// to WebView-accessible URL
  const webUrl = toWebUrl(rawPath || identifier);
  
  console.log('[mapAsset] id:', identifier, 'path:', rawPath, 'webUrl:', webUrl);

  // v9: data field is base64 thumbnail
  const rawData: string = (raw as any).data ?? '';
  const thumbnail = rawData
    ? (rawData.startsWith('data:') ? rawData : `data:image/jpeg;base64,${rawData}`)
    : webUrl;

  // v9: mediaType is a NUMBER (1=image, 2=video), not a string!
  const rawType = (raw as any).mediaType ?? (raw as any).type ?? '';
  const mediaType: GalleryAsset['mediaType'] =
    rawType === 1 || rawType === '1' || rawType === 'image' ? 'image' :
    rawType === 2 || rawType === '2' || rawType === 'video' ? 'video' : 'unknown';

  const creationDate: number | undefined =
    (raw as any).creationDate
      ? Number((raw as any).creationDate)
      : undefined;

  return {
    identifier,
    webUrl,
    thumbnail,
    path: rawPath || identifier,
    mediaType,
    creationDate,
    width: (raw as any).width,
    height: (raw as any).height,
    duration: (raw as any).duration,
  };
}

// ─── In-memory thumbnail cache ───────────────────────────────────────────────
const thumbnailCache = new Map<string, string>();

export function getCachedThumbnail(identifier: string): string | undefined {
  return thumbnailCache.get(identifier);
}

export function setCachedThumbnail(identifier: string, webUrl: string): void {
  thumbnailCache.set(identifier, webUrl);
}
// ─────────────────────────────────────────────────────────────────────────────

interface UseGalleryOptions {
  /** Bir sahifada nechta asset yuklash */
  pageSize?: number;
  /** Filtr qo'llash uchun albumId */
  albumId?: string | null;
}

interface UseGalleryReturn {
  assets: GalleryAsset[];
  albums: GalleryAlbum[];
  permission: PermissionStatus;
  isLoading: boolean;
  hasMore: boolean;
  isNative: boolean;
  requestPermission: () => Promise<void>;
  loadMore: () => Promise<void>;
  reload: () => Promise<void>;
  selectAlbum: (id: string | null) => void;
}

export function useGallery(options: UseGalleryOptions = {}): UseGalleryReturn {
  const { pageSize = PAGE_SIZE } = options;

  const [permission, setPermission] = useState<PermissionStatus>('prompt');
  const [assets, setAssets] = useState<GalleryAsset[]>([]);
  const [albums, setAlbums] = useState<GalleryAlbum[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [albumId, setAlbumId] = useState<string | null>(options.albumId ?? null);

  const offsetRef = useRef(0);
  const loadingRef = useRef(false);

  const isNative = Capacitor.isNativePlatform();

  // ── Ruxsatnomalar holatini tekshirish ──────────────────────────────────────
  const checkPermission = useCallback(async (): Promise<PermissionStatus> => {
    if (!isNative) return 'unavailable';
    try {
      const result = await Gallery.checkPermissions();
      const res = result as any;
      
      // To'liq ruxsat (Android 13+ photos/videos yoki eskiroq storage)
      const isFull = res.photos === 'granted' || res.publicStorage === 'granted' || res.storage === 'granted';
      // Cheklangan ruxsat (Android 14+ limited access)
      const isLimited = res.limited === 'granted';

      if (isFull) return 'granted';
      if (isLimited) return 'limited';
      
      // Agar ruxsat berilmagan bo'lsa, 'prompt' yoki 'denied' qaytarish
      const anyState = res.photos || res.publicStorage || res.storage || res.limited || 'prompt';
      return anyState as PermissionStatus;
    } catch {
      return 'prompt';
    }
  }, [isNative]);

  // ── Albomlar ro'yxatini yuklash ────────────────────────────────────────────
  const loadAlbums = useCallback(async (): Promise<void> => {
    if (!isNative) return;
    try {
      const result = await Media.getAlbums();
      const list: GalleryAlbum[] = ((result as any).albums ?? []).map((a: MediaAlbum) => ({
        identifier: a.identifier ?? (a as any).id ?? '',
        name: a.name ?? 'Album',
        count: (a as any).count,
      }));
      setAlbums(list);
    } catch (e) {
      console.warn('[useGallery] getAlbums error:', e);
    }
  }, [isNative]);

  // ── Assetlarni yuklash (pagination) ───────────────────────────────────────
  const loadPage = useCallback(async (reset = false): Promise<void> => {
    if (!isNative || loadingRef.current) return;

    const currentOffset = reset ? 0 : offsetRef.current;
    if (!reset && !hasMore) return;

    loadingRef.current = true;
    setIsLoading(true);

    try {
      const params: Record<string, unknown> = {
        quantity: pageSize,
        thumbnailWidth: 200,
        thumbnailHeight: 200,
        thumbnailQuality: 80,
        types: 'all',
        sort: [{ key: 'creationDate', ascending: false }],
      };

      if (albumId) {
        params.albumIdentifier = albumId;
      }

      // v9: getMedias accepts an offset via unofficial workaround OR we slice client-side
      // The official API doesn't support offset, so we fetch cumulatively.
      // On reset we re-fetch from scratch with `quantity` = pageSize
      // On loadMore we increase `quantity` to currentOffset + pageSize.
      params.quantity = currentOffset + pageSize;
      params.offset = currentOffset;

      let result;
      if (Capacitor.getPlatform() === 'android') {
        result = await Gallery.getMedias(params);
        console.log('[useGallery] android result:', result);
      } else {
        result = await Media.getMedias(params as any);
        console.log('[useGallery] ios result:', result);
      }

      const all: GalleryAsset[] = ((result as any).medias ?? []).map(mapAsset);
      console.log('[useGallery] mapped assets count:', all.length);

      // Sort by creationDate descending to ensure newest files are first
      all.sort((a, b) => (b.creationDate || 0) - (a.creationDate || 0));

      const nextPage = all.slice(currentOffset, currentOffset + pageSize);

      if (reset) {
        setAssets(all.slice(0, pageSize));
        offsetRef.current = Math.min(pageSize, all.length);
      } else {
        setAssets(prev => {
          const existingIds = new Set(prev.map(a => a.identifier));
          const fresh = nextPage.filter(a => !existingIds.has(a.identifier));
          return [...prev, ...fresh];
        });
        offsetRef.current = currentOffset + pageSize;
      }

      setHasMore(all.length >= currentOffset + pageSize);
    } catch (e) {
      console.warn('[useGallery] getMedias error:', e);
      setHasMore(false);
    } finally {
      loadingRef.current = false;
      setIsLoading(false);
    }
  }, [albumId, hasMore, isNative, pageSize]);

  // ── Ruxsatnoma so'rash ─────────────────────────────────────────────────────
  const requestPermission = useCallback(async (): Promise<void> => {
    if (!isNative) return;
    try {
      const result = await Gallery.requestPermissions();
      const res = result as any;
      
      const isFull = res.photos === 'granted' || res.publicStorage === 'granted' || res.storage === 'granted';
      const isLimited = res.limited === 'granted';
      const state = isFull ? 'granted' : (isLimited ? 'limited' : 'denied');

      setPermission(state as PermissionStatus);
      if (state === 'granted' || state === 'limited') {
        // Ruxsat olindi — darhol yuklanishni boshlash
        offsetRef.current = 0;
        setAssets([]);
        setHasMore(true);
        await loadAlbums();
        await loadPage(true);
      }
    } catch {
      setPermission('denied');
    }
  }, [isNative, loadAlbums, loadPage]);

  // ── Ilk yuklanish ─────────────────────────────────────────────────────────
  const initialize = useCallback(async (): Promise<void> => {
    if (!isNative) {
      setPermission('unavailable');
      return;
    }
    
    // 1. Avval mavjud ruxsatni so'ramasdan tekshir
    const status = await checkPermission();
    setPermission(status);

    if (status === 'granted' || status === 'limited') {
      // Allaqachon ruxsat bor — darhol yuklash
      offsetRef.current = 0;
      setHasMore(true);
      await loadAlbums();
      await loadPage(true);
      return;
    }
    
    // 2. Ruxsat yo'q (prompt) — avtomatik so'rash
    if (status === 'prompt') {
      try {
        const result = await Gallery.requestPermissions();
        const res = result as any;
        const isFull = res.photos === 'granted' || res.publicStorage === 'granted' || res.storage === 'granted';
        const isLimited = res.limited === 'granted';
        const newStatus = isFull ? 'granted' : isLimited ? 'limited' : 'denied';
        setPermission(newStatus as PermissionStatus);
        if (newStatus === 'granted' || newStatus === 'limited') {
          offsetRef.current = 0;
          setHasMore(true);
          await loadAlbums();
          await loadPage(true);
        }
      } catch {
        setPermission('denied');
      }
    }
  }, [checkPermission, isNative, loadAlbums, loadPage]);

  useEffect(() => {
    initialize();
  }, [initialize]);

  // ── albumId o'zgarganda qayta yuklash ─────────────────────────────────────
  useEffect(() => {
    if (permission !== 'granted' && permission !== 'limited') return;
    offsetRef.current = 0;
    setAssets([]);
    setHasMore(true);
    loadPage(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [albumId]);

  const selectAlbum = useCallback((id: string | null) => {
    setAlbumId(id);
  }, []);

  const reload = useCallback(async (): Promise<void> => {
    offsetRef.current = 0;
    setAssets([]);
    setHasMore(true);
    await loadPage(true);
  }, [loadPage]);

  const loadMore = useCallback(async (): Promise<void> => {
    await loadPage(false);
  }, [loadPage]);

  return {
    assets,
    albums,
    permission,
    isLoading,
    hasMore,
    isNative,
    requestPermission,
    loadMore,
    reload,
    selectAlbum,
  };
}
