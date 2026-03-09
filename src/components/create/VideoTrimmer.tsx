import { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Play, Pause, Scissors, Check, Loader2 } from 'lucide-react';

interface VideoTrimmerProps {
  src: string;
  file: File;
  maxDuration?: number;
  onTrimmed: (blob: Blob) => void;
  onCancel: () => void;
}

const VideoTrimmer = ({ src, file, maxDuration = 15, onTrimmed, onCancel }: VideoTrimmerProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [duration, setDuration] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [range, setRange] = useState<[number, number]>([0, maxDuration]);
  const [processing, setProcessing] = useState(false);
  const [currentTime, setCurrent] = useState(0);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const onLoaded = () => {
      const d = v.duration;
      setDuration(d);
      setRange([0, Math.min(d, maxDuration)]);
    };
    const onTime = () => setCurrent(v.currentTime);
    v.addEventListener('loadedmetadata', onLoaded);
    v.addEventListener('timeupdate', onTime);
    return () => {
      v.removeEventListener('loadedmetadata', onLoaded);
      v.removeEventListener('timeupdate', onTime);
    };
  }, [maxDuration]);

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (playing) {
      v.pause();
    } else {
      if (v.currentTime < range[0] || v.currentTime >= range[1]) {
        v.currentTime = range[0];
      }
      v.play();
    }
    setPlaying(!playing);
  };

  useEffect(() => {
    const v = videoRef.current;
    if (!v || !playing) return;
    if (v.currentTime >= range[1]) {
      v.pause();
      setPlaying(false);
    }
  }, [currentTime, range, playing]);

  const handleRangeChange = (vals: number[]) => {
    let [start, end] = vals;
    if (end - start > maxDuration) {
      end = start + maxDuration;
    }
    setRange([start, Math.min(end, duration)]);
    if (videoRef.current) {
      videoRef.current.currentTime = start;
    }
  };

  const handleTrim = async () => {
    setProcessing(true);
    try {
      const { FFmpeg } = await import('@ffmpeg/ffmpeg');
      const { fetchFile } = await import('@ffmpeg/util');

      const ffmpeg = new FFmpeg();
      await ffmpeg.load({
        coreURL: 'https://unpkg.com/@ffmpeg/core@0.12.10/dist/esm/ffmpeg-core.js',
        wasmURL: 'https://unpkg.com/@ffmpeg/core@0.12.10/dist/esm/ffmpeg-core.wasm',
      });

      const inputName = 'input.mp4';
      const outputName = 'output.mp4';
      await ffmpeg.writeFile(inputName, await fetchFile(file));

      const startSec = range[0].toFixed(2);
      const dur = (range[1] - range[0]).toFixed(2);

      await ffmpeg.exec([
        '-i', inputName,
        '-ss', startSec,
        '-t', dur,
        '-c', 'copy',
        '-avoid_negative_ts', 'make_zero',
        outputName,
      ]);

      const data = await ffmpeg.readFile(outputName);
      const uint8 = data instanceof Uint8Array ? data : new TextEncoder().encode(data as string);
      const blob = new Blob([new Uint8Array(uint8)], { type: 'video/mp4' });
      onTrimmed(blob);
      ffmpeg.terminate();
    } catch (err) {
      console.error('FFmpeg trim error:', err);
      // Fallback: return original file if trim fails
      onTrimmed(file);
    } finally {
      setProcessing(false);
    }
  };

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  const trimDuration = range[1] - range[0];

  return (
    <div className="space-y-4">
      {/* Video preview */}
      <div className="relative rounded-xl overflow-hidden bg-black aspect-[9/16] max-h-[50vh] mx-auto">
        <video
          ref={videoRef}
          src={src}
          className="w-full h-full object-contain"
          playsInline
        />
        <button
          onClick={togglePlay}
          className="absolute inset-0 flex items-center justify-center bg-black/20"
        >
          {playing ? (
            <Pause className="h-12 w-12 text-primary-foreground drop-shadow-lg" fill="currentColor" />
          ) : (
            <Play className="h-12 w-12 text-primary-foreground drop-shadow-lg" fill="currentColor" />
          )}
        </button>
      </div>

      {/* Timeline */}
      <div className="space-y-2 px-2">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{formatTime(range[0])}</span>
          <span className="font-medium text-foreground">
            <Scissors className="h-3 w-3 inline mr-1" />
            {trimDuration.toFixed(1)}s / {maxDuration}s
          </span>
          <span>{formatTime(range[1])}</span>
        </div>

        {duration > 0 && (
          <Slider
            min={0}
            max={duration}
            step={0.1}
            value={range}
            onValueChange={handleRangeChange}
            className="w-full"
          />
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <Button variant="outline" className="flex-1 rounded-xl" onClick={onCancel}>
          Bekor qilish
        </Button>
        <Button
          className="flex-1 rounded-xl"
          onClick={handleTrim}
          disabled={processing}
        >
          {processing ? (
            <span className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Kesilmoqda...
            </span>
          ) : (
            <span className="flex items-center gap-2">
              <Check className="h-4 w-4" />
              Kesish ({trimDuration.toFixed(1)}s)
            </span>
          )}
        </Button>
      </div>
    </div>
  );
};

export default VideoTrimmer;
