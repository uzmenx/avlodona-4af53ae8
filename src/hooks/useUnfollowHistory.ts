import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface UnfollowRecord {
  id: string;
  unfollowed_user_id: string;
  created_at: string;
  profile?: { name: string | null; username: string | null; avatar_url: string | null };
}

export type UnfollowHistoryMode = 'incoming';

interface UseUnfollowHistoryOptions {
  mode?: UnfollowHistoryMode;
  enabled?: boolean;
  userId?: string;
}

export const useUnfollowHistory = (options?: UseUnfollowHistoryOptions) => {
  const { user } = useAuth();
  const [history, setHistory] = useState<UnfollowRecord[]>([]);

  const RETENTION_DAYS = 30;

  const getCutoffIso = useCallback(() => {
    const d = new Date();
    d.setDate(d.getDate() - RETENTION_DAYS);
    return d.toISOString();
  }, []);

  const fetchHistory = useCallback(async () => {
    const ownerId = options?.userId || user?.id;
    if (!ownerId) return;
    if (options?.enabled === false) return;
    const cutoffIso = getCutoffIso();

    // Cleanup old records only for the current user's own history (RLS allows delete when auth.uid() = user_id).
    if (user?.id && ownerId === user.id) {
      await supabase.from('unfollow_history').delete().eq('user_id', ownerId).lt('created_at', cutoffIso);
    }

    const { data } = await supabase
      .from('unfollow_history')
      .select('*')
      .eq('user_id', ownerId)
      .gte('created_at', cutoffIso)
      .order('created_at', { ascending: false })
      .limit(50);
    
    if (data && data.length > 0) {
      const userIds = data.map(d => d.unfollowed_user_id);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, name, username, avatar_url')
        .in('id', userIds);
      
      const profileMap = new Map((profiles || []).map(p => [p.id, p]));
      setHistory(data.map(d => ({ ...d, profile: profileMap.get(d.unfollowed_user_id) || undefined })));
    } else {
      setHistory([]);
    }
  }, [getCutoffIso, options?.enabled, options?.userId, user?.id]);

  useEffect(() => {
    if (options?.enabled === false) return;
    fetchHistory();
  }, [fetchHistory, options?.enabled]);

  const recordUnfollow = useCallback(async (unfollowedUserId: string) => {
    // Record "incoming" unfollow for the user who got unfollowed.
    // user_id = owner of history (unfollowedUserId)
    // unfollowed_user_id = actor who unfollowed (current user)
    if (!user?.id) return;

    // Insert is allowed by RLS policy (see migration) where actor is auth.uid() = unfollowed_user_id.
    await supabase.from('unfollow_history').insert({ user_id: unfollowedUserId, unfollowed_user_id: user.id });
  }, [getCutoffIso, user?.id]);

  return { history, recordUnfollow, refetch: fetchHistory };
};
