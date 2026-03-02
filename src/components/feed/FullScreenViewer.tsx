import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Play, Pause, ChevronLeft, ChevronRight, Heart, X } from 'lucide-react';
import { Post } from '@/types';
import { cn } from '@/lib/utils';
import { useColorExtractor } from '@/hooks/useColorExtractor';
import { FullscreenActions } from '@/components/post/FullscreenActions';
import { PostCaption } from '@/components/post/PostCaption';
import { usePostLikes } from '@/hooks/usePostLikes';
import { UserAvatar } from '@/components/user/UserAvatar';
import { UserInfo } from '@/components/user/UserInfo';
import { FollowButton } from '@/components/user/FollowButton';
import { SamsungUltraVideoPlayer } from '@/components/video/SamsungUltraVideoPlayer';

interface FullScreenViewerProps {
  posts: Post[];
  initialIndex: number;
  onClose: () => void;
}

export const FullScreenViewer = ({ posts, initialIndex, onClose }: FullScreenViewerProps) => {
  const [currentPostIndex, setCurrentPostIndex] = useState(initialIndex);
  const [currentMediaIndex, setCurrentMediaIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [slideDirection, setSlideDirection] = useState<'up' | 'down' | null>(null);
  const [showDoubleTapHeart, setShowDoubleTapHeart] = useState(false);
  const [showVideoPlayer, setShowVideoPlayer] = useState(false);
  const [videoPlayerSrc, setVideoPlayerSrc] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const touchStartY = useRef(0);
  const touchStartX = useRef(0);
  const lastTapRef = useRef(0);
  const singleTapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const currentPost = posts[currentPostIndex];
  const mediaUrls = currentPost?.media_urls || (currentPost?.image_url ? [currentPost.image_url] : []);
  const currentMediaUrl = mediaUrls[currentMediaIndex];

  // Hook for double-tap like
  const { isLiked, toggleLike } = usePostLikes(currentPost?.id || '');

  const isVideo = (url: string) => {
    return url?.includes('.mp4') || url?.includes('.mov') || url?.includes('.webm');
  };

  // Extract dominant colors from current media
  const { dominantColor, secondaryColor } = useColorExtractor(
    currentMediaUrl,
    isVideo(currentMediaUrl || '')
  );

  useEffect(() => {
    setCurrentMediaIndex(0);
    setIsPlaying(true);
  }, [currentPostIndex]);

  useEffect(() => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.play().catch(() => {});
      } else {
        videoRef.current.pause();
      }
    }
  }, [isPlaying, currentMediaIndex, currentPostIndex]);

  // Smooth transition to next/prev post
  const smoothNavigate = (direction: 'up' | 'down') => {
    if (isTransitioning) return;

    const canGoNext = direction === 'down' && currentPostIndex < posts.length - 1;
    const canGoPrev = direction === 'up' && currentPostIndex > 0;

    if (!canGoNext && !canGoPrev) return;

    setIsTransitioning(true);
    setSlideDirection(direction);

    // Wait for exit animation
    setTimeout(() => {
      if (direction === 'down') {
        setCurrentPostIndex((prev) => prev + 1);
      } else {
        setCurrentPostIndex((prev) => prev - 1);
      }

      // Reset for enter animation
      setTimeout(() => {
        setSlideDirection(null);
        setIsTransitioning(false);
      }, 300);
    }, 200);
  };

  // Mouse wheel scroll for post navigation with debounce
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let isScrolling = false;
    let scrollTimeout: NodeJS.Timeout;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();

      if (isScrolling || isTransitioning) return;

      if (Math.abs(e.deltaY) > 30) {
        isScrolling = true;

        if (e.deltaY > 0) {
          smoothNavigate('down');
        } else {
          smoothNavigate('up');
        }

        // Block scrolling for 600ms (animation duration + buffer)
        scrollTimeout = setTimeout(() => {
          isScrolling = false;
        }, 600);
      }
    };

    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      container.removeEventListener('wheel', handleWheel);
      clearTimeout(scrollTimeout);
    };
  }, [posts.length, isTransitioning, currentPostIndex]);

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowUp') goToPrevPost();
      if (e.key === 'ArrowDown') goToNextPost();
      if (e.key === 'ArrowLeft') goToPrevMedia();
      if (e.key === 'ArrowRight') goToNextMedia();
      if (e.key === ' ') togglePlay();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentPostIndex, currentMediaIndex]);

  // Prevent body scroll
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  const goToNextPost = () => {
    smoothNavigate('down');
  };

  const goToPrevPost = () => {
    smoothNavigate('up');
  };

  const goToNextMedia = () => {
    if (currentMediaIndex < mediaUrls.length - 1) {
      setCurrentMediaIndex((prev) => prev + 1);
    }
  };

  const goToPrevMedia = () => {
    if (currentMediaIndex > 0) {
      setCurrentMediaIndex((prev) => prev - 1);
    }
  };

  const togglePlay = () => {
    setIsPlaying((prev) => !prev);
  };

  // Touch handlers for swipe
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const touchEndY = e.changedTouches[0].clientY;
    const touchEndX = e.changedTouches[0].clientX;
    const diffY = touchStartY.current - touchEndY;
    const diffX = touchStartX.current - touchEndX;

    // Prioritize vertical swipe for post navigation
    if (Math.abs(diffY) > Math.abs(diffX) && Math.abs(diffY) > 50) {
      if (diffY > 0) {
        goToNextPost();
      } else {
        goToPrevPost();
      }
    }
    // Horizontal swipe for media navigation within post
    else if (Math.abs(diffX) > 50 && mediaUrls.length > 1) {
      if (diffX > 0) {
        goToNextMedia();
      } else {
        goToPrevMedia();
      }
    }
  };

  const handleMediaClick = (e: React.MouseEvent) => {
    const now = Date.now();
    const DOUBLE_TAP_DELAY = 300;

    // Check for double tap
    if (now - lastTapRef.current < DOUBLE_TAP_DELAY) {
      if (singleTapTimerRef.current) {
        clearTimeout(singleTapTimerRef.current);
        singleTapTimerRef.current = null;
      }
      // Double tap detected - show heart and like
      setShowDoubleTapHeart(true);
      if (!isLiked) {
        toggleLike();
      }
      setTimeout(() => setShowDoubleTapHeart(false), 1000);
      lastTapRef.current = 0;
      return;
    }

    lastTapRef.current = now;

    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const width = rect.width;

    // Single tap logic - delayed to check for double tap
    if (singleTapTimerRef.current) clearTimeout(singleTapTimerRef.current);
    singleTapTimerRef.current = setTimeout(() => {
      if (lastTapRef.current === 0) return;
      lastTapRef.current = 0;
      singleTapTimerRef.current = null;

      // Click on left side - previous media, right side - next media, center - toggle play
      if (x < width * 0.3 && mediaUrls.length > 1) {
        goToPrevMedia();
      } else if (x > width * 0.7 && mediaUrls.length > 1) {
        goToNextMedia();
      } else if (isVideo(currentMediaUrl)) {
        togglePlay();
      }
    }, DOUBLE_TAP_DELAY + 50);
  };

  useEffect(() => {
    return () => {
      if (singleTapTimerRef.current) {
        clearTimeout(singleTapTimerRef.current);
        singleTapTimerRef.current = null;
      }
    };
  }, []);

  if (!currentPost) return null;

  return (
    <>
      <div
        ref={containerRef}
        className="fixed inset-0 z-[60] flex flex-col overflow-hidden"
        style={{
          background: `linear-gradient(135deg, ${dominantColor} 0%, ${secondaryColor} 50%, ${dominantColor} 100%)`
        }}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}>


        {/* Blurred background overlay for extra depth */}
        <div
          className="absolute inset-0 z-0"
          style={{
            background: `radial-gradient(ellipse at center, transparent 0%, ${dominantColor} 70%)`,
            backdropFilter: 'blur(20px)'
          }} />


        {/* Header */}
        <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between p-4 bg-transparent">
          <button
            onClick={onClose}
            className="p-3.5 rounded-full bg-white/10 backdrop-blur-md border border-white/10 opacity-100 mx-px text-center px-[4px] py-[4px]"
            aria-label="Close"
            type="button">

            <X className="text-white w-[20px] h-[20px]" />
          </button>

          {/* Post counter */}
        </div>

        {/* Media area */}
        <div
          className={cn(
            "flex-1 flex items-center justify-center relative overflow-hidden z-[1] transition-all duration-300 ease-out",
            slideDirection === 'down' && "animate-slide-out-up",
            slideDirection === 'up' && "animate-slide-out-down",
            !slideDirection && "animate-slide-in"
          )}
          onClick={handleMediaClick}>


          {isVideo(currentMediaUrl) ?
          <>
              <video
              ref={videoRef}
              src={currentMediaUrl}
              className="max-w-full max-h-full object-contain"
              loop
              playsInline
              autoPlay />


              {/* Play/Pause overlay */}
              <button
              onClick={(e) => {e.stopPropagation();togglePlay();}}
              className="absolute inset-0 flex items-center justify-center">

                <div className={cn(
                "p-4 rounded-full bg-black/30 backdrop-blur-sm transition-opacity",
                isPlaying ? "opacity-0" : "opacity-100"
              )}>
                  {isPlaying ?
                <Pause className="h-8 w-8 text-white" /> :
                <Play className="h-8 w-8 text-white" />
                }
                </div>
              </button>
            </> :

          <img
            src={currentMediaUrl}
            alt="Post media"
            className="max-w-full max-h-full object-contain" />

          }

          {/* Double-tap heart animation overlay */}
          {showDoubleTapHeart &&
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
              <Heart className="h-24 w-24 text-white fill-white drop-shadow-lg animate-heartBurst" />
            </div>
          }

          {/* Media indicators */}
          {mediaUrls.length > 1 &&
          <>
              {/* Dots */}
              <div className="absolute bottom-24 left-1/2 -translate-x-1/2 flex gap-1.5">
                {mediaUrls.map((_, index) =>
              <button
                key={index}
                onClick={(e) => {e.stopPropagation();setCurrentMediaIndex(index);}}
                className={cn(
                  "w-2 h-2 rounded-full transition-colors",
                  currentMediaIndex === index ? "bg-white" : "bg-white/40"
                )} />

              )}
              </div>

              {/* Navigation arrows */}
              {currentMediaIndex > 0 &&
            <button
              onClick={(e) => {e.stopPropagation();goToPrevMedia();}}
              className="absolute left-2 top-1/2 -translate-y-1/2 p-2 bg-black/30 backdrop-blur-sm px-px py-[5px] border-0 rounded-2xl opacity-85 text-left text-sm mx-0 my-0">

                  <ChevronLeft className="h-5 text-white w-[9px]" />
                </button>
            }
              {currentMediaIndex < mediaUrls.length - 1 &&
            <button
              onClick={(e) => {e.stopPropagation();goToNextMedia();}}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-black/30 backdrop-blur-sm opacity-85 px-px py-[5px] rounded-sm">

                  <ChevronRight className="h-5 text-white w-[10px] shadow-2xs opacity-100 px-px py-[5px]" />
                </button>
            }
            </>
          }
        </div>

        {/* Right side actions - vertical layout like reference */}
        <div className="absolute right-4 bottom-32 z-[2]">
          <FullscreenActions
            postId={currentPost.id}
            initialLikesCount={currentPost.likes_count}
            initialCommentsCount={currentPost.comments_count}
            initialViewsCount={currentPost.views_count ?? 0}
            videoUrl={isVideo(currentMediaUrl) ? currentMediaUrl : undefined}
            onOpenVideoPlayer={(url) => {
              setVideoPlayerSrc(url);
              setShowVideoPlayer(true);
              if (videoRef.current) videoRef.current.pause();
              setIsPlaying(false);
            }} />

        </div>

        {/* Author info */}
        <div className="absolute bottom-14 left-0 right-14 bg-transparent p-4 pt-14 z-[1]">
          <div className="flex items-center mb-2 gap-2">
            <UserAvatar userId={currentPost.user_id} avatarUrl={currentPost.author?.avatar_url} name={currentPost.author?.full_name} size="lg" className="border-2 border-white/20 ring-0" />
            <UserInfo userId={currentPost.user_id} name={currentPost.author?.full_name} username={currentPost.author?.username} variant="fullscreen" />
            <FollowButton targetUserId={currentPost.user_id} size="sm" />
          </div>
          {currentPost.content && <PostCaption content={currentPost.content} variant="fullscreen" />}
        </div>
      </div>

      {typeof document !== 'undefined' && showVideoPlayer && createPortal(
        <div
          className="fixed inset-0 z-[80] w-full h-full min-h-[100dvh] overflow-hidden bg-black"
          style={{ height: '100dvh', maxHeight: '100dvh' }}>

          <SamsungUltraVideoPlayer
            src={videoPlayerSrc}
            title={currentPost?.content?.slice(0, 50) || 'Video'}
            onClose={() => setShowVideoPlayer(false)} />

        </div>,
        document.body
      )}
    </>);

};