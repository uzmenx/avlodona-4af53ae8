import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

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
  const [storyUsers, setStoryUsers] = useState<Map<string, ActiveStoryUser>>(new Map());

  const fetch = useCallback(async () => {
    if (!user) return;

    try {
      // Get all active stories
      const { data: stories } = await supabase
        .from('stories')
        .select('id, user_id, ring_id')
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false });

      if (!stories || stories.length === 0) {
        setStoryUsers(new Map());
        return;
      }

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
      setStoryUsers(map);
    } catch (err) {
      console.error('useActiveStories error:', err);
    }
  }, [user]);

  useEffect(() => { fetch(); }, [fetch]);

  const hasStory = (userId: string) => storyUsers.has(userId);
  const getStoryInfo = (userId: string) => storyUsers.get(userId);

  return { storyUsers, hasStory, getStoryInfo, refetch: fetch };
};
