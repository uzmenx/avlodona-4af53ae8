import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface ReactionSummaryItem {
  emoji: string;
  count: number;
  reactedByMe: boolean;
}

interface UseReactionsOptions {
  type: 'post' | 'group_message' | 'message';
  targetId: string | null; // post_id or message_id
}

// In-memory cache: key = `${type}:${targetId}`
const reactionsCache = new Map<string, ReactionSummaryItem[]>();

// Cross-component sync emitter
const reactionSyncEmitter = new EventTarget();
type ReactionSyncEvent = { key: string; reactions: ReactionSummaryItem[] };

const emitReactionSync = (e: ReactionSyncEvent) => {
  reactionSyncEmitter.dispatchEvent(
    new CustomEvent<ReactionSyncEvent>('reaction-sync', { detail: e })
  );
};

export const useReactions = ({ type, targetId }: UseReactionsOptions) => {
  const { user } = useAuth();
  const userId = user?.id;
  const cacheKey = `${type}:${targetId}`;

  const [reactions, setReactions] = useState<ReactionSummaryItem[]>(
    reactionsCache.get(cacheKey) ?? []
  );
  const [isLoading, setIsLoading] = useState(false);

  // Listen for cross-component sync
  useEffect(() => {
    const handler = (evt: Event) => {
      const ce = evt as CustomEvent<ReactionSyncEvent>;
      if (ce.detail?.key !== cacheKey) return;
      setReactions(ce.detail.reactions);
    };
    reactionSyncEmitter.addEventListener('reaction-sync', handler);
    return () => reactionSyncEmitter.removeEventListener('reaction-sync', handler);
  }, [cacheKey]);

  const fetchReactions = useCallback(async () => {
    if (!targetId) return;

    try {
      let data: Array<{ emoji: string; user_id: string }> | null = null;

      if (type === 'post') {
        const res = await (supabase as any)
          .from('post_reactions')
          .select('emoji, user_id')
          .eq('post_id', targetId);
        data = res.data;
      } else if (type === 'group_message') {
        const res = await (supabase as any)
          .from('group_message_reactions')
          .select('emoji, user_id')
          .eq('message_id', targetId);
        data = res.data;
      } else if (type === 'message') {
        const res = await (supabase as any)
          .from('message_reactions')
          .select('emoji, user_id')
          .eq('message_id', targetId);
        data = res.data;
      }

      if (!data) return;

      // Aggregate: { emoji -> { count, reactedByMe } }
      const map = new Map<string, { count: number; reactedByMe: boolean }>();
      for (const row of data) {
        const existing = map.get(row.emoji) ?? { count: 0, reactedByMe: false };
        map.set(row.emoji, {
          count: existing.count + 1,
          reactedByMe: existing.reactedByMe || row.user_id === userId,
        });
      }

      const summary: ReactionSummaryItem[] = Array.from(map.entries()).map(
        ([emoji, { count, reactedByMe }]) => ({ emoji, count, reactedByMe })
      );

      reactionsCache.set(cacheKey, summary);
      setReactions(summary);
      emitReactionSync({ key: cacheKey, reactions: summary });
    } catch (err) {
      console.error('useReactions fetchReactions error:', err);
    }
  }, [cacheKey, targetId, type, userId]);

  // Initial fetch
  useEffect(() => {
    const cached = reactionsCache.get(cacheKey);
    if (cached) {
      setReactions(cached);
    }
    void fetchReactions();
  }, [cacheKey, fetchReactions]);

  // Real-time subscription
  useEffect(() => {
    if (!targetId) return;

    const table = type === 'post' ? 'post_reactions' : type === 'group_message' ? 'group_message_reactions' : 'message_reactions';
    const filterCol = type === 'post' ? 'post_id' : 'message_id';

    const channel = supabase
      .channel(`reactions-${type}-${targetId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table,
          filter: `${filterCol}=eq.${targetId}`,
        },
        () => {
          void fetchReactions();
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [fetchReactions, targetId, type]);

  /**
   * Toggle a reaction. If user already reacted with this emoji, remove it.
   * Otherwise, upsert (overwrite any previous emoji for this user).
   */
  const toggleReaction = useCallback(
    async (emoji: string) => {
      if (!userId || isLoading) return;

      setIsLoading(true);

      // Optimistic update
      const prev = reactionsCache.get(cacheKey) ?? [];
      const meReactedWithThisEmoji = prev.find(
        (r) => r.emoji === emoji && r.reactedByMe
      );
      const meReactedWithOtherEmoji = prev.find(
        (r) => r.emoji !== emoji && r.reactedByMe
      );

      let optimistic: ReactionSummaryItem[];

      if (meReactedWithThisEmoji) {
        // Remove reaction
        optimistic = prev
          .map((r) =>
            r.emoji === emoji
              ? { ...r, count: r.count - 1, reactedByMe: false }
              : r
          )
          .filter((r) => r.count > 0);
      } else {
        // Add new emoji (and remove previous emoji if any)
        let base = prev;
        if (meReactedWithOtherEmoji) {
          base = base
            .map((r) =>
              r.emoji === meReactedWithOtherEmoji.emoji
                ? { ...r, count: r.count - 1, reactedByMe: false }
                : r
            )
            .filter((r) => r.count > 0);
        }
        const existingSlot = base.find((r) => r.emoji === emoji);
        if (existingSlot) {
          optimistic = base.map((r) =>
            r.emoji === emoji ? { ...r, count: r.count + 1, reactedByMe: true } : r
          );
        } else {
          optimistic = [...base, { emoji, count: 1, reactedByMe: true }];
        }
      }

      reactionsCache.set(cacheKey, optimistic);
      setReactions(optimistic);
      emitReactionSync({ key: cacheKey, reactions: optimistic });

      try {
        const table =
          type === 'post'
            ? 'post_reactions'
            : type === 'group_message'
            ? 'group_message_reactions'
            : 'message_reactions';
        const targetCol = type === 'post' ? 'post_id' : 'message_id';

        if (meReactedWithThisEmoji) {
          // Delete
          await (supabase as any)
            .from(table)
            .delete()
            .eq(targetCol, targetId)
            .eq('user_id', userId);
        } else {
          // Upsert (handles "change emoji" case via unique(targetId, user_id))
          await (supabase as any)
            .from(table)
            .upsert(
              { [targetCol]: targetId, user_id: userId, emoji },
              { onConflict: `${targetCol},user_id` }
            );
        }
      } catch (err) {
        console.error('useReactions toggleReaction error:', err);
        // Rollback
        reactionsCache.set(cacheKey, prev);
        setReactions(prev);
        emitReactionSync({ key: cacheKey, reactions: prev });
      } finally {
        setIsLoading(false);
      }
    },
    [cacheKey, isLoading, targetId, type, userId]
  );

  return { reactions, toggleReaction, isLoading, refetch: fetchReactions };
};
