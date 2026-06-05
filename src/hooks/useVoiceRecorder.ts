import { useState, useRef, useCallback, useEffect } from 'react';
import { toast } from 'sonner';

const NUM_BARS = 36;

export type WaveformData = number[];

export interface VoiceRecorderState {
  isRecording: boolean;
  duration: number;
  audioBlob: Blob | null;
  waveformData: WaveformData;
  recordedWaveformSnapshot: WaveformData;
  playbackSpeed: 1 | 1.5 | 2;
}

export const useVoiceRecorder = () => {
  const [isRecording, setIsRecording]                         = useState(false);
  const [duration, setDuration]                               = useState(0);
  const [audioBlob, setAudioBlob]                             = useState<Blob | null>(null);
  const [waveformData, setWaveformData]                       = useState<WaveformData>(Array(NUM_BARS).fill(0));
  const [recordedWaveformSnapshot, setRecordedWaveformSnapshot] = useState<WaveformData>(Array(NUM_BARS).fill(0.15));
  const [playbackSpeed, setPlaybackSpeed]                     = useState<1 | 1.5 | 2>(1);

  const mediaRecorderRef  = useRef<MediaRecorder | null>(null);
  const audioChunksRef    = useRef<Blob[]>([]);
  const startTimeRef      = useRef<number>(0);
  const durationRef       = useRef<number>(0); // Keeps real-time track without depending on state
  const isInitializingRef = useRef<boolean>(false);

  const animFrameRef      = useRef<number>(0);
  const analyserRef       = useRef<AnalyserNode | null>(null);
  const audioCtxRef       = useRef<AudioContext | null>(null);
  const sourceRef         = useRef<MediaStreamAudioSourceNode | null>(null);
  const streamRef         = useRef<MediaStream | null>(null);

  const accumulatedBarsRef = useRef<number[]>(Array(NUM_BARS).fill(0));
  const frameCountRef      = useRef<number>(0);
  const mimeTypeRef        = useRef<string>('');

  // ─── RAF waveform loop ───────────────────────────────────────────────────
  const startWaveformLoop = useCallback(() => {
    const analyser = analyserRef.current;
    if (!analyser) return;

    const bufferLength = analyser.frequencyBinCount;
    const dataArray    = new Uint8Array(bufferLength);

    const tick = () => {
      // 1. Update duration reliably inside RAF
      if (startTimeRef.current > 0) {
        const currentSecs = Math.floor((Date.now() - startTimeRef.current) / 1000);
        if (currentSecs !== durationRef.current) {
          durationRef.current = currentSecs;
          setDuration(currentSecs);
        }
      }

      // 2. Update waveform
      analyser.getByteFrequencyData(dataArray);
      const bucketSize = Math.floor(bufferLength / NUM_BARS);
      const bars: number[] = [];

      for (let b = 0; b < NUM_BARS; b++) {
        let sum = 0;
        for (let k = 0; k < bucketSize; k++) {
          sum += dataArray[b * bucketSize + k];
        }
        const avg = sum / bucketSize / 255;
        bars.push(avg);
        accumulatedBarsRef.current[b] += avg;
      }

      frameCountRef.current += 1;
      setWaveformData([...bars]);
      animFrameRef.current = requestAnimationFrame(tick);
    };

    animFrameRef.current = requestAnimationFrame(tick);
  }, []);

  const stopWaveformLoop = useCallback(() => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = 0;
    }
  }, []);

  // ─── Build snapshot ───────────────────────────────────────────────────────
  const buildSnapshot = useCallback((): WaveformData => {
    const count = frameCountRef.current || 1;
    return accumulatedBarsRef.current.map(total => {
      const avg = total / count;
      return Math.min(1, avg * 1.4 + 0.08);
    });
  }, []);

  // ─── startRecording ──────────────────────────────────────────────────────
  const startRecording = useCallback(async () => {
    try {
      isInitializingRef.current = true;
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // If user released pointer while we were waiting for permissions:
      if (!isInitializingRef.current) {
        stream.getTracks().forEach(t => t.stop());
        return;
      }

      streamRef.current = stream;

      const audioCtx = new AudioContext();
      audioCtxRef.current = audioCtx;
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.75;
      analyserRef.current = analyser;
      const source = audioCtx.createMediaStreamSource(stream);
      sourceRef.current = source;
      source.connect(analyser);

      accumulatedBarsRef.current = Array(NUM_BARS).fill(0);
      frameCountRef.current = 0;

      // Robustly probe supported mimeTypes to avoid NotSupportedError in WebView/Safari
      const candidateTypes = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/ogg;codecs=opus',
        'audio/mp4',
        'audio/aac',
      ];
      let selectedType = '';
      for (const type of candidateTypes) {
        if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(type)) {
          selectedType = type;
          break;
        }
      }
      mimeTypeRef.current = selectedType;

      const options: MediaRecorderOptions = {};
      if (selectedType) {
        options.mimeType = selectedType;
      }

      const mediaRecorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.start(100);
      setIsRecording(true);
      
      // Reset timer
      durationRef.current = 0;
      setDuration(0);
      startTimeRef.current = Date.now();

      startWaveformLoop();

    } catch (err: any) {
      console.error('useVoiceRecorder: startRecording error', err);
      toast.error(`Mikrofon xatoligi: ${err?.message || err}`);
      isInitializingRef.current = false;
    }
  }, [startWaveformLoop]);

  // ─── stopRecording ────────────────────────────────────────────────────────
  const stopRecording = useCallback(() => {
    return new Promise<{ blob: Blob; snapshot: number[] }>((resolve) => {
      isInitializingRef.current = false;
      stopWaveformLoop();

      const snapshot = buildSnapshot();
      setRecordedWaveformSnapshot(snapshot);
      setWaveformData(Array(NUM_BARS).fill(0));

      const mr = mediaRecorderRef.current;
      if (mr && mr.state !== 'inactive') {
        mr.onstop = () => {
          const blob = new Blob(audioChunksRef.current, { type: mimeTypeRef.current || 'audio/webm' });
          setAudioBlob(blob);
          streamRef.current?.getTracks().forEach(t => t.stop());
          resolve({ blob, snapshot });
        };
        mr.stop();
        setIsRecording(false);
      } else {
        resolve({ blob: new Blob([], { type: 'audio/webm' }), snapshot });
      }

      audioCtxRef.current?.close().catch(() => {});
      audioCtxRef.current = null;
    });
  }, [stopWaveformLoop, buildSnapshot]);

  // ─── cancelRecording ──────────────────────────────────────────────────────
  const cancelRecording = useCallback(() => {
    isInitializingRef.current = false;
    stopWaveformLoop();

    const mr = mediaRecorderRef.current;
    if (mr && mr.state !== 'inactive') {
      mr.onstop = null;
      mr.stop();
    }

    streamRef.current?.getTracks().forEach(t => t.stop());
    audioCtxRef.current?.close().catch(() => {});
    audioCtxRef.current = null;

    setIsRecording(false);
    setAudioBlob(null);
    setDuration(0);
    durationRef.current = 0;
    setWaveformData(Array(NUM_BARS).fill(0));
    audioChunksRef.current = [];
  }, [stopWaveformLoop]);

  const clearAudio = useCallback(() => {
    setAudioBlob(null);
    setDuration(0);
    durationRef.current = 0;
    setWaveformData(Array(NUM_BARS).fill(0));
    setRecordedWaveformSnapshot(Array(NUM_BARS).fill(0.15));
    audioChunksRef.current = [];
  }, []);

  const cyclePlaybackSpeed = useCallback(() => {
    setPlaybackSpeed(prev => prev === 1 ? 1.5 : prev === 1.5 ? 2 : 1);
  }, []);

  useEffect(() => {
    return () => {
      stopWaveformLoop();
      audioCtxRef.current?.close().catch(() => {});
      streamRef.current?.getTracks().forEach(t => t.stop());
    };
  }, [stopWaveformLoop]);

  const getDurationMs = useCallback(() => {
    return startTimeRef.current > 0 ? Date.now() - startTimeRef.current : 0;
  }, []);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return {
    isRecording,
    duration,
    audioBlob,
    waveformData,
    recordedWaveformSnapshot,
    playbackSpeed,
    startRecording,
    stopRecording,
    cancelRecording,
    clearAudio,
    cyclePlaybackSpeed,
    formatDuration,
    getDurationMs,
  };
};
