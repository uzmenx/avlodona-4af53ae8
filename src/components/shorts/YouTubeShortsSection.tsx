import { useState, useEffect, useRef, useCallback } from 'react';
import { Play, ChevronLeft, ChevronRight, Flame, Loader2, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';

export interface Short {
  id: string;
  title: string;
  thumbnail: string;
  channelTitle: string;
}

interface YouTubeShortsProps {
  onShortClick?: (shorts: Short[], index: number) => void;
  onSearchClick?: () => void;
  onSearchSubmit?: (query: string) => void;
  onShortsChange?: (shorts: Short[]) => void;
}

const SEEN_KEY = 'yt_shorts_seen_ids';
const SEEN_MAX = 200;

function getSeenIds(): Set<string> {
  try {
    const raw = localStorage.getItem(SEEN_KEY);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw));
  } catch { return new Set(); }
}

function markSeen(ids: string[]) {
  try {
    const seen = getSeenIds();
    ids.forEach(id => seen.add(id));
    // Keep only last SEEN_MAX
    const arr = [...seen];
    if (arr.length > SEEN_MAX) arr.splice(0, arr.length - SEEN_MAX);
    localStorage.setItem(SEEN_KEY, JSON.stringify(arr));
  } catch {}
}

// Rotating search queries for variety
const SEARCH_QUERIES = [
  'uzbekistan shorts trending',
  'uzbek viral shorts',
  'toshkent shorts trending',
  'samarkand shorts',
  'bukhara shorts',
  'uzbek prikol shorts',
  'uzbekistan news shorts',
  'toshkent shorts',
  'uzbekistan trending 2025 shorts',
  'uzbekistan funny shorts',
  'shorts comedy viral',
  'shorts music dance trending',
  'trending reels shorts new',
  'funny moments shorts viral',
  'shorts challenge trending',
];

function getRandomQuery(): string {
  return SEARCH_QUERIES[Math.floor(Math.random() * SEARCH_QUERIES.length)];
}

