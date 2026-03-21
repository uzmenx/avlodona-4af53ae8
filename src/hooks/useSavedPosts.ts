import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Post } from '@/types';

export interface SavedMemorialPost {
  id: string;
  isMemorial: true;
  media_url: string | null;
  media_type: string | null;
  caption: string | null;
  created_by: string;
  created_at: string;
  likes_count?: number;
  views_count?: number;
  savedAt: string;
  author?: {
    id: string;
    name: string | null;
    username: string | null;
    avatar_url: string | null;
  } | null;
}

export type SavedItem = Post | SavedMemorialPost;

export const isMemorialSave = (item: SavedItem): item is SavedMemorialPost =>
  (item as SavedMemorialPost).isMemorial === true;

export const useSavedPosts = () => {
  const { user } = useAuth();
  const [savedPosts, setSavedPosts] = useState<Post[]>([]);
  const [savedMemorialPosts, setSavedMemorialPosts] = useState<SavedMemorialPost[]>([]);
  const [savedPostIds, setSavedPostIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);

  const fetchSavedPosts = useCallback(async () => {
    if (!user) {
      setSavedPosts([]);
      setSavedMemorialPosts([]);
      setSavedPostIds(new Set());
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      // ── Regular saved posts ──────────────────────────────────────────
      const { data: savedData, error: savedError } = await supabase
        .from('saved_posts')
        .select('post_id, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (savedError) throw savedError;

      const postIds = savedData?.map(s => s.post_id) || [];
      setSavedPostIds(new Set(postIds));

      let finalPosts: Post[] = [];
      if (postIds.length > 0) {
        const { data: postsData } = await supabase
          .from('posts')
          .select('*')
          .in('id', postIds);

        if (postsData && postsData.length > 0) {
          const userIds = [...new Set(postsData.map(p => p.user_id))];
          const { data: profiles } = await supabase
            .from('profiles')
            .select('*')
            .in('id', userIds);

          finalPosts = postIds
            .map(postId => {
              const post = postsData.find(p => p.id === postId);
              if (!post) return null;
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
            })
            .filter((p): p is NonNullable<typeof p> => p !== null) as Post[];
        }
      }
      setSavedPosts(finalPosts);

      // ── Memorial saved posts ─────────────────────────────────────────
      const { data: memSavedData } = await (supabase as any)
        .from('memorial_post_saves')
        .select('memorial_post_id, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      const memPostIds: string[] = (memSavedData || []).map((s: any) => s.memorial_post_id);

      if (memPostIds.length > 0) {
        const { data: memPosts } = await (supabase as any)
          .from('memorial_posts')
          .select('*')
          .in('id', memPostIds);

        const memCreatorIds = [...new Set((memPosts || []).map((p: any) => p.created_by))];
        let memProfiles: any[] = [];
        if (memCreatorIds.length > 0) {
          const { data: profs } = await (supabase as any)
            .from('profiles')
            .select('id, name, username, avatar_url')
            .in('id', memCreatorIds);
          memProfiles = profs || [];
        }
        const profileMap = new Map(memProfiles.map((p: any) => [p.id, p]));

        const normalizedMemSaves: SavedMemorialPost[] = memPostIds
          .map((id: string) => {
            const mp = (memPosts || []).find((p: any) => p.id === id);
            if (!mp) return null;
            const savedEntry = (memSavedData || []).find((s: any) => s.memorial_post_id === id);
            return {
              id: mp.id,
              isMemorial: true as const,
              media_url: mp.media_url,
              media_type: mp.media_type,
              caption: mp.caption,
              created_by: mp.created_by,
              created_at: mp.created_at,
              likes_count: mp.likes_count || 0,
              views_count: mp.views_count || 0,
              savedAt: savedEntry?.created_at || mp.created_at,
              author: profileMap.get(mp.created_by) ?? null,
            };
          })
          .filter((p: any): p is SavedMemorialPost => p !== null);

        setSavedMemorialPosts(normalizedMemSaves);
      } else {
        setSavedMemorialPosts([]);
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

    if (isSaved) {
      setSavedPostIds(prev => { const s = new Set(prev); s.delete(postId); return s; });
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
      if (isSaved) {
        setSavedPostIds(prev => new Set([...prev, postId]));
      } else {
        setSavedPostIds(prev => { const s = new Set(prev); s.delete(postId); return s; });
      }
      return isSaved;
    }
  }, [user, savedPostIds]);

  const isPostSaved = useCallback((postId: string) => {
    return savedPostIds.has(postId);
  }, [savedPostIds]);

  return {
    savedPosts,
    savedMemorialPosts,
    savedPostIds,
    isLoading,
    fetchSavedPosts,
    toggleSavePost,
    isPostSaved
  };
};
