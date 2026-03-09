import { useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Post } from '@/types';

const PAGE_SIZE = 10;

interface CacheData {
  posts: Post[];
  fetchedAt: number;
  hasMore: boolean;
}

// Global cache - persists across component mounts
let globalCache: CacheData | null = null;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

async function fetchPostsPage(from: number, pageSize: number): Promise<Post[]> {
  const { data: postsData, error } = await supabase
    .from('posts')
    .select('*')
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
          email: profile.email || '',
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

export const usePostsCache = () => {
  const [posts, setPosts] = useState<Post[]>(globalCache?.posts || []);
  const [isLoading, setIsLoading] = useState(!globalCache);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(globalCache?.hasMore ?? true);
  const isFetchingRef = useRef(false);

  const isCacheValid = useCallback(() => {
    if (!globalCache) return false;
    const now = Date.now();
    return (now - globalCache.fetchedAt) < CACHE_TTL;
  }, []);

  const fetchPosts = useCallback(async (forceRefresh = false) => {
    if (isFetchingRef.current) return;

    if (!forceRefresh && isCacheValid()) {
      setPosts(globalCache!.posts);
      setHasMore(globalCache!.hasMore);
      setIsLoading(false);
      return;
    }

    isFetchingRef.current = true;

    if (forceRefresh) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }

    try {
      const postsWithAuthors = await fetchPostsPage(0, PAGE_SIZE);

      const hasMoreData = postsWithAuthors.length >= PAGE_SIZE;

      globalCache = {
        posts: postsWithAuthors,
        fetchedAt: Date.now(),
        hasMore: hasMoreData,
      };

      setPosts(postsWithAuthors);
      setHasMore(hasMoreData);
    } catch (error) {
      console.error('Error fetching posts:', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
      isFetchingRef.current = false;
    }
  }, [isCacheValid]);

  const loadMore = useCallback(async () => {
    if (isFetchingRef.current || !hasMore || posts.length === 0) return;

    isFetchingRef.current = true;
    setIsLoadingMore(true);

    try {
      const nextPosts = await fetchPostsPage(posts.length, PAGE_SIZE);
      const hasMoreData = nextPosts.length >= PAGE_SIZE;

      const updatedPosts = [...posts, ...nextPosts];

      if (globalCache) {
        globalCache.posts = updatedPosts;
        globalCache.hasMore = hasMoreData;
        globalCache.fetchedAt = Date.now();
      }

      setPosts(updatedPosts);
      setHasMore(hasMoreData);
    } catch (error) {
      console.error('Error loading more posts:', error);
    } finally {
      setIsLoadingMore(false);
      isFetchingRef.current = false;
    }
  }, [hasMore, posts]);

  // Add new post to cache (optimistic)
  const addPostToCache = useCallback((newPost: Post) => {
    const updatedPosts = [newPost, ...posts];
    setPosts(updatedPosts);
    if (globalCache) {
      globalCache.posts = updatedPosts;
    }
  }, [posts]);

  // Remove post from cache
  const removePostFromCache = useCallback((postId: string) => {
    const updatedPosts = posts.filter(p => p.id !== postId);
    setPosts(updatedPosts);
    if (globalCache) {
      globalCache.posts = updatedPosts;
    }
  }, [posts]);

  // Update post in cache (for like counts, etc.)
  const updatePostInCache = useCallback((postId: string, updates: Partial<Post>) => {
    const updatedPosts = posts.map(p => 
      p.id === postId ? { ...p, ...updates } : p
    );
    setPosts(updatedPosts);
    if (globalCache) {
      globalCache.posts = updatedPosts;
    }
  }, [posts]);

  // Clear cache
  const clearCache = useCallback(() => {
    globalCache = null;
    setPosts([]);
    setHasMore(true);
  }, []);

  return {
    posts,
    isLoading,
    isRefreshing,
    isLoadingMore,
    hasMore,
    fetchPosts,
    loadMore,
    addPostToCache,
    removePostFromCache,
    updatePostInCache,
    clearCache,
    isCacheValid
  };
};
