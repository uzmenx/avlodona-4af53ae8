import { useState, useRef, useEffect } from 'react';

import { ChevronLeft, ChevronRight } from 'lucide-react';

import { cn } from '@/lib/utils';

interface MediaCarouselProps {
  mediaUrls: string[];
  className?: string;
  onVideoDoubleTap?: () => void;
  onVideoSingleTap?: () => void;
}

export const MediaCarousel = ({ mediaUrls, className, onVideoDoubleTap, onVideoSingleTap }: MediaCarouselProps) => {

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
        setIsVisible(entry.isIntersecting && entry.intersectionRatio >= 0.4);
      },
      { threshold: [0, 0.25, 0.4, 0.5, 0.75, 1] }
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

    if (isVisible) {
      window.dispatchEvent(
        new CustomEvent('avlodona:video:request-play', { detail: { id: instanceIdRef.current } })
      );
      video.play().catch(() => {});
    } else {
      video.pause();
    }
  }, [isVisible, currentIndex, mediaUrls]);

  useEffect(() => {
    const video = videoRef.current;
    if (video && isVideo(mediaUrls[currentIndex])) {
      if (isVisible) {
        video.currentTime = 0;
        window.dispatchEvent(
          new CustomEvent('avlodona:video:request-play', { detail: { id: instanceIdRef.current } })
        );
        video.play().catch(() => {});
      } else {
        video.pause();
      }
    }
  }, [currentIndex, isVisible, mediaUrls]);

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

  return (
    <div
      ref={containerRef}
      className={cn("relative", className)}
      style={{ touchAction: 'pan-y' }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
    >
      <div className="relative w-full overflow-hidden bg-white/10 backdrop-blur-[10px] border border-white/20 flex items-center justify-center" style={{ maxHeight: '80vh', minHeight: '200px', touchAction: 'pan-y' }}>
        {isVideo(mediaUrls[currentIndex]) ?
          <video
            ref={videoRef}
            src={mediaUrls[currentIndex]}
            className="w-full h-auto object-contain cursor-pointer"
            style={{ maxHeight: '80vh', maxWidth: '100%' }}
            loop
            muted
            playsInline
            onClick={handleVideoTap}
            onTouchEnd={handleVideoTap}
          />
          :
          <img
            src={mediaUrls[currentIndex]}
            alt={`Media ${currentIndex + 1}`}
            className="w-full h-auto object-contain"
            style={{ maxHeight: '80vh', maxWidth: '100%' }}
          />
        }
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