import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface LikeUser {
  id: string;
  name: string | null;
  username: string | null;
  avatar_url: string | null;
}

// Simple in-memory cache
const likeCache = new Map<string, { isLiked: boolean; count: number; timestamp: number }>();
const CACHE_TTL = 2 * 60 * 1000; // 2 minutes

type LikeSyncEvent = { postId: string; isLiked: boolean; count: number };
const likeSyncEmitter = new EventTarget();
const emitLikeSync = (e: LikeSyncEvent) => {
  likeSyncEmitter.dispatchEvent(new CustomEvent<LikeSyncEvent>('post-like-sync', { detail: e }));
};

export const usePostLikes = (postId: string) => {
  const { user } = useAuth();
  const userId = user?.id;
  
  const [isLiked, setIsLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(0);
  const [likedUsers, setLikedUsers] = useState<LikeUser[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  // Update cache helper
  const updateCache = useCallback((liked: boolean, count: number) => {
    likeCache.set(postId, { isLiked: liked, count, timestamp: Date.now() });
    emitLikeSync({ postId, isLiked: liked, count });
  }, [postId]);

  useEffect(() => {
    if (!postId) return;
    const handler = (evt: Event) => {
      const ce = evt as CustomEvent<LikeSyncEvent>;
      if (!ce.detail || ce.detail.postId !== postId) return;
      setIsLiked(ce.detail.isLiked);
      setLikesCount(ce.detail.count);
    };
    likeSyncEmitter.addEventListener('post-like-sync', handler);
    return () => likeSyncEmitter.removeEventListener('post-like-sync', handler);
  }, [postId]);

  // Check like status from DB
  const checkLikeStatus = useCallback(async (): Promise<boolean> => {
    if (!userId) return false;
    
    const { data } = await supabase
      .from('post_likes')
      .select('id')
      .eq('post_id', postId)
      .eq('user_id', userId)
      .maybeSingle();
    
    return !!data;
  }, [postId, userId]);

  // Get likes count from DB
  const fetchLikesCount = useCallback(async (): Promise<number> => {
    const { count } = await supabase
      .from('post_likes')
      .select('*', { count: 'exact', head: true })
      .eq('post_id', postId);
    
    return count || 0;
  }, [postId]);

  // Fetch users who liked (for dialog)
  const fetchLikedUsers = useCallback(async () => {
    const { data: likes } = await supabase
      .from('post_likes')
      .select('user_id')
      .eq('post_id', postId)
      .order('created_at', { ascending: false })
      .limit(50);

    if (likes && likes.length > 0) {
      const userIds = likes.map(l => l.user_id);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, name, username, avatar_url')
        .in('id', userIds);

      setLikedUsers(profiles || []);
    } else {
      setLikedUsers([]);
    }
  }, [postId]);

  // OPTIMISTIC Toggle like
  const toggleLike = useCallback(async () => {
    if (!userId || isLoading) return;

    // Cancel pending request
    if (abortRef.current) {
      abortRef.current.abort();
    }

    const prevIsLiked = isLiked;
    const prevCount = likesCount;

    // OPTIMISTIC UPDATE - instant UI change
    const newIsLiked = !isLiked;
    const newCount = newIsLiked ? likesCount + 1 : Math.max(0, likesCount - 1);
    
    setIsLiked(newIsLiked);
    setLikesCount(newCount);
    updateCache(newIsLiked, newCount);

    setIsLoading(true);
    abortRef.current = new AbortController();

    try {
      if (prevIsLiked) {
        // Unlike
        const { error } = await supabase
          .from('post_likes')
          .delete()
          .eq('post_id', postId)
          .eq('user_id', userId);
        
        if (error) throw error;
      } else {
        // Like
        const { error } = await supabase
          .from('post_likes')
          .insert({ post_id: postId, user_id: userId });
        
        if (error) throw error;

        // Get post owner and create notification
        const { data: post } = await supabase
          .from('posts')
          .select('user_id')
          .eq('id', postId)
          .single();

        if (post && post.user_id !== userId) {
          // Avoid accidental duplicates (e.g. rapid toggles / retries)
          const { data: existing } = await supabase
            .from('notifications')
            .select('id')
            .eq('user_id', post.user_id)
            .eq('actor_id', userId)
            .eq('type', 'like')
            .eq('post_id', postId)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (!existing) {
            const { error: notifError } = await supabase.from('notifications').insert({
              user_id: post.user_id,
              actor_id: userId,
              type: 'like',
              post_id: postId,
              comment_id: null,
              message_id: null,
              is_read: false,
            });

            if (notifError) {
              console.error('Error creating like notification:', notifError);
            }
          }
        }
      }
    } catch (error: any) {
      if (error?.name === 'AbortError') return;
      
      console.error('Error toggling like:', error);
      // ROLLBACK on error
      setIsLiked(prevIsLiked);
      setLikesCount(prevCount);
      updateCache(prevIsLiked, prevCount);
    } finally {
      setIsLoading(false);
      abortRef.current = null;
    }
  }, [userId, isLoading, isLiked, likesCount, postId, updateCache]);

  // Initialize from cache or fetch from DB
  useEffect(() => {
    if (!postId) return;
    
    let isMounted = true;

    const init = async () => {
      // Check cache first
      const cached = likeCache.get(postId);
      if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
        if (isMounted) {
          setIsLiked(cached.isLiked);
          setLikesCount(cached.count);
          setIsInitialized(true);
          emitLikeSync({ postId, isLiked: cached.isLiked, count: cached.count });
        }
        return;
      }

      // Fetch from DB
      try {
        const [liked, count] = await Promise.all([
          checkLikeStatus(),
          fetchLikesCount()
        ]);

        if (isMounted) {
          setIsLiked(liked);
          setLikesCount(count);
          updateCache(liked, count);
          setIsInitialized(true);
          emitLikeSync({ postId, isLiked: liked, count });
        }
      } catch (error) {
        console.error('Error initializing likes:', error);
        if (isMounted) {
          setIsInitialized(true);
        }
      }
    };

    init();

    return () => {
      isMounted = false;
    };
  }, [postId, checkLikeStatus, fetchLikesCount, updateCache]);

  // Re-check when user changes (login/logout) - using stable userId
  useEffect(() => {
    if (isInitialized) {
      checkLikeStatus().then(liked => {
        setIsLiked(liked);
        updateCache(liked, likesCount);
        emitLikeSync({ postId, isLiked: liked, count: likesCount });
      });
    }
    // Only react to userId changes, not the whole effect dependencies
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  return {
    isLiked,
    likesCount,
    likedUsers,
    isLoading,
    toggleLike,
    fetchLikedUsers,
    refresh: async () => {
      likeCache.delete(postId);
      const [liked, count] = await Promise.all([
        checkLikeStatus(),
        fetchLikesCount()
      ]);
      setIsLiked(liked);
      setLikesCount(count);
      updateCache(liked, count);
      emitLikeSync({ postId, isLiked: liked, count });
    }
  };
};
