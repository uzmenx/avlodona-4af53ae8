import { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Post } from '@/types';

const PAGE_SIZE = 10;

interface CacheData {
  posts: Post[];
  fetchedAt: number;
  hasMore: boolean;
}

// Global cache - persists across component mounts
const globalCacheByKey: Record<string, CacheData | undefined> = {};
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

type PostVisibility = 'public' | 'friends_only' | 'private' | 'profile';

async function fetchPostsPage(from: number, pageSize: number, visibilities: PostVisibility[]): Promise<Post[]> {
  const { data: postsData, error } = await supabase
    .from('posts')
    .select('*')
    .in('visibility', visibilities)
    .order('created_at', { ascending: false })
    .range(from, from + pageSize - 1);

  if (error) throw error;

  let postsWithAuthors: Post[] = [];

  if (postsData && postsData.length > 0) {
    const userIds = [...new Set(postsData.map(p => p.user_id))];
    const { data: profiles } = await supabase
      .from('profiles')
      .select('*')
      .in('id', userIds);

    postsWithAuthors = postsData.map(post => {
      const profile = profiles?.find(p => p.id === post.user_id);
      return {
        ...post,
        media_urls: post.media_urls || [],
        author: profile ? {
          id: post.user_id,
          full_name: profile.name || 'Foydalanuvchi',
          username: profile.username || 'user',
          bio: profile.bio || '',
          avatar_url: profile.avatar_url || '',
          cover_url: '',
          instagram: '',
          telegram: '',
          followers_count: 0,
          following_count: 0,
          relatives_count: 0,
          created_at: post.created_at,
        } : undefined
      };
    });
  }

  return postsWithAuthors;
}

interface UsePostsCacheOptions {
  visibilities?: PostVisibility[];
}

export const usePostsCache = (options?: UsePostsCacheOptions) => {
  const normalizedVisibilities = useMemo(() => {
    const base = (options?.visibilities && options.visibilities.length > 0)
      ? options.visibilities
      : (['public', 'profile', 'friends_only'] as PostVisibility[]);
    return base.slice().sort();
  }, [options?.visibilities?.join('|')]);

  const cacheKey = useMemo(() => normalizedVisibilities.join('|'), [normalizedVisibilities]);
  const globalCache = globalCacheByKey[cacheKey];

  const [posts, setPosts] = useState<Post[]>(globalCache?.posts || []);
  const [isLoading, setIsLoading] = useState(!globalCache);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(globalCache?.hasMore ?? true);
  const isFetchingRef = useRef(false);

  const isCacheValid = useCallback(() => {
    const cache = globalCacheByKey[cacheKey];
    if (!cache) return false;
    const now = Date.now();
    return (now - cache.fetchedAt) < CACHE_TTL;
  }, [cacheKey]);

  const fetchPosts = useCallback(async (forceRefresh = false) => {
    if (isFetchingRef.current) return;

    const cache = globalCacheByKey[cacheKey];

    if (cache && !forceRefresh) {
      // SWR: show stale instantly
      setPosts(cache.posts);
      setHasMore(cache.hasMore);
      setIsLoading(false);

      // If cache is still fully valid, don't even fetch in background
      if (isCacheValid()) return;
    } else if (forceRefresh) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }

    isFetchingRef.current = true;

    try {
      console.log('Fetching posts with visibilities:', normalizedVisibilities);
      const postsWithAuthors = await fetchPostsPage(0, PAGE_SIZE, normalizedVisibilities);
      console.log('Fetched posts count:', postsWithAuthors.length);

      const hasMoreData = postsWithAuthors.length >= PAGE_SIZE;

      globalCacheByKey[cacheKey] = {
        posts: postsWithAuthors,
        fetchedAt: Date.now(),
        hasMore: hasMoreData,
      };

      setPosts(postsWithAuthors);
      setHasMore(hasMoreData);
    } catch (error) {
      console.error('Error fetching posts in cache hook:', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
      isFetchingRef.current = false;
    }
  }, [cacheKey, isCacheValid, normalizedVisibilities]);

  const loadMore = useCallback(async () => {
    if (isFetchingRef.current || !hasMore || posts.length === 0) return;

    isFetchingRef.current = true;
    setIsLoadingMore(true);

    try {
      const nextPosts = await fetchPostsPage(posts.length, PAGE_SIZE, normalizedVisibilities);
      const hasMoreData = nextPosts.length >= PAGE_SIZE;

      const updatedPosts = [...posts, ...nextPosts];

      const cache = globalCacheByKey[cacheKey];
      if (cache) {
        cache.posts = updatedPosts;
        cache.hasMore = hasMoreData;
        cache.fetchedAt = Date.now();
      }

      setPosts(updatedPosts);
      setHasMore(hasMoreData);
    } catch (error) {
      console.error('Error loading more posts:', error);
    } finally {
      setIsLoadingMore(false);
      isFetchingRef.current = false;
    }
  }, [cacheKey, hasMore, posts, normalizedVisibilities]);

  // Add new post to cache (optimistic)
  const addPostToCache = useCallback((newPost: Post) => {
    const updatedPosts = [newPost, ...posts];
    setPosts(updatedPosts);
    const cache = globalCacheByKey[cacheKey];
    if (cache) {
      cache.posts = updatedPosts;
    }
  }, [cacheKey, posts]);

  // Remove post from cache
  const removePostFromCache = useCallback((postId: string) => {
    const updatedPosts = posts.filter(p => p.id !== postId);
    setPosts(updatedPosts);
    const cache = globalCacheByKey[cacheKey];
    if (cache) {
      cache.posts = updatedPosts;
    }
  }, [cacheKey, posts]);

  // Update post in cache (for like counts, etc.)
  const updatePostInCache = useCallback((postId: string, updates: Partial<Post>) => {
    const updatedPosts = posts.map(p => 
      p.id === postId ? { ...p, ...updates } : p
    );
    setPosts(updatedPosts);
    const cache = globalCacheByKey[cacheKey];
    if (cache) {
      cache.posts = updatedPosts;
    }
  }, [cacheKey, posts]);

  // Clear cache
  const clearCache = useCallback(() => {
    delete globalCacheByKey[cacheKey];
    setPosts([]);
    setHasMore(true);
  }, [cacheKey]);

  const forceRefresh = useCallback(async () => {
    delete globalCacheByKey[cacheKey];
    await fetchPosts(true);
  }, [cacheKey, fetchPosts]);

  // Auto-refresh when a new post is published
  useEffect(() => {
    const handlePublishSuccess = (e: Event) => {
      const ce = e as CustomEvent;
      if (ce.detail?.sharePost) {
        void forceRefresh();
      }
    };
    window.addEventListener('avlodona:publish:success', handlePublishSuccess);
    return () => window.removeEventListener('avlodona:publish:success', handlePublishSuccess);
  }, [forceRefresh]);

  return {
    posts,
    isLoading,
    isRefreshing,
    isLoadingMore,
    hasMore,
    fetchPosts,
    forceRefresh,
    loadMore,
    addPostToCache,
    removePostFromCache,
    updatePostInCache,
    clearCache,
    isCacheValid
  };
};
