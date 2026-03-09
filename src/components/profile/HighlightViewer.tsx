import { useState, useEffect } from 'react';
import { type StoryHighlight } from '@/hooks/useStoryHighlights';
import { supabase } from '@/integrations/supabase/client';
import { StoryViewer } from '@/components/stories/StoryViewer';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import type { StoryGroup, Story } from '@/hooks/useStories';

interface HighlightViewerProps {
  highlight: StoryHighlight;
  onClose: () => void;
}

export function HighlightViewer({ highlight, onClose }: HighlightViewerProps) {
  const { user } = useAuth();
  const [groups, setGroups] = useState<StoryGroup[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const storyIds = (highlight.items || []).map((i) => i.story_id).filter(Boolean);
        if (storyIds.length === 0) {
          setGroups([]);
          return;
        }

        const { data: stories, error: storiesError } = await supabase
          .from('stories')
          .select('*')
          .in('id', storyIds)
          .order('created_at', { ascending: true });

        if (storiesError) throw storiesError;
        if (!stories || stories.length === 0) {
          setGroups([]);
          return;
        }

        const ownerId = stories[0].user_id as string;
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, name, username, avatar_url')
          .in('id', [ownerId]);

        const authorProfile = profiles?.[0];

        const viewerId = user?.id;
        const [viewsRes, likesRes] = await Promise.all([
          viewerId
            ? supabase.from('story_views').select('story_id').eq('viewer_id', viewerId).in('story_id', storyIds)
            : Promise.resolve({ data: [] as any[] }),
          viewerId
            ? supabase.from('story_likes').select('story_id').eq('user_id', viewerId).in('story_id', storyIds)
            : Promise.resolve({ data: [] as any[] }),
        ]);

        const viewedStoryIds = new Set((viewsRes as any)?.data?.map((v: any) => v.story_id) || []);
        const likedStoryIds = new Set((likesRes as any)?.data?.map((l: any) => l.story_id) || []);

        const byId = new Map((stories as any[]).map((s) => [s.id, s]));
        const ordered = storyIds.map((id) => byId.get(id)).filter(Boolean);

        const normalizedStories: Story[] = (ordered as any[]).map((s) => ({
          ...s,
          media_type: s.media_type as 'image' | 'video',
          ring_id: s.ring_id || 'default',
          author: authorProfile
            ? {
                id: authorProfile.id,
                name: authorProfile.name,
                username: authorProfile.username,
                avatar_url: authorProfile.avatar_url,
              }
            : undefined,
          has_viewed: viewerId ? viewedStoryIds.has(s.id) : false,
          has_liked: viewerId ? likedStoryIds.has(s.id) : false,
        }));

        if (cancelled) return;
        setGroups([
          {
            user_id: ownerId,
            user: authorProfile || { id: ownerId, name: null, username: null, avatar_url: null },
            stories: normalizedStories,
            has_unviewed: normalizedStories.some((s) => !s.has_viewed),
          },
        ]);
      } catch (e) {
        console.error('HighlightViewer error:', e);
        toast.error('Highlight yuklanmadi');
        setGroups([]);
      } finally {
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [highlight.id, highlight.items, user?.id]);

  if (loading) return null;
  if (groups.length === 0) {
    onClose();
    return null;
  }

  return (
    <StoryViewer
      storyGroups={groups}
      initialGroupIndex={0}
      initialStoryIndex={0}
      persistKey={`highlight:${highlight.id}`}
      onClose={onClose}
    />
  );
}
