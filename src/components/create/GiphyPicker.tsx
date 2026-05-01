import { useState, useEffect, useRef, useCallback, memo } from 'react';
import { Search, X, Sparkles, Sticker, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';

const GIPHY_KEY = import.meta.env.VITE_GIPHY_API_KEY as string;
const GIPHY_API = 'https://api.giphy.com/v1';

export interface GiphyItem {
  id: string;
  title: string;
  previewUrl: string;
  originalUrl: string;
  width: number;
  height: number;
  isSticker: boolean;
}

interface GiphyPickerProps {
  onSelect: (gif: GiphyItem) => void;
  onClose: () => void;
}

type Tab = 'gif' | 'sticker';

function parseGiphy(data: Record<string, any>[], isSticker: boolean): GiphyItem[] {
  return data.map((item: Record<string, any>) => {
    const optimized =
      item.images?.fixed_height?.url ??
      item.images?.fixed_width?.url ??
      item.images?.original?.url ??
      '';
    return {
      id: item.id,
      title: item.title ?? '',
      previewUrl: item.images?.fixed_height_small?.url ?? item.images?.fixed_width_small?.url ?? optimized,
      originalUrl: optimized,
      width: parseInt(item.images?.fixed_height_small?.width ?? '100', 10),
      height: parseInt(item.images?.fixed_height_small?.height ?? '100', 10),
      isSticker,
    };
  });
}

async function fetchGiphy(endpoint: string, params: Record<string, string | number>): Promise<GiphyItem[]> {
  const url = new URL(`${GIPHY_API}/${endpoint}`);
  url.searchParams.set('api_key', GIPHY_KEY);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, String(v));
  }
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error('GIPHY fetch error');
  const json = await res.json();
  const isSticker = endpoint.startsWith('stickers');
  return parseGiphy(json.data ?? [], isSticker);
}

// ─── Memoized single GIF tile ──────────────────────────────────────────────
const GifTile = memo(({ gif, onSelect }: { gif: GiphyItem; onSelect: (gif: GiphyItem) => void }) => (
  <div
    className="break-inside-avoid mb-1.5 relative group cursor-pointer overflow-hidden rounded-lg"
    onClick={() => onSelect(gif)}
  >
    <img
      src={gif.previewUrl}
      alt={gif.title}
      loading="lazy"
      decoding="async"
      className="w-full object-cover transition-transform duration-150 group-active:scale-95"
      style={{ background: '#1a1a2e', minHeight: 60 }}
    />
    <div className="absolute inset-0 bg-violet-500/20 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg" />
  </div>
));
GifTile.displayName = 'GifTile';

