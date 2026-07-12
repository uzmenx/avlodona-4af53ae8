import { useState, useRef, useEffect } from 'react';

import { ChevronLeft, ChevronRight, Volume2, VolumeX } from 'lucide-react';

import { cn } from '@/lib/utils';
import { useAudio } from '@/contexts/AudioContext';
import type { ProgressiveStage } from '@/hooks/useProgressiveLoading';

interface GifOverlay {
  id: string;
  url: string;
  originalUrl?: string;
  x: number;
  y: number;
  scale: number;
  rotation: number;
}

interface MediaCarouselProps {
  mediaUrls: string[];
  className?: string;
  onVideoDoubleTap?: () => void;
  onVideoSingleTap?: () => void;
  mediaMetadata?: Array<{ gifOverlays?: GifOverlay[] }> | null;
  stage?: ProgressiveStage;
  onPreviewReady?: () => void;
}

export const MediaCarousel = ({ mediaUrls, className, onVideoDoubleTap, onVideoSingleTap, mediaMetadata, stage = 'full', onPreviewReady }: MediaCarouselProps) => {

  const [currentIndex, setCurrentIndex] = useState(0);

  const [isVisible, setIsVisible] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);

  // We keep one ref per media slot (up to the mediaUrls length)
  const videoRefs = useRef<(HTMLVideoElement | null)[]>([]);

  const instanceIdRef = useRef(
    typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `vid_${Date.now()}_${Math.random()}`
  );

  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const touchMoved = useRef(false);

  const lastTapTsRef = useRef(0);
  const singleTapTimerRef = useRef<number | null>(null);

  const { isMuted, toggleMute } = useAudio();

  const isVideo = (url: string) => {
    if (!url) return false;
    const lower = url.toLowerCase();
    return lower.includes('.mp4') || lower.includes('.mov') || lower.includes('.webm') || lower.includes('.m4v') || lower.includes('.3gp') || lower.includes('.avi') || lower.includes('video');
  };

  const handleVideoTap = (e: React.SyntheticEvent<HTMLVideoElement>, index: number) => {
    e.preventDefault();
    e.stopPropagation();
    if (touchMoved.current) return;

    const now = Date.now();
    const DOUBLE_TAP_DELAY = 300;

    if (now - lastTapTsRef.current < DOUBLE_TAP_DELAY) {
      if (singleTapTimerRef.current) {
        clearTimeout(singleTapTimerRef.current);
        singleTapTimerRef.current = null;
      }
      lastTapTsRef.current = 0;
      onVideoDoubleTap?.();
      return;
    }

    lastTapTsRef.current = now;
    if (singleTapTimerRef.current) clearTimeout(singleTapTimerRef.current);
    singleTapTimerRef.current = window.setTimeout(() => {
      if (lastTapTsRef.current === 0) return;
      lastTapTsRef.current = 0;
      if (onVideoSingleTap) {
        onVideoSingleTap();
      } else {
        handleVideoClick(index);
      }
    }, DOUBLE_TAP_DELAY + 40);
  };

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (document.hidden) {
          setIsVisible(false);
          return;
        }
        setIsVisible(entry.isIntersecting && entry.intersectionRatio >= 0.1);
      },
      { threshold: [0, 0.1, 0.25, 0.5, 0.75, 1] }
    );

    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const onRequestPlay = (e: Event) => {
      const ce = e as CustomEvent<{ id?: string }>;
      if (ce.detail?.id === instanceIdRef.current) return;
      // Pause all videos in this carousel
      videoRefs.current.forEach(v => { if (v && !v.paused) v.pause(); });
    };
    window.addEventListener('avlodona:video:request-play', onRequestPlay);
    return () => window.removeEventListener('avlodona:video:request-play', onRequestPlay);
  }, []);

  // Manage play/pause based on visibility and currentIndex
  useEffect(() => {
    videoRefs.current.forEach((video, index) => {
      if (!video) return;
      if (index === currentIndex && stage === 'full' && isVisible) {
        window.dispatchEvent(
          new CustomEvent('avlodona:video:request-play', { detail: { id: instanceIdRef.current } })
        );
        video.play().catch(() => {});
      } else {
        video.pause();
      }
    });
  }, [isVisible, currentIndex, stage]);

  // Reset current video to start when switching slides
  useEffect(() => {
    const video = videoRefs.current[currentIndex];
    if (video && isVideo(mediaUrls[currentIndex])) {
      if (stage === 'full' && isVisible) {
        video.currentTime = 0;
        window.dispatchEvent(
          new CustomEvent('avlodona:video:request-play', { detail: { id: instanceIdRef.current } })
        );
        video.play().catch(() => {});
      } else {
        video.pause();
      }
    }
  }, [currentIndex, isVisible, mediaUrls, stage]);

  // Sync video audio level with isMuted state
  useEffect(() => {
    videoRefs.current.forEach(video => {
      if (video) video.muted = isMuted;
    });
  }, [isMuted, currentIndex]);

  if (!mediaUrls || mediaUrls.length === 0) return null;

  const goTo = (index: number) => {
    setCurrentIndex(index);
  };

  const goPrev = () => {
    setCurrentIndex((prev) => prev === 0 ? mediaUrls.length - 1 : prev - 1);
  };

  const goNext = () => {
    setCurrentIndex((prev) => prev === mediaUrls.length - 1 ? 0 : prev + 1);
  };

  const handleVideoClick = (index: number) => {
    const video = videoRefs.current[index];
    if (video) {
      if (video.paused) {
        window.dispatchEvent(
          new CustomEvent('avlodona:video:request-play', { detail: { id: instanceIdRef.current } })
        );
        video.play().catch(() => {});
      } else {
        video.pause();
      }
    }
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    touchMoved.current = false;
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    const dx = Math.abs(e.touches[0].clientX - touchStartX.current);
    const dy = Math.abs(e.touches[0].clientY - touchStartY.current);
    if (dx > 8 || dy > 8) touchMoved.current = true;
  };

  const handleSwipeEnd = (e: React.TouchEvent) => {
    if (mediaUrls.length <= 1) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    const dy = e.changedTouches[0].clientY - touchStartY.current;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      if (dx < 0) goNext();
      else goPrev();
    }
  };

  const showMute = isVideo(mediaUrls[currentIndex]);

  return (
    <div
      ref={containerRef}
      className={cn("relative", className)}
      style={{ touchAction: 'pan-y' }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleSwipeEnd}
    >
      <div
        className="relative w-full overflow-hidden bg-white/10 backdrop-blur-[10px] border border-white/20 flex items-center justify-center"
        style={{ maxHeight: '80vh', minHeight: '200px', touchAction: 'pan-y' }}
      >
        {stage === 'meta' && (
          <div className="absolute inset-0 shimmer" />
        )}

        {showMute && stage === 'full' && (
          <button
            type="button"
            aria-label={isMuted ? 'Unmute' : 'Mute'}
            className="absolute right-2 top-2 z-30 p-2 rounded-full bg-black/35 backdrop-blur-sm border border-white/10"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              toggleMute();
            }}
          >
            {isMuted ? (
              <VolumeX className="h-4 w-4 text-white" />
            ) : (
              <Volume2 className="h-4 w-4 text-white" />
            )}
          </button>
        )}

        {/* Render ALL media items in the DOM simultaneously, only the active one is visible.
            This prevents re-downloading on each swipe — instant switching! */}
        {mediaUrls.map((url, index) => {
          const active = index === currentIndex;
          const overlays = mediaMetadata?.[index]?.gifOverlays;

          return (
            <div
              key={`${url}-${index}`}
              aria-hidden={!active}
              style={{
                position: active ? 'relative' : 'absolute',
                inset: 0,
                display: active ? 'flex' : 'none',
                alignItems: 'center',
                justifyContent: 'center',
                width: '100%',
              }}
            >
              {isVideo(url) ? (
                <>
                  {(stage === 'meta' || stage === 'preview' || stage === 'full') && (
                    <video
                      ref={(el) => { videoRefs.current[index] = el; }}
                      src={url}
                      className={cn(
                        "w-full h-auto object-contain cursor-pointer transition-[filter,opacity] duration-700",
                        stage === 'meta' ? 'blur-xl grayscale opacity-40' :
                        stage === 'preview' ? 'blur-lg grayscale opacity-100' : 'blur-0 grayscale-0',
                        stage === 'full' ? 'fade-in' : ''
                      )}
                      style={{ maxHeight: '80vh', maxWidth: '100%' }}
                      loop
                      muted={isMuted}
                      playsInline
                      autoPlay={stage === 'full' && active && isVisible}
                      onClick={(e) => handleVideoTap(e, index)}
                      onTouchEnd={(e) => handleVideoTap(e, index)}
                      preload={active && isVisible ? 'metadata' : 'none'}
                      onLoadedData={() => {
                        if (stage === 'preview' || stage === 'meta') onPreviewReady?.();
                      }}
                    />
                  )}
                </>
              ) : (
                <>
                  {(stage === 'meta' || stage === 'preview' || stage === 'full') && (
                    <img
                      src={stage === 'preview' ? `${url}?width=400&quality=20` : url}
                      alt="Post media"
                      className={cn(
                        "w-full h-auto object-contain transition-[filter,opacity,transform] duration-700",
                        stage === 'meta' ? 'blur-xl opacity-40' :
                        stage === 'preview' ? 'blur-lg scale-105 opacity-100' : 'blur-0 scale-100',
                        stage === 'full' ? 'fade-in' : ''
                      )}
                      style={{ maxHeight: '80vh', maxWidth: '100%' }}
                      loading={active ? 'eager' : 'lazy'}
                      fetchPriority={active ? 'high' : 'low'}
                      decoding="async"
                      onLoad={() => {
                        if (stage === 'preview' || stage === 'meta') onPreviewReady?.();
                      }}
                    />
                  )}
                </>
              )}

              {/* GIF Overlays for photos */}
              {!isVideo(url) && overlays && overlays.length > 0 && overlays.map(gif => (
                <img
                  key={gif.id}
                  src={gif.originalUrl || gif.url}
                  alt="gif sticker"
                  decoding="async"
                  draggable={false}
                  className="absolute pointer-events-none select-none"
                  style={{
                    left: `${gif.x}%`,
                    top: `${gif.y}%`,
                    transform: `translate(-50%, -50%) scale(${gif.scale}) rotate(${gif.rotation}deg)`,
                    width: '28%',
                    maxWidth: '160px',
                    zIndex: 20,
                    willChange: 'transform',
                  }}
                />
              ))}
            </div>
          );
        })}
      </div>

      {mediaUrls.length > 1 &&
        <>
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
            {mediaUrls.map((_, index) =>
              <button
                key={index}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  goTo(index);
                }}
                className={cn(
                  "w-2 h-2 rounded-full transition-colors",
                  currentIndex === index ? "bg-white" : "bg-white/40"
                )} />
            )}
          </div>
        </>
      }
    </div>
  );
};