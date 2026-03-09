import { useState, useRef, useEffect, useMemo } from 'react';
import { Play, Pause, Mic } from 'lucide-react';
import { cn } from '@/lib/utils';

interface VoiceMessageProps {
  audioUrl: string;
  isMine: boolean;
}

export const VoiceMessage = ({ audioUrl, isMine }: VoiceMessageProps) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);
  const progressBarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleLoadedMetadata = () => {
      if (audio.duration && isFinite(audio.duration)) {
        setDuration(audio.duration);
      }
    };
    const handleDurationChange = () => {
      if (audio.duration && isFinite(audio.duration)) {
        setDuration(audio.duration);
      }
    };
    const handleTimeUpdate = () => {
      if (audio.duration && isFinite(audio.duration)) {
        setProgress((audio.currentTime / audio.duration) * 100);
        setCurrentTime(audio.currentTime);
      }
    };
    const handleEnded = () => { setIsPlaying(false); setProgress(0); setCurrentTime(0); };

    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('durationchange', handleDurationChange);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('ended', handleEnded);
    return () => {
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('durationchange', handleDurationChange);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('ended', handleEnded);
    };
  }, []);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) audio.pause(); else audio.play();
    setIsPlaying(!isPlaying);
  };

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const audio = audioRef.current;
    const bar = progressBarRef.current;
    if (!audio || !bar || !isFinite(audio.duration)) return;
    const rect = bar.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    audio.currentTime = pct * audio.duration;
    setProgress(pct * 100);
  };

  const formatTime = (s: number) => {
    if (!s || !isFinite(s) || isNaN(s)) return '0:00';
    return `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, '0')}`;
  };

  const waveformBars = useMemo(() => 
    Array.from({ length: 28 }, (_, i) => 22 + Math.sin(i * 0.7) * 20 + Math.random() * 14),
  []);

  return (
    <div className="flex items-center gap-2.5 min-w-[200px]">
      <audio ref={audioRef} src={audioUrl} preload="metadata" />
      
      {/* Play button */}
      <button
        onClick={togglePlay}
        className={cn(
          "flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center transition-all",
          isMine 
            ? "bg-primary-foreground/20 hover:bg-primary-foreground/30" 
            : "bg-primary/15 hover:bg-primary/25"
        )}
      >
        {isPlaying ? (
          <Pause className={cn("h-4 w-4", isMine ? "text-primary-foreground" : "text-foreground")} />
        ) : (
          <Play className={cn("h-4 w-4 ml-0.5", isMine ? "text-primary-foreground" : "text-foreground")} />
        )}
      </button>

      <div className="flex-1 flex flex-col gap-1">
        {/* Waveform */}
        <div 
          ref={progressBarRef}
          className="flex items-center gap-[2px] h-6 cursor-pointer"
          onClick={handleProgressClick}
        >
          {waveformBars.map((height, i) => {
            const barPct = (i / waveformBars.length) * 100;
            const isActive = barPct <= progress;
            return (
              <div
                key={i}
                className={cn(
                  "w-[3px] rounded-full transition-colors duration-150",
                  isActive
                    ? isMine ? "bg-primary-foreground" : "bg-primary"
                    : isMine ? "bg-primary-foreground/25" : "bg-muted-foreground/25"
                )}
                style={{ height: `${height}%` }}
              />
            );
          })}
        </div>

        <span className={cn(
          "text-[10px] tabular-nums",
          isMine ? "text-primary-foreground/60" : "text-muted-foreground"
        )}>
          {isPlaying ? formatTime(currentTime) : formatTime(duration)}
        </span>
      </div>
    </div>
  );
};
