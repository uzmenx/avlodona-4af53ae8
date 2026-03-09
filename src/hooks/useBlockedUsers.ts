import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export const useBlockedUsers = () => {
  const { user } = useAuth();
  const [blockedIds, setBlockedIds] = useState<Set<string>>(new Set());
  const [blockedByIds, setBlockedByIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);

  const fetchBlocked = useCallback(async () => {
    if (!user?.id) return;
    const [{ data: blockedData }, { data: blockedByData }] = await Promise.all([
      supabase
        .from('blocked_users')
        .select('blocked_id')
        .eq('blocker_id', user.id),
      supabase
        .from('blocked_users')
        .select('blocker_id')
        .eq('blocked_id', user.id),
    ]);

    setBlockedIds(new Set((blockedData || []).map(d => d.blocked_id)));
    setBlockedByIds(new Set((blockedByData || []).map(d => d.blocker_id)));
  }, [user?.id]);

  useEffect(() => { fetchBlocked(); }, [fetchBlocked]);

  const blockUser = useCallback(async (targetId: string) => {
    if (!user?.id) return;
    setIsLoading(true);
    try {
      await supabase.from('blocked_users').insert({ blocker_id: user.id, blocked_id: targetId });
      // Also unfollow
      await supabase.from('follows').delete().eq('follower_id', user.id).eq('following_id', targetId);
      await supabase.from('follows').delete().eq('follower_id', targetId).eq('following_id', user.id);
      setBlockedIds(prev => new Set(prev).add(targetId));
    } finally {
      setIsLoading(false);
    }
  }, [user?.id]);

  const unblockUser = useCallback(async (targetId: string) => {
    if (!user?.id) return;
    setIsLoading(true);
    try {
      await supabase.from('blocked_users').delete().eq('blocker_id', user.id).eq('blocked_id', targetId);
      setBlockedIds(prev => { const n = new Set(prev); n.delete(targetId); return n; });
    } finally {
      setIsLoading(false);
    }
  }, [user?.id]);

  const isBlocked = useCallback((id: string) => blockedIds.has(id), [blockedIds]);

  const isBlockedBy = useCallback((id: string) => blockedByIds.has(id), [blockedByIds]);

  const isEitherBlocked = useCallback(
    (id: string) => blockedIds.has(id) || blockedByIds.has(id),
    [blockedIds, blockedByIds]
  );

  const anyBlockedIds = useCallback(
    () => new Set<string>([...blockedIds, ...blockedByIds]),
    [blockedIds, blockedByIds]
  );

  return {
    blockedIds,
    blockedByIds,
    blockUser,
    unblockUser,
    isBlocked,
    isBlockedBy,
    isEitherBlocked,
    anyBlockedIds,
    isLoading,
    refetch: fetchBlocked,
  };
};
