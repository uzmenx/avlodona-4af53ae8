import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Post } from '@/types';

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
      // Get posts count
      let fetchCount = 0;
      if (isMemorial) {
        const { count } = await supabase
          .from('posts')
          .select('*', { count: 'exact', head: true })
          .eq('target_member_id', userId)
          .eq('visibility', 'profile');
        fetchCount = count || 0;
      } else {
        const { count } = await supabase
          .from('posts')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', userId)
          .eq('visibility', 'public');
        fetchCount = count || 0;
      }

      setPostsCount(fetchCount);

      // Get posts with profile
      let postsData = null;
      let error = null;
      
      if (isMemorial) {
        const result = await supabase
          .from('posts')
          .select('*')
          .eq('target_member_id', userId)
          .eq('visibility', 'profile')
          .order('created_at', { ascending: false });
        postsData = result.data;
        error = result.error;
      } else {
        const result = await supabase
          .from('posts')
          .select('*')
          .eq('user_id', userId)
          .eq('visibility', 'public')
          .order('created_at', { ascending: false });
        postsData = result.data;
        error = result.error;
      }

      if (error) throw error;

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
