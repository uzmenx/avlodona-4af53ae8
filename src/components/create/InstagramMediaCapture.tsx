import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Camera, ChevronRight, Image as ImageIcon, Lock, Music2, Play, Pause, RefreshCw, Smile, Type, Volume2, VolumeX, X, Disc, ImagePlus, AlignLeft, Pen, Undo2, Redo2, Trash2, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Icon } from '@iconify/react';
import { Capacitor } from '@capacitor/core';
import { useGallery, type GalleryAsset } from '@/hooks/useGallery';
import { EMOJIS, MEDIA_FILTERS } from './filters';
import FilterStrip from './FilterStrip';
import { MusicPicker, type SelectedMusic } from './MusicPicker';
import TextOverlay, { TextItem, TextEditModal } from './TextOverlay';
import DrawingCanvas, { type DrawingCanvasHandle, type DrawStroke } from './DrawingCanvas';
import GiphyPicker, { type GiphyItem } from './GiphyPicker';
import { useOverlayGestures } from './useOverlayGestures';

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
  strokes: DrawStroke[];
  mediaTransform: {
    x: number;
    y: number;
    scale: number;
    rotation: number;
  };
  videoTrimStart?: number;
  videoTrimEnd?: number;
};

type ImageSticker = {
  id: string;
  file?: File;        // local file sticker (may be undefined for GIPHY)
  url: string;        // object URL or GIPHY URL
  originalUrl?: string; // GIPHY high-res URL
  isGif?: boolean;    // true = animated GIF/sticker from GIPHY
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
  isOverTrash,
  onDragStart,
  onDragEnd,
}: {
  item: ImageSticker;
  containerRef: React.RefObject<HTMLDivElement>;
  onUpdate: (item: ImageSticker) => void;
  onDelete: (id: string) => void;
  isOverTrash?: boolean;
  onDragStart?: () => void;
  onDragEnd?: () => void;
}) {
  const { isDragging, bindGestures } = useOverlayGestures({
    item,
    onUpdate,
    containerRef,
    snapAngles: true,
    onDragStart,
    onDragEnd,
  });

  return (
    <div
      {...bindGestures}
      data-oid={item.id}
      className="absolute select-none touch-none cursor-move group"
      style={{
        left: `${item.x}%`,
        top: `${item.y}%`,
        transform: `translate(-50%, -50%) scale(${item.scale}) rotate(${item.rotation}deg)`,
        zIndex: isDragging ? 50 : 35,
        transition: isOverTrash ? 'transform 0.15s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.15s' : undefined,
        opacity: isOverTrash ? 0.35 : 1,
      }}
    >
      <div 
        className="relative transition-transform duration-150"
        style={{
          transform: isOverTrash ? 'scale(0.5)' : 'scale(1)',
        }}
      >
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
  onNext: (
    items: { file: File; filter: string; gifOverlays?: ImageSticker[] }[],
    captionText?: string,
    music?: SelectedMusic | null,
  ) => void;
  maxItems?: number;
  memoryMemberId?: string | null;
}

export default function InstagramMediaCapture({ onClose, onNext, maxItems = 5, memoryMemberId }: InstagramMediaCaptureProps) {
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
  const itemsRef = useRef(items);
  useEffect(() => { itemsRef.current = items; }, [items]);
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
  const [showCaptionInput, setShowCaptionInput] = useState(false);
  const [postCaption, setPostCaption] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showMusicPicker, setShowMusicPicker] = useState(false);
  const [textValue, setTextValue] = useState('');
  const [showDrawing, setShowDrawing] = useState(false);
  const [showGiphyPicker, setShowGiphyPicker] = useState(false);
  const [showCreativeMenu, setShowCreativeMenu] = useState(false);
  const drawingCanvasRef = useRef<DrawingCanvasHandle>(null);
  const [isDraggingOverlay, setIsDraggingOverlay] = useState(false);
  const [isOverTrashId, setIsOverTrashId] = useState<string | null>(null);
  const [isNearTrash, setIsNearTrash] = useState(false);
  const trashRef = useRef<HTMLDivElement>(null);

  // Gallery State
  const { assets: galleryItems, isLoading: isGalleryLoading, loadMore } = useGallery();
  
  // Premium haptic feedback when entering trash boundary
  useEffect(() => {
    if (isOverTrashId && typeof navigator !== 'undefined' && navigator.vibrate) {
      try { navigator.vibrate(20); } catch {
        // Ignore vibration error
      }
    }
  }, [isOverTrashId]);

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
          stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode }, audio: true });
        } catch (e2) {
          try {
            stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
          } catch (e3) {
            stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
          }
        }
      }

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          setCameraReady(true);
        };
      } else {
        setCameraReady(true);
      }
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
    setItems(prev => [...prev, {
      media,
      filter: 'original',
      texts: [],
      images: [],
      strokes: [],
      mediaTransform: { x: 0, y: 0, scale: 1, rotation: 0 },
      videoTrimStart: undefined,
      videoTrimEnd: undefined,
    }]);
    
    setActiveIndex(itemsRef.current.length);
    setFocusedMediaId(media.id);
    setTrayOpen(false);
  }, []);

  const handleSelectGalleryItem = useCallback(async (asset: GalleryAsset) => {
    if (items.length >= maxItems) return;
    try {
      let url = asset.webUrl;
      if (!url) {
        if (asset.path) {
          url = Capacitor.convertFileSrc(asset.path);
        } else {
          return;
        }
      }

      const res = await fetch(url);
      const blob = await res.blob();
      const file = new File([blob], `gallery-${Date.now()}.jpg`, { type: blob.type || 'image/jpeg' });
      const objectUrl = URL.createObjectURL(blob);
      
      const isVideo = asset.mediaType === 'video' || blob.type.startsWith('video/');

      addMediaItem({ 
        id: crypto.randomUUID(), 
        type: isVideo ? 'video' : 'photo', 
        file, 
        url: objectUrl 
      });

    } catch (e) {
      console.error('Error loading gallery item:', e);
    }
  }, [addMediaItem, items.length, maxItems]);

  const removeMedia = useCallback((id: string) => {
    const currentItems = itemsRef.current;
    const idx = currentItems.findIndex(x => x.media.id === id);
    if (idx === -1) return;

    const found = currentItems[idx];
    if (found) {
      URL.revokeObjectURL(found.media.url);
      found.images.forEach(img => URL.revokeObjectURL(img.url));
    }
    
    const nextItems = currentItems.filter(x => x.media.id !== id);
    setItems(nextItems);

    if (nextItems.length === 0) {
      setActiveIndex(0);
      setFocusedMediaId(null);
    } else {
      setActiveIndex(current => {
        const shifted = idx < current ? current - 1 : current;
        return Math.max(0, Math.min(shifted, nextItems.length - 1));
      });
    }
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
          } catch (e) {
            // ignore
          }

          await new Promise<void>((resolve, reject) => {
            const onLoaded = () => resolve();
            const onErr = () => reject(new Error('thumbnail: video load error'));
            tempVideo.addEventListener('loadedmetadata', onLoaded, { once: true });
            tempVideo.addEventListener('error', onErr, { once: true });
          });

          const seekTime = Math.min(0.2, Math.max(0, (Number.isFinite(tempVideo.duration) ? tempVideo.duration : 0) / 4));
          try {
            tempVideo.currentTime = seekTime;
          } catch (e) {
            // ignore
          }

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
      } catch (e) {
        // ignore error
      }
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
      } catch {
        // Ignore pause error
      }
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
        } catch {
          // Ignore pause error
        }
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
    if (!files || files.length === 0) return;
    
    const currentLen = itemsRef.current.length;
    const remaining = maxItems - currentLen;
    if (remaining <= 0) {
      e.target.value = '';
      return;
    }

    const newMedias: CapturedMedia[] = Array.from(files).slice(0, remaining).map((file, i) => {
      const isVideo = file.type.startsWith('video/');
      const url = URL.createObjectURL(file);
      return {
        id: `${Date.now()}-${i}`,
        type: isVideo ? 'video' : 'photo',
        file,
        url,
      };
    });

    const newItems: EditableItem[] = newMedias.map(media => ({
      media,
      filter: 'original',
      texts: [],
      images: [],
      strokes: [],
      mediaTransform: { x: 0, y: 0, scale: 1, rotation: 0 },
    }));

    setItems(prev => [...prev, ...newItems]);
    setActiveIndex(currentLen + newItems.length - 1);
    setFocusedMediaId(newMedias[newMedias.length - 1].id);
    setTrayOpen(false);

    e.target.value = '';
  }, [maxItems]);

  const addGif = useCallback((gif: GiphyItem) => {
    if (!active) return;
    // Use optimized fixed_height URL for both live preview and saved overlay.
    // Guarantees `url` is never empty and animates reliably on mobile.
    const animatedUrl = gif.originalUrl || gif.previewUrl;
    updateActive({
      images: [
        ...active.images,
        {
          id: gif.id + '_' + Date.now(),
          url: animatedUrl,
          originalUrl: animatedUrl,
          isGif: true,
          x: 50,
          y: 50,
          scale: 1,
          rotation: 0,
        },
      ],
    });
    setShowGiphyPicker(false);
    setShowEmojiPicker(false);
  }, [active, updateActive]);

  const addText = useCallback((opts: { text: string; color: string; bg: import('./TextOverlay').TextBg; font: import('./TextOverlay').TextFont; align: 'left' | 'center' | 'right' }) => {
    if (!opts.text.trim() || !active) return;
    updateActive({
      texts: [
        ...active.texts,
        {
          id: crypto.randomUUID(),
          content: opts.text,
          x: 50,
          y: 50,
          scale: 1,
          rotation: 0,
          fontSize: 22,
          isEmoji: false,
          color: opts.color,
          bg: opts.bg,
          font: opts.font,
          align: opts.align,
        },
      ],
    });
    setShowTextInput(false);
  }, [active, updateActive]);

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

  // Handle music playback during editing phase
  useEffect(() => {
    // isFocused = !!focusedMediaId && active?.media.id === focusedMediaId
    const editingNow = !!focusedMediaId && active?.media.id === focusedMediaId;
    if (!isRecording && editingNow && selectedMusic && musicAudioRef.current) {
      // Loop section between musicTrimStart and musicTrimEnd
      const audio = musicAudioRef.current;
      
      const onTimeUpdate = () => {
        if (musicTrimEnd > 0 && audio.currentTime >= musicTrimEnd) {
          audio.currentTime = Math.max(0, musicTrimStart);
          audio.play().catch(() => {});
        }
      };
      
      audio.addEventListener('timeupdate', onTimeUpdate);
      
      // Make sure it starts playing
      if (audio.paused) {
        audio.currentTime = Math.max(0, musicTrimStart);
        audio.play().catch(() => {});
        setIsMusicPlaying(true);
      }
      
      return () => {
        audio.removeEventListener('timeupdate', onTimeUpdate);
        // Important: we don't completely stop audio here so it can play during transition or if we're just unmounting this effect.
        // It will be stopped appropriately when switching modes or removing music.
      };
    } else if (!isRecording) {
      if (musicAudioRef.current && !musicAudioRef.current.paused) {
        musicAudioRef.current.pause();
        setIsMusicPlaying(false);
      }
    }
  }, [isRecording, focusedMediaId, active?.media.id, selectedMusic, musicTrimStart, musicTrimEnd]);


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
    if (!containerRef.current || !active) return;
    
    // Stop event propagation to prevent unexpected behavior
    e.stopPropagation();

    isPinchingMediaRef.current = true;
    const rect = containerRef.current.getBoundingClientRect();

    if (e.touches.length >= 2) {
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
    } else if (e.touches.length === 1) {
      const t = e.touches[0];
      mediaPinchRef.current = {
        dist: 0,
        angle: 0,
        midX: t.clientX,
        midY: t.clientY,
        x: active.mediaTransform.x,
        y: active.mediaTransform.y,
        scale: active.mediaTransform.scale,
        rotation: active.mediaTransform.rotation,
      };
      // Still allow swipe tracking for filters if the drag isn't significant
      handleSwipeStart(e);
    }
  }, [active, handleSwipeStart]);

  const handleEditTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isPinchingMediaRef.current || !mediaPinchRef.current || !containerRef.current || !active) return;

    if (e.cancelable) e.preventDefault();
    e.stopPropagation();

    const rect = containerRef.current.getBoundingClientRect();
    const start = mediaPinchRef.current;

    if (e.touches.length >= 2) {
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
      const angle = Math.atan2(t2.clientY - t1.clientY, t2.clientX - t1.clientX) * (180 / Math.PI);
      const midX = (t1.clientX + t2.clientX) / 2;
      const midY = (t1.clientY + t2.clientY) / 2;

      // Calculate scale (min 0.5, max 3)
      const scale = Math.max(0.5, Math.min(3, start.scale * (dist / start.dist)));
      // Calculate rotation
      const rotation = start.rotation + (angle - start.angle);
      
      // Calculate position delta based on midpoint movement
      const dxPercent = ((midX - start.midX) / rect.width) * 100;
      const dyPercent = ((midY - start.midY) / rect.height) * 100;
      const x = Math.max(-100, Math.min(100, start.x + dxPercent));
      const y = Math.max(-100, Math.min(100, start.y + dyPercent));

      updateActive({ mediaTransform: { x, y, scale, rotation } });
    } else if (e.touches.length === 1) {
      const t = e.touches[0];
      const dxPercent = ((t.clientX - start.midX) / rect.width) * 100;
      const dyPercent = ((t.clientY - start.midY) / rect.height) * 100;
      
      const x = Math.max(-100, Math.min(100, start.x + dxPercent));
      const y = Math.max(-100, Math.min(100, start.y + dyPercent));

      updateActive({ mediaTransform: { ...active.mediaTransform, x, y } });
    }
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

  const drawCover = useCallback((
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
  }, []);

  const renderFrame = useCallback(async (
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
      if (img.isGif) continue; // Live overlays are handled separately, don't bake into static photo
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
  }, [drawCover]);

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
      if (s.isGif) continue; // Don't bake in GIFs for static photos
      try {
        const bmp = await createImageBitmap(await (await fetch(s.url)).blob());
        stickerBitmaps.set(s.id, bmp);
      } catch {
        // ignore
      }
    }

    await renderFrame(ctx, img, editable, stickerBitmaps);

    // Bake drawing strokes
    if (editable.strokes && editable.strokes.length > 0 && drawingCanvasRef.current) {
      drawingCanvasRef.current.drawStrokesToCanvas(ctx, srcW, srcH, editable.strokes);
    }

    const blob = await new Promise<Blob>((resolve, reject) => {
      c.toBlob(
        (b) => (b ? resolve(b) : reject(new Error('toBlob failed'))),
        'image/jpeg',
        0.92
      );
    });

    return new File([blob], `edited-${Date.now()}.jpg`, { type: 'image/jpeg' });
  }, [renderFrame]);

  const exportVideo = useCallback(async (editable: EditableItem): Promise<File> => {
    // --- Photo-to-video path (when photo has animated GIF stickers) ---
    const isPhotoSource = editable.media.type === 'photo';

    if (isPhotoSource) {
      // Load photo as image
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = editable.media.url;
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('image load error'));
      });

      const w = img.naturalWidth || 1080;
      const h = img.naturalHeight || 1920;
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      const ctx = c.getContext('2d');
      if (!ctx) return editable.media.file!;

      const stickerBitmaps = new Map<string, ImageBitmap>();
      for (const s of editable.images) {
        if (s.isGif) continue; // Skip GIFs for static bitmap, handled separately
        try {
          const bmp = await createImageBitmap(await (await fetch(s.url)).blob());
          stickerBitmaps.set(s.id, bmp);
        } catch { /* ignore */ }
      }

      // We attach GIF images to the DOM with full visibility so the browser
      // animates them. Opacity tricks cause browsers to pause GIF animations.
      // The container is placed off-screen but fully rendered.
      const hiddenContainer = document.createElement('div');
      hiddenContainer.style.position = 'fixed';
      hiddenContainer.style.top = '0px';
      hiddenContainer.style.left = '-200px';
      hiddenContainer.style.width = '160px';
      hiddenContainer.style.height = '160px';
      hiddenContainer.style.overflow = 'hidden';
      hiddenContainer.style.opacity = '1';
      hiddenContainer.style.pointerEvents = 'none';
      hiddenContainer.style.zIndex = '9999';
      document.body.appendChild(hiddenContainer);

      const gifImages = new Map<string, HTMLImageElement>();
      for (const s of editable.images) {
        if (s.isGif) {
          const gifEl = new Image();
          gifEl.crossOrigin = 'anonymous';
          gifEl.src = s.url;
          await new Promise<void>(res => { gifEl.onload = () => res(); gifEl.onerror = () => res(); });
          gifImages.set(s.id, gifEl);
          hiddenContainer.appendChild(gifEl);
        }
      }

      const canvasStream = (c as any).captureStream?.(30) as MediaStream;
      const videoTrack = canvasStream?.getVideoTracks?.()[0];
      const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp8')
        ? 'video/webm;codecs=vp8'
        : 'video/webm';
      const recorder = new MediaRecorder(new MediaStream([...(videoTrack ? [videoTrack] : [])]), { mimeType });
      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
      const done = new Promise<Blob>(resolve => {
        recorder.onstop = () => resolve(new Blob(chunks, { type: 'video/webm' }));
      });

      recorder.start(250);

      // Duration: 5 seconds at 30fps
      const DURATION_MS = 5000;
      const start = performance.now();
      await new Promise<void>(resolve => {
        const drawLoop = async () => {
          const elapsed = performance.now() - start;
          if (elapsed >= DURATION_MS) { resolve(); return; }

          await renderFrame(ctx, img, editable, stickerBitmaps);

          // Draw GIF stickers on top (browser handles frame)
          for (const s of editable.images) {
            const gifEl = gifImages.get(s.id);
            if (!gifEl) continue;
            ctx.save();
            const x = (s.x / 100) * w;
            const y = (s.y / 100) * h;
            ctx.translate(x, y);
            ctx.rotate((s.rotation * Math.PI) / 180);
            ctx.scale(s.scale, s.scale);
            const drawW = Math.min(w * 0.28, 320);
            const ratio = gifEl.naturalWidth ? gifEl.naturalWidth / gifEl.naturalHeight : 1;
            const drawH = drawW / ratio;
            ctx.drawImage(gifEl, -drawW / 2, -drawH / 2, drawW, drawH);
            ctx.restore();
          }

          if (editable.strokes && editable.strokes.length > 0 && drawingCanvasRef.current) {
            drawingCanvasRef.current.drawStrokesToCanvas(ctx, w, h, editable.strokes);
          }

          requestAnimationFrame(drawLoop);
        };
        requestAnimationFrame(drawLoop);
      });

      recorder.stop();
      const blob = await done;
      
      // Cleanup DOM
      if (document.body.contains(hiddenContainer)) {
        document.body.removeChild(hiddenContainer);
      }
      
      return new File([blob], `gif-story-${Date.now()}.webm`, { type: 'video/webm' });
    }

    // --- Standard video path ---
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
      try { offscreenVideo.load(); } catch {
        // Ignore load error
      }
    });

    const w = offscreenVideo.videoWidth || 720;
    const h = offscreenVideo.videoHeight || 1280;

    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const ctx = c.getContext('2d');
    if (!ctx) return editable.media.file!;

    const stickerBitmaps = new Map<string, ImageBitmap>();
    for (const s of editable.images) {
      if (s.isGif) continue; // Skip GIFs
      try {
        const bmp = await createImageBitmap(await (await fetch(s.url)).blob());
        stickerBitmaps.set(s.id, bmp);
      } catch {
        // ignore
      }
    }

    // We attach GIF images to the DOM with full visibility so the browser
    // animates them. Opacity tricks cause browsers to pause GIF animations.
    const hiddenContainer = document.createElement('div');
    hiddenContainer.style.position = 'fixed';
    hiddenContainer.style.top = '0px';
    hiddenContainer.style.left = '-200px';
    hiddenContainer.style.width = '160px';
    hiddenContainer.style.height = '160px';
    hiddenContainer.style.overflow = 'hidden';
    hiddenContainer.style.opacity = '1';
    hiddenContainer.style.pointerEvents = 'none';
    hiddenContainer.style.zIndex = '9999';
    document.body.appendChild(hiddenContainer);

    const gifImages = new Map<string, HTMLImageElement>();
    for (const s of editable.images) {
      if (s.isGif) {
        const gifEl = new Image();
        gifEl.crossOrigin = 'anonymous';
        gifEl.src = s.url;
        await new Promise<void>(res => { gifEl.onload = () => res(); gifEl.onerror = () => res(); });
        gifImages.set(s.id, gifEl);
        hiddenContainer.appendChild(gifEl);
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

    const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus')
      ? 'video/webm;codecs=vp8,opus'
      : (MediaRecorder.isTypeSupported('video/webm;codecs=vp8') ? 'video/webm;codecs=vp8' : 'video/webm');

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

      // Draw GIF stickers on top
      for (const s of editable.images) {
        const gifEl = gifImages.get(s.id);
        if (!gifEl) continue;
        ctx.save();
        const x = (s.x / 100) * w;
        const y = (s.y / 100) * h;
        ctx.translate(x, y);
        ctx.rotate((s.rotation * Math.PI) / 180);
        ctx.scale(s.scale, s.scale);
        const drawW = Math.min(w * 0.28, 320);
        const ratio = gifEl.naturalWidth ? gifEl.naturalWidth / gifEl.naturalHeight : 1;
        const drawH = drawW / ratio;
        ctx.drawImage(gifEl, -drawW / 2, -drawH / 2, drawW, drawH);
        ctx.restore();
      }

      if (editable.strokes && editable.strokes.length > 0 && drawingCanvasRef.current) {
        drawingCanvasRef.current.drawStrokesToCanvas(ctx, w, h, editable.strokes);
      }

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

    if (document.body.contains(hiddenContainer)) {
      document.body.removeChild(hiddenContainer);
    }

    return new File([blob], `edited-${Date.now()}.webm`, { type: 'video/webm' });
  }, [renderFrame]);

  const handleNext = useCallback(async () => {
    if (items.length === 0 || isExporting) return;
    setIsExporting(true);
    try {
      const edited = [] as { file: File; filter: string; gifOverlays?: ImageSticker[] }[];
      for (const it of items) {
        const gifStickers = it.images.filter(img => img.isGif);
        const hasGifs = gifStickers.length > 0;

        if (it.media.type === 'photo') {
          if (hasGifs) {
            // Instagram approach: export photo WITHOUT GIFs baked in,
            // pass GIF data separately to be stored as metadata and rendered as live overlays.
            const f = await exportPhoto(it);
            edited.push({ file: f, filter: 'original', gifOverlays: gifStickers });
          } else {
            const f = await exportPhoto(it);
            edited.push({ file: f, filter: 'original' });
          }
          continue;
        }

        const hasEdits = it.filter !== 'original' || it.texts.length > 0 || it.images.length > 0 ||
          (it.strokes && it.strokes.length > 0) ||
          it.mediaTransform.x !== 0 || it.mediaTransform.y !== 0 || it.mediaTransform.scale !== 1 || it.mediaTransform.rotation !== 0;

        if (!hasEdits) {
          edited.push({ file: it.media.file, filter: it.filter, gifOverlays: hasGifs ? gifStickers : undefined });
          continue;
        }

        // For videos: export the video (without GIF baking), pass GIFs as overlay metadata
        if (hasGifs) {
          // Don't bake GIFs into the video - export video normally (non-GIF stickers/text/filter baked)
          const nonGifImages = it.images.filter(img => !img.isGif);
          const f = await exportVideo({ ...it, images: nonGifImages });
          edited.push({ file: f, filter: 'original', gifOverlays: gifStickers });
        } else {
          const f = await exportVideo(it);
          edited.push({ file: f, filter: 'original' });
        }
      }
      const musicPayload = selectedMusicMeta ? {
        ...selectedMusicMeta,
        file: selectedMusic?.file,
      } : null;
      onNext(edited, postCaption, musicPayload);
    } finally {
      setIsExporting(false);
    }
  }, [exportPhoto, exportVideo, isExporting, items, onNext, postCaption, selectedMusicMeta, selectedMusic?.file]);

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
      } catch {
        // Ignore seek error
      }
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
  const checkIfOverTrash = useCallback((itemXPercent: number, itemYPercent: number, id: string) => {
    if (!containerRef.current || !trashRef.current) return;
    
    // Get container dimensions to convert % to px
    const containerRect = containerRef.current.getBoundingClientRect();
    const cx = (itemXPercent / 100) * containerRect.width + containerRect.left;
    const cy = (itemYPercent / 100) * containerRect.height + containerRect.top;
    
    // Get trash boundary
    const trashRect = trashRef.current.getBoundingClientRect();
    const trashCx = trashRect.left + trashRect.width / 2;
    const trashCy = trashRect.top + trashRect.height / 2;
    
    const dist = Math.hypot(cx - trashCx, cy - trashCy);
    // 60px distance gives a generous and safe hit area for mobile
    const isOver = dist < 60;
    
    setIsOverTrashId(isOver ? id : null);
    setIsNearTrash(dist < 180);
  }, []);

  return (
    <div className="fixed inset-0 z-[60] bg-black flex flex-col overflow-hidden overscroll-none">
      <input ref={fileInputRef} type="file" accept="image/*,video/*" multiple onChange={handleFileSelect} className="hidden" />
      <input ref={stickerInputRef} type="file" accept="image/*" onChange={handleStickerFileSelect} className="hidden" />

      {/* Unified Top Dock (Header + Strip) */}
      <div className="absolute top-0 left-0 right-0 z-50 px-2 pt-[calc(env(safe-area-inset-top,0px)+4px)]">
        {items.length > 0 ? (
          <div className="flex items-center gap-2 p-1 rounded-2xl bg-black/55 backdrop-blur-xl border border-white/10 shadow-2xl">
            <button
              onClick={onClose}
              className="w-12 h-12 flex-shrink-0 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center active:scale-90 transition-all border border-white/5"
            >
              <X className="w-5 h-5 text-white" />
            </button>

            <div className="flex-1 flex gap-2 overflow-x-auto items-center mx-0.5" style={{ scrollbarWidth: 'none' }}>
              {items.map((it, idx) => (
                <div
                  key={it.media.id}
                  draggable
                  onDragStart={(e) => e.dataTransfer.setData('idx', idx.toString())}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => { e.preventDefault(); moveMedia(parseInt(e.dataTransfer.getData('idx')), idx); }}
                  className={cn(
                    'relative flex-shrink-0 transition-all duration-300',
                    idx === activeIndex ? 'opacity-100 scale-100' : 'opacity-60 scale-95 hover:opacity-80'
                  )}
                  onClick={() => handleSelectFromStrip(idx)}
                >
                  <div className={cn(
                    "w-12 h-12 rounded-xl overflow-hidden border transition-colors duration-200",
                    idx === activeIndex ? "border-primary/80 ring-2 ring-primary/40" : "border-white/10"
                  )}>
                    {it.media.type === 'photo' ? (
                      <img src={it.media.url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="relative w-full h-full">
                        <img src={it.media.thumbnail || it.media.url} alt="" className="w-full h-full object-cover" />
                        <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                          <Play className="w-4 h-4 text-white fill-white" />
                        </div>
                      </div>
                    )}
                  </div>

                  {focusedMediaId === it.media.id && (
                    <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none">
                      <div className="w-7 h-7 rounded-full bg-black/40 backdrop-blur-md border border-white/20 flex items-center justify-center shadow-lg">
                        <Camera className="w-3.5 h-3.5 text-white" />
                      </div>
                    </div>
                  )}

                  <button
                    onClick={(e) => { e.stopPropagation(); removeMedia(it.media.id); }}
                    className="absolute top-1 right-1 w-4 h-4 rounded-full bg-black/50 backdrop-blur-md flex items-center justify-center shadow hover:bg-red-500 transition-colors z-30"
                  >
                    <X className="w-2.5 h-2.5 text-white" />
                  </button>
                </div>
              ))}
            </div>

            <button
              onClick={handleNext}
              disabled={isExporting}
              className={cn(
                "h-12 px-4 flex-shrink-0 rounded-xl bg-gradient-to-br from-primary to-primary/80 text-primary-foreground text-sm font-semibold flex items-center gap-1 shadow-lg hover:shadow-primary/25 active:scale-95 transition-all text-shadow-sm",
                isExporting && 'opacity-60 pointer-events-none'
              )}
            >
              {isExporting ? '...' : (memoryMemberId ? 'Ulashish' : 'Keyingi')}
              {!memoryMemberId && !isExporting && <ChevronRight className="w-4 h-4" />}
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-between px-1">
            <button
              onClick={onClose}
              className="w-10 h-10 rounded-full glass-button flex items-center justify-center active:scale-90 transition-transform"
            >
              <X className="w-5 h-5 text-white" />
            </button>
          </div>
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
                          try { (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId); } catch {
                            // Ignore capture error
                          }
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
                          try { (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId); } catch {
                            // Ignore capture error
                          }
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
                          try { (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId); } catch {
                            // Ignore capture error
                          }
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

        {/* Focused preview layer (edit mode) */}
        {isFocused && active && (
          <div className="absolute inset-0 z-10 bg-gradient-to-br from-slate-900/70 via-purple-900/55 to-slate-900/70 flex flex-col">
            <div className="flex-1 relative overflow-hidden flex items-center justify-center px-1 pt-24 pb-10">
              <div
                ref={containerRef}
                className="relative w-full max-w-md aspect-[9/16] max-h-[calc(100vh-280px)] rounded-2xl overflow-hidden border border-white/20 shadow-2xl touch-none"
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
                    onUpdate={(updated) => {
                      updateActive({ texts: active.texts.map(x => (x.id === updated.id ? updated : x)) });
                      checkIfOverTrash(updated.x, updated.y, updated.id);
                    }}
                    onDelete={(id) => {
                      updateActive({ texts: active.texts.filter(x => x.id !== id) });
                      setIsOverTrashId(null);
                      setIsNearTrash(false);
                      setIsDraggingOverlay(false);
                    }}
                    isOverTrash={isOverTrashId === t.id}
                    onDragStart={() => setIsDraggingOverlay(true)}
                    onDragEnd={() => {
                      setIsDraggingOverlay(false);
                      if (isOverTrashId === t.id) {
                        updateActive({ texts: active.texts.filter(x => x.id !== t.id) });
                      }
                      setIsOverTrashId(null);
                      setIsNearTrash(false);
                    }}
                  />
                ))}

                {active.images.map(img => (
                  <ImageOverlay
                    key={img.id}
                    item={img}
                    containerRef={containerRef as React.RefObject<HTMLDivElement>}
                    onUpdate={(updated) => {
                      updateActive({ images: active.images.map(x => (x.id === updated.id ? updated : x)) });
                      checkIfOverTrash(updated.x, updated.y, updated.id);
                    }}
                    onDelete={(id) => {
                      removeSticker(id);
                      setIsOverTrashId(null);
                      setIsNearTrash(false);
                      setIsDraggingOverlay(false);
                    }}
                    isOverTrash={isOverTrashId === img.id}
                    onDragStart={() => setIsDraggingOverlay(true)}
                    onDragEnd={() => {
                      setIsDraggingOverlay(false);
                      if (isOverTrashId === img.id) {
                        removeSticker(img.id);
                      }
                      setIsOverTrashId(null);
                      setIsNearTrash(false);
                    }}
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

                {/* Drag-to-delete trash zone */}
                <div
                  ref={trashRef}
                  className={cn(
                    'absolute bottom-4 left-1/2 -translate-x-1/2 z-[60] flex flex-col items-center justify-center gap-1.5 w-[64px] h-[64px] rounded-full backdrop-blur-md border-2 transition-all duration-300 shadow-2xl',
                    isDraggingOverlay || showDrawing ? 'opacity-100 translate-y-0 scale-100 pointer-events-auto' : 'opacity-0 translate-y-6 scale-90 pointer-events-none',
                    isOverTrashId !== null
                      ? 'border-red-500 bg-red-600/70 scale-125 shadow-[0_0_30px_rgba(239,68,68,0.7)]'
                      : 'border-white/20 bg-black/40'
                  )}
                  onClick={() => {
                    if (showDrawing) drawingCanvasRef.current?.clear();
                  }}
                >
                  <Trash2 
                    className={cn(
                      'transition-all duration-300',
                      isOverTrashId !== null ? 'w-8 h-8 text-white' : 'w-6 h-6 text-white/90'
                    )} 
                  />
                </div>

                {/* Drawing canvas */}
                {active && (
                  <DrawingCanvas
                    key={active.media.id}
                    ref={drawingCanvasRef}
                    isActive={showDrawing}
                    initialStrokes={active.strokes}
                    width={containerRef.current?.clientWidth || 390}
                    height={containerRef.current?.clientHeight || 693}
                    onStrokeEnd={() => {
                      if (drawingCanvasRef.current) {
                        updateActive({ strokes: drawingCanvasRef.current.exportStrokes() });
                      }
                    }}
                  />
                )}
              </div>

              {/* Edit tools */}
              <div className="absolute right-2 top-1/2 -translate-y-1/2 z-50 flex flex-col gap-3">
                {/* ─── Creative Menu trigger (Drawing / GIF / Sticker / Image) ─── */}
                <div className="relative flex flex-col items-center gap-0.5">
                  <button
                    onClick={() => {
                      setShowCreativeMenu(m => !m);
                      // Close any open sub-panels when toggling
                      setShowEmojiPicker(false);
                      setShowGiphyPicker(false);
                      if (showCreativeMenu) setShowDrawing(false);
                    }}
                    className="flex flex-col items-center gap-0.5 group"
                  >
                    <div className={cn(
                      'w-11 h-11 rounded-xl backdrop-blur-xl border flex items-center justify-center text-white shadow-lg transition-all duration-300',
                      showCreativeMenu
                        ? 'bg-violet-600/70 border-violet-400 shadow-violet-500/30'
                        : 'bg-black/40 border-white/20 group-active:scale-90'
                    )}>
                      <Icon icon="solar:sticker-smile-circle-outline" className="w-6 h-6" />
                    </div>
                    <span className="text-[9px] text-white/70 font-medium">Ijodiy</span>
                  </button>

                  {/* Sub-menu — animated vertical list */}
                  {showCreativeMenu && (
                    <div
                      className="absolute right-12 top-0 flex flex-col gap-2 z-50"
                      style={{ animation: 'creativeMenuIn 0.22s cubic-bezier(0.34,1.56,0.64,1) both' }}
                    >
                      {/* Drawing */}
                      <button
                        onClick={() => {
                          setShowDrawing(d => !d);
                          setShowEmojiPicker(false);
                          setShowTextInput(false);
                          setShowGiphyPicker(false);
                          setShowCreativeMenu(false);
                        }}
                        className="flex items-center gap-2 group/sub"
                      >
                        <span className="text-[11px] text-white/80 font-medium px-2 py-1 bg-black/50 backdrop-blur-md rounded-lg border border-white/15 whitespace-nowrap">Chizish</span>
                        <div className={cn(
                          'w-10 h-10 rounded-xl backdrop-blur-xl border flex items-center justify-center text-white shadow-lg transition-all',
                          showDrawing ? 'bg-primary/60 border-primary' : 'bg-black/55 border-white/25 group-active/sub:scale-90'
                        )}>
                          <Pen className="w-4 h-4" />
                        </div>
                      </button>

                      {/* GIF — vaqtinchalik yashirilgan */}
                      {/* {false && ( */}
                      <button
                        onClick={() => {
                          setShowGiphyPicker(g => !g);
                          setShowEmojiPicker(false);
                          setShowTextInput(false);
                          setShowDrawing(false);
                          setShowCreativeMenu(false);
                        }}
                        className="flex items-center gap-2 group/sub"
                      >
                        <span className="text-[11px] text-white/80 font-medium px-2 py-1 bg-black/50 backdrop-blur-md rounded-lg border border-white/15 whitespace-nowrap">GIF</span>
                        <div className="w-10 h-10 rounded-xl bg-black/55 backdrop-blur-xl border border-white/25 flex items-center justify-center text-white shadow-lg group-active/sub:scale-90 transition-transform">
                          <Icon icon="mage:gif-fill" className="w-6 h-6" />
                        </div>
                      </button>
                      {/* )} */}

                      {/* Emoji Sticker */}
                      <button
                        onClick={() => {
                          setShowEmojiPicker(!showEmojiPicker);
                          setShowTextInput(false);
                          setShowDrawing(false);
                          setShowGiphyPicker(false);
                          setShowCreativeMenu(false);
                        }}
                        className="flex items-center gap-2 group/sub"
                      >
                        <span className="text-[11px] text-white/80 font-medium px-2 py-1 bg-black/50 backdrop-blur-md rounded-lg border border-white/15 whitespace-nowrap">Stiker</span>
                        <div className="w-10 h-10 rounded-xl bg-black/55 backdrop-blur-xl border border-white/25 flex items-center justify-center text-white shadow-lg group-active/sub:scale-90 transition-transform">
                          <Smile className="w-4 h-4" />
                        </div>
                      </button>

                      {/* Image upload */}
                      <button
                        onClick={() => {
                          stickerInputRef.current?.click();
                          setShowEmojiPicker(false);
                          setShowTextInput(false);
                          setShowDrawing(false);
                          setShowCreativeMenu(false);
                        }}
                        className="flex items-center gap-2 group/sub"
                      >
                        <span className="text-[11px] text-white/80 font-medium px-2 py-1 bg-black/50 backdrop-blur-md rounded-lg border border-white/15 whitespace-nowrap">Rasm</span>
                        <div className="w-10 h-10 rounded-xl bg-black/55 backdrop-blur-xl border border-white/25 flex items-center justify-center text-white shadow-lg group-active/sub:scale-90 transition-transform">
                          <ImagePlus className="w-4 h-4" />
                        </div>
                      </button>
                    </div>
                  )}
                </div>

                {/* Drawing undo/redo — only when drawing canvas is open */}
                {showDrawing && (
                  <>
                    <button onClick={() => drawingCanvasRef.current?.undo()} className="flex flex-col items-center gap-0.5">
                      <div className="w-11 h-11 rounded-xl bg-black/40 backdrop-blur-xl border border-white/20 flex items-center justify-center text-white shadow-lg">
                        <Undo2 className="w-5 h-5" />
                      </div>
                      <span className="text-[9px] text-white/70 font-medium">Bekor</span>
                    </button>
                    <button onClick={() => drawingCanvasRef.current?.redo()} className="flex flex-col items-center gap-0.5">
                      <div className="w-11 h-11 rounded-xl bg-black/40 backdrop-blur-xl border border-white/20 flex items-center justify-center text-white shadow-lg">
                        <Redo2 className="w-5 h-5" />
                      </div>
                      <span className="text-[9px] text-white/70 font-medium">Qayta</span>
                    </button>
                  </>
                )}


                {/* Text tool — always visible in main toolbar */}
                <button
                  onClick={() => {
                    setShowTextInput(true);
                    setShowEmojiPicker(false);
                    setShowDrawing(false);
                    setShowCreativeMenu(false);
                  }}
                  className="flex flex-col items-center gap-0.5 group"
                >
                  <div className="w-11 h-11 rounded-xl bg-black/40 backdrop-blur-xl border border-white/20 flex items-center justify-center text-white shadow-lg group-active:scale-90 transition-transform">
                    <Type className="w-5 h-5" />
                  </div>
                  <span className="text-[9px] text-white/70 font-medium">Matn</span>
                </button>

                {memoryMemberId && (
                  <button
                    onClick={() => {
                      setShowCaptionInput(true);
                      setShowEmojiPicker(false);
                      setShowTextInput(false);
                      setShowDrawing(false);
                    }}
                    className="flex flex-col items-center gap-0.5"
                  >
                    <div className="w-11 h-11 rounded-xl bg-black/40 backdrop-blur-xl border border-white/20 flex items-center justify-center text-white shadow-lg">
                      <AlignLeft className="w-5 h-5" />
                    </div>
                    <span className="text-[9px] text-white/70 font-medium">Izoh</span>
                  </button>
                )}

                {/* Music tool in Edit sidebar */}
                <div className="relative flex flex-col items-center gap-0.5 group">
                  <button
                    onClick={() => {
                      setShowMusicPicker(true);
                      setShowEmojiPicker(false);
                      setShowTextInput(false);
                      setShowDrawing(false);
                      setShowGiphyPicker(false);
                    }}
                    className={cn(
                      "w-11 h-11 rounded-xl bg-black/40 backdrop-blur-xl border flex items-center justify-center text-white shadow-lg overflow-hidden transition-all duration-300",
                      selectedMusic ? "border-primary/50 shadow-[0_0_15px_rgba(var(--primary),0.3)]" : "border-white/20"
                    )}
                  >
                    {selectedMusic ? (
                      <div className="w-full h-full p-1 bg-black/50">
                        <div className="w-full h-full rounded-full bg-gradient-to-tr from-zinc-800 to-zinc-600 animate-spin flex items-center justify-center border border-white/10" style={{ animationDuration: '4s' }}>
                          <Disc className="w-4 h-4 text-primary fill-primary/20" />
                        </div>
                      </div>
                    ) : (
                      <Music2 className="w-5 h-5" />
                    )}
                  </button>
                  {selectedMusic && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        removeSelectedMusic();
                      }}
                      className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-black border border-white/20 flex items-center justify-center text-white hover:bg-destructive hover:border-destructive hover:text-white transition-colors z-10"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                  <span className="text-[9px] text-white/70 font-medium whitespace-nowrap">
                    Musiqa
                  </span>
                </div>

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
                <div className="absolute bottom-24 right-14 bg-black/60 backdrop-blur-xl border border-white/20 rounded-2xl p-3 grid grid-cols-8 gap-1.5 max-w-[300px] max-h-[220px] overflow-y-auto z-50" style={{ scrollbarWidth: 'none' }}>
                  {EMOJIS.map(emoji => (
                    <button key={emoji} onClick={() => addEmoji(emoji)} className="text-2xl p-0.5 rounded-lg hover:bg-white/10 transition-colors">
                      {emoji}
                    </button>
                  ))}
                </div>
              )}

              {/* GIPHY Picker */}
              {showGiphyPicker && active && (
                <GiphyPicker
                  onSelect={addGif}
                  onClose={() => setShowGiphyPicker(false)}
                />
              )}
            </div>

            {!showGiphyPicker && (
              <div className="flex-shrink-0 pb-[max(4.7rem,calc(env(safe-area-inset-bottom)+1.25rem))]">
                <FilterStrip
                  selectedFilter={active.filter}
                  onSelectFilter={(f) => updateActive({ filter: f })}
                  previewSrc={active.media.type === 'photo' ? active.media.url : active.media.thumbnail}
                />
              </div>
            )}

            {showTextInput && (
              <TextEditModal
                onConfirm={addText}
                onCancel={() => setShowTextInput(false)}
              />
            )}

            {showCaptionInput && (
              <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-6">
                <div className="bg-black/70 backdrop-blur-xl border border-white/20 rounded-2xl p-5 w-full max-w-sm space-y-4">
                  <h3 className="font-semibold text-lg text-white">Post izohi</h3>
                  <textarea
                    autoFocus
                    value={postCaption}
                    onChange={(e) => setPostCaption(e.target.value)}
                    placeholder="Xotira uchun izoh..."
                    className="w-full h-32 p-3 bg-white/10 border border-white/20 rounded-xl text-sm text-white placeholder:text-white/30 resize-none focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                  <div className="flex gap-2 justify-end">
                    <button
                      onClick={() => setShowCaptionInput(false)}
                      className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-semibold"
                    >
                      Saqlash
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
        {!showGiphyPicker && (
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
                <div className="px-4 pb-[calc(env(safe-area-inset-bottom,0px)+0.5rem)]">
                  <div className="grid grid-cols-4 gap-2 items-center">
                    {items.length > 0 ? Array.from({ length: 3 }).map((_, i) => {
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
                    }) : galleryItems.slice(0, 3).map((asset) => (
                      <button
                        key={asset.identifier}
                        onClick={() => handleSelectGalleryItem(asset)}
                        className="w-12 h-12 rounded-xl overflow-hidden border border-white/15 active:scale-95 transition-transform"
                      >
                         <img src={asset.thumbnail} alt="" className="w-full h-full object-cover" />
                      </button>
                    ))}
                    {items.length === 0 && galleryItems.length < 3 && Array.from({ length: 3 - galleryItems.length }).map((_, i) => (
                      <div key={`g-empty-${i}`} className="w-12 h-12 rounded-xl bg-white/5" />
                    ))}
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
                <div className="px-4 pb-[calc(env(safe-area-inset-bottom,0px)+0.5rem)]">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-white/70 text-xs font-semibold">{items.length > 0 ? 'Tanlanganlar' : 'Galereya'}</span>
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={!canAddMore}
                      className="text-white/80 text-xs font-semibold px-3 py-2 rounded-full bg-white/10 border border-white/15 disabled:opacity-30"
                    >
                      Barchasi
                    </button>
                  </div>

                  <div 
                    className="grid grid-cols-3 gap-2 max-h-[52vh] overflow-y-auto"
                    onScroll={(e) => {
                      const t = e.currentTarget;
                      if (t.scrollHeight - t.scrollTop - t.clientHeight < 100) {
                        loadMore();
                      }
                    }}
                  >
                    {items.length > 0 ? items.map((it, idx) => (
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
                    )) : galleryItems.map((asset) => (
                      <button
                        key={asset.identifier}
                        onClick={() => {
                          handleSelectGalleryItem(asset);
                          setTrayOpen(false);
                        }}
                        className="relative aspect-square rounded-xl overflow-hidden border border-white/15 active:scale-95 transition-transform"
                      >
                        <img src={asset.thumbnail} alt="" className="w-full h-full object-cover" />
                        {asset.mediaType === 'video' && (
                          <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                            <Play className="w-5 h-5 text-white fill-white" />
                          </div>
                        )}
                      </button>
                    ))}
                    {items.length === 0 && galleryItems.length === 0 && isGalleryLoading && Array.from({ length: 6 }).map((_, i) => (
                      <div key={`skel-${i}`} className="aspect-square rounded-xl bg-white/5 animate-pulse" />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Music & Camera switch buttons — rendered AFTER tray so z-50 beats tray's z-40 */}
        {showCaptureUi && (
          <>
            {/* Music capture button */}
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
