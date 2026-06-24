import { useState, useRef, useEffect, useCallback, useMemo } from 'react';

import {
  Play, Pause, Volume2, VolumeX, Settings, RotateCw,
  Maximize, Minimize, Rewind, FastForward, SkipBack, SkipForward,
  ChevronLeft, X, Sun, Moon, Lock, Unlock, PictureInPicture,
  Download, Share2, Bookmark, List, Smartphone, Monitor,
  Wifi, WifiOff, Battery, Signal, Clock, Info, AlertCircle,
  Check, Repeat, Shuffle, Film, Zap, Droplet, Wind } from 'lucide-react';
import { ScreenOrientation } from '@capacitor/screen-orientation';



// ═══════════════════════════════════════════════════════════════

// TYPES & INTERFACES

// ═══════════════════════════════════════════════════════════════



interface VideoQuality {

  label: string;

  resolution: string;

  bitrate: string;

}



interface Chapter {

  time: number;

  title: string;

  thumbnail?: string;

}



interface Bookmark {

  time: number;

  note: string;

  id: string;

}



interface Subtitle {

  language: string;

  label: string;

  src: string;

}



interface VideoPlayerProps {
  src: string;
  poster?: string;
  title?: string;
  description?: string;
  chapters?: Chapter[];
  subtitles?: Subtitle[];
  onClose?: () => void;
  startInFullscreen?: boolean;
}



interface GestureState {

  isGesturing: boolean;

  gestureType: 'brightness' | 'volume' | 'seek' | 'zoom' | null;

  startX: number;

  startY: number;

  startValue: number;

  currentValue: number;

}



interface TouchState {

  lastTap: number;

  tapCount: number;

  side: 'left' | 'right' | 'center';

  longPressTimer: ReturnType<typeof setTimeout> | null;

  isLongPress: boolean;

}



// ═══════════════════════════════════════════════════════════════

// UTILITY FUNCTIONS

// ═══════════════════════════════════════════════════════════════



const formatTime = (seconds: number): string => {

  if (!seconds || isNaN(seconds)) return '0:00';

  const hrs = Math.floor(seconds / 3600);

  const mins = Math.floor(seconds % 3600 / 60);

  const secs = Math.floor(seconds % 60);



  if (hrs > 0) {

    return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;

  }

  return `${mins}:${secs.toString().padStart(2, '0')}`;

};



const formatBytes = (bytes: number): string => {

  if (bytes === 0) return '0 B';

  const k = 1024;

  const sizes = ['B', 'KB', 'MB', 'GB'];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;

};



const getTimeOfDay = (): string => {

  const hour = new Date().getHours();

  if (hour < 12) return 'morning';

  if (hour < 18) return 'afternoon';

  return 'evening';

};



// ═══════════════════════════════════════════════════════════════

// MAIN COMPONENT

// ═══════════════════════════════════════════════════════════════



