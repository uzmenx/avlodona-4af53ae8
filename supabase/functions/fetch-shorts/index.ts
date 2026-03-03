import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const FALLBACK_SHORTS = [
  { id: "fQ3Uvs2OPDk", title: "Viral Shorts", thumbnail: "https://img.youtube.com/vi/fQ3Uvs2OPDk/hqdefault.jpg", channelTitle: "Shorts" },
  { id: "SlPhMPnQ58k", title: "Funny Shorts", thumbnail: "https://img.youtube.com/vi/SlPhMPnQ58k/hqdefault.jpg", channelTitle: "Shorts" },
  { id: "bo_efYhYU2A", title: "Trending Shorts", thumbnail: "https://img.youtube.com/vi/bo_efYhYU2A/hqdefault.jpg", channelTitle: "Shorts" },
  { id: "60ItHLz5WEA", title: "Short Clip", thumbnail: "https://img.youtube.com/vi/60ItHLz5WEA/hqdefault.jpg", channelTitle: "Shorts" },
  { id: "dQw4w9WgXcQ", title: "Short Clip", thumbnail: "https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg", channelTitle: "Shorts" },
];

// ============ SERVER-SIDE CACHE ============
// Cache results for 30 minutes to dramatically reduce API calls
// All users hitting the same query within 30 min get cached results
interface CacheEntry {
  shorts: unknown[];
  nextPageToken: string | null;
  timestamp: number;
}

const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes
const cache = new Map<string, CacheEntry>();

function getCacheKey(query: string, pageToken: string, regionCode: string): string {
  return `${regionCode}:${query}:${pageToken}`;
}

function getCached(key: string): CacheEntry | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  return entry;
}

function setCache(key: string, shorts: unknown[], nextPageToken: string | null) {
  // Limit cache size to prevent memory issues
  if (cache.size > 200) {
    // Remove oldest entries
    const entries = [...cache.entries()].sort((a, b) => a[1].timestamp - b[1].timestamp);
    for (let i = 0; i < 50; i++) {
      cache.delete(entries[i][0]);
    }
  }
  cache.set(key, { shorts, nextPageToken, timestamp: Date.now() });
}
// ============ END CACHE ============

function parseIsoDurationToSeconds(duration: string): number {
  const match = duration.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
  if (!match) return Number.POSITIVE_INFINITY;
  const hours = match[1] ? Number(match[1]) : 0;
  const minutes = match[2] ? Number(match[2]) : 0;
  const seconds = match[3] ? Number(match[3]) : 0;
  return hours * 3600 + minutes * 60 + seconds;
}

const BLOCKED_KEYWORDS = [
  'india', 'indian', 'hindi', 'bollywood',
  'punjabi', 'tamil', 'telugu', 'malayalam',
  'bengali', 'gujarati', 'marathi',
];

const MUSIC_KEYWORDS = [
  'official video', 'music video', 'lyrics', 'lyric video', 'audio',
  'official audio', 'karaoke', 'remix', 'full album', 'playlist',
  'mv', 'song', 'album', 'concert', 'live performance', 'cover song',
  'acoustic version', 'instrumental',
];
const MUSIC_CHANNEL_PATTERNS = [' - topic', 'vevo', 'records', 'music'];

const isBlocked = (title?: string, channelTitle?: string) => {
  const t = (title || '').toLowerCase();
  const c = (channelTitle || '').toLowerCase();
  return BLOCKED_KEYWORDS.some((k) => t.includes(k) || c.includes(k));
};

