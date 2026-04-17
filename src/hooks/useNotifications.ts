import { useState, useEffect, useCallback, useRef } from 'react';
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

type RawNotification = {
  id: string;
  user_id: string;
  type: string;
  actor_id: string;
  post_id: string | null;
  comment_id: string | null;
  message_id: string | null;
  is_read: boolean;
  created_at: string;
};

// ─── Enrichment helper ────────────────────────────────────────────────────────
// Enriches a list of raw notifications in a SINGLE parallel round-trip
// (all 4 lookups fire simultaneously, not sequentially)

const enrichNotifications = async (data: RawNotification[]): Promise<Notification[]> => {
  if (!data.length) return [];

  const actorIds    = [...new Set(data.map(n => n.actor_id))];
  const postIds     = [...new Set(data.filter(n => n.post_id && n.type !== 'story_like' && n.type !== 'story').map(n => n.post_id!))];
  const storyIds    = [...new Set(data.filter(n => n.post_id && (n.type === 'story_like' || n.type === 'story')).map(n => n.post_id!))];
  const commentIds  = [...new Set(data.filter(n => n.comment_id).map(n => n.comment_id!))];

  // All 4 queries fire at the same time — no waiting for each other
  const [actorsRes, postsRes, storiesRes, commentsRes] = await Promise.all([
    supabase.from('profiles').select('id, name, username, avatar_url').in('id', actorIds),
    postIds.length > 0
      ? supabase.from('posts').select('id, media_urls, content').in('id', postIds)
      : Promise.resolve({ data: [] }),
    storyIds.length > 0
      ? supabase.from('stories').select('id, media_url, media_type').in('id', storyIds)
      : Promise.resolve({ data: [] }),
    commentIds.length > 0
      ? supabase.from('comments').select('id, content').in('id', commentIds)
      : Promise.resolve({ data: [] }),
  ]);

  const actors   = (actorsRes.data   || []) as { id: string; name: string | null; username: string | null; avatar_url: string | null }[];
  const posts    = (postsRes.data    || []) as { id: string; media_urls: string[] | null; content: string | null }[];
  const stories  = (storiesRes.data  || []) as { id: string; media_url: string | null; media_type: 'image' | 'video' }[];
  const comments = (commentsRes.data || []) as { id: string; content: string }[];

  return data.map(n => ({
    ...n,
    type: n.type as Notification['type'],
    actor:   actors.find(a => a.id === n.actor_id),
    post:    n.type !== 'story_like' && n.type !== 'story' ? posts.find(p => p.id === n.post_id) : undefined,
    story:   n.type === 'story_like' || n.type === 'story'  ? stories.find(s => s.id === n.post_id) : undefined,
    comment: comments.find(c => c.id === n.comment_id),
  }));
};

// ─── Hook ─────────────────────────────────────────────────────────────────────

export const useNotifications = () => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  // Prevent concurrent full-fetches piling up
  const isFetching = useRef(false);

  const fetchNotifications = useCallback(async () => {
    if (!user?.id || isFetching.current) return;
    isFetching.current = true;

    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      const raw = (data || []) as RawNotification[];
      const enriched = await enrichNotifications(raw);
      setNotifications(enriched);
      setUnreadCount(raw.filter(n => !n.is_read).length);
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setIsLoading(false);
      isFetching.current = false;
    }
  }, [user?.id]);

  // Mark one as read
  const markAsRead = useCallback(async (notificationId: string) => {
    // Optimistic update — UI reacts instantly
    setNotifications(prev =>
      prev.map(n => n.id === notificationId ? { ...n, is_read: true } : n)
    );
    setUnreadCount(prev => Math.max(0, prev - 1));

    // Fire-and-forget — no await needed in the UI
    supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', notificationId)
      .then(({ error }) => {
        if (error) console.error('markAsRead error:', error);
      });
  }, []);

  // Mark all as read
  const markAllAsRead = useCallback(async () => {
    if (!user?.id) return;
    // Optimistic update first
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    setUnreadCount(0);

    supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', user.id)
      .eq('is_read', false)
      .then(({ error }) => {
        if (error) console.error('markAllAsRead error:', error);
      });
  }, [user?.id]);

  // Create notification helper
  const createNotification = async (
    targetUserId: string,
    type: 'follow' | 'follow_request' | 'like' | 'comment' | 'message' | 'family_invitation' | 'family_invitation_accepted' | 'mention' | 'collab_request' | 'collab_accepted' | 'story' | 'calendar_event',
    postId?: string,
    commentId?: string,
    messageId?: string
  ) => {
    if (!user?.id || targetUserId === user.id) return;
    await supabase.from('notifications').insert({
      user_id: targetUserId,
      actor_id: user.id,
      type,
      post_id: postId || null,
      comment_id: commentId || null,
      message_id: messageId || null,
    });
  };

  // Initial fetch
  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // Realtime subscription — OPTIMISTIC PREPEND, not full refetch
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel('notifications-realtime-v2')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        async (payload) => {
          const raw = payload.new as RawNotification;
          // Enrich just this ONE new notification — single parallel round-trip
          const [enriched] = await enrichNotifications([raw]);
          if (!enriched) return;

          // Prepend immediately — no full refetch, no loading spinner
          setNotifications(prev => {
            // Avoid duplicates
            if (prev.some(n => n.id === enriched.id)) return prev;
            return [enriched, ...prev].slice(0, 50);
          });
          if (!raw.is_read) setUnreadCount(prev => prev + 1);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const updated = payload.new as RawNotification;
          setNotifications(prev =>
            prev.map(n => n.id === updated.id ? { ...n, ...updated } : n)
          );
          // Recompute unread count
          setNotifications(prev => {
            setUnreadCount(prev.filter(n => !n.is_read).length);
            return prev;
          });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const deleted = payload.old as { id: string };
          setNotifications(prev => {
            const next = prev.filter(n => n.id !== deleted.id);
            setUnreadCount(next.filter(n => !n.is_read).length);
            return next;
          });
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user?.id]);

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
