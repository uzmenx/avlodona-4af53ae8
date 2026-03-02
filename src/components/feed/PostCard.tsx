import { useState, useEffect, useRef, useCallback } from 'react';

import { createPortal } from 'react-dom';

import { motion } from 'framer-motion';

import { Card, CardContent } from '@/components/ui/card';

import { Post } from '@/types';

import { formatDistanceToNow } from 'date-fns';

import { MediaCarousel } from '@/components/post/MediaCarousel';

import { PostActions } from '@/components/post/PostActions';

import { PostCaption } from '@/components/post/PostCaption';

import { PostMenu } from '@/components/post/PostMenu';

import { UserAvatar } from '@/components/user/UserAvatar';

import { UserInfo } from '@/components/user/UserInfo';

import { FollowButton } from '@/components/user/FollowButton';

import { SamsungUltraVideoPlayer } from '@/components/video/SamsungUltraVideoPlayer';

import { Heart } from 'lucide-react';

import { usePostViews, useIntersectionObserver } from '@/hooks/usePostViews';

import { supabase } from '@/integrations/supabase/client';

import { useActiveStories } from '@/hooks/useActiveStories';
import { useAuth } from '@/contexts/AuthContext';
import { StoryViewer } from '@/components/stories/StoryViewer';
import type { StoryGroup, Story } from '@/hooks/useStories';
import { usePostLikes } from '@/hooks/usePostLikes';

interface PostCardProps {
  post: Post;
  onDelete?: () => void;
  onMediaClick?: () => void;
  index?: number;
}

