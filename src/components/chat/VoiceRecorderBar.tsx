import { useEffect, useRef, useState } from 'react';
import { Trash2, Lock, Check, Mic, Send } from 'lucide-react';
import { motion, AnimatePresence, useMotionValue, useTransform, animate } from 'framer-motion';

// ─── Types ────────────────────────────────────────────────────────────────────

type RecorderBarState = 'recording' | 'locked' | 'uploading';

interface VoiceRecorderBarProps {
  state: RecorderBarState;
  duration: number;
  waveformData: number[];
  isUploading?: boolean;
  uploadProgress?: number;
  formatDuration: (s: number) => string;
  /** Real-time drag delta from parent gesture tracking */
  dragDelta?: { x: number; y: number };
  onCancel: () => void;
  onLock: () => void;
  onStop: () => void;
  onMicPointerDown: (e: React.PointerEvent) => void;
  onMicPointerMove: (e: React.PointerEvent) => void;
  onMicPointerUp:   (e: React.PointerEvent) => void;
  onMicPointerCancel: () => void;
}

// ─── Design tokens ────────────────────────────────────────────────────────────

const BRAND      = '#534AB7';
const BRAND_SOFT = '#7C6FD4';
const CANCEL_RED = '#E24B4A';
const NUM_BARS   = 36;
const MIN_H      = 3;
const MAX_H      = 28;

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** clamp a number between min and max */
const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

// ─── Live waveform bars ───────────────────────────────────────────────────────

interface WaveformProps {
  data: number[];
  /** 0-1 progress of cancel drag (tints bars red) */
  cancelProgress?: number;
  /** true = locked mode uses brand gradient */
  locked?: boolean;
}

function LiveWaveform({ data, cancelProgress = 0, locked = false }: WaveformProps) {
  return (
    <div
      className="flex items-center flex-1 overflow-hidden"
      style={{ gap: 2.5, height: MAX_H + 4, minWidth: 0 }}
    >
      {data.map((v, i) => {
        const h = Math.max(MIN_H, v * MAX_H);
        // Color interpolation: brand → red as cancel drag increases
        const r1 = 83, g1 = 74, b1 = 183;   // #534AB7
        const r2 = 226, g2 = 75, b2 = 74;    // #E24B4A
        const t = cancelProgress;
        const r = Math.round(r1 + (r2 - r1) * t);
        const g = Math.round(g1 + (g2 - g1) * t);
        const b = Math.round(b1 + (b2 - b1) * t);
        const color = locked ? BRAND_SOFT : `rgb(${r},${g},${b})`;
        return (
          <motion.div
            key={i}
            animate={{ height: h }}
            transition={{ type: 'spring', stiffness: 400, damping: 28, mass: 0.4 }}
            style={{
              width: 3,
              flexShrink: 0,
              borderRadius: 2,
              background: color,
              opacity: 0.85 + 0.15 * v,
            }}
          />
        );
      })}
    </div>
  );
}

// ─── Pulsing recording dot ────────────────────────────────────────────────────

function RecordDot({ color = CANCEL_RED }: { color?: string }) {
  return (
    <motion.div
      animate={{ scale: [1, 1.4, 1], opacity: [1, 0.35, 1] }}
      transition={{ duration: 1.1, repeat: Infinity, ease: 'easeInOut' }}
      style={{
        width: 9,
        height: 9,
        borderRadius: '50%',
        background: color,
        flexShrink: 0,
        boxShadow: `0 0 8px ${color}99`,
      }}
    />
  );
}

// ─── Spinning upload ring ─────────────────────────────────────────────────────

