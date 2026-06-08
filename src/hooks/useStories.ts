import { useCallback, useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { getCacheWithTTL, setCache } from '@/lib/localCache';

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
  const queryClient = useQueryClient();

  // Disk cache: skeleton faqat birinchi marta (keyingi kirishlarda eski data ko‘rinadi)
  const DISK_TTL_MS = 30 * 60 * 1000; // 30 daqiqa
  const CACHE_KEY = useMemo(
    () => (user?.id ? `stories_cache_v2_${user.id}` : 'stories_cache_v2'),
    [user?.id]
  );

  const fetchStoryGroups = useCallback(async (): Promise<StoryGroup[]> => {
    if (!user?.id) return [];

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
    if (!stories || stories.length === 0) return [];

    const storyUserIds = [...new Set(stories.map(s => s.user_id))];
    const storyIds = stories.map(s => s.id);

    // Parallel fetch: profiles + views + likes
    const [profilesRes, viewsRes, likesRes] = await Promise.all([
      supabase.from('profiles').select('id, name, username, avatar_url').in('id', storyUserIds),
      supabase.from('story_views').select('story_id').eq('viewer_id', user.id).in('story_id', storyIds),
      supabase.from('story_likes').select('story_id').eq('user_id', user.id).in('story_id', storyIds),
    ]);

    const profiles = profilesRes.data || [];
    const viewedStoryIds = new Set((viewsRes.data || []).map(v => v.story_id));
    const likedStoryIds = new Set((likesRes.data || []).map(l => l.story_id));

    // Group stories by user
    const groupedMap = new Map<string, StoryGroup>();

    for (const story of stories as any[]) {
      const profile = profiles.find(p => p.id === story.user_id);
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
    return Array.from(groupedMap.values()).sort((a, b) => {
      if (a.user_id === user.id) return -1;
      if (b.user_id === user.id) return 1;
      if (a.has_unviewed && !b.has_unviewed) return -1;
      if (!a.has_unviewed && b.has_unviewed) return 1;
      return 0;
    });
  }, [user?.id]);

  const initialData = useMemo(() => {
    if (!user?.id) return undefined;
    return getCacheWithTTL<StoryGroup[]>(CACHE_KEY, DISK_TTL_MS) ?? undefined;
  }, [CACHE_KEY, user?.id]);

  const query = useQuery({
    queryKey: ['stories', user?.id],
    enabled: !!user?.id,
    queryFn: fetchStoryGroups,
    staleTime: 120000, // 120000ms = 2 daqiqa
    gcTime: 10 * 60 * 1000,   // 10 minutes
    refetchOnWindowFocus: false,
    initialData,
    placeholderData: (prev) => prev,
  });

  // Persist to disk cache (2-qavat)
  useEffect(() => {
    if (!user?.id) return;
    if (!query.data) return;
    setCache(CACHE_KEY, query.data);
  }, [CACHE_KEY, query.data, user?.id]);

  // Auto-refresh when a new story is published
  useEffect(() => {
    const handlePublishSuccess = (e: Event) => {
      const ce = e as CustomEvent;
      if (ce.detail?.shareStory) {
        void query.refetch();
      }
    };
    window.addEventListener('avlodona:publish:success', handlePublishSuccess);
    return () => window.removeEventListener('avlodona:publish:success', handlePublishSuccess);
  }, [query]);

  const recordView = async (storyId: string) => {
    if (!user) return;

    try {
      await supabase
        .from('story_views')
        .upsert(
          { story_id: storyId, viewer_id: user.id, viewed_at: new Date().toISOString() },
          { onConflict: 'story_id,viewer_id', ignoreDuplicates: true }
        );

      // Update cached data (optimistic UI)
      queryClient.setQueryData(['stories', user.id], (prev?: StoryGroup[]) => {
        if (!prev) return prev;
        const next = prev.map((g) => ({
          ...g,
          stories: g.stories.map((s) => s.id === storyId ? { ...s, has_viewed: true } : s),
        }));
        // Recompute has_unviewed
        for (const g of next) {
          g.has_unviewed = g.stories.some((s) => !s.has_viewed);
        }
        return next;
      });
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

      // Update cached data (optimistic UI)
      queryClient.setQueryData(['stories', user.id], (prev?: StoryGroup[]) => {
        if (!prev) return prev;
        return prev.map((g) => ({
          ...g,
          stories: g.stories.map((s) => s.id === storyId ? { ...s, has_liked: !isLiked } : s),
        }));
      });
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

  return {
    storyGroups: query.data || [],
    isLoading: query.isLoading && query.data === undefined,
    refetch: () => query.refetch(),
    recordView,
    toggleLike,
    getStoryViewers,
    getStoryLikers,
  };
};
