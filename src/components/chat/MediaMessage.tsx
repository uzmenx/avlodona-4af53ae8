import { useState, useRef, useEffect } from 'react';
import { Play, Pause, Maximize2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { MediaUploadProgress } from './MediaUploadProgress';
import { useCachedMedia } from '@/hooks/useCachedMedia';

interface MediaMessageProps {
  mediaUrl: string;
  mediaType: 'image' | 'video';
  isMine: boolean;
  onFullscreen?: () => void;
  uploadProgress?: number;
}

export const MediaMessage = ({ 
  mediaUrl, 
  mediaType, 
  isMine, 
  onFullscreen,
  uploadProgress 
}: MediaMessageProps) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Keshdan yuklash: Telegram kabi bir marta yuklab olingan media qayta tarmoqdan olinmaydi
  // uploadProgress bo'lsa — hali yuklanyapti, kesh shart emas
  const { cachedUrl } = useCachedMedia(
    uploadProgress === undefined ? mediaUrl : null
  );
  const effectiveUrl = uploadProgress !== undefined ? mediaUrl : (cachedUrl || mediaUrl);

  const instanceIdRef = useRef(
    typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `vid_${Date.now()}_${Math.random()}`
  );

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

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (isPlaying) v.pause();
    else {
      window.dispatchEvent(
        new CustomEvent('avlodona:video:request-play', { detail: { id: instanceIdRef.current } })
      );
      v.play();
    }
    setIsPlaying(!isPlaying);
  };

  const formatTime = (s: number) => {
    if (!s || !isFinite(s) || isNaN(s)) return '0:00';
    return `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, '0')}`;
  };

  if (mediaType === 'image') {
    return (
      <div className="relative group rounded-2xl overflow-hidden -mx-1 -mt-0.5">
        <img
          src={effectiveUrl}
          alt=""
          className="max-w-full max-h-[300px] rounded-2xl object-cover cursor-pointer"
          onClick={onFullscreen}
        />
        
        {uploadProgress !== undefined && uploadProgress < 100 && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-[2px] z-10">
            <MediaUploadProgress progress={uploadProgress} size={32} showText />
          </div>
        )}

        {onFullscreen && uploadProgress === undefined && (
          <button
            onClick={onFullscreen}
            className="absolute top-2 right-2 p-1.5 bg-background/30 backdrop-blur-md rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <Maximize2 className="h-3.5 w-3.5 text-foreground" />
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="relative group max-w-[280px] rounded-2xl overflow-hidden -mx-1 -mt-0.5">
      <video
        ref={videoRef}
        src={effectiveUrl}
        className="w-full max-h-[300px] rounded-2xl object-cover"
        onTimeUpdate={() => {
          const v = videoRef.current;
          if (v && isFinite(v.duration)) setProgress((v.currentTime / v.duration) * 100);
        }}
        onLoadedMetadata={() => {
          const v = videoRef.current;
          if (v && isFinite(v.duration)) setDuration(v.duration);
        }}
        onEnded={() => { setIsPlaying(false); setProgress(0); }}
        playsInline
        onClick={togglePlay}
      />

      {uploadProgress !== undefined && uploadProgress < 100 && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-[2px] z-10">
          <MediaUploadProgress progress={uploadProgress} size={32} showText />
        </div>
      )}

      {/* Play overlay */}
      {!isPlaying && (
        <button
          onClick={togglePlay}
          className="absolute inset-0 flex items-center justify-center bg-background/10 backdrop-blur-[1px] rounded-2xl"
        >
          <div className="w-12 h-12 rounded-full bg-background/40 backdrop-blur-md flex items-center justify-center">
            <Play className="h-5 w-5 text-foreground ml-0.5" />
          </div>
        </button>
      )}

      {/* Duration badge */}
      {!isPlaying && duration > 0 && (
        <div className="absolute bottom-2.5 left-2.5 px-2 py-0.5 bg-background/40 backdrop-blur-md rounded-full">
          <span className="text-[10px] font-medium text-foreground tabular-nums">{formatTime(duration)}</span>
        </div>
      )}

      {/* Playing controls */}
      {isPlaying && (
        <div className="absolute bottom-0 left-0 right-0 p-2.5 bg-gradient-to-t from-background/50 to-transparent">
          <div className="h-1 bg-foreground/20 rounded-full mb-1.5 cursor-pointer" onClick={(e) => {
            const v = videoRef.current;
            if (!v || !isFinite(v.duration)) return;
            const rect = e.currentTarget.getBoundingClientRect();
            const pct = (e.clientX - rect.left) / rect.width;
            v.currentTime = pct * v.duration;
          }}>
            <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${progress}%` }} />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-foreground/70 tabular-nums">{formatTime(videoRef.current?.currentTime || 0)}</span>
            {onFullscreen && (
              <button onClick={onFullscreen} className="p-1">
                <Maximize2 className="h-3.5 w-3.5 text-foreground/70" />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
