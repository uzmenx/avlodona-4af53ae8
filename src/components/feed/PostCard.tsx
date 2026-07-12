import { useState, useEffect, useRef, useCallback, memo } from 'react';
import { createPortal } from 'react-dom';
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
import { Heart, MessageCircle } from 'lucide-react';
import { Icon } from '@iconify/react';
import { usePostViews, useIntersectionObserver } from '@/hooks/usePostViews';
import { supabase } from '@/integrations/supabase/client';
import { useActiveStories } from '@/hooks/useActiveStories';
import { useAuth } from '@/contexts/AuthContext';
import { StoryViewer } from '@/components/stories/StoryViewer';
import type { StoryGroup, Story } from '@/hooks/useStories';
import { usePostLikes } from '@/hooks/usePostLikes';
import { MusicOverlay } from '@/components/music/MusicOverlay';
import { playExclusiveAudio, stopActiveAudio } from '@/lib/audioController';
import { useSavedMusic } from '@/hooks/useSavedMusic';
import { cn } from '@/lib/utils';
import { useProgressiveLoading } from '@/hooks/useProgressiveLoading';
import { PostCardSkeleton } from '@/components/feed/PostCardSkeleton';
import { CommentsSheet } from '@/components/post/CommentsSheet';

interface PostCardProps {
  post: Post;
  onDelete?: () => void;
  onMediaClick?: () => void;
  index?: number;
}

