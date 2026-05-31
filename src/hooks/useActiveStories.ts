import { useCallback, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { getCacheWithTTL, setCache } from '@/lib/localCache';

export interface ActiveStoryUser {
  user_id: string;
  ring_id: string;
  has_unviewed: boolean;
}

/**
 * Returns a map of user_id -> { ring_id, has_unviewed } for users with active stories.
 * Lightweight hook for showing story rings across the app.
 */
export const useActiveStories = () => {
  const { user } = useAuth();
  const DISK_TTL_MS = 5 * 60 * 1000; // 5 minutes

  const CACHE_KEY = useMemo(() => (user?.id ? `active_stories_cache_v1_${user.id}` : 'active_stories_cache_v1'), [user?.id]);

  const fetch = useCallback(async (): Promise<ActiveStoryUser[]> => {
    if (!user?.id) return [];

    try {
      // Get all active stories
      const { data: stories } = await supabase
        .from('stories')
        .select('id, user_id, ring_id')
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false });

      if (!stories || stories.length === 0) return [];

      // Get viewed stories for current user
      const storyIds = stories.map(s => s.id);
      const { data: views } = await supabase
        .from('story_views')
        .select('story_id')
        .eq('viewer_id', user.id)
        .in('story_id', storyIds);

      const viewedIds = new Set(views?.map(v => v.story_id) || []);

      const map = new Map<string, ActiveStoryUser>();
      for (const s of stories) {
        if (!map.has(s.user_id)) {
          map.set(s.user_id, {
            user_id: s.user_id,
            ring_id: s.ring_id || 'default',
            has_unviewed: !viewedIds.has(s.id),
          });
        } else {
          const existing = map.get(s.user_id)!;
          if (!viewedIds.has(s.id)) {
            existing.has_unviewed = true;
          }
        }
      }
      return Array.from(map.values());
    } catch (err) {
      console.error('useActiveStories error:', err);
      return [];
    }
  }, [user?.id]);

  const initialData = useMemo(() => {
    if (!user?.id) return undefined;
    return getCacheWithTTL<ActiveStoryUser[]>(CACHE_KEY, DISK_TTL_MS) ?? undefined;
  }, [CACHE_KEY, user?.id]);

  const query = useQuery({
    queryKey: ['active-stories', user?.id],
    enabled: !!user?.id,
    queryFn: fetch,
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
    initialData,
    placeholderData: (prev) => prev,
  });

  useEffect(() => {
    if (!user?.id) return;
    if (!query.data) return;
    setCache(CACHE_KEY, query.data);
  }, [CACHE_KEY, query.data, user?.id]);

  const storyUsers = useMemo(() => {
    const map = new Map<string, ActiveStoryUser>();
    for (const s of query.data || []) map.set(s.user_id, s);
    return map;
  }, [query.data]);

  const hasStory = (userId: string) => storyUsers.has(userId);
  const getStoryInfo = (userId: string) => storyUsers.get(userId);

  return { storyUsers, hasStory, getStoryInfo, refetch: () => query.refetch() };
};
