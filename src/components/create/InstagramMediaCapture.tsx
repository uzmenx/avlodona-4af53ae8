import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Camera, ChevronRight, Image as ImageIcon, Lock, Music2, Play, Pause, RefreshCw, Smile, Type, Volume2, VolumeX, X, Disc, ImagePlus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { EMOJIS, MEDIA_FILTERS } from './filters';
import FilterStrip from './FilterStrip';
import { MusicPicker, type SelectedMusic } from './MusicPicker';
import TextOverlay, { TextItem } from './TextOverlay';

export interface CapturedMedia {
  id: string;
  type: 'photo' | 'video';
  file: File;
  url: string;
  thumbnail?: string;
}

type CaptureMode = 'photo' | 'video';

type EditableItem = {
  media: CapturedMedia;
  filter: string;
  texts: TextItem[];
  images: ImageSticker[];
  mediaTransform: {
    x: number;
    y: number;
    scale: number;
    rotation: number;
  };
};

type ImageSticker = {
  id: string;
  file: File;
  url: string;
  x: number;
  y: number;
  scale: number;
  rotation: number;
};

function ImageOverlay({
  item,
  containerRef,
  onUpdate,
  onDelete,
}: {
  item: ImageSticker;
  containerRef: React.RefObject<HTMLDivElement>;
  onUpdate: (item: ImageSticker) => void;
  onDelete: (id: string) => void;
}) {
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0, itemX: 0, itemY: 0 });
  const pinchRef = useRef<{ dist: number; angle: number; scale: number; rotation: number } | null>(null);
  const activeTouchIdRef = useRef<number | null>(null);
  const elRef = useRef<HTMLDivElement>(null);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setIsDragging(true);
    dragStart.current = { x: e.clientX, y: e.clientY, itemX: item.x, itemY: item.y };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, [item.x, item.y]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDragging) return;
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;
    onUpdate({
      ...item,
      x: Math.max(0, Math.min(100, dragStart.current.itemX + (dx / rect.width) * 100)),
      y: Math.max(0, Math.min(100, dragStart.current.itemY + (dy / rect.height) * 100)),
    });
  }, [containerRef, isDragging, item, onUpdate]);

  const handlePointerUp = useCallback(() => setIsDragging(false), []);

  useEffect(() => {
    const el = elRef.current;
    if (!el) return;

    const findTouch = (touches: TouchList, id: number) => {
      for (let i = 0; i < touches.length; i++) {
        if (touches[i]?.identifier === id) return touches[i];
      }
      return null;
    };

    const pickSecondTouch = (touches: TouchList, firstId: number) => {
      for (let i = 0; i < touches.length; i++) {
        const t = touches[i];
        if (t && t.identifier !== firstId) return t;
      }
      return null;
    };

    const onGlobalTouchMove = (e: TouchEvent) => {
      const firstId = activeTouchIdRef.current;
      if (firstId === null) return;
      if (e.touches.length < 2) return;

      const t1 = findTouch(e.touches, firstId);
      const t2 = pickSecondTouch(e.touches, firstId);
      if (!t1 || !t2) return;

      e.stopPropagation();
      e.preventDefault();

      const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
      const angle = Math.atan2(t2.clientY - t1.clientY, t2.clientX - t1.clientX) * (180 / Math.PI);

      if (!pinchRef.current) {
        pinchRef.current = { dist, angle, scale: item.scale, rotation: item.rotation };
        return;
      }

      onUpdate({
        ...item,
        scale: Math.max(0.2, Math.min(6, pinchRef.current.scale * (dist / pinchRef.current.dist))),
        rotation: pinchRef.current.rotation + (angle - pinchRef.current.angle),
      });
    };

    const onGlobalTouchEnd = (e: TouchEvent) => {
      const firstId = activeTouchIdRef.current;
      if (firstId === null) return;

      const stillPresent = findTouch(e.touches, firstId);
      if (!stillPresent) {
        activeTouchIdRef.current = null;
        pinchRef.current = null;
      }

      if (e.touches.length < 2) pinchRef.current = null;
    };

    const handleTouchStart = (e: TouchEvent) => {
      e.stopPropagation();
      e.preventDefault();

      if (activeTouchIdRef.current === null && e.changedTouches?.[0]) {
        activeTouchIdRef.current = e.changedTouches[0].identifier;
      }
    };

    el.addEventListener('touchstart', handleTouchStart, { passive: false });
    window.addEventListener('touchmove', onGlobalTouchMove, { passive: false });
    window.addEventListener('touchend', onGlobalTouchEnd);
    window.addEventListener('touchcancel', onGlobalTouchEnd);

    return () => {
      el.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove', onGlobalTouchMove);
      window.removeEventListener('touchend', onGlobalTouchEnd);
      window.removeEventListener('touchcancel', onGlobalTouchEnd);
    };
  }, [item, onUpdate]);

  return (
    <div
      ref={elRef}
      className="absolute select-none touch-none cursor-move group"
      style={{
        left: `${item.x}%`,
        top: `${item.y}%`,
        transform: `translate(-50%, -50%) scale(${item.scale}) rotate(${item.rotation}deg)`,
        zIndex: isDragging ? 50 : 35,
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onTouchStart={(e) => { e.stopPropagation(); }}
      onTouchMove={(e) => { e.stopPropagation(); }}
      onTouchEnd={(e) => { e.stopPropagation(); }}
      onTouchCancel={(e) => { e.stopPropagation(); }}
    >
      <div className="relative">
        <img src={item.url} alt="" className="w-28 max-w-[42vw] h-auto rounded-xl shadow-[0_8px_24px_rgba(0,0,0,0.45)]" draggable={false} />
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(item.id); }}
          className="absolute -top-3 -right-3 w-5 h-5 bg-destructive rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <X className="w-3 h-3 text-destructive-foreground" />
        </button>
      </div>
    </div>
  );
}

interface InstagramMediaCaptureProps {
  onClose: () => void;
  onNext: (items: { file: File; filter: string }[]) => void;
  maxItems?: number;
}

