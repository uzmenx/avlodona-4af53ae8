import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Post } from '@/types';
import { getCacheWithTTL, setCache } from '@/lib/localCache';

const MEMBER_MENTION_COLUMNS = ['family_member_id', 'family_tree_member_id', 'member_id'] as const;

const fetchMentionPostIdsForMember = async (memberId: string) => {
  let lastErr: any = null;
  const columnErrors: string[] = [];
  for (const col of MEMBER_MENTION_COLUMNS) {
    // Prevent excessively deep type instantiation when using dynamic column names
     
    const sb: any = supabase;
    const { data, error } = await sb
      .from('post_mentions')
      .select('post_id')
      .eq(col, memberId);

    if (!error) {
      const postIds = (data || []).map((r: any) => r.post_id).filter(Boolean);
      return { postIds };
    }

    lastErr = error;
    const msg = String((error as any)?.message || '');
    if (msg.toLowerCase().includes('column')) {
      columnErrors.push(msg);
      continue;
    }

    break;
  }

  if (columnErrors.length === MEMBER_MENTION_COLUMNS.length) {
    throw new Error(
      "Supabase API schema cache yangilanmagan ko'rinadi: post_mentions jadvalida memorial ustun(lar)i topilmadi. " +
        "Kerakli ustun: post_mentions.family_member_id. Supabase Settings → API → Reload schema qiling va dev serverni qayta ishga tushiring."
    );
  }
  throw lastErr;
};