// ─── Main GiphyPicker ──────────────────────────────────────────────────────
export default function GiphyPicker({ onSelect, onClose }: GiphyPickerProps) {
  const [tab, setTab] = useState<Tab>('gif');
  const [query, setQuery] = useState('');
  const [items, setItems] = useState<GiphyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);
  const searchTimerRef = useRef<number>();
  const gridRef = useRef<HTMLDivElement>(null);

  // Drag-to-close via CSS transform on a ref (no React state during drag = no re-renders)
  const containerRef = useRef<HTMLDivElement>(null);
  const startYRef = useRef<number | null>(null);
  const dragActiveRef = useRef(false);

  const load = useCallback(async (q: string, t: Tab, off: number, append: boolean) => {
    setLoading(true);
    try {
      const prefix = t === 'gif' ? 'gifs' : 'stickers';
      const endpoint = q.trim() ? `${prefix}/search` : `${prefix}/trending`;
      const data = await fetchGiphy(endpoint, { q: q.trim(), limit: 20, offset: off, rating: 'pg', lang: 'uz' });
      setItems(prev => append ? [...prev, ...data] : data);
      setHasMore(data.length === 20);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setOffset(0);
    setItems([]);
    load(query, tab, 0, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  useEffect(() => {
    clearTimeout(searchTimerRef.current);
    if (query.trim().length === 0) {
      setOffset(0);
      load('', tab, 0, false);
      return;
    }
    searchTimerRef.current = window.setTimeout(() => {
      setOffset(0);
      load(query, tab, 0, false);
    }, 400);
    return () => clearTimeout(searchTimerRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, tab]);

  const onScroll = useCallback(() => {
    const el = gridRef.current;
    if (!el || loading || !hasMore) return;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 80) {
      const newOffset = offset + 20;
      setOffset(newOffset);
      load(query, tab, newOffset, true);
    }
  }, [loading, hasMore, offset, query, tab, load]);

  // ─── Drag-to-close with direct DOM transforms (no re-renders during drag) ─
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    startYRef.current = e.touches[0].clientY;
    dragActiveRef.current = false;
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (startYRef.current === null) return;
    const diff = e.touches[0].clientY - startYRef.current;
    if (diff > 0) {
      dragActiveRef.current = true;
      if (containerRef.current) {
        containerRef.current.style.transform = `translateY(${diff}px)`;
        containerRef.current.style.transition = 'none';
      }
    }
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (!containerRef.current) return;
    const el = containerRef.current;
    const currentTransform = new DOMMatrix(window.getComputedStyle(el).transform);
    const translateY = currentTransform.m42;

    if (translateY > 120) {
      el.style.transition = 'transform 0.2s ease-out';
      el.style.transform = 'translateY(100%)';
      setTimeout(onClose, 200);
    } else {
      el.style.transition = 'transform 0.2s ease-out';
      el.style.transform = 'translateY(0)';
    }
    startYRef.current = null;
    dragActiveRef.current = false;
  }, [onClose]);

  const handleSelect = useCallback((gif: GiphyItem) => onSelect(gif), [onSelect]);

  return (
    <div
      ref={containerRef}
      className="absolute bottom-0 left-0 right-0 h-[70vh] z-[70] flex flex-col bg-black/90 backdrop-blur-2xl rounded-t-3xl border-t border-white/10 shadow-[0_-8px_32px_rgba(0,0,0,0.5)]"
      style={{ willChange: 'transform' }}
    >
      {/* Drag Handle */}
      <div
        className="flex flex-col items-center justify-center py-2.5 cursor-grab active:cursor-grabbing"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div className="w-10 h-1 rounded-full bg-white/20 mb-1" />
      </div>

      {/* Header */}
      <div className="flex items-center gap-2 px-3 pt-1 pb-2 border-b border-white/10">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40 pointer-events-none" />
          <input
            ref={inputRef}
            autoFocus
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder={tab === 'gif' ? 'GIF qidirish…' : 'Stiker qidirish…'}
            className="w-full pl-9 pr-9 py-2.5 rounded-xl bg-white/10 border border-white/15 text-sm text-white placeholder:text-white/35 focus:outline-none focus:ring-2 focus:ring-violet-500/50"
          />
          {query.length > 0 && (
            <button
              onClick={() => setQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-white/20 flex items-center justify-center"
            >
              <X className="w-3 h-3 text-white" />
            </button>
          )}
        </div>
        <button
          onClick={onClose}
          className="w-9 h-9 rounded-full bg-white/10 border border-white/15 flex items-center justify-center flex-shrink-0"
        >
          <X className="w-4 h-4 text-white" />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 px-3 py-2">
        {([
          { id: 'gif' as Tab, label: 'GIF', icon: <Sparkles className="w-3.5 h-3.5" /> },
          { id: 'sticker' as Tab, label: 'Stiker', icon: <Sticker className="w-3.5 h-3.5" /> },
        ]).map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              'flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-semibold border transition-all',
              tab === t.id
                ? 'bg-violet-600 border-violet-500 text-white shadow-[0_0_12px_rgba(139,92,246,0.4)]'
                : 'bg-white/8 border-white/15 text-white/60'
            )}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
        {!query && (
          <div className="ml-auto flex items-center gap-1 text-white/30 text-[10px]">
            <TrendingUp className="w-3 h-3" />
            <span>Trending</span>
          </div>
        )}
      </div>

      {/* Grid */}
      <div
        ref={gridRef}
        onScroll={onScroll}
        className="flex-1 overflow-y-auto px-2 pb-4"
        style={{ scrollbarWidth: 'none', overscrollBehavior: 'contain' }}
      >
        <div className="columns-2 gap-1.5 space-y-0">
          {items.map(gif => (
            <GifTile key={gif.id} gif={gif} onSelect={handleSelect} />
          ))}
        </div>

        {loading && items.length === 0 && (
          <div className="columns-2 gap-1.5 mt-1">
            {Array.from({ length: 10 }).map((_, i) => (
              <div
                key={i}
                className="break-inside-avoid mb-1.5 rounded-lg bg-white/8 animate-pulse"
                style={{ height: i % 3 === 0 ? 120 : i % 2 === 0 ? 80 : 100 }}
              />
            ))}
          </div>
        )}

        {loading && items.length > 0 && (
          <div className="flex justify-center py-4">
            <div className="w-5 h-5 rounded-full border-2 border-violet-500 border-t-transparent animate-spin" />
          </div>
        )}

        {!loading && items.length === 0 && (
          <div className="flex flex-col items-center justify-center h-40 gap-2">
            <span className="text-3xl">🔍</span>
            <p className="text-white/40 text-sm">Hech narsa topilmadi</p>
          </div>
        )}
      </div>
    </div>
  );
}