const likelyMusic = (title?: string, channelTitle?: string) => {
  const t = (title || '').toLowerCase();
  const c = (channelTitle || '').toLowerCase();
  if (MUSIC_CHANNEL_PATTERNS.some(p => c.includes(p))) return true;
  if (MUSIC_KEYWORDS.some(k => t.includes(k))) return true;
  return false;
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const rawQuery = url.searchParams.get("q") || "shorts trending viral funny";
    const regionCode = (url.searchParams.get('regionCode') || 'UZ').toUpperCase();
    const relevanceLanguage = (url.searchParams.get('relevanceLanguage') || 'uz').toLowerCase();
    const query = rawQuery.includes('-music')
      ? rawQuery
      : `${rawQuery} -music -"official video" -lyrics -"music video" -"official audio" -karaoke -remix -"lyric video" -"full album" -playlist -"topic" -india -hindi -bollywood`;

    const pageToken = url.searchParams.get("pageToken") || "";
    const maxResults = url.searchParams.get("maxResults") || "20";

    const apiKey = Deno.env.get("YOUTUBE_API_KEY");
    if (!apiKey) {
      console.error("YOUTUBE_API_KEY not set, using fallback");
      return new Response(
        JSON.stringify({ shorts: FALLBACK_SHORTS, nextPageToken: null, fallback: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ===== CHECK CACHE FIRST =====
    const cacheKey = getCacheKey(query, pageToken, regionCode);
    const cached = getCached(cacheKey);
    if (cached) {
      console.log(`CACHE HIT: ${cacheKey.substring(0, 60)}... (${cached.shorts.length} shorts)`);
      return new Response(
        JSON.stringify({ shorts: cached.shorts, nextPageToken: cached.nextPageToken, fallback: false, cached: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    // ===== END CACHE CHECK =====

    const searchParams = new URLSearchParams({
      part: "snippet",
      type: "video",
      videoDuration: "short",
      videoEmbeddable: "true",
      q: query,
      maxResults,
      order: "relevance",
      key: apiKey,
    });

    if (regionCode) searchParams.set('regionCode', regionCode);
    if (relevanceLanguage) searchParams.set('relevanceLanguage', relevanceLanguage);
    if (pageToken) searchParams.set("pageToken", pageToken);

    const ytUrl = `https://www.googleapis.com/youtube/v3/search?${searchParams.toString()}`;
    console.log("Fetching YouTube:", ytUrl.replace(apiKey, "KEY"));

    const response = await fetch(ytUrl, {
      headers: {
        Referer: "https://id-preview--a3e75228-4721-4d5e-89be-d93e66feadcd.lovable.app/",
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("YouTube API error:", response.status, errorText);
      return new Response(
        JSON.stringify({ shorts: FALLBACK_SHORTS, nextPageToken: null, fallback: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();

    const shorts = (data.items || [])
      .map((item: Record<string, unknown>) => {
        const id = (item.id as Record<string, unknown>)?.videoId as string;
        const snippet = item.snippet as Record<string, unknown>;
        const thumbnails = snippet?.thumbnails as Record<string, Record<string, unknown>>;
        return {
          id,
          title: snippet?.title as string,
          thumbnail:
            (thumbnails?.high?.url as string) ||
            (thumbnails?.medium?.url as string) ||
            (thumbnails?.default?.url as string),
          channelTitle: snippet?.channelTitle as string,
        };
      })
      .filter((s: { id: string }) => s.id);

    // Enforce Shorts-like durations (<= 60s)
    const ids = shorts.map((s: { id: string }) => s.id).filter(Boolean);
    let durationFiltered = shorts;
    if (ids.length > 0) {
      const detailsParams = new URLSearchParams({
        part: "contentDetails",
        id: ids.join(','),
        key: apiKey,
      });

      const detailsUrl = `https://www.googleapis.com/youtube/v3/videos?${detailsParams.toString()}`;
      const detailsRes = await fetch(detailsUrl, {
        headers: {
          Referer: "https://id-preview--a3e75228-4721-4d5e-89be-d93e66feadcd.lovable.app/",
        },
      });

      if (detailsRes.ok) {
        const details = await detailsRes.json();
        const secondsById = new Map<string, number>();
        for (const item of details.items || []) {
          const vid = item?.id as string;
          const dur = item?.contentDetails?.duration as string;
          if (vid && dur) secondsById.set(vid, parseIsoDurationToSeconds(dur));
        }

        durationFiltered = shorts.filter((s: { id: string; title?: string; channelTitle?: string }) => {
          const sec = secondsById.get(s.id);
          if (typeof sec !== 'number' || sec > 60) return false;
          if (likelyMusic(s.title, s.channelTitle)) return false;
          if (isBlocked(s.title, s.channelTitle)) return false;
          return true;
        });
      }
    }

    console.log(`Returned ${durationFiltered.length} shorts, nextPageToken: ${data.nextPageToken || "none"}`);

    // Supplement with fallbacks if too few
    let finalShorts = durationFiltered;
    if (durationFiltered.length < 5) {
      const existingIds = new Set(durationFiltered.map((s: { id: string }) => s.id));
      const extras = FALLBACK_SHORTS.filter(f => !existingIds.has(f.id));
      finalShorts = [...durationFiltered, ...extras];
    }

    // ===== SAVE TO CACHE =====
    setCache(cacheKey, finalShorts, data.nextPageToken || null);

    return new Response(
      JSON.stringify({ shorts: finalShorts, nextPageToken: data.nextPageToken || null, fallback: false }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ shorts: FALLBACK_SHORTS, nextPageToken: null, fallback: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
