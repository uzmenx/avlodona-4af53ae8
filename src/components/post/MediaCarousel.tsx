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

  const videoRef = useRef<HTMLVideoElement>(null);

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
    return url.includes('.mp4') || url.includes('.mov') || url.includes('.webm');
  };

  const handleVideoTap = (e: React.SyntheticEvent<HTMLVideoElement>) => {
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
        handleVideoClick();
      }
    }, DOUBLE_TAP_DELAY + 40);
  };

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        // Use a slightly lower threshold like 0.4 to ensure taller videos still trigger
        // However, specifically checking if the document is hidden helps with page switching
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
      const v = videoRef.current;
      if (!v) return;
      if (!v.paused) v.pause();
    };
    window.addEventListener('avlodona:video:request-play', onRequestPlay);
    return () => window.removeEventListener('avlodona:video:request-play', onRequestPlay);
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !isVideo(mediaUrls[currentIndex])) return;

    if (stage === 'full' && isVisible) {
      window.dispatchEvent(
        new CustomEvent('avlodona:video:request-play', { detail: { id: instanceIdRef.current } })
      );
      video.play().catch(() => {});
    } else {
      video.pause();
    }
  }, [isVisible, currentIndex, mediaUrls, stage]);

  useEffect(() => {
    const video = videoRef.current;
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
    const video = videoRef.current;
    if (video) {
      video.muted = isMuted;
    }
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

  const handleVideoClick = () => {
    const video = videoRef.current;
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

  const showMute = isVideo(mediaUrls[currentIndex]);

  return (
    <div
      ref={containerRef}
      className={cn("relative", className)}
      style={{ touchAction: 'pan-y' }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
    >
      <div className="relative w-full overflow-hidden bg-white/10 backdrop-blur-[10px] border border-white/20 flex items-center justify-center" style={{ maxHeight: '80vh', minHeight: '200px', touchAction: 'pan-y' }}>
        {stage === 'meta' && (
          <div className="absolute inset-0 shimmer" />
        )}

        {showMute && stage === 'full' && (
          <button
            type="button"
            aria-label={isMuted ? 'Unmute' : 'Mute'}
            className="absolute right-2 top-2 z-30 p-2 rounded-full bg-black/35 backdrop-blur-sm border border-white/10"
            onPointerUp={(e) => {
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

        {isVideo(mediaUrls[currentIndex]) ? (
          <>
            {(stage === 'meta' || stage === 'preview' || stage === 'full') && (
              <video
                ref={videoRef}
                src={mediaUrls[currentIndex]}
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
                autoPlay={stage === 'full'}
                onClick={handleVideoTap}
                onTouchEnd={handleVideoTap}
                preload={stage === 'full' ? 'auto' : 'metadata'}
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
                src={stage === 'preview' ? `${mediaUrls[currentIndex]}?width=400&quality=20` : mediaUrls[currentIndex]}
                alt="Post media"
                className={cn(
                  "w-full h-auto object-contain transition-[filter,opacity,transform] duration-700",
                  stage === 'meta' ? 'blur-xl opacity-40' :
                  stage === 'preview' ? 'blur-lg scale-105 opacity-100' : 'blur-0 scale-100',
                  stage === 'full' ? 'fade-in' : ''
                )}
                style={{ maxHeight: '80vh', maxWidth: '100%' }}
                loading="lazy"
                onLoad={() => {
                  if (stage === 'preview' || stage === 'meta') onPreviewReady?.();
                }}
              />
            )}
          </>
        )}

        {/* GIF Overlays — rendered as live animated images on top of media (Instagram-style) */}
        {(() => {
          const overlays = mediaMetadata?.[currentIndex]?.gifOverlays;
          if (!overlays || overlays.length === 0) return null;
          return overlays.map(gif => (
            <img
              key={gif.id}
              src={gif.originalUrl || gif.url}
              alt="gif sticker"
              loading="lazy"
              className="absolute pointer-events-none select-none"
              style={{
                left: `${gif.x}%`,
                top: `${gif.y}%`,
                transform: `translate(-50%, -50%) scale(${gif.scale}) rotate(${gif.rotation}deg)`,
                width: '28%',
                maxWidth: '160px',
                zIndex: 20,
              }}
            />
          ));
        })()}
      </div>



      {mediaUrls.length > 1 &&

      <>

          <button

          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            goPrev();
          }}

          className="absolute left-2 top-1/2 -translate-y-1/2 p-1.5 bg-white/20 backdrop-blur-[10px] border border-white/30 rounded-full shadow-md hover:bg-white/30 transition-colors mr-0 px-px opacity-75">



            <ChevronLeft className="h-[15px] w-[15px] text-white" />

          </button>

          <button

          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            goNext();
          }}

          className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 bg-white/20 backdrop-blur-[10px] border border-white/30 rounded-full shadow-md hover:bg-white/30 transition-colors px-px opacity-75">



            <ChevronRight className="h-[15px] w-[15px] text-white" />

          </button>



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

    </div>);



};