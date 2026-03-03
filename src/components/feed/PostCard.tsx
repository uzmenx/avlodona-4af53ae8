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

import { Heart, Pause, Play } from 'lucide-react';

import { Icon } from '@iconify/react';

import { usePostViews, useIntersectionObserver } from '@/hooks/usePostViews';

import { supabase } from '@/integrations/supabase/client';

import { useActiveStories } from '@/hooks/useActiveStories';
import { useAuth } from '@/contexts/AuthContext';
import { StoryViewer } from '@/components/stories/StoryViewer';
import type { StoryGroup, Story } from '@/hooks/useStories';
import { usePostLikes } from '@/hooks/usePostLikes';

let activePostAudio: HTMLAudioElement | null = null;
let activePostAudioPostId: string | null = null;

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

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);

  const [storyViewerOpen, setStoryViewerOpen] = useState(false);
  const [storyViewerGroups, setStoryViewerGroups] = useState<StoryGroup[]>([]);

  const [showDoubleTapHeart, setShowDoubleTapHeart] = useState(false);
  const lastTapRef = useRef(0);
  const singleTapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [collabPartner, setCollabPartner] = useState<{ name: string | null; username: string | null; } | null>(null);

  const timeAgo = formatDistanceToNow(new Date(post.created_at), { addSuffix: true });
  const rawContent = post.content || '';
  const locationMatch = rawContent.match(/(?:^|\n)📍\s*(.+?)\s*$/m);
  const locationLine = locationMatch ? locationMatch[1].trim() : '';
  const locationParts = locationLine.split('||').map((p) => p.trim()).filter(Boolean);
  const locationText = locationParts[0] || '';
  const coordsPart = locationParts[1] || '';
  const coordsMatch = coordsPart.match(/^(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)$/);
  const lat = coordsMatch?.[1] || '';
  const lon = coordsMatch?.[2] || '';
  const mapUrl = locationText
    ? lat && lon
      ? 'https://www.google.com/maps?q=' + encodeURIComponent(lat + ',' + lon)
      : 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(locationText)
    : '';
  const contentWithoutLocation = rawContent.replace(/(?:\n|^)📍\s*.+\s*$/m, '').trim();

  const stopAudio = useCallback(() => {
    if (!audioRef.current) return;
    audioRef.current.pause();
    setIsAudioPlaying(false);
    if (activePostAudioPostId === post.id) {
      activePostAudio = null;
      activePostAudioPostId = null;
    }
  }, [post.id]);

  const playAudio = useCallback(async () => {
    if (!post.audio_url) return;
    if (!audioRef.current) return;

    try {
      if (activePostAudio && activePostAudio !== audioRef.current) {
        activePostAudio.pause();
      }

      activePostAudio = audioRef.current;
      activePostAudioPostId = post.id;

      await audioRef.current.play();
      setIsAudioPlaying(true);
    } catch {
      setIsAudioPlaying(false);
    }
  }, [post.audio_url, post.id]);

  const toggleAudio = useCallback(() => {
    if (!post.audio_url) return;
    if (isAudioPlaying) stopAudio();
    else void playAudio();
  }, [isAudioPlaying, playAudio, post.audio_url, stopAudio]);

  useEffect(() => {
    const el = cardRef.current;
    if (!el || !post.audio_url) return;

    const obs = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            void playAudio();
          } else {
            if (activePostAudioPostId === post.id) stopAudio();
          }
        }
      },
      { threshold: 0.5 }
    );

    obs.observe(el);
    return () => {
      obs.disconnect();
      if (activePostAudioPostId === post.id) stopAudio();
    };
  }, [playAudio, post.audio_url, post.id, stopAudio]);

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

              const now = Date.now();
              const DOUBLE_TAP_DELAY = 300;

              if (now - lastTapRef.current < DOUBLE_TAP_DELAY) {
                if (singleTapTimerRef.current) {
                  clearTimeout(singleTapTimerRef.current);
                  singleTapTimerRef.current = null;
                }
                lastTapRef.current = 0;

                setShowDoubleTapHeart(true);
                if (!isLiked) toggleLike();
                setTimeout(() => setShowDoubleTapHeart(false), 900);
                return;
              }

              lastTapRef.current = now;
              if (singleTapTimerRef.current) clearTimeout(singleTapTimerRef.current);
              singleTapTimerRef.current = setTimeout(() => {
                if (lastTapRef.current === 0) return;
                lastTapRef.current = 0;
                singleTapTimerRef.current = null;
                onMediaClick?.();
              }, DOUBLE_TAP_DELAY + 40);
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

          {post.audio_url && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-primary/5 border border-primary/20">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  toggleAudio();
                }}
                className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center"
                aria-label={isAudioPlaying ? 'Pause' : 'Play'}
              >
                {isAudioPlaying ? (
                  <Pause className="h-3.5 w-3.5 text-primary" />
                ) : (
                  <Play className="h-3.5 w-3.5 text-primary" />
                )}
              </button>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate">{post.audio_title || 'Musiqa'}</p>
                <p className="text-[10px] text-muted-foreground truncate">{post.audio_artist || ''}</p>
              </div>
              <audio
                ref={audioRef}
                src={post.audio_url}
                onPlay={() => setIsAudioPlaying(true)}
                onPause={() => setIsAudioPlaying(false)}
                onEnded={() => setIsAudioPlaying(false)}
              />
            </div>
          )}

          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground uppercase">{timeAgo}</p>
            {locationText && mapUrl && (
              <a
                href={mapUrl}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 text-xs text-muted-foreground min-w-0 max-w-[55%] hover:text-foreground transition-colors"
                title={locationText}
              >
                <Icon icon="gis:location-poi" className="h-3.5 w-3.5 flex-shrink-0" />
                <span className="truncate">{locationText}</span>
              </a>
            )}
          </div>

          {contentWithoutLocation && (
            <PostCaption
              username={post.author?.username || 'user'}
              content={contentWithoutLocation}
              postId={post.id}
            />
          )}
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