export default function InstagramMediaCapture({ onClose, onNext, maxItems = 5 }: InstagramMediaCaptureProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const previewVideoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const musicTrimBarRef = useRef<HTMLDivElement>(null);
  const musicTrimDraggingRef = useRef<'start' | 'end' | null>(null);

  const isPinchingMediaRef = useRef(false);
  const mediaPinchRef = useRef<{
    dist: number;
    angle: number;
    midX: number;
    midY: number;
    x: number;
    y: number;
    scale: number;
    rotation: number;
  } | null>(null);

  const streamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const musicAudioRef = useRef<HTMLAudioElement | null>(null);
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const musicStopTimerRef = useRef<number>();
  const stopRecordingRef = useRef<() => void>(() => {});
  const setupAudioMixingRef = useRef<() => Promise<MediaStream | null>>(async () => null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const stickerInputRef = useRef<HTMLInputElement>(null);
  const recordTimerRef = useRef<number>();
  const captureTimerRef = useRef<number>();
  const isTakingPhotoRef = useRef(false);
  const justStoppedRecordingAtRef = useRef<number>(0);
  const swipeStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  const [focusedMediaId, setFocusedMediaId] = useState<string | null>(null);
  const [trayOpen, setTrayOpen] = useState(false);
  const trayStartYRef = useRef<number | null>(null);

  const [items, setItems] = useState<EditableItem[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);

  const [zoom, setZoom] = useState(1);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [cameraReady, setCameraReady] = useState(false);

  const [isCapturing, setIsCapturing] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [dragStartY, setDragStartY] = useState<number | null>(null);

  const [captureMode, setCaptureMode] = useState<CaptureMode>('photo');

  const [showTextInput, setShowTextInput] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showMusicPicker, setShowMusicPicker] = useState(false);
  const [textValue, setTextValue] = useState('');
  const [selectedMusic, setSelectedMusic] = useState<{ file: File; name: string; url: string } | null>(null);
  const [selectedMusicMeta, setSelectedMusicMeta] = useState<SelectedMusic | null>(null);
  const [isMusicPlaying, setIsMusicPlaying] = useState(false);
  const [musicDuration, setMusicDuration] = useState(0);
  const [musicTrimStart, setMusicTrimStart] = useState(0);
  const [musicTrimEnd, setMusicTrimEnd] = useState(0);
  const [musicArmed, setMusicArmed] = useState(false);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);

  const [filterNameVisible, setFilterNameVisible] = useState(false);
  const [filterNameText, setFilterNameText] = useState('');
  const filterTimerRef = useRef<number>();

  const [isExporting, setIsExporting] = useState(false);

  const active = items[activeIndex];
  const currentFilter = useMemo(() => {
    const name = active?.filter ?? 'original';
    return MEDIA_FILTERS.find(f => f.name === name) || MEDIA_FILTERS[0];
  }, [active?.filter]);

  const updateActive = useCallback((partial: Partial<EditableItem>) => {
    setItems(prev => prev.map((it, i) => (i === activeIndex ? { ...it, ...partial } : it)));
  }, [activeIndex]);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraReady(false);
  }, []);

  const startCamera = useCallback(async () => {
    stopCamera();
    try {
      let stream: MediaStream | null = null;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode, width: { ideal: 1920 }, height: { ideal: 1080 } },
          audio: true,
        });
      } catch (e1) {
        try {
          stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        } catch (e2) {
          stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        }
      }

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setCameraReady(true);
    } catch (err) {
      console.error('Camera error:', err);
      setCameraReady(false);
    }
  }, [facingMode, stopCamera]);

  useEffect(() => {
    startCamera();
    return () => stopCamera();
  }, [startCamera, stopCamera]);

  useEffect(() => {
    clearInterval(recordTimerRef.current);
    clearTimeout(captureTimerRef.current);
    clearTimeout(filterTimerRef.current);
    clearTimeout(musicStopTimerRef.current);
    return () => {
      clearInterval(recordTimerRef.current);
      clearTimeout(captureTimerRef.current);
      clearTimeout(filterTimerRef.current);
      clearTimeout(musicStopTimerRef.current);
    };
  }, []);

  const fmtTime = useCallback((seconds: number) => {
    const s = Math.max(0, Math.floor(seconds));
    const mm = Math.floor(s / 60);
    const ss = (s % 60).toString().padStart(2, '0');
    return `${mm}:${ss}`;
  }, []);

  const addMediaItem = useCallback((media: CapturedMedia) => {
    setItems(prev => {
      const next = [...prev, {
        media,
        filter: 'original',
        texts: [],
        images: [],
        mediaTransform: { x: 0, y: 0, scale: 1, rotation: 0 },
      }];
      // activeIndex should point to the newly added item
      setActiveIndex(next.length - 1);
      return next;
    });
    setFocusedMediaId(media.id);
    setTrayOpen(false);
  }, []);

  const removeMedia = useCallback((id: string) => {
    setItems(prev => {
      const idx = prev.findIndex(x => x.media.id === id);
      const found = prev[idx];
      if (found) {
        URL.revokeObjectURL(found.media.url);
        found.images.forEach(img => URL.revokeObjectURL(img.url));
      }
      const next = prev.filter(x => x.media.id !== id);

      // Clamp activeIndex against the new array length.
      setActiveIndex((current) => {
        if (next.length === 0) return 0;
        // If you removed an item before current, shift left.
        const shifted = idx >= 0 && idx < current ? current - 1 : current;
        return Math.max(0, Math.min(shifted, next.length - 1));
      });

      // If nothing left, go back to capture mode.
      if (next.length === 0) setFocusedMediaId(null);
      return next;
    });
  }, []);

  const moveMedia = useCallback((from: number, to: number) => {
    setItems(prev => {
      const arr = [...prev];
      const [it] = arr.splice(from, 1);
      arr.splice(to, 0, it);
      return arr;
    });
    setActiveIndex((idx) => {
      if (idx === from) return to;
      if (from < idx && idx <= to) return idx - 1;
      if (to <= idx && idx < from) return idx + 1;
      return idx;
    });
  }, []);

  const takePhoto = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;
    if (items.length >= maxItems) return;
    if (isTakingPhotoRef.current) return;
    isTakingPhotoRef.current = true;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (zoom > 1) {
      const sw = video.videoWidth / zoom;
      const sh = video.videoHeight / zoom;
      const sx = (video.videoWidth - sw) / 2;
      const sy = (video.videoHeight - sh) / 2;
      ctx.drawImage(video, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
    } else {
      ctx.drawImage(video, 0, 0);
    }

    canvas.toBlob((blob) => {
      try {
        if (!blob) return;
        const file = new File([blob], `photo-${Date.now()}.jpg`, { type: 'image/jpeg' });
        const url = URL.createObjectURL(blob);
        addMediaItem({ id: crypto.randomUUID(), type: 'photo', file, url });
      } finally {
        isTakingPhotoRef.current = false;
      }
    }, 'image/jpeg', 0.92);
  }, [addMediaItem, items.length, maxItems, zoom]);

  const startRecording = useCallback(async () => {
    if (!streamRef.current) return;
    if (items.length >= maxItems) return;

    // Setup audio mixing if music is selected
    let streamToUse = streamRef.current;
    if (selectedMusic) {
      const mixedStream = await setupAudioMixingRef.current();
      if (mixedStream) streamToUse = mixedStream;
    }

    recordedChunksRef.current = [];
    const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
      ? 'video/webm;codecs=vp9'
      : 'video/webm';

    const recorder = new MediaRecorder(streamToUse, { mimeType });
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) recordedChunksRef.current.push(e.data);
    };
    recorder.onstop = () => {
      const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
      const file = new File([blob], `video-${Date.now()}.webm`, { type: 'video/webm' });
      const url = URL.createObjectURL(blob);

      (async () => {
        try {
          const tempVideo = document.createElement('video');
          tempVideo.src = url;
          tempVideo.muted = true;
          (tempVideo as any).playsInline = true;

          try {
            tempVideo.preload = 'auto';
            tempVideo.load();
          } catch {}

          await new Promise<void>((resolve, reject) => {
            const onLoaded = () => resolve();
            const onErr = () => reject(new Error('thumbnail: video load error'));
            tempVideo.addEventListener('loadedmetadata', onLoaded, { once: true });
            tempVideo.addEventListener('error', onErr, { once: true });
          });

          const seekTime = Math.min(0.2, Math.max(0, (Number.isFinite(tempVideo.duration) ? tempVideo.duration : 0) / 4));
          try {
            tempVideo.currentTime = seekTime;
          } catch {}

          await new Promise<void>((resolve) => {
            const done = () => resolve();
            const t = window.setTimeout(done, 600);
            const onDone = () => {
              window.clearTimeout(t);
              done();
            };

            tempVideo.addEventListener('seeked', onDone, { once: true });
            // If seek never fires (some browsers), resolve on next loadeddata/timeupdate.
            tempVideo.addEventListener('loadeddata', onDone, { once: true });
            tempVideo.addEventListener('timeupdate', onDone, { once: true });
          });

          const c = document.createElement('canvas');
          c.width = tempVideo.videoWidth || 720;
          c.height = tempVideo.videoHeight || 1280;
          c.getContext('2d')?.drawImage(tempVideo, 0, 0);
          const thumb = c.toDataURL('image/jpeg', 0.7);
          addMediaItem({ id: crypto.randomUUID(), type: 'video', file, url, thumbnail: thumb });
        } catch {
          addMediaItem({ id: crypto.randomUUID(), type: 'video', file, url });
        }
      })();
    };

    recorder.start();
    mediaRecorderRef.current = recorder;
    setIsRecording(true);
    setRecordingTime(0);
    recordTimerRef.current = window.setInterval(() => setRecordingTime(t => t + 1), 1000);
    
    // Start playing music if selected
    if (selectedMusic && musicAudioRef.current) {
      clearTimeout(musicStopTimerRef.current);
      try {
        musicAudioRef.current.currentTime = Math.min(Math.max(0, musicTrimStart), Math.max(0, (musicTrimEnd || 0) - 0.05));
      } catch {}
      musicAudioRef.current.play();
      setIsMusicPlaying(true);

      const segmentDuration = Math.max(0, (musicTrimEnd || 0) - (musicTrimStart || 0));
      if (segmentDuration > 0) {
        musicStopTimerRef.current = window.setTimeout(() => {
          stopRecordingRef.current();
        }, Math.round(segmentDuration * 1000));
      }
    }
  }, [addMediaItem, items.length, maxItems, musicTrimEnd, musicTrimStart, selectedMusic]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      justStoppedRecordingAtRef.current = Date.now();
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      clearInterval(recordTimerRef.current);
      clearTimeout(musicStopTimerRef.current);
      
      // Stop music when recording stops
      if (musicAudioRef.current && isMusicPlaying) {
        musicAudioRef.current.pause();
        setIsMusicPlaying(false);
      }
    }
  }, [isRecording, isMusicPlaying]);

  const lastVideoToggleTouchAtRef = useRef(0);

  useEffect(() => {
    stopRecordingRef.current = stopRecording;
  }, [stopRecording]);

  const handleCaptureStart = useCallback(() => {
    if (isRecording) return;
    if (captureMode === 'video') {
      startRecording();
      return;
    }

    setIsCapturing(true);
    captureTimerRef.current = window.setTimeout(() => startRecording(), 500);
  }, [captureMode, isRecording, startRecording]);

  const handleVideoToggleCapture = useCallback(() => {
    if (isRecording) stopRecording();
    else startRecording();
  }, [isRecording, startRecording, stopRecording]);

  const handleCaptureEnd = useCallback(() => {
    clearTimeout(captureTimerRef.current);
    if (isTakingPhotoRef.current) return;

    if (captureMode === 'video') {
      if (isRecording) stopRecording();
      setIsCapturing(false);
      return;
    }

    // Avoid taking a photo on the synthetic second event fired right after stopping a recording.
    if (Date.now() - justStoppedRecordingAtRef.current < 450) {
      setIsCapturing(false);
      return;
    }

    if (isRecording) {
      stopRecording();
      setIsCapturing(false);
      return;
    }

    takePhoto();

    setIsCapturing(false);
  }, [captureMode, isRecording, stopRecording, takePhoto]);

  const removeSelectedMusic = useCallback(() => {
    clearTimeout(musicStopTimerRef.current);
    if (musicAudioRef.current) {
      try {
        musicAudioRef.current.pause();
      } catch {}
    }
    setIsMusicPlaying(false);
    setSelectedMusic(null);
    setSelectedMusicMeta(null);
    setMusicDuration(0);
    setMusicTrimStart(0);
    setMusicTrimEnd(0);
    setMusicArmed(false);
    setCaptureMode('photo');
  }, []);

  const armSelectedMusic = useCallback(() => {
    if (!selectedMusic) return;
    setMusicArmed(true);
    setCaptureMode('video');
  }, [selectedMusic]);

  const setTrimFromClientX = useCallback((clientX: number, which: 'start' | 'end') => {
    if (!musicTrimBarRef.current || !Number.isFinite(musicDuration) || musicDuration <= 0) return;
    const rect = musicTrimBarRef.current.getBoundingClientRect();
    const pct = (clientX - rect.left) / rect.width;
    const t = Math.max(0, Math.min(musicDuration, pct * musicDuration));
    if (which === 'start') {
      setMusicTrimStart(Math.min(t, musicTrimEnd));
    } else {
      setMusicTrimEnd(Math.max(t, musicTrimStart));
    }
  }, [musicDuration, musicTrimEnd, musicTrimStart]);

  useEffect(() => {
    const handleMove = (e: PointerEvent) => {
      const which = musicTrimDraggingRef.current;
      if (!which) return;
      setTrimFromClientX(e.clientX, which);
    };
    const handleUp = () => {
      musicTrimDraggingRef.current = null;
    };
    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
    window.addEventListener('pointercancel', handleUp);
    return () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
      window.removeEventListener('pointercancel', handleUp);
    };
  }, [setTrimFromClientX]);

  const prepareMusicFromFile = useCallback((file: File, meta?: SelectedMusic | null) => {
    try {
      clearTimeout(musicStopTimerRef.current);
      if (musicAudioRef.current) {
        try {
          musicAudioRef.current.pause();
        } catch {}
      }

      const url = URL.createObjectURL(file);
      setSelectedMusic({ file, name: meta?.audio_title || file.name, url });
      setSelectedMusicMeta(meta || null);
      setIsMusicPlaying(false);

      const a = new Audio(url);
      a.preload = 'metadata';
      a.loop = false;
      a.volume = 0.3;
      a.crossOrigin = 'anonymous';
      musicAudioRef.current = a;
      a.onloadedmetadata = () => {
        const d = Number.isFinite(a.duration) ? a.duration : 0;
        setMusicDuration(d);
        setMusicTrimStart(0);
        setMusicTrimEnd(Math.min(15, d || 0));
      };
      setMusicArmed(true);
      setCaptureMode('video');
    } catch {
      // ignore
    }
  }, []);

  const handlePickMusic = useCallback(async (m: SelectedMusic) => {
    try {
      const res = await fetch(m.audio_url);
      if (!res.ok) throw new Error('audio fetch failed');
      const blob = await res.blob();
      const ext = blob.type?.includes('mpeg') ? 'mp3' : blob.type?.includes('wav') ? 'wav' : 'mp3';
      const file = new File([blob], `music-${Date.now()}.${ext}`, { type: blob.type || 'audio/mpeg' });
      prepareMusicFromFile(file, m);
      setShowMusicPicker(false);
    } catch (e) {
      console.error('Music select error', e);
    }
  }, [prepareMusicFromFile]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (isRecording) setDragStartY(e.touches[0].clientY);
  }, [isRecording]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (isRecording && dragStartY !== null) {
      const delta = (dragStartY - e.touches[0].clientY) / 100;
      setZoom(z => Math.max(1, Math.min(5, z + delta)));
      setDragStartY(e.touches[0].clientY);
    }
  }, [isRecording, dragStartY]);

  const handleTouchEnd = useCallback(() => setDragStartY(null), []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    const remaining = maxItems - items.length;

    Array.from(files).slice(0, remaining).forEach((file, i) => {
      const isVideo = file.type.startsWith('video/');
      const url = URL.createObjectURL(file);
      addMediaItem({
        id: `${Date.now()}-${i}`,
        type: isVideo ? 'video' : 'photo',
        file,
        url,
      });
    });

    e.target.value = '';
  }, [addMediaItem, items.length, maxItems]);

  const addText = useCallback(() => {
    if (!textValue.trim() || !active) return;
    updateActive({
      texts: [
        ...active.texts,
        {
          id: crypto.randomUUID(),
          content: textValue,
          x: 50,
          y: 50,
          scale: 1,
          rotation: 0,
          fontSize: 22,
          isEmoji: false,
        },
      ],
    });
    setTextValue('');
    setShowTextInput(false);
  }, [active, textValue, updateActive]);

  const addEmoji = useCallback((emoji: string) => {
    if (!active) return;
    updateActive({
      texts: [
        ...active.texts,
        {
          id: crypto.randomUUID(),
          content: emoji,
          x: 50,
          y: 35,
          scale: 1,
          rotation: 0,
          fontSize: 40,
          isEmoji: true,
        },
      ],
    });
    setShowEmojiPicker(false);
  }, [active, updateActive]);

  const handleStickerFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      e.target.value = '';
      return;
    }
    const url = URL.createObjectURL(file);
    const sticker: ImageSticker = {
      id: crypto.randomUUID(),
      file,
      url,
      x: 50,
      y: 55,
      scale: 1,
      rotation: 0,
    };
    updateActive({ images: [...(active?.images || []), sticker] });
    e.target.value = '';
  }, [active?.images, updateActive]);

  const removeSticker = useCallback((stickerId: string) => {
    if (!active) return;
    const found = active.images.find(x => x.id === stickerId);
    if (found) URL.revokeObjectURL(found.url);
    updateActive({ images: active.images.filter(x => x.id !== stickerId) });
  }, [active, updateActive]);

  const togglePlay = useCallback(() => {
    const v = previewVideoRef.current;
    if (!v) return;
    if (v.paused) {
      v.play();
      setIsPlaying(true);
    } else {
      v.pause();
      setIsPlaying(false);
    }
  }, []);

  useEffect(() => {
    setIsPlaying(false);
  }, [activeIndex]);

  const handleSwipeStart = useCallback((e: React.TouchEvent) => {
    swipeStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  }, []);

  const handleSwipeEnd = useCallback((e: React.TouchEvent) => {
    if (!active) return;
    const dx = e.changedTouches[0].clientX - swipeStartRef.current.x;
    const dy = e.changedTouches[0].clientY - swipeStartRef.current.y;

    // Swipe down on focused media => back to camera
    if (dy > 55 && Math.abs(dy) > Math.abs(dx)) {
      setFocusedMediaId(null);
      setShowEmojiPicker(false);
      setShowTextInput(false);
      return;
    }

    // Horizontal swipe (dominant) => change filter
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) {
      const idx = MEDIA_FILTERS.findIndex(f => f.name === active.filter);
      const next = dx < 0
        ? Math.min(MEDIA_FILTERS.length - 1, idx + 1)
        : Math.max(0, idx - 1);

      if (next !== idx) {
        const f = MEDIA_FILTERS[next];
        updateActive({ filter: f.name });
        setFilterNameText(f.label);
        setFilterNameVisible(true);
        clearTimeout(filterTimerRef.current);
        filterTimerRef.current = window.setTimeout(() => setFilterNameVisible(false), 600);
      }
    }
  }, [active, updateActive]);

  const handleEditTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2 && containerRef.current && active) {
      e.preventDefault();
      e.stopPropagation();
      isPinchingMediaRef.current = true;

      const t1 = e.touches[0];
      const t2 = e.touches[1];
      const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
      const angle = Math.atan2(t2.clientY - t1.clientY, t2.clientX - t1.clientX) * (180 / Math.PI);
      const midX = (t1.clientX + t2.clientX) / 2;
      const midY = (t1.clientY + t2.clientY) / 2;

      mediaPinchRef.current = {
        dist,
        angle,
        midX,
        midY,
        x: active.mediaTransform.x,
        y: active.mediaTransform.y,
        scale: active.mediaTransform.scale,
        rotation: active.mediaTransform.rotation,
      };
      return;
    }

    if (e.touches.length === 1 && !isPinchingMediaRef.current) {
      handleSwipeStart(e);
    }
  }, [active, handleSwipeStart]);

  const handleEditTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isPinchingMediaRef.current || e.touches.length !== 2 || !mediaPinchRef.current || !containerRef.current || !active) return;

    e.preventDefault();
    e.stopPropagation();

    const rect = containerRef.current.getBoundingClientRect();
    const t1 = e.touches[0];
    const t2 = e.touches[1];
    const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
    const angle = Math.atan2(t2.clientY - t1.clientY, t2.clientX - t1.clientX) * (180 / Math.PI);
    const midX = (t1.clientX + t2.clientX) / 2;
    const midY = (t1.clientY + t2.clientY) / 2;

    const start = mediaPinchRef.current;
    const scale = Math.max(0.5, Math.min(5, start.scale * (dist / start.dist)));
    const rotation = start.rotation + (angle - start.angle);

    const dxPercent = ((midX - start.midX) / rect.width) * 100;
    const dyPercent = ((midY - start.midY) / rect.height) * 100;
    const x = Math.max(-50, Math.min(50, start.x + dxPercent));
    const y = Math.max(-50, Math.min(50, start.y + dyPercent));

    updateActive({ mediaTransform: { x, y, scale, rotation } });
  }, [active, updateActive]);

  const handleEditTouchEnd = useCallback((e: React.TouchEvent) => {
    if (isPinchingMediaRef.current) {
      if (e.touches.length < 2) {
        isPinchingMediaRef.current = false;
        mediaPinchRef.current = null;
      }
      return;
    }
    handleSwipeEnd(e);
  }, [handleSwipeEnd]);

  const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

  const drawCover = (
    ctx: CanvasRenderingContext2D,
    srcW: number,
    srcH: number,
    dstW: number,
    dstH: number
  ) => {
    const srcRatio = srcW / srcH;
    const dstRatio = dstW / dstH;
    let sx = 0, sy = 0, sw = srcW, sh = srcH;
    if (srcRatio > dstRatio) {
      // source wider
      sh = srcH;
      sw = sh * dstRatio;
      sx = (srcW - sw) / 2;
    } else {
      // source taller
      sw = srcW;
      sh = sw / dstRatio;
      sy = (srcH - sh) / 2;
    }
    ctx.drawImage((ctx as any).__srcEl, sx, sy, sw, sh, 0, 0, dstW, dstH);
  };

  const renderFrame = async (
    ctx: CanvasRenderingContext2D,
    baseEl: HTMLImageElement | HTMLVideoElement,
    editable: EditableItem,
    stickerBitmaps: Map<string, ImageBitmap>
  ) => {
    const w = ctx.canvas.width;
    const h = ctx.canvas.height;

    // @ts-expect-error internal helper
    ctx.__srcEl = baseEl;

    ctx.clearRect(0, 0, w, h);

    // Media with transform + filter
    ctx.save();
    ctx.translate(w / 2, h / 2);
    ctx.translate((editable.mediaTransform.x / 100) * w, (editable.mediaTransform.y / 100) * h);
    ctx.rotate((editable.mediaTransform.rotation * Math.PI) / 180);
    ctx.scale(editable.mediaTransform.scale, editable.mediaTransform.scale);

    const filterCss = (MEDIA_FILTERS.find((f) => f.name === editable.filter) || MEDIA_FILTERS[0])?.css || 'none';
    ctx.filter = filterCss;
    // cover draw into centered coordinate space
    const srcW = (baseEl as any).videoWidth || (baseEl as any).naturalWidth || w;
    const srcH = (baseEl as any).videoHeight || (baseEl as any).naturalHeight || h;
    const dstW = w;
    const dstH = h;
    ctx.translate(-dstW / 2, -dstH / 2);
    drawCover(ctx, srcW, srcH, dstW, dstH);
    ctx.restore();

    // Overlays
    const shadow = (color: string) => {
      ctx.shadowColor = color;
      ctx.shadowBlur = 10;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 2;
    };

    for (const t of editable.texts) {
      ctx.save();
      const x = (t.x / 100) * w;
      const y = (t.y / 100) * h;
      ctx.translate(x, y);
      ctx.rotate((t.rotation * Math.PI) / 180);
      ctx.scale(t.scale, t.scale);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#FFFFFF';
      shadow('rgba(0,0,0,0.8)');
      const fontSize = clamp(t.fontSize, 10, 120);
      ctx.font = `800 ${fontSize}px system-ui, -apple-system, Segoe UI, Roboto, Arial`;
      ctx.fillText(t.content, 0, 0);
      ctx.restore();
    }

    for (const img of editable.images) {
      const bmp = stickerBitmaps.get(img.id);
      if (!bmp) continue;
      ctx.save();
      const x = (img.x / 100) * w;
      const y = (img.y / 100) * h;
      ctx.translate(x, y);
      ctx.rotate((img.rotation * Math.PI) / 180);
      ctx.scale(img.scale, img.scale);
      shadow('rgba(0,0,0,0.55)');
      const baseW = Math.min(w * 0.28, 320);
      const ratio = bmp.height ? bmp.width / bmp.height : 1;
      const drawW = baseW;
      const drawH = baseW / ratio;
      ctx.drawImage(bmp, -drawW / 2, -drawH / 2, drawW, drawH);
      ctx.restore();
    }
  };

  const exportPhoto = useCallback(async (editable: EditableItem): Promise<File> => {
    const isGif =
      editable.media.file?.type === 'image/gif' ||
      (editable.media.file?.name || '').toLowerCase().endsWith('.gif');
    if (isGif) {
      return editable.media.file;
    }

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = editable.media.url;
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('image load error'));
    });

    const c = document.createElement('canvas');
    const srcW = img.naturalWidth || 1080;
    const srcH = img.naturalHeight || 1920;
    c.width = srcW;
    c.height = srcH;
    const ctx = c.getContext('2d');
    if (!ctx) return editable.media.file;

    const stickerBitmaps = new Map<string, ImageBitmap>();
    for (const s of editable.images) {
      try {
        const bmp = await createImageBitmap(await (await fetch(s.url)).blob());
        stickerBitmaps.set(s.id, bmp);
      } catch {
        // ignore
      }
    }

    await renderFrame(ctx, img, editable, stickerBitmaps);

    const blob = await new Promise<Blob>((resolve, reject) => {
      c.toBlob(
        (b) => (b ? resolve(b) : reject(new Error('toBlob failed'))),
        'image/jpeg',
        0.92
      );
    });

    return new File([blob], `edited-${Date.now()}.jpg`, { type: 'image/jpeg' });
  }, []);

  const exportVideo = useCallback(async (editable: EditableItem): Promise<File> => {
    const offscreenVideo = document.createElement('video');
    offscreenVideo.src = editable.media.url;
    offscreenVideo.crossOrigin = 'anonymous';
    (offscreenVideo as any).playsInline = true;
    offscreenVideo.preload = 'auto';
    offscreenVideo.muted = false;
    offscreenVideo.volume = 0;

    await new Promise<void>((resolve, reject) => {
      const onLoaded = () => resolve();
      const onErr = () => reject(new Error('video load error'));
      offscreenVideo.addEventListener('loadedmetadata', onLoaded, { once: true });
      offscreenVideo.addEventListener('error', onErr, { once: true });
      try { offscreenVideo.load(); } catch {}
    });

    const w = offscreenVideo.videoWidth || 720;
    const h = offscreenVideo.videoHeight || 1280;

    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const ctx = c.getContext('2d');
    if (!ctx) return editable.media.file;

    const stickerBitmaps = new Map<string, ImageBitmap>();
    for (const s of editable.images) {
      try {
        const bmp = await createImageBitmap(await (await fetch(s.url)).blob());
        stickerBitmaps.set(s.id, bmp);
      } catch {
        // ignore
      }
    }

    const canvasStream = (c as any).captureStream?.(30) as MediaStream;
    const videoTrack = canvasStream?.getVideoTracks?.()[0];

    let mixedStream: MediaStream;
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const dest = audioCtx.createMediaStreamDestination();
      const srcNode = audioCtx.createMediaElementSource(offscreenVideo);
      const gain = audioCtx.createGain();
      gain.gain.value = 1;
      srcNode.connect(gain);
      gain.connect(dest);
      mixedStream = new MediaStream([
        ...(videoTrack ? [videoTrack] : []),
        ...dest.stream.getAudioTracks(),
      ]);
    } catch {
      mixedStream = new MediaStream([...(videoTrack ? [videoTrack] : [])]);
    }

    const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')
      ? 'video/webm;codecs=vp9,opus'
      : (MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus') ? 'video/webm;codecs=vp8,opus' : 'video/webm');

    const recorder = new MediaRecorder(mixedStream, { mimeType });
    const chunks: Blob[] = [];
    recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };

    const done = new Promise<Blob>((resolve) => {
      recorder.onstop = () => resolve(new Blob(chunks, { type: 'video/webm' }));
    });

    recorder.start(250);
    try {
      await offscreenVideo.play();
    } catch {
      // If autoplay blocked, still try to export first frame
    }

    let raf = 0;
    const draw = async () => {
      await renderFrame(ctx, offscreenVideo, editable, stickerBitmaps);
      if (offscreenVideo.ended) return;
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);

    await new Promise<void>((resolve) => {
      const finish = () => resolve();
      offscreenVideo.addEventListener('ended', finish, { once: true });
      offscreenVideo.addEventListener('pause', () => {
        if (offscreenVideo.ended) finish();
      }, { once: true });
    });

    cancelAnimationFrame(raf);
    recorder.stop();
    const blob = await done;

    return new File([blob], `edited-${Date.now()}.webm`, { type: 'video/webm' });
  }, []);

  const handleNext = useCallback(async () => {
    if (items.length === 0 || isExporting) return;
    setIsExporting(true);
    try {
      const edited = [] as { file: File; filter: string }[];
      for (const it of items) {
        if (it.media.type === 'photo') {
          const f = await exportPhoto(it);
          edited.push({ file: f, filter: 'original' });
          continue;
        }

        const hasEdits = it.filter !== 'original' || it.texts.length > 0 || it.images.length > 0 ||
          it.mediaTransform.x !== 0 || it.mediaTransform.y !== 0 || it.mediaTransform.scale !== 1 || it.mediaTransform.rotation !== 0;

        if (!hasEdits) {
          edited.push({ file: it.media.file, filter: it.filter });
          continue;
        }

        const f = await exportVideo(it);
        edited.push({ file: f, filter: 'original' });
      }
      onNext(edited);
    } finally {
      setIsExporting(false);
    }
  }, [exportPhoto, exportVideo, isExporting, items, onNext]);

  const toggleMusicPlayback = useCallback(() => {
    if (!musicAudioRef.current || !selectedMusic) return;
    
    if (isMusicPlaying) {
      musicAudioRef.current.pause();
      setIsMusicPlaying(false);
      clearTimeout(musicStopTimerRef.current);
    } else {
      clearTimeout(musicStopTimerRef.current);
      try {
        musicAudioRef.current.currentTime = Math.min(Math.max(0, musicTrimStart), Math.max(0, (musicTrimEnd || 0) - 0.05));
      } catch {}
      musicAudioRef.current.play();
      setIsMusicPlaying(true);

      const segmentDuration = Math.max(0, (musicTrimEnd || 0) - (musicTrimStart || 0));
      if (segmentDuration > 0) {
        musicStopTimerRef.current = window.setTimeout(() => {
          if (musicAudioRef.current) musicAudioRef.current.pause();
          setIsMusicPlaying(false);
        }, Math.round(segmentDuration * 1000));
      }
    }
  }, [isMusicPlaying, musicTrimEnd, musicTrimStart, selectedMusic]);

  const setupAudioMixing = useCallback(async () => {
    if (!selectedMusic || !streamRef.current) return null;
    
    try {
      // Create audio context
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      const audioContext = audioContextRef.current;
      
      // Create music audio element
      const musicAudio = new Audio(selectedMusic.url);
      musicAudio.loop = false;
      musicAudio.volume = 0.3; // 30% volume
      musicAudio.preload = 'auto';
      musicAudioRef.current = musicAudio;

      musicAudio.onloadedmetadata = () => {
        const d = Number.isFinite(musicAudio.duration) ? musicAudio.duration : 0;
        setMusicDuration(d);
        setMusicTrimStart((s) => Math.min(s, d));
        setMusicTrimEnd((e) => Math.min(e || Math.min(15, d), d));
      };
      
      // Create destination for mixed audio
      const destination = audioContext.createMediaStreamDestination();
      
      // Add camera audio to destination
      if (streamRef.current.getAudioTracks().length > 0) {
        const source = audioContext.createMediaStreamSource(streamRef.current);
        source.connect(destination);
      }
      
      // Add music to destination
      const musicSource = audioContext.createMediaElementSource(musicAudio);
      const gainNode = audioContext.createGain();
      gainNode.gain.value = 0.3;
      musicSource.connect(gainNode);
      gainNode.connect(destination);
      
      return destination.stream;
    } catch (error) {
      console.error('Error setting up audio mixing:', error);
      return null;
    }
  }, [selectedMusic]);

  useEffect(() => {
    setupAudioMixingRef.current = setupAudioMixing;
  }, [setupAudioMixing]);

  const showTopStrip = items.length > 0;
  const isVideo = active?.media.type === 'video';
  const isFocused = !!focusedMediaId && active?.media.id === focusedMediaId;
  const showCaptureUi = !isFocused && !trayOpen;
  const canAddMore = items.length < maxItems;
  const lastThree = useMemo(() => items.slice(-3), [items]);
  const trayPeekHeight = '5.25rem';

  const handleSelectFromStrip = useCallback((idx: number) => {
    const it = items[idx];
    if (!it) return;
    setActiveIndex(idx);
    setTrayOpen(false);

    setFocusedMediaId((cur) => {
      if (cur === it.media.id) return null;
      return it.media.id;
    });
  }, [items]);

  const handleTrayTouchStart = useCallback((e: React.TouchEvent) => {
    trayStartYRef.current = e.touches[0].clientY;
  }, []);

  const handleTrayTouchEnd = useCallback((e: React.TouchEvent) => {
    if (trayStartYRef.current === null) return;
    const endY = e.changedTouches[0].clientY;
    const diff = endY - trayStartYRef.current;
    trayStartYRef.current = null;
    if (Math.abs(diff) < 35) return;
    // swipe up => open, swipe down => close
    if (diff < 0) {
      setTrayOpen(true);
    } else {
      setTrayOpen(false);
      // requirement: tray swipe down also returns to camera
      setFocusedMediaId(null);
      setShowEmojiPicker(false);
      setShowTextInput(false);
    }
  }, []);

  return (
    <div className="fixed inset-0 z-[60] bg-black flex flex-col overflow-hidden">
      <input ref={fileInputRef} type="file" accept="image/*,video/*" multiple onChange={handleFileSelect} className="hidden" />
      <input ref={stickerInputRef} type="file" accept="image/*" onChange={handleStickerFileSelect} className="hidden" />

      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-30 flex items-center justify-between px-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <button
          onClick={onClose}
          className="w-10 h-10 rounded-full glass-button flex items-center justify-center active:scale-90 transition-transform"
        >
          <X className="w-5 h-5 text-white" />
        </button>

        {items.length > 0 && (
          <button
            onClick={handleNext}
            disabled={isExporting}
            className={cn(
              "px-4 py-2 rounded-full bg-primary text-primary-foreground text-sm font-semibold flex items-center gap-1 active:scale-95 transition-transform",
              isExporting && 'opacity-60 pointer-events-none'
            )}
          >
            {isExporting ? 'Tayyorlanmoqda…' : 'Keyingi'}
            <ChevronRight className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Stage: Capture - camera always as base */}
      <div className="relative flex-1 min-h-0">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className={cn('absolute inset-0 w-full h-full object-cover')}
          style={{ transform: `scale(${zoom})`, transformOrigin: 'center' }}
        />
        <canvas ref={canvasRef} className="hidden" />

        {/* Flip camera */}
        {showCaptureUi && (
          <>
            {/* Music timeline (above zoom pills) */}
            {musicArmed && selectedMusic && musicDuration > 0 && (
              <div
                className="absolute left-4 right-4 z-50"
                style={{ bottom: `calc(${trayPeekHeight} + max(2.25rem, env(safe-area-inset-bottom)) + 7.35rem)` }}
              >
                <div className="flex items-center gap-2 px-3 py-2 rounded-2xl bg-black/55 backdrop-blur-xl border border-white/15">
                  <button
                    type="button"
                    onClick={toggleMusicPlayback}
                    className="w-7 h-7 rounded-full bg-white/10 border border-white/15 flex items-center justify-center active:scale-90 transition-transform flex-shrink-0"
                    aria-label={isMusicPlaying ? 'Pause music' : 'Play music'}
                  >
                    {isMusicPlaying ? (
                      <Pause className="w-3.5 h-3.5 text-white" />
                    ) : (
                      <Play className="w-3.5 h-3.5 text-white" />
                    )}
                  </button>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-white/80 text-[10px] font-semibold truncate">{selectedMusic.name}</span>
                      <span className="text-white/60 text-[10px] font-medium tabular-nums ml-2 flex-shrink-0">
                        {fmtTime(musicTrimStart)}-{fmtTime(musicTrimEnd)}
                      </span>
                    </div>

                    <div ref={musicTrimBarRef} className="relative h-5 touch-none">
                      <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-1 rounded-full bg-white/15" />
                      <div
                        className="absolute top-1/2 -translate-y-1/2 h-1 rounded-full bg-primary/70"
                        style={{
                          left: `${(musicTrimStart / musicDuration) * 100}%`,
                          right: `${100 - (musicTrimEnd / musicDuration) * 100}%`,
                        }}
                      />

                      <div
                        className="absolute z-10 top-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full bg-white shadow border border-white/30"
                        style={{ left: `calc(${(musicTrimStart / musicDuration) * 100}% - 7px)` }}
                        onPointerDown={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          try { (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId); } catch {}
                          musicTrimDraggingRef.current = 'start';
                          setTrimFromClientX(e.clientX, 'start');
                        }}
                      />
                      <div
                        className="absolute z-10 top-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full bg-white shadow border border-white/30"
                        style={{ left: `calc(${(musicTrimEnd / musicDuration) * 100}% - 7px)` }}
                        onPointerDown={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          try { (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId); } catch {}
                          musicTrimDraggingRef.current = 'end';
                          setTrimFromClientX(e.clientX, 'end');
                        }}
                      />

                      <div
                        className="absolute inset-0 z-0"
                        onPointerDown={(e) => {
                          e.preventDefault();
                          const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
                          const pct = (e.clientX - rect.left) / rect.width;
                          const t = Math.max(0, Math.min(musicDuration, pct * musicDuration));
                          const distStart = Math.abs(t - musicTrimStart);
                          const distEnd = Math.abs(t - musicTrimEnd);
                          const which: 'start' | 'end' = distStart <= distEnd ? 'start' : 'end';
                          try { (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId); } catch {}
                          musicTrimDraggingRef.current = which;
                          setTrimFromClientX(e.clientX, which);
                        }}
                      />
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={removeSelectedMusic}
                    className="w-7 h-7 rounded-full bg-white/10 border border-white/15 flex items-center justify-center active:scale-90 transition-transform flex-shrink-0"
                    aria-label="Remove music"
                  >
                    <X className="w-3.5 h-3.5 text-white" />
                  </button>
                </div>
              </div>
            )}

            {/* Zoom pills (center, above shutter) */}
            <div
              className="absolute left-1/2 -translate-x-1/2 z-50 flex flex-col items-center gap-1"
              style={{ bottom: `calc(${trayPeekHeight} + max(2.25rem, env(safe-area-inset-bottom)) + 4.5rem)` }}
            >
              {captureMode === 'video' && (
                <div className="px-2.5 py-1 rounded-full bg-white/10 border border-white/15 pointer-events-none">
                  <span className="text-white/85 text-[10px] font-bold tracking-wide">VIDEO</span>
                </div>
              )}
              <div className="flex gap-0.5 p-0.5 rounded-full bg-white/10 backdrop-blur-sm">
                {[1, 2, 5].map((zl) => (
                  <button
                    key={zl}
                    onClick={() => setZoom(zl)}
                    className={cn(
                      'px-2.5 py-1 rounded-full text-[10px] font-bold transition-all',
                      Math.abs(zoom - zl) < 0.5 ? 'bg-white/25 text-white' : 'text-white/40'
                    )}
                  >
                    {zl}x
                  </button>
                ))}
              </div>
              <span className="text-white/50 text-[10px] font-medium">{items.length}/{maxItems}</span>
            </div>
          </>
        )}

        {/* Capture button */}
        {showCaptureUi && (
          <div
            className="absolute left-0 right-0 z-50 flex items-center justify-center"
            style={{ bottom: `calc(${trayPeekHeight} + max(0.75rem, env(safe-area-inset-bottom)))` }}
          >
            <button
              onClick={() => {
                if (captureMode === 'video') {
                  if (Date.now() - lastVideoToggleTouchAtRef.current < 700) return;
                  handleVideoToggleCapture();
                }
              }}
              onMouseDown={(e) => {
                if (captureMode === 'video') {
                  e.preventDefault();
                  return;
                }
                handleCaptureStart();
              }}
              onMouseUp={() => {
                if (captureMode === 'video') return;
                handleCaptureEnd();
              }}
              onMouseLeave={() => { if (captureMode !== 'video' && isCapturing) handleCaptureEnd(); }}
              onTouchStart={(e) => {
                if (captureMode === 'video') {
                  e.preventDefault();
                  lastVideoToggleTouchAtRef.current = Date.now();
                  handleVideoToggleCapture();
                  return;
                }
                handleCaptureStart();
                handleTouchStart(e);
              }}
              onTouchMove={(e) => {
                if (captureMode === 'video') return;
                handleTouchMove(e);
              }}
              onTouchEnd={() => {
                if (captureMode === 'video') {
                  handleTouchEnd();
                  return;
                }
                handleCaptureEnd();
                handleTouchEnd();
              }}
              disabled={!cameraReady || !canAddMore}
              className={cn(
                'relative w-[78px] h-[78px] rounded-full flex items-center justify-center disabled:opacity-30',
                isCapturing ? 'scale-[0.98]' : 'scale-100'
              )}
            >
              <div
                className={cn(
                  'absolute inset-0 rounded-full p-[3px] shutter-neon-rotate',
                  "bg-[conic-gradient(from_180deg_at_50%_50%,#00F5FF_0deg,#7C3AED_90deg,#FF2BD6_180deg,#00F5FF_360deg)]",
                  'shadow-[0_0_14px_rgba(0,245,255,0.22),0_0_16px_rgba(255,43,214,0.12)]'
                )}
              >
                <div className="relative w-full h-full rounded-full bg-black/30 backdrop-blur-sm border border-white/20 overflow-hidden">
                  <div
                    className={cn(
                      'absolute inset-0 rounded-full opacity-55 mix-blend-screen',
                      "bg-[repeating-conic-gradient(from_200deg,rgba(255,255,255,0.0)_0deg,rgba(255,255,255,0.0)_10deg,rgba(255,255,255,0.35)_14deg,rgba(255,255,255,0.0)_18deg)]"
                    )}
                    style={{
                      WebkitMaskImage: 'radial-gradient(circle at 50% 50%, transparent 0 52%, #000 56% 100%)',
                      maskImage: 'radial-gradient(circle at 50% 50%, transparent 0 52%, #000 56% 100%)',
                    }}
                  />

                  <span className="shutter-spark" style={{ top: '10%', left: '72%', animationDelay: '0ms' }} />
                  <span className="shutter-spark" style={{ top: '62%', left: '14%', animationDelay: '120ms' }} />
                  <span className="shutter-spark" style={{ top: '78%', left: '70%', animationDelay: '220ms' }} />
                </div>
              </div>

              <div
                className={cn(
                  'relative transition-all duration-200',
                  isCapturing ? 'scale-[0.84]' : 'scale-100',
                  isRecording ? 'w-8 h-8 rounded-lg bg-red-500' : 'w-[58px] h-[58px] rounded-full bg-white'
                )}
              >
                {isRecording && <div className="absolute inset-0 rounded-lg animate-pulse bg-red-400" />}
              </div>

              {isRecording && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 pointer-events-none">
                  <Lock className="w-4 h-4 text-white/95" />
                  <span className="text-[10px] font-semibold text-white/90 tabular-nums">
                    {Math.floor(recordingTime / 60)}:{(recordingTime % 60).toString().padStart(2, '0')}
                  </span>
                </div>
              )}
            </button>
          </div>
        )}

        {/* Recording badge with music info */}
        {showCaptureUi && isRecording && (
          <>
            <div className="absolute top-3 left-1/2 -translate-x-1/2 z-30 flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-500/90 backdrop-blur-sm">
              <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
              <span className="text-white text-[11px] font-medium">{Math.floor(recordingTime / 60)}:{(recordingTime % 60).toString().padStart(2, '0')}</span>
            </div>
            
            {/* Music info overlay */}
            {selectedMusic && (
              <div className="absolute bottom-20 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 px-3 py-2 rounded-full bg-black/70 backdrop-blur-xl border border-white/20">
                <Disc className="w-4 h-4 text-primary" />
                <span className="text-white text-xs font-medium truncate max-w-[120px]">{selectedMusic.name}</span>
                <button
                  onClick={toggleMusicPlayback}
                  className="w-6 h-6 rounded-full glass-button flex items-center justify-center active:scale-90 transition-transform"
                >
                  {isMusicPlaying ? (
                    <Pause className="w-3 h-3 text-white" />
                  ) : (
                    <Play className="w-3 h-3 text-white" />
                  )}
                </button>
              </div>
            )}
          </>
        )}

        {/* Selected strip (top) */}
        {showTopStrip && (
          <div className="absolute left-2 right-2 z-20" style={{ top: 'max(3.75rem, calc(env(safe-area-inset-top) + 2.75rem))' }}>
            <div className="flex gap-1.5 p-1.5 rounded-2xl bg-black/50 backdrop-blur-xl overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
              {items.map((it, idx) => (
                <div
                  key={it.media.id}
                  draggable
                  onDragStart={(e) => e.dataTransfer.setData('idx', idx.toString())}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => { e.preventDefault(); moveMedia(parseInt(e.dataTransfer.getData('idx')), idx); }}
                  className={cn('relative flex-shrink-0', idx === activeIndex ? 'opacity-100' : 'opacity-70')}
                  onClick={() => handleSelectFromStrip(idx)}
                >
                  <div className="w-14 h-14 rounded-lg overflow-hidden border border-white/15">
                    {it.media.type === 'photo' ? (
                      <img src={it.media.url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="relative w-full h-full">
                        <img src={it.media.thumbnail || it.media.url} alt="" className="w-full h-full object-cover" />
                        <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                          <Play className="w-4 h-4 text-white fill-white" />
                        </div>
                      </div>
                    )}
                  </div>

                  {focusedMediaId === it.media.id && (
                    <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none">
                      <div className="w-8 h-8 rounded-full bg-black/35 backdrop-blur-xl border border-white/25 flex items-center justify-center shadow-lg">
                        <Camera className="w-4 h-4 text-white" />
                      </div>
                    </div>
                  )}

                  <button
                    onClick={(e) => { e.stopPropagation(); removeMedia(it.media.id); }}
                    className="absolute -top-1 -right-1 w-4.5 h-4.5 rounded-full bg-destructive flex items-center justify-center shadow"
                  >
                    <X className="w-2.5 h-2.5 text-destructive-foreground" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Focused preview layer (edit mode) */}
        {isFocused && active && (
          <div className="absolute inset-0 z-10 bg-gradient-to-br from-slate-900/70 via-purple-900/55 to-slate-900/70 flex flex-col">
            <div className="flex-1 relative overflow-hidden flex items-center justify-center px-1 pt-14">
              <div
                ref={containerRef}
                className="relative w-full max-w-md aspect-[9/16] max-h-[calc(100vh-260px)] rounded-2xl overflow-hidden border border-white/20 shadow-2xl"
                onTouchStart={handleEditTouchStart}
                onTouchMove={handleEditTouchMove}
                onTouchEnd={handleEditTouchEnd}
              >
                <div
                  className="absolute inset-0 will-change-transform"
                  style={{
                    transform: `translate(${active.mediaTransform.x}%, ${active.mediaTransform.y}%) scale(${active.mediaTransform.scale}) rotate(${active.mediaTransform.rotation}deg)`,
                    transformOrigin: 'center',
                    touchAction: 'none',
                  }}
                >
                  {isVideo ? (
                    <video
                      ref={previewVideoRef}
                      src={active.media.url}
                      className="w-full h-full object-cover"
                      style={{ filter: currentFilter.css }}
                      playsInline
                      loop
                      muted={isMuted}
                      onClick={togglePlay}
                    />
                  ) : (
                    <img
                      src={active.media.url}
                      alt="Edit"
                      className="w-full h-full object-cover"
                      style={{ filter: currentFilter.css }}
                      draggable={false}
                    />
                  )}
                </div>

                {active.texts.map(t => (
                  <TextOverlay
                    key={t.id}
                    item={t}
                    containerRef={containerRef as React.RefObject<HTMLDivElement>}
                    onUpdate={(updated) => updateActive({ texts: active.texts.map(x => (x.id === updated.id ? updated : x)) })}
                    onDelete={(id) => updateActive({ texts: active.texts.filter(x => x.id !== id) })}
                  />
                ))}

                {active.images.map(img => (
                  <ImageOverlay
                    key={img.id}
                    item={img}
                    containerRef={containerRef as React.RefObject<HTMLDivElement>}
                    onUpdate={(updated) => updateActive({ images: active.images.map(x => (x.id === updated.id ? updated : x)) })}
                    onDelete={(id) => removeSticker(id)}
                  />
                ))}

                {filterNameVisible && (
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-40 pointer-events-none">
                    <div className="px-5 py-2.5 rounded-2xl bg-black/50 backdrop-blur-xl border border-white/20">
                      <span className="text-white font-bold text-xl">{filterNameText}</span>
                    </div>
                  </div>
                )}

                {isVideo && (
                  <button onClick={togglePlay} className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-30">
                    <div className="w-14 h-14 rounded-full bg-black/30 backdrop-blur-xl border border-white/25 flex items-center justify-center">
                      {isPlaying ? (
                        <Pause className="w-6 h-6 text-white" />
                      ) : (
                        <Play className="w-6 h-6 text-white fill-white ml-0.5" />
                      )}
                    </div>
                  </button>
                )}
              </div>

              {/* Edit tools */}
              <div className="absolute right-2 top-1/2 -translate-y-1/2 flex flex-col gap-3">
                <button
                  onClick={() => {
                    setShowEmojiPicker(!showEmojiPicker);
                    setShowTextInput(false);
                  }}
                  className="flex flex-col items-center gap-0.5"
                >
                  <div className="w-11 h-11 rounded-xl bg-black/40 backdrop-blur-xl border border-white/20 flex items-center justify-center text-white shadow-lg">
                    <Smile className="w-5 h-5" />
                  </div>
                  <span className="text-[9px] text-white/70 font-medium">Stiker</span>
                </button>

                <button
                  onClick={() => {
                    stickerInputRef.current?.click();
                    setShowEmojiPicker(false);
                    setShowTextInput(false);
                  }}
                  className="flex flex-col items-center gap-0.5"
                >
                  <div className="w-11 h-11 rounded-xl bg-black/40 backdrop-blur-xl border border-white/20 flex items-center justify-center text-white shadow-lg">
                    <ImagePlus className="w-5 h-5" />
                  </div>
                  <span className="text-[9px] text-white/70 font-medium">Rasm</span>
                </button>

                <button
                  onClick={() => {
                    setShowTextInput(true);
                    setShowEmojiPicker(false);
                  }}
                  className="flex flex-col items-center gap-0.5"
                >
                  <div className="w-11 h-11 rounded-xl bg-black/40 backdrop-blur-xl border border-white/20 flex items-center justify-center text-white shadow-lg">
                    <Type className="w-5 h-5" />
                  </div>
                  <span className="text-[9px] text-white/70 font-medium">Matn</span>
                </button>

                {isVideo && (
                  <button
                    onClick={() => {
                      const nextMuted = !isMuted;
                      setIsMuted(nextMuted);
                      if (previewVideoRef.current) previewVideoRef.current.muted = nextMuted;
                    }}
                    className="flex flex-col items-center gap-0.5"
                  >
                    <div className="w-11 h-11 rounded-xl bg-black/40 backdrop-blur-xl border border-white/20 flex items-center justify-center text-white shadow-lg">
                      {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                    </div>
                    <span className="text-[9px] text-white/70 font-medium">Ovoz</span>
                  </button>
                )}
              </div>

              {showEmojiPicker && (
                <div className="absolute bottom-24 right-2 bg-black/60 backdrop-blur-xl border border-white/20 rounded-2xl p-3 grid grid-cols-6 gap-2 max-w-[260px] z-50">
                  {EMOJIS.map(emoji => (
                    <button key={emoji} onClick={() => addEmoji(emoji)} className="text-2xl p-1 rounded-lg hover:bg-white/10 transition-colors">
                      {emoji}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="flex-shrink-0 pb-4">
              <FilterStrip selectedFilter={active.filter} onSelectFilter={(f) => updateActive({ filter: f })} />
              {active.images.length > 0 && (
                <div className="px-3 pt-2">
                  <div className="flex gap-2 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
                    {active.images.map((img) => (
                      <button
                        key={img.id}
                        onClick={() => removeSticker(img.id)}
                        className="relative flex-shrink-0 w-14 h-14 rounded-xl overflow-hidden border border-white/15 bg-black/30"
                        title="Remove"
                      >
                        <img src={img.url} alt="" className="w-full h-full object-cover" />
                        <div className="absolute top-1 right-1 w-4 h-4 rounded-full bg-black/60 flex items-center justify-center">
                          <X className="w-3 h-3 text-white" />
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {showTextInput && (
              <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-6">
                <div className="bg-black/70 backdrop-blur-xl border border-white/20 rounded-2xl p-5 w-full max-w-sm space-y-4">
                  <h3 className="font-semibold text-lg text-white">Matn qo'shish</h3>
                  <textarea
                    autoFocus
                    value={textValue}
                    onChange={(e) => setTextValue(e.target.value)}
                    placeholder="Matn, @mention, #hashtag..."
                    className="w-full h-24 p-3 bg-white/10 border border-white/20 rounded-xl text-sm text-white placeholder:text-white/30 resize-none focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                  <div className="flex gap-2 justify-end">
                    <button
                      onClick={() => {
                        setShowTextInput(false);
                        setTextValue('');
                      }}
                      className="px-4 py-2 rounded-xl bg-white/10 border border-white/20 text-sm text-white font-medium"
                    >
                      Bekor
                    </button>
                    <button
                      onClick={addText}
                      className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-semibold"
                    >
                      Qo'shish
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        <MusicPicker
          open={showMusicPicker}
          onOpenChange={setShowMusicPicker}
          onSelect={(m) => void handlePickMusic(m)}
          selectedMusic={selectedMusicMeta}
          onRemove={removeSelectedMusic}
        />

        {/* Bottom tray */}
        <div
          className={cn(
            'absolute left-0 right-0 z-40 transition-transform duration-250 pointer-events-none',
            trayOpen ? 'translate-y-0' : 'translate-y-[calc(100%_-_5.25rem)]'
          )}
          style={{ bottom: 0 }}
          onTouchStart={handleTrayTouchStart}
          onTouchEnd={handleTrayTouchEnd}
        >
          <div className="bg-black/70 backdrop-blur-xl border-t border-white/10 rounded-t-3xl overflow-hidden pointer-events-auto">
            <div className="flex items-center justify-center py-2">
              <div className="w-10 h-1 rounded-full bg-white/30" />
            </div>

            {/* Collapsed row: last 3 previews + gallery */}
            {!trayOpen && (
              <div className="px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
                <div className="grid grid-cols-4 gap-2 items-center">
                  {Array.from({ length: 3 }).map((_, i) => {
                    const it = lastThree[i];
                    if (!it) return <div key={`empty-${i}`} className="w-12 h-12" />;
                    const idx = items.length - lastThree.length + i;
                    return (
                      <button
                        key={it.media.id}
                        onClick={() => handleSelectFromStrip(idx)}
                        className={cn(
                          'w-12 h-12 rounded-xl overflow-hidden border-2',
                          idx === activeIndex ? 'border-primary' : 'border-white/15'
                        )}
                      >
                        <img src={it.media.thumbnail || it.media.url} alt="" className="w-full h-full object-cover" />
                      </button>
                    );
                  })}
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={!canAddMore}
                    className="w-12 h-12 rounded-xl bg-white/10 backdrop-blur-sm flex items-center justify-center disabled:opacity-30 active:scale-90 transition-transform"
                  >
                    <ImageIcon className="w-5 h-5 text-white" />
                  </button>
                </div>
              </div>
            )}

            {/* Expanded: grid of selected items */}
            {trayOpen && (
              <div className="px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-white/70 text-xs font-semibold">Tanlanganlar</span>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={!canAddMore}
                    className="text-white/80 text-xs font-semibold px-3 py-2 rounded-full bg-white/10 border border-white/15 disabled:opacity-30"
                  >
                    Galereya
                  </button>
                </div>

                <div className="grid grid-cols-3 gap-2 max-h-[52vh] overflow-y-auto">
                  {items.map((it, idx) => (
                    <button
                      key={it.media.id}
                      onClick={() => {
                        setTrayOpen(false);
                        setActiveIndex(idx);
                        setFocusedMediaId(it.media.id);
                      }}
                      className={cn(
                        'relative aspect-square rounded-xl overflow-hidden border-2',
                        idx === activeIndex ? 'border-primary' : 'border-white/15'
                      )}
                    >
                      <img src={it.media.thumbnail || it.media.url} alt="" className="w-full h-full object-cover" />
                      {it.media.type === 'video' && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                          <Play className="w-5 h-5 text-white fill-white" />
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Music & Camera switch buttons — rendered AFTER tray so z-50 beats tray's z-40 */}
        {showCaptureUi && (
          <>
            <button
              type="button"
              onClick={() => setShowMusicPicker(true)}
              className={cn(
                "absolute left-8 z-50 w-12 h-12 rounded-full glass-button flex items-center justify-center active:scale-90 transition-transform group",
                selectedMusic ? 'ring-2 ring-primary/30' : ''
              )}
              aria-label="Music"
              style={{ bottom: `calc(${trayPeekHeight} + max(1.5rem, env(safe-area-inset-bottom)))` }}
            >
              <Music2 className="w-6 h-6 text-white animate-pulse-slow group-hover:animate-bounce-slow transition-all duration-500" />
              {selectedMusic && (
                <span className="absolute -top-1 -right-1 h-4 min-w-4 px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-extrabold flex items-center justify-center">
                  <Disc className="w-2.5 h-2.5" />
                </span>
              )}
            </button>

            <button
              onClick={() => setFacingMode(f => (f === 'environment' ? 'user' : 'environment'))}
              className="absolute right-8 z-50 w-12 h-12 rounded-full glass-button flex items-center justify-center active:scale-90 transition-transform group"
              aria-label="Switch camera"
              style={{ bottom: `calc(${trayPeekHeight} + max(1.5rem, env(safe-area-inset-bottom)))` }}
            >
              <RefreshCw className="w-6 h-6 text-white animate-spin-very-slow group-hover:animate-spin transition-all duration-500" />
            </button>
          </>
        )}
      </div>
    </div>
  );
}
