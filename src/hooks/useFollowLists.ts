import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type FollowListMode = 'followers' | 'following';

export interface FollowListUser {
  id: string;
  name: string | null;
  username: string | null;
  avatar_url: string | null;
}

export const useFollowLists = (userId: string | undefined, mode: FollowListMode, enabled: boolean) => {
  const [users, setUsers] = useState<FollowListUser[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const title = useMemo(() => {
    if (mode === 'followers') return 'Kuzatuvchilar';
    return 'Kuzatilmoqda';
  }, [mode]);

  const fetchUsers = useCallback(async () => {
    if (!userId) {
      setUsers([]);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const idColumn = mode === 'followers' ? 'follower_id' : 'following_id';
      const filterColumn = mode === 'followers' ? 'following_id' : 'follower_id';

      const { data: followRows, error: followsError } = await supabase
        .from('follows')
        .select(idColumn)
        .eq(filterColumn, userId)
        .limit(500);

      if (followsError) throw followsError;

      const ids = (followRows || [])
        .map((r: any) => r[idColumn] as string)
        .filter(Boolean);

      if (ids.length === 0) {
        setUsers([]);
        return;
      }

      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, name, username, avatar_url')
        .in('id', ids);

      if (profilesError) throw profilesError;

      const map = new Map<string, FollowListUser>();
      (profiles || []).forEach((p: any) => {
        map.set(p.id, {
          id: p.id,
          name: p.name ?? null,
          username: p.username ?? null,
          avatar_url: p.avatar_url ?? null,
        });
      });

      const ordered = ids.map((id) => map.get(id)).filter(Boolean) as FollowListUser[];
      setUsers(ordered);
    } catch (e: any) {
      setError(e?.message || 'Xatolik');
      setUsers([]);
    } finally {
      setIsLoading(false);
    }
  }, [mode, userId]);

  useEffect(() => {
    if (!enabled) return;
    fetchUsers();
  }, [enabled, fetchUsers]);

  return { users, isLoading, error, title, refetch: fetchUsers };
};
