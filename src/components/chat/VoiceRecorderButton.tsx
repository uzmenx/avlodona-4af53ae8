import { Mic, Square, X, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface VoiceRecorderButtonProps {
  isRecording: boolean;
  duration: number;
  hasAudio: boolean;
  formatDuration: (seconds: number) => string;
  onStartRecording: () => void;
  onStopRecording: () => void;
  onCancelRecording: () => void;
  onSendAudio: () => void;
}

export const VoiceRecorderButton = ({
  isRecording,
  duration,
  hasAudio,
  formatDuration,
  onStartRecording,
  onStopRecording,
  onCancelRecording,
  onSendAudio
}: VoiceRecorderButtonProps) => {
  if (hasAudio) {
    return (
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          onClick={onCancelRecording}
          className="text-destructive hover:text-destructive"
        >
          <X className="h-5 w-5" />
        </Button>
        <div className="px-3 py-1 bg-muted rounded-full text-sm">
          {formatDuration(duration)}
        </div>
        <Button
          size="icon"
          onClick={onSendAudio}
        >
          <Send className="h-5 w-5" />
        </Button>
      </div>
    );
  }

  if (isRecording) {
    return (
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          onClick={onCancelRecording}
          className="text-destructive hover:text-destructive"
        >
          <X className="h-5 w-5" />
        </Button>
        
        <div className="flex items-center gap-2 px-3 py-1 bg-destructive/10 rounded-full">
          <span className="w-2 h-2 bg-destructive rounded-full animate-pulse" />
          <span className="text-sm text-destructive font-medium">
            {formatDuration(duration)}
          </span>
        </div>

        <Button
          size="icon"
          variant="destructive"
          onClick={onStopRecording}
        >
          <Square className="h-4 w-4 fill-current" />
        </Button>
      </div>
    );
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={onStartRecording}
      className="h-10 w-10"
    >
      <Mic className="h-5 w-5 text-muted-foreground" />
    </Button>
  );
};
