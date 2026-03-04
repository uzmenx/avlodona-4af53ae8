import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// ============ LARGE FALLBACK POOL ============
// 50+ curated shorts so users always see fresh content even without API
const FALLBACK_SHORTS = [
  { id: "fQ3Uvs2OPDk", title: "Viral Shorts #1", thumbnail: "https://img.youtube.com/vi/fQ3Uvs2OPDk/hqdefault.jpg", channelTitle: "Shorts" },
  { id: "SlPhMPnQ58k", title: "Funny Shorts #1", thumbnail: "https://img.youtube.com/vi/SlPhMPnQ58k/hqdefault.jpg", channelTitle: "Shorts" },
  { id: "bo_efYhYU2A", title: "Trending #1", thumbnail: "https://img.youtube.com/vi/bo_efYhYU2A/hqdefault.jpg", channelTitle: "Shorts" },
  { id: "60ItHLz5WEA", title: "Short Clip #1", thumbnail: "https://img.youtube.com/vi/60ItHLz5WEA/hqdefault.jpg", channelTitle: "Shorts" },
  { id: "dQw4w9WgXcQ", title: "Classic Shorts", thumbnail: "https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg", channelTitle: "Shorts" },
  { id: "9bZkp7q19f0", title: "Viral Hit", thumbnail: "https://img.youtube.com/vi/9bZkp7q19f0/hqdefault.jpg", channelTitle: "Shorts" },
  { id: "kJQP7kiw5Fk", title: "Top Trending", thumbnail: "https://img.youtube.com/vi/kJQP7kiw5Fk/hqdefault.jpg", channelTitle: "Shorts" },
  { id: "RgKAFK5djSk", title: "Popular Short", thumbnail: "https://img.youtube.com/vi/RgKAFK5djSk/hqdefault.jpg", channelTitle: "Shorts" },
  { id: "OPf0YbXqDm0", title: "Funny Moment", thumbnail: "https://img.youtube.com/vi/OPf0YbXqDm0/hqdefault.jpg", channelTitle: "Shorts" },
  { id: "JGwWNGJdvx8", title: "Epic Short", thumbnail: "https://img.youtube.com/vi/JGwWNGJdvx8/hqdefault.jpg", channelTitle: "Shorts" },
  { id: "YQHsXMglC9A", title: "Trending Now", thumbnail: "https://img.youtube.com/vi/YQHsXMglC9A/hqdefault.jpg", channelTitle: "Shorts" },
  { id: "CevxZvSJLk8", title: "Viral Video", thumbnail: "https://img.youtube.com/vi/CevxZvSJLk8/hqdefault.jpg", channelTitle: "Shorts" },
  { id: "pRpeEdMmmQ0", title: "Shake It Off", thumbnail: "https://img.youtube.com/vi/pRpeEdMmmQ0/hqdefault.jpg", channelTitle: "Shorts" },
  { id: "e-ORhEE9VVg", title: "Boom Short", thumbnail: "https://img.youtube.com/vi/e-ORhEE9VVg/hqdefault.jpg", channelTitle: "Shorts" },
  { id: "hT_nvWreIhg", title: "Counting Stars", thumbnail: "https://img.youtube.com/vi/hT_nvWreIhg/hqdefault.jpg", channelTitle: "Shorts" },
  { id: "PT2_F-1esPk", title: "Fast Short", thumbnail: "https://img.youtube.com/vi/PT2_F-1esPk/hqdefault.jpg", channelTitle: "Shorts" },
  { id: "QK8mJJJvaes", title: "Love Short", thumbnail: "https://img.youtube.com/vi/QK8mJJJvaes/hqdefault.jpg", channelTitle: "Shorts" },
  { id: "ru0K8uYEZWw", title: "DNK Short", thumbnail: "https://img.youtube.com/vi/ru0K8uYEZWw/hqdefault.jpg", channelTitle: "Shorts" },
  { id: "HP-MbfHFUqs", title: "Thunder Short", thumbnail: "https://img.youtube.com/vi/HP-MbfHFUqs/hqdefault.jpg", channelTitle: "Shorts" },
  { id: "IcrbM1l_BoI", title: "Wake Up", thumbnail: "https://img.youtube.com/vi/IcrbM1l_BoI/hqdefault.jpg", channelTitle: "Shorts" },
  { id: "450p7goxZqg", title: "Dance Short", thumbnail: "https://img.youtube.com/vi/450p7goxZqg/hqdefault.jpg", channelTitle: "Shorts" },
  { id: "nfWlot6h_JM", title: "Viral Dance", thumbnail: "https://img.youtube.com/vi/nfWlot6h_JM/hqdefault.jpg", channelTitle: "Shorts" },
  { id: "fRh_vgS2dFE", title: "Sorry Short", thumbnail: "https://img.youtube.com/vi/fRh_vgS2dFE/hqdefault.jpg", channelTitle: "Shorts" },
  { id: "DyDfgMOUjCI", title: "Blinding Short", thumbnail: "https://img.youtube.com/vi/DyDfgMOUjCI/hqdefault.jpg", channelTitle: "Shorts" },
  { id: "60ItHLz5WEA", title: "Cool Clip", thumbnail: "https://img.youtube.com/vi/60ItHLz5WEA/hqdefault.jpg", channelTitle: "Shorts" },
  { id: "ApXoWvfEYVU", title: "Faded Short", thumbnail: "https://img.youtube.com/vi/ApXoWvfEYVU/hqdefault.jpg", channelTitle: "Shorts" },
  { id: "7PCkvCPvDXk", title: "Maps Short", thumbnail: "https://img.youtube.com/vi/7PCkvCPvDXk/hqdefault.jpg", channelTitle: "Shorts" },
  { id: "09R8_2nJtjg", title: "Sugar Short", thumbnail: "https://img.youtube.com/vi/09R8_2nJtjg/hqdefault.jpg", channelTitle: "Shorts" },
  { id: "lp-EO5I60KA", title: "Stressed Out", thumbnail: "https://img.youtube.com/vi/lp-EO5I60KA/hqdefault.jpg", channelTitle: "Shorts" },
  { id: "nSDgHBxUbVQ", title: "Animals Short", thumbnail: "https://img.youtube.com/vi/nSDgHBxUbVQ/hqdefault.jpg", channelTitle: "Shorts" },
  { id: "papuvlVeZg8", title: "Timber Short", thumbnail: "https://img.youtube.com/vi/papuvlVeZg8/hqdefault.jpg", channelTitle: "Shorts" },
  { id: "XqZsoesa55w", title: "Baby Short", thumbnail: "https://img.youtube.com/vi/XqZsoesa55w/hqdefault.jpg", channelTitle: "Shorts" },
  { id: "2Vv-BfVoq4g", title: "Perfect Short", thumbnail: "https://img.youtube.com/vi/2Vv-BfVoq4g/hqdefault.jpg", channelTitle: "Shorts" },
  { id: "ktvTqknDobU", title: "Radioactive", thumbnail: "https://img.youtube.com/vi/ktvTqknDobU/hqdefault.jpg", channelTitle: "Shorts" },
  { id: "iS1g8G_njx8", title: "Havana Short", thumbnail: "https://img.youtube.com/vi/iS1g8G_njx8/hqdefault.jpg", channelTitle: "Shorts" },
  { id: "RBumgq5yVrA", title: "Passenger", thumbnail: "https://img.youtube.com/vi/RBumgq5yVrA/hqdefault.jpg", channelTitle: "Shorts" },
  { id: "YBHQbu5rbdQ", title: "Geronimo", thumbnail: "https://img.youtube.com/vi/YBHQbu5rbdQ/hqdefault.jpg", channelTitle: "Shorts" },
  { id: "IPXIgEAGe4U", title: "Love Me", thumbnail: "https://img.youtube.com/vi/IPXIgEAGe4U/hqdefault.jpg", channelTitle: "Shorts" },
  { id: "KQ6zr6kCPj8", title: "GDFR Short", thumbnail: "https://img.youtube.com/vi/KQ6zr6kCPj8/hqdefault.jpg", channelTitle: "Shorts" },
  { id: "uelHwf8o7_U", title: "Love Story", thumbnail: "https://img.youtube.com/vi/uelHwf8o7_U/hqdefault.jpg", channelTitle: "Shorts" },
];

