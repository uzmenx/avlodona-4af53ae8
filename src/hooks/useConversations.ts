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

      // Batch-fetch last messages for all conversations at once (instead of N+1)
      const convIds = convData.map(c => c.id);
      
      // Fetch the most recent message per conversation in one query
      const { data: allMessages } = await supabase
        .from('messages')
        .select('conversation_id, content, sender_id, created_at, status')
        .in('conversation_id', convIds)
        .order('created_at', { ascending: false });

      // Build a map of conversation_id -> last message
      const lastMessageMap = new Map<string, typeof allMessages extends (infer T)[] | null ? T : never>();
      if (allMessages) {
        for (const msg of allMessages) {
          if (!lastMessageMap.has(msg.conversation_id)) {
            lastMessageMap.set(msg.conversation_id, msg);
          }
        }
      }

      // Batch-fetch unread counts: all unread messages not sent by me
      const { data: unreadMessages } = await supabase
        .from('messages')
        .select('conversation_id')
        .in('conversation_id', convIds)
        .neq('sender_id', user.id)
        .neq('status', 'seen');

      // Count unreads per conversation
      const unreadCountMap = new Map<string, number>();
      if (unreadMessages) {
        for (const msg of unreadMessages) {
          unreadCountMap.set(msg.conversation_id, (unreadCountMap.get(msg.conversation_id) || 0) + 1);
        }
      }

      const conversationsWithDetails = convData.map((conv) => {
        const otherUserId = conv.participant1_id === user.id 
          ? conv.participant2_id 
          : conv.participant1_id;

        const lastMsg = lastMessageMap.get(conv.id);

        return {
          ...conv,
          otherUser: profileMap.get(otherUserId) || {
            id: otherUserId,
            name: null,
            username: null,
            avatar_url: null
          },
          lastMessage: lastMsg ? {
            content: lastMsg.content,
            sender_id: lastMsg.sender_id,
            created_at: lastMsg.created_at,
            status: lastMsg.status,
          } : undefined,
          unreadCount: unreadCountMap.get(conv.id) || 0
        };
      });

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

  // Re-fetch conversations whenever a new message arrives (signalled by
  // GlobalMessageListener) — much cheaper than a blanket realtime subscription
  // that fires for every row change in the messages table.
  useEffect(() => {
    const handler = () => {
      void fetchConversations();
    };
    window.addEventListener('avlodona:new-message', handler);
    return () => window.removeEventListener('avlodona:new-message', handler);
  }, [fetchConversations]);


  const getOrCreateConversation = async (otherUserId: string): Promise<string | null> => {
    if (!user?.id) return null;

    const me = user.id;
    const other = otherUserId;

    try {
      const { data: existing, error: existingError } = await supabase
        .from('conversations')
        .select('id')
        .or(
          `and(participant1_id.eq.${me},participant2_id.eq.${other}),and(participant1_id.eq.${other},participant2_id.eq.${me})`
        )
        .limit(1)
        .maybeSingle();

      if (existingError) throw existingError;
      if (existing) return existing.id;

      const { data: created, error: createError } = await supabase
        .from('conversations')
        .insert({ participant1_id: me, participant2_id: other })
        .select('id')
        .single();

      if (!createError && created) return created.id;

      // Race condition fallback (someone else created it at the same time)
      const { data: after, error: afterError } = await supabase
        .from('conversations')
        .select('id')
        .or(
          `and(participant1_id.eq.${me},participant2_id.eq.${other}),and(participant1_id.eq.${other},participant2_id.eq.${me})`
        )
        .limit(1)
        .maybeSingle();

      if (afterError) throw afterError;
      return after?.id ?? null;
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
