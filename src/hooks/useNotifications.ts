import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface Notification {
  id: string;
  user_id: string;
  type: 'follow' | 'follow_request' | 'like' | 'comment' | 'message' | 'family_invitation' | 'family_invitation_accepted' | 'story_like' | 'story' | 'calendar_event' | 'mention' | 'collab_request' | 'collab_accepted' | 'family_connection_request';
  actor_id: string;
  post_id: string | null;
  comment_id: string | null;
  message_id: string | null;
  is_read: boolean;
  created_at: string;
  actor?: {
    id: string;
    name: string | null;
    username: string | null;
    avatar_url: string | null;
  };
  post?: {
    id: string;
    media_urls: string[] | null;
    content: string | null;
  };
  story?: {
    id: string;
    media_url: string | null;
    media_type: 'image' | 'video';
  };
  comment?: {
    id: string;
    content: string;
  };
}

export const useNotifications = () => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  const fetchNotifications = useCallback(async () => {
    if (!user?.id) return;

    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      if (data && data.length > 0) {
        // Fetch actor profiles
        const actorIds = [...new Set(data.map(n => n.actor_id))];
        const { data: actors } = await supabase
          .from('profiles')
          .select('id, name, username, avatar_url')
          .in('id', actorIds);

        // Fetch posts for like/comment notifications
        const postIds = [...new Set(data.filter(n => n.post_id && n.type !== 'story_like').map(n => n.post_id!))];
        let posts: { id: string; media_urls: string[] | null; content: string | null }[] = [];
        if (postIds.length > 0) {
          const { data: postsData } = await supabase
            .from('posts')
            .select('id, media_urls, content')
            .in('id', postIds);
          posts = postsData || [];
        }

        // Fetch stories for story_like notifications
        const storyIds = [...new Set(data.filter(n => n.post_id && n.type === 'story_like').map(n => n.post_id!))];
        let stories: { id: string; media_url: string | null; media_type: 'image' | 'video' }[] = [];
        if (storyIds.length > 0) {
          const { data: storiesData } = await supabase
            .from('stories')
            .select('id, media_url, media_type')
            .in('id', storyIds);
          stories = (storiesData || []) as { id: string; media_url: string | null; media_type: 'image' | 'video' }[];
        }

        // Fetch comments for comment notifications
        const commentIds = [...new Set(data.filter(n => n.comment_id).map(n => n.comment_id!))];
        let comments: { id: string; content: string }[] = [];
        if (commentIds.length > 0) {
          const { data: commentsData } = await supabase
            .from('comments')
            .select('id, content')
            .in('id', commentIds);
          comments = commentsData || [];
        }

        const enrichedNotifications = data.map(notification => ({
          ...notification,
          type: notification.type as Notification['type'],
          actor: actors?.find(a => a.id === notification.actor_id),
          post: notification.type !== 'story_like' ? posts.find(p => p.id === notification.post_id) : undefined,
          story: notification.type === 'story_like' ? stories.find(s => s.id === notification.post_id) : undefined,
          comment: comments.find(c => c.id === notification.comment_id),
        }));

        setNotifications(enrichedNotifications);
        setUnreadCount(data.filter(n => !n.is_read).length);
      } else {
        setNotifications([]);
        setUnreadCount(0);
      }
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user?.id]);

  // Mark notification as read
  const markAsRead = async (notificationId: string) => {
    try {
      await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', notificationId);

      setNotifications(prev =>
        prev.map(n => n.id === notificationId ? { ...n, is_read: true } : n)
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  // Mark all as read
  const markAllAsRead = async () => {
    if (!user?.id) return;

    try {
      await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', user.id)
        .eq('is_read', false);

      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  };

  // Create notification helper
  const createNotification = async (
    targetUserId: string,
    type: 'follow' | 'follow_request' | 'like' | 'comment' | 'message' | 'family_invitation' | 'family_invitation_accepted' | 'mention' | 'collab_request' | 'collab_accepted' | 'story' | 'calendar_event',
    postId?: string,
    commentId?: string,
    messageId?: string
  ) => {
    if (!user?.id || targetUserId === user.id) return;

    try {
      await supabase.from('notifications').insert({
        user_id: targetUserId,
        actor_id: user.id,
        type,
        post_id: postId || null,
        comment_id: commentId || null,
        message_id: messageId || null,
      });
    } catch (error) {
      console.error('Error creating notification:', error);
    }
  };

  // Initial fetch
  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // Polling every 5 minutes
  useEffect(() => {
    if (!user?.id) return;

    const interval = setInterval(() => {
      fetchNotifications();
    }, 5 * 60 * 1000); // 5 minutes

    return () => clearInterval(interval);
  }, [user?.id, fetchNotifications]);

  // Realtime subscription
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel('notifications-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          fetchNotifications();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, fetchNotifications]);

  return {
    notifications,
    unreadCount,
    isLoading,
    fetchNotifications,
    markAsRead,
    markAllAsRead,
    createNotification,
  };
};
