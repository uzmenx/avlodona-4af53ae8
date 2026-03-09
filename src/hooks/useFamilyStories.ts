import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface UserStoryStatus {
  userId: string;
  hasStory: boolean;
  hasUnviewed: boolean;
}

export const useFamilyStories = (userIds: string[]) => {
  const { user } = useAuth();
  const [storyStatuses, setStoryStatuses] = useState<Map<string, UserStoryStatus>>(new Map());
  const [isLoading, setIsLoading] = useState(false);

  const fetchStoryStatuses = useCallback(async () => {
    if (!user?.id || userIds.length === 0) return;

    setIsLoading(true);
    try {
      // Get active stories for these users
      const { data: stories, error } = await supabase
        .from('stories')
        .select('id, user_id')
        .in('user_id', userIds)
        .gt('expires_at', new Date().toISOString());

      if (error) throw error;

      if (!stories || stories.length === 0) {
        setStoryStatuses(new Map());
        return;
      }

      // Get viewed stories by current user
      const { data: views } = await supabase
        .from('story_views')
        .select('story_id')
        .eq('viewer_id', user.id)
        .in('story_id', stories.map(s => s.id));

      const viewedIds = new Set(views?.map(v => v.story_id) || []);

      // Build status map
      const statusMap = new Map<string, UserStoryStatus>();
      userIds.forEach(userId => {
        const userStories = stories.filter(s => s.user_id === userId);
        const hasStory = userStories.length > 0;
        const hasUnviewed = userStories.some(s => !viewedIds.has(s.id));
        statusMap.set(userId, { userId, hasStory, hasUnviewed });
      });

      setStoryStatuses(statusMap);
    } catch (error) {
      console.error('Error fetching story statuses:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user?.id, userIds.join(',')]);

  useEffect(() => {
    fetchStoryStatuses();
  }, [fetchStoryStatuses]);

  const getStoryStatus = useCallback((userId: string): UserStoryStatus => {
    return storyStatuses.get(userId) || { userId, hasStory: false, hasUnviewed: false };
  }, [storyStatuses]);

  return {
    storyStatuses,
    getStoryStatus,
    isLoading,
    refetch: fetchStoryStatuses,
  };
};
