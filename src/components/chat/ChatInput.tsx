import { useState, useRef, useCallback, useEffect } from 'react';
import { Paperclip, X, Mic } from 'lucide-react';
import { Icon } from '@iconify/react';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import GiphyPicker from '@/components/create/GiphyPicker';
import { ChatMediaPicker } from './ChatMediaPicker';
import { VoiceRecorderBar } from './VoiceRecorderBar';
import { useVoiceRecorder } from '@/hooks/useVoiceRecorder';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { uploadMedia, uploadToR2 } from '@/lib/r2Upload';
import { MediaUploadProgress } from './MediaUploadProgress';

interface MediaFile {
  file: File;
  preview: string;
  type: 'image' | 'video';
  progress?: number;
}

interface ChatInputProps {
  conversationId: string | null;
  onSendMessage: (
    content: string,
    mediaUrl?: string,
    mediaType?: string,
    waveformData?: number[],
  ) => Promise<void>;
  onTyping: (isTyping: boolean) => void;
}

type RecorderUIState = 'idle' | 'recording' | 'locked' | 'uploading';

export const ChatInput = ({ conversationId, onSendMessage, onTyping }: ChatInputProps) => {
  const { user } = useAuth();
  const [inputValue, setInputValue]       = useState('');
  const [selectedMedia, setSelectedMedia] = useState<MediaFile[]>([]);
  const [isUploading, setIsUploading]     = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const [showGIFPicker, setShowGIFPicker]     = useState(false);
  const [showMediaPicker, setShowMediaPicker] = useState(false);

  const {
    isRecording,
    duration,
    audioBlob,
    waveformData,
    recordedWaveformSnapshot,
    startRecording,
    stopRecording,
    cancelRecording,
    clearAudio,
    formatDuration,
    getDurationMs,
  } = useVoiceRecorder();

  const [recorderState, setRecorderState] = useState<RecorderUIState>('idle');
  const [voiceUploadProgress, setVoiceUploadProgress] = useState<number | undefined>();

  const [dragDelta, setDragDelta] = useState({ x: 0, y: 0 });

  const gestureState = useRef({
    isHolding: false,
    recordingStarted: false,
    locked: false,
    touchStart: null as { x: number; y: number } | null,
    isRecording: false,
  });

  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    gestureState.current.isRecording = isRecording;
  }, [isRecording]);

  const uploadFile = async (file: File, index: number): Promise<string | null> => {
    if (!user?.id) return null;
    try {
      return await uploadMedia(file, 'messages', user.id, (progress) => {
        setSelectedMedia(prev => {
          const next = [...prev];
          if (next[index]) next[index] = { ...next[index], progress };
          return next;
        });
      });
    } catch {
      toast.error('Fayl yuklashda xatolik');
      return null;
    }
  };

  const handleSend = async (directMedia?: MediaFile[], directCaption?: string) => {
    if (!conversationId) return;
    setIsUploading(true);
    try {
      const mediaList = directMedia || selectedMedia;
      const textVal   = directCaption !== undefined ? directCaption : inputValue;

      if (mediaList.length > 0) {
        for (let i = 0; i < mediaList.length; i++) {
          const media    = mediaList[i];
          const mediaUrl = await uploadFile(media.file, i);
          if (mediaUrl) {
            await onSendMessage(i === 0 ? textVal.trim() : '', mediaUrl, media.type);
            URL.revokeObjectURL(media.preview);
          }
        }
        setSelectedMedia([]);
      } else if (textVal.trim()) {
        await onSendMessage(textVal.trim());
      }
      setInputValue('');
      onTyping(false);
    } catch {
      toast.error('Xabar yuborishda xatolik');
    } finally {
      setIsUploading(false);
    }
  };

  const handleUploadAndSendAudio = useCallback(async (blob: Blob, snapshot: number[]) => {
    if (!blob || blob.size === 0 || !conversationId) {
      toast.error("Ovozli xabar bo'sh");
      setRecorderState('idle');
      return;
    }
    setRecorderState('uploading');
    setIsUploading(true);
    setVoiceUploadProgress(0);
    try {
      const audioFile = new File([blob], `voice_${Date.now()}.webm`, { type: 'audio/webm' });
      const mediaUrl  = await uploadToR2(
        audioFile,
        `messages/${user?.id}`,
        undefined,
        (p) => setVoiceUploadProgress(p),
      );
      if (mediaUrl) {
        await onSendMessage('🎤 Ovozli xabar', mediaUrl, 'audio', snapshot);
      }
      clearAudio();
    } catch {
      toast.error('Ovozli xabar yuborishda xatolik');
    } finally {
      setIsUploading(false);
      setVoiceUploadProgress(undefined);
      setRecorderState('idle');
    }
  }, [conversationId, user?.id, onSendMessage, clearAudio]);

  const handleCancelVoice = useCallback(() => {
    cancelRecording();
    gestureState.current.locked = false;
    setDragDelta({ x: 0, y: 0 });
    setRecorderState('idle');
  }, [cancelRecording]);

  const handleLock = useCallback(() => {
    if (gestureState.current.locked) return;
    gestureState.current.locked = true;
    setDragDelta({ x: 0, y: 0 });
    setRecorderState('locked');
  }, []);

  const handleMicPointerDown = useCallback((e: React.PointerEvent) => {
    if (recorderState !== 'idle') return;
    
    e.currentTarget.setPointerCapture(e.pointerId);
    
    gestureState.current.isHolding = true;
    gestureState.current.recordingStarted = false;
    gestureState.current.locked = false;
    gestureState.current.touchStart = { x: e.clientX, y: e.clientY };
    setDragDelta({ x: 0, y: 0 });

    holdTimerRef.current = setTimeout(async () => {
      if (gestureState.current.isHolding) {
        gestureState.current.recordingStarted = true;
        setRecorderState(gestureState.current.locked ? 'locked' : 'recording');
        
        await startRecording();
        
        if (!gestureState.current.isHolding && !gestureState.current.locked) {
          cancelRecording();
          setRecorderState('idle');
        }
      }
    }, 150);
  }, [recorderState, startRecording, cancelRecording]);

  const handleMicPointerMove = useCallback((e: React.PointerEvent) => {
    if (!gestureState.current.isHolding || !gestureState.current.touchStart) return;
    if (gestureState.current.locked) return;

    const deltaX = gestureState.current.touchStart.x - e.clientX;
    const deltaY = gestureState.current.touchStart.y - e.clientY;

    setDragDelta({ x: Math.max(0, deltaX), y: Math.max(0, deltaY) });

    if (deltaX > 80) {
      handleCancelVoice();
      gestureState.current.isHolding = false;
      gestureState.current.recordingStarted = false;
      gestureState.current.touchStart = null;
    } else if (deltaY > 60) {
      handleLock();
    }
  }, [handleCancelVoice, handleLock]);

  const handleMicPointerUp = useCallback(async (e: React.PointerEvent) => {
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
    
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch {}

    const wasRecordingStarted = gestureState.current.recordingStarted;
    const isLocked = gestureState.current.locked;

    const wasHolding = gestureState.current.isHolding;
    gestureState.current.isHolding = false;
    setDragDelta({ x: 0, y: 0 });

    if (!wasRecordingStarted) {
      if (wasHolding) {
        toast.info('Ovozli xabar yozish uchun bosib turing', { id: 'voice-hint' });
      }
      cancelRecording();
      setRecorderState('idle');
      return;
    }

    if (isLocked) return;

    if (getDurationMs() < 300) {
      toast.error('Ovozli xabar juda qisqa');
      handleCancelVoice();
    } else {
      const result = await stopRecording();
      await handleUploadAndSendAudio(result.blob, result.snapshot);
    }
  }, [cancelRecording, stopRecording, handleUploadAndSendAudio, handleCancelVoice, getDurationMs]);

  const handleMicPointerCancel = useCallback((e: React.PointerEvent) => {
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
    
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch {}

    if (gestureState.current.recordingStarted && !gestureState.current.locked) {
      handleCancelVoice();
    }
    gestureState.current.isHolding = false;
    gestureState.current.recordingStarted = false;
    gestureState.current.touchStart = null;
    setDragDelta({ x: 0, y: 0 });
  }, [handleCancelVoice]);

  const handleStopLocked = useCallback(async () => {
    if (getDurationMs() < 300) {
      toast.error('Ovozli xabar juda qisqa');
      handleCancelVoice();
      return;
    }
    const result = await stopRecording();
    gestureState.current.locked = false;
    await handleUploadAndSendAudio(result.blob, result.snapshot);
  }, [getDurationMs, stopRecording, handleUploadAndSendAudio, handleCancelVoice]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
    onTyping(true);
  };
  
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    const newItems: MediaFile[] = files.map(file => ({
      file,
      preview: URL.createObjectURL(file),
      type: file.type.startsWith('video/') ? 'video' : 'image',
    }));
    setSelectedMedia(prev => [...prev, ...newItems]);
    e.target.value = '';
  };
  
  const handleRemoveMedia = (index: number) => {
    const item = selectedMedia[index];
    if (item?.preview) URL.revokeObjectURL(item.preview);
    setSelectedMedia(prev => { const next = [...prev]; next.splice(index, 1); return next; });
  };

  const hasText  = inputValue.trim().length > 0;
  const hasMedia = selectedMedia.length > 0;
  const showSend = hasText || hasMedia;

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-50 bg-transparent border-none pointer-events-none"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {selectedMedia.length > 0 && (
        <div className="mx-3 mt-1 mb-2 flex flex-wrap gap-2 pointer-events-auto">
          {selectedMedia.map((media, index) => (
            <div key={index} className="relative inline-block">
              <div className="relative w-16 h-16 rounded-xl overflow-hidden border border-border/30 bg-muted">
                {media.type === 'image'
                  ? <img src={media.preview} alt="" className="w-full h-full object-cover" />
                  : <video src={media.preview} className="w-full h-full object-cover" />
                }
                {media.progress !== undefined && media.progress < 100 && (
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                    <MediaUploadProgress progress={media.progress} size={24} />
                  </div>
                )}
                <button
                  onClick={() => handleRemoveMedia(index)}
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center shadow-sm"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="relative pointer-events-auto mx-3 mb-3">
        {/* Input bar */}
        <div 
          className="flex items-center bg-background/90 dark:bg-zinc-900/90 backdrop-blur-xl border border-border/40 rounded-[28px] gap-2 px-3 py-2 shadow-lg shadow-black/5"
          style={{ opacity: recorderState !== 'idle' ? 0 : 1, transition: 'opacity 0.2s' }}
        >
          <button
            type="button"
            onClick={() => setShowMediaPicker(true)}
            className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-muted/50 transition-colors shrink-0"
            style={{ visibility: recorderState !== 'idle' ? 'hidden' : 'visible' }}
          >
            <Paperclip className="h-5 w-5 text-muted-foreground" />
          </button>

          <button
            type="button"
            onClick={() => setShowGIFPicker(true)}
            className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-violet-500/15 transition-all active:scale-90 shrink-0"
            aria-label="GIF qidirish"
            style={{ visibility: recorderState !== 'idle' ? 'hidden' : 'visible' }}
          >
            <Icon icon="mage:gif-fill" className="h-6 w-6 text-violet-500" />
          </button>

          <input
            ref={inputRef}
            value={inputValue}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="Xabar yozing..."
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none w-full min-w-0"
            disabled={isUploading || recorderState !== 'idle'}
            style={{ visibility: recorderState !== 'idle' ? 'hidden' : 'visible' }}
          />

          {showSend ? (
            <button
              onClick={() => handleSend()}
              disabled={isUploading}
              className="w-9 h-9 rounded-full bg-green-500 flex items-center justify-center shadow-md hover:opacity-90 transition-all active:scale-90 disabled:opacity-50 shrink-0"
              style={{ visibility: recorderState !== 'idle' ? 'hidden' : 'visible' }}
            >
              <Icon icon="heroicons:paper-airplane-16-solid" className="h-5 w-5 text-white" />
            </button>
          ) : (
            <div
              onPointerDown={handleMicPointerDown}
              onPointerMove={handleMicPointerMove}
              onPointerUp={handleMicPointerUp}
              onPointerCancel={handleMicPointerCancel}
              className="w-9 h-9 rounded-full flex items-center justify-center transition-all cursor-pointer select-none touch-none shrink-0"
              style={{ touchAction: 'none' }}
            >
              {/* Keep mic icon visible even when opacity is 0 so pointer events trigger correctly if needed? Actually we don't care about visibility, opacity handles it */}
              <Mic className="h-5 w-5 text-muted-foreground" />
            </div>
          )}
        </div>

        {/* Recorder overlay */}
        {recorderState !== 'idle' && (
          <div className="absolute inset-0 z-10">
            <VoiceRecorderBar
              state={recorderState === 'locked' ? 'locked' : recorderState === 'uploading' ? 'uploading' : 'recording'}
              duration={duration}
              waveformData={waveformData}
              isUploading={isUploading}
              uploadProgress={voiceUploadProgress}
              formatDuration={formatDuration}
              dragDelta={dragDelta}
              onCancel={handleCancelVoice}
              onLock={handleLock}
              onStop={handleStopLocked}
              onMicPointerDown={() => {}}
              onMicPointerMove={() => {}}
              onMicPointerUp={() => {}}
              onMicPointerCancel={() => {}}
            />
          </div>
        )}
      </div>

      {showGIFPicker && (
        <div
          className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex flex-col justify-end pointer-events-auto"
          onClick={() => setShowGIFPicker(false)}
        >
          <div onClick={(e) => e.stopPropagation()} className="relative">
            <GiphyPicker
              onSelect={async (gif) => {
                const url = gif.originalUrl || gif.previewUrl;
                if (!isUploading && url) {
                  setIsUploading(true);
                  try { await onSendMessage('', url, 'image'); }
                  catch { toast.error('Xatolik yuz berdi'); }
                  finally { setIsUploading(false); setShowGIFPicker(false); }
                }
              }}
              onClose={() => setShowGIFPicker(false)}
            />
          </div>
        </div>
      )}

      <Sheet open={showMediaPicker} onOpenChange={setShowMediaPicker}>
        <SheetContent side="bottom" className="p-0 h-[88vh] border-none bg-transparent">
          <ChatMediaPicker
            onSend={(media, caption) => { setShowMediaPicker(false); handleSend(media, caption); }}
            onClose={() => setShowMediaPicker(false)}
          />
        </SheetContent>
      </Sheet>
    </div>
  );
};
