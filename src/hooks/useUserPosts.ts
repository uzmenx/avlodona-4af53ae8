import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Post } from '@/types';

const MEMBER_MENTION_COLUMNS = ['family_member_id', 'family_tree_member_id', 'member_id'] as const;

const fetchMentionPostIdsForMember = async (memberId: string) => {
  let lastErr: any = null;
  const columnErrors: string[] = [];
  for (const col of MEMBER_MENTION_COLUMNS) {
    // Prevent excessively deep type instantiation when using dynamic column names
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
  const [posts, setPosts] = useState<Post[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [postsCount, setPostsCount] = useState(0);

  const fetchUserPosts = useCallback(async () => {
    if (!userId) {
      setPosts([]);
      setPostsCount(0);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      let postsData: any[] | null = null;

      if (isMemorial) {
        const { postIds } = await fetchMentionPostIdsForMember(userId);
        setPostsCount(postIds.length);

        if (postIds.length === 0) {
          setPosts([]);
          return;
        }

        const { data, error } = await supabase
          .from('posts')
          .select('*')
          .in('id', postIds)
          .order('created_at', { ascending: false });

        if (error) throw error;
        postsData = data || [];
      } else {
        const { data, error } = await supabase
          .from('posts')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false });

        if (error) throw error;
        postsData = data || [];
        setPostsCount(postsData.length);
      }

      if (postsData && postsData.length > 0) {
        // Fetch profiles for the authors of these posts
        const authorIds = [...new Set(postsData.map(p => p.user_id))];
        const { data: profiles } = await supabase
          .from('profiles')
          .select('*')
          .in('id', authorIds);

        const postsWithAuthor = postsData.map(post => {
          const profile = profiles?.find(p => p.id === post.user_id);
          return {
            ...post,
            media_urls: post.media_urls || [],
            author: profile ? {
              id: profile.id,
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

        setPosts(postsWithAuthor);
      } else {
        setPosts([]);
      }
    } catch (error) {
      console.error('Error fetching user posts:', error);
    } finally {
      setIsLoading(false);
    }
  }, [userId, isMemorial]);

  useEffect(() => {
    fetchUserPosts();
  }, [fetchUserPosts]);

  const removePost = (postId: string) => {
    setPosts(prev => prev.filter(p => p.id !== postId));
    setPostsCount(prev => Math.max(0, prev - 1));
  };

  return { posts, isLoading, postsCount, refetch: fetchUserPosts, removePost };
};
