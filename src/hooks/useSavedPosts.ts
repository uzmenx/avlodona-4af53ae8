import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Post } from '@/types';

export const useSavedPosts = () => {
  const { user } = useAuth();
  const [savedPosts, setSavedPosts] = useState<Post[]>([]);
  const [savedPostIds, setSavedPostIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);

  const fetchSavedPosts = useCallback(async () => {
    if (!user) {
      setSavedPosts([]);
      setSavedPostIds(new Set());
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      // Get saved post IDs
      const { data: savedData, error: savedError } = await supabase
        .from('saved_posts')
        .select('post_id')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (savedError) throw savedError;

      const postIds = savedData?.map(s => s.post_id) || [];
      setSavedPostIds(new Set(postIds));

      if (postIds.length === 0) {
        setSavedPosts([]);
        setIsLoading(false);
        return;
      }

      // Fetch the actual posts
      const { data: postsData, error: postsError } = await supabase
        .from('posts')
        .select('*')
        .in('id', postIds);

      if (postsError) throw postsError;

      if (postsData && postsData.length > 0) {
        // Fetch profiles for posts
        const userIds = [...new Set(postsData.map(p => p.user_id))];
        const { data: profiles } = await supabase
          .from('profiles')
          .select('*')
          .in('id', userIds);

        // Order posts by saved order
        const postsWithAuthors: Post[] = postIds
          .map(postId => {
            const post = postsData.find(p => p.id === postId);
            if (!post) return null;
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
          })
          .filter((p): p is NonNullable<typeof p> => p !== null) as Post[];

        setSavedPosts(postsWithAuthors);
      } else {
        setSavedPosts([]);
      }
    } catch (error) {
      console.error('Error fetching saved posts:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchSavedPosts();
  }, [fetchSavedPosts]);

  const toggleSavePost = useCallback(async (postId: string) => {
    if (!user) return false;

    const isSaved = savedPostIds.has(postId);

    // Optimistic update
    if (isSaved) {
      setSavedPostIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(postId);
        return newSet;
      });
      setSavedPosts(prev => prev.filter(p => p.id !== postId));
    } else {
      setSavedPostIds(prev => new Set([...prev, postId]));
    }

    try {
      if (isSaved) {
        const { error } = await supabase
          .from('saved_posts')
          .delete()
          .eq('user_id', user.id)
          .eq('post_id', postId);
        
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('saved_posts')
          .insert({ user_id: user.id, post_id: postId });
        
        if (error) throw error;
        
        // Fetch the post to add to savedPosts list
        const { data: postData } = await supabase
          .from('posts')
          .select('*')
          .eq('id', postId)
          .single();

        if (postData) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', postData.user_id)
            .single();

          const newPost: Post = {
            ...postData,
            media_urls: postData.media_urls || [],
            author: profile ? {
              id: postData.user_id,
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
              created_at: postData.created_at,
            } : undefined
          };

          setSavedPosts(prev => [newPost, ...prev]);
        }
      }
      
      return !isSaved;
    } catch (error) {
      console.error('Error toggling save post:', error);
      // Rollback
      if (isSaved) {
        setSavedPostIds(prev => new Set([...prev, postId]));
      } else {
        setSavedPostIds(prev => {
          const newSet = new Set(prev);
          newSet.delete(postId);
          return newSet;
        });
      }
      return isSaved;
    }
  }, [user, savedPostIds]);

  const isPostSaved = useCallback((postId: string) => {
    return savedPostIds.has(postId);
  }, [savedPostIds]);

  return {
    savedPosts,
    savedPostIds,
    isLoading,
    fetchSavedPosts,
    toggleSavePost,
    isPostSaved
  };
};