function UploadRing({ progress }: { progress?: number }) {
  const radius = 14;
  const circumference = 2 * Math.PI * radius;
  const offset = progress !== undefined
    ? circumference * (1 - clamp(progress, 0, 100) / 100)
    : 0;
  return (
    <div className="relative w-10 h-10 flex items-center justify-center">
      <svg width="40" height="40" className="absolute inset-0 -rotate-90">
        <circle cx="20" cy="20" r={radius} stroke="rgba(255,255,255,0.2)" strokeWidth="2.5" fill="none" />
        {progress !== undefined ? (
          <circle
            cx="20" cy="20" r={radius}
            stroke="white" strokeWidth="2.5" fill="none"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset 0.2s ease' }}
          />
        ) : (
          <motion.circle
            cx="20" cy="20" r={radius}
            stroke="white" strokeWidth="2.5" fill="none"
            strokeDasharray={`${circumference * 0.3} ${circumference * 0.7}`}
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
            style={{ transformOrigin: '20px 20px' }}
          />
        )}
      </svg>
      <Send size={14} color="white" />
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export const VoiceRecorderBar = ({
  state,
  duration,
  waveformData,
  isUploading,
  uploadProgress,
  formatDuration,
  dragDelta = { x: 0, y: 0 },
  onCancel,
  onLock,
  onStop,
  onMicPointerDown,
  onMicPointerMove,
  onMicPointerUp,
  onMicPointerCancel,
}: VoiceRecorderBarProps) => {
  const [showHints, setShowHints] = useState(false);
  const hintTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Show "slide to cancel / swipe up to lock" hints after 800 ms
  useEffect(() => {
    if (state === 'recording') {
      setShowHints(false);
      hintTimerRef.current = setTimeout(() => setShowHints(true), 800);
    }
    return () => { if (hintTimerRef.current) clearTimeout(hintTimerRef.current); };
  }, [state]);

  // Normalised progress values for animations
  const cancelProgress = clamp(dragDelta.x / 80, 0, 1);   // 0..1 as user drags left
  const lockProgress   = clamp(dragDelta.y / 60, 0, 1);   // 0..1 as user drags up

  // How much the bar slides left with finger drag (max 48px)
  const barSlideX = -dragDelta.x * 0.55;

  // ── RECORDING STATE ────────────────────────────────────────────────────────
  if (state === 'recording') {
    return (
      <AnimatePresence>
        <motion.div
          key="recording-bar"
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{
            opacity: 1,
            y: 0,
            scale: 1,
            x: clamp(barSlideX, -60, 0),
          }}
          exit={{ opacity: 0, x: -80, scale: 0.9 }}
          transition={{ type: 'spring', stiffness: 340, damping: 28, mass: 0.8 }}
          className="relative"
        >
          {/* ── Lock float indicator — rises as user drags up ── */}
          <AnimatePresence>
            {lockProgress > 0.05 && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{
                  opacity: clamp(lockProgress * 2, 0, 1),
                  y: -lockProgress * 32,
                  scale: 0.85 + lockProgress * 0.3,
                }}
                exit={{ opacity: 0, y: 0 }}
                transition={{ type: 'spring', stiffness: 320, damping: 22 }}
                className="absolute right-0 bottom-full mb-1 flex flex-col items-center"
              >
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center"
                  style={{
                    background: `rgba(83,74,183,${0.15 + lockProgress * 0.7})`,
                    border: `2px solid rgba(83,74,183,${0.4 + lockProgress * 0.6})`,
                    boxShadow: lockProgress > 0.7 ? `0 4px 20px ${BRAND}66` : 'none',
                  }}
                >
                  <Lock size={16} color={BRAND} />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── Cancel flash overlay (tints the bar red on far left drag) ── */}
          <motion.div
            animate={{ opacity: cancelProgress * 0.12 }}
            className="absolute inset-0 rounded-[28px] pointer-events-none"
            style={{ background: CANCEL_RED, zIndex: 1 }}
          />

          {/* ── Main recording bar ── */}
          <div
            className="flex items-center gap-2 px-3 py-3 rounded-[28px] relative overflow-hidden"
            style={{
              background: 'rgba(255,255,255,0.92)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              border: `1.5px solid rgba(${83 + cancelProgress * 143}, ${74 + cancelProgress * 1}, ${183 - cancelProgress * 109}, ${0.2 + cancelProgress * 0.3})`,
              boxShadow: '0 8px 32px rgba(0,0,0,0.10), 0 2px 8px rgba(0,0,0,0.06)',
            }}
          >
            {/* Dark mode glass override */}
            <div
              className="absolute inset-0 rounded-[28px] hidden dark:block pointer-events-none"
              style={{
                background: 'rgba(20,18,35,0.85)',
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)',
              }}
            />
            <div className="contents" style={{ position: 'relative', zIndex: 2 }}>

              {/* Trash / cancel button */}
              <motion.button
                onClick={onCancel}
                animate={{
                  rotate: cancelProgress > 0.85 ? [0, -8, 8, -8, 0] : 0,
                  scale: 1 + cancelProgress * 0.1,
                }}
                transition={{ duration: 0.3 }}
                className="flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center"
                style={{
                  background: `rgba(226,75,74,${0.12 + cancelProgress * 0.2})`,
                  border: `1px solid rgba(226,75,74,${0.15 + cancelProgress * 0.4})`,
                }}
              >
                <Trash2 size={16} color={`rgba(${Math.round(180 + cancelProgress * 46)},${Math.round(75 - cancelProgress * 0)},${Math.round(74 - cancelProgress * 0)},1)`} />
              </motion.button>

              {/* Pulse dot */}
              <RecordDot color={cancelProgress > 0.5 ? CANCEL_RED : '#E24B4A'} />

              {/* Live waveform */}
              <LiveWaveform data={waveformData} cancelProgress={cancelProgress} />

              {/* Timer */}
              <motion.span
                animate={{ opacity: 1 - cancelProgress * 0.5 }}
                className="tabular-nums flex-shrink-0 dark:text-white"
                style={{ fontSize: 13, fontWeight: 700, color: cancelProgress > 0.5 ? CANCEL_RED : '#1a1a2e', letterSpacing: 0.2 }}
              >
                {formatDuration(duration)}
              </motion.span>

              {/* Hints section — slide-to-cancel + lock-up */}
              <AnimatePresence>
                {showHints && dragDelta.x === 0 && dragDelta.y === 0 && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.35 }}
                    className="flex flex-col items-end gap-0.5 flex-shrink-0"
                  >
                    {/* ← cancel hint */}
                    <div className="flex items-center gap-0.5">
                      <motion.span
                        animate={{ x: [0, -5, 0] }}
                        transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
                        style={{ fontSize: 10, color: '#aaa' }}
                      >←</motion.span>
                      <span style={{ fontSize: 10, color: '#aaa' }}>Bekor</span>
                    </div>
                    {/* ↑ lock hint */}
                    <div className="flex items-center gap-0.5">
                      <motion.span
                        animate={{ y: [0, -3, 0] }}
                        transition={{ duration: 1.0, repeat: Infinity, ease: 'easeInOut' }}
                        style={{ fontSize: 10, color: '#aaa' }}
                      >↑</motion.span>
                      <Lock size={9} color="#bbb" />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Lock bounce hint icon (always visible below hints) */}
              <motion.button
                onClick={onLock}
                animate={showHints && dragDelta.x === 0 && dragDelta.y === 0
                  ? { y: [0, -3, 0] }
                  : { y: 0 }
                }
                transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
                className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center"
                style={{
                  background: `rgba(83,74,183,${0.08 + lockProgress * 0.25})`,
                  border: `1px solid rgba(83,74,183,${0.15 + lockProgress * 0.4})`,
                  transform: `scale(${1 + lockProgress * 0.2})`,
                }}
              >
                <Lock size={14} color={`rgba(83,74,183,${0.5 + lockProgress * 0.5})`} />
              </motion.button>

              {/* Mic hold button — large, pulsing */}
              <div className="relative flex-shrink-0">
                {/* Outer pulse ring */}
                <motion.div
                  animate={{ scale: [1, 1.2, 1], opacity: [0.35, 0, 0.35] }}
                  transition={{ duration: 1.4, repeat: Infinity, ease: 'easeOut' }}
                  className="absolute inset-0 rounded-full"
                  style={{ background: BRAND, margin: -5 }}
                />
                <motion.div
                  onPointerDown={onMicPointerDown}
                  onPointerMove={onMicPointerMove}
                  onPointerUp={onMicPointerUp}
                  onPointerCancel={onMicPointerCancel}
                  whileTap={{ scale: 1.12 }}
                  className="relative w-11 h-11 rounded-full flex items-center justify-center cursor-pointer select-none touch-none"
                  style={{
                    background: `linear-gradient(135deg, ${BRAND} 0%, ${BRAND_SOFT} 100%)`,
                    boxShadow: `0 4px 20px ${BRAND}70, 0 0 0 0 ${BRAND}40`,
                    touchAction: 'none',
                  }}
                >
                  <Mic size={20} color="white" />
                </motion.div>
              </div>

            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    );
  }

  // ── LOCKED STATE ────────────────────────────────────────────────────────────
  if (state === 'locked') {
    return (
      <motion.div
        key="locked-bar"
        initial={{ opacity: 0, scale: 0.97, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 8 }}
        transition={{ type: 'spring', stiffness: 360, damping: 26 }}
        className="relative"
      >
        {/* Lock badge drops from top */}
        <motion.div
          initial={{ y: -16, opacity: 0, scale: 0.85 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          transition={{ type: 'spring', stiffness: 380, damping: 22, delay: 0.05 }}
          className="absolute bottom-full left-0 right-0 flex justify-center mb-2 pointer-events-none"
        >
          <div
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-full pointer-events-auto"
            style={{
              background: `linear-gradient(135deg, ${BRAND}22 0%, ${BRAND_SOFT}18 100%)`,
              border: `1px solid ${BRAND}44`,
              backdropFilter: 'blur(8px)',
            }}
          >
            {/* Sparkle lock icon */}
            <motion.div
              animate={{ rotate: [0, -8, 8, 0] }}
              transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut', delay: 0.5 }}
            >
              <Lock size={11} color={BRAND} />
            </motion.div>
            <span style={{ fontSize: 12, color: BRAND, fontWeight: 700, letterSpacing: 0.3 }}>
              Qulflangan
            </span>
            {/* Live pulse dot */}
            <motion.span
              animate={{ opacity: [1, 0, 1] }}
              transition={{ duration: 1, repeat: Infinity }}
              style={{ width: 5, height: 5, borderRadius: '50%', background: CANCEL_RED, display: 'inline-block', boxShadow: `0 0 6px ${CANCEL_RED}` }}
            />
          </div>
        </motion.div>

        {/* Main locked bar */}
        <div
          className="flex items-center gap-3 px-3 py-3 rounded-[28px] relative overflow-hidden"
          style={{
            background: 'rgba(255,255,255,0.92)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            border: `1.5px solid ${BRAND}55`,
            boxShadow: `0 8px 32px ${BRAND}18, 0 2px 8px rgba(0,0,0,0.06)`,
          }}
        >
          {/* Brand tint overlay */}
          <div
            className="absolute inset-0 rounded-[28px] pointer-events-none"
            style={{ background: `linear-gradient(135deg, ${BRAND}08 0%, ${BRAND_SOFT}05 100%)` }}
          />
          {/* Dark mode glass */}
          <div
            className="absolute inset-0 rounded-[28px] hidden dark:block pointer-events-none"
            style={{ background: 'rgba(20,18,35,0.88)', backdropFilter: 'blur(20px)' }}
          />

          <div className="contents" style={{ position: 'relative', zIndex: 2 }}>
            {/* Delete */}
            <motion.button
              onClick={onCancel}
              whileTap={{ scale: 0.9 }}
              className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
              style={{ background: 'rgba(226,75,74,0.12)', border: '1px solid rgba(226,75,74,0.2)' }}
            >
              <Trash2 size={16} color={CANCEL_RED} />
            </motion.button>

            {/* Pulse dot + waveform */}
            <RecordDot />
            <LiveWaveform data={waveformData} locked />

            {/* Timer */}
            <span
              className="tabular-nums flex-shrink-0"
              style={{ fontSize: 14, fontWeight: 700, color: BRAND, letterSpacing: 0.3 }}
            >
              {formatDuration(duration)}
            </span>

            {/* Send button */}
            <motion.button
              onClick={onStop}
              whileTap={{ scale: 0.88 }}
              className="w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0 relative overflow-hidden"
              style={{
                background: `linear-gradient(135deg, ${BRAND} 0%, ${BRAND_SOFT} 100%)`,
                boxShadow: `0 4px 20px ${BRAND}70`,
              }}
            >
              {/* Shimmer */}
              <motion.div
                animate={{ x: ['-100%', '200%'] }}
                transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut', repeatDelay: 1 }}
                className="absolute inset-0 skew-x-12"
                style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent)', width: '50%' }}
              />
              <Check size={20} color="white" />
            </motion.button>
          </div>
        </div>
      </motion.div>
    );
  }

  // ── UPLOADING STATE ─────────────────────────────────────────────────────────
  return (
    <motion.div
      key="uploading-bar"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, y: 6 }}
      transition={{ type: 'spring', stiffness: 320, damping: 26 }}
      className="flex items-center gap-3 px-4 py-3 rounded-[28px] relative overflow-hidden"
      style={{
        background: 'rgba(255,255,255,0.92)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        border: `1.5px solid ${BRAND}33`,
        boxShadow: `0 8px 32px ${BRAND}15, 0 2px 8px rgba(0,0,0,0.06)`,
      }}
    >
      {/* Dark mode */}
      <div
        className="absolute inset-0 rounded-[28px] hidden dark:block pointer-events-none"
        style={{ background: 'rgba(20,18,35,0.88)', backdropFilter: 'blur(20px)' }}
      />

      {/* Animated progress bar */}
      {uploadProgress !== undefined && (
        <motion.div
          className="absolute bottom-0 left-0 h-0.5 rounded-full"
          style={{ background: `linear-gradient(90deg, ${BRAND}, ${BRAND_SOFT})` }}
          animate={{ width: `${uploadProgress}%` }}
          transition={{ ease: 'linear', duration: 0.2 }}
        />
      )}

      <div className="contents" style={{ position: 'relative', zIndex: 2 }}>
        {/* Icon in send ring */}
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
          style={{
            background: `linear-gradient(135deg, ${BRAND} 0%, ${BRAND_SOFT} 100%)`,
            boxShadow: `0 4px 16px ${BRAND}55`,
          }}
        >
          <UploadRing progress={uploadProgress} />
        </div>

        {/* Label */}
        <div className="flex-1 min-w-0">
          <div style={{ fontSize: 13, fontWeight: 700, color: BRAND }} className="dark:text-white">
            Ovozli xabar
          </div>
          <motion.div
            animate={{ opacity: [1, 0.5, 1] }}
            transition={{ duration: 1.2, repeat: Infinity }}
            style={{ fontSize: 11, color: '#999', fontVariantNumeric: 'tabular-nums' }}
          >
            {uploadProgress !== undefined ? `Yuklanmoqda… ${Math.round(uploadProgress)}%` : 'Tayyorlanmoqda…'}
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
};
