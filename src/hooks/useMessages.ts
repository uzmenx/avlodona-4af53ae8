import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { getCache, setCache } from '@/lib/localCache';

// Track whether messages have been loaded for the initial fetch loading state
const useMessageCountRef = () => {
  const ref = useRef(0);
  return ref;
};

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  status: 'sent' | 'delivered' | 'seen';
  created_at: string;
  updated_at: string;
  media_url?: string | null;
  media_type?: 'image' | 'video' | 'audio' | null;
}

const cacheKey = (convId: string) => `messages_cache_${convId}`;

const PAGE_SIZE = 30;

type Cursor = {
  oldestCreatedAt: string | null;
  hasMore: boolean;
};

const memoryCache = new Map<string, Message[]>();
const memoryCursorCache = new Map<string, Cursor>();

export const useMessages = (conversationId: string | null) => {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [oldestCreatedAt, setOldestCreatedAt] = useState<string | null>(null);
  const [otherUserTyping, setOtherUserTyping] = useState(false);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout>>();

  // Load from cache first (memory -> localStorage)
  useEffect(() => {
    if (!conversationId) return;

    const mem = memoryCache.get(conversationId);
    if (mem && mem.length > 0) {
      setMessages(mem);
      const cur = memoryCursorCache.get(conversationId);
      if (cur) {
        setOldestCreatedAt(cur.oldestCreatedAt);
        setHasMore(cur.hasMore);
      }
      setIsLoading(false);
      return;
    }

    const cached = getCache<Message[]>(cacheKey(conversationId));
    if (cached && cached.length > 0) {
      setMessages(cached);
      memoryCache.set(conversationId, cached);
      setIsLoading(false);

      const oldest = cached[0]?.created_at ?? null;
      const cursor = { oldestCreatedAt: oldest, hasMore: cached.length >= PAGE_SIZE };
      setOldestCreatedAt(cursor.oldestCreatedAt);
      setHasMore(cursor.hasMore);
      memoryCursorCache.set(conversationId, cursor);
    }
  }, [conversationId]);

  const updateCursor = useCallback((convId: string, nextMessages: Message[]) => {
    const oldest = nextMessages[0]?.created_at ?? null;
    const cursor: Cursor = {
      oldestCreatedAt: oldest,
      hasMore: nextMessages.length >= PAGE_SIZE
    };
    setOldestCreatedAt(cursor.oldestCreatedAt);
    setHasMore(cursor.hasMore);
    memoryCursorCache.set(convId, cursor);
  }, []);

  const messageCountRef = useMessageCountRef();

  // Keep ref in sync with actual message count
  useEffect(() => {
    messageCountRef.current = messages.length;
  }, [messages.length]);

  const fetchMessages = useCallback(async () => {
    if (!conversationId) return;

    if (messageCountRef.current === 0) {
      setIsLoading(true);
    }

    try {
      // Fetch only last PAGE_SIZE messages initially
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: false })
        .limit(PAGE_SIZE);

      if (error) throw error;
      const msgs = ((data || []) as Message[]).slice().reverse();
      setMessages(msgs);
      setCache(cacheKey(conversationId), msgs);
      memoryCache.set(conversationId, msgs);
      updateCursor(conversationId, msgs);

      // Mark messages as seen
      if (user?.id && data && data.length > 0) {
        await supabase
          .from('messages')
          .update({ status: 'seen' })
          .eq('conversation_id', conversationId)
          .neq('sender_id', user.id)
          .neq('status', 'seen');
      }
    } catch (error) {
      console.error('Error fetching messages:', error);
    } finally {
      setIsLoading(false);
    }
  }, [conversationId, updateCursor, user?.id]);

  const loadOlder = useCallback(async () => {
    if (!conversationId) return;
    if (!oldestCreatedAt) return;
    if (!hasMore) return;
    if (isLoadingMore) return;

    setIsLoadingMore(true);
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .lt('created_at', oldestCreatedAt)
        .order('created_at', { ascending: false })
        .limit(PAGE_SIZE);

      if (error) throw error;
      const older = ((data || []) as Message[]).slice().reverse();
      if (older.length === 0) {
        setHasMore(false);
        memoryCursorCache.set(conversationId, { oldestCreatedAt, hasMore: false });
        return;
      }

      setMessages((prev) => {
        const merged = [...older, ...prev];
        setCache(cacheKey(conversationId), merged);
        memoryCache.set(conversationId, merged);
        updateCursor(conversationId, merged);
        return merged;
      });
    } catch (error) {
      console.error('Error loading older messages:', error);
    } finally {
      setIsLoadingMore(false);
    }
  }, [conversationId, hasMore, isLoadingMore, oldestCreatedAt, updateCursor]);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  // Real-time subscription for messages
  useEffect(() => {
    if (!conversationId) return;

    const channel = supabase
      .channel(`messages-${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`
        },
        (payload) => {
          const newMessage = payload.new as Message;
          setMessages(prev => {
            const updated = [...prev, newMessage];
            setCache(cacheKey(conversationId), updated);
            memoryCache.set(conversationId, updated);
            updateCursor(conversationId, updated);
            return updated;
          });
          
          // Mark as seen if from other user
          if (user?.id && newMessage.sender_id !== user.id) {
            supabase
              .from('messages')
              .update({ status: 'seen' })
              .eq('id', newMessage.id)
              .then();
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`
        },
        (payload) => {
          const updatedMessage = payload.new as Message;
          setMessages(prev => {
            const updated = prev.map(m => m.id === updatedMessage.id ? updatedMessage : m);
            setCache(cacheKey(conversationId), updated);
            memoryCache.set(conversationId, updated);
            return updated;
          });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`
        },
        (payload) => {
          const deletedId = (payload.old as any).id;
          setMessages(prev => {
            const updated = prev.filter(m => m.id !== deletedId);
            setCache(cacheKey(conversationId), updated);
            memoryCache.set(conversationId, updated);
            updateCursor(conversationId, updated);
            return updated;
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId, user?.id, updateCursor]);

  // Typing indicator subscription
  useEffect(() => {
    if (!conversationId || !user?.id) return;

    const channel = supabase
      .channel(`typing-${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'typing_indicators',
          filter: `conversation_id=eq.${conversationId}`
        },
        (payload) => {
          if (payload.new && (payload.new as any).user_id !== user.id) {
            setOtherUserTyping((payload.new as any).is_typing);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId, user?.id]);

  const sendMessage = async (content: string, mediaUrl?: string, mediaType?: string) => {
    if (!conversationId || !user?.id) return null;
    
    if (!content.trim() && !mediaUrl) return null;

    try {
      const messageData: any = {
        conversation_id: conversationId,
        sender_id: user.id,
        content: content.trim() || (mediaType === 'audio' ? '🎤 Ovozli xabar' : '📎 Media'),
        status: 'sent'
      };

      if (mediaUrl) {
        messageData.media_url = mediaUrl;
        messageData.media_type = mediaType;
      }

      const { data, error } = await supabase
        .from('messages')
        .insert(messageData)
        .select()
        .single();

      if (error) throw error;
      return data as Message;
    } catch (error) {
      console.error('Error sending message:', error);
      return null;
    }
  };

  const setTyping = useCallback(async (isTyping: boolean) => {
    if (!conversationId || !user?.id) return;

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    try {
      await supabase
        .from('typing_indicators')
        .upsert({
          conversation_id: conversationId,
          user_id: user.id,
          is_typing: isTyping,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'conversation_id,user_id'
        });

      if (isTyping) {
        typingTimeoutRef.current = setTimeout(() => {
          setTyping(false);
        }, 3000);
      }
    } catch (error) {
      console.error('Error setting typing:', error);
    }
  }, [conversationId, user?.id]);

  return {
    messages,
    isLoading,
    isLoadingMore,
    hasMore,
    otherUserTyping,
    sendMessage,
    setTyping,
    loadOlder,
    refetch: fetchMessages
  };
};
