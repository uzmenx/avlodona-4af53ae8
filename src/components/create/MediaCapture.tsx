import { useState, useRef, useEffect, useCallback } from 'react';
import { X, SwitchCamera, ChevronRight, Image as ImageIcon, Video } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface CapturedMedia {
  id: string;
  type: 'photo' | 'video';
  file: File;
  url: string;
  thumbnail?: string;
}

interface MediaCaptureProps {
  onNext: (media: CapturedMedia[]) => void;
  onClose: () => void;
}

export default function MediaCapture({ onNext, onClose }: MediaCaptureProps) {
  const [selectedMedia, setSelectedMedia] = useState<CapturedMedia[]>([]);
  const [isCapturing, setIsCapturing] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [cameraReady, setCameraReady] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [dragStartY, setDragStartY] = useState<number | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recordTimerRef = useRef<number>();
  const captureTimerRef = useRef<number>();
  const isTakingPhotoRef = useRef<boolean>(false);

  useEffect(() => {
    startCamera();
    return () => stopCamera();
  }, [facingMode]);

  const startCamera = async () => {
    stopCamera();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: true,
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
        setCameraReady(true);
      }
    } catch (err) {
      console.error('Camera error:', err);
    }
  };

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraReady(false);
  };

  const takePhoto = useCallback(() => {
    if (!videoRef.current || !canvasRef.current || selectedMedia.length >= 5 || isTakingPhotoRef.current) return;
    isTakingPhotoRef.current = true;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d')!;
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
      if (!blob) return;
      const file = new File([blob], `photo-${Date.now()}.jpg`, { type: 'image/jpeg' });
      const url = URL.createObjectURL(blob);
      setSelectedMedia(prev => [...prev, { id: Date.now().toString(), type: 'photo', file, url }]);
      isTakingPhotoRef.current = false;
    }, 'image/jpeg', 0.92);
  }, [zoom, selectedMedia.length]);

  const startRecording = useCallback(() => {
    if (!streamRef.current || selectedMedia.length >= 5) return;
    recordedChunksRef.current = [];
    const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9') ? 'video/webm;codecs=vp9' : 'video/webm';
    const recorder = new MediaRecorder(streamRef.current, { mimeType });
    recorder.ondataavailable = (e) => { if (e.data.size > 0) recordedChunksRef.current.push(e.data); };
    recorder.onstop = () => {
      const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
      const file = new File([blob], `video-${Date.now()}.webm`, { type: 'video/webm' });
      const url = URL.createObjectURL(blob);
      const tempVideo = document.createElement('video');
      tempVideo.src = url;
      tempVideo.currentTime = 0.5;
      tempVideo.onloadeddata = () => {
        const c = document.createElement('canvas');
        c.width = tempVideo.videoWidth;
        c.height = tempVideo.videoHeight;
        c.getContext('2d')?.drawImage(tempVideo, 0, 0);
        const thumb = c.toDataURL('image/jpeg', 0.7);
        setSelectedMedia(prev => [...prev, { id: Date.now().toString(), type: 'video', file, url, thumbnail: thumb }]);
      };
    };
    recorder.start();
    mediaRecorderRef.current = recorder;
    setIsRecording(true);
    setRecordingTime(0);
    recordTimerRef.current = window.setInterval(() => setRecordingTime(t => t + 1), 1000);
  }, [selectedMedia.length]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      clearInterval(recordTimerRef.current);
    }
  }, [isRecording]);

  const handleCaptureStart = useCallback(() => {
    setIsCapturing(true);
    captureTimerRef.current = window.setTimeout(() => startRecording(), 500);
  }, [startRecording]);

  const handleCaptureEnd = useCallback(() => {
    clearTimeout(captureTimerRef.current);
    if (isTakingPhotoRef.current) return;
    if (isRecording) stopRecording();
    else takePhoto();
    setIsCapturing(false);
  }, [isRecording, stopRecording, takePhoto]);

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
    const remaining = 5 - selectedMedia.length;
    Array.from(files).slice(0, remaining).forEach((file, i) => {
      const isVideo = file.type.startsWith('video/');
      const url = URL.createObjectURL(file);
      setSelectedMedia(prev => [...prev, { id: `${Date.now()}-${i}`, type: isVideo ? 'video' : 'photo', file, url }]);
    });
    e.target.value = '';
  }, [selectedMedia.length]);

  const removeMedia = useCallback((id: string) => {
    setSelectedMedia(prev => {
      const item = prev.find(m => m.id === id);
      if (item) URL.revokeObjectURL(item.url);
      return prev.filter(m => m.id !== id);
    });
  }, []);

  const moveMedia = useCallback((from: number, to: number) => {
    setSelectedMedia(prev => {
      const arr = [...prev];
      const [item] = arr.splice(from, 1);
      arr.splice(to, 0, item);
      return arr;
    });
  }, []);

  const handleNext = useCallback(() => {
    if (selectedMedia.length === 0) return;
    onNext(selectedMedia);
  }, [selectedMedia, onNext]);

  const fmtTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;

  return (
    <div className="fixed inset-0 z-[60] bg-black flex flex-col">
      {/* Camera view - takes remaining space */}
      <div className="relative flex-1 min-h-0">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="absolute inset-0 w-full h-full object-cover"
          style={{ transform: `scale(${zoom})`, transformOrigin: 'center' }}
        />
        <canvas ref={canvasRef} className="hidden" />

        {/* Top bar - safe area */}
        <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between p-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="w-9 h-9 rounded-full bg-black/50 backdrop-blur-md flex items-center justify-center active:scale-90 transition-transform"
            >
              <X className="w-4.5 h-4.5 text-white" />
            </button>
            <button
              onClick={() => setFacingMode(f => f === 'environment' ? 'user' : 'environment')}
              className="w-9 h-9 rounded-full bg-black/50 backdrop-blur-md flex items-center justify-center active:scale-90 transition-transform"
            >
              <SwitchCamera className="w-4.5 h-4.5 text-white" />
            </button>
          </div>

          {selectedMedia.length > 0 && (
            <button
              onClick={handleNext}
              className="px-5 py-2 rounded-full bg-primary text-primary-foreground text-sm font-semibold flex items-center gap-1 active:scale-95 transition-transform shadow-lg"
            >
              Keyingisi
              <ChevronRight className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Selected media strip - only here, no bottom duplicate */}
        {selectedMedia.length > 0 && (
          <div className="absolute top-14 left-2 right-2 z-20 mt-[env(safe-area-inset-top)]">
            <div
              className="flex gap-1.5 p-1.5 rounded-2xl bg-black/50 backdrop-blur-xl overflow-x-auto"
              style={{ scrollbarWidth: 'none' }}
            >
              {selectedMedia.map((item, idx) => (
                <div
                  key={item.id}
                  draggable
                  onDragStart={(e) => e.dataTransfer.setData('idx', idx.toString())}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => { e.preventDefault(); moveMedia(parseInt(e.dataTransfer.getData('idx')), idx); }}
                  className="relative flex-shrink-0"
                >
                  <div className="w-14 h-14 rounded-lg overflow-hidden border border-white/15">
                    {item.type === 'photo' ? (
                      <img src={item.url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="relative w-full h-full">
                        <img src={item.thumbnail || item.url} alt="" className="w-full h-full object-cover" />
                        <Video className="absolute inset-0 m-auto w-4 h-4 text-white drop-shadow" />
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => removeMedia(item.id)}
                    className="absolute -top-1 -right-1 w-4.5 h-4.5 rounded-full bg-destructive flex items-center justify-center shadow"
                  >
                    <X className="w-2.5 h-2.5 text-destructive-foreground" />
                  </button>
                  <span className="absolute bottom-0.5 right-0.5 text-[8px] font-bold text-white bg-black/60 rounded-full w-3.5 h-3.5 flex items-center justify-center">{idx + 1}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Zoom indicator */}
        {zoom > 1 && (
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10 pointer-events-none">
            <div className="px-3 py-1 rounded-full bg-black/50 backdrop-blur-md text-white text-xs font-medium">
              {zoom.toFixed(1)}x
            </div>
          </div>
        )}

        {/* Recording indicator */}
        {isRecording && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-30 flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-500/90 backdrop-blur-sm">
            <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
            <span className="text-white text-[11px] font-medium">{fmtTime(recordingTime)}</span>
          </div>
        )}
      </div>

      {/* Bottom controls - compact, no gallery duplicates */}
      <div className="flex-shrink-0 bg-black/90 backdrop-blur-md px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <input ref={fileInputRef} type="file" accept="image/*,video/*" multiple onChange={handleFileSelect} className="hidden" />

        <div className="flex items-center justify-between">
          {/* Gallery button */}
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={selectedMedia.length >= 5}
            className="w-12 h-12 rounded-xl bg-white/10 backdrop-blur-sm flex items-center justify-center disabled:opacity-30 active:scale-90 transition-transform"
          >
            <ImageIcon className="w-5 h-5 text-white" />
          </button>

          {/* Capture button */}
          <button
            onMouseDown={handleCaptureStart}
            onMouseLeave={() => { if (isCapturing) handleCaptureEnd(); }}
            onTouchStart={(e) => { handleCaptureStart(); handleTouchStart(e); }}
            onTouchMove={handleTouchMove}
            onTouchEnd={() => { handleCaptureEnd(); handleTouchEnd(); }}
            disabled={selectedMedia.length >= 5}
            className="relative w-[72px] h-[72px] rounded-full flex items-center justify-center disabled:opacity-30"
          >
            <div className="absolute inset-0 rounded-full border-[3px] border-white/40" />
            <div className={cn(
              'relative transition-all duration-200',
              isCapturing ? 'scale-[0.85]' : 'scale-100',
              isRecording ? 'w-8 h-8 rounded-lg bg-red-500' : 'w-[58px] h-[58px] rounded-full bg-white'
            )}>
              {isRecording && <div className="absolute inset-0 rounded-lg animate-pulse bg-red-400" />}
            </div>
            {isRecording && <div className="absolute inset-0 rounded-full border-[3px] border-red-400 animate-ping" />}
          </button>

          {/* Zoom + counter */}
          <div className="flex flex-col items-center gap-1">
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
            <span className="text-white/50 text-[10px] font-medium">{selectedMedia.length}/5</span>
          </div>
        </div>
      </div>
    </div>
  );
}
