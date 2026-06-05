import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { Play, Pause, Check, CheckCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { MediaUploadProgress } from './MediaUploadProgress';
import { useCachedMedia } from '@/hooks/useCachedMedia';

// ─── Types ────────────────────────────────────────────────────────────────────

type DeliveryStatus = 'sent' | 'delivered' | 'read';
type Lang = 'uz' | 'ru' | 'en';
type PlaybackSpeed = 1 | 1.5 | 2;

interface VoiceMessageProps {
  audioUrl: string;
  isMine: boolean;
  /** Pre-computed total duration in seconds */
  duration?: number;
  /** 36 normalised bar heights 0–1 captured during recording */
  waveformData?: number[];
  deliveryStatus?: DeliveryStatus;
  /** Avatar URL for the family-member ring around play button */
  senderAvatarUrl?: string;
  /** Auto-transcription text */
  transcript?: string;
  uploadProgress?: number;
  lang?: Lang;
}

// ─── i18n ─────────────────────────────────────────────────────────────────────

const i18n: Record<Lang, { voiceMessage: string; tapToExpand: string }> = {
  uz: { voiceMessage: 'Ovozli xabar', tapToExpand: 'Matnga aylantirish' },
  ru: { voiceMessage: 'Голосовое сообщение', tapToExpand: 'Раскрыть текст' },
  en: { voiceMessage: 'Voice message', tapToExpand: 'Expand transcript' },
};

// ─── Waveform bar heights ─────────────────────────────────────────────────────

const NUM_BARS = 28;
const MIN_H    = 3;
const MAX_H    = 18;

/** Deterministic heights seeded from the URL so the same message always looks the same */
function seedFromUrl(url: string): number[] {
  let hash = 0;
  for (let i = 0; i < url.length; i++) {
    hash = (hash * 31 + url.charCodeAt(i)) >>> 0;
  }
  return Array.from({ length: NUM_BARS }, (_, i) => {
    // Natural speech envelope: low-high-medium
    const seed = ((hash * (i + 1) * 2654435761) >>> 0) / 0xffffffff;
    const envelope = Math.sin((i / NUM_BARS) * Math.PI) * 0.6 + 0.25;
    const raw = seed * 0.7 + envelope * 0.3;
    return MIN_H + raw * (MAX_H - MIN_H);
  });
}

// ─── Delivery Status Icon ─────────────────────────────────────────────────────

function DeliveryIcon({ status }: { status: DeliveryStatus }) {
  if (status === 'sent') {
    return <Check className="w-3 h-3" style={{ color: 'rgba(255,255,255,0.65)' }} />;
  }
  if (status === 'delivered') {
    return (
      <span className="relative inline-flex items-center" style={{ width: 16 }}>
        <Check className="w-3 h-3 absolute" style={{ left: 0, color: 'rgba(255,255,255,0.65)' }} />
        <Check className="w-3 h-3 absolute" style={{ left: 5, color: 'rgba(255,255,255,0.65)' }} />
      </span>
    );
  }
  // read — blue
  return (
    <span className="relative inline-flex items-center" style={{ width: 16 }}>
      <Check className="w-3 h-3 absolute" style={{ left: 0, color: '#90CAF9' }} />
      <Check className="w-3 h-3 absolute" style={{ left: 5, color: '#90CAF9' }} />
    </span>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export const VoiceMessage = ({
  audioUrl,
  isMine,
  duration: propDuration,
  waveformData: propWaveform,
  deliveryStatus,
  senderAvatarUrl,
  transcript,
  uploadProgress,
  lang = 'uz',
}: VoiceMessageProps) => {
  const [isPlaying, setIsPlaying]           = useState(false);
  const [progress, setProgress]             = useState(0);   // 0–100
  const [currentTime, setCurrentTime]       = useState(0);
  const [duration, setDuration]             = useState(propDuration ?? 0);

  // Kesh: Audio fayl bir marta yuklab olinsa, keyingi safar tarmoqsiz ham ishlaydi
  const { cachedUrl: cachedAudioUrl } = useCachedMedia(
    uploadProgress === undefined ? audioUrl : null
  );
  const effectiveAudioUrl = uploadProgress !== undefined
    ? audioUrl
    : (cachedAudioUrl || audioUrl);

  // Sync when propDuration is passed from parent (e.g., stored metadata)
  useEffect(() => {
    if (propDuration && propDuration > 0) setDuration(propDuration);
  }, [propDuration]);
  const [speed, setSpeed]                   = useState<PlaybackSpeed>(1);
  const [showTranscript, setShowTranscript] = useState(false);
  const [btnPressed, setBtnPressed]         = useState(false);

  const audioRef       = useRef<HTMLAudioElement>(null);
  const waveformRef    = useRef<HTMLDivElement>(null);

  const strings = i18n[lang];

  // Waveform heights — use recorded data if provided, else seed from URL
  const barHeights = useMemo<number[]>(() => {
    if (propWaveform && propWaveform.length === NUM_BARS) {
      return propWaveform.map(v => MIN_H + v * (MAX_H - MIN_H));
    }
    return seedFromUrl(audioUrl);
  }, [propWaveform, audioUrl]);

  // ─── Audio events ──────────────────────────────────────────────────────────
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onMeta = () => {
      if (isFinite(audio.duration)) setDuration(audio.duration);
    };
    const onTime = () => {
      if (!isFinite(audio.duration)) return;
      setProgress((audio.currentTime / audio.duration) * 100);
      setCurrentTime(audio.currentTime);
    };
    const onEnd = () => {
      setIsPlaying(false);
      setProgress(0);
      setCurrentTime(0);
    };

    audio.addEventListener('loadedmetadata', onMeta);
    audio.addEventListener('durationchange', onMeta);
    audio.addEventListener('timeupdate', onTime);
    audio.addEventListener('ended', onEnd);
    return () => {
      audio.removeEventListener('loadedmetadata', onMeta);
      audio.removeEventListener('durationchange', onMeta);
      audio.removeEventListener('timeupdate', onTime);
      audio.removeEventListener('ended', onEnd);
    };
  }, []);

  // Sync playback speed
  useEffect(() => {
    if (audioRef.current) audioRef.current.playbackRate = speed;
  }, [speed]);

  const togglePlay = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      await audio.play();
      setIsPlaying(true);
    }
  }, [isPlaying]);

  // Click on waveform to seek
  const handleWaveformClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const audio = audioRef.current;
    const bar   = waveformRef.current;
    if (!audio || !bar || !isFinite(audio.duration)) return;
    const rect = bar.getBoundingClientRect();
    const pct  = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    audio.currentTime = pct * audio.duration;
    setProgress(pct * 100);
  };

  const cycleSpeed = () => {
    setSpeed(prev => (prev === 1 ? 1.5 : prev === 1.5 ? 2 : 1));
  };

  const formatTime = (s: number) => {
    if (!s || !isFinite(s)) return '0:00';
    return `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, '0')}`;
  };

  // ─── Colors ────────────────────────────────────────────────────────────────
  const BRAND        = '#534AB7';
  const SENT_BG      = '#534AB7';
  const RECV_BG      = '#F5F4FE';

  const playBtnBg     = isMine ? 'rgba(255,255,255,0.2)' : BRAND;
  const playIconColor = 'white';
  const barPlayed     = isMine ? 'rgba(255,255,255,0.95)' : BRAND;
  const barUnplayed   = isMine ? 'rgba(255,255,255,0.3)'  : `${BRAND}44`;
  const timeColor     = isMine ? 'rgba(255,255,255,0.85)' : '#888';

  const isUploading = uploadProgress !== undefined && uploadProgress < 100;

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <motion.div
      initial={{ scale: 0.95, opacity: 0, y: 5 }}
      animate={{ scale: 1, opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 24 }}
      className="relative max-w-[300px] min-w-[200px]"
      style={{
        transformOrigin: isMine ? 'bottom right' : 'bottom left',
        marginTop: 2,
        marginBottom: 2,
      }}
    >
      <audio ref={audioRef} src={effectiveAudioUrl} preload="metadata" />

      {/* ── Main row ── */}
      <div className="flex items-center gap-3">

        {/* Play button / upload progress */}
        <div className="relative flex-shrink-0">
          {senderAvatarUrl && !isMine && (
            <img
              src={senderAvatarUrl}
              alt=""
              className="absolute -top-1 -left-1 w-5 h-5 rounded-full border-2 object-cover"
              style={{ borderColor: 'white', zIndex: 2 }}
            />
          )}

          {isUploading ? (
            <div
              className="flex items-center justify-center rounded-full"
              style={{ width: 44, height: 44, background: playBtnBg }}
            >
              <MediaUploadProgress progress={uploadProgress!} size={28} showText={false} />
            </div>
          ) : (
            <motion.button
              onClick={togglePlay}
              onPointerDown={() => setBtnPressed(true)}
              onPointerUp={() => setBtnPressed(false)}
              animate={btnPressed
                ? { scale: [1, 0.9, 1.05, 1] }
                : { scale: 1 }
              }
              transition={{ type: 'spring', stiffness: 400, damping: 20 }}
              className="flex items-center justify-center rounded-full select-none"
              style={{ width: 44, height: 44, background: playBtnBg }}
            >
              {isPlaying
                ? <Pause  size={18} color={playIconColor} fill={playIconColor} className="ml-0" />
                : <Play   size={18} color={playIconColor} fill={playIconColor} className="ml-1" />
              }
            </motion.button>
          )}
        </div>

        {/* Waveform + meta */}
        <div className="flex-1 flex flex-col justify-center min-w-0" style={{ gap: 2 }}>

          <div
            ref={waveformRef}
            className="flex items-center cursor-pointer select-none"
            style={{ gap: 2, height: MAX_H, position: 'relative' }}
            onClick={handleWaveformClick}
          >
            {barHeights.map((h, i) => {
              const barFrac = (i / NUM_BARS) * 100;
              const played  = barFrac <= progress;
              return (
                <div
                  key={i}
                  style={{
                    width: 2.5,
                    height: h,
                    borderRadius: 2,
                    background: played ? barPlayed : barUnplayed,
                    transition: `background 100ms ease`,
                    flexShrink: 0,
                  }}
                />
              );
            })}
          </div>

          {/* Duration + delivery */}
          <div className="flex items-center justify-between mt-1" style={{ gap: 4 }}>
            <span
              className="tabular-nums"
              style={{ fontSize: 11, fontWeight: 600, color: timeColor, letterSpacing: 0.2 }}
            >
              {isPlaying
                ? `${formatTime(currentTime)} / ${formatTime(duration)}`
                : formatTime(duration)
              }
            </span>

            <div className="flex items-center gap-1.5">
              {/* Speed toggle */}
              {!isMine && (
                <AnimatePresence>
                  {(isPlaying || progress > 0) && (
                    <motion.button
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      onClick={cycleSpeed}
                      className="rounded-full flex items-center justify-center"
                      style={{
                        background: '#EEEDFE',
                        padding: '2px 7px',
                        fontSize: 10,
                        fontWeight: 700,
                        color: BRAND,
                      }}
                    >
                      {speed === 1 ? '1×' : speed === 1.5 ? '1.5×' : '2×'}
                    </motion.button>
                  )}
                </AnimatePresence>
              )}

              {/* Transcript toggle */}
              {transcript && (
                <button
                  onClick={() => setShowTranscript(v => !v)}
                  title={strings.tapToExpand}
                  className="rounded-full flex items-center justify-center"
                  style={{
                    background: isMine ? 'rgba(255,255,255,0.2)' : '#EEEDFE',
                    padding: '2px 6px',
                    fontSize: 10,
                    fontWeight: 700,
                    color: isMine ? 'white' : BRAND,
                  }}
                >
                  Aa
                </button>
              )}

              {/* Delivery status */}
              {isMine && deliveryStatus && (
                <span className="flex items-center" style={{ minWidth: 16 }}>
                  <DeliveryIcon status={deliveryStatus} />
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Transcript expansion */}
      <AnimatePresence>
        {showTranscript && transcript && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 26 }}
            style={{ overflow: 'hidden' }}
          >
            <div
              className="mt-3 pt-3"
              style={{
                borderTop: isMine ? '1px solid rgba(255,255,255,0.15)' : '1px solid rgba(0,0,0,0.06)',
                fontSize: 13,
                lineHeight: 1.45,
                color: isMine ? 'rgba(255,255,255,0.95)' : 'rgba(0,0,0,0.8)',
              }}
            >
              {transcript}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};
