import { useState, useRef, useEffect, useCallback, useMemo } from 'react';

import { createPortal } from 'react-dom';

import { Play, Pause, ChevronLeft, ChevronRight, Heart, X, Send, Loader2, Volume2, VolumeX } from 'lucide-react';

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

import { useAudio } from '@/contexts/AudioContext';



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

  const { isMuted, toggleMute } = useAudio();

  const { getStoryInfo } = useActiveStories();

  const [activeTab, setActiveTab] = useState<TabType>(initialTab);

  const [postIndex, setPostIndex] = useState(initialTab === 'posts' ? initialIndex : 0);

  const [shortIndex, setShortIndex] = useState(initialTab === 'shorts' ? initialIndex : 0);

  const [currentMediaIndex, setCurrentMediaIndex] = useState(0);

  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const containerRef = useRef<HTMLDivElement>(null);

  const [isPlaying, setIsPlaying] = useState(true);

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



  const scrollDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const container = e.currentTarget;
    const h = container.clientHeight;
    if (h === 0) return;

    // Debounce index update until scroll settles — avoids rapid state changes during snapping
    if (scrollDebounceRef.current) clearTimeout(scrollDebounceRef.current);

    scrollDebounceRef.current = setTimeout(() => {
      const newIndex = Math.round(container.scrollTop / h);
      if (activeTab === 'posts' && newIndex !== postIndex) {
        setPostIndex(newIndex);
        setCurrentMediaIndex(0);
      } else if (activeTab === 'shorts' && newIndex !== shortIndex) {
        setShortIndex(newIndex);
      }
    }, 10);
  }, [activeTab, postIndex, shortIndex]);

  useEffect(() => {
    return () => {
      if (scrollDebounceRef.current) {
        clearTimeout(scrollDebounceRef.current);
        scrollDebounceRef.current = null;
      }
    };
  }, []);



  // Sync scroll position with state index

  useEffect(() => {

    if (scrollContainerRef.current) {

      const h = scrollContainerRef.current.clientHeight;

      if (h === 0) return;

      const targetIndex = activeTab === 'posts' ? postIndex : shortIndex;

      const currentScrollIndex = Math.round(scrollContainerRef.current.scrollTop / h);

      if (targetIndex !== currentScrollIndex) {

        scrollContainerRef.current.scrollTo({

          top: targetIndex * h,

          behavior: 'instant'

        });

      }

    }

  }, [activeTab, postIndex, shortIndex]);

  useEffect(() => {
    return () => {
      if (singleTapTimerRef.current) {
        clearTimeout(singleTapTimerRef.current);
        singleTapTimerRef.current = null;
      }
      if (playIndicatorTimeout.current) {
        clearTimeout(playIndicatorTimeout.current);
      }
    };
  }, []);

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

      try { el.load(); } catch (e) {

        console.error("Audio load error:", e);

      }

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

      const cores = typeof navigator !== 'undefined' ? (navigator as unknown as { hardwareConcurrency?: number }).hardwareConcurrency : undefined;

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



  const isVideo = (url?: string) => {
    if (!url) return false;
    const lower = url.toLowerCase();
    return lower.includes('.mp4') || lower.includes('.mov') || lower.includes('.webm') || lower.includes('.m4v') || lower.includes('.3gp') || lower.includes('.avi') || lower.includes('video');
  };



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

      if (p && typeof p.catch === 'function') p.catch(() => {});

    }



    const main = videoRef.current;

    if (main && !main.paused && main.readyState >= 2) return;

    if (main && isPlaying && main.paused) {

      const p = main.play();

      if (p && typeof p.catch === 'function') p.catch(() => {});

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

     

  }, [activeTab, audioKey, currentPost?.audio_url, playAudio, postIndex, shortIndex, stopAudio]);



  useEffect(() => {

    if (videoRef.current) {

      if (isPlaying) {

        videoRef.current.play().catch(() => {});

      } else {

        videoRef.current.pause();

      }

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

          if (p && typeof p.catch === 'function') p.catch(() => {});

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

      const mutedMap = mutedMediaRef.current;

      mutedMap.forEach((prev, el) => {

        el.muted = prev.muted;

        el.volume = prev.volume;

      });

      mutedMap.clear();

      return;

    }



    const container = containerRef.current;

    const mutedMap = mutedMediaRef.current;

    const media = Array.from(document.querySelectorAll('video, audio')) as HTMLMediaElement[];



    for (const el of media) {

      if (container && container.contains(el)) continue;

      if (!mutedMap.has(el)) {

        mutedMap.set(el, { muted: el.muted, volume: el.volume });

      }

      try {el.pause();} catch (e) { console.error(e); }

      el.muted = true;

      el.volume = 0;

    }



    const previousMutedMedia = new Map(mutedMap);

    return () => {

      previousMutedMedia.forEach((prev, el) => {

        el.muted = prev.muted;

        el.volume = prev.volume;

      });

       

      mutedMap.clear();

    };

  }, [activeTab]);



  useEffect(() => {

    const prevOverflow = document.body.style.overflow;

    document.body.style.overflow = 'hidden';

    return () => {document.body.style.overflow = prevOverflow;};

  }, []);



  // Navigate programmatically (e.g. keyboard/mouse wheel). For touch, native snap handles it.
  const smoothNavigate = useCallback((direction: 'up' | 'down') => {
    if (scrollContainerRef.current) {
      const h = scrollContainerRef.current.clientHeight;
      if (h === 0) return;
      const currentIndex = activeTab === 'posts' ? postIndex : shortIndex;
      const count = activeTab === 'posts' ? posts.length : shorts.length;
      const nextIndex = direction === 'down'
        ? Math.min(currentIndex + 1, count - 1)
        : Math.max(currentIndex - 1, 0);
      scrollContainerRef.current.scrollTo({ top: nextIndex * h, behavior: 'smooth' });
    }
  }, [activeTab, postIndex, shortIndex, posts.length, shorts.length]);



  useEffect(() => {

    const container = containerRef.current;

    if (!container) return;

    let isScrolling = false;

    let timeout: ReturnType<typeof setTimeout> | undefined;



    const handleWheel = (e: WheelEvent) => {

      e.preventDefault();

      if (isScrolling) return;

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

  }, [smoothNavigate]);



  const handleShortsTap = useCallback(() => {

    setShortsPlaying((p) => {

      const next = !p;

      sendYouTubeCommand(next ? 'playVideo' : 'pauseVideo');

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

    } else if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > threshold) {

      smoothNavigate(diffX > 0 ? 'down' : 'up');

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

    } catch (e) { console.error(e); }

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
        </div>
      );
    }

    const isMobile = window.innerWidth <= 768;

    return (
      <div className={cn(
        "flex-1 flex flex-col relative overflow-hidden z-[1] w-full bg-black",
        isMobile ? "p-0 h-full justify-between" : "pt-[calc(env(safe-area-inset-top,10px)+44px)]"
      )}
      key={currentShort.id}>

        <div className={cn(
          "relative w-full flex-1 min-h-0",
          isMobile ? "h-full max-h-full absolute inset-0 z-0" : "z-[9999]"
        )} style={isMobile ? undefined : { maxHeight: 'calc(100% - 120px)' }}>

          {!isShortIframeReady &&
          <div className="absolute inset-0 flex items-center justify-center bg-black z-10">
            <Loader2 className="h-7 w-7 text-white animate-spin" />
          </div>
          }

          {/* Invisible click overlay for play/pause on mobile */}
          {isMobile && (
            <div 
              className="absolute inset-0 z-[5] select-none"
              style={{ touchAction: 'pan-y' }}
              onClick={(e) => {
                e.stopPropagation();
                handleShortsTap();
              }}
            />
          )}

          {/* Render current + adjacent iframes for instant switching */}
          {preloadRange.map((idx) => {
            const s = shorts[idx];
            if (!s) return null;
            const isCurrent = idx === shortIndex;
            return (
              <iframe
                key={s.id}
                ref={isCurrent ? shortsIframeRef : undefined}
                src={`https://www.youtube.com/embed/${s.id}?rel=0&autoplay=${isCurrent ? '1' : '0'}&controls=${isMobile ? '0' : '1'}&modestbranding=1&playsinline=1&loop=1&playlist=${s.id}&iv_load_policy=3&fs=0&enablejsapi=1&origin=${encodeURIComponent(ytOrigin)}`}
                className={cn(
                  "absolute inset-0 w-full h-full transition-opacity duration-150 border-0",
                  isMobile ? "object-cover scale-[1.02]" : "",
                  isCurrent ? "opacity-100 z-[2]" : "opacity-0 z-[1]"
                )}
                onLoad={isCurrent ? () => setIsShortIframeReady(true) : undefined}
                allow="autoplay; encrypted-media"
                allowFullScreen
                title={s.title} />
            );
          })}
        </div>

        {/* Play/Pause indicator overlay */}
        {showPlayIndicator && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-30">
            <div className="p-5 rounded-full bg-black/50 backdrop-blur-sm animate-ping duration-300">
              {shortsPlaying ? (
                <Play className="h-10 w-10 text-white fill-white" />
              ) : (
                <Pause className="h-10 w-10 text-white fill-white" />
              )}
            </div>
          </div>
        )}

        {/* Minimalist Overlay Content (YouTube style) - strictly overlay on top of video on mobile */}
        <div className={cn(
          "w-full flex flex-col gap-3 z-10 pointer-events-none",
          isMobile 
            ? "absolute bottom-[80px] left-0 right-0 px-4 pb-4 pt-16 bg-gradient-to-t from-black/90 via-black/40 to-transparent" 
            : "shrink-0 px-4 pt-3 pb-[env(safe-area-inset-bottom,16px)]"
        )}>
          <div className="flex items-end justify-between gap-3 pointer-events-auto">
            <div className="flex-1 min-w-0 text-shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <div className="h-7 w-7 rounded-full bg-red-600 flex items-center justify-center text-[10px] font-bold text-white uppercase shrink-0">
                  {currentShort.channelTitle?.charAt(0) || 'Y'}
                </div>
                <p className="text-[12px] font-semibold text-white truncate max-w-[150px]">
                  @{currentShort.channelTitle || 'youtube'}
                </p>
              </div>
              <p className="text-[13px] font-medium text-white leading-snug line-clamp-2 pr-4">
                {currentShort.title}
              </p>
            </div>
            
            <div className={cn(
              "shrink-0 flex items-center gap-2",
              isMobile ? "flex-col mb-2 gap-4" : ""
            )}>
              {isMobile ? (
                <>
                  <div className="flex flex-col items-center gap-1">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowShortShare(true);
                      }}
                      className="p-3 rounded-full bg-black/40 border border-white/10 active:scale-90 transition-transform flex items-center justify-center text-white"
                    >
                      <Send className="h-5 w-5" />
                    </button>
                    <span className="text-[10px] font-bold text-white">Ulashish</span>
                  </div>

                  <div className="flex flex-col items-center gap-1">
                    <a
                      href={`https://www.youtube.com/shorts/${currentShort.id}`}
                      target="_blank"
                      rel="noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="p-3 rounded-full bg-black/40 border border-white/10 active:scale-90 transition-transform flex items-center justify-center text-white"
                    >
                      <svg viewBox="0 0 24 24" className="w-5 h-5 text-red-500 fill-current">
                        <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814z" />
                        <path d="M9.545 15.568V8.432L15.818 12l-6.273 3.568z" className="fill-white" />
                      </svg>
                    </a>
                    <span className="text-[10px] font-bold text-white">YouTube</span>
                  </div>
                </>
              ) : (
                <>
                  <a
                    href={`https://www.youtube.com/shorts/${currentShort.id}`}
                    target="_blank"
                    rel="noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="p-2.5 rounded-full bg-white/10 hover:bg-white/15 transition-colors flex items-center justify-center"
                    title="YouTube da ochish">
                    <svg viewBox="0 0 24 24" className="w-5 h-5 text-red-500 fill-current">
                      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814z" />
                      <path d="M9.545 15.568V8.432L15.818 12l-6.273 3.568z" className="fill-white" />
                    </svg>
                  </a>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowShortShare(true);
                    }}
                    className="p-2.5 rounded-full bg-white/10 hover:bg-white/15 transition-colors">
                    <Send className="h-5 w-5 text-white" />
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        <ShareDialog
          open={showShortShare}
          onOpenChange={setShowShortShare}
          shortId={currentShort.id} />
      </div>
    );
  };




  // ─── RENDER: Posts tab ───

  const renderPost = () => {

    if (!currentPost) return null;

    return (

      <>

        <div

          className={cn(

            "flex-1 flex items-center justify-center relative overflow-hidden z-[1]"

          )}

          onClick={handleMediaClick}>



          {/* Touch-intercepting overlay — passes vertical swipes through to parent scroll-snap container.
              Only intercepts taps for play/pause and double-tap for like. */}

          <div

            className="absolute inset-0 z-[3]"

            style={{ touchAction: 'pan-y', background: 'transparent' }}

            onTouchStart={(e) => {

              ensureAmbientPlayback();

              touchMoved.current = false;

              touchStartY.current = e.touches[0].clientY;

              touchStartX.current = e.touches[0].clientX;

              touchStartTime.current = Date.now();

            }}

            onTouchMove={(e) => {

              const diffY = Math.abs(touchStartY.current - e.touches[0].clientY);

              const diffX = Math.abs(touchStartX.current - e.touches[0].clientX);

              if (diffY > 8 || diffX > 8) touchMoved.current = true;

            }}

            onTouchEnd={(e) => {

              // Horizontal swipe → carousel navigation
              if (mediaUrls.length > 1) {
                const dx = e.changedTouches[0].clientX - touchStartX.current;
                const dy = e.changedTouches[0].clientY - touchStartY.current;
                if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) {
                  if (dx < 0 && currentMediaIndex < mediaUrls.length - 1) {
                    setCurrentMediaIndex((p) => p + 1);
                  } else if (dx > 0 && currentMediaIndex > 0) {
                    setCurrentMediaIndex((p) => p - 1);
                  }
                }
              }

            }}

          />



          {isVideo(currentMediaUrl) ?

          <>

              <video ref={videoRef} src={currentMediaUrl} className="max-w-full max-h-full object-contain" loop playsInline autoPlay muted={isMuted} />

              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">

                <div className={cn("p-4 rounded-full bg-black/30 backdrop-blur-sm transition-opacity", isPlaying ? "opacity-0" : "opacity-100")}>

                  {isPlaying ? <Pause className="h-8 w-8 text-white" /> : <Play className="h-8 w-8 text-white" />}

                </div>

              </div>

            </> :

          <img src={currentMediaUrl} alt="Post media" className="max-w-full max-h-full object-contain" />

          }



          {/* Horizontal Carousel Navigation */}

          {mediaUrls.length > 1 && (

            <>

              {/* Arrows removed — swipe left/right to navigate */}




              {/* Indicator Dots */}

              <div className="absolute bottom-16 left-1/2 -translate-x-1/2 z-20 flex gap-1.5 p-2 rounded-full bg-black/10 backdrop-blur-sm">

                {mediaUrls.map((_, i) => (

                  <div

                    key={i}

                    className={cn(

                      "h-1.5 w-1.5 rounded-full transition-all duration-300",

                      i === currentMediaIndex ? "bg-white w-3" : "bg-white/40"

                    )}

                  />

                ))}

              </div>

            </>

          )}





          {/* Live animated GIF overlays — rendered as HTML images (Instagram-style) */}
          {(() => {
            if (isVideo(currentMediaUrl)) return null;
            const overlays = currentPost.media_metadata?.[currentMediaIndex]?.gifOverlays;
            if (!overlays || overlays.length === 0) return null;
            return overlays.map(gif => (
              <img
                key={gif.id}
                src={gif.originalUrl || gif.url}
                alt="gif sticker"
                className="absolute pointer-events-none select-none"
                style={{
                  left: `${gif.x}%`,
                  top: `${gif.y}%`,
                  transform: `translate(-50%, -50%) scale(${gif.scale}) rotate(${gif.rotation}deg)`,
                  width: '28%',
                  maxWidth: '160px',
                  zIndex: 11,
                }}
              />
            ));
          })()}

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

              {/* Arrows removed — swipe to navigate */}


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

      Promise.resolve({ data: [] as Record<string, unknown>[] }),

      viewerId ?

      supabase.from('story_likes').select('story_id').eq('user_id', viewerId).in('story_id', stories.map((s) => s.id)) :

      Promise.resolve({ data: [] as Record<string, unknown>[] })]

      );



      const viewsResData = viewsRes && 'data' in viewsRes ? (viewsRes.data as { story_id: string }[]) : [];

      const likesResData = likesRes && 'data' in likesRes ? (likesRes.data as { story_id: string }[]) : [];



      const viewedStoryIds = new Set(viewsResData?.map(v => v.story_id) || []);

      const likedStoryIds = new Set(likesResData?.map(l => l.story_id) || []);



      const normalizedStories = stories.map((s: Record<string, unknown>) => ({

        ...s,

        media_type: s.media_type as 'image' | 'video',

        ring_id: (s.ring_id as string) || 'default',

        author: authorProfile ? {

          id: authorProfile.id,

          name: authorProfile.name || '',

          username: authorProfile.username || '',

          avatar_url: authorProfile.avatar_url || ''

        } : undefined,

        has_viewed: viewerId ? viewedStoryIds.has(s.id as string) : false,

        has_liked: viewerId ? likedStoryIds.has(s.id as string) : false

      } as unknown as Story));



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
    const key = audioKey;
    return () => {
      stopActiveAudio(key || undefined);
      stopAudio();
    };
  }, [audioKey, stopAudio]);



  return (
    <>
      <div
        ref={containerRef}
        className="fixed inset-0 z-[60] flex flex-col bg-black overflow-hidden"
        style={{ touchAction: 'pan-y' }}
      >
        {/* Ambient Background */}
        {ambientUrl &&
        <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
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
        <div className="fixed inset-0 z-0" style={{
          background: `radial-gradient(ellipse at center, transparent 0%, ${dominantColor} 70%)`,
          backdropFilter: 'blur(20px)'
        }} />
        }

        {/* Top bar with tabs */}
        <div className="fixed top-0 left-0 right-0 z-[70] flex items-center justify-between px-3 pt-[calc(env(safe-area-inset-top,10px)+12px)] pb-2 bg-gradient-to-b from-black/50 to-transparent">
          <button onClick={handleClose} className="p-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/10 my-0">
            <X className="w-4 h-4 text-white" />
          </button>

          <div className="flex gap-0.5 bg-white/10 backdrop-blur-md rounded-full p-0.5 border border-white/10 py-[2px] my-0">
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

          {activeTab === 'posts' && isVideo(currentMediaUrl) ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                toggleMute();
              }}
              className="p-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/10 my-0"
              aria-label={isMuted ? 'Unmute' : 'Mute'}
            >
              {isMuted ? (
                <VolumeX className="w-4 h-4 text-white" />
              ) : (
                <Volume2 className="w-4 h-4 text-white" />
              )}
            </button>
          ) : (
            <div className="w-7" />
          )}
        </div>

        {/* Scrollable Feed */}
        <div
          ref={scrollContainerRef}
          onScroll={handleScroll}
          className="h-full w-full overflow-y-scroll snap-y snap-mandatory hide-scrollbar z-50 pt-[calc(env(safe-area-inset-top,44px)+20px)]"
          style={{
            overscrollBehaviorY: 'none',
            touchAction: 'pan-y',
            // Disable iOS momentum scrolling so native snap takes full control
            WebkitOverflowScrolling: 'auto' as React.CSSProperties['WebkitOverflowScrolling'],
          }}
        >
          {activeTab === 'posts' ? (
            posts.map((post, i) => {
              const srcUrl = post.media_urls?.[0] || post.image_url;
              return (
              <div key={post.id} className="h-[100dvh] w-full snap-start snap-always relative overflow-hidden flex flex-col" style={{ touchAction: 'pan-y' }}>
                {i === postIndex ? renderPost() : (
                  <div className="flex-1 flex items-center justify-center bg-black relative">
                    <img 
                      src={srcUrl} 
                      alt="" 
                      className="max-w-full max-h-full object-contain" 
                    />
                    {isVideo(srcUrl) && (
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <div className="p-4 rounded-full bg-black/30 backdrop-blur-sm">
                          <Play className="h-8 w-8 text-white" />
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )})
          ) : (
            shorts.map((short, i) => (
              <div key={short.id} className="h-[100dvh] w-full snap-start snap-always relative overflow-hidden flex flex-col" style={{ touchAction: 'pan-y' }}>
                {i === shortIndex ? renderShort() : (
                  <div className="flex-1 flex items-center justify-center bg-black relative">
                    <img 
                      src={short.thumbnail} 
                      alt="" 
                      className="absolute inset-0 w-full h-full object-cover" 
                    />
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div className="p-4 rounded-full bg-black/30 backdrop-blur-sm">
                        <Play className="h-8 w-8 text-white" />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {typeof document !== 'undefined' && showVideoPlayer && createPortal(
        <div className="fixed inset-0 z-[80] w-full h-full min-h-[100dvh] overflow-hidden bg-black" style={{ height: '100dvh' }}>
          <SamsungUltraVideoPlayer
            src={videoPlayerSrc}
            title={currentPost?.content?.slice(0, 50) || 'Video'}
            onClose={() => setShowVideoPlayer(false)}
            startInFullscreen={true}
          />

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