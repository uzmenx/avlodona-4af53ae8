import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { getCache, setCache } from '@/lib/localCache';

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

export const useMessages = (conversationId: string | null) => {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [otherUserTyping, setOtherUserTyping] = useState(false);
  const typingTimeoutRef = useRef<NodeJS.Timeout>();

  // Load from cache first
  useEffect(() => {
    if (!conversationId) return;
    const cached = getCache<Message[]>(cacheKey(conversationId));
    if (cached && cached.length > 0) {
      setMessages(cached);
      setIsLoading(false);
    }
  }, [conversationId]);

  const fetchMessages = useCallback(async () => {
    if (!conversationId) return;

    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      const msgs = (data || []) as Message[];
      setMessages(msgs);
      setCache(cacheKey(conversationId), msgs);

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
  }, [conversationId, user?.id]);

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
            return updated;
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId, user?.id]);

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
    otherUserTyping,
    sendMessage,
    setTyping,
    refetch: fetchMessages
  };
};