export const SamsungUltraVideoPlayer = ({
  src,
  poster,
  title = 'Samsung Ultra Video',
  description,
  chapters = [],
  subtitles = [],
  onClose,
  startInFullscreen = false
}: VideoPlayerProps) => {

  // ─────────────────────────────────────────────────────────────

  // REFS

  // ─────────────────────────────────────────────────────────────

  const videoRef = useRef<HTMLVideoElement>(null);

  const containerRef = useRef<HTMLDivElement>(null);

  const progressRef = useRef<HTMLDivElement>(null);

  const controlsTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const gestureTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const singleTapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const pinchDistance = useRef<number>(0);

  const instanceIdRef = useRef(

    typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `vid_${Date.now()}_${Math.random()}`

  );



  // ─────────────────────────────────────────────────────────────

  // CORE VIDEO STATE

  // ─────────────────────────────────────────────────────────────

  const [isPlaying, setIsPlaying] = useState(false);

  const [isMuted, setIsMuted] = useState(false);

  const [volume, setVolume] = useState(0.8);

  const [currentTime, setCurrentTime] = useState(0);

  const [duration, setDuration] = useState(0);

  const [buffered, setBuffered] = useState(0);

  const [loading, setLoading] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [isLandscape, setIsLandscape] = useState(false);
  // Track whether we intentionally entered landscape so the fullscreenchange
  // listener doesn't reset state during an in-progress orientation transition.
  const intentLandscapeRef = useRef(false);

  const toggleOrientation = useCallback(async () => {
    try {
      const goingLandscape = !isLandscape;
      intentLandscapeRef.current = goingLandscape;

      if (goingLandscape) {
        // Try HTML5 fullscreen for web compatibility
        if (containerRef.current) {
          if (containerRef.current.requestFullscreen) {
            await containerRef.current.requestFullscreen().catch(() => {});
          } else if ((containerRef.current as any).webkitRequestFullscreen) {
            await (containerRef.current as any).webkitRequestFullscreen().catch(() => {});
          }
        }
        // Lock orientation to landscape natively
        try {
          await ScreenOrientation.lock({ orientation: 'landscape' });
        } catch (e) {
          console.warn('Orientation lock failed:', e);
        }
        setIsLandscape(true);
      } else {
        // Exit HTML5 fullscreen
        if (document.fullscreenElement || (document as any).webkitFullscreenElement) {
          if (document.exitFullscreen) {
            await document.exitFullscreen().catch(() => {});
          } else if ((document as any).webkitExitFullscreen) {
            await (document as any).webkitExitFullscreen().catch(() => {});
          }
        }
        // Lock orientation back to portrait and unlock
        try {
          await ScreenOrientation.lock({ orientation: 'portrait' });
          await ScreenOrientation.unlock();
        } catch (e) {
          console.warn('Orientation unlock failed:', e);
        }
        setIsLandscape(false);
        intentLandscapeRef.current = false;
      }
    } catch (err) {
      intentLandscapeRef.current = false;
      console.error('Orientation toggle error:', err);
    }
  }, [isLandscape]);

  useEffect(() => {

    window.dispatchEvent(new CustomEvent('app:forceHideNav', { detail: { hide: true } }));

    return () => {

      window.dispatchEvent(new CustomEvent('app:forceHideNav', { detail: { hide: false } }));

    };

  }, []);

  useEffect(() => {

    const onRequestPlay = (e: Event) => {

      const ce = e as CustomEvent<{ id?: string }>;

      if (ce.detail?.id === instanceIdRef.current) return;

      const v = videoRef.current;

      if (!v) return;

      if (!v.paused) {

        v.pause();

        setIsPlaying(false);

      }

    };

    window.addEventListener('avlodona:video:request-play', onRequestPlay);
    return () => window.removeEventListener('avlodona:video:request-play', onRequestPlay);
  }, []);

  // Auto-rotate disabled: always open in the same orientation as the device.
  // User can manually toggle orientation using the button in controls.

  useEffect(() => {

    const videoEl = videoRef.current;

    window.dispatchEvent(

      new CustomEvent('avlodona:video:request-play', { detail: { id: instanceIdRef.current } })

    );

    return () => {

      if (videoEl && !videoEl.paused) videoEl.pause();

    };

  }, [src]);



  // ─────────────────────────────────────────────────────────────

  // UI STATE

  // ─────────────────────────────────────────────────────────────

  const [showControls, setShowControls] = useState(true);

  const [showSettings, setShowSettings] = useState(false);

  const [showChapters, setShowChapters] = useState(false);

  const [showInfo, setShowInfo] = useState(false);

  const [isPiP, setIsPiP] = useState(false);

  const [isDarkTheme, setIsDarkTheme] = useState(true);

  const [isRotationLocked, setIsRotationLocked] = useState(false);



  // ─────────────────────────────────────────────────────────────

  // ADVANCED SETTINGS

  // ═══════════════════════════════════════════════════════════════

  const [playbackRate, setPlaybackRate] = useState(1);

  const [brightness, setBrightness] = useState(100);

  const [contrast, setContrast] = useState(100);

  const [saturation, setSaturation] = useState(100);

  const [selectedQuality, setSelectedQuality] = useState('1080p');

  const [selectedSubtitle, setSelectedSubtitle] = useState<string | null>(null);

  const [isLooping, setIsLooping] = useState(false);



  // ─────────────────────────────────────────────────────────────

  // GESTURE STATE

  // ─────────────────────────────────────────────────────────────

  const [gesture, setGesture] = useState<GestureState>({

    isGesturing: false,

    gestureType: null,

    startX: 0,

    startY: 0,

    startValue: 0,

    currentValue: 0

  });

  const [touchState, setTouchState] = useState<TouchState>({

    lastTap: 0,

    tapCount: 0,

    side: 'center',

    longPressTimer: null,

    isLongPress: false

  });

  // ─────────────────────────────────────────────────────────────

  // BOOKMARKS & CHAPTERS

  // ─────────────────────────────────────────────────────────────

  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);

  const [seekPreview, setSeekPreview] = useState<number | null>(null);

  const [showGestureIndicator, setShowGestureIndicator] = useState(false);

  const [gestureIndicatorText, setGestureIndicatorText] = useState('');

  const [gestureIndicatorIcon, setGestureIndicatorIcon] = useState<'volume' | 'brightness' | 'seek' | null>(null);

  // ─────────────────────────────────────────────────────────────

  // ZOOM STATE

  // ─────────────────────────────────────────────────────────────

  const [zoom, setZoom] = useState(1);

  const [zoomPan, setZoomPan] = useState({ x: 0, y: 0 });

  // ─────────────────────────────────────────────────────────────

  // NETWORK & STATS

  // ─────────────────────────────────────────────────────────────

  const [networkSpeed, setNetworkSpeed] = useState<number>(0);

  const [droppedFrames, setDroppedFrames] = useState<number>(0);

  const [isOnline, setIsOnline] = useState(true);

  // ═══════════════════════════════════════════════════════════════

  // COMPUTED VALUES

  // ═══════════════════════════════════════════════════════════════

  const progress = useMemo(

    () => duration > 0 && Number.isFinite(duration) ? currentTime / duration * 100 : 0,

    [currentTime, duration]

  );

  const safeDuration = duration > 0 && Number.isFinite(duration) ? duration : 1;

  const currentChapter = useMemo(

    () => chapters.filter((ch) => ch.time <= currentTime).pop(),

    [chapters, currentTime]

  );

  const availableQualities: VideoQuality[] = [

    { label: '4K', resolution: '3840x2160', bitrate: '45 Mbps' },

    { label: '1440p', resolution: '2560x1440', bitrate: '20 Mbps' },

    { label: '1080p', resolution: '1920x1080', bitrate: '8 Mbps' },

    { label: '720p', resolution: '1280x720', bitrate: '5 Mbps' },

    { label: '480p', resolution: '854x480', bitrate: '2.5 Mbps' },

    { label: '360p', resolution: '640x360', bitrate: '1 Mbps' }

  ];

  const videoFilters = useMemo(

    () =>

    `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturation}%)`,

    [brightness, contrast, saturation]

  );

  // ═══════════════════════════════════════════════════════════════

  // VIDEO EVENT HANDLERS

  // ═══════════════════════════════════════════════════════════════

  useEffect(() => {

    document.body.style.overflow = 'hidden';

    return () => {

      document.body.style.overflow = '';

    };

  }, []);

  useEffect(() => {

    setError(null);

    setDuration(0);

    setCurrentTime(0);

    setBuffered(0);

    setLoading(true);

  }, [src]);

  useEffect(() => {

    const video = videoRef.current;

    if (!video) return;

    const handleTimeUpdate = () => setCurrentTime(video.currentTime);

    const handleLoadedMetadata = () => {

      const d = video.duration;

      setDuration(Number.isFinite(d) && d >= 0 ? d : 0);

    };

    const handleEnded = () => {

      setIsPlaying(false);

      if (isLooping) {

        video.currentTime = 0;

        video.play();

        setIsPlaying(true);

      }

    };

    const handleWaiting = () => setLoading(true);

    const handleCanPlay = () => setLoading(false);

    const handleError = () => setError('Failed to load video');

    const handleProgress = () => {

      if (video.buffered.length > 0) {

        const d = video.duration;

        if (!Number.isFinite(d) || d <= 0) return;

        const bufferedEnd = video.buffered.end(video.buffered.length - 1);

        setBuffered(bufferedEnd / d * 100);

      }

    };

    video.addEventListener('timeupdate', handleTimeUpdate);

    video.addEventListener('loadedmetadata', handleLoadedMetadata);

    video.addEventListener('ended', handleEnded);

    video.addEventListener('waiting', handleWaiting);

    video.addEventListener('canplay', handleCanPlay);

    video.addEventListener('error', handleError);

    video.addEventListener('progress', handleProgress);

    return () => {

      video.removeEventListener('timeupdate', handleTimeUpdate);

      video.removeEventListener('loadedmetadata', handleLoadedMetadata);

      video.removeEventListener('ended', handleEnded);

      video.removeEventListener('waiting', handleWaiting);

      video.removeEventListener('canplay', handleCanPlay);

      video.removeEventListener('error', handleError);

      video.removeEventListener('progress', handleProgress);

    };

  }, [isLooping]);

  // ═══════════════════════════════════════════════════════════════

  // CONTROLS AUTO-HIDE

  // ═══════════════════════════════════════════════════════════════

  const resetControlsTimer = useCallback((delay = 3000) => {

    setShowControls(true);

    if (controlsTimer.current) clearTimeout(controlsTimer.current);

    controlsTimer.current = setTimeout(() => {

      if (videoRef.current && !videoRef.current.paused) {

        setShowControls(false);

      }

    }, delay);

  }, []);

  useEffect(() => {

    if (isPlaying) {

      resetControlsTimer();

    }

    return () => {

      if (controlsTimer.current) clearTimeout(controlsTimer.current);

    };

  }, [isPlaying, resetControlsTimer]);

  // ═══════════════════════════════════════════════════════════════

  // PLAYBACK CONTROLS

  // ═══════════════════════════════════════════════════════════════

  const togglePlay = useCallback(() => {

    const video = videoRef.current;

    if (!video) return;

    if (video.paused) {

      window.dispatchEvent(

        new CustomEvent('avlodona:video:request-play', { detail: { id: instanceIdRef.current } })

      );

      video.play();

      setIsPlaying(true);

    } else {

      video.pause();

      setIsPlaying(false);

    }

    resetControlsTimer();

  }, [resetControlsTimer]);



  const toggleMute = useCallback(() => {

    const video = videoRef.current;

    if (!video) return;



    video.muted = !isMuted;

    setIsMuted(!isMuted);

  }, [isMuted]);



  const handleVolumeChange = useCallback((newVolume: number) => {

    const video = videoRef.current;

    if (!video) return;



    const clampedVolume = Math.max(0, Math.min(1, newVolume));

    video.volume = clampedVolume;

    setVolume(clampedVolume);

    setIsMuted(clampedVolume === 0);

  }, []);



  const skip = useCallback((seconds: number) => {

    const video = videoRef.current;

    if (!video || !Number.isFinite(video.duration)) return;



    const next = video.currentTime + seconds;

    video.currentTime = Math.max(0, Math.min(video.duration, next));

  }, []);



  const seekTo = useCallback((time: number) => {

    const video = videoRef.current;

    if (!video || !Number.isFinite(time) || time < 0) return;



    const d = video.duration;

    if (!Number.isFinite(d)) return;

    video.currentTime = Math.max(0, Math.min(d, time));

  }, []);



  const handleSeekBarClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {

    if (!progressRef.current || !videoRef.current) return;



    const rect = progressRef.current.getBoundingClientRect();

    const percent = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));

    seekTo(percent * duration);

    setSeekPreview(null);

  }, [duration, seekTo]);



  const handleSeekBarHover = useCallback((e: React.MouseEvent<HTMLDivElement>) => {

    if (!progressRef.current) return;



    const rect = progressRef.current.getBoundingClientRect();

    const percent = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));

    setSeekPreview(percent * duration);

  }, [duration]);



  // ═══════════════════════════════════════════════════════════════

  // FULLSCREEN & PIP

  // ═══════════════════════════════════════════════════════════════






  const togglePiP = useCallback(async () => {

    const video = videoRef.current;

    if (!video) return;



    try {

      if (!isPiP) {

        await video.requestPictureInPicture();

        setIsPiP(true);

      } else {

        await document.exitPictureInPicture();

        setIsPiP(false);

      }

    } catch (err) {

      console.error('PiP error:', err);

    }

  }, [isPiP]);



  // Sync landscape state when user exits fullscreen via ESC or system UI.
  // Only reset if we intentionally entered landscape — avoids false resets on
  // mobile browsers that never had a real fullscreen element to begin with.

  useEffect(() => {

    const onFullscreenChange = () => {

      if (!document.fullscreenElement && !(document as any).webkitFullscreenElement) {
        // Only revert if the user exited fullscreen that WE requested.
        if (intentLandscapeRef.current) {
          intentLandscapeRef.current = false;
          setIsLandscape(false);
        }
      }

    };

    document.addEventListener('fullscreenchange', onFullscreenChange);
    document.addEventListener('webkitfullscreenchange', onFullscreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', onFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', onFullscreenChange);
    };

  }, []);



  // Sync PiP state when user closes PiP from system

  useEffect(() => {

    const onPiPChange = () => {

      setIsPiP(!!document.pictureInPictureElement);

    };

    document.addEventListener('enterpictureinpicture', onPiPChange);

    document.addEventListener('leavepictureinpicture', onPiPChange);

    return () => {

      document.removeEventListener('enterpictureinpicture', onPiPChange);

      document.removeEventListener('leavepictureinpicture', onPiPChange);

    };

  }, []);



  // ═══════════════════════════════════════════════════════════════

  // GESTURE HANDLERS - TOUCH & MOUSE

  // ═══════════════════════════════════════════════════════════════



  const showGestureUI = useCallback((type: 'volume' | 'brightness' | 'seek', value: number, text: string) => {

    setShowGestureIndicator(true);

    setGestureIndicatorIcon(type);

    setGestureIndicatorText(text);



    if (gestureTimer.current) clearTimeout(gestureTimer.current);

    gestureTimer.current = setTimeout(() => {

      setShowGestureIndicator(false);

    }, 800);

  }, []);



  const handleTouchStart = useCallback((e: React.TouchEvent) => {

    if (e.touches.length === 1) {

      // Single touch - potential swipe gesture

      const touch = e.touches[0];

      const rect = containerRef.current?.getBoundingClientRect();

      if (!rect) return;



      const x = touch.clientX - rect.left;

      const y = touch.clientY - rect.top;

      const side = x < rect.width / 3 ? 'left' : x > rect.width * 2 / 3 ? 'right' : 'center';



      // Check for double/triple tap

      const now = Date.now();

      const timeSinceLast = now - touchState.lastTap;



      if (timeSinceLast < 300) {

        // Multi-tap detected

        const newTapCount = touchState.tapCount + 1;



        if (newTapCount === 2) {

          // Double tap

          if (side === 'left') {

            skip(-10);

            showGestureUI('seek', -10, '-10s');

          } else if (side === 'right') {

            skip(10);

            showGestureUI('seek', 10, '+10s');

          } else {

            togglePlay();

          }

        } else if (newTapCount === 3) {

          // Triple tap

          if (side === 'left') {

            skip(-30);

            showGestureUI('seek', -30, '-30s');

          } else if (side === 'right') {

            skip(30);

            showGestureUI('seek', 30, '+30s');

          }

        }



        // Multi-tap: pending single-tap timer ni bekor qil

        if (singleTapTimerRef.current) {

          clearTimeout(singleTapTimerRef.current);

          singleTapTimerRef.current = null;

        }

        setTouchState((prev) => ({ ...prev, tapCount: newTapCount, lastTap: now, side }));

      } else {

        // First tap — 350ms delay bilan double-tap bilan aralashmaslik uchun

        if (singleTapTimerRef.current) clearTimeout(singleTapTimerRef.current);

        singleTapTimerRef.current = setTimeout(() => {

          singleTapTimerRef.current = null;

          // Show controls for 3 seconds; if already visible, just reset the timer
          resetControlsTimer(3000);

        }, 200);

        setTouchState((prev) => ({ ...prev, tapCount: 1, lastTap: now, side }));



        // Start long press detection (ref ensures we can clear it in touchEnd even before state updates)

        if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);

        longPressTimerRef.current = setTimeout(() => {

          longPressTimerRef.current = null;

          setTouchState((prev) => ({ ...prev, isLongPress: true }));

          if (videoRef.current) {

            videoRef.current.playbackRate = 2;

            showGestureUI('seek', 2, '2x Speed');

          }

        }, 500);

      }



      // Determine gesture type based on position

      const isLeftSide = x < rect.width * 0.25;

      const isRightSide = x > rect.width * 0.75;



      if (isLeftSide) {

        // Brightness/volume gestures should never trigger long-press speed boost

        if (longPressTimerRef.current) {

          clearTimeout(longPressTimerRef.current);

          longPressTimerRef.current = null;

        }

        // Brightness control on left side

        setGesture({

          isGesturing: true,

          gestureType: 'brightness',

          startX: touch.clientX,

          startY: touch.clientY,

          startValue: brightness,

          currentValue: brightness

        });

      } else if (isRightSide) {

        // Brightness/volume gestures should never trigger long-press speed boost

        if (longPressTimerRef.current) {

          clearTimeout(longPressTimerRef.current);

          longPressTimerRef.current = null;

        }

        // Volume control on right side

        setGesture({

          isGesturing: true,

          gestureType: 'volume',

          startX: touch.clientX,

          startY: touch.clientY,

          startValue: volume * 100,

          currentValue: volume * 100

        });

      }

    } else if (e.touches.length === 2) {

      // Pinch to zoom

      const touch1 = e.touches[0];

      const touch2 = e.touches[1];

      const distance = Math.hypot(

        touch2.clientX - touch1.clientX,

        touch2.clientY - touch1.clientY

      );

      pinchDistance.current = distance;



      setGesture({

        isGesturing: true,

        gestureType: 'zoom',

        startX: (touch1.clientX + touch2.clientX) / 2,

        startY: (touch1.clientY + touch2.clientY) / 2,

        startValue: zoom,

        currentValue: zoom

      });

    }

  }, [brightness, volume, zoom, skip, togglePlay, showGestureUI, touchState]);



  const handleTouchMove = useCallback((e: React.TouchEvent) => {

    if (!gesture.isGesturing) return;



    if (e.touches.length === 1 && gesture.gestureType !== 'zoom') {

      const touch = e.touches[0];

      const deltaY = gesture.startY - touch.clientY;

      const deltaX = touch.clientX - gesture.startX;

      // Any intentional swipe should cancel long-press speed boost and single-tap toggle

      if (Math.abs(deltaY) > 8 || Math.abs(deltaX) > 8) {

        if (longPressTimerRef.current) {

          clearTimeout(longPressTimerRef.current);

          longPressTimerRef.current = null;

        }

        if (singleTapTimerRef.current) {

          clearTimeout(singleTapTimerRef.current);

          singleTapTimerRef.current = null;

        }

      }

      const sensitivity = 0.5;



      if (gesture.gestureType === 'brightness') {

        const newBrightness = Math.max(20, Math.min(200, gesture.startValue + deltaY * sensitivity));

        setBrightness(newBrightness);

        setGesture((prev) => ({ ...prev, currentValue: newBrightness }));

        showGestureUI('brightness', newBrightness, `${Math.round(newBrightness)}%`);

      } else if (gesture.gestureType === 'volume') {

        const newVolume = Math.max(0, Math.min(100, gesture.startValue + deltaY * sensitivity));

        handleVolumeChange(newVolume / 100);

        setGesture((prev) => ({ ...prev, currentValue: newVolume }));

        showGestureUI('volume', newVolume, `${Math.round(newVolume)}%`);

      }

    } else if (e.touches.length === 2 && gesture.gestureType === 'zoom') {

      const touch1 = e.touches[0];

      const touch2 = e.touches[1];

      const distance = Math.hypot(

        touch2.clientX - touch1.clientX,

        touch2.clientY - touch1.clientY

      );



      const scale = distance / pinchDistance.current;

      const newZoom = Math.max(1, Math.min(3, gesture.startValue * scale));

      setZoom(newZoom);



      // Calculate pan offset

      const centerX = (touch1.clientX + touch2.clientX) / 2;

      const centerY = (touch1.clientY + touch2.clientY) / 2;

      const rect = containerRef.current?.getBoundingClientRect();

      if (rect) {

        setZoomPan({

          x: ((centerX - rect.left) / rect.width - 0.5) * (newZoom - 1) * -100,

          y: ((centerY - rect.top) / rect.height - 0.5) * (newZoom - 1) * -100

        });

      }

    }

  }, [gesture, handleVolumeChange, showGestureUI]);



  const handleTouchEnd = useCallback(() => {

    // Clear long press timer via ref (state may not have updated yet)

    if (longPressTimerRef.current) {

      clearTimeout(longPressTimerRef.current);

      longPressTimerRef.current = null;

    }



    // Reset playback rate if it was sped up by long press

    if (touchState.isLongPress && videoRef.current) {

      videoRef.current.playbackRate = playbackRate;

    }



    setTouchState((prev) => ({

      ...prev,

      longPressTimer: null,

      isLongPress: false

    }));



    setGesture({

      isGesturing: false,

      gestureType: null,

      startX: 0,

      startY: 0,

      startValue: 0,

      currentValue: 0

    });



    // Reset tap count after delay

    setTimeout(() => {

      setTouchState((prev) => ({ ...prev, tapCount: 0 }));

    }, 300);

  }, [touchState, playbackRate]);



  // ═══════════════════════════════════════════════════════════════

  // KEYBOARD SHORTCUTS

  // ═══════════════════════════════════════════════════════════════



  useEffect(() => {

    const handleKeyDown = (e: KeyboardEvent) => {

      // Prevent default for handled keys

      const handledKeys = ['Space', 'KeyK', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'KeyF', 'KeyM', 'KeyC', 'KeyI', 'KeyL'];

      if (handledKeys.includes(e.code)) {

        e.preventDefault();

      }



      switch (e.code) {

        case 'Space':
          // falls through
        case 'KeyK':

          togglePlay();

          break;

        case 'ArrowLeft':

          skip(e.shiftKey ? -5 : -10);

          break;

        case 'ArrowRight':

          skip(e.shiftKey ? 5 : 10);

          break;

        case 'ArrowUp':

          handleVolumeChange(volume + 0.1);

          showGestureUI('volume', (volume + 0.1) * 100, `${Math.round((volume + 0.1) * 100)}%`);

          break;

        case 'ArrowDown':

          handleVolumeChange(volume - 0.1);

          showGestureUI('volume', (volume - 0.1) * 100, `${Math.round((volume - 0.1) * 100)}%`);

          break;

        case 'KeyM':

          toggleMute();

          break;

        case 'KeyF':

          toggleOrientation();

          break;

        case 'KeyP':

          togglePiP();

          break;

        case 'KeyC':

          setShowChapters((prev) => !prev);

          break;

        case 'KeyI':

          setShowInfo((prev) => !prev);

          break;

        case 'KeyL':

          setIsLooping((prev) => !prev);

          break;

        case 'Digit0':

          seekTo(0);

          break;

        case 'Digit1':

          seekTo(duration * 0.1);

          break;

        case 'Digit2':

          seekTo(duration * 0.2);

          break;

        case 'Digit3':

          seekTo(duration * 0.3);

          break;

        case 'Digit4':

          seekTo(duration * 0.4);

          break;

        case 'Digit5':

          seekTo(duration * 0.5);

          break;

        case 'Digit6':

          seekTo(duration * 0.6);

          break;

        case 'Digit7':

          seekTo(duration * 0.7);

          break;

        case 'Digit8':

          seekTo(duration * 0.8);

          break;

        case 'Digit9':

          seekTo(duration * 0.9);

          break;

      }

    };



    window.addEventListener('keydown', handleKeyDown);

    return () => window.removeEventListener('keydown', handleKeyDown);

  }, [volume, duration, skip, togglePlay, toggleMute, toggleOrientation, togglePiP, handleVolumeChange, seekTo, showGestureUI]);



  // ═══════════════════════════════════════════════════════════════

  // BOOKMARKS

  // ═══════════════════════════════════════════════════════════════



  const addBookmark = useCallback(() => {

    const newBookmark: Bookmark = {

      id: Date.now().toString(),

      time: currentTime,

      note: `Bookmark at ${formatTime(currentTime)}`

    };

    setBookmarks((prev) => [...prev, newBookmark]);

  }, [currentTime]);



  const removeBookmark = useCallback((id: string) => {

    setBookmarks((prev) => prev.filter((b) => b.id !== id));

  }, []);



  const jumpToBookmark = useCallback((time: number) => {

    seekTo(time);

  }, [seekTo]);



  // ═══════════════════════════════════════════════════════════════

  // NETWORK MONITORING

  // ═══════════════════════════════════════════════════════════════



  useEffect(() => {

    const handleOnline = () => setIsOnline(true);

    const handleOffline = () => setIsOnline(false);



    window.addEventListener('online', handleOnline);

    window.addEventListener('offline', handleOffline);



    return () => {

      window.removeEventListener('online', handleOnline);

      window.removeEventListener('offline', handleOffline);

    };

  }, []);



  // ═══════════════════════════════════════════════════════════════

  // THEME COLORS

  // ═══════════════════════════════════════════════════════════════



  const theme = useMemo(() => {

    if (isDarkTheme) {

      return {

        bg: 'from-slate-950 via-slate-900 to-slate-950',

        controlsBg: 'bg-gradient-to-b from-slate-900/95 via-slate-900/90 to-slate-950/95',

        cardBg: 'bg-slate-900/90',

        border: 'border-slate-700/50',

        text: 'text-slate-100',

        textMuted: 'text-slate-400',

        accent: 'bg-blue-500',

        accentHover: 'hover:bg-blue-600',

        buttonBg: 'bg-slate-800/80',

        buttonHover: 'hover:bg-slate-700/80'

      };

    } else {

      return {

        bg: 'from-slate-100 via-slate-50 to-slate-100',

        controlsBg: 'bg-gradient-to-b from-white/95 via-slate-50/90 to-white/95',

        cardBg: 'bg-white/90',

        border: 'border-slate-300/50',

        text: 'text-slate-900',

        textMuted: 'text-slate-600',

        accent: 'bg-blue-600',

        accentHover: 'hover:bg-blue-700',

        buttonBg: 'bg-slate-200/80',

        buttonHover: 'hover:bg-slate-300/80'

      };

    }

  }, [isDarkTheme]);



  // ═══════════════════════════════════════════════════════════════

  // RENDER

  // ═══════════════════════════════════════════════════════════════



  return (

    <div

      ref={containerRef}

      className={`relative w-full h-full min-h-[100dvh] overflow-hidden bg-gradient-to-br ${theme.bg} select-none`}

      style={{ height: '100dvh', maxHeight: '100dvh' }}

      onMouseMove={() => resetControlsTimer()}

      onTouchStart={handleTouchStart}

      onTouchMove={handleTouchMove}

      onTouchEnd={handleTouchEnd}>



      {/* ═══════════════════════════════════════════════════════════ */}

      {/* VIDEO ELEMENT - object-cover: butun ekranni to'ldiradi */}

      {/* ═══════════════════════════════════════════════════════════ */}

      <video

        ref={videoRef}

        src={src}

        poster={poster}

        className="absolute inset-0 w-full h-full object-contain object-center transition-all duration-300"

        style={{

          transform: zoom > 1 ? `scale(${zoom}) translate(${zoomPan.x}%, ${zoomPan.y}%)` : undefined

        }}

        playsInline

        loop={isLooping} />





      {/* ═══════════════════════════════════════════════════════════ */}

      {/* LOADING SPINNER */}

      {/* ═══════════════════════════════════════════════════════════ */}

      {loading &&

      <div className="absolute inset-0 flex items-center justify-center z-30 pointer-events-none">

          <div className="relative">

            <div className="w-20 h-20 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />

            <div className="absolute inset-0 flex items-center justify-center">

              <Zap className="text-blue-500 animate-pulse" size={24} />

            </div>

          </div>

        </div>

      }



      {/* ═══════════════════════════════════════════════════════════ */}

      {/* GESTURE INDICATOR */}

      {/* ═══════════════════════════════════════════════════════════ */}

      {showGestureIndicator &&

      <div className="absolute inset-0 flex items-center justify-center z-30 pointer-events-none">

          <div className="px-8 py-6 rounded-3xl bg-black/80 backdrop-blur-xl border border-white/20 shadow-2xl animate-fade-in">

            <div className="flex flex-col items-center gap-3">

              {gestureIndicatorIcon === 'volume' &&

            <Volume2 className="text-white" size={48} strokeWidth={1.5} />

            }

              {gestureIndicatorIcon === 'brightness' &&

            <Sun className="text-white" size={48} strokeWidth={1.5} />

            }

              {gestureIndicatorIcon === 'seek' &&

            <FastForward className="text-white" size={48} strokeWidth={1.5} />

            }

              <span className="text-white text-2xl font-bold tracking-tight">

                {gestureIndicatorText}

              </span>

            </div>

          </div>

        </div>

      }



      {/* ═══════════════════════════════════════════════════════════ */}

      {/* ERROR MESSAGE */}

      {/* ═══════════════════════════════════════════════════════════ */}

      {error &&

      <div className="absolute inset-0 flex items-center justify-center z-30">

          <div className="px-6 py-4 rounded-2xl bg-red-500/90 backdrop-blur-xl border border-red-400/50 shadow-2xl">

            <div className="flex items-center gap-3">

              <AlertCircle className="text-white" size={24} />

              <span className="text-white font-medium">{error}</span>

            </div>

          </div>

        </div>

      }



      {/* ═══════════════════════════════════════════════════════════ */}

      {/* MAIN CONTROLS OVERLAY */}

      {/* ═══════════════════════════════════════════════════════════ */}

      <div

        className={`absolute inset-0 z-20 transition-all duration-300 ${

        showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'}`

        }>



        {/* ─────────────────────────────────────────────────────── */}

        {/* TOP BAR - Status & System Info */}

        {/* ─────────────────────────────────────────────────────── */}

        <div className="absolute top-0 left-0 right-0 bg-black/10 backdrop-blur-sm px-4 py-3">

          <div className="flex items-center justify-between">

            <button

              onClick={onClose}

              className="p-2.5 rounded-full bg-white/10 backdrop-blur-md active:scale-95 transition-all">

              <ChevronLeft className="text-white" size={22} />

            </button>

            

            















          </div>

        </div>



        {/* ─────────────────────────────────────────────────────── */}

        {/* CENTER - Playback Overlay */}

        {/* ─────────────────────────────────────────────────────── */}

        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">

          <div className="flex items-center gap-12">

            <button

              onClick={() => skip(-10)}

              className="pointer-events-auto p-5 rounded-full bg-black/40 backdrop-blur-xl border border-white/20 hover:bg-black/60 hover:scale-110 active:scale-95 transition-all">



              <Rewind className="text-white" size={32} />

            </button>



            <button

              onClick={togglePlay}

              className="pointer-events-auto p-7 rounded-full bg-black/40 backdrop-blur-xl border border-white/20 hover:bg-black/60 hover:scale-110 active:scale-95 transition-all">



              {isPlaying ?

              <Pause className="text-white" size={40} /> :



              <Play className="text-white ml-1" size={40} />

              }

            </button>



            <button

              onClick={() => skip(10)}

              className="pointer-events-auto p-5 rounded-full bg-black/40 backdrop-blur-xl border border-white/20 hover:bg-black/60 hover:scale-110 active:scale-95 transition-all">



              <FastForward className="text-white" size={32} />

            </button>

          </div>

        </div>



        {/* ─────────────────────────────────────────────────────── */}

        {/* BOTTOM BAR - Timeline & Controls */}

        {/* ─────────────────────────────────────────────────────── */}

        <div className="absolute bottom-0 left-0 right-0 bg-black/10 backdrop-blur-sm pt-3 pb-[calc(12px+env(safe-area-inset-bottom,0px))] pl-[calc(16px+env(safe-area-inset-left,0px))] pr-[calc(16px+env(safe-area-inset-right,0px))]">

          {/* Progress Bar */}

          <div className="mb-3">

            <div

              ref={progressRef}

              className="relative h-1.5 bg-white/15 rounded-full cursor-pointer group hover:h-2.5 transition-all"

              onClick={handleSeekBarClick}

              onMouseMove={handleSeekBarHover}

              onMouseLeave={() => setSeekPreview(null)}>



              <div

                className="absolute h-full bg-white/20 rounded-full transition-all"

                style={{ width: `${buffered}%` }} />



              <div
                className="absolute h-full bg-[#34A853] rounded-full transition-all"
                style={{ width: `${progress}%` }}>
                <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3.5 h-3.5 bg-white rounded-full shadow-lg border-2 border-[#34A853] opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>



              {seekPreview !== null &&

              <div

                className="absolute -top-10 -translate-x-1/2 px-2.5 py-1.5 bg-black/80 rounded-lg text-white text-xs font-semibold pointer-events-none"

                style={{ left: `${seekPreview / safeDuration * 100}%` }}>

                  {formatTime(seekPreview)}

                </div>

              }

            </div>



            {/* Time */}

            <div className="flex items-center justify-between mt-1.5">

              <span className="text-white/90 text-xs font-medium tabular-nums">

                {formatTime(currentTime)}

              </span>

              <span className="text-white/50 text-[10px] font-medium">

                {selectedQuality} • {playbackRate}x

              </span>

              <span className="text-white/90 text-xs font-medium tabular-nums">

                {formatTime(duration)}

              </span>

            </div>

          </div>



          {/* Controls Row - minimal */}

          <div className="flex items-center justify-between">

            <div className="flex items-center gap-3">

              <button onClick={togglePlay} className="p-2 rounded-full bg-white/10 active:scale-90 transition-all">

                {isPlaying ? <Pause className="text-white" size={22} /> : <Play className="text-white ml-0.5" size={22} />}

              </button>



              <div className="flex items-center gap-1">

                <button onClick={toggleMute} className="p-2 rounded-full bg-white/10 active:scale-90 transition-all">

                  {isMuted || volume === 0 ? <VolumeX className="text-white" size={18} /> : <Volume2 className="text-white" size={18} />}

                </button>

                <input

                  type="range"

                  min="0"

                  max="1"

                  step="0.01"

                  value={isMuted ? 0 : volume}

                  onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}

                  className="w-16 sm:w-24 h-1 bg-white/20 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:rounded-full" />

              </div>

            </div>



            <div className="flex items-center gap-2">

              <button onClick={() => setShowSettings((prev) => !prev)} className="p-2 rounded-full bg-white/10 active:scale-90 transition-all">

                <Settings className="text-white" size={18} />

              </button>

              <button
                onClick={toggleOrientation}
                className="p-2 rounded-full bg-white/10 active:scale-90 transition-all"
                title={isLandscape ? 'Vertikal holat' : 'Gorizontal holat'}
              >
                {isLandscape
                  ? <Smartphone className="text-white" size={18} />
                  : <Monitor className="text-white" size={18} />
                }
              </button>

            </div>

          </div>

        </div>

      </div>



      {/* ═══════════════════════════════════════════════════════════ */}

      {/* SETTINGS PANEL */}

      {/* ═══════════════════════════════════════════════════════════ */}

      {showSettings &&

      <div className="absolute right-2 left-2 sm:left-auto sm:right-6 bottom-28 z-30 sm:w-96 max-h-[60vh] overflow-y-auto">

          <div className={`${theme.cardBg} backdrop-blur-2xl border ${theme.border} rounded-2xl shadow-2xl p-6 space-y-6 animate-slide-up`}>

            <div className="flex items-center justify-between">

              <h3 className={`${theme.text} text-xl font-bold`}>Settings</h3>

              <button

              onClick={() => setShowSettings(false)}

              className={`p-2 rounded-lg ${theme.buttonBg} ${theme.buttonHover} transition-all`}>



                <X className={theme.text} size={18} />

              </button>

            </div>



            {/* Playback Speed */}

            <div>

              <label className={`${theme.text} text-sm font-semibold mb-2 block`}>

                Playback Speed

              </label>

              <div className="grid grid-cols-4 gap-2">

                {[0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2].map((rate) =>

              <button

                key={rate}

                onClick={() => {

                  if (videoRef.current) videoRef.current.playbackRate = rate;

                  setPlaybackRate(rate);

                }}

                className={`px-3 py-2 rounded-lg text-sm font-semibold transition-all ${

                playbackRate === rate ?

                `${theme.accent} text-white` :

                `${theme.buttonBg} ${theme.text} ${theme.buttonHover}`}`

                }>



                    {rate}x

                  </button>

              )}

              </div>

            </div>



            {/* Video Quality */}

            <div>

              <label className={`${theme.text} text-sm font-semibold mb-2 block`}>

                Quality

              </label>

              <div className="space-y-2">

                {availableQualities.map((quality) =>

              <button

                key={quality.label}

                onClick={() => setSelectedQuality(quality.label)}

                className={`w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all ${

                selectedQuality === quality.label ?

                `${theme.accent} text-white` :

                `${theme.buttonBg} ${theme.text} ${theme.buttonHover}`}`

                }>



                    <span className="font-semibold">{quality.label}</span>

                    <div className="flex items-center gap-2 text-xs opacity-80">

                      <span>{quality.resolution}</span>

                      <span>•</span>

                      <span>{quality.bitrate}</span>

                    </div>

                  </button>

              )}

              </div>

            </div>



            {/* Brightness */}

            <div>

              <label className={`${theme.text} text-sm font-semibold mb-2 flex items-center justify-between`}>

                <span className="flex items-center gap-2">

                  <Sun size={16} />

                  Brightness

                </span>

                <span className={theme.textMuted}>{brightness}%</span>

              </label>

              <input

              type="range"

              min="20"

              max="200"

              value={brightness}

              onChange={(e) => setBrightness(parseInt(e.target.value))}

              className="w-full h-2 bg-white/20 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:shadow-lg" />



            </div>



            {/* Contrast */}

            <div>

              <label className={`${theme.text} text-sm font-semibold mb-2 flex items-center justify-between`}>

                <span className="flex items-center gap-2">

                  <Droplet size={16} />

                  Contrast

                </span>

                <span className={theme.textMuted}>{contrast}%</span>

              </label>

              <input

              type="range"

              min="50"

              max="200"

              value={contrast}

              onChange={(e) => setContrast(parseInt(e.target.value))}

              className="w-full h-2 bg-white/20 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:shadow-lg" />



            </div>



            {/* Saturation */}

            <div>

              <label className={`${theme.text} text-sm font-semibold mb-2 flex items-center justify-between`}>

                <span className="flex items-center gap-2">

                  <Wind size={16} />

                  Saturation

                </span>

                <span className={theme.textMuted}>{saturation}%</span>

              </label>

              <input

              type="range"

              min="0"

              max="200"

              value={saturation}

              onChange={(e) => setSaturation(parseInt(e.target.value))}

              className="w-full h-2 bg-white/20 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:shadow-lg" />



            </div>



            {/* Loop Toggle */}

            <div className="flex items-center justify-between">

              <label className={`${theme.text} text-sm font-semibold flex items-center gap-2`}>

                <Repeat size={16} />

                Loop Video

              </label>

              <button

              onClick={() => setIsLooping((prev) => !prev)}

              className={`relative w-14 h-7 rounded-full transition-all ${

              isLooping ? 'bg-blue-500' : 'bg-white/20'}`

              }>



                <div

                className={`absolute top-1 w-5 h-5 bg-white rounded-full shadow-lg transition-transform ${

                isLooping ? 'translate-x-8' : 'translate-x-1'}`

                } />



              </button>

            </div>

          </div>

        </div>

      }



      {/* ═══════════════════════════════════════════════════════════ */}

      {/* CHAPTERS PANEL */}

      {/* ═══════════════════════════════════════════════════════════ */}

      {showChapters && chapters.length > 0 &&

      <div className="absolute left-6 bottom-24 z-30 w-80 max-h-96 overflow-y-auto">

          <div className={`${theme.cardBg} backdrop-blur-2xl border ${theme.border} rounded-2xl shadow-2xl p-4 space-y-2 animate-slide-up`}>

            <div className="flex items-center justify-between mb-3">

              <h3 className={`${theme.text} text-lg font-bold`}>Chapters</h3>

              <button

              onClick={() => setShowChapters(false)}

              className={`p-2 rounded-lg ${theme.buttonBg} ${theme.buttonHover} transition-all`}>



                <X className={theme.text} size={16} />

              </button>

            </div>

            {chapters.map((chapter, idx) =>

          <button

            key={idx}

            onClick={() => seekTo(chapter.time)}

            className={`w-full text-left px-4 py-3 rounded-xl transition-all ${

            currentChapter?.time === chapter.time ?

            `${theme.accent} text-white` :

            `${theme.buttonBg} ${theme.text} ${theme.buttonHover}`}`

            }>



                <div className="flex items-center justify-between">

                  <span className="font-semibold text-sm">{chapter.title}</span>

                  <span className="text-xs opacity-80 tabular-nums">

                    {formatTime(chapter.time)}

                  </span>

                </div>

              </button>

          )}

          </div>

        </div>

      }



      {/* ═══════════════════════════════════════════════════════════ */}

      {/* INFO PANEL */}

      {/* ═══════════════════════════════════════════════════════════ */}

      {showInfo &&

      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-30 w-full max-w-2xl mx-auto px-4">

          <div className={`${theme.cardBg} backdrop-blur-2xl border ${theme.border} rounded-2xl shadow-2xl p-8 space-y-6 animate-fade-in`}>

            <div className="flex items-start justify-between">

              <div className="flex-1">

                <h2 className={`${theme.text} text-2xl font-bold mb-2`}>{title}</h2>

                {description &&

              <p className={`${theme.textMuted} text-sm leading-relaxed`}>

                    {description}

                  </p>

              }

              </div>

              <button

              onClick={() => setShowInfo(false)}

              className={`p-2 rounded-lg ${theme.buttonBg} ${theme.buttonHover} transition-all ml-4`}>



                <X className={theme.text} size={20} />

              </button>

            </div>



            <div className="grid grid-cols-2 gap-4">

              <InfoItem

              label="Duration"

              value={formatTime(duration)}

              icon={<Clock size={16} />}

              theme={theme} />



              <InfoItem

              label="Quality"

              value={selectedQuality}

              icon={<Monitor size={16} />}

              theme={theme} />



              <InfoItem

              label="Playback Speed"

              value={`${playbackRate}x`}

              icon={<Zap size={16} />}

              theme={theme} />



              <InfoItem

              label="Network"

              value={isOnline ? 'Connected' : 'Offline'}

              icon={isOnline ? <Wifi size={16} /> : <WifiOff size={16} />}

              theme={theme} />



            </div>



            {bookmarks.length > 0 &&

          <div>

                <h3 className={`${theme.text} text-sm font-bold mb-3 flex items-center gap-2`}>

                  <Bookmark size={16} />

                  Bookmarks ({bookmarks.length})

                </h3>

                <div className="space-y-2 max-h-40 overflow-y-auto">

                  {bookmarks.map((bookmark) =>

              <div

                key={bookmark.id}

                className={`flex items-center justify-between px-3 py-2 rounded-lg ${theme.buttonBg}`}>



                      <button

                  onClick={() => jumpToBookmark(bookmark.time)}

                  className={`flex-1 text-left ${theme.text} text-sm font-medium hover:underline`}>



                        {formatTime(bookmark.time)} - {bookmark.note}

                      </button>

                      <button

                  onClick={() => removeBookmark(bookmark.id)}

                  className={`p-1 rounded ${theme.buttonHover} transition-all`}>



                        <X className={theme.textMuted} size={14} />

                      </button>

                    </div>

              )}

                </div>

              </div>

          }

          </div>

        </div>

      }



      {/* ═══════════════════════════════════════════════════════════ */}

      {/* CUSTOM CSS ANIMATIONS */}

      {/* ═══════════════════════════════════════════════════════════ */}

      <style>{`

        @keyframes fade-in {

          from {

            opacity: 0;

            transform: scale(0.95);

          }

          to {

            opacity: 1;

            transform: scale(1);

          }

        }



        @keyframes slide-up {

          from {

            opacity: 0;

            transform: translateY(20px);

          }

          to {

            opacity: 1;

            transform: translateY(0);

          }

        }



        .animate-fade-in {

          animation: fade-in 0.2s ease-out;

        }



        .animate-slide-up {

          animation: slide-up 0.3s ease-out;

        }

      `}</style>

    </div>);



};