export const useUserPosts = (userId: string | undefined, isMemorial: boolean = false) => {
  const queryClient = useQueryClient();
  const DISK_TTL_MS = 30 * 60 * 1000; // 30 minutes
  const PAGE_SIZE = 24; // grid uchun qulay (3x8)

  const cacheKey = useMemo(() => {
    if (!userId) return 'user_posts_cache_v1';
    return `user_posts_cache_v2_${isMemorial ? 'memorial' : 'user'}_${userId}`;
  }, [isMemorial, userId]);

  type Page = {
    items: Post[];
    totalCount?: number;
    nextOffset?: number;
  };

  const fetchPage = useCallback(async ({ pageParam }: { pageParam: number }): Promise<Page> => {
    if (!userId) return { items: [], totalCount: 0, nextOffset: undefined };

    if (isMemorial) {
      // Memorial uchun: hozircha bir martada olib kelamiz (odatda katta emas),
      // keyin UI buzilmasin deb bitta sahifa sifatida qaytaramiz.
      const { postIds } = await fetchMentionPostIdsForMember(userId);
      const postsCount = postIds.length;
      if (postIds.length === 0) return { items: [], totalCount: 0, nextOffset: undefined };

      const { data, error } = await supabase
        .from('posts')
        .select('*')
        .in('id', postIds)
        .order('created_at', { ascending: false });

      if (error) throw error;
      const postsData = (data || []) as any[];

      const authorIds = [...new Set(postsData.map(p => p.user_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('*')
        .in('id', authorIds);

      const items: Post[] = postsData.map((post) => {
        const profile = profiles?.find((p) => p.id === post.user_id);
        return {
          ...post,
          media_urls: post.media_urls || [],
          author: profile ? {
            id: profile.id,
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
          } : undefined,
        };
      });

      return { items, totalCount: postsCount, nextOffset: undefined };
    } else {
      const from = pageParam;
      const to = pageParam + PAGE_SIZE - 1;

      const sb: any = supabase;
      const res = await sb
        .from('posts')
        .select('*', pageParam === 0 ? { count: 'exact' } : undefined)
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .range(from, to);

      if (res.error) throw res.error;

      const postsData = (res.data || []) as any[];
      const totalCount = pageParam === 0
        ? (Number.isFinite(res.count) ? res.count : undefined)
        : undefined;

      if (postsData.length === 0) {
        return { items: [], totalCount, nextOffset: undefined };
      }

      // Attach authors (UI buzilmasin)
      const authorIds = [...new Set(postsData.map(p => p.user_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('*')
        .in('id', authorIds);

      const items: Post[] = postsData.map((post) => {
        const profile = profiles?.find((p) => p.id === post.user_id);
        return {
          ...post,
          media_urls: post.media_urls || [],
          author: profile ? {
            id: profile.id,
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
          } : undefined,
        };
      });

      const nextOffset = items.length >= PAGE_SIZE ? pageParam + items.length : undefined;
      return { items, totalCount, nextOffset };
    }
  }, [isMemorial, userId]);

  const initialData = useMemo(() => {
    if (!userId) return undefined;
    return getCacheWithTTL<{ posts: Post[]; postsCount: number }>(cacheKey, DISK_TTL_MS) ?? undefined;
  }, [DISK_TTL_MS, cacheKey, userId]);

  const infiniteInitialData = useMemo(() => {
    if (!initialData) return undefined;
    const posts = initialData.posts || [];
    const postsCount = initialData.postsCount || posts.length;
    const nextOffset = posts.length < postsCount ? posts.length : undefined;
    return {
      pageParams: [0],
      pages: [{ items: posts, totalCount: postsCount, nextOffset }],
    } as { pageParams: number[]; pages: Page[] };
  }, [initialData]);

  const query = useInfiniteQuery({
    queryKey: ['user-posts', userId, isMemorial],
    enabled: !!userId,
    queryFn: ({ pageParam }) => fetchPage({ pageParam: (pageParam as number) ?? 0 }),
    initialPageParam: 0,
    getNextPageParam: (lastPage, pages) => {
      // Memorial: bitta page
      if (isMemorial) return undefined;
      if (!lastPage.nextOffset) return undefined;

      const firstTotal = pages?.[0]?.totalCount;
      if (typeof firstTotal === 'number' && lastPage.nextOffset >= firstTotal) return undefined;
      return lastPage.nextOffset;
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
    refetchOnWindowFocus: false,
    initialData: infiniteInitialData,
    placeholderData: (prev) => prev,
  });

  // Disk cache (2-qavat)
  useEffect(() => {
    if (!userId) return;
    if (!query.data) return;
    const posts = (query.data.pages || []).flatMap((p) => p.items || []);
    const postsCount = query.data.pages?.[0]?.totalCount ?? posts.length;
    setCache(cacheKey, { posts, postsCount });
  }, [cacheKey, query.data, userId]);

  // UI o‘zgarmasin: ekranga tez chiqarish uchun 1-2 sahifani background’da oldindan olib kelamiz.
  const prefetchedRef = useRef(0);
  useEffect(() => {
    if (isMemorial) return;
    if (!userId) return;
    if (!query.hasNextPage) return;
    if (query.isFetchingNextPage) return;

    const MAX_PREFETCH_PAGES = 2;
    if (prefetchedRef.current >= MAX_PREFETCH_PAGES) return;

    const t = window.setTimeout(() => {
      prefetchedRef.current += 1;
      query.fetchNextPage().catch(() => {});
    }, 250);

    return () => window.clearTimeout(t);
  }, [isMemorial, query.hasNextPage, query.isFetchingNextPage, query.fetchNextPage, userId]);

  const removePost = (postId: string) => {
    if (!userId) return;
    queryClient.setQueryData(['user-posts', userId, isMemorial], (prev: any) => {
      if (!prev) return prev;

      const nextPages = (prev.pages || []).map((p: Page) => ({
        ...p,
        items: (p.items || []).filter((x) => x.id !== postId),
      }));

      // Agar ba’zi page bo‘shab qolsa olib tashlaymiz
      const cleanedPages = nextPages.filter((p: Page) => (p.items || []).length > 0);
      const posts = cleanedPages.flatMap((p: Page) => p.items || []);
      const firstTotal = cleanedPages?.[0]?.totalCount;
      const nextTotal = typeof firstTotal === 'number' ? Math.max(0, firstTotal - 1) : posts.length;

      // persist disk
      setCache(cacheKey, { posts, postsCount: nextTotal });

      return {
        ...prev,
        pages: cleanedPages.map((p: Page, i: number) => (i === 0 ? { ...p, totalCount: nextTotal } : p)),
      };
    });
  };

  // Auto-refresh when a new post is published
  useEffect(() => {
    const handlePublishSuccess = (e: Event) => {
      const ce = e as CustomEvent;
      if (ce.detail?.sharePost) {
        void query.refetch();
      }
    };
    window.addEventListener('avlodona:publish:success', handlePublishSuccess);
    return () => window.removeEventListener('avlodona:publish:success', handlePublishSuccess);
  }, [query]);

  const posts = useMemo(() => {
    return (query.data?.pages || []).flatMap((p) => p.items || []);
  }, [query.data?.pages]);
  const postsCount =
    (query.data?.pages?.[0]?.totalCount ?? posts.length) as number;

  return {
    posts,
    isLoading: query.isLoading && query.data === undefined,
    postsCount,
    hasMore: !!query.hasNextPage,
    isLoadingMore: query.isFetchingNextPage,
    loadMore: () => query.fetchNextPage(),
    refetch: () => query.refetch(),
    removePost,
  };
};
