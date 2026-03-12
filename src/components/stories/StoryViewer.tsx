import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { X, ChevronLeft, ChevronRight, Heart, Send, Eye, MoreVertical, Pause, Play, Volume2, VolumeX, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { StoryGroup, Story, useStories } from '@/hooks/useStories';
import { useAuth } from '@/contexts/AuthContext';
import { useConversations } from '@/hooks/useConversations';
import { StarUsername } from '@/components/user/StarUsername';
import { supabase } from '@/integrations/supabase/client';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { MusicOverlay } from '@/components/music/MusicOverlay';
import { isActiveAudio, playExclusiveAudio, stopActiveAudio } from '@/lib/audioController';

interface StoryViewerProps {
  storyGroups: StoryGroup[];
  initialGroupIndex: number;
  initialStoryIndex?: number;
  persistKey?: string;
  onClose: () => void;
  onDeleted?: () => void;
}

export const StoryViewer = ({
  storyGroups,
  initialGroupIndex,
  initialStoryIndex = 0,
  persistKey,
  onClose,
  onDeleted,
}: StoryViewerProps) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { recordView, toggleLike, getStoryViewers, getStoryLikers } = useStories();
  const { getOrCreateConversation } = useConversations();
  
  const [currentGroupIndex, setCurrentGroupIndex] = useState(initialGroupIndex);
  const [currentStoryIndex, setCurrentStoryIndex] = useState(initialStoryIndex);
  const [isPaused, setIsPaused] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [progress, setProgress] = useState(0);
  const [reply, setReply] = useState('');
  const [showViewers, setShowViewers] = useState(false);
  const [viewers, setViewers] = useState<any[]>([]);
  const [likers, setLikers] = useState<any[]>([]);
  const [insightsTab, setInsightsTab] = useState<'views' | 'likes'>('views');
  const [isLiked, setIsLiked] = useState(false);
  const [likeAnimKey, setLikeAnimKey] = useState(0);
  const [showLikeAnim, setShowLikeAnim] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showCaption, setShowCaption] = useState(false);
  const [isMusicPlaying, setIsMusicPlaying] = useState(false);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const mutedMediaRef = useRef(new Map<HTMLMediaElement, { muted: boolean; volume: number }>());
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const progressRef = useRef<number>(0);
  const lastPersistRef = useRef<number>(0);

  const currentGroup = storyGroups[currentGroupIndex];
  const currentStory = currentGroup?.stories[currentStoryIndex];
  const isOwnStory = currentStory?.user_id === user?.id;
  const storyDuration = currentStory?.media_type === 'video' ? 15000 : 5000;

  const audioKey = currentStory?.id ? `story:${currentStory.id}` : null;

  const getPersistKey = useCallback(() => {
    if (!persistKey) return null;
    const viewerId = user?.id || 'anon';
    return `story_viewer_state_v1:${viewerId}:${persistKey}`;
  }, [persistKey, user?.id]);

  const persistState = useCallback(() => {
    const key = getPersistKey();
    if (!key) return;
    try {
      const now = Date.now();
      if (now - lastPersistRef.current < 300) return;
      lastPersistRef.current = now;

      const ct = currentStory?.media_type === 'video' ? (videoRef.current?.currentTime || 0) : 0;
      localStorage.setItem(
        key,
        JSON.stringify({
          groupIndex: currentGroupIndex,
          storyIndex: currentStoryIndex,
          paused: isPaused,
          muted: isMuted,
          videoTime: ct,
          savedAt: now,
        })
      );
    } catch (e) { /* ignore */ }
  }, [currentGroupIndex, currentStory?.media_type, currentStoryIndex, getPersistKey, isMuted, isPaused]);

  useEffect(() => {
    const key = getPersistKey();
    if (!key) return;
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return;
      const parsed = JSON.parse(raw) as {
        groupIndex?: number;
        storyIndex?: number;
        paused?: boolean;
        muted?: boolean;
        videoTime?: number;
      };

      if (typeof parsed.groupIndex === 'number' && parsed.groupIndex >= 0 && parsed.groupIndex < storyGroups.length) {
        setCurrentGroupIndex(parsed.groupIndex);
      }

      const g = storyGroups[
        typeof parsed.groupIndex === 'number' && parsed.groupIndex >= 0 && parsed.groupIndex < storyGroups.length
          ? parsed.groupIndex
          : initialGroupIndex
      ];
      const maxStoryIdx = g?.stories?.length ? g.stories.length - 1 : 0;
      if (typeof parsed.storyIndex === 'number') {
        const clamped = Math.max(0, Math.min(maxStoryIdx, parsed.storyIndex));
        setCurrentStoryIndex(clamped);
      }

      if (typeof parsed.paused === 'boolean') setIsPaused(parsed.paused);
      if (typeof parsed.muted === 'boolean') setIsMuted(parsed.muted);
    } catch (e) { /* ignore */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const getLocalLikeKey = useCallback((storyId: string) => {
    const viewerId = user?.id || 'anon';
    return `story_like_v1:${viewerId}:${storyId}`;
  }, [user?.id]);

  const readLocalLike = useCallback((storyId: string) => {
    try {
      const raw = localStorage.getItem(getLocalLikeKey(storyId));
      if (!raw) return null;
      const parsed = JSON.parse(raw) as { liked?: boolean; expiresAt?: number };
      if (!parsed || typeof parsed.expiresAt !== 'number') return null;
      if (Date.now() > parsed.expiresAt) {
        localStorage.removeItem(getLocalLikeKey(storyId));
        return null;
      }
      return parsed;
    } catch {
      return null;
    }
  }, [getLocalLikeKey]);

  const writeLocalLike = useCallback((storyId: string, liked: boolean) => {
    try {
      const ttlMs = 36 * 60 * 60 * 1000;
      localStorage.setItem(
        getLocalLikeKey(storyId),
        JSON.stringify({ liked, expiresAt: Date.now() + ttlMs })
      );
    } catch (e) { /* ignore */ }
  }, [getLocalLikeKey]);

  const removeLocalLike = useCallback((storyId: string) => {
    try {
      localStorage.removeItem(getLocalLikeKey(storyId));
    } catch (e) { /* ignore */ }
  }, [getLocalLikeKey]);

  // Record view when story changes
  useEffect(() => {
    if (currentStory && !isOwnStory) {
      recordView(currentStory.id);
    }
    if (currentStory) {
      const local = readLocalLike(currentStory.id);
      if (local && typeof local.liked === 'boolean') setIsLiked(local.liked);
      else setIsLiked(currentStory.has_liked || false);
    } else {
      setIsLiked(false);
    }
  }, [currentStory, isOwnStory, readLocalLike, recordView]);

  // Auto-play music when story changes
  useEffect(() => {
    setIsMusicPlaying(false);
    if (audioRef.current) {
      try {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      } catch (e) { /* ignore */ }
    }
    stopActiveAudio(audioKey || undefined);

    // Auto-play music if story has audio
    if (currentStory?.audio_url && audioRef.current && audioKey) {
      const el = audioRef.current;
      let cancelled = false;

      const doPlay = async () => {
        if (cancelled) return;
        try {
          const ok = await playExclusiveAudio(audioKey, el);
          if (!cancelled) setIsMusicPlaying(ok && !el.paused);
        } catch {
          if (!cancelled) setIsMusicPlaying(false);
        }
      };

      // Set up source and load
      el.src = currentStory.audio_url;
      el.loop = true;
      el.preload = 'auto';
      el.crossOrigin = 'anonymous';

      // Try to play once audio is ready
      const onReady = () => {
        el.removeEventListener('canplaythrough', onReady);
        doPlay();
      };
      el.addEventListener('canplaythrough', onReady);

      try { el.load(); } catch (e) { /* ignore */ }

      // Fallback: if canplaythrough doesn't fire within 1.5s, try anyway
      const fallback = setTimeout(() => {
        el.removeEventListener('canplaythrough', onReady);
        doPlay();
      }, 1500);

      return () => {
        cancelled = true;
        el.removeEventListener('canplaythrough', onReady);
        clearTimeout(fallback);
      };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentGroupIndex, currentStoryIndex]);

  useEffect(() => {
    if (!audioKey) return;
    setIsMusicPlaying(isActiveAudio(audioKey));
  }, [audioKey]);

  useEffect(() => {
    if (!audioKey) return;
    if (!currentStory?.audio_url) return;
    if (!isPaused) return;
    if (!audioRef.current) return;
    try {
      audioRef.current.pause();
    } catch (e) { /* ignore */ }
    setIsMusicPlaying(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPaused]);

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;

    const onError = () => {
      setIsMusicPlaying(false);
      toast.error('Musiqa yuklanmadi');
    };

    el.addEventListener('error', onError);
    return () => el.removeEventListener('error', onError);
  }, []);

  // Load viewers/likers for own story
  useEffect(() => {
    if (isOwnStory && currentStory) {
      loadViewersAndLikers();
    }
  }, [currentStory, isOwnStory]);

  const loadViewersAndLikers = async () => {
    if (!currentStory) return;
    const [viewersData, likersData] = await Promise.all([
      getStoryViewers(currentStory.id),
      getStoryLikers(currentStory.id),
    ]);
    setViewers(viewersData);
    setLikers(likersData);
  };

  // Progress timer
  useEffect(() => {
    if (!currentStory) return;

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    if (currentStory.media_type === 'video') {
      const el = videoRef.current;
      if (!el) return;

      const key = getPersistKey();
      if (key) {
        try {
          const raw = localStorage.getItem(key);
          if (raw) {
            const parsed = JSON.parse(raw) as { videoTime?: number; groupIndex?: number; storyIndex?: number };
            if (
              typeof parsed.videoTime === 'number' &&
              typeof parsed.groupIndex === 'number' &&
              typeof parsed.storyIndex === 'number' &&
              parsed.groupIndex === currentGroupIndex &&
              parsed.storyIndex === currentStoryIndex &&
              parsed.videoTime > 0
            ) {
              try {
                el.currentTime = parsed.videoTime;
              } catch (e) { /* ignore */ }
            }
          }
        } catch (e) { /* ignore */ }
      }

      const onTime = () => {
        const dur = el.duration || 0;
        if (!dur) return;
        const pct = Math.max(0, Math.min(100, (el.currentTime / dur) * 100));
        setProgress(pct);
        persistState();
      };

      const onEnded = () => {
        goToNextRef.current();
      };

      el.addEventListener('timeupdate', onTime);
      el.addEventListener('ended', onEnded);
      onTime();
      return () => {
        el.removeEventListener('timeupdate', onTime);
        el.removeEventListener('ended', onEnded);
      };
    }

    if (isPaused) return;

    progressRef.current = 0;
    setProgress(0);

    const interval = 50;
    timerRef.current = setInterval(() => {
      progressRef.current += interval;
      setProgress((progressRef.current / storyDuration) * 100);
      persistState();

      if (progressRef.current >= storyDuration) {
        goToNextRef.current();
      }
    }, interval);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [currentGroupIndex, currentStory, currentStoryIndex, getPersistKey, isPaused, persistState, storyDuration]);

  useEffect(() => {
    if (!currentStory || currentStory.media_type !== 'video') return;
    const el = videoRef.current;
    if (!el) return;
    el.muted = isMuted;
    if (isPaused) {
      try {
        el.pause();
      } catch (e) { /* ignore */ }
      persistState();
      return;
    }
    void (async () => {
      try {
        await el.play();
      } catch (e) { /* ignore */ }
    })();
  }, [currentStory, isMuted, isPaused, persistState]);

  useEffect(() => {
    const container = containerRef.current;
    const media = Array.from(document.querySelectorAll('video, audio')) as HTMLMediaElement[];

    for (const el of media) {
      if (container && container.contains(el)) continue;
      if (!mutedMediaRef.current.has(el)) {
        mutedMediaRef.current.set(el, { muted: el.muted, volume: el.volume });
      }
      try {
        el.pause();
      } catch (e) { /* ignore */ }
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
  }, []);

  const goToNext = useCallback(() => {
    if (currentStoryIndex < currentGroup.stories.length - 1) {
      setCurrentStoryIndex(prev => prev + 1);
    } else if (currentGroupIndex < storyGroups.length - 1) {
      setCurrentGroupIndex(prev => prev + 1);
      setCurrentStoryIndex(0);
    } else {
      onClose();
    }
  }, [currentStoryIndex, currentGroup, currentGroupIndex, storyGroups.length, onClose]);

  const goToNextRef = useRef(goToNext);
  useEffect(() => { goToNextRef.current = goToNext; }, [goToNext]);

  const goToPrev = useCallback(() => {
    if (currentStoryIndex > 0) {
      setCurrentStoryIndex(prev => prev - 1);
    } else if (currentGroupIndex > 0) {
      setCurrentGroupIndex(prev => prev - 1);
      const prevGroup = storyGroups[currentGroupIndex - 1];
      setCurrentStoryIndex(prevGroup.stories.length - 1);
    }
  }, [currentStoryIndex, currentGroupIndex, storyGroups]);

  useEffect(() => {
    persistState();
  }, [currentGroupIndex, currentStoryIndex, isPaused, isMuted, persistState]);

  const handleTap = (e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const width = rect.width;

    if (x < width * 0.3) {
      goToPrev();
    } else if (x > width * 0.7) {
      goToNext();
    } else {
      setIsPaused(prev => !prev);
    }
  };

  const toggleMusic = useCallback(async () => {
    if (!currentStory?.audio_url) return;
    if (!audioKey) return;
    const el = audioRef.current;
    if (!el) return;

    if (isActiveAudio(audioKey) && !el.paused) {
      try {
        el.pause();
      } catch (e) { /* ignore */ }
      stopActiveAudio(audioKey);
      setIsMusicPlaying(false);
      return;
    }

    try {
      el.src = currentStory.audio_url;
      el.loop = true;
      el.preload = 'auto';
      el.crossOrigin = 'anonymous';
      try { el.load(); } catch (e) { /* ignore */ }
    } catch (e) { /* ignore */ }

    // If story is paused, unpause so the paused-effect doesn't immediately stop audio.
    setIsPaused(false);

    const ok = await playExclusiveAudio(audioKey, el);
    if (!ok) {
      toast.error('Musiqani ijro etib bo\'lmadi');
      setIsMusicPlaying(false);
      return;
    }
    setIsMusicPlaying(!el.paused);
  }, [audioKey, currentStory?.audio_url]);

  const handleLike = useCallback(async () => {
    if (!currentStory) return;

    const next = !isLiked;
    setIsLiked(next);

    if (next) {
      writeLocalLike(currentStory.id, true);
      setLikeAnimKey(k => k + 1);
      setShowLikeAnim(true);
      window.setTimeout(() => setShowLikeAnim(false), 650);
    } else {
      removeLocalLike(currentStory.id);
    }

    try {
      await toggleLike(currentStory.id, isLiked);
    } catch {
      setIsLiked(!next);
      if (!next) writeLocalLike(currentStory.id, true);
      else removeLocalLike(currentStory.id);
      toast.error('Xatolik yuz berdi');
    }
  }, [currentStory, isLiked, removeLocalLike, toggleLike, writeLocalLike]);

  const timeAgo = currentStory
    ? formatDistanceToNow(new Date(currentStory.created_at), { addSuffix: true })
    : '';

  const handleDeleteStory = useCallback(async () => {
    if (!currentStory) return;
    setIsDeleting(true);
    try {
      const { error } = await supabase
        .from('stories')
        .delete()
        .eq('id', currentStory.id);

      if (error) throw error;

      toast.success("Hikoya o'chirildi");
      onDeleted?.();
      onClose();
    } catch (err) {
      console.error('Error deleting story:', err);
      toast.error("Xatolik yuz berdi");
    } finally {
      setIsDeleting(false);
      setShowDeleteDialog(false);
    }
  }, [currentStory, onClose, onDeleted]);

  if (!currentGroup || !currentStory) {
    return null;
  }

  const author = currentStory.author || currentGroup.user;

  const content = (
    <div ref={containerRef} className="fullscreen-story-view flex flex-col">
      {/* Story content */}
      <div
        className="relative flex-1 w-full min-h-0 flex items-center justify-center touch-none"
        onClick={handleTap}
      >
        {showLikeAnim && (
          <div key={likeAnimKey} className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none">
            <div className="relative">
              <div className="absolute inset-0 rounded-full bg-red-500/20 blur-xl animate-ping" />
              <div className="relative w-24 h-24 flex items-center justify-center">
                <Heart className="w-20 h-20 text-red-500 fill-red-500 drop-shadow-[0_8px_18px_rgba(239,68,68,0.35)] animate-[likePop_650ms_ease-out]" />
              </div>
            </div>
          </div>
        )}

        {currentStory.media_type === 'video' ? (
          <video
            ref={videoRef}
            src={currentStory.media_url}
            className="max-w-full max-h-full w-full h-full object-contain"
            autoPlay
            muted={isMuted}
            playsInline
            loop={false}
          />
        ) : (
          <img
            src={currentStory.media_url}
            alt="Story"
            className="max-w-full max-h-full w-full h-full object-contain"
          />
        )}

        {/* Overlay gradient */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-transparent to-black/50 pointer-events-none" />

        {/* Progress bars — safe-area ichida */}
        <div className="absolute top-0 left-0 right-0 flex gap-1 pt-[max(8px,env(safe-area-inset-top))] px-2">
          {currentGroup.stories.map((_, index) => (
            <div
              key={index}
              className="flex-1 h-0.5 bg-white/30 rounded-full overflow-hidden"
            >
              <div
                className="h-full bg-white transition-all duration-100"
                style={{
                  width:
                    index < currentStoryIndex
                      ? '100%'
                      : index === currentStoryIndex
                      ? `${progress}%`
                      : '0%',
                }}
              />
            </div>
          ))}
        </div>

        {/* Header — safe-area */}
        <div className="absolute top-[max(24px,calc(8px+env(safe-area-inset-top)))] left-0 right-0 px-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative w-10 h-10 overflow-visible">
              <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-white">
                {author.avatar_url ? (
                  <img
                    src={author.avatar_url}
                    alt={author.name || 'User'}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-muted flex items-center justify-center text-white font-medium">
                    {(author.name || author.username || 'U').charAt(0).toUpperCase()}
                  </div>
                )}
              </div>

              {isOwnStory && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate('/create-story');
                  }}
                  className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-white/85 flex items-center justify-center border-2 border-white/60 shadow-md"
                >
                  <Plus className="h-3 w-3 text-black/80" />
                </button>
              )}
            </div>
            <div className="text-white">
              <p className="font-medium text-sm">{author.name || author.username || 'Foydalanuvchi'}</p>
              <p className="text-xs opacity-70">{timeAgo}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {currentStory.audio_url && (
              <div onClick={(e) => e.stopPropagation()} className="mr-1">
                <MusicOverlay
                  audioTitle={currentStory.audio_title}
                  audioArtist={currentStory.audio_artist}
                  isPlaying={isMusicPlaying}
                  onTogglePlay={toggleMusic}
                  popoverSide="bottom"
                />
              </div>
            )}
            {isOwnStory && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-white hover:bg-white/20"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <MoreVertical className="h-5 w-5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-44">
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setShowDeleteDialog(true);
                      setIsPaused(true);
                    }}
                  >
                    O'chirish
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            {currentStory.media_type === 'video' && (
              <Button
                variant="ghost"
                size="icon"
                className="text-white hover:bg-white/20"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsMuted(!isMuted);
                }}
              >
                {isMuted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="text-white hover:bg-white/20"
              onClick={(e) => {
                e.stopPropagation();
                setIsPaused(!isPaused);
              }}
            >
              {isPaused ? <Play className="h-5 w-5" /> : <Pause className="h-5 w-5" />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="text-white hover:bg-white/20"
              onClick={(e) => {
                e.stopPropagation();
                onClose();
              }}
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>

        <audio
          ref={audioRef}
          className="absolute left-0 top-0 h-px w-px opacity-0 pointer-events-none"
          onError={() => {
            setIsMusicPlaying(false);
            try {
              console.error('Story audio error', {
                storyId: currentStory?.id,
                audioUrl: currentStory?.audio_url,
                mediaError: audioRef.current ? (audioRef.current as any).error : undefined,
              });
            } catch (e) { /* ignore */ }
            toast.error('Musiqa yuklanmadi');
          }}
          onEnded={() => setIsMusicPlaying(false)}
        />

        {/* Caption */}
        {currentStory.caption && (
          <div className="absolute bottom-[max(80px,calc(64px+env(safe-area-inset-bottom)))] left-4 right-4">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setShowCaption(true);
                setIsPaused(true);
              }}
              className="w-full"
            >
              <p className="text-white text-center text-sm bg-black/40 px-3 py-2 rounded-lg line-clamp-2">
                {currentStory.caption}
              </p>
            </button>
          </div>
        )}

        {/* Footer actions — safe-area */}
        <div className="absolute bottom-[max(16px,env(safe-area-inset-bottom))] left-4 right-4">
          {isOwnStory ? (
            // Own story: show viewers
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                className="text-white hover:bg-white/20 gap-2"
                onClick={(e) => {
                  e.stopPropagation();
                  setInsightsTab('views');
                  setShowViewers(true);
                  setIsPaused(true);
                }}
              >
                <Eye className="h-5 w-5" />
                <span>{viewers.length} ko'rish</span>
              </Button>

              <Button
                variant="ghost"
                className="text-white hover:bg-white/20 gap-2"
                onClick={(e) => {
                  e.stopPropagation();
                  setInsightsTab('likes');
                  setShowViewers(true);
                  setIsPaused(true);
                }}
              >
                <Heart className="h-5 w-5" />
                <span>{likers.length} yoqtirish</span>
              </Button>
            </div>
          ) : (
            // Other's story: reply & like
            <div className="flex items-center gap-2">
              <Input
                placeholder={`${author.username || 'Foydalanuvchi'}ga javob...`}
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                className="flex-1 bg-white/10 border-white/20 text-white placeholder:text-white/50"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsPaused(true);
                }}
              />
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  'text-white hover:bg-white/20 active:scale-95 transition-transform',
                  'h-12 w-12 rounded-full bg-white/10 border border-white/15 backdrop-blur-md',
                  isLiked && 'text-red-500 bg-white/15 border-white/25'
                )}
                onClick={(e) => {
                  e.stopPropagation();
                  handleLike();
                }}
              >
                <Heart className={cn('h-7 w-7', isLiked && 'fill-current')} />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  'text-white hover:bg-white/20 active:scale-95 transition-transform',
                  'h-12 w-12 rounded-full bg-gradient-to-br from-white/18 to-white/8 border border-white/15 backdrop-blur-md',
                  'disabled:opacity-40 disabled:active:scale-100'
                )}
                disabled={!reply.trim()}
                onClick={async (e) => {
                  e.stopPropagation();
                  if (!reply.trim() || !currentStory) return;
                  try {
                    const convId = await getOrCreateConversation(currentStory.user_id);
                    if (!convId || !user?.id) return;
                    const storyReplyText = `📷 Story'ga javob:\n${reply.trim()}`;
                    await supabase.from('messages').insert({
                      conversation_id: convId,
                      sender_id: user.id,
                      content: storyReplyText,
                      status: 'sent',
                    });
                    toast.success("Javob yuborildi");
                    setReply('');
                  } catch (err) {
                    console.error('Story reply error:', err);
                    toast.error("Xatolik yuz berdi");
                  }
                }}
              >
                <Send className="h-5 w-5" />
              </Button>
            </div>
          )}
        </div>

        {/* Navigation buttons (desktop) */}
        {currentGroupIndex > 0 && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute left-2 top-1/2 -translate-y-1/2 text-white hover:bg-white/20 hidden md:flex"
            onClick={(e) => {
              e.stopPropagation();
              goToPrev();
            }}
          >
            <ChevronLeft className="h-8 w-8" />
          </Button>
        )}
        {currentGroupIndex < storyGroups.length - 1 && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-2 top-1/2 -translate-y-1/2 text-white hover:bg-white/20 hidden md:flex"
            onClick={(e) => {
              e.stopPropagation();
              goToNext();
            }}
          >
            <ChevronRight className="h-8 w-8" />
          </Button>
        )}
      </div>

      {/* Viewers sheet */}
      <Sheet open={showViewers} onOpenChange={(open) => {
        setShowViewers(open);
        if (!open) setIsPaused(false);
      }}>
        <SheetContent side="bottom" className="h-[70vh] px-0">
          <div className="px-4">
            <SheetHeader>
              <SheetTitle>
                {insightsTab === 'views'
                  ? `Ko'rganlar (${viewers.length})`
                  : `Yoqtirganlar (${likers.length})`}
              </SheetTitle>
            </SheetHeader>

            <div className="mt-3 flex items-center gap-2">
              <button
                type="button"
                onClick={() => setInsightsTab('views')}
                className={cn(
                  'px-3 py-2 rounded-xl text-sm font-medium border transition-colors',
                  insightsTab === 'views'
                    ? 'bg-foreground text-background border-foreground'
                    : 'bg-background/50 text-foreground border-border hover:bg-muted'
                )}
              >
                Ko'rganlar
              </button>
              <button
                type="button"
                onClick={() => setInsightsTab('likes')}
                className={cn(
                  'px-3 py-2 rounded-xl text-sm font-medium border transition-colors',
                  insightsTab === 'likes'
                    ? 'bg-foreground text-background border-foreground'
                    : 'bg-background/50 text-foreground border-border hover:bg-muted'
                )}
              >
                Yoqtirganlar
              </button>
            </div>
          </div>

          <ScrollArea className="h-[calc(70vh-140px)] mt-4 px-4">
            {insightsTab === 'views' ? (
              viewers.length === 0 ? (
                <p className="text-center text-muted-foreground py-10">
                  Hali hech kim ko'rmagan
                </p>
              ) : (
                <div className="grid grid-cols-2 gap-3 pb-6">
                  {viewers.map((viewer) => (
                    <div
                      key={viewer.viewer_id}
                      className="flex items-center gap-3 p-3 rounded-2xl border border-border/60 bg-background/60 shadow-sm hover:shadow-md transition-shadow"
                    >
                      <div className="w-11 h-11 rounded-2xl overflow-hidden bg-muted shrink-0">
                        {viewer.profile?.avatar_url ? (
                          <img
                            src={viewer.profile.avatar_url}
                            alt={viewer.profile.name || 'User'}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-muted-foreground font-medium">
                            {(viewer.profile?.name || 'U').charAt(0).toUpperCase()}
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-sm truncate">
                          {viewer.profile?.name || viewer.profile?.username || 'Foydalanuvchi'}
                        </p>
                        <div className="truncate">
                          <StarUsername username={viewer.profile?.username || 'user'} />
                        </div>
                      </div>
                      {likers.some(l => l.user_id === viewer.viewer_id) && (
                        <Heart className="h-4 w-4 text-red-500 fill-current" />
                      )}
                    </div>
                  ))}
                </div>
              )
            ) : (
              likers.length === 0 ? (
                <p className="text-center text-muted-foreground py-10">
                  Hali hech kim yoqtirmagan
                </p>
              ) : (
                <div className="grid grid-cols-2 gap-3 pb-6">
                  {likers.map((like) => (
                    <div
                      key={like.user_id}
                      className="flex items-center gap-3 p-3 rounded-2xl border border-border/60 bg-background/60 shadow-sm hover:shadow-md transition-shadow"
                    >
                      <div className="w-11 h-11 rounded-2xl overflow-hidden bg-muted shrink-0">
                        {like.profile?.avatar_url ? (
                          <img
                            src={like.profile.avatar_url}
                            alt={like.profile.name || 'User'}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-muted-foreground font-medium">
                            {(like.profile?.name || 'U').charAt(0).toUpperCase()}
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-sm truncate">
                          {like.profile?.name || like.profile?.username || 'Foydalanuvchi'}
                        </p>
                        <div className="truncate">
                          <StarUsername username={like.profile?.username || 'user'} />
                        </div>
                      </div>
                      <Heart className="h-4 w-4 text-red-500 fill-current" />
                    </div>
                  ))}
                </div>
              )
            )}
          </ScrollArea>
        </SheetContent>
      </Sheet>

      <Sheet
        open={showCaption}
        onOpenChange={(open) => {
          setShowCaption(open);
          if (!open) setIsPaused(false);
        }}
      >
        <SheetContent side="bottom" className="h-[50vh] px-0">
          <div className="px-4">
            <SheetHeader>
              <SheetTitle>Izoh</SheetTitle>
            </SheetHeader>
          </div>
          <ScrollArea className="h-[calc(50vh-56px)] px-4">
            <div className="py-3 text-sm whitespace-pre-wrap break-words">
              {currentStory?.caption}
            </div>
          </ScrollArea>
        </SheetContent>
      </Sheet>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent onClick={(e) => e.stopPropagation()}>
          <AlertDialogHeader>
            <AlertDialogTitle>Hikoyani o'chirish</AlertDialogTitle>
            <AlertDialogDescription>
              Bu amalni bekor qilib bo'lmaydi. Hikoya butunlay o'chiriladi.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setIsPaused(false)}>Bekor qilish</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteStory}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? "O'chirilmoqda..." : "O'chirish"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );

  if (typeof document === 'undefined') return null;
  return createPortal(content, document.body);
};

const styleId = 'story-like-pop-style';
if (typeof document !== 'undefined' && !document.getElementById(styleId)) {
  const s = document.createElement('style');
  s.id = styleId;
  s.innerHTML = `@keyframes likePop{0%{transform:scale(.65);opacity:0}35%{transform:scale(1.12);opacity:1}100%{transform:scale(1);opacity:.95}}`;
  document.head.appendChild(s);
}
