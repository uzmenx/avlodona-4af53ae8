import { useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface Comment {
  id: string;
  post_id: string;
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
  replies?: Comment[];
  isPending?: boolean;
  isFailed?: boolean;
}

export const useComments = (postId: string) => {
  const { user, profile } = useAuth();
  const userId = user?.id;
  
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentsCount, setCommentsCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const pendingCommentsRef = useRef<Map<string, AbortController>>(new Map());

  // Fetch comments with authors - ALWAYS fetches fresh data
  const fetchComments = useCallback(async () => {
    if (!postId) return;
    
    setIsLoading(true);
    try {
      const { data: commentsData, error } = await supabase
        .from('comments')
        .select('*')
        .eq('post_id', postId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching comments:', error);
        setIsLoading(false);
        return;
      }

      if (!commentsData || commentsData.length === 0) {
        setComments([]);
        setCommentsCount(0);
        setIsLoading(false);
        return;
      }

      // Get unique user IDs
      const userIds = [...new Set(commentsData.map(c => c.user_id))];
      
      // Fetch profiles
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, name, username, avatar_url')
        .in('id', userIds);

      // Check which comments user has liked
      let userLikes: string[] = [];
      if (userId) {
        const { data: likes } = await supabase
          .from('comment_likes')
          .select('comment_id')
          .eq('user_id', userId)
          .in('comment_id', commentsData.map(c => c.id));
        
        userLikes = likes?.map(l => l.comment_id) || [];
      }

      // Combine data
      const enrichedComments: Comment[] = commentsData.map(comment => ({
        ...comment,
        author: profiles?.find(p => p.id === comment.user_id),
        isLiked: userLikes.includes(comment.id)
      }));

      // Organize into parent/child structure
      const parentComments = enrichedComments.filter(c => !c.parent_id);
      const childComments = enrichedComments.filter(c => c.parent_id);

      const organizedComments = parentComments.map(parent => ({
        ...parent,
        replies: childComments.filter(child => child.parent_id === parent.id)
      }));

      setComments(organizedComments);
      setCommentsCount(commentsData.length);
    } catch (error) {
      console.error('Error fetching comments:', error);
    } finally {
      setIsLoading(false);
    }
  }, [postId, userId]);

  // OPTIMISTIC Add comment - appears instantly
  const addComment = useCallback(async (content: string, parentId?: string) => {
    if (!userId || !content.trim()) return null;

    // Generate temporary ID
    const tempId = `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Create optimistic comment
    const optimisticComment: Comment = {
      id: tempId,
      post_id: postId,
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

    // OPTIMISTIC UPDATE - comment appears instantly
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

    const controller = new AbortController();
    pendingCommentsRef.current.set(tempId, controller);

    try {
      const { data, error } = await supabase
        .from('comments')
        .insert({
          post_id: postId,
          user_id: userId,
          content: content.trim(),
          parent_id: parentId || null
        })
        .select()
        .single();

      if (error) throw error;

      // Get post owner and create notification
      const { data: post } = await supabase
        .from('posts')
        .select('user_id')
        .eq('id', postId)
        .single();

      if (post && post.user_id !== userId) {
        await supabase.from('notifications').insert({
          user_id: post.user_id,
          actor_id: userId,
          type: 'comment',
          post_id: postId,
          comment_id: data.id,
        });
      }

      // Detect @mentions in comment and send notifications
      const commentMentions = (content.match(/@(\w+)/g) || []).map(m => m.slice(1));
      if (commentMentions.length > 0) {
        const { data: mentionedProfiles } = await supabase
          .from('profiles')
          .select('id, username')
          .in('username', commentMentions);
        if (mentionedProfiles) {
          for (const mp of mentionedProfiles) {
            if (mp.id !== userId) {
              await supabase.from('notifications').insert({
                user_id: mp.id,
                actor_id: userId,
                type: 'mention',
                post_id: postId,
                comment_id: data.id,
              });
            }
          }
        }
      }

      // Replace temp comment with real one
      const realComment: Comment = {
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

      pendingCommentsRef.current.delete(tempId);
      return data;
    } catch (error) {
      console.error('Error adding comment:', error);
      
      // Mark as failed instead of removing
      if (parentId) {
        setComments(prev => prev.map(c => 
          c.id === parentId 
            ? { 
                ...c, 
                replies: (c.replies || []).map(r => 
                  r.id === tempId ? { ...r, isPending: false, isFailed: true } : r
                )
              }
            : c
        ));
      } else {
        setComments(prev => prev.map(c => 
          c.id === tempId ? { ...c, isPending: false, isFailed: true } : c
        ));
      }
      
      pendingCommentsRef.current.delete(tempId);
      return null;
    }
  }, [userId, postId, profile]);

  // Delete comment with optimistic update
  const deleteComment = useCallback(async (commentId: string) => {
    if (!userId) return false;

    // Store for rollback
    const prevComments = [...comments];
    const prevCount = commentsCount;

    // OPTIMISTIC DELETE
    setComments(prev => prev.filter(c => c.id !== commentId).map(c => ({
      ...c,
      replies: c.replies?.filter(r => r.id !== commentId)
    })));
    setCommentsCount(prev => Math.max(0, prev - 1));

    try {
      const { error } = await supabase
        .from('comments')
        .delete()
        .eq('id', commentId)
        .eq('user_id', userId);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error deleting comment:', error);
      // ROLLBACK
      setComments(prevComments);
      setCommentsCount(prevCount);
      return false;
    }
  }, [userId, comments, commentsCount]);

  // OPTIMISTIC Toggle comment like
  const toggleCommentLike = useCallback(async (commentId: string) => {
    if (!userId) return;

    // Find the comment
    let targetComment: Comment | undefined;
    let isReply = false;
    let parentId: string | undefined;

    for (const c of comments) {
      if (c.id === commentId) {
        targetComment = c;
        break;
      }
      const reply = c.replies?.find(r => r.id === commentId);
      if (reply) {
        targetComment = reply;
        isReply = true;
        parentId = c.id;
        break;
      }
    }
    
    if (!targetComment) return;

    const prevIsLiked = targetComment.isLiked;
    const prevCount = targetComment.likes_count;

    // OPTIMISTIC UPDATE
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
        const { error } = await supabase
          .from('comment_likes')
          .delete()
          .eq('comment_id', commentId)
          .eq('user_id', userId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('comment_likes')
          .insert({ comment_id: commentId, user_id: userId });
        if (error) throw error;
      }
    } catch (error) {
      console.error('Error toggling comment like:', error);
      // ROLLBACK
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

  // Retry failed comment
  const retryComment = useCallback(async (tempId: string) => {
    let failedComment: Comment | undefined;
    
    for (const c of comments) {
      if (c.id === tempId && c.isFailed) {
        failedComment = c;
        break;
      }
      const reply = c.replies?.find(r => r.id === tempId && r.isFailed);
      if (reply) {
        failedComment = reply;
        break;
      }
    }
    
    if (!failedComment) return;

    // Remove failed comment
    setComments(prev => prev.filter(c => c.id !== tempId).map(c => ({
      ...c,
      replies: c.replies?.filter(r => r.id !== tempId)
    })));
    setCommentsCount(prev => Math.max(0, prev - 1));

    // Re-add
    await addComment(failedComment.content, failedComment.parent_id || undefined);
  }, [comments, addComment]);

  return {
    comments,
    commentsCount,
    isLoading,
    fetchComments,
    addComment,
    deleteComment,
    toggleCommentLike,
    retryComment
  };
};
