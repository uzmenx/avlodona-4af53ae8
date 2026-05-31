import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
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

// Fast in-memory cache (avoids localStorage parse on repeated navigations)
const memoryCache = new Map<string, Conversation[]>(); // key: userId

export const useConversations = () => {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const persistTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (persistTimerRef.current) window.clearTimeout(persistTimerRef.current);
    };
  }, []);

  const persist = useCallback((next: Conversation[]) => {
    if (!user?.id) return;
    memoryCache.set(user.id, next);
    if (persistTimerRef.current) window.clearTimeout(persistTimerRef.current);
    // Batch writes a little to avoid JSON.stringify on every realtime tick
    persistTimerRef.current = window.setTimeout(() => {
      setCache(CACHE_KEY, next);
    }, 250);
  }, [user?.id]);

  const totalUnread = useMemo(() => {
    return conversations.reduce((acc, c) => acc + (c.unreadCount || 0), 0);
  }, [conversations]);

  // Load from cache first
  useEffect(() => {
    if (!user?.id) {
      setConversations([]);
      setIsLoading(false);
      return;
    }

    const mem = memoryCache.get(user.id);
    if (mem && mem.length > 0) {
      setConversations(mem);
      setIsLoading(false);
      return;
    }

    const cached = getCache<Conversation[]>(CACHE_KEY);
    if (cached && cached.length > 0) {
      setConversations(cached);
      memoryCache.set(user.id, cached);
      setIsLoading(false);
    }
  }, [user?.id]);

  const fetchConversations = useCallback(async () => {
    if (!user?.id) return;

    try {
      // Only show skeleton if we truly have nothing to render yet
      setIsLoading(prev => (conversations.length === 0 ? true : prev));

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

      const convIds = convData.map(c => c.id);

      // Prefer denormalized last message fields (fastest).
      // Backward-compatible fallback: if DB isn't migrated yet, do a capped fetch.
      const hasDenorm = convData.some((c: any) => c?.last_message_content != null || c?.last_message_sender_id != null);
      const lastMessageMap = new Map<string, { conversation_id: string; content: string; sender_id: string; created_at: string; status: string }>();
      if (!hasDenorm) {
        const cap = Math.min(500, Math.max(50, convIds.length * 5));
        const { data: allMessages } = await supabase
          .from('messages')
          .select('conversation_id, content, sender_id, created_at, status')
          .in('conversation_id', convIds)
          .order('created_at', { ascending: false })
          .limit(cap);

        if (allMessages) {
          for (const msg of allMessages as any[]) {
            if (!lastMessageMap.has(msg.conversation_id)) {
              lastMessageMap.set(msg.conversation_id, msg);
            }
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
        const denormContent = (conv as any).last_message_content as string | null | undefined;
        const denormSender = (conv as any).last_message_sender_id as string | null | undefined;
        const denormStatus = (conv as any).last_message_status as string | null | undefined;

        return {
          ...conv,
          otherUser: profileMap.get(otherUserId) || {
            id: otherUserId,
            name: null,
            username: null,
            avatar_url: null
          },
          lastMessage: (denormContent || lastMsg) ? {
            content: denormContent ?? (lastMsg?.content ?? ''),
            sender_id: denormSender ?? (lastMsg?.sender_id ?? ''),
            created_at: (conv as any).last_message_at ?? lastMsg?.created_at ?? conv.created_at,
            status: denormStatus ?? (lastMsg?.status ?? 'sent'),
          } : undefined,
          unreadCount: unreadCountMap.get(conv.id) || 0
        };
      });

      setConversations(conversationsWithDetails);
      persist(conversationsWithDetails);
    } catch (error) {
      console.error('Error fetching conversations:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user?.id, conversations.length, persist]);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  // Diff-only updates from realtime / sendMessage (avoid refetching whole list).
  useEffect(() => {
    const handler = (e: Event) => {
      const ce = e as CustomEvent<any>;
      const detail = ce.detail || {};
      const conversationId: string | undefined = detail.conversationId;
      const message = detail.message as any | undefined;
      const isActiveChat: boolean = !!detail.isActiveChat;

      if (!conversationId || !message) {
        // Backward compatible: older events without payload
        void fetchConversations();
        return;
      }

      setConversations((prev) => {
        const idx = prev.findIndex(c => c.id === conversationId);
        if (idx === -1) {
          // Could be a new conversation — safest to refetch once
          void fetchConversations();
          return prev;
        }

        const current = prev[idx];
        const createdAt = message.created_at || new Date().toISOString();
        const senderId = message.sender_id;
        const isSelf = senderId === user?.id || !!detail.isSelf;

        const nextUnread =
          isSelf ? 0 :
          isActiveChat ? 0 :
          (current.unreadCount || 0) + 1;

        const updatedConv: Conversation = {
          ...current,
          last_message_at: createdAt,
          lastMessage: {
            content: (message.content ?? '').toString(),
            sender_id: senderId,
            created_at: createdAt,
            status: (message.status ?? 'sent').toString(),
          },
          unreadCount: nextUnread,
          otherUser: detail.sender?.id === current.otherUser?.id ? detail.sender : current.otherUser,
        };

        const next = prev.slice();
        next.splice(idx, 1);
        // Move to top (Telegram style)
        next.unshift(updatedConv);

        persist(next);
        return next;
      });
    };

    window.addEventListener('avlodona:new-message', handler as EventListener);
    return () => window.removeEventListener('avlodona:new-message', handler as EventListener);
  }, [fetchConversations, persist, user?.id]);

  // When a chat is opened and messages are marked "seen", reset unread quickly.
  useEffect(() => {
    const handler = (e: Event) => {
      const ce = e as CustomEvent<{ conversationId?: string }>;
      const conversationId = ce.detail?.conversationId;
      if (!conversationId) return;

      setConversations((prev) => {
        const idx = prev.findIndex(c => c.id === conversationId);
        if (idx === -1) return prev;
        if ((prev[idx].unreadCount || 0) === 0) return prev;

        const next = prev.slice();
        next[idx] = { ...next[idx], unreadCount: 0 };
        persist(next);
        return next;
      });
    };

    window.addEventListener('avlodona:conversation-read', handler as EventListener);
    return () => window.removeEventListener('avlodona:conversation-read', handler as EventListener);
  }, [persist]);


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