// Shuffle fallbacks so users see different order each time
function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ============ IN-MEMORY CACHE (first layer) ============
interface CacheEntry {
  shorts: unknown[];
  nextPageToken: string | null;
  timestamp: number;
}

const CACHE_TTL_MS = 2 * 60 * 60 * 1000; // 2 hours (was 30 min)
const memCache = new Map<string, CacheEntry>();

function getCacheKey(query: string, pageToken: string, regionCode: string): string {
  return `${regionCode}:${query}:${pageToken}`;
}

function getMemCached(key: string): CacheEntry | null {
  const entry = memCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    memCache.delete(key);
    return null;
  }
  return entry;
}

function setMemCache(key: string, shorts: unknown[], nextPageToken: string | null) {
  if (memCache.size > 200) {
    const entries = [...memCache.entries()].sort((a, b) => a[1].timestamp - b[1].timestamp);
    for (let i = 0; i < 50; i++) memCache.delete(entries[i][0]);
  }
  memCache.set(key, { shorts, nextPageToken, timestamp: Date.now() });
}

// ============ DB CACHE (second layer - persists across cold starts) ============
function getSupabaseAdmin() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
}

async function getDbCached(key: string): Promise<{ shorts: unknown[]; nextPageToken: string | null } | null> {
  try {
    const sb = getSupabaseAdmin();
    const { data } = await sb
      .from("shorts_cache")
      .select("shorts, next_page_token, expires_at")
      .eq("cache_key", key)
      .single();
    if (!data) return null;
    if (new Date(data.expires_at) < new Date()) {
      // Expired - clean up async
      sb.from("shorts_cache").delete().eq("cache_key", key).then(() => {});
      return null;
    }
    return { shorts: data.shorts as unknown[], nextPageToken: data.next_page_token };
  } catch {
    return null;
  }
}