// ═══════════════════════════════════════════════════════════════

// HELPER COMPONENTS

// ═══════════════════════════════════════════════════════════════



interface ControlButtonProps {

  onClick: () => void;

  children: React.ReactNode;

  theme: Record<string, string>;

  active?: boolean;

  title?: string;

}



const ControlButton = ({ onClick, children, theme, active, title }: ControlButtonProps) =>

<button

  onClick={onClick}

  title={title}

  className={`p-3 rounded-xl transition-all hover:scale-105 active:scale-95 ${

  active ?

  `${theme.accent} text-white` :

  `${theme.buttonBg} ${theme.text} ${theme.buttonHover}`} border ${

  theme.border}`}>



    {children}

  </button>;





interface InfoItemProps {

  label: string;

  value: string;

  icon: React.ReactNode;

  theme: Record<string, string>;

}



const InfoItem = ({ label, value, icon, theme }: InfoItemProps) =>

<div className={`px-4 py-3 rounded-xl ${theme.buttonBg} border ${theme.border}`}>

    <div className="flex items-center gap-2 mb-1">

      <span className={theme.textMuted}>{icon}</span>

      <span className={`${theme.textMuted} text-xs font-medium uppercase tracking-wide`}>

        {label}

      </span>

    </div>

    <span className={`${theme.text} text-lg font-bold`}>{value}</span>

  </div>;





export default SamsungUltraVideoPlayer;