const PostCardInner = ({ post, onDelete, onMediaClick, index = 0 }: PostCardProps) => {
  const { user } = useAuth();
  const { getStoryInfo } = useActiveStories();
  const storyInfo = getStoryInfo(post.user_id);

  const { isLiked, toggleLike } = usePostLikes(post.id);

  const cardRef = useRef<HTMLDivElement>(null);

  const { stage, setRef, setPreviewReady } = useProgressiveLoading();

  const { viewsCount, trackView } = usePostViews(post.id, post.views_count ?? 0);

  useIntersectionObserver(cardRef, trackView, { threshold: 0.3 });

  const [showVideoPlayer, setShowVideoPlayer] = useState(false);

  const [videoPlayerSrc, setVideoPlayerSrc] = useState('');

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);

  const { isSaved, save, unsave } = useSavedMusic();

  const [storyViewerOpen, setStoryViewerOpen] = useState(false);
  const [storyViewerGroups, setStoryViewerGroups] = useState<StoryGroup[]>([]);

  const [showComments, setShowComments] = useState(false);

  const [showDoubleTapHeart, setShowDoubleTapHeart] = useState(false);
  const [heartAnimClass, setHeartAnimClass] = useState('animate-heartBurst');
  const [heartColorClass, setHeartColorClass] = useState('text-white fill-white');
  const lastTapRef = useRef(0);
  const singleTapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [collabPartner, setCollabPartner] = useState<{ name: string | null; username: string | null; } | null>(null);

  const timeAgo = formatDistanceToNow(new Date(post.created_at), { addSuffix: true });
  const rawContent = post.content || '';
  const locationMatch = rawContent.match(/(?:^|\n)📍\s*(.+?)\s*$/m);
  const locationLine = locationMatch ? locationMatch[1].trim() : '';
  const locationParts = locationLine.split('||').map((p) => p.trim()).filter(Boolean);
  const locationText = locationParts[0] || '';

  const formatLocationShort = (text: string) => {
    const normalized = (text || '').trim();
    if (!normalized) return '';

    const parts = normalized
      .split(',')
      .map((p) => p.trim())
      .filter(Boolean);

    const drop = new Set([
      "o'zbekiston",
      'ozbekiston',
      'uzbekistan',
      'republic of uzbekistan',
    ]);

    let cleaned = parts;
    if (cleaned.length > 1) {
      const last = cleaned[cleaned.length - 1].toLowerCase();
      if (drop.has(last)) cleaned = cleaned.slice(0, -1);
    }

    const mostSpecific = cleaned[0] || cleaned[cleaned.length - 1] || '';
    const oneWord = mostSpecific.split(/\s+/).filter(Boolean)[0] || '';
    return oneWord;
  };

  const locationTextShort = formatLocationShort(locationText);

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
  }, []);

  const openFullscreen = useCallback(() => {
    // Pause any playing video preview in this card before opening fullscreen
    try {
      window.dispatchEvent(new CustomEvent('avlodona:video:request-play', { detail: { id: '__fullscreen__' } }));
    } catch {
      // ignore
    }

    const root = cardRef.current;
    if (root) {
      const vids = Array.from(root.querySelectorAll('video')) as HTMLVideoElement[];
      vids.forEach((v) => {
        try {
          v.pause();
        } catch {
          // ignore
        }
      });
    }

    // Also stop any post music overlay audio
    stopAudio();

    onMediaClick?.();
  }, [onMediaClick, stopAudio]);

  const playAudio = useCallback(async () => {
    if (!post.audio_url) return;
    if (!audioRef.current) return;

    const ok = await playExclusiveAudio(`post:${post.id}`, audioRef.current);
    if (!ok) {
      setIsAudioPlaying(false);
      return;
    }
    setIsAudioPlaying(!audioRef.current.paused);
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
            stopAudio();
          }
        }
      },
      { threshold: 0.5 }
    );

    obs.observe(el);
    return () => {
      obs.disconnect();
      stopActiveAudio(`post:${post.id}`);
      stopAudio();
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
          : Promise.resolve({ data: [] as { story_id: string }[] }),
        viewerId
          ? supabase
              .from('story_likes')
              .select('story_id')
              .eq('user_id', viewerId)
              .in('story_id', stories.map(s => s.id))
          : Promise.resolve({ data: [] as { story_id: string }[] }),
      ]);

      const viewedStoryIds = new Set((viewsRes?.data as { story_id: string }[] | null)?.map((v) => v.story_id) || []);
      const likedStoryIds = new Set((likesRes?.data as { story_id: string }[] | null)?.map((l) => l.story_id) || []);

      const normalizedStories: Story[] = stories.map((s) => ({
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

  useEffect(() => {
    // Keep this empty or remove if no longer needed, but let's just remove the userProfile fetching
  }, [user?.id]);

  const mediaUrls = post.media_urls?.length > 0
    ? post.media_urls
    : post.image_url
      ? [post.image_url]
      : [];

  const isVideo = (url: string) => {
    if (!url) return false;
    const lower = url.toLowerCase();
    return lower.includes('.mp4') || lower.includes('.mov') || lower.includes('.webm') || lower.includes('.m4v') || lower.includes('.3gp') || lower.includes('.avi') || lower.includes('video');
  };
  const firstVideoUrl = mediaUrls.find((url) => isVideo(url));

  const card = (
    <Card className="overflow-hidden rounded-[20px] border border-white/20 bg-white/10 backdrop-blur-[10px] shadow-xl shadow-black/20">
      <CardContent className="p-0">
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2">
          <div className="flex items-center gap-2">
            <UserAvatar
              userId={post.user_id}
              avatarUrl={post.author?.avatar_url}
              name={post.author?.full_name}
              hasStory={!!storyInfo}
              storyRingId={storyInfo?.ring_id}
              hasUnviewedStory={storyInfo?.has_unviewed}
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

                const anims = ['animate-heartBurst', 'animate-likePop', 'animate-likeSwing', 'animate-likeFloat', 'animate-likePulse'];
                setHeartAnimClass(anims[Math.floor(Math.random() * anims.length)]);

                const colors = [
                  'text-white fill-white',
                  'text-[#ff2d55] fill-[#ff2d55]',
                  'text-pink-400 fill-pink-400',
                  'text-red-500 fill-red-500',
                  'text-purple-400 fill-purple-400',
                  'text-sky-400 fill-sky-400',
                  'text-emerald-400 fill-emerald-400',
                ];
                setHeartColorClass(colors[Math.floor(Math.random() * colors.length)]);

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
                openFullscreen();
              }, DOUBLE_TAP_DELAY + 40);
            }}
            className={onMediaClick ? "cursor-pointer" : ""}
          >
            <div className="relative">
              <MediaCarousel
                mediaUrls={mediaUrls}
                mediaMetadata={post.media_metadata}
                stage={stage}
                onPreviewReady={setPreviewReady}
                onVideoDoubleTap={() => {
                  const anims = ['animate-heartBurst', 'animate-likePop', 'animate-likeSwing', 'animate-likeFloat', 'animate-likePulse'];
                  setHeartAnimClass(anims[Math.floor(Math.random() * anims.length)]);

                  const colors = [
                    'text-white fill-white',
                    'text-[#ff2d55] fill-[#ff2d55]',
                    'text-pink-400 fill-pink-400',
                    'text-red-500 fill-red-500',
                    'text-purple-400 fill-purple-400',
                    'text-sky-400 fill-sky-400',
                    'text-emerald-400 fill-emerald-400',
                  ];
                  setHeartColorClass(colors[Math.floor(Math.random() * colors.length)]);

                  setShowDoubleTapHeart(true);
                  if (!isLiked) toggleLike();
                  setTimeout(() => setShowDoubleTapHeart(false), 900);
                }}
                onVideoSingleTap={() => {
                  openFullscreen();
                }}
              />

              {post.audio_url && (
                <div className="absolute bottom-3 right-3 z-30">
                  <MusicOverlay
                    audioTitle={post.audio_title}
                    audioArtist={post.audio_artist}
                    isPlaying={isAudioPlaying}
                    isSaved={isSaved(post.audio_url)}
                    onTogglePlay={() => toggleAudio()}
                    onToggleSave={() => {
                      if (!post.audio_url) return;
                      if (isSaved(post.audio_url)) {
                        void unsave(post.audio_url);
                      } else {
                        void save({
                          audio_url: post.audio_url,
                          audio_title: post.audio_title,
                          audio_artist: post.audio_artist,
                        });
                      }
                    }}
                  />

                  <audio
                    ref={audioRef}
                    src={post.audio_url}
                    preload="metadata"
                    onPlay={() => setIsAudioPlaying(true)}
                    onPause={() => setIsAudioPlaying(false)}
                    onEnded={() => setIsAudioPlaying(false)}
                  />
                </div>
              )}

              {showDoubleTapHeart && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
                  <Heart className={cn('h-24 w-24 drop-shadow-lg', heartColorClass, heartAnimClass)} />
                </div>
              )}
            </div>
          </div>
        )}

        {/* Actions - does NOT trigger fullscreen */}
        <div className="px-3 py-1.5 space-y-1.5">
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

          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground uppercase">{timeAgo}</p>
            {locationTextShort && mapUrl && (
              <a
                href={mapUrl}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 text-xs text-muted-foreground font-medium uppercase min-w-0 max-w-[55%] hover:text-foreground transition-colors"
                title={locationText}
              >
                <Icon icon="gis:location-poi" className="h-3.5 w-3.5 flex-shrink-0" />
                <span className="truncate">{locationTextShort}</span>
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
        startInFullscreen={true}
      />
    </div>
  );

  return (
    <>
      <div
        ref={(el) => {
          cardRef.current = el;
          setRef(el);
        }}
        className="py-0 my-[3px] animate-fadeIn"
      >
        {stage === 'skeleton' ? <PostCardSkeleton /> : card}
      </div>

      {typeof document !== 'undefined' && videoPlayerOverlay && createPortal(videoPlayerOverlay, document.body)}

      {storyViewerOpen && storyViewerGroups.length > 0 && (
        <StoryViewer
          storyGroups={storyViewerGroups}
          initialGroupIndex={0}
          onClose={() => setStoryViewerOpen(false)}
        />
      )}

      <CommentsSheet
        open={showComments}
        onOpenChange={setShowComments}
        postId={post.id}
      />
    </>
  );
};

export const PostCard = memo(PostCardInner);
