import { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Paperclip, X, Mic, Lock, Trash2 } from 'lucide-react';
import { Icon } from '@iconify/react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import GiphyPicker from '@/components/create/GiphyPicker';
import { ChatMediaPicker } from './ChatMediaPicker';
import { cn } from '@/lib/utils';
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
  onSendMessage: (content: string, mediaUrl?: string, mediaType?: string) => Promise<void>;
  onTyping: (isTyping: boolean) => void;
}

export const ChatInput = ({ conversationId, onSendMessage, onTyping }: ChatInputProps) => {
  const { user } = useAuth();
  const [inputValue, setInputValue] = useState('');
  const [selectedMedia, setSelectedMedia] = useState<MediaFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const mediaInputRef = useRef<HTMLInputElement>(null);
  const [showMediaMenu, setShowMediaMenu] = useState(false);
  const [showGIFPicker, setShowGIFPicker] = useState(false);
  const [showMediaPicker, setShowMediaPicker] = useState(false);

  // Voice recording - Telegram style
  const {
    isRecording,
    duration,
    audioBlob,
    startRecording,
    stopRecording,
    cancelRecording,
    clearAudio,
    formatDuration
  } = useVoiceRecorder();

  const [voiceLocked, setVoiceLocked] = useState(false);
  const [showConfirmSend, setShowConfirmSend] = useState(false);
  const [voiceUploadProgress, setVoiceUploadProgress] = useState<number | undefined>();
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const isHoldingRef = useRef(false);
  const recordingStartedRef = useRef(false);

  const uploadFile = async (file: File, index: number): Promise<string | null> => {
    if (!user?.id) return null;
    try {
      return await uploadMedia(file, 'messages', user.id, (progress) => {
        setSelectedMedia(prev => {
          const next = [...prev];
          if (next[index]) {
            next[index] = { ...next[index], progress };
          }
          return next;
        });
      });
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Fayl yuklashda xatolik');
      return null;
    }
  };

  const handleSend = async (directMedia?: MediaFile[], directCaption?: string) => {
    if (!conversationId) return;
    setIsUploading(true);
    try {
      const mediaList = directMedia || selectedMedia;
      const textVal = directCaption !== undefined ? directCaption : inputValue;

      if (mediaList.length > 0) {
        // Send media files
        for (let i = 0; i < mediaList.length; i++) {
          const media = mediaList[i];
          const mediaUrl = await uploadFile(media.file, i);
          if (mediaUrl) {
            // Attach caption only to the first media
            const caption = i === 0 ? textVal.trim() : '';
            await onSendMessage(caption, mediaUrl, media.type);
            URL.revokeObjectURL(media.preview);
          }
        }
        setSelectedMedia([]);
      } else if (textVal.trim()) {
        await onSendMessage(textVal.trim());
      }
      setInputValue('');
      onTyping(false);
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error('Xabar yuborishda xatolik');
    } finally {
      setIsUploading(false);
    }
  };

  const handleSendAudio = async () => {
    if (!audioBlob || !conversationId) return;
    setIsUploading(true);
    setVoiceUploadProgress(0);
    try {
      const audioFile = new File([audioBlob], `voice_${Date.now()}.webm`, { type: 'audio/webm' });
      const mediaUrl = await uploadToR2(
        audioFile, 
        `messages/${user?.id}`, 
        undefined, 
        (progress) => setVoiceUploadProgress(progress)
      );
      if (mediaUrl) {
        await onSendMessage('🎤 Ovozli xabar', mediaUrl, 'audio');
      }
      clearAudio();
      setVoiceLocked(false);
      setShowConfirmSend(false);
    } catch (error) {
      console.error('Error sending audio:', error);
      toast.error('Ovozli xabar yuborishda xatolik');
    } finally {
      setIsUploading(false);
      setVoiceUploadProgress(undefined);
    }
  };

  // Telegram-style hold-to-record
  const handleMicDown = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    isHoldingRef.current = true;
    recordingStartedRef.current = false;
    
    const touch = 'touches' in e ? e.touches[0] : e;
    touchStartRef.current = { x: touch.clientX, y: touch.clientY };

    // Start recording after 500ms hold
    holdTimerRef.current = setTimeout(() => {
      if (isHoldingRef.current) {
        recordingStartedRef.current = true;
        startRecording();
      }
    }, 500);
  }, [startRecording]);

  const handleMicMove = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    if (!isHoldingRef.current || !touchStartRef.current || !recordingStartedRef.current) return;
    
    const touch = 'touches' in e ? e.touches[0] : e;
    const deltaX = touchStartRef.current.x - touch.clientX;
    const deltaY = touchStartRef.current.y - touch.clientY;

    // Slide left to cancel (>80px)
    if (deltaX > 80) {
      cancelRecording();
      isHoldingRef.current = false;
      recordingStartedRef.current = false;
      touchStartRef.current = null;
      return;
    }

    // Slide up to lock (>60px)
    if (deltaY > 60) {
      setVoiceLocked(true);
    }
  }, [cancelRecording]);

  const handleMicUp = useCallback(() => {
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
    isHoldingRef.current = false;

    if (!recordingStartedRef.current) {
      touchStartRef.current = null;
      return;
    }

    if (voiceLocked) {
      // Keep recording, show send/cancel UI
      setShowConfirmSend(true);
      return;
    }

    // Release = show confirm dialog
    if (isRecording) {
      stopRecording();
      setShowConfirmSend(true);
    }
    touchStartRef.current = null;
  }, [voiceLocked, isRecording, stopRecording]);

  const handleCancelVoice = () => {
    cancelRecording();
    setVoiceLocked(false);
    setShowConfirmSend(false);
  };

  const handleStopLocked = () => {
    stopRecording();
    setShowConfirmSend(true);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
    onTyping(true);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const newMediaItems: MediaFile[] = files.map(file => ({
      file,
      preview: URL.createObjectURL(file),
      type: file.type.startsWith('video/') ? 'video' : 'image'
    }));

    setSelectedMedia(prev => [...prev, ...newMediaItems]);
    e.target.value = '';
  };

  const handleRemoveMedia = (index: number) => {
    const itemToRemove = selectedMedia[index];
    if (itemToRemove?.preview) URL.revokeObjectURL(itemToRemove.preview);
    setSelectedMedia(prev => {
      const next = [...prev];
      next.splice(index, 1);
      return next;
    });
  };

  const hasText = inputValue.trim().length > 0;
  const hasMedia = selectedMedia.length > 0;
  const showSend = hasText || hasMedia;

  // Recording active UI (Telegram-style fullwidth recording bar)
  if (isRecording && !showConfirmSend) {
    return (
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-transparent border-none pointer-events-none" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <div className="mx-2 mb-3 rounded-2xl bg-background/90 dark:bg-zinc-900/90 backdrop-blur-xl border border-border/40 p-3 shadow-lg shadow-black/5 pointer-events-auto">
          <div className="flex items-center gap-3">
            {/* Cancel - slide left hint */}
            <button onClick={handleCancelVoice} className="p-2 rounded-full hover:bg-destructive/10 transition-colors">
              <Trash2 className="h-5 w-5 text-destructive" />
            </button>

            {/* Recording indicator */}
            <div className="flex-1 flex items-center gap-3">
              <span className="w-2.5 h-2.5 bg-destructive rounded-full animate-pulse" />
              <span className="text-sm font-medium text-destructive">{formatDuration(duration)}</span>
              <span className="text-xs text-muted-foreground">◄ Bekor qilish uchun suring</span>
            </div>

            {/* Lock indicator */}
            {!voiceLocked && (
              <div className="flex flex-col items-center animate-bounce">
                <Lock className="h-4 w-4 text-muted-foreground" />
                <span className="text-[10px] text-muted-foreground">▲</span>
              </div>
            )}

            {/* If locked, show stop button */}
            {voiceLocked && (
              <button 
                onClick={handleStopLocked}
                className="w-10 h-10 rounded-full bg-destructive flex items-center justify-center"
              >
                <div className="w-4 h-4 rounded-sm bg-destructive-foreground" />
              </button>
            )}

            {/* Hold mic button */}
            {!voiceLocked && (
              <div
                onTouchEnd={handleMicUp}
                onMouseUp={handleMicUp}
                onTouchMove={handleMicMove}
                onMouseMove={handleMicMove}
                className="w-12 h-12 rounded-full bg-primary flex items-center justify-center shadow-lg scale-110 transition-transform"
              >
                <Mic className="h-6 w-6 text-primary-foreground" />
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Audio recorded - confirm send
  if (showConfirmSend && audioBlob) {
    return (
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-transparent border-none pointer-events-none" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <div className="mx-2 mb-3 rounded-2xl bg-background/90 dark:bg-zinc-900/90 backdrop-blur-xl border border-border/40 p-3 shadow-lg shadow-black/5 pointer-events-auto">
          <div className="flex items-center gap-3">
            <button onClick={handleCancelVoice} className="p-2 rounded-full hover:bg-destructive/10 transition-colors">
              <Trash2 className="h-5 w-5 text-destructive" />
            </button>

            <div className="flex-1 flex items-center gap-2">
              <Mic className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">{formatDuration(duration)}</span>
              <span className="text-xs text-muted-foreground">Ovozli xabar</span>
            </div>

            <button 
              onClick={handleSendAudio} 
              disabled={isUploading}
              className="w-10 h-10 rounded-full bg-gradient-to-tr from-emerald-600 to-emerald-500 flex items-center justify-center shadow-lg hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              <Icon icon="heroicons:paper-airplane-16-solid" className="h-5 w-5 text-white" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Normal chat input
  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-transparent border-none pointer-events-none" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
      {/* Selected media preview */}
      {selectedMedia.length > 0 && (
        <div className="mx-3 mt-1 mb-2 flex flex-wrap gap-2 pointer-events-auto">
          {selectedMedia.map((media, index) => (
            <div key={index} className="relative inline-block">
              <div className="relative w-16 h-16 rounded-xl overflow-hidden border border-border/30 bg-muted">
                {media.type === 'image' ? (
                  <img src={media.preview} alt="" className="w-full h-full object-cover" />
                ) : (
                  <video src={media.preview} className="w-full h-full object-cover" />
                )}
                
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

      {/* Input bar */}
      <div className="flex items-center bg-background/90 dark:bg-zinc-900/90 backdrop-blur-xl border border-border/40 rounded-[28px] mx-3 mb-3 gap-2 px-3 py-2 shadow-lg shadow-black/5 pointer-events-auto">
        {/* Attach button — opens Telegram-style picker */}
        <button 
          type="button"
          onClick={() => setShowMediaPicker(true)}
          className="w-[2.25rem] h-[2.25rem] rounded-full flex items-center justify-center hover:bg-muted/50 transition-colors shrink-0"
        >
          <Paperclip className="h-[1.25rem] w-[1.25rem] text-muted-foreground" />
        </button>

        {/* GIF button - standalone premium */}
        <button
          type="button"
          onClick={() => setShowGIFPicker(true)}
          className="w-[2.25rem] h-[2.25rem] rounded-full flex items-center justify-center hover:bg-violet-500/15 transition-all active:scale-90 shrink-0"
          aria-label="GIF qidirish"
        >
          <Icon icon="mage:gif-fill" className="h-[1.5rem] w-[1.5rem] text-violet-500" />
        </button>

        {/* Text input */}
        <input
          ref={inputRef}
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder="Xabar yozing..."
          className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none w-full min-w-0"
          disabled={isUploading}
        />

        {/* Send or Mic button */}
        {showSend ? (
          <button
            onClick={() => handleSend()}
            disabled={isUploading}
            className="w-[2.25rem] h-[2.25rem] rounded-full bg-green-500 flex items-center justify-center shadow-md hover:opacity-90 transition-all active:scale-90 disabled:opacity-50 shrink-0"
          >
            <Icon icon="heroicons:paper-airplane-16-solid" className="h-[1.35rem] w-[1.35rem] text-white" />
          </button>
        ) : (
          <div
            onTouchStart={handleMicDown}
            onMouseDown={handleMicDown}
            onTouchEnd={handleMicUp}
            onMouseUp={handleMicUp}
            onTouchMove={handleMicMove}
            onMouseMove={handleMicMove}
            className="w-[2.25rem] h-[2.25rem] rounded-full flex items-center justify-center hover:bg-muted/50 transition-all cursor-pointer select-none shrink-0"
          >
            <Mic className="h-[1.25rem] w-[1.25rem] text-muted-foreground" />
          </div>
        )}
      </div>

      {/* GIF Picker Overlay */}
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
                  try {
                    await onSendMessage('', url, 'image');
                  } catch (e) {
                    toast.error('Xatolik yuz berdi');
                  } finally {
                    setIsUploading(false);
                    setShowGIFPicker(false);
                  }
                }
              }}
              onClose={() => setShowGIFPicker(false)}
            />
          </div>
        </div>
      )}

      {/* Telegram-style Media Picker Sheet */}
      <Sheet open={showMediaPicker} onOpenChange={setShowMediaPicker}>
        <SheetContent side="bottom" className="p-0 h-[88vh] border-none bg-transparent">
          <ChatMediaPicker
            onSend={(media, caption) => {
              setShowMediaPicker(false);
              handleSend(media, caption);
            }}
            onClose={() => setShowMediaPicker(false)}
          />
        </SheetContent>
      </Sheet>
    </div>
  );
};
