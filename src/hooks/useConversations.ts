import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { getCache, setCache } from '@/lib/localCache';

export interface Conversation {
  id: string;
  participant1_id: string;
  participant2_id: string;
  last_message_at: string;
  created_at: string;
  otherUser: {
    id: string;
    name: string | null;
    username: string | null;
    avatar_url: string | null;
  };
  lastMessage?: {
    content: string;
    sender_id: string;
    created_at: string;
    status: string;
  };
  unreadCount: number;
}

const CACHE_KEY = 'conversations_cache';

export const useConversations = () => {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [totalUnread, setTotalUnread] = useState(0);

  // Load from cache first
  useEffect(() => {
    const cached = getCache<Conversation[]>(CACHE_KEY);
    if (cached && cached.length > 0) {
      setConversations(cached);
      setTotalUnread(cached.reduce((acc, c) => acc + c.unreadCount, 0));
      setIsLoading(false);
    }
  }, []);

  const fetchConversations = useCallback(async () => {
    if (!user?.id) return;

    try {
      const { data: convData, error: convError } = await supabase
        .from('conversations')
        .select('*')
        .or(`participant1_id.eq.${user.id},participant2_id.eq.${user.id}`)
        .order('last_message_at', { ascending: false });

      if (convError) throw convError;

      if (!convData || convData.length === 0) {
        setConversations([]);
        setCache(CACHE_KEY, []);
        setIsLoading(false);
        return;
      }

      const otherUserIds = convData.map(c => 
        c.participant1_id === user.id ? c.participant2_id : c.participant1_id
      );

      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, name, username, avatar_url')
        .in('id', otherUserIds);

      const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);

      const conversationsWithDetails = await Promise.all(
        convData.map(async (conv) => {
          const otherUserId = conv.participant1_id === user.id 
            ? conv.participant2_id 
            : conv.participant1_id;

          const { data: lastMsgData } = await supabase
            .from('messages')
            .select('content, sender_id, created_at, status')
            .eq('conversation_id', conv.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          const { count: unreadCount } = await supabase
            .from('messages')
            .select('*', { count: 'exact', head: true })
            .eq('conversation_id', conv.id)
            .neq('sender_id', user.id)
            .neq('status', 'seen');

          return {
            ...conv,
            otherUser: profileMap.get(otherUserId) || {
              id: otherUserId,
              name: null,
              username: null,
              avatar_url: null
            },
            lastMessage: lastMsgData || undefined,
            unreadCount: unreadCount || 0
          };
        })
      );

      setConversations(conversationsWithDetails);
      setTotalUnread(conversationsWithDetails.reduce((acc, c) => acc + c.unreadCount, 0));
      setCache(CACHE_KEY, conversationsWithDetails);
    } catch (error) {
      console.error('Error fetching conversations:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  // Real-time subscription
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel('conversations-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'messages'
        },
        () => {
          fetchConversations();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, fetchConversations]);

  const getOrCreateConversation = async (otherUserId: string): Promise<string | null> => {
    if (!user?.id) return null;

    try {
      const { data: existing } = await supabase
        .from('conversations')
        .select('id')
        .or(`and(participant1_id.eq.${user.id},participant2_id.eq.${otherUserId}),and(participant1_id.eq.${otherUserId},participant2_id.eq.${user.id})`)
        .maybeSingle();

      if (existing) return existing.id;

      const { data: newConv, error } = await supabase
        .from('conversations')
        .insert({
          participant1_id: user.id,
          participant2_id: otherUserId
        })
        .select('id')
        .single();

      if (error) throw error;
      return newConv.id;
    } catch (error) {
      console.error('Error getting/creating conversation:', error);
      return null;
    }
  };

  return {
    conversations,
    isLoading,
    totalUnread,
    refetch: fetchConversations,
    getOrCreateConversation
  };
};
