import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Play, Pause, ChevronLeft, ChevronRight, Heart, X, Send, Loader2 } from 'lucide-react';
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
import type { Short } from '@/components/shorts/YouTubeShortsSection';
import { useActiveStories } from '@/hooks/useActiveStories';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { StoryViewer } from '@/components/stories/StoryViewer';
import type { StoryGroup, Story } from '@/hooks/useStories';
import { ShareDialog } from '@/components/post/ShareDialog';
import { Icon } from '@iconify/react';
import { MusicOverlay } from '@/components/music/MusicOverlay';
import { playExclusiveAudio, stopActiveAudio } from '@/lib/audioController';
import { useSavedMusic } from '@/hooks/useSavedMusic';

type TabType = 'shorts' | 'posts';

interface UnifiedFullScreenViewerProps {
  posts: Post[];
  shorts: Short[];
  initialTab: TabType;
  initialIndex: number;
  onClose: () => void;
}

export const UnifiedFullScreenViewer = ({
  posts,
  shorts,
  initialTab,
  initialIndex,
  onClose
}: UnifiedFullScreenViewerProps) => {
  const { user } = useAuth();
  const { getStoryInfo } = useActiveStories();
  const [activeTab, setActiveTab] = useState<TabType>(initialTab);
  const [postIndex, setPostIndex] = useState(initialTab === 'posts' ? initialIndex : 0);
  const [shortIndex, setShortIndex] = useState(initialTab === 'shorts' ? initialIndex : 0);
  const [currentMediaIndex, setCurrentMediaIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [slideDirection, setSlideDirection] = useState<'up' | 'down' | null>(null);
  const [showDoubleTapHeart, setShowDoubleTapHeart] = useState(false);
  const [heartAnimClass, setHeartAnimClass] = useState('animate-heartBurst');
  const [showVideoPlayer, setShowVideoPlayer] = useState(false);
  const [videoPlayerSrc, setVideoPlayerSrc] = useState('');

  const [shortsPlaying, setShortsPlaying] = useState(true);
  const [showPlayIndicator, setShowPlayIndicator] = useState(false);

  const [showShortShare, setShowShortShare] = useState(false);

  const [storyViewerOpen, setStoryViewerOpen] = useState(false);
  const [storyViewerGroups, setStoryViewerGroups] = useState<StoryGroup[]>([]);
  const [isShortIframeReady, setIsShortIframeReady] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const ambientVideoRef = useRef<HTMLVideoElement>(null);
  const shortsIframeRef = useRef<HTMLIFrameElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);

  const mutedMediaRef = useRef(new Map<HTMLMediaElement, {muted: boolean;volume: number;}>());
  const touchStartY = useRef(0);
  const touchStartX = useRef(0);
  const touchStartTime = useRef(0);
  const touchMoved = useRef(false);

  const lastTapRef = useRef(0);
  const singleTapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const lastShortsTouchTapTs = useRef(0);

  const mouseDownRef = useRef(false);
  const mouseStartY = useRef(0);
  const mouseStartX = useRef(0);
  const playIndicatorTimeout = useRef<ReturnType<typeof setTimeout>>();

  const currentPost = activeTab === 'posts' ? posts[postIndex] : null;
  const currentShort = activeTab === 'shorts' ? shorts[shortIndex] : null;

  const { isSaved, save, unsave } = useSavedMusic();

  const audioKey = currentPost?.id ? `post:${currentPost.id}:unified_fullscreen` : null;

  const stopAudio = useCallback(() => {
    const el = audioRef.current;
    if (!el) return;
    try {
      el.pause();
    } catch {
      // ignore
    }
    setIsAudioPlaying(false);
  }, []);

  const playAudio = useCallback(async () => {
    if (!currentPost?.audio_url) return;
    if (!audioKey) return;
    const el = audioRef.current;
    if (!el) return;

    try {
      el.src = currentPost.audio_url;
      el.loop = true;
      el.preload = 'auto';
      el.crossOrigin = 'anonymous';
      try { el.load(); } catch {}
    } catch {
      // ignore
    }

    const ok = await playExclusiveAudio(audioKey, el);
    if (!ok) {
      setIsAudioPlaying(false);
      return;
    }
    setIsAudioPlaying(!el.paused);
  }, [audioKey, currentPost?.audio_url]);

  const toggleAudio = useCallback(() => {
    const el = audioRef.current;
    if (!el) return;
    if (isAudioPlaying) {
      stopActiveAudio(audioKey || undefined);
      stopAudio();
    } else {
      void playAudio();
    }
  }, [audioKey, isAudioPlaying, playAudio, stopAudio]);

  const handleClose = useCallback(() => {
    stopActiveAudio(audioKey || undefined);
    stopAudio();
    onClose();
  }, [audioKey, onClose, stopAudio]);

  const rawPostContent = currentPost?.content || '';
  const locationMatch = rawPostContent.match(/(?:^|\n)📍\s*(.+?)\s*$/m);
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

  const formatLocationShort = (text: string) => {
    const normalized = (text || '').trim();
    if (!normalized) return '';

    const parts = normalized
      .split(',')
      .map((p) => p.trim())
      .filter(Boolean);

    const drop = new Set(["o'zbekiston", 'ozbekiston', 'uzbekistan', 'republic of uzbekistan']);
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
  const postContentWithoutLocation = rawPostContent.replace(/(?:\n|^)📍\s*.+\s*$/m, '').trim();

  const mediaUrls = currentPost?.media_urls || (currentPost?.image_url ? [currentPost.image_url] : []);
  const currentMediaUrl = mediaUrls[currentMediaIndex];

  const isLowPowerDevice = useMemo(() => {
    if (typeof window === 'undefined') return false;
    try {
      const isSmallScreen = window.matchMedia?.('(max-width: 768px)')?.matches ?? false;
      const cores = typeof navigator !== 'undefined' ? (navigator as any).hardwareConcurrency : undefined;
      const lowCpu = typeof cores === 'number' ? cores <= 6 : false;
      return isSmallScreen || lowCpu;
    } catch {
      return false;
    }
  }, []);

  const ambientUrl = activeTab === 'posts' ?
  currentMediaUrl :
  currentShort ?
  `https://img.youtube.com/vi/${currentShort.id}/hqdefault.jpg` :
  undefined;

  const { isLiked, toggleLike } = usePostLikes(currentPost?.id || '');

  const isVideo = (url?: string) => url?.includes('.mp4') || url?.includes('.mov') || url?.includes('.webm');

  const { dominantColor, secondaryColor } = useColorExtractor(
    activeTab === 'posts' ? currentMediaUrl : undefined,
    isVideo(currentMediaUrl)
  );

  const bgStyle = activeTab === 'posts' && dominantColor ?
  { background: `linear-gradient(135deg, ${dominantColor} 0%, ${secondaryColor} 50%, ${dominantColor} 100%)` } :
  { background: '#000' };

  const ytOrigin = typeof window !== 'undefined' ? window.location.origin : '';

  const sendYouTubeCommand = useCallback((func: 'playVideo' | 'pauseVideo') => {
    const w = shortsIframeRef.current?.contentWindow;
    if (!w) return;
    w.postMessage(
      JSON.stringify({ event: 'command', func, args: [] }),
      '*'
    );
  }, []);

  const ensureAmbientPlayback = useCallback(() => {
    const ambient = ambientVideoRef.current;
    if (ambient && ambient.paused) {
      const p = ambient.play();
      if (p && typeof (p as any).catch === 'function') (p as any).catch(() => {});
    }

    const main = videoRef.current;
    if (main && !main.paused && main.readyState >= 2) return;
    if (main && isPlaying && main.paused) {
      const p = main.play();
      if (p && typeof (p as any).catch === 'function') (p as any).catch(() => {});
    }
  }, [isPlaying]);

  useEffect(() => {
    setCurrentMediaIndex(0);
    setIsPlaying(true);
    setShortsPlaying(true);
    stopActiveAudio(audioKey || undefined);
    stopAudio();

    // Auto-play audio for posts with music
    if (activeTab === 'posts' && currentPost?.audio_url && audioRef.current) {
      const t = setTimeout(() => void playAudio(), 400);
      return () => clearTimeout(t);
    }
  }, [postIndex, shortIndex, activeTab]);

  useEffect(() => {
    if (videoRef.current) {
      isPlaying ? videoRef.current.play().catch(() => {}) : videoRef.current.pause();
    }
  }, [isPlaying, currentMediaIndex, postIndex]);

  useEffect(() => {
    if (activeTab !== 'posts') return;
    if (!currentMediaUrl) return;
    if (!isVideo(currentMediaUrl)) return;

    const main = videoRef.current;
    const ambient = ambientVideoRef.current;
    if (!main || !ambient) return;

    let lastSyncTs = 0;

    const sync = (force = false) => {
      if (!main || !ambient) return;

      const now = performance.now();
      if (!force && isLowPowerDevice && now - lastSyncTs < 220) return;
      lastSyncTs = now;

      if (ambient.playbackRate !== main.playbackRate) {
        ambient.playbackRate = main.playbackRate;
      }

      const diff = Math.abs((ambient.currentTime || 0) - (main.currentTime || 0));
      const threshold = isLowPowerDevice ? 0.32 : 0.18;
      if (diff > threshold) {
        try {
          ambient.currentTime = main.currentTime;
        } catch {
          return;
        }
      }

      if (main.paused) {
        if (!ambient.paused) ambient.pause();
      } else {
        if (ambient.paused) {
          const p = ambient.play();
          if (p && typeof (p as any).catch === 'function') (p as any).catch(() => {});
        }
      }
    };

    const handleLoaded = () => {
      try {
        ambient.currentTime = main.currentTime || 0;
      } catch {
        // ignore
      }
      sync(true);
    };

    const handleTimeUpdate = () => sync(false);
    const handleRateChange = () => sync(true);
    const handlePlay = () => sync(true);
    const handlePause = () => sync(true);
    const handleSeeking = () => sync(true);

    ambient.muted = true;
    ambient.volume = 0;

    ambient.addEventListener('loadedmetadata', handleLoaded);
    main.addEventListener('loadedmetadata', handleLoaded);
    main.addEventListener('timeupdate', handleTimeUpdate);
    main.addEventListener('ratechange', handleRateChange);
    main.addEventListener('play', handlePlay);
    main.addEventListener('pause', handlePause);
    main.addEventListener('seeking', handleSeeking);

    sync(true);

    return () => {
      ambient.removeEventListener('loadedmetadata', handleLoaded);
      main.removeEventListener('loadedmetadata', handleLoaded);
      main.removeEventListener('timeupdate', handleTimeUpdate);
      main.removeEventListener('ratechange', handleRateChange);
      main.removeEventListener('play', handlePlay);
      main.removeEventListener('pause', handlePause);
      main.removeEventListener('seeking', handleSeeking);
    };
  }, [activeTab, currentMediaUrl, isLowPowerDevice]);

  useEffect(() => {
    if (activeTab === 'shorts') {
      if (videoRef.current) videoRef.current.pause();
      setIsPlaying(false);
    }
  }, [activeTab]);

  useEffect(() => {
    if (activeTab !== 'shorts') {
      mutedMediaRef.current.forEach((prev, el) => {
        el.muted = prev.muted;
        el.volume = prev.volume;
      });
      mutedMediaRef.current.clear();
      return;
    }

    const container = containerRef.current;
    const media = Array.from(document.querySelectorAll('video, audio')) as HTMLMediaElement[];

    for (const el of media) {
      if (container && container.contains(el)) continue;
      if (!mutedMediaRef.current.has(el)) {
        mutedMediaRef.current.set(el, { muted: el.muted, volume: el.volume });
      }
      try {el.pause();} catch {}
      el.muted = true;
      el.volume = 0;
    }

    return () => {
      mutedMediaRef.current.forEach((prev, el) => {
        el.muted = prev.muted;
        el.volume = prev.volume;
      });
      mutedMediaRef.current.clear();
    };
  }, [activeTab]);

  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {document.body.style.overflow = prevOverflow;};
  }, []);

  const smoothNavigate = useCallback((direction: 'up' | 'down') => {
    if (isTransitioning) return;
    const idx = activeTab === 'posts' ? postIndex : shortIndex;
    const count = activeTab === 'posts' ? posts.length : shorts.length;
    const canGo = direction === 'down' ? idx < count - 1 : idx > 0;
    if (!canGo) return;

    setIsTransitioning(true);
    setSlideDirection(direction);

    // Faster transition for smoother feel
    requestAnimationFrame(() => {
      if (activeTab === 'posts') {
        setPostIndex((prev) => direction === 'down' ? prev + 1 : prev - 1);
      } else {
        setShortIndex((prev) => direction === 'down' ? prev + 1 : prev - 1);
      }
      setTimeout(() => {
        setSlideDirection(null);
        setIsTransitioning(false);
      }, 150);
    });
  }, [isTransitioning, activeTab, postIndex, shortIndex, posts.length, shorts.length]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let isScrolling = false;
    let timeout: ReturnType<typeof setTimeout> | undefined;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (isScrolling || isTransitioning) return;
      if (Math.abs(e.deltaY) > 20) {
        isScrolling = true;
        smoothNavigate(e.deltaY > 0 ? 'down' : 'up');
        timeout = setTimeout(() => {isScrolling = false;}, 400);
      }
    };

    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      container.removeEventListener('wheel', handleWheel);
      if (timeout) clearTimeout(timeout);
    };
  }, [smoothNavigate, isTransitioning]);

  const handleTouchStart = (e: React.TouchEvent) => {
    ensureAmbientPlayback();
    touchMoved.current = false;
    touchStartY.current = e.touches[0].clientY;
    touchStartX.current = e.touches[0].clientX;
    touchStartTime.current = Date.now();
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    const diffY = Math.abs(touchStartY.current - e.touches[0].clientY);
    const diffX = Math.abs(touchStartX.current - e.touches[0].clientX);
    if (diffY > 8 || diffX > 8) touchMoved.current = true;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const diffY = touchStartY.current - e.changedTouches[0].clientY;
    const diffX = touchStartX.current - e.changedTouches[0].clientX;
    const elapsed = Date.now() - touchStartTime.current;
    const velocityY = Math.abs(diffY) / Math.max(elapsed, 1);
    // Lower threshold for faster swipes — feels more responsive
    const threshold = velocityY > 0.25 ? 16 : 34;

    // Tap detection for play/pause
    if (!touchMoved.current && Math.abs(diffY) < 8 && Math.abs(diffX) < 8 && elapsed < 300) {
      if (activeTab === 'shorts') {
        lastShortsTouchTapTs.current = Date.now();
        handleShortsTap();
      }
      return;
    }

    if (Math.abs(diffY) > Math.abs(diffX) && Math.abs(diffY) > threshold) {
      smoothNavigate(diffY > 0 ? 'down' : 'up');
    }
  };

  const handleShortsTap = useCallback(() => {
    setShortsPlaying((p) => {
      const next = !p;
      sendYouTubeCommand(next ? 'playVideo' : 'pauseVideo');
      // Show play/pause indicator briefly
      setShowPlayIndicator(true);
      if (playIndicatorTimeout.current) clearTimeout(playIndicatorTimeout.current);
      playIndicatorTimeout.current = setTimeout(() => setShowPlayIndicator(false), 800);
      return next;
    });
  }, [sendYouTubeCommand]);

  const handleMouseDown = (e: React.MouseEvent) => {
    ensureAmbientPlayback();
    mouseDownRef.current = true;
    mouseStartY.current = e.clientY;
    mouseStartX.current = e.clientX;
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    if (!mouseDownRef.current) return;
    mouseDownRef.current = false;

    const diffY = mouseStartY.current - e.clientY;
    const diffX = mouseStartX.current - e.clientX;

    // Tap detection for mouse
    if (Math.abs(diffY) < 5 && Math.abs(diffX) < 5) {
      if (activeTab === 'shorts') {
        handleShortsTap();
        return;
      }
    }

    const threshold = 60;
    if (Math.abs(diffY) > Math.abs(diffX) && Math.abs(diffY) > threshold) {
      smoothNavigate(diffY > 0 ? 'down' : 'up');
    }
  };

  const handleMediaClick = (e: React.MouseEvent) => {
    if (activeTab === 'shorts') return;
    if (touchMoved.current) return;

    const t = e.target as HTMLElement | null;
    if (t?.closest('button')) return;

    const now = Date.now();
    const DOUBLE_TAP_DELAY = 300;

    // Double tap => like + heart burst
    if (now - lastTapRef.current < DOUBLE_TAP_DELAY) {
      if (singleTapTimerRef.current) {
        clearTimeout(singleTapTimerRef.current);
        singleTapTimerRef.current = null;
      }
      lastTapRef.current = 0;

      const anims = ['animate-heartBurst', 'animate-likePop', 'animate-likeSwing', 'animate-likeFloat', 'animate-likePulse'];
      setHeartAnimClass(anims[Math.floor(Math.random() * anims.length)]);
      setShowDoubleTapHeart(true);
      if (!isLiked) toggleLike();
      setTimeout(() => setShowDoubleTapHeart(false), 900);
      return;
    }

    // Single tap (delayed) => toggle play for video
    lastTapRef.current = now;
    if (singleTapTimerRef.current) clearTimeout(singleTapTimerRef.current);
    singleTapTimerRef.current = setTimeout(() => {
      if (lastTapRef.current === 0) return;
      lastTapRef.current = 0;
      if (isVideo(currentMediaUrl)) setIsPlaying((p) => !p);
    }, DOUBLE_TAP_DELAY + 40);
  };

  const handleTabSwitch = (tab: TabType) => {
    if (tab === activeTab) return;
    stopActiveAudio(audioKey || undefined);
    stopAudio();
    setActiveTab(tab);
    setCurrentMediaIndex(0);

    // Reset to first item when switching to shorts
    if (tab === 'shorts') {
      let nextIndex = 0;
      try {
        const lastId = localStorage.getItem('yt_shorts_last_id');
        if (lastId) {
          const idx = shorts.findIndex((s) => s.id === lastId);
          if (idx >= 0) nextIndex = idx;
        }
      } catch {}
      setShortIndex(nextIndex);
    }
  };

  // Preload next short thumbnails
  useEffect(() => {
    if (activeTab !== 'shorts') return;
    const preloadCount = 3;
    for (let i = shortIndex + 1; i <= shortIndex + preloadCount && i < shorts.length; i++) {
      const img = new Image();
      img.src = shorts[i].thumbnail;
    }
  }, [shortIndex, activeTab, shorts]);

  // Preload upcoming shorts iframes by keeping adjacent ones in DOM
  const PRELOAD_COUNT = 2;
  const preloadRange = Array.from(
    { length: PRELOAD_COUNT * 2 + 1 },
    (_, i) => shortIndex - PRELOAD_COUNT + i
  ).filter((i) => i >= 0 && i < shorts.length);

  const renderShort = () => {
    if (!currentShort) {
      return (
        <div className="flex-1 flex items-center justify-center text-white/50 text-sm">
          Shorts topilmadi
        </div>);
    }
    return (
      <div className={cn(
        "flex-1 flex items-center justify-center relative overflow-hidden z-[1] transition-all duration-200 ease-out",
        slideDirection === 'down' && "animate-slide-out-up",
        slideDirection === 'up' && "animate-slide-out-down",
        !slideDirection && "animate-slide-in"
      )}
      onClick={(e) => {
        if (isTransitioning) return;
        if (Date.now() - lastShortsTouchTapTs.current < 450) return;
        const t = e.target as HTMLElement | null;
        if (t?.closest('button')) return;
        handleShortsTap();
      }}>
        <div className="relative w-full h-full">
          {!isShortIframeReady &&
          <>
              <img
              key={`thumb-${currentShort.id}`}
              src={currentShort.thumbnail}
              alt=""
              className="absolute inset-0 w-full h-full object-cover z-[1]" />
            
              <div className="absolute inset-0 z-[2] bg-black/35" />
              <div className="absolute inset-0 z-[2] flex items-center justify-center">
                <div className="p-4 rounded-full bg-black/35 backdrop-blur-sm border border-white/10">
                  <Loader2 className="h-7 w-7 text-white animate-spin" />
                </div>
              </div>
            </>
          }

          {/* Render current + adjacent iframes for instant switching */}
          {preloadRange.map((idx) => {
            const s = shorts[idx];
            if (!s) return null;
            const isCurrent = idx === shortIndex;
            return (
              <iframe
                key={s.id}
                ref={isCurrent ? shortsIframeRef : undefined}
                src={`https://www.youtube.com/embed/${s.id}?rel=0&autoplay=${isCurrent ? '1' : '0'}&controls=0&modestbranding=1&playsinline=1&loop=1&playlist=${s.id}&showinfo=0&iv_load_policy=3&disablekb=1&fs=0&enablejsapi=1&origin=${encodeURIComponent(ytOrigin)}`}
                className={cn(
                  "absolute inset-0 w-full h-full pointer-events-none transition-opacity duration-150",
                  isCurrent ? "opacity-100 z-[2]" : "opacity-0 z-[1]"
                )}
                onLoad={isCurrent ? () => setIsShortIframeReady(true) : undefined}
                allow="autoplay; encrypted-media"
                allowFullScreen
                title={s.title} />);
          })}

          {/* Mask YouTube UI overlays */}
          <div className="absolute top-0 left-0 right-0 h-14 z-[3] pointer-events-none bg-black" />
          <div className="absolute bottom-0 left-0 right-0 h-28 z-[3] pointer-events-none bg-black" />
        </div>

        {/* Play/Pause indicator */}
        <div className={cn(
          "absolute inset-0 z-[4] flex items-center justify-center pointer-events-none transition-opacity duration-300",
          showPlayIndicator ? "opacity-100" : "opacity-0"
        )}>
          <div className="p-4 rounded-full bg-black/35 backdrop-blur-sm border border-white/10">
            {shortsPlaying ?
            <Play className="h-8 w-8 text-white" /> :
            <Pause className="h-8 w-8 text-white" />}
          </div>
        </div>

        <div className="absolute bottom-14 left-0 right-0 px-4 pb-4 pt-16 z-[5] pointer-events-none">
          <div className="flex items-end gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-medium text-white leading-snug line-clamp-2 drop-shadow-lg">
                {currentShort.title}
              </p>
              <p className="text-[11px] text-white/50 mt-1 drop-shadow">{currentShort.channelTitle}</p>
            </div>
            <div className="shrink-0 flex items-center gap-1 bg-white/10 backdrop-blur-md rounded-full px-2.5 py-1 border border-white/10">
              <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 text-red-500 fill-current">
                <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814z" />
                <path d="M9.545 15.568V8.432L15.818 12l-6.273 3.568z" className="fill-white" />
              </svg>
              <span className="text-[10px] text-white/70 font-medium">Shorts</span>
            </div>
          </div>
        </div>

        {/* Position counter */}
        <div className="absolute right-3 bottom-20 z-[5] bg-white/10 backdrop-blur-md rounded-full px-2 py-0.5 border border-white/10 opacity-0">
          <span className="text-[10px] text-white/70 font-medium">{shortIndex + 1}/{shorts.length}</span>
        </div>

        {/* Shorts Share */}
        <div className="absolute right-3 bottom-28 z-[6]">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setShowShortShare(true);
            }}
            className="p-2.5 rounded-full bg-white/10 backdrop-blur-md border border-white/10 hover:bg-white/15 transition-colors py-[4px] px-[9px] my-[190px]">

            <Send className="h-5 w-5 text-white" />
          </button>
        </div>

        <ShareDialog
          open={showShortShare}
          onOpenChange={setShowShortShare}
          shortId={currentShort.id} />

      </div>);

  };

  // ─── RENDER: Posts tab ───
  const renderPost = () => {
    if (!currentPost) return null;
    return (
      <>
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
              <video ref={videoRef} src={currentMediaUrl} className="max-w-full max-h-full object-contain" loop playsInline autoPlay />
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className={cn("p-4 rounded-full bg-black/30 backdrop-blur-sm transition-opacity", isPlaying ? "opacity-0" : "opacity-100")}>
                  {isPlaying ? <Pause className="h-8 w-8 text-white" /> : <Play className="h-8 w-8 text-white" />}
                </div>
              </div>
            </> :
          <img src={currentMediaUrl} alt="Post media" className="max-w-full max-h-full object-contain" />
          }

          {showDoubleTapHeart &&
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
              <Heart className={cn("h-28 w-28 text-[#ff2d55] fill-[#ff2d55] drop-shadow-2xl", heartAnimClass)} />
            </div>
          }

          {currentPost.audio_url && (
            <div className="absolute bottom-6 right-4 z-30" onClick={(e) => e.stopPropagation()}>
              <MusicOverlay
                audioTitle={currentPost.audio_title}
                audioArtist={currentPost.audio_artist}
                isPlaying={isAudioPlaying}
                isSaved={isSaved(currentPost.audio_url)}
                onTogglePlay={toggleAudio}
                onToggleSave={() => {
                  if (!currentPost.audio_url) return;
                  if (isSaved(currentPost.audio_url)) {
                    void unsave(currentPost.audio_url);
                  } else {
                    void save({
                      audio_url: currentPost.audio_url,
                      audio_title: currentPost.audio_title,
                      audio_artist: currentPost.audio_artist,
                    });
                  }
                }}
              />

              <audio
                ref={audioRef}
                preload="none"
                onPlay={() => setIsAudioPlaying(true)}
                onPause={() => setIsAudioPlaying(false)}
                onEnded={() => setIsAudioPlaying(false)}
                className="absolute left-0 top-0 h-px w-px opacity-0 pointer-events-none"
              />
            </div>
          )}
          {mediaUrls.length > 1 &&
          <>
              <div className="absolute bottom-20 left-1/2 -translate-x-1/2 flex gap-1.5">
                {mediaUrls.map((_, i) =>
              <button key={i} onClick={(e) => {e.stopPropagation();setCurrentMediaIndex(i);}}
              className={cn("w-1.5 h-1.5 rounded-full transition-colors", currentMediaIndex === i ? "bg-white" : "bg-white/30")} />
              )}
              </div>
              {currentMediaIndex > 0 &&
            <button onClick={(e) => {e.stopPropagation();setCurrentMediaIndex((p) => p - 1);}}
            className="absolute left-2 top-1/2 -translate-y-1/2 p-1.5 bg-black/20 backdrop-blur-sm rounded-full">
                  <ChevronLeft className="h-4 w-4 text-white" />
                </button>
            }
              {currentMediaIndex < mediaUrls.length - 1 &&
            <button onClick={(e) => {e.stopPropagation();setCurrentMediaIndex((p) => p + 1);}}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 bg-black/20 backdrop-blur-sm rounded-full">
                  <ChevronRight className="h-4 w-4 text-white" />
                </button>
            }
            </>
          }
        </div>

        {/* Actions */}
        <div className="absolute right-3 bottom-24 z-[2]">
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
              stopActiveAudio(audioKey || undefined);
              stopAudio();
            }} />

        </div>

        {/* Author info */}
        <div className="absolute bottom-14 left-0 right-14 p-4 pt-14 z-[1]">
          <div className="flex items-center mb-2 gap-2">
            <UserAvatar
              userId={currentPost.user_id}
              avatarUrl={currentPost.author?.avatar_url}
              name={currentPost.author?.full_name}
              size="lg"
              className="border-2 border-white/20 ring-0"
              hasStory={!!getStoryInfo(currentPost.user_id)}
              storyRingId={getStoryInfo(currentPost.user_id)?.ring_id}
              hasUnviewedStory={getStoryInfo(currentPost.user_id)?.has_unviewed}
              onStoryClick={() => openStoriesForUser(currentPost.user_id)} />

            <UserInfo userId={currentPost.user_id} name={currentPost.author?.full_name} username={currentPost.author?.username} variant="fullscreen" />
            <FollowButton targetUserId={currentPost.user_id} size="sm" />
          </div>
          {activeTab === 'posts' && locationTextShort && mapUrl && (
            <a
              href={mapUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-xs text-white/70 font-medium uppercase max-w-[80%] hover:text-white transition-colors"
              title={locationText}
            >
              <Icon icon="gis:location-poi" className="h-3.5 w-3.5 flex-shrink-0" />
              <span className="truncate">{locationTextShort}</span>
            </a>
          )}

          {postContentWithoutLocation && <PostCaption content={postContentWithoutLocation} variant="fullscreen" />}
        </div>
      </>);
  };

  const fetchStoryGroupForUser = useCallback(async (targetUserId: string): Promise<StoryGroup | null> => {
    try {
      const { data: stories, error } = await supabase.
      from('stories').
      select('*').
      eq('user_id', targetUserId).
      gt('expires_at', new Date().toISOString()).
      order('created_at', { ascending: true });

      if (error) throw error;
      if (!stories || stories.length === 0) return null;

      const { data: profiles } = await supabase.
      from('profiles').
      select('id, name, username, avatar_url').
      in('id', [targetUserId]);

      const authorProfile = profiles?.find((p) => p.id === targetUserId);
      const viewerId = user?.id;

      const [viewsRes, likesRes] = await Promise.all([
      viewerId ?
      supabase.from('story_views').select('story_id').eq('viewer_id', viewerId).in('story_id', stories.map((s) => s.id)) :
      Promise.resolve({ data: [] as any[] }),
      viewerId ?
      supabase.from('story_likes').select('story_id').eq('user_id', viewerId).in('story_id', stories.map((s) => s.id)) :
      Promise.resolve({ data: [] as any[] })]
      );

      const viewedStoryIds = new Set((viewsRes as any)?.data?.map((v: any) => v.story_id) || []);
      const likedStoryIds = new Set((likesRes as any)?.data?.map((l: any) => l.story_id) || []);

      const normalizedStories: Story[] = stories.map((s: any) => ({
        ...s,
        media_type: s.media_type as 'image' | 'video',
        ring_id: s.ring_id || 'default',
        author: authorProfile ? {
          id: authorProfile.id,
          name: authorProfile.name,
          username: authorProfile.username,
          avatar_url: authorProfile.avatar_url
        } : undefined,
        has_viewed: viewerId ? viewedStoryIds.has(s.id) : false,
        has_liked: viewerId ? likedStoryIds.has(s.id) : false
      }));

      return {
        user_id: targetUserId,
        user: authorProfile || { id: targetUserId, name: null, username: null, avatar_url: null },
        stories: normalizedStories,
        has_unviewed: normalizedStories.some((s) => !s.has_viewed)
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
    return () => {
      stopActiveAudio(audioKey || undefined);
      stopAudio();
    };
  }, [audioKey, stopAudio]);

  return (
    <>
      <div
        ref={containerRef}
        className="fixed inset-0 z-[60] flex flex-col overflow-hidden touch-none"
        style={{
          backgroundColor: '#000',
          ...bgStyle
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}>

        {ambientUrl &&
        <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
            <div className="absolute inset-0">
              {activeTab === 'posts' && isVideo(ambientUrl) ?
            <video
              key={ambientUrl}
              ref={ambientVideoRef}
              src={ambientUrl}
              className="absolute inset-0 w-full h-full object-cover"
              style={{
                filter: 'blur(16px) saturate(145%) brightness(0.92) contrast(1.05)',
                transform: 'scale(1.08)',
                opacity: 0.72
              }}
              muted
              playsInline
              autoPlay
              loop
              preload="metadata"
              controls={false}
              disablePictureInPicture /> :


            <img
              key={ambientUrl}
              src={ambientUrl}
              alt=""
              className="absolute inset-0 w-full h-full object-cover"
              style={{
                filter: 'blur(16px) saturate(145%) brightness(0.92) contrast(1.05)',
                transform: 'scale(1.08)',
                opacity: 0.72
              }} />

            }

              <div className="absolute inset-0 bg-black/28" />
              <div className="absolute inset-0 bg-gradient-to-b from-black/45 via-transparent to-black/55" />
              <div
              className="absolute inset-[-10%]"
              style={{
                background:
                'radial-gradient(ellipse at center, rgba(0,0,0,0.06) 0%, rgba(0,0,0,0.38) 58%, rgba(0,0,0,0.72) 100%)'
              }} />
            
            </div>
          </div>
        }

        {activeTab === 'posts' && dominantColor &&
        <div className="absolute inset-0 z-0" style={{
          background: `radial-gradient(ellipse at center, transparent 0%, ${dominantColor} 70%)`,
          backdropFilter: 'blur(20px)'
        }} />
        }

        {/* Top bar with tabs */}
        <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-3 pt-[env(safe-area-inset-top,10px)] pb-2 bg-gradient-to-b from-black/50 to-transparent">
          <button onClick={handleClose} className="p-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/10 my-0">
            <X className="w-4 h-4 text-white" />
          </button>

          <div className="flex gap-0.5 bg-white/10 backdrop-blur-md rounded-full p-0.5 border border-white/10 py-[2px] my-[23px]">
            <button
              onClick={() => handleTabSwitch('shorts')}
              className={cn(
                "px-3.5 py-1 rounded-full text-[11px] font-medium transition-all",
                activeTab === 'shorts' ? "bg-white/20 text-white shadow-sm" : "text-white/50 hover:text-white/70"
              )}>
              yt shorts
            </button>
            <button
              onClick={() => handleTabSwitch('posts')}
              className={cn(
                "px-3.5 py-1 rounded-full text-[11px] font-medium transition-all",
                activeTab === 'posts' ? "bg-white/20 text-white shadow-sm" : "text-white/50 hover:text-white/70"
              )}>
              postlar
            </button>
          </div>

          <div className="w-7" />
        </div>

        {/* Content */}
        {activeTab === 'shorts' ? renderShort() : renderPost()}
      </div>

      {typeof document !== 'undefined' && showVideoPlayer && createPortal(
        <div className="fixed inset-0 z-[80] w-full h-full min-h-[100dvh] overflow-hidden bg-black" style={{ height: '100dvh' }}>
          <SamsungUltraVideoPlayer
            src={videoPlayerSrc}
            title={currentPost?.content?.slice(0, 50) || 'Video'}
            onClose={() => setShowVideoPlayer(false)} />

        </div>,
        document.body
      )}

      {storyViewerOpen && storyViewerGroups.length > 0 &&
      <StoryViewer
        storyGroups={storyViewerGroups}
        initialGroupIndex={0}
        onClose={() => setStoryViewerOpen(false)} />

      }
    </>);

};