export function YouTubeShortsSection({ onShortClick, onSearchClick, onSearchSubmit, onShortsChange }: YouTubeShortsProps) {
  const [shorts, setShorts] = useState<Short[]>([]);
  const [nextToken, setNextToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [searchText, setSearchText] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const loaderRef = useRef<HTMLDivElement>(null);
  const fetchingRef = useRef(false);
  const currentQueryRef = useRef(getRandomQuery());
  const queryIndexRef = useRef(0);
  const exhaustedQueriesRef = useRef(false);
  const startQueryIndexRef = useRef<number | null>(null);
  const rotatedAtLeastOnceRef = useRef(false);
  const retriesRef = useRef(0);

  const MUSIC_KEYWORDS = ['official video', 'music video', 'lyrics', 'lyric video', 'audio',
    'official audio', 'karaoke', 'remix', 'full album', 'playlist', 'mv', 'song', 'album',
    'concert', 'live performance', 'cover song', 'acoustic version', 'instrumental'];
  const MUSIC_CHANNEL_PATTERNS = [' - topic', 'vevo', 'records', 'music'];

  const isLikelyMusic = useCallback((s: Short) => {
    const t = (s.title || '').toLowerCase();
    const c = (s.channelTitle || '').toLowerCase();
    if (MUSIC_CHANNEL_PATTERNS.some(p => c.includes(p))) return true;
    if (MUSIC_KEYWORDS.some(k => t.includes(k))) return true;
    return false;
  }, []);

  const BLOCKED_KEYWORDS = ['india', 'indian', 'hindi', 'bollywood', 'punjabi', 'tamil', 'telugu', 'malayalam', 'bengali', 'gujarati', 'marathi'];

  const isBlocked = useCallback((s: Short) => {

    const t = (s.title || '').toLowerCase();

    const c = (s.channelTitle || '').toLowerCase();

    return BLOCKED_KEYWORDS.some((k) => t.includes(k) || c.includes(k));

  }, []);

  const fetchShorts = useCallback(async (pageToken?: string) => {
    if (fetchingRef.current) return;
    if (!hasMore && !pageToken) return;
    fetchingRef.current = true;

    const isFirstLoad = !pageToken;
    if (isFirstLoad) {
      setIsLoading(true);
      // If we have nothing yet, start at a random query. Otherwise keep current query when loading more.
      if (shorts.length === 0) {
        queryIndexRef.current = Math.floor(Math.random() * SEARCH_QUERIES.length);
        currentQueryRef.current = SEARCH_QUERIES[queryIndexRef.current] || getRandomQuery();
        startQueryIndexRef.current = queryIndexRef.current;
        rotatedAtLeastOnceRef.current = false;
      }
      exhaustedQueriesRef.current = false;
      setHasMore(true);
      retriesRef.current = 0;
    } else {
      setIsLoadingMore(true);
    }

    try {
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const params = new URLSearchParams({
        q: currentQueryRef.current,
        maxResults: '30',
        regionCode: 'UZ',
        relevanceLanguage: 'uz'
      });
      if (pageToken) params.set('pageToken', pageToken);

      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/fetch-shorts?${params}`,
        { headers: { apikey: anonKey } }
      );
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      const newShorts: Short[] = (data?.shorts || [])
        .filter((s: Short) => !isLikelyMusic(s))
        .filter((s: Short) => !isBlocked(s));
      const newToken: string | null = data?.nextPageToken || null;

      // Filter out already-seen shorts
      const seen = getSeenIds();
      const freshShorts = newShorts.filter(s => !seen.has(s.id));

      setShorts((prev) => {
        const combined = isFirstLoad ? freshShorts : [...prev, ...freshShorts];
        const seenSet = new Set<string>();
        const unique = combined.filter((s) => {
          if (seenSet.has(s.id)) return false;
          seenSet.add(s.id);
          return true;
        });
        return unique;
      });
      setNextToken(newToken);

      const rotateQueryAndContinue = () => {
        // Cycle through SEARCH_QUERIES and keep loading until all exhausted.
        const prevIndex = queryIndexRef.current;
        queryIndexRef.current = (queryIndexRef.current + 1) % SEARCH_QUERIES.length;
        const nextQuery = SEARCH_QUERIES[queryIndexRef.current] || getRandomQuery();
        currentQueryRef.current = nextQuery;

        rotatedAtLeastOnceRef.current = true;

        const start = startQueryIndexRef.current;
        if (start !== null && rotatedAtLeastOnceRef.current && queryIndexRef.current === start) {
          exhaustedQueriesRef.current = true;
        }

        if (exhaustedQueriesRef.current) {
          setHasMore(false);
          setNextToken(null);
          return;
        }

        retriesRef.current = 0;
        fetchingRef.current = false;
        fetchShorts();
      };

      // If we got too few fresh results and have a token, auto-fetch more
      if (freshShorts.length < 5 && newToken && retriesRef.current < 3) {
        retriesRef.current++;
        fetchingRef.current = false;
        fetchShorts(newToken);
        return;
      }

      // If token ended (or filtering removed most items), switch query and continue instead of stopping.
      if (freshShorts.length < 5 && !newToken) {
        rotateQueryAndContinue();
        return;
      }

      if (!newToken) {
        // no more pages for this query; move to next query on next loadMore
        // (but don't immediately rotate if we already got enough results)
        setHasMore(true);
      }
    } catch (err) {
      console.error('Failed to fetch shorts:', err);
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
      fetchingRef.current = false;
    }
  }, [hasMore, isBlocked, isLikelyMusic, shorts.length]);

  useEffect(() => {
    onSearchClick;
  }, [onSearchClick]);

  useEffect(() => {
    // notify parent about the latest list for caching
    // (used for UnifiedFullScreenViewer tab switching)
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    (undefined);
  }, []);

  useEffect(() => {
    fetchShorts();
  }, [fetchShorts]);

  useEffect(() => {
    onShortsChange?.(shorts);
  }, [shorts, onShortsChange]);

  useEffect(() => {
    // keep parent in sync
    // (prop is optional)
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    onShortClick;
  }, [onShortClick]);

  useEffect(() => {
    const handler = () => {
      setShorts([]);
      setNextToken(null);
      setHasMore(true);
      exhaustedQueriesRef.current = false;
      startQueryIndexRef.current = null;
      rotatedAtLeastOnceRef.current = false;
      fetchShorts();
    };
    window.addEventListener('refresh-shorts', handler);
    return () => window.removeEventListener('refresh-shorts', handler);
  }, [fetchShorts]);

  // IntersectionObserver for infinite scroll
  useEffect(() => {
    const el = loaderRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting) return;
        if (isLoadingMore || fetchingRef.current) return;

        if (nextToken) {
          fetchShorts(nextToken);
          return;
        }

        if (hasMore) {
          // token ended for the current query -> fetch will rotate query internally if needed
          fetchShorts();
        }
      },
      { threshold: 0.1 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [nextToken, isLoadingMore, fetchShorts, hasMore]);

  const scroll = useCallback((direction: 'left' | 'right') => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollBy({
      left: direction === 'left' ? -240 : 240,
      behavior: 'smooth'
    });
  }, []);

  // Mark shorts as seen when user clicks to view them
  const handleShortClick = useCallback((allShorts: Short[], index: number) => {
    // Mark clicked + nearby as seen
    const toMark = allShorts.slice(Math.max(0, index - 2), index + 5).map(s => s.id);
    markSeen(toMark);
    try {
      const lastId = allShorts[index]?.id;
      if (lastId) localStorage.setItem('yt_shorts_last_id', lastId);
    } catch {}
    onShortClick?.(allShorts, index);
  }, [onShortClick]);

  if (isLoading) {
    return (
      <div className="px-3 pt-1 pb-2">
        <div className="flex items-center gap-1.5 mb-2">
          <div className="w-4 h-4 rounded bg-muted/50 animate-pulse" />
          <div className="w-16 h-3 rounded bg-muted/50 animate-pulse" />
        </div>
        <div className="flex gap-2 overflow-hidden">
          {[...Array(4)].map((_, i) =>
            <div key={i} className="w-[110px] h-[196px] rounded-2xl bg-muted/30 animate-pulse shrink-0" />
          )}
        </div>
      </div>
    );
  }

  if (shorts.length === 0) return null;

  return (
    <div className="pt-1 pb-0">
      {/* Header */}
      <div className="items-center justify-between mb-1.5 px-[12px] flex flex-row py-[3px]">
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <Flame className="w-3.5 h-3.5 text-destructive" />
          <span className="font-semibold text-xs text-foreground">Shorts</span>
        </div>
        <div className="flex-1 px-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Qidirish..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const q = searchText.trim();
                  if (!q) return;
                  onSearchSubmit?.(q);
                  onSearchClick?.();
                }
              }}
              className="h-7 rounded-full pl-8 pr-3 bg-background/30 border-white/10 backdrop-blur-xl text-xs focus-visible:ring-1 focus-visible:ring-primary/40"
            />
          </div>
        </div>
        <div className="flex gap-0.5 flex-shrink-0">
          <button
            onClick={() => scroll('left')}
            className="w-6 h-6 rounded-full bg-background/60 backdrop-blur-sm flex items-center justify-center border border-border/20">
            <ChevronLeft className="w-3 h-3 text-muted-foreground" />
          </button>
          <button
            onClick={() => scroll('right')}
            className="w-6 h-6 rounded-full bg-background/60 backdrop-blur-sm flex items-center justify-center border border-border/20">
            <ChevronRight className="w-3 h-3 text-muted-foreground" />
          </button>
        </div>
      </div>

      {/* Carousel */}
      <style>{`.shorts-carousel::-webkit-scrollbar{display:none}`}</style>
      <div
        ref={scrollRef}
        className="shorts-carousel flex gap-2 overflow-x-auto px-3 snap-x snap-mandatory shadow-md"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none', WebkitOverflowScrolling: 'touch' }}>
        {shorts.map((short, index) =>
          <div
            key={`${short.id}-${index}`}
            className="relative w-[110px] h-[196px] rounded-2xl overflow-hidden shrink-0 snap-start cursor-pointer group"
            onClick={() => handleShortClick(shorts, index)}>
            <img
              src={short.thumbnail}
              alt={short.title}
              className="absolute inset-0 w-full h-full object-cover"
              loading="lazy"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/10" />
            <div className="absolute inset-0 flex items-center justify-center opacity-80 group-hover:opacity-100 transition-opacity">
              <div className="w-8 h-8 rounded-full bg-background/20 backdrop-blur-md flex items-center justify-center border border-border/20">
                <Play className="w-3.5 h-3.5 text-primary-foreground fill-primary-foreground ml-0.5" />
              </div>
            </div>
            <div className="absolute bottom-0 left-0 right-0 p-1.5 z-10">
              <p className="text-[10px] font-medium leading-tight line-clamp-2 drop-shadow-lg bg-inherit text-gray-300">
                {short.title}
              </p>
              <p className="text-[9px] text-primary-foreground/60 mt-0.5 drop-shadow-lg">
                {short.channelTitle}
              </p>
            </div>
          </div>
        )}

        {/* Loader sentinel */}
        <div ref={loaderRef} className="flex items-center justify-center shrink-0 w-[60px]">
          {isLoadingMore ?
            <Loader2 className="w-5 h-5 text-muted-foreground animate-spin" /> :
            (nextToken || hasMore) ?
              <div className="w-5 h-5 rounded-full border-2 border-muted-foreground/30" /> :
              <p className="text-[9px] text-muted-foreground whitespace-nowrap">Hammasi ✓</p>
          }
        </div>
      </div>
    </div>
  );
}
