import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Post } from '@/types';

export const useUserPosts = (userId: string | undefined) => {
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
      const { count } = await supabase
        .from('posts')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId);

      setPostsCount(count || 0);

      // Get posts with profile
      const { data: postsData, error } = await supabase
        .from('posts')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (postsData && postsData.length > 0) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .single();

        const postsWithAuthor = postsData.map(post => ({
          ...post,
          media_urls: post.media_urls || [],
          author: profile ? {
            id: userId,
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
        }));

        setPosts(postsWithAuthor);
      } else {
        setPosts([]);
      }
    } catch (error) {
      console.error('Error fetching user posts:', error);
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchUserPosts();
  }, [fetchUserPosts]);

  const removePost = (postId: string) => {
    setPosts(prev => prev.filter(p => p.id !== postId));
    setPostsCount(prev => Math.max(0, prev - 1));
  };

  return { posts, isLoading, postsCount, refetch: fetchUserPosts, removePost };
};