export const PostCard = ({ post, onDelete, onMediaClick, index = 0 }: PostCardProps) => {
  const { user } = useAuth();
  const { getStoryInfo } = useActiveStories();

  const { isLiked, toggleLike } = usePostLikes(post.id);

  const cardRef = useRef<HTMLDivElement>(null);

  const { viewsCount, trackView } = usePostViews(post.id, post.views_count ?? 0);

  useIntersectionObserver(cardRef, trackView, { threshold: 0.3 });

  const [showVideoPlayer, setShowVideoPlayer] = useState(false);

  const [videoPlayerSrc, setVideoPlayerSrc] = useState('');

  const [storyViewerOpen, setStoryViewerOpen] = useState(false);
  const [storyViewerGroups, setStoryViewerGroups] = useState<StoryGroup[]>([]);

  const [showDoubleTapHeart, setShowDoubleTapHeart] = useState(false);

  const [collabPartner, setCollabPartner] = useState<{ name: string | null; username: string | null; } | null>(null);

  const timeAgo = formatDistanceToNow(new Date(post.created_at), { addSuffix: true });

  const fetchStoryGroupForUser = useCallback(async (targetUserId: string): Promise<StoryGroup | null> => {
    try {
      const { data: stories, error } = await supabase
        .from('stories')
        .select('*')
        .eq('user_id', targetUserId)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: true });

      if (error) throw error;
      if (!stories || stories.length === 0) return null;

      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, name, username, avatar_url')
        .in('id', [targetUserId]);

      const authorProfile = profiles?.find(p => p.id === targetUserId);
      const viewerId = user?.id;

      const [viewsRes, likesRes] = await Promise.all([
        viewerId
          ? supabase
              .from('story_views')
              .select('story_id')
              .eq('viewer_id', viewerId)
              .in('story_id', stories.map(s => s.id))
          : Promise.resolve({ data: [] as any[] }),
        viewerId
          ? supabase
              .from('story_likes')
              .select('story_id')
              .eq('user_id', viewerId)
              .in('story_id', stories.map(s => s.id))
          : Promise.resolve({ data: [] as any[] }),
      ]);

      const viewedStoryIds = new Set((viewsRes as any)?.data?.map((v: any) => v.story_id) || []);
      const likedStoryIds = new Set((likesRes as any)?.data?.map((l: any) => l.story_id) || []);

      const normalizedStories: Story[] = stories.map((s: any) => ({
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

      return {
        user_id: targetUserId,
        user: authorProfile || { id: targetUserId, name: null, username: null, avatar_url: null },
        stories: normalizedStories,
        has_unviewed: normalizedStories.some(s => !s.has_viewed),
      };
    } catch (err) {
      console.error('Error fetching user stories:', err);
      return null;
    }
  }, [user?.id]);

  const openStoriesForUser = useCallback(async (targetUserId: string) => {
    const g = await fetchStoryGroupForUser(targetUserId);
    if (!g) return;
    setStoryViewerGroups([g]);
    setStoryViewerOpen(true);
  }, [fetchStoryGroupForUser]);

  useEffect(() => {
    (async () => {
      const { data: collabs } = await supabase
        .from('post_collabs')
        .select('user_id')
        .eq('post_id', post.id)
        .eq('status', 'accepted')
        .limit(1);

      if (collabs && collabs.length > 0) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('name, username')
          .eq('id', collabs[0].user_id)
          .single();

        if (profile) setCollabPartner(profile);
      }
    })();
  }, [post.id]);

  const mediaUrls = post.media_urls?.length > 0
    ? post.media_urls
    : post.image_url
      ? [post.image_url]
      : [];

  const isVideo = (url: string) => url?.includes('.mp4') || url?.includes('.mov') || url?.includes('.webm');
  const firstVideoUrl = mediaUrls.find((url) => isVideo(url));

  const card = (
    <Card className="overflow-hidden border-0 rounded-[20px] border border-white/20 bg-white/10 backdrop-blur-[10px] shadow-xl shadow-black/20">
      <CardContent className="p-0">
        {/* Header */}
        <div className="flex items-center justify-between p-3">
          <div className="flex items-center gap-3">
            <UserAvatar
              userId={post.user_id}
              avatarUrl={post.author?.avatar_url}
              name={post.author?.full_name}
              hasStory={!!getStoryInfo(post.user_id)}
              storyRingId={getStoryInfo(post.user_id)?.ring_id}
              hasUnviewedStory={getStoryInfo(post.user_id)?.has_unviewed}
              onStoryClick={() => openStoriesForUser(post.user_id)}
            />

            <div className="flex flex-col">
              <div className="flex items-center gap-1">
                <UserInfo
                  userId={post.user_id}
                  name={post.author?.full_name}
                  username={post.author?.username}
                />

                {collabPartner && (
                  <span className="text-xs text-muted-foreground">
                    &amp; {collabPartner.username || collabPartner.name}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <FollowButton targetUserId={post.user_id} size="sm" />
            <PostMenu
              postId={post.id}
              authorId={post.user_id}
              onDelete={onDelete}
            />
          </div>
        </div>

        {/* Media - ONLY media area triggers fullscreen */}
        {mediaUrls.length > 0 && (
          <div
            onClick={(e) => {
              const t = e.target as HTMLElement | null;
              if (t?.closest('button')) return;

              onMediaClick?.();
            }}
            className={onMediaClick ? "cursor-pointer" : ""}
          >
            <div className="relative">
              <MediaCarousel
                mediaUrls={mediaUrls}
                onVideoDoubleTap={() => {
                  setShowDoubleTapHeart(true);
                  if (!isLiked) toggleLike();
                  setTimeout(() => setShowDoubleTapHeart(false), 900);
                }}
                onVideoSingleTap={() => {
                  onMediaClick?.();
                }}
              />
              {showDoubleTapHeart && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
                  <Heart className="h-24 w-24 text-white fill-white drop-shadow-lg animate-heartBurst" />
                </div>
              )}
            </div>
          </div>
        )}

        {/* Actions - does NOT trigger fullscreen */}
        <div className="p-3 space-y-2">
          <PostActions
            postId={post.id}
            initialLikesCount={post.likes_count}
            initialCommentsCount={post.comments_count}
            initialViewsCount={post.views_count ?? 0}
            viewsCount={viewsCount}
            videoUrl={firstVideoUrl}
            onOpenVideoPlayer={(url) => {
              setVideoPlayerSrc(url);
              setShowVideoPlayer(true);
            }}
          />

          {post.content && (
            <PostCaption
              username={post.author?.username || 'user'}
              content={post.content}
              postId={post.id}
            />
          )}

          <p className="text-xs text-muted-foreground uppercase">{timeAgo}</p>
        </div>
      </CardContent>
    </Card>
  );

  const videoPlayerOverlay = showVideoPlayer && (
    <div
      className="fixed inset-0 z-[60] w-full h-full min-h-[100dvh] overflow-hidden bg-black/80 backdrop-blur-[10px]"
      style={{ height: '100dvh', maxHeight: '100dvh' }}
    >
      <SamsungUltraVideoPlayer
        src={videoPlayerSrc}
        title={post.content?.slice(0, 50) || 'Video'}
        onClose={() => setShowVideoPlayer(false)}
      />
    </div>
  );

  return (
    <>
      <motion.div
        ref={cardRef}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: Math.min(index * 0.06, 0.4), ease: [0.25, 0.46, 0.45, 0.94] }}
        className="py-0 my-[5px]"
      >
        {card}
      </motion.div>

      {typeof document !== 'undefined' && videoPlayerOverlay && createPortal(videoPlayerOverlay, document.body)}

      {storyViewerOpen && storyViewerGroups.length > 0 && (
        <StoryViewer
          storyGroups={storyViewerGroups}
          initialGroupIndex={0}
          onClose={() => setStoryViewerOpen(false)}
        />
      )}
    </>
  );
};