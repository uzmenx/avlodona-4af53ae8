import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export function useMemorialPostSocial(memorialPostId: string) {
  const { user } = useAuth();
  const [isLiked, setIsLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(0);
  const [commentsCount, setCommentsCount] = useState(0);
  const [isSaved, setIsSaved] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const init = useCallback(async () => {
    if (!memorialPostId) return;

    const [likeRes, saveRes, countRes, commentRes] = await Promise.all([
      user
        ? (supabase as any)
            .from('memorial_post_likes')
            .select('id')
            .eq('memorial_post_id', memorialPostId)
            .eq('user_id', user.id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      user
        ? (supabase as any)
            .from('memorial_post_saves')
            .select('id')
            .eq('memorial_post_id', memorialPostId)
            .eq('user_id', user.id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      (supabase as any)
        .from('memorial_post_likes')
        .select('*', { count: 'exact', head: true })
        .eq('memorial_post_id', memorialPostId),
      (supabase as any)
        .from('memorial_post_comments')
        .select('*', { count: 'exact', head: true })
        .eq('memorial_post_id', memorialPostId),
    ]);

    setIsLiked(!!likeRes.data);
    setIsSaved(!!saveRes.data);
    setLikesCount(countRes.count ?? 0);
    setCommentsCount(commentRes.count ?? 0);
  }, [memorialPostId, user]);

  useEffect(() => {
    init();
  }, [init]);

  const toggleLike = useCallback(async () => {
    if (!user || isLoading) return;
    setIsLoading(true);

    const newLiked = !isLiked;
    const newCount = newLiked ? likesCount + 1 : Math.max(0, likesCount - 1);
    setIsLiked(newLiked);
    setLikesCount(newCount);

    try {
      if (newLiked) {
        await (supabase as any)
          .from('memorial_post_likes')
          .insert({ memorial_post_id: memorialPostId, user_id: user.id });
      } else {
        await (supabase as any)
          .from('memorial_post_likes')
          .delete()
          .eq('memorial_post_id', memorialPostId)
          .eq('user_id', user.id);
      }
    } catch (e) {
      // Rollback on error
      setIsLiked(!newLiked);
      setLikesCount(likesCount);
      console.error('Error toggling memorial post like:', e);
    } finally {
      setIsLoading(false);
    }
  }, [user, isLoading, isLiked, likesCount, memorialPostId]);

  const toggleSave = useCallback(async () => {
    if (!user || isLoading) return;
    setIsLoading(true);

    const newSaved = !isSaved;
    setIsSaved(newSaved);

    try {
      if (newSaved) {
        await (supabase as any)
          .from('memorial_post_saves')
          .insert({ memorial_post_id: memorialPostId, user_id: user.id });
      } else {
        await (supabase as any)
          .from('memorial_post_saves')
          .delete()
          .eq('memorial_post_id', memorialPostId)
          .eq('user_id', user.id);
      }
    } catch (e) {
      setIsSaved(!newSaved);
      console.error('Error toggling memorial post save:', e);
    } finally {
      setIsLoading(false);
    }
  }, [user, isLoading, isSaved, memorialPostId]);

  const trackView = useCallback(async () => {
    if (!user) return;
    try {
      await (supabase as any)
        .from('memorial_post_views')
        .upsert({ memorial_post_id: memorialPostId, user_id: user.id }, { onConflict: 'memorial_post_id,user_id', ignoreDuplicates: true });
    } catch {
      // Unique constraint violation means already viewed — ignore
    }
  }, [user, memorialPostId]);

  const handleShare = useCallback(async () => {
    const shareUrl = `${window.location.origin}/memorial-post/${memorialPostId}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Xotira post',
          url: shareUrl,
        });
      } catch (err) {
        console.error('Error sharing:', err);
      }
    } else {
      try {
        await navigator.clipboard.writeText(shareUrl);
        // We could add a toast here if we had access to one
      } catch (err) {
        console.error('Error copying to clipboard:', err);
      }
    }
  }, [memorialPostId]);

  return { isLiked, likesCount, commentsCount, isSaved, toggleLike, toggleSave, trackView, handleShare };
}
