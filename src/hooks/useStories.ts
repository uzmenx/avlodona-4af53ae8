import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface GifOverlay {
  id: string;
  url: string;
  originalUrl?: string;
  x: number;
  y: number;
  scale: number;
  rotation: number;
}

export interface Story {
  id: string;
  user_id: string;
  media_url: string;
  media_type: 'image' | 'video';
  audio_url?: string | null;
  audio_title?: string | null;
  audio_artist?: string | null;
  caption: string | null;
  ring_id: string;
  created_at: string;
  expires_at: string;
  media_metadata?: any;
  author?: {
    id: string;
    name: string | null;
    username: string | null;
    avatar_url: string | null;
  };
  views_count?: number;
  likes_count?: number;
  has_viewed?: boolean;
  has_liked?: boolean;
}

export interface StoryGroup {
  user_id: string;
  user: {
    id: string;
    name: string | null;
    username: string | null;
    avatar_url: string | null;
  };
  stories: Story[];
  has_unviewed: boolean;
}

export const useStories = () => {
  const { user } = useAuth();
  const [storyGroups, setStoryGroups] = useState<StoryGroup[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchStories = useCallback(async () => {
    if (!user) {
      setStoryGroups([]);
      setIsLoading(false);
      return;
    }

    try {
      // Get users I follow
      const { data: follows } = await supabase
        .from('follows')
        .select('following_id')
        .eq('follower_id', user.id);

      const followingIds = follows?.map(f => f.following_id) || [];
      // Include own stories too
      const userIds = [...followingIds, user.id];

      // Get active stories (not expired)
      const { data: stories, error } = await supabase
        .from('stories')
        .select('*')
        .in('user_id', userIds)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: true });

      if (error) throw error;

      if (!stories || stories.length === 0) {
        setStoryGroups([]);
        setIsLoading(false);
        return;
      }

      // Get profiles for story authors
      const storyUserIds = [...new Set(stories.map(s => s.user_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, name, username, avatar_url')
        .in('id', storyUserIds);

      // Get view status for current user
      const { data: views } = await supabase
        .from('story_views')
        .select('story_id')
        .eq('viewer_id', user.id)
        .in('story_id', stories.map(s => s.id));

      const viewedStoryIds = new Set(views?.map(v => v.story_id) || []);

      // Get like status for current user
      const { data: likes } = await supabase
        .from('story_likes')
        .select('story_id')
        .eq('user_id', user.id)
        .in('story_id', stories.map(s => s.id));

      const likedStoryIds = new Set(likes?.map(l => l.story_id) || []);

      // Group stories by user
      const groupedMap = new Map<string, StoryGroup>();

      for (const story of stories) {
        const profile = profiles?.find(p => p.id === story.user_id);
        const storyWithMeta: Story = {
          ...story,
          media_type: story.media_type as 'image' | 'video',
          ring_id: story.ring_id || 'default',
          author: profile ? {
            id: profile.id,
            name: profile.name,
            username: profile.username,
            avatar_url: profile.avatar_url,
          } : undefined,
          has_viewed: viewedStoryIds.has(story.id),
          has_liked: likedStoryIds.has(story.id),
        };

        if (!groupedMap.has(story.user_id)) {
          groupedMap.set(story.user_id, {
            user_id: story.user_id,
            user: profile || { id: story.user_id, name: null, username: null, avatar_url: null },
            stories: [],
            has_unviewed: false,
          });
        }

        const group = groupedMap.get(story.user_id)!;
        group.stories.push(storyWithMeta);
        if (!storyWithMeta.has_viewed) {
          group.has_unviewed = true;
        }
      }

      // Sort: own stories first, then unviewed, then viewed
      const groups = Array.from(groupedMap.values()).sort((a, b) => {
        if (a.user_id === user.id) return -1;
        if (b.user_id === user.id) return 1;
        if (a.has_unviewed && !b.has_unviewed) return -1;
        if (!a.has_unviewed && b.has_unviewed) return 1;
        return 0;
      });

      setStoryGroups(groups);
    } catch (error) {
      console.error('Error fetching stories:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user?.id]);

  const recordView = async (storyId: string) => {
    if (!user) return;

    try {
      await supabase
        .from('story_views')
        .upsert(
          { story_id: storyId, viewer_id: user.id, viewed_at: new Date().toISOString() },
          { onConflict: 'story_id,viewer_id', ignoreDuplicates: true }
        );
    } catch (error) {
      console.error('Error recording view:', error);
    }
  };

  const toggleLike = async (storyId: string, isLiked: boolean) => {
    if (!user) return;

    try {
      if (isLiked) {
        await supabase
          .from('story_likes')
          .delete()
          .eq('story_id', storyId)
          .eq('user_id', user.id);
      } else {
        const { error: likeError } = await supabase
          .from('story_likes')
          .insert({ story_id: storyId, user_id: user.id });

        if (likeError) {
          console.error('Error liking story:', likeError);
          return;
        }
        // Notification is automatically created by the database trigger
        // handle_story_like_notification on story_likes table
      }
    } catch (error) {
      console.error('Error toggling like:', error);
    }
  };

  const getStoryViewers = async (storyId: string) => {
    const { data: views } = await supabase
      .from('story_views')
      .select('viewer_id, viewed_at')
      .eq('story_id', storyId)
      .order('viewed_at', { ascending: false });

    if (!views || views.length === 0) return [];

    const viewerIds = views.map(v => v.viewer_id);
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, name, username, avatar_url')
      .in('id', viewerIds);

    return views.map(v => ({
      ...v,
      profile: profiles?.find(p => p.id === v.viewer_id),
    }));
  };

  const getStoryLikers = async (storyId: string) => {
    const { data: likes } = await supabase
      .from('story_likes')
      .select('user_id, created_at')
      .eq('story_id', storyId)
      .order('created_at', { ascending: false });

    if (!likes || likes.length === 0) return [];

    const userIds = likes.map(l => l.user_id);
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, name, username, avatar_url')
      .in('id', userIds);

    return likes.map(l => ({
      ...l,
      profile: profiles?.find(p => p.id === l.user_id),
    }));
  };

  useEffect(() => {
    fetchStories();
  }, [fetchStories]);

  return {
    storyGroups,
    isLoading,
    refetch: fetchStories,
    recordView,
    toggleLike,
    getStoryViewers,
    getStoryLikers,
  };
};
