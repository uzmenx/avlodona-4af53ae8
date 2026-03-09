import { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Paperclip, Image, Video, X, Mic, Lock, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useVoiceRecorder } from '@/hooks/useVoiceRecorder';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { uploadMedia, uploadToR2 } from '@/lib/r2Upload';

interface MediaFile {
  file: File;
  preview: string;
  type: 'image' | 'video';
}

interface ChatInputProps {
  conversationId: string | null;
  onSendMessage: (content: string, mediaUrl?: string, mediaType?: string) => Promise<void>;
  onTyping: (isTyping: boolean) => void;
}

export const ChatInput = ({ conversationId, onSendMessage, onTyping }: ChatInputProps) => {
  const { user } = useAuth();
  const [inputValue, setInputValue] = useState('');
  const [selectedMedia, setSelectedMedia] = useState<MediaFile | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const [showMediaMenu, setShowMediaMenu] = useState(false);

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
  const holdTimerRef = useRef<NodeJS.Timeout | null>(null);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const isHoldingRef = useRef(false);
  const recordingStartedRef = useRef(false);

  const uploadFile = async (file: File): Promise<string | null> => {
    if (!user?.id) return null;
    try {
      return await uploadMedia(file, 'messages', user.id);
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Fayl yuklashda xatolik');
      return null;
    }
  };

  const handleSend = async () => {
    if (!conversationId) return;
    setIsUploading(true);
    try {
      if (selectedMedia) {
        const mediaUrl = await uploadFile(selectedMedia.file);
        if (mediaUrl) {
          await onSendMessage(inputValue.trim() || '', mediaUrl, selectedMedia.type);
          URL.revokeObjectURL(selectedMedia.preview);
          setSelectedMedia(null);
        }
      } else if (inputValue.trim()) {
        await onSendMessage(inputValue.trim());
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
    try {
      const audioFile = new File([audioBlob], `voice_${Date.now()}.webm`, { type: 'audio/webm' });
      const mediaUrl = await uploadToR2(audioFile, `messages/${user?.id}`);
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

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>, type: 'image' | 'video') => {
    const file = e.target.files?.[0];
    if (!file) return;
    const preview = URL.createObjectURL(file);
    setSelectedMedia({ file, preview, type });
    setShowMediaMenu(false);
    e.target.value = '';
  };

  const handleRemoveMedia = () => {
    if (selectedMedia?.preview) URL.revokeObjectURL(selectedMedia.preview);
    setSelectedMedia(null);
  };

  const hasText = inputValue.trim().length > 0;
  const hasMedia = !!selectedMedia;
  const showSend = hasText || hasMedia;

  // Recording active UI (Telegram-style fullwidth recording bar)
  if (isRecording && !showConfirmSend) {
    return (
      <div className="safe-area-bottom">
        <div className="mx-2 mb-2 rounded-2xl bg-background/80 backdrop-blur-xl border border-border/30 p-3">
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
      <div className="safe-area-bottom">
        <div className="mx-2 mb-2 rounded-2xl bg-background/80 backdrop-blur-xl border border-border/30 p-3">
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
              className="w-10 h-10 rounded-full bg-primary flex items-center justify-center shadow-lg hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              <Send className="h-5 w-5 text-primary-foreground" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Normal chat input
  return (
    <div className="safe-area-bottom">
      {/* Selected media preview */}
      {selectedMedia && (
        <div className="mx-2 mt-1 mb-1">
          <div className="relative inline-block">
            <div className="relative w-16 h-16 rounded-xl overflow-hidden border border-border/30 bg-muted">
              {selectedMedia.type === 'image' ? (
                <img src={selectedMedia.preview} alt="" className="w-full h-full object-cover" />
              ) : (
                <video src={selectedMedia.preview} className="w-full h-full object-cover" />
              )}
              <button
                onClick={handleRemoveMedia}
                className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center shadow-sm"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Input bar */}
      <div className="mx-2 mb-2 rounded-2xl bg-background/50 backdrop-blur-xl border border-border/30 p-1.5 flex items-center gap-1.5" style={{ paddingBottom: 'max(6px, env(safe-area-inset-bottom))' }}>
        {/* Attach button */}
        <div className="relative">
          <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => handleFileSelect(e, 'image')} />
          <input ref={videoInputRef} type="file" accept="video/*" className="hidden" onChange={(e) => handleFileSelect(e, 'video')} />
          
          <button 
            onClick={() => setShowMediaMenu(!showMediaMenu)}
            className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-muted/50 transition-colors"
          >
            <Paperclip className="h-5 w-5 text-muted-foreground" />
          </button>

          {showMediaMenu && (
            <div className="absolute bottom-12 left-0 bg-popover/95 backdrop-blur-xl border border-border/30 rounded-xl shadow-lg p-1.5 flex gap-1 z-50">
              <button 
                onClick={() => { imageInputRef.current?.click(); }}
                className="w-10 h-10 rounded-lg flex items-center justify-center hover:bg-muted/50 transition-colors"
              >
                <Image className="h-5 w-5 text-primary" />
              </button>
              <button 
                onClick={() => { videoInputRef.current?.click(); }}
                className="w-10 h-10 rounded-lg flex items-center justify-center hover:bg-muted/50 transition-colors"
              >
                <Video className="h-5 w-5 text-primary" />
              </button>
            </div>
          )}
        </div>

        {/* Text input */}
        <input
          ref={inputRef}
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => setShowMediaMenu(false)}
          placeholder="Xabar yozing..."
          className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none py-2 px-1"
          disabled={isUploading}
        />

        {/* Send or Mic button */}
        {showSend ? (
          <button
            onClick={handleSend}
            disabled={isUploading}
            className="w-9 h-9 rounded-full bg-primary flex items-center justify-center shadow-sm hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            <Send className="h-4 w-4 text-primary-foreground" />
          </button>
        ) : (
          <div
            onTouchStart={handleMicDown}
            onMouseDown={handleMicDown}
            onTouchEnd={handleMicUp}
            onMouseUp={handleMicUp}
            onTouchMove={handleMicMove}
            onMouseMove={handleMicMove}
            className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-muted/50 transition-all cursor-pointer select-none"
          >
            <Mic className="h-5 w-5 text-muted-foreground" />
          </div>
        )}
      </div>
    </div>
  );
};
