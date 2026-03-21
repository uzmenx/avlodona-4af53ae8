import { useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface MemorialComment {
  id: string;
  memorial_post_id: string;
  user_id: string;
  content: string;
  parent_id: string | null;
  likes_count: number;
  created_at: string;
  author?: {
    id: string;
    name: string | null;
    username: string | null;
    avatar_url: string | null;
  };
  isLiked?: boolean;
  replies?: MemorialComment[];
  isPending?: boolean;
  isFailed?: boolean;
}

export const useMemorialComments = (memorialPostId: string) => {
  const { user, profile } = useAuth();
  const userId = user?.id;
  
  const [comments, setComments] = useState<MemorialComment[]>([]);
  const [commentsCount, setCommentsCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const pendingCommentsRef = useRef<Map<string, AbortController>>(new Map());

  const fetchComments = useCallback(async () => {
    if (!memorialPostId) return;
    
    setIsLoading(true);
    try {
      const { data: commentsData, error } = await supabase
        .from('memorial_post_comments')
        .select('*')
        .eq('memorial_post_id', memorialPostId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching memorial comments:', error);
        setIsLoading(false);
        return;
      }

      if (!commentsData || commentsData.length === 0) {
        setComments([]);
        setCommentsCount(0);
        setIsLoading(false);
        return;
      }

      const userIds = [...new Set(commentsData.map(c => c.user_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, name, username, avatar_url')
        .in('id', userIds);

      let userLikes: string[] = [];
      if (userId) {
        const { data: likes } = await supabase
          .from('memorial_post_comment_likes')
          .select('comment_id')
          .eq('user_id', userId)
          .in('comment_id', commentsData.map(c => c.id));
        
        userLikes = likes?.map(l => l.comment_id) || [];
      }

      const enrichedComments: MemorialComment[] = commentsData.map(comment => ({
        ...comment,
        author: profiles?.find(p => p.id === comment.user_id),
        isLiked: userLikes.includes(comment.id)
      }));

      const parentComments = enrichedComments.filter(c => !c.parent_id);
      const childComments = enrichedComments.filter(c => c.parent_id);

      const organizedComments = parentComments.map(parent => ({
        ...parent,
        replies: childComments.filter(child => child.parent_id === parent.id)
      }));

      setComments(organizedComments);
      setCommentsCount(commentsData.length);
    } catch (error) {
      console.error('Error fetching memorial comments:', error);
    } finally {
      setIsLoading(false);
    }
  }, [memorialPostId, userId]);

  const addComment = useCallback(async (content: string, parentId?: string) => {
    if (!userId || !content.trim()) return null;

    const tempId = `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const optimisticComment: MemorialComment = {
      id: tempId,
      memorial_post_id: memorialPostId,
      user_id: userId,
      content: content.trim(),
      parent_id: parentId || null,
      likes_count: 0,
      created_at: new Date().toISOString(),
      author: profile ? {
        id: userId,
        name: profile.name,
        username: profile.username,
        avatar_url: profile.avatar_url
      } : undefined,
      isLiked: false,
      isPending: true
    };

    if (parentId) {
      setComments(prev => prev.map(c => 
        c.id === parentId 
          ? { ...c, replies: [...(c.replies || []), optimisticComment] }
          : c
      ));
    } else {
      setComments(prev => [optimisticComment, ...prev]);
    }
    setCommentsCount(prev => prev + 1);

    try {
      const { data, error } = await supabase
        .from('memorial_post_comments')
        .insert({
          memorial_post_id: memorialPostId,
          user_id: userId,
          content: content.trim(),
          parent_id: parentId || null
        })
        .select()
        .single();

      if (error) throw error;

      const realComment: MemorialComment = {
        ...data,
        author: optimisticComment.author,
        isLiked: false,
        isPending: false
      };

      if (parentId) {
        setComments(prev => prev.map(c => 
          c.id === parentId 
            ? { 
                ...c, 
                replies: (c.replies || []).map(r => 
                  r.id === tempId ? realComment : r
                )
              }
            : c
        ));
      } else {
        setComments(prev => prev.map(c => 
          c.id === tempId ? realComment : c
        ));
      }

      return data;
    } catch (error) {
      console.error('Error adding memorial comment:', error);
      if (parentId) {
        setComments(prev => prev.map(c => 
          c.id === parentId 
            ? { 
                ...c, 
                replies: (c.replies || []).filter(r => r.id !== tempId)
              }
            : c
        ));
      } else {
        setComments(prev => prev.filter(c => c.id !== tempId));
      }
      setCommentsCount(prev => Math.max(0, prev - 1));
      return null;
    }
  }, [userId, memorialPostId, profile]);

  const deleteComment = useCallback(async (commentId: string) => {
    if (!userId) return false;
    const prevComments = [...comments];
    const prevCount = commentsCount;

    setComments(prev => prev.filter(c => c.id !== commentId).map(c => ({
      ...c,
      replies: c.replies?.filter(r => r.id !== commentId)
    })));
    setCommentsCount(prev => Math.max(0, prev - 1));

    try {
      const { error } = await supabase
        .from('memorial_post_comments')
        .delete()
        .eq('id', commentId)
        .eq('user_id', userId);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error deleting memorial comment:', error);
      setComments(prevComments);
      setCommentsCount(prevCount);
      return false;
    }
  }, [userId, comments, commentsCount]);

  const toggleCommentLike = useCallback(async (commentId: string) => {
    if (!userId) return;

    let targetComment: MemorialComment | undefined;
    for (const c of comments) {
      if (c.id === commentId) {
        targetComment = c;
        break;
      }
      const reply = c.replies?.find(r => r.id === commentId);
      if (reply) {
        targetComment = reply;
        break;
      }
    }
    
    if (!targetComment) return;

    const prevIsLiked = targetComment.isLiked;
    const prevCount = targetComment.likes_count;

    setComments(prev => prev.map(c => {
      if (c.id === commentId) {
        return {
          ...c,
          isLiked: !c.isLiked,
          likes_count: c.isLiked ? Math.max(0, c.likes_count - 1) : c.likes_count + 1
        };
      }
      if (c.replies) {
        return {
          ...c,
          replies: c.replies.map(r => 
            r.id === commentId
              ? { ...r, isLiked: !r.isLiked, likes_count: r.isLiked ? Math.max(0, r.likes_count - 1) : r.likes_count + 1 }
              : r
          )
        };
      }
      return c;
    }));

    try {
      if (prevIsLiked) {
        await supabase
          .from('memorial_post_comment_likes')
          .delete()
          .eq('comment_id', commentId)
          .eq('user_id', userId);
      } else {
        await supabase
          .from('memorial_post_comment_likes')
          .insert({ comment_id: commentId, user_id: userId });
      }
    } catch (error) {
      console.error('Error toggling memorial comment like:', error);
      setComments(prev => prev.map(c => {
        if (c.id === commentId) {
          return { ...c, isLiked: prevIsLiked, likes_count: prevCount };
        }
        if (c.replies) {
          return {
            ...c,
            replies: c.replies.map(r => 
              r.id === commentId ? { ...r, isLiked: prevIsLiked, likes_count: prevCount } : r
            )
          };
        }
        return c;
      }));
    }
  }, [userId, comments]);

  return {
    comments,
    commentsCount,
    isLoading,
    fetchComments,
    addComment,
    deleteComment,
    toggleCommentLike
  };
};