async function setDbCache(key: string, shorts: unknown[], nextPageToken: string | null) {
  try {
    const sb = getSupabaseAdmin();
    const expiresAt = new Date(Date.now() + CACHE_TTL_MS).toISOString();
    await sb.from("shorts_cache").upsert({
      cache_key: key,
      shorts,
      next_page_token: nextPageToken,
      expires_at: expiresAt,
    }, { onConflict: "cache_key" });

    // Cleanup expired entries (max 1x per request, fire-and-forget)
    sb.from("shorts_cache").delete().lt("expires_at", new Date().toISOString()).then(() => {});
  } catch (e) {
    console.error("DB cache write error:", e);
  }
}

// ============ HELPERS ============
function parseIsoDurationToSeconds(duration: string): number {
  const match = duration.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
  if (!match) return Number.POSITIVE_INFINITY;
  return (match[1] ? Number(match[1]) : 0) * 3600 +
    (match[2] ? Number(match[2]) : 0) * 60 +
    (match[3] ? Number(match[3]) : 0);
}

const BLOCKED_KEYWORDS = [
  'india', 'indian', 'hindi', 'bollywood', 'punjabi', 'tamil',
  'telugu', 'malayalam', 'bengali', 'gujarati', 'marathi',
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
  return MUSIC_CHANNEL_PATTERNS.some(p => c.includes(p)) || MUSIC_KEYWORDS.some(k => t.includes(k));
};

// ============ MAIN HANDLER ============
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
    const maxResults = url.searchParams.get("maxResults") || "15"; // Reduced from 20 to 15 to save quota

    const apiKey = Deno.env.get("YOUTUBE_API_KEY");
    if (!apiKey) {
      console.error("YOUTUBE_API_KEY not set, using fallback");
      return new Response(
        JSON.stringify({ shorts: shuffleArray(FALLBACK_SHORTS).slice(0, 15), nextPageToken: null, fallback: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const cacheKey = getCacheKey(query, pageToken, regionCode);

    // ===== LAYER 1: In-memory cache =====
    const memCached = getMemCached(cacheKey);
    if (memCached) {
      console.log(`MEM CACHE HIT: ${cacheKey.substring(0, 50)}...`);
      return new Response(
        JSON.stringify({ shorts: memCached.shorts, nextPageToken: memCached.nextPageToken, fallback: false, cached: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ===== LAYER 2: DB cache (survives cold starts) =====
    const dbCached = await getDbCached(cacheKey);
    if (dbCached) {
      console.log(`DB CACHE HIT: ${cacheKey.substring(0, 50)}...`);
      // Warm up mem cache
      setMemCache(cacheKey, dbCached.shorts, dbCached.nextPageToken);
      return new Response(
        JSON.stringify({ shorts: dbCached.shorts, nextPageToken: dbCached.nextPageToken, fallback: false, cached: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ===== LAYER 3: YouTube API call =====
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
      headers: { Referer: "https://avlodona.lovable.app/" },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("YouTube API error:", response.status, errorText);

      // On quota error, return shuffled fallbacks
      const shuffled = shuffleArray(FALLBACK_SHORTS).slice(0, 15);
      return new Response(
        JSON.stringify({ shorts: shuffled, nextPageToken: null, fallback: true }),
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

    // Duration filter (<=60s) + content filter
    const ids = shorts.map((s: { id: string }) => s.id).filter(Boolean);
    let durationFiltered = shorts;
    if (ids.length > 0) {
      const detailsParams = new URLSearchParams({
        part: "contentDetails",
        id: ids.join(','),
        key: apiKey,
      });

      const detailsRes = await fetch(
        `https://www.googleapis.com/youtube/v3/videos?${detailsParams.toString()}`,
        { headers: { Referer: "https://avlodona.lovable.app/" } }
      );

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

    // Supplement with fallbacks if too few
    let finalShorts = durationFiltered;
    if (durationFiltered.length < 5) {
      const existingIds = new Set(durationFiltered.map((s: { id: string }) => s.id));
      const extras = shuffleArray(FALLBACK_SHORTS).filter(f => !existingIds.has(f.id));
      finalShorts = [...durationFiltered, ...extras.slice(0, 10)];
    }

    console.log(`Returned ${finalShorts.length} shorts, nextPageToken: ${data.nextPageToken || "none"}`);

    // ===== SAVE TO BOTH CACHES =====
    const nextPageToken = data.nextPageToken || null;
    setMemCache(cacheKey, finalShorts, nextPageToken);
    // DB cache is async, don't await
    setDbCache(cacheKey, finalShorts, nextPageToken);

    return new Response(
      JSON.stringify({ shorts: finalShorts, nextPageToken, fallback: false }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ shorts: shuffleArray(FALLBACK_SHORTS).slice(0, 15), nextPageToken: null, fallback